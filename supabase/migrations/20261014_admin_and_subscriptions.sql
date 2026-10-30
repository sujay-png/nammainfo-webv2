-- Migration: Admin, Account Status & Subscription Quantities
-- Date: 2026-10-14
-- Description: Adds administrative flags, account suspension states, and ID count quotas

-- 1. Extend profiles for Admin, Cards, and Subscription tracking
ALTER TABLE public.profiles 
  ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'expired', 'pending')),
  ADD COLUMN IF NOT EXISTS subscription_plan TEXT DEFAULT 'free',
  ADD COLUMN IF NOT EXISTS primary_card_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS purchased_id_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS subscription_started_at TIMESTAMPTZ DEFAULT now();

-- Create index for quick filtering in Admin Dashboard
CREATE INDEX IF NOT EXISTS idx_profiles_status ON public.profiles(status);
CREATE INDEX IF NOT EXISTS idx_profiles_subscription_plan ON public.profiles(subscription_plan);
CREATE INDEX IF NOT EXISTS idx_profiles_is_admin ON public.profiles(is_admin);

-- 2. Extend employees for Individual ID Subscription tracking
ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS is_premium BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS subscription_started_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS subscription_expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'unassigned'));

CREATE INDEX IF NOT EXISTS idx_employees_owner_premium ON public.employees(owner_id, is_premium);

-- 3. Security Definer helper to prevent RLS recursion
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND is_admin = true
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. RLS Policies for Platform Admins (enables admin updates across all companies, cards & employees)
DROP POLICY IF EXISTS "Admins can update any profile" ON public.profiles;
CREATE POLICY "Admins can update any profile"
  ON public.profiles FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admins can update any employee" ON public.employees;
CREATE POLICY "Admins can update any employee"
  ON public.employees FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admins can update any card" ON public.cards;
CREATE POLICY "Admins can update any card"
  ON public.cards FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- 4. Comment annotations for documentation
COMMENT ON COLUMN public.profiles.is_admin IS 'Flag indicating if the user has platform administrator privileges.';
COMMENT ON COLUMN public.profiles.status IS 'Account status: active, suspended, expired, or pending.';
COMMENT ON COLUMN public.profiles.purchased_id_count IS 'Total quota of physical/digital IDs purchased by this company.';
COMMENT ON COLUMN public.employees.is_premium IS 'Indicates if this employee is assigned a paid ID slot.';
COMMENT ON COLUMN public.employees.subscription_expires_at IS 'Validity period of this specific employee ID.';
