-- =====================================================================
--  Fix: new sign-ups failed with "Database error saving new user".
--  1. Columns the sign-up step writes to were missing (updated_at, ...).
--  2. The starter profile link looked like "user-1a2b3c", but profile and
--     card links may only use a-z and 0-9 (4-32 characters, no hyphen).
--  Now the starter link is e.g. "user1a2b3c4d": letters/numbers only and
--  unique. People still pick their own link during onboarding.
--  Safe to run more than once.
-- =====================================================================

alter table public.profiles
  add column if not exists email       text,
  add column if not exists owner_name  text,
  add column if not exists is_admin    boolean     not null default false,
  add column if not exists created_at  timestamptz not null default now(),
  add column if not exists updated_at  timestamptz not null default now();

alter table public.cards
  add column if not exists is_active   boolean     not null default true,
  add column if not exists created_at  timestamptz not null default now();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_base text;
  v_slug text;
  v_try  int := 0;
begin
  -- Name part: letters and numbers only, max 20 characters.
  v_base := left(lower(regexp_replace(
              coalesce(nullif(new.raw_user_meta_data->>'full_name', ''), 'user'),
              '[^a-zA-Z0-9]', '', 'g')), 20);
  if v_base = '' then v_base := 'user'; end if;

  -- Add 8 characters from the account id; pick another bit if taken.
  loop
    v_slug := v_base || substr(replace(new.id::text, '-', ''), 1 + v_try * 8, 8);
    exit when not exists (select 1 from public.profiles where slug = v_slug)
          and not exists (select 1 from public.cards where public_slug = v_slug);
    v_try := v_try + 1;
    if v_try >= 4 then
      v_slug := v_base || substr(md5(random()::text || clock_timestamp()::text), 1, 10);
      exit;
    end if;
  end loop;

  insert into public.profiles (id, email, owner_name, slug, is_admin, created_at, updated_at)
  values (
    new.id,
    new.email,
    coalesce(nullif(new.raw_user_meta_data->>'full_name', ''), split_part(new.email, '@', 1)),
    v_slug,
    false,
    now(),
    now()
  )
  on conflict (id) do nothing;

  insert into public.cards (profile_id, public_slug, is_active, created_at)
  values (new.id, v_slug, true, now())
  on conflict do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
