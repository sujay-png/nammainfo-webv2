-- =====================================================================
--  Namma Info: security lockdown
--  Run in the Supabase SQL Editor, then deploy the matching code right
--  after (the payment check and admin trial notes depend on it).
--  Safe to run more than once.
--
--  What it fixes
--  1. Customers could change protected fields on their own profile
--     (is_admin, role, plan, expiry, trial status...) straight from the
--     browser, i.e. make themselves Pro for free or an admin.
--  2. Customers could change billing fields on team members (is_premium,
--     expiry) and add team members beyond the slots they paid for.
--  3. Customers could create their own "paid" orders and edit order
--     status/amounts. They can now only change the design and shipping
--     details of their own order while it is under review.
--  4. The admin's private trial follow-up notes were readable by anyone.
--     They move to an admin-only table, which also stores the company
--     follow-up status/notes (those columns never existed, so saving a
--     company follow-up failed).
--  5. Adds the missing profiles.primary_card_count column that the
--     payment webhook and trial approval write.
--
--  Who can still change everything: the server (service role key),
--  the database owner (SQL Editor) and admins (is_admin / role = admin).
-- =====================================================================

-- 0. Helper functions: same logic as before, now with a fixed
--    search_path (a SECURITY DEFINER function without one can be hijacked).
create or replace function public.is_admin()
returns boolean
language plpgsql
security definer
set search_path = public
stable
as $$
begin
  return exists (
    select 1 from public.profiles
    where id = auth.uid() and (is_admin = true or role = 'admin')
  );
end;
$$;

create or replace function public.is_staff()
returns boolean
language plpgsql
security definer
set search_path = public
stable
as $$
begin
  return exists (
    select 1 from public.profiles
    where id = auth.uid() and (is_admin = true or role in ('admin', 'designer'))
  );
end;
$$;

create or replace function public.is_designer()
returns boolean
language plpgsql
security definer
set search_path = public
stable
as $$
begin
  return exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'designer'
  );
end;
$$;

-- True when the request comes from a customer's browser session
-- (anon / authenticated) and that person is not an admin.
create or replace function public.is_customer_request()
returns boolean
language sql
stable
set search_path = public
as $$
  select current_user in ('anon', 'authenticated') and not public.is_admin();
$$;

-- 5. Missing column
alter table public.profiles add column if not exists primary_card_count integer default 0;

-- ---------------------------------------------------------------------
-- 1. Profiles: protected fields
-- ---------------------------------------------------------------------
create or replace function public.profiles_protect_privileged()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  -- Fields only the server / admins may change.
  locked text[] := array[
    'is_admin', 'role', 'status', 'subscription_plan', 'subscription_started_at',
    'membership_expires_at', 'is_member', 'purchased_id_count', 'primary_card_count',
    'account_type', 'card_designed',
    'trial_status', 'trial_coupon_code', 'trial_requested_at', 'trial_approved_at',
    'trial_extension_days', 'trial_follow_up_milestone', 'trial_follow_up_status',
    'trial_follow_up_notes'
  ];
  -- What a brand-new profile starts with when a customer creates it.
  fresh jsonb := jsonb_build_object(
    'is_admin', false, 'role', 'user', 'status', 'active', 'subscription_plan', 'free',
    'is_member', false, 'membership_expires_at', null, 'purchased_id_count', 0,
    'primary_card_count', 0, 'card_designed', false, 'trial_status', 'none',
    'trial_coupon_code', null, 'trial_requested_at', null, 'trial_approved_at', null,
    'trial_extension_days', 0, 'trial_follow_up_milestone', 0,
    'trial_follow_up_status', 'unattended', 'trial_follow_up_notes', ''
  );
  n jsonb;
  o jsonb;
  c text;
begin
  if not public.is_customer_request() then
    return new;
  end if;

  n := to_jsonb(new);
  if tg_op = 'UPDATE' then
    -- Quietly keep the old value: the rest of the edit still saves.
    o := to_jsonb(old);
    foreach c in array locked loop
      if n ? c then
        n := jsonb_set(n, array[c], coalesce(o -> c, 'null'::jsonb));
      end if;
    end loop;
  else
    foreach c in array locked loop
      if n ? c and fresh ? c then
        n := jsonb_set(n, array[c], fresh -> c);
      end if;
    end loop;
  end if;
  return jsonb_populate_record(new, n);
end;
$$;

drop trigger if exists profiles_protect_privileged on public.profiles;
create trigger profiles_protect_privileged
  before insert or update on public.profiles
  for each row execute function public.profiles_protect_privileged();

-- ---------------------------------------------------------------------
-- 2. Team members: billing fields and paid slots
-- ---------------------------------------------------------------------
create or replace function public.employees_protect_billing()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_owner record;
  v_paid boolean;
  v_used integer;
