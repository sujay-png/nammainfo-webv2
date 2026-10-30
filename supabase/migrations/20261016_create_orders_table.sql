-- Migration: Create orders table and fulfillment tracking
-- Date: 2026-10-16
-- Description: Orders table for NFC card purchases, design upload, shipping, and Razorpay transactions

-- 1. Helper function for Admin privileges check
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND is_admin = true
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Create orders table
CREATE TABLE IF NOT EXISTS public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  order_type TEXT NOT NULL CHECK (order_type IN ('pro_initial', 'team_addon', 'renewal')),
  card_quantity INTEGER NOT NULL DEFAULT 1,
  unit_price NUMERIC NOT NULL,
  total_amount NUMERIC NOT NULL,
  status TEXT NOT NULL DEFAULT 'under_review' CHECK (status IN ('under_review', 'on_work', 'delivered', 'cancelled')),
  design_url TEXT,
  design_mode TEXT NOT NULL DEFAULT 'team_assist' CHECK (design_mode IN ('uploaded', 'team_assist')),
  shipping_address JSONB NOT NULL DEFAULT '{}'::jsonb,
  razorpay_order_id TEXT,
  razorpay_payment_id TEXT,
  idempotency_key TEXT UNIQUE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_orders_profile_id ON public.orders(profile_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON public.orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON public.orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_idempotency_key ON public.orders(idempotency_key);

-- 4. Enable Row Level Security (RLS)
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

-- 5. RLS Policies
DROP POLICY IF EXISTS "Users can view their own orders" ON public.orders;
CREATE POLICY "Users can view their own orders"
  ON public.orders FOR SELECT
  TO authenticated
  USING (profile_id = auth.uid());

DROP POLICY IF EXISTS "Users can insert their own orders" ON public.orders;
CREATE POLICY "Users can insert their own orders"
  ON public.orders FOR INSERT
  TO authenticated
  WITH CHECK (profile_id = auth.uid());

DROP POLICY IF EXISTS "Users can update design while under_review" ON public.orders;
CREATE POLICY "Users can update design while under_review"
  ON public.orders FOR UPDATE
  TO authenticated
  USING (profile_id = auth.uid() AND status = 'under_review')
  WITH CHECK (profile_id = auth.uid() AND status = 'under_review');

DROP POLICY IF EXISTS "Admins have full access to orders" ON public.orders;
CREATE POLICY "Admins have full access to orders"
  ON public.orders FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());
