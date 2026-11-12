-- =====================================================================
--  Namma Info: Branches
--  Run in the Supabase SQL Editor before deploying the matching code.
--  Safe to run more than once.
--
--  A business with offices in several cities keeps ONE profile and adds
--  branches. A branch stores only what is different: its own photos,
--  contact details, address / directions, Google review link and,
--  optionally, its own services and products. Everything left empty
--  (NULL) is taken from the main profile when the page is shown, so an
--  edit to the main profile shows on every branch straight away.
--
--    nammainfo.in/abc                  main profile
--    nammainfo.in/abc/mangaluru        branch
--    nammainfo.in/abc/mangaluru/sujay  team member of that branch
--    nammainfo.in/abc/sujay            still works: redirects to the above
--
--  Branch links and team-member links share one namespace per business
--  (both sit at nammainfo.in/abc/<x>), so the database refuses a branch
--  link that a team member already uses and the other way round.
--
--  1. branches table, row-level security, guard trigger
--  2. employees.branch_id  (+ one link per business for team members)
--  3. contacts.branch_id   (filled in automatically)
--  4. submit_branch_contact(): visitor details from a branch page
-- =====================================================================

-- 1. Branches ---------------------------------------------------------
create table if not exists public.branches (
  id              uuid primary key default gen_random_uuid(),
  owner_id        uuid not null references public.profiles(id) on delete cascade,
  slug            text not null,
  name            text not null,
  -- Overrides. NULL = use the main profile's value.
  contact_person  text,
  contact_title   text,
  phone           text,
  whatsapp        text,
  email           text,
  address         text,
  city            text,
  pincode         text,
  maps_url        text,
  google_place_id text,
  cover_url       text,
  logo_url        text,
  services        jsonb,   -- NULL = same as main profile
  products        jsonb,   -- NULL = same as main profile
  is_active       boolean not null default true,
  sort_order      integer not null default 0,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint branches_owner_slug_key unique (owner_id, slug),
  constraint branches_slug_format check (
    slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) between 2 and 40),
  constraint branches_name_length check (char_length(btrim(name)) between 1 and 80),
  constraint branches_services_shape check (
    services is null or (jsonb_typeof(services) = 'array'
      and jsonb_array_length(services) <= 100 and pg_column_size(services) <= 65536)),
  constraint branches_products_shape check (
    products is null or (jsonb_typeof(products) = 'array'
      and jsonb_array_length(products) <= 100 and pg_column_size(products) <= 65536))
);

create index if not exists idx_branches_owner on public.branches (owner_id, sort_order, created_at);

alter table public.branches enable row level security;

drop policy if exists "Anyone reads active branches" on public.branches;
create policy "Anyone reads active branches" on public.branches
  for select using (is_active or owner_id = auth.uid() or public.is_staff());

drop policy if exists "Owners add branches" on public.branches;
create policy "Owners add branches" on public.branches
  for insert with check (owner_id = auth.uid());

drop policy if exists "Owners edit branches" on public.branches;
create policy "Owners edit branches" on public.branches
  for update using (owner_id = auth.uid()) with check (owner_id = auth.uid());

drop policy if exists "Owners delete branches" on public.branches;
create policy "Owners delete branches" on public.branches
  for delete using (owner_id = auth.uid());

drop policy if exists "Admins manage branches" on public.branches;
create policy "Admins manage branches" on public.branches
  for all using (public.is_admin()) with check (public.is_admin());

-- Guard: tidy values, paid plans only, a sensible cap, and no clash with
-- a team member's link.
-- (Not SECURITY DEFINER: is_customer_request() must see the caller.)
create or replace function public.branches_guard()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_owner record;
  v_count integer;
begin
  new.slug := lower(btrim(new.slug));
  new.name := btrim(new.name);
  new.updated_at := now();

  if tg_op = 'UPDATE' then
    new.owner_id := old.owner_id;     -- a branch never moves to another business
    new.created_at := old.created_at;
  end if;

  if public.is_customer_request() and tg_op = 'INSERT' then
    -- Same rule as src/lib/membership.ts (isPaid).
    select subscription_plan, is_member, membership_expires_at into v_owner
      from public.profiles where id = new.owner_id;
    if not (coalesce(v_owner.is_member, false)
            or v_owner.membership_expires_at is not null
            or lower(coalesce(v_owner.subscription_plan, 'free')) in ('pro', 'trial', 'lifetime', 'starter', 'enterprise')) then
      raise exception 'Branches are part of the paid plan. Upgrade to add a branch.'
        using errcode = 'P0001';
    end if;
    select count(*) into v_count from public.branches where owner_id = new.owner_id;
    if v_count >= 50 then
      raise exception 'You can add up to 50 branches.' using errcode = 'P0001';
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