begin
  if not public.is_customer_request() then
    return new;
  end if;

  if tg_op = 'UPDATE' then
    new.is_premium := old.is_premium;
    new.subscription_started_at := old.subscription_started_at;
    new.subscription_expires_at := old.subscription_expires_at;
    new.status := old.status;
    return new;
  end if;

  -- INSERT by the owner: needs a free paid slot; billing fields follow
  -- the owner's own plan.
  select subscription_plan, is_member, membership_expires_at,
         subscription_started_at, coalesce(purchased_id_count, 0) as slots
    into v_owner
  from public.profiles where id = new.owner_id;

  v_paid := coalesce(v_owner.is_member, false)
            or v_owner.subscription_plan in ('pro', 'trial', 'lifetime', 'starter', 'enterprise');
  select count(*) into v_used from public.employees where owner_id = new.owner_id;

  if not v_paid or v_used >= v_owner.slots then
    raise exception 'No free team slots. Buy more team cards to add another member.'
      using errcode = 'P0001';
  end if;

  new.is_premium := true;
  new.status := 'active';
  new.subscription_started_at := coalesce(v_owner.subscription_started_at, now());
  new.subscription_expires_at := v_owner.membership_expires_at;
  return new;
end;
$$;

drop trigger if exists employees_protect_billing on public.employees;
create trigger employees_protect_billing
  before insert or update on public.employees
  for each row execute function public.employees_protect_billing();

-- ---------------------------------------------------------------------
-- 3. Orders: created by the server after payment; customers may only
--    change design and shipping on their own order while under review.
-- ---------------------------------------------------------------------
drop policy if exists "Users can insert their own orders" on public.orders;

create or replace function public.orders_protect_fields()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  n jsonb;
  allowed text[] := array['design_url', 'design_mode', 'shipping_address', 'updated_at'];
  c text;
begin
  if not public.is_customer_request() then
    return new;
  end if;
  n := to_jsonb(old);
  foreach c in array allowed loop
    if to_jsonb(new) ? c then
      n := jsonb_set(n, array[c], to_jsonb(new) -> c);
    end if;
  end loop;
  return jsonb_populate_record(new, n);
end;
$$;

drop trigger if exists orders_protect_fields on public.orders;
create trigger orders_protect_fields
  before update on public.orders
  for each row execute function public.orders_protect_fields();

-- Each Razorpay payment can only ever be recorded once. (Skipped with a
-- notice if old data already has a duplicate; the code checks too.)
do $$
begin
  if exists (
    select 1 from public.orders where razorpay_payment_id is not null
    group by razorpay_payment_id having count(*) > 1
  ) then
    raise notice 'orders has duplicate razorpay_payment_id values; unique index not created';
  else
    create unique index if not exists orders_razorpay_payment_id_key
      on public.orders (razorpay_payment_id) where razorpay_payment_id is not null;
  end if;
end $$;

-- ---------------------------------------------------------------------
-- 4. Admin-only trial follow-up notes
-- ---------------------------------------------------------------------
create table if not exists public.profile_admin_notes (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  trial_follow_up_milestone integer not null default 0,
  trial_follow_up_status text not null default 'unattended'
    check (trial_follow_up_status in ('unattended', 'attended')),
  trial_follow_up_notes text not null default '',
  -- General company follow-up (admin console "Follow-up" on a company).
  follow_up_status text not null default 'unattended'
    check (follow_up_status in ('unattended', 'attended')),
  follow_up_notes text not null default '',
  updated_at timestamptz not null default now()
);
alter table public.profile_admin_notes
  add column if not exists follow_up_status text not null default 'unattended',
  add column if not exists follow_up_notes text not null default '';
alter table public.profile_admin_notes enable row level security;

drop policy if exists "Staff can read admin notes" on public.profile_admin_notes;
create policy "Staff can read admin notes" on public.profile_admin_notes
  for select to authenticated using (public.is_staff());

drop policy if exists "Admins manage admin notes" on public.profile_admin_notes;
create policy "Admins manage admin notes" on public.profile_admin_notes
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Copy what's there today, then clear it from the public profile row.
insert into public.profile_admin_notes
  (profile_id, trial_follow_up_milestone, trial_follow_up_status, trial_follow_up_notes)
select id,
       coalesce(trial_follow_up_milestone, 0),
       coalesce(trial_follow_up_status, 'unattended'),
       coalesce(trial_follow_up_notes, '')
from public.profiles
where coalesce(trial_follow_up_milestone, 0) <> 0
   or coalesce(trial_follow_up_status, 'unattended') <> 'unattended'
   or coalesce(trial_follow_up_notes, '') <> ''
on conflict (profile_id) do update
  set trial_follow_up_milestone = excluded.trial_follow_up_milestone,
      trial_follow_up_status = excluded.trial_follow_up_status,
      trial_follow_up_notes = excluded.trial_follow_up_notes,
      updated_at = now();

update public.profiles
   set trial_follow_up_notes = '',
       trial_follow_up_milestone = 0,
       trial_follow_up_status = 'unattended'
 where coalesce(trial_follow_up_notes, '') <> ''
    or coalesce(trial_follow_up_milestone, 0) <> 0
    or coalesce(trial_follow_up_status, 'unattended') <> 'unattended';
