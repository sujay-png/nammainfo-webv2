-- Affiliate Requests & Employee Partner Support Migration
-- 1. Track affiliate application state directly on profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS affiliate_status TEXT NOT NULL DEFAULT 'none'
    CHECK (affiliate_status IN ('none', 'pending', 'approved', 'rejected'));

UPDATE public.profiles
SET affiliate_status = 'approved'
WHERE (COALESCE(is_partner, false) = true OR COALESCE(is_campaign_manager, false) = true OR role IN ('partner', 'campaign_manager'))
  AND affiliate_status = 'none';

-- 2. Affiliate / Partner Join Requests table (for both Company Owners and Employees)
CREATE TABLE IF NOT EXISTS public.affiliate_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  applicant_type TEXT NOT NULL DEFAULT 'owner' CHECK (applicant_type IN ('owner', 'employee')),
  employee_id UUID REFERENCES public.employees(id) ON DELETE SET NULL,
  owner_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  full_name TEXT,
  business_name TEXT,
  email TEXT,
  phone TEXT,
  note TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  rejection_reason TEXT,
  reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_affiliate_requests_user_unique
  ON public.affiliate_requests (user_id);

CREATE INDEX IF NOT EXISTS idx_affiliate_requests_status_created
  ON public.affiliate_requests (status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_affiliate_requests_employee
  ON public.affiliate_requests (employee_id);

ALTER TABLE public.affiliate_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own affiliate request" ON public.affiliate_requests;
CREATE POLICY "Users can view own affiliate request"
  ON public.affiliate_requests
  FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins manage all affiliate requests" ON public.affiliate_requests;
CREATE POLICY "Admins manage all affiliate requests"
  ON public.affiliate_requests
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND (COALESCE(p.is_admin, false) = true OR p.role = 'admin')
    )
    OR auth.role() = 'service_role'
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND (COALESCE(p.is_admin, false) = true OR p.role = 'admin')
    )
    OR auth.role() = 'service_role'
  );
