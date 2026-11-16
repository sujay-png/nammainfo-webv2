-- Migration: Company Lifecycle Card Process, Employee Plan Inheritance & Order Status Check
-- Date: 2026-11-16
-- Description: Adds card_process jsonb column to profiles, plan column to employees, and expands orders status check.

-- 1. Add card_process JSONB to profiles to track the 9 lifecycle steps
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS card_process JSONB DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.profiles.card_process IS 'Stores the 9 lifecycle milestones with timestamps for NFC card production and follow-ups.';

-- 2. Add plan column to employees for individual tier assignment
ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS plan TEXT DEFAULT NULL;

COMMENT ON COLUMN public.employees.plan IS 'Optional override for employee plan (pro, trial, or free). If null, inherits company subscription plan.';

-- 3. Expand orders table status check constraint to support lifecycle milestones
ALTER TABLE public.orders
  DROP CONSTRAINT IF EXISTS orders_status_check;

ALTER TABLE public.orders
  ADD CONSTRAINT orders_status_check
  CHECK (status IN ('under_review', 'on_work', 'card_designed', 'ready_to_dispatch', 'out_for_delivery', 'delivered', 'cancelled'));

-- 4. Create index on profiles card_process for fast JSONB querying
CREATE INDEX IF NOT EXISTS idx_profiles_card_process ON public.profiles USING gin (card_process);

