-- Migration: Free Trial (100 Days) & 20-Day Follow-Up Milestones
-- Date: 2026-10-29
-- Description: Adds columns to support the 100-day Free Trial program, ADI100 coupon application,
--              pending approval workflow, custom trial day extensions, and 20-day follow-up milestone tracking.

-- 1. Add Trial tracking columns to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS trial_status TEXT DEFAULT 'none' CHECK (trial_status IN ('none', 'pending_approval', 'approved', 'rejected')),
  ADD COLUMN IF NOT EXISTS trial_coupon_code TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS trial_requested_at TIMESTAMPTZ DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS trial_approved_at TIMESTAMPTZ DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS trial_extension_days INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS trial_follow_up_milestone INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS trial_follow_up_status TEXT DEFAULT 'unattended' CHECK (trial_follow_up_status IN ('unattended', 'attended')),
  ADD COLUMN IF NOT EXISTS trial_follow_up_notes TEXT DEFAULT '';

-- 2. Create indexes for quick admin filtering
CREATE INDEX IF NOT EXISTS idx_profiles_trial_status ON public.profiles(trial_status);
CREATE INDEX IF NOT EXISTS idx_profiles_trial_requested_at ON public.profiles(trial_requested_at);

-- 3. Comments for documentation
COMMENT ON COLUMN public.profiles.trial_status IS 'State of the 100-day Free Trial application: none, pending_approval, approved, or rejected.';
COMMENT ON COLUMN public.profiles.trial_coupon_code IS 'Coupon code used when requesting free trial (e.g. ADI100).';
COMMENT ON COLUMN public.profiles.trial_requested_at IS 'Timestamp when free trial was requested by user.';
COMMENT ON COLUMN public.profiles.trial_approved_at IS 'Timestamp when free trial was approved by admin, marking start of 100-day validity.';
COMMENT ON COLUMN public.profiles.trial_extension_days IS 'Total extra days granted by admin beyond initial 100 days.';
COMMENT ON COLUMN public.profiles.trial_follow_up_milestone IS 'Highest 20-day milestone (1 to 5) attended by admin for this trial.';
COMMENT ON COLUMN public.profiles.trial_follow_up_status IS 'Follow-up status for current milestone: unattended or attended.';
COMMENT ON COLUMN public.profiles.trial_follow_up_notes IS 'Notes recorded by admin during 20-day follow-up touchpoints.';

