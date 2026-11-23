-- =====================================================================
-- MIGRATION: Campaign Manager Role, Referral System, Coupon Codes & Withdrawals
-- Date: 2026-11-17
-- =====================================================================

-- 1. Extend profiles table for Campaign Manager & Referrals
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_campaign_manager BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS referred_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS referred_by_code TEXT;

-- Update role check constraint on profiles to include campaign_manager
DO $$
BEGIN
  ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
  ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check 
    CHECK (role IN ('user', 'admin', 'designer', 'campaign_manager'));
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_profiles_is_campaign_manager ON public.profiles(is_campaign_manager);
CREATE INDEX IF NOT EXISTS idx_profiles_referred_by ON public.profiles(referred_by);

-- 2. Campaign Coupons Table (One code per campaign manager ending in 500)
CREATE TABLE IF NOT EXISTS public.campaign_coupons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_manager_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  code TEXT NOT NULL UNIQUE,
  discount_amount NUMERIC DEFAULT 500 NOT NULL,
  reward_amount NUMERIC DEFAULT 500 NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  CONSTRAINT unique_campaign_manager_coupon UNIQUE (campaign_manager_id),
  CONSTRAINT coupon_code_ends_with_500 CHECK (code LIKE '%500')
);

CREATE INDEX IF NOT EXISTS idx_campaign_coupons_code ON public.campaign_coupons(code);
CREATE INDEX IF NOT EXISTS idx_campaign_coupons_manager ON public.campaign_coupons(campaign_manager_id);

-- 3. Referrals Tracking Table
CREATE TABLE IF NOT EXISTS public.referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_manager_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  referred_user_id UUID NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
  coupon_code TEXT,
  source TEXT DEFAULT 'link' CHECK (source IN ('link', 'coupon', 'card')),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'converted', 'claimed', 'expired')),
  amount_pending NUMERIC DEFAULT 500 NOT NULL,
  amount_converted NUMERIC DEFAULT 0 NOT NULL,
  amount_transferred NUMERIC DEFAULT 0 NOT NULL,
  converted_at TIMESTAMPTZ,
  renewal_count INTEGER DEFAULT 0 NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_referrals_manager ON public.referrals(campaign_manager_id);
CREATE INDEX IF NOT EXISTS idx_referrals_user ON public.referrals(referred_user_id);
CREATE INDEX IF NOT EXISTS idx_referrals_status ON public.referrals(status);

-- 4. Campaign Withdrawals Table
CREATE TABLE IF NOT EXISTS public.campaign_withdrawals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_manager_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  amount NUMERIC NOT NULL CHECK (amount > 0),
  payout_method TEXT NOT NULL CHECK (payout_method IN ('bank_transfer', 'upi')),
  account_details JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'transferred', 'rejected')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  transferred_at TIMESTAMPTZ,
  transferred_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_campaign_withdrawals_manager ON public.campaign_withdrawals(campaign_manager_id);
CREATE INDEX IF NOT EXISTS idx_campaign_withdrawals_status ON public.campaign_withdrawals(status);

-- 5. Helper Functions
CREATE OR REPLACE FUNCTION public.is_campaign_manager()
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND (is_campaign_manager = true OR role = 'campaign_manager')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Enable RLS
ALTER TABLE public.campaign_coupons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaign_withdrawals ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Coupons: Anyone authenticated can look up/validate; manager can upsert their own; admin full access
DROP POLICY IF EXISTS "Public can check coupons" ON public.campaign_coupons;
CREATE POLICY "Public can check coupons" ON public.campaign_coupons FOR SELECT USING (true);

DROP POLICY IF EXISTS "Managers can manage their coupon" ON public.campaign_coupons;
CREATE POLICY "Managers can manage their coupon" ON public.campaign_coupons
  FOR ALL TO authenticated
  USING (campaign_manager_id = auth.uid() OR public.is_admin())
  WITH CHECK (campaign_manager_id = auth.uid() OR public.is_admin());

-- Referrals: Manager can read their own; admin full access
DROP POLICY IF EXISTS "Managers can read own referrals" ON public.referrals;
CREATE POLICY "Managers can read own referrals" ON public.referrals
  FOR SELECT TO authenticated
  USING (campaign_manager_id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS "Admin and service manage referrals" ON public.referrals;
CREATE POLICY "Admin and service manage referrals" ON public.referrals
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Withdrawals: Manager can view & insert own; admin can view & update
DROP POLICY IF EXISTS "Managers can view own withdrawals" ON public.campaign_withdrawals;
CREATE POLICY "Managers can view own withdrawals" ON public.campaign_withdrawals
  FOR SELECT TO authenticated
  USING (campaign_manager_id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS "Managers can request withdrawal" ON public.campaign_withdrawals;
CREATE POLICY "Managers can request withdrawal" ON public.campaign_withdrawals
  FOR INSERT TO authenticated
  WITH CHECK (campaign_manager_id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS "Admin manage withdrawals" ON public.campaign_withdrawals;
CREATE POLICY "Admin manage withdrawals" ON public.campaign_withdrawals
  FOR UPDATE TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());