-- 2. Team members belong to a branch (optional) ------------------------
alter table public.employees
  add column if not exists branch_id uuid references public.branches(id) on delete set null;
create index if not exists idx_employees_branch on public.employees (branch_id);

create or replace function public.employees_branch_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.branch_id is not null
     and (tg_op = 'INSERT' or new.branch_id is distinct from old.branch_id)
     and not exists (select 1 from public.branches
                     where id = new.branch_id and owner_id = new.owner_id) then
    raise exception 'That branch belongs to another business.' using errcode = 'P0001';
  end if;

  if (tg_op = 'INSERT' or new.slug is distinct from old.slug)
     and exists (select 1 from public.branches
                 where owner_id = new.owner_id and slug = lower(new.slug)) then
    raise exception 'That link is already used by a branch. Pick another link for this member.'
      using errcode = 'P0001';
  end if;
  return new;
end;
$$;

drop trigger if exists employees_branch_guard on public.employees;
create trigger employees_branch_guard
  before insert or update on public.employees
  for each row execute function public.employees_branch_guard();

-- One link per team member within a business (the app now picks a free
-- one, e.g. "sujay-2"). Skipped with a notice if old data has duplicates.
do $$
begin
  if exists (select 1 from public.employees group by owner_id, slug having count(*) > 1) then
    raise notice 'employees: duplicate links exist for some businesses; unique index skipped. Rename them, then re-run this file.';
  else
    execute 'create unique index if not exists employees_owner_slug_key on public.employees (owner_id, slug)';
  end if;
end;
$$;

-- 3. Contacts remember which branch they came from ---------------------
alter table public.contacts
  add column if not exists branch_id uuid references public.branches(id) on delete set null;
create index if not exists idx_contacts_branch on public.contacts (owner_id, branch_id);

create or replace function public.contacts_set_branch()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_setting text;
begin
  if new.branch_id is null and new.employee_id is not null then
    select branch_id into new.branch_id from public.employees where id = new.employee_id;
  end if;
  if new.branch_id is null then
    v_setting := nullif(current_setting('nammainfo.branch_id', true), '');
    if v_setting is not null then
      select id into new.branch_id from public.branches
        where id = v_setting::uuid and owner_id = new.owner_id;
    end if;
  end if;
  -- Never keep a branch of another business.
  if new.branch_id is not null
     and not exists (select 1 from public.branches where id = new.branch_id and owner_id = new.owner_id) then
    new.branch_id := null;
  end if;
  return new;
end;
$$;

drop trigger if exists contacts_set_branch on public.contacts;
create trigger contacts_set_branch
  before insert on public.contacts
  for each row execute function public.contacts_set_branch();

-- 4. Visitor details from a branch page --------------------------------
--    Same as submit_contact(), plus the branch. The branch travels to the
--    contacts trigger in a transaction-local setting.
create or replace function public.submit_branch_contact(
  p_branch_id uuid,
  p_owner_id uuid,
  p_employee_id uuid,
  p_name text,
  p_phone text,
  p_email text,
  p_source text default 'card',
  p_card_front text default null,
  p_card_back text default null
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_branch_id is not null and exists (
    select 1 from public.branches
    where id = p_branch_id and owner_id = p_owner_id and is_active
  ) then
    perform set_config('nammainfo.branch_id', p_branch_id::text, true);
  end if;
  return public.submit_contact(p_owner_id, p_employee_id, p_name, p_phone, p_email,
                               p_source, p_card_front, p_card_back);
end;
$$;

grant execute on function public.submit_branch_contact(uuid, uuid, uuid, text, text, text, text, text, text)
  to anon, authenticated;

-- Make the new table visible to the API straight away.
notify pgrst, 'reload schema';
