-- =====================================================================
--  Namma Info: testimonials, clients, and required phone numbers
--  Run in the Supabase SQL Editor before deploying the matching code.
--  Safe to run more than once.
--
--  1. profiles.testimonials  jsonb array of
--       { id, name, role?, quote, rating?, photo_url? }
--  2. profiles.clients       jsonb array of
--       { id, name, logo_url?, website? }
--     Photos and logos are resized in the browser and stored in the
--     public "profile-media" bucket under <profile id>/testimonials/ and
--     <profile id>/clients/.
--  3. Phone numbers: new sign-ups must give a mobile number. Sign-up puts
--     it in the account's metadata; the signup trigger now copies it to
--     profiles.phone so it is never lost, even in the save-card flow that
--     skips onboarding.
-- =====================================================================

-- 1 & 2. New columns -----------------------------------------------------
alter table public.profiles add column if not exists testimonials jsonb not null default '[]'::jsonb;
alter table public.profiles add column if not exists clients jsonb not null default '[]'::jsonb;

-- Keep them sane: arrays only, and a size cap (they are edited from the
-- browser). 20 testimonials of 500 characters fit comfortably.
alter table public.profiles drop constraint if exists profiles_testimonials_shape;
alter table public.profiles add constraint profiles_testimonials_shape
  check (jsonb_typeof(testimonials) = 'array'
         and jsonb_array_length(testimonials) <= 20
         and pg_column_size(testimonials) <= 32768);

alter table public.profiles drop constraint if exists profiles_clients_shape;
alter table public.profiles add constraint profiles_clients_shape
  check (jsonb_typeof(clients) = 'array'
         and jsonb_array_length(clients) <= 50
         and pg_column_size(clients) <= 32768);

-- 3. Copy the sign-up phone number into the profile ----------------------
--    Same function as 20261026_fix_signup_profiles_updated_at.sql, plus
--    the phone column.
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
  v_base := left(lower(regexp_replace(
              coalesce(nullif(new.raw_user_meta_data->>'full_name', ''), 'user'),
              '[^a-zA-Z0-9]', '', 'g')), 20);
  if v_base = '' then v_base := 'user'; end if;

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

  insert into public.profiles (id, email, owner_name, phone, slug, is_admin, created_at, updated_at)
  values (
    new.id,
    new.email,
    coalesce(nullif(new.raw_user_meta_data->>'full_name', ''), split_part(new.email, '@', 1)),
    nullif(left(new.raw_user_meta_data->>'phone', 20), ''),
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
