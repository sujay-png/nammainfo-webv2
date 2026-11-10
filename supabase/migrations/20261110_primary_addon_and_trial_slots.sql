-- Migration: Primary Card Addon & Free Trial Team Slots
-- Date: 2026-11-10
-- Description:
--   1. Expands orders.order_type check constraint to permit 'primary_card_addon'.
--   2. Updates employees_protect_billing() to allow Free Trial accounts up to 5 team member slots.
--   3. Sets default purchased_id_count to 5 for any existing trial profiles.

-- 1. Orders table check constraint update
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_order_type_check;
ALTER TABLE public.orders ADD CONSTRAINT orders_order_type_check 
  CHECK (order_type IN ('pro_initial', 'team_addon', 'renewal', 'primary_card_addon'));

-- 2. Update employee billing trigger for trial slot parity
CREATE OR REPLACE FUNCTION public.employees_protect_billing()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_owner record;
  v_paid boolean;
  v_used integer;
  v_is_staff boolean;
BEGIN
  SELECT is_admin, role INTO v_owner FROM public.profiles WHERE id = v_caller;
  v_is_staff := coalesce(v_owner.is_admin, false) OR coalesce(v_owner.role, 'user') IN ('admin', 'designer');

  IF TG_OP = 'UPDATE' THEN
    IF v_is_staff THEN
      RETURN new;
    END IF;
    IF new.owner_id <> old.owner_id
       OR new.is_premium IS DISTINCT FROM old.is_premium
       OR new.subscription_started_at IS DISTINCT FROM old.subscription_started_at
       OR new.subscription_expires_at IS DISTINCT FROM old.subscription_expires_at
    THEN
      RAISE EXCEPTION 'Customer cannot modify billing fields on an employee.' USING errcode = '42501';
    END IF;
    RETURN new;
  END IF;

  -- INSERT by the owner: needs a free paid slot; billing fields follow the owner's plan.
  SELECT subscription_plan, is_member, membership_expires_at,
         subscription_started_at, coalesce(purchased_id_count, 0) AS slots
    INTO v_owner
  FROM public.profiles WHERE id = new.owner_id;

  v_paid := coalesce(v_owner.is_member, false)
            OR v_owner.subscription_plan IN ('pro', 'trial', 'lifetime', 'starter', 'enterprise');

  SELECT count(*) INTO v_used FROM public.employees WHERE owner_id = new.owner_id;

  -- Free trial accounts are granted at least 5 team member slots to test team features
  IF v_owner.subscription_plan = 'trial' THEN
    v_owner.slots := greatest(v_owner.slots, 5);
  END IF;

  IF NOT v_paid OR v_used >= v_owner.slots THEN
    RAISE EXCEPTION 'No free team slots. Buy more team cards to add another member.'
      USING errcode = 'P0001';
  END IF;

  new.is_premium := true;
  new.status := 'active';
  new.subscription_started_at := coalesce(v_owner.subscription_started_at, now());
  new.subscription_expires_at := v_owner.membership_expires_at;
  RETURN new;
END;
$$;

-- 3. Ensure any existing trial profiles have at least 5 slots
UPDATE public.profiles
SET purchased_id_count = greatest(coalesce(purchased_id_count, 0), 5)
WHERE subscription_plan = 'trial';
