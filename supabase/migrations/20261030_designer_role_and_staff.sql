-- =====================================================================
-- MIGRATION: Designer Role, Staff Accounts & Access Controls
-- Date: 2026-10-30
-- Target: Run in Supabase SQL Editor (both Test & Production)
-- =====================================================================

-- 1. Add role column to profiles table ('user', 'admin', 'designer')
ALTER TABLE public.profiles 
  ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'user' CHECK (role IN ('user', 'admin', 'designer'));

-- 2. Backfill existing admin accounts
UPDATE public.profiles 
SET role = 'admin' 
WHERE is_admin = true AND (role IS NULL OR role = 'user');

-- 3. Create index for fast role lookups
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);

-- 4. Helper function: is_staff() (Admins and Designers)
CREATE OR REPLACE FUNCTION public.is_staff()
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND (is_admin = true OR role IN ('admin', 'designer'))
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Update is_admin() to check both is_admin column and role = 'admin'
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND (is_admin = true OR role = 'admin')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Helper function: is_designer() (Designers only)
CREATE OR REPLACE FUNCTION public.is_designer()
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'designer'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. RLS Policies: Allow Staff (Admin & Designer) to read profiles, orders, employees, cards
-- A. Profiles (Read access for Staff)
DROP POLICY IF EXISTS "Staff can view all profiles" ON public.profiles;
CREATE POLICY "Staff can view all profiles"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (public.is_staff());

-- B. Orders (Read access for Staff)
DROP POLICY IF EXISTS "Staff can view all orders" ON public.orders;
CREATE POLICY "Staff can view all orders"
  ON public.orders FOR SELECT
  TO authenticated
  USING (public.is_staff());

-- C. Cards (Read access for Staff)
DROP POLICY IF EXISTS "Staff can view all cards" ON public.cards;
CREATE POLICY "Staff can view all cards"
  ON public.cards FOR SELECT
  TO authenticated
  USING (public.is_staff());

-- D. Employees (Read access for Staff)
DROP POLICY IF EXISTS "Staff can view all employees" ON public.employees;
CREATE POLICY "Staff can view all employees"
  ON public.employees FOR SELECT
  TO authenticated
  USING (public.is_staff());

