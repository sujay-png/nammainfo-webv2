-- =====================================================================
-- Migration: Staff and Designer Isolation
-- Date: 2026-11-03
-- Purpose:
-- 1. Ensure staff accounts (Admins & Designers) NEVER get customer digital cards.
-- 2. Ensure new sign-ups / staff creations never fail with null slug constraint.
-- 3. Isolate staff accounts from customer billing / subscriptions (subscription_plan = 'none').
-- 4. Clean up any existing customer cards accidentally created for staff (e.g. Abhishek).
-- =====================================================================

-- 1. Auto-create Profile and Card on new auth.user registration
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_base text;
  v_slug text;
  v_try  int := 0;
  v_role text;
  v_is_admin boolean;
BEGIN
  -- Determine role and admin status from app_metadata or user_metadata
  v_role := coalesce(new.raw_app_meta_data->>'role', new.raw_user_meta_data->>'role', 'user');
  v_is_admin := coalesce(
    (new.raw_app_meta_data->>'is_admin')::boolean,
    (new.raw_user_meta_data->>'is_admin')::boolean,
    false
  );
  IF v_role = 'admin' THEN
    v_is_admin := true;
  END IF;

  -- Name part: letters and numbers only, max 20 characters
  v_base := left(lower(regexp_replace(
              coalesce(
                nullif(new.raw_user_meta_data->>'slug', ''),
                nullif(new.raw_user_meta_data->>'owner_name', ''),
                nullif(new.raw_user_meta_data->>'full_name', ''),
                split_part(new.email, '@', 1),
                'user'
              ),
              '[^a-zA-Z0-9]', '', 'g')), 20);
  IF v_base = '' THEN v_base := 'user'; END IF;

  -- Add 8 characters from account id; retry if collision
  LOOP
    v_slug := v_base || substr(replace(new.id::text, '-', ''), 1 + v_try * 8, 8);
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.profiles WHERE slug = v_slug)
          AND NOT EXISTS (SELECT 1 FROM public.cards WHERE public_slug = v_slug);
    v_try := v_try + 1;
    IF v_try >= 4 THEN
      v_slug := v_base || substr(md5(random()::text || clock_timestamp()::text), 1, 10);
      EXIT;
    END IF;
  END LOOP;

  -- Insert profile
  INSERT INTO public.profiles (
    id,
    email,
    owner_name,
    business_name,
    slug,
    role,
    is_admin,
    subscription_plan,
    primary_card_count,
    is_member,
    status,
    created_at,
    updated_at
  )
  VALUES (
    new.id,
    new.email,
    coalesce(nullif(new.raw_user_meta_data->>'owner_name', ''), nullif(new.raw_user_meta_data->>'full_name', ''), split_part(new.email, '@', 1)),
    coalesce(nullif(new.raw_user_meta_data->>'business_name', ''), nullif(new.raw_user_meta_data->>'full_name', ''), split_part(new.email, '@', 1)),
    v_slug,
    v_role,
    v_is_admin,
    CASE WHEN v_role IN ('admin', 'designer') OR v_is_admin THEN 'none' ELSE 'free' END,
    0,
    false,
    'active',
    now(),
    now()
  )
  ON CONFLICT (id) DO UPDATE SET
    role = v_role,
    is_admin = v_is_admin,
    subscription_plan = CASE WHEN v_role IN ('admin', 'designer') OR v_is_admin THEN 'none' ELSE public.profiles.subscription_plan END,
    updated_at = now();

  -- ONLY issue default digital cards to customer accounts, NEVER to staff (admin or designer)
  IF NOT v_is_admin AND v_role NOT IN ('admin', 'designer') THEN
    INSERT INTO public.cards (profile_id, public_slug, is_active, created_at)
    VALUES (new.id, v_slug, true, now())
    ON CONFLICT DO NOTHING;
  ELSE
    -- Delete any customer cards if staff
    DELETE FROM public.cards WHERE profile_id = new.id;
  END IF;

  RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 2. Staff change trigger: ensure promoting any account strips customer cards and plan
CREATE OR REPLACE FUNCTION public.handle_profile_staff_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF (new.is_admin = true OR new.role IN ('admin', 'designer')) THEN
    -- Remove customer digital cards so staff is strictly staff, not a customer card
    DELETE FROM public.cards WHERE profile_id = new.id;

    -- Staff accounts have no subscription
    new.subscription_plan := 'none';
    new.primary_card_count := 0;
    new.is_member := false;
    new.trial_status := 'none';
    new.membership_expires_at := null;
  END IF;

  RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS on_profile_staff_change ON public.profiles;
CREATE TRIGGER on_profile_staff_change
  BEFORE UPDATE OF is_admin, role ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_profile_staff_change();

-- 3. Data cleanup: Fix any existing staff accounts that accidentally have customer cards or subscriptions
UPDATE public.profiles
SET
  role = 'designer',
  is_admin = false,
  subscription_plan = 'none',
  primary_card_count = 0,
  is_member = false,
  membership_expires_at = null,
  trial_status = 'none'
WHERE email = 'abhishek.aksharadigitalindia@gmail.com'
   OR email ILIKE '%aksharadigitalindia%';

DELETE FROM public.cards
WHERE profile_id IN (
  SELECT id FROM public.profiles
  WHERE is_admin = true
     OR role IN ('admin', 'designer')
     OR email = 'abhishek.aksharadigitalindia@gmail.com'
     OR email ILIKE '%aksharadigitalindia%'
);
