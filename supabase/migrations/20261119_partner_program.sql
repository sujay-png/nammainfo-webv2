-- =====================================================================
-- MIGRATION: Partner Program Role and Sync
-- Date: 2026-11-19
-- =====================================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_partner BOOLEAN DEFAULT false;

-- Sync existing campaign managers to partner
UPDATE public.profiles
SET is_partner = true
WHERE is_campaign_manager = true;

DO $$
BEGIN
  ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
  ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check 
    CHECK (role IN ('user', 'admin', 'designer', 'campaign_manager', 'partner'));
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;
