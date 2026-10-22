-- Business type (required in the app: onboarding, About editor, and a
-- one-time prompt for existing owners). Kept nullable in the database so
-- people who only signed up to save someone's card aren't blocked.
alter table public.profiles
  add column if not exists business_type text;

alter table public.profiles
  drop constraint if exists profiles_business_type_check;

alter table public.profiles
  add constraint profiles_business_type_check
  check (
    business_type is null
    or business_type in (
      'retailer',
      'wholesaler',
      'distributor',
      'manufacturer',
      'service_provider',
      'agency',
      'freelancer'
    )
  );
