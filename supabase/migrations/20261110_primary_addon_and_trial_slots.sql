-- Migration: Primary Card Addon & Unlimited Free Trial Team Members
-- Date: 2026-11-10
-- Description:
--   1. Expands orders.order_type check constraint to permit 'primary_card_addon'.
--   2. Updates employees_protect_billing() so Free Trial accounts can add unlimited team members
--      during their trial without slot restrictions.
--   3. When trial ends or when upgrading, the account upgrades to Pro with annual renewal
--      covering the primary card and all team members.

-- 1. Orders table check constraint update
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_order_type_check;
ALTER TABLE public.orders ADD CONSTRAINT orders_order_type_check 
  CHECK (order_type IN ('pro_initial', 'team_addon', 'renewal', 'primary_card_addon'));

-- 2. Update employee billing trigger for trial parity
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

  -- INSERT by the owner
  SELECT subscription_plan, is_member, membership_expires_at,
         subscription_started_at, coalesce(purchased_id_count, 0) AS slots
    INTO v_owner
  FROM public.profiles WHERE id = new.owner_id;

  v_paid := coalesce(v_owner.is_member, false)
            OR v_owner.subscription_plan IN ('pro', 'trial', 'lifetime', 'starter', 'enterprise');

  SELECT count(*) INTO v_used FROM public.employees WHERE owner_id = new.owner_id;

  -- Free trial accounts have unlimited team member additions during trial
  IF v_owner.subscription_plan = 'trial' THEN
    -- Allowed! Trial accounts can add all their team members freely.
    -- On trial completion, they upgrade to Pro with renewal covering all cards.
    NULL;
  ELSIF NOT v_paid OR v_used >= v_owner.slots THEN
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
