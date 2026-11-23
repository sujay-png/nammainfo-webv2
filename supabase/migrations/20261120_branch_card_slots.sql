-- =====================================================================
--  Namma Info: branches use card slots, like team members
--  Run in the Supabase SQL Editor AFTER 20261112_branches.sql.
--  Safe to run more than once.
--
--  A business pays for every card it has:
--
--    primary card     nammainfo.in/abc                 (the company)
--    secondary cards  nammainfo.in/abc/<x>             (branches AND team members)
--    tertiary cards   nammainfo.in/abc/<branch>/<x>    (team members of a branch)
--
--  Branches and all team members (main office or branch) share the slots
--  the owner bought (profiles.purchased_id_count). Price per card per year
--  follows the total: 1-4 cards ₹1,999, 5-24 ₹1,499, 25+ ₹999
--  (src/lib/pricing.ts). Free-trial accounts can add freely during the
--  trial, the same rule as team members (20261110).
--
--  Only branches can have their own team members. A team member can't
--  have members under them: there is no fourth URL level.
-- =====================================================================

-- Cards in use (branches + team members) for one business.
create or replace function public.secondary_cards_used(p_owner uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select (select count(*) from public.employees where owner_id = p_owner)::int
       + (select count(*) from public.branches  where owner_id = p_owner)::int;
$$;

-- 1. Team members: same as 20261110, but branches count against the slots too.
create or replace function public.employees_protect_billing()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller uuid := auth.uid();
  v_owner record;
  v_paid boolean;
  v_used integer;
  v_is_staff boolean;
begin
  select is_admin, role into v_owner from public.profiles where id = v_caller;
  v_is_staff := coalesce(v_owner.is_admin, false) or coalesce(v_owner.role, 'user') in ('admin', 'designer');

  if tg_op = 'UPDATE' then
    if v_is_staff then
      return new;
    end if;
    if new.owner_id <> old.owner_id
       or new.is_premium is distinct from old.is_premium
       or new.subscription_started_at is distinct from old.subscription_started_at
       or new.subscription_expires_at is distinct from old.subscription_expires_at
    then
      raise exception 'Customer cannot modify billing fields on an employee.' using errcode = '42501';
    end if;
    return new;
  end if;

  -- INSERT by the owner
  select subscription_plan, is_member, membership_expires_at,
         subscription_started_at, coalesce(purchased_id_count, 0) as slots
    into v_owner
  from public.profiles where id = new.owner_id;

  v_paid := coalesce(v_owner.is_member, false)
            or v_owner.subscription_plan in ('pro', 'trial', 'lifetime', 'starter', 'enterprise');

  v_used := public.secondary_cards_used(new.owner_id);

  if v_owner.subscription_plan = 'trial' then
    null; -- free trial: add freely; the upgrade covers every card
  elsif v_is_staff then
    null; -- admins / designers manage cards for customers
  elsif not v_paid or v_used >= v_owner.slots then
    raise exception 'No free card slots. Buy more cards to add another team member or branch.'
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

-- 2. Branches: a branch needs a free card slot (was: any paid plan, max 50).
--    (Not SECURITY DEFINER: is_customer_request() must see the caller.)
create or replace function public.branches_guard()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_owner record;
  v_paid boolean;
begin
  new.slug := lower(btrim(new.slug));
  new.name := btrim(new.name);
  new.updated_at := now();

  if tg_op = 'UPDATE' then
    new.owner_id := old.owner_id;     -- a branch never moves to another business
    new.created_at := old.created_at;
  end if;

  if public.is_customer_request() and tg_op = 'INSERT' then
    select subscription_plan, is_member, membership_expires_at,
           coalesce(purchased_id_count, 0) as slots
      into v_owner
      from public.profiles where id = new.owner_id;
    -- Same rule as src/lib/membership.ts (isPaid).
    v_paid := coalesce(v_owner.is_member, false)
              or v_owner.membership_expires_at is not null
              or lower(coalesce(v_owner.subscription_plan, 'free')) in ('pro', 'trial', 'lifetime', 'starter', 'enterprise');
    if not v_paid then
      raise exception 'Branches are part of the paid plan. Upgrade to add a branch.'
        using errcode = 'P0001';
    end if;
    if lower(coalesce(v_owner.subscription_plan, '')) <> 'trial'
       and public.secondary_cards_used(new.owner_id) >= v_owner.slots then
      raise exception 'No free card slots. Buy more cards to add another team member or branch.'
        using errcode = 'P0001';
    end if;
  end if;

  if (tg_op = 'INSERT' or new.slug is distinct from old.slug)
     and exists (select 1 from public.employees
                 where owner_id = new.owner_id and lower(slug) = new.slug) then
    raise exception 'That link is already used by a team member. Pick another branch link.'
      using errcode = 'P0001';
  end if;

  return new;
end;
$$;

drop trigger if exists branches_guard on public.branches;
create trigger branches_guard
  before insert or update on public.branches
  for each row execute function public.branches_guard();

notify pgrst, 'reload schema';
