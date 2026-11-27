-- Multi-Tier Partner Coupons (₹200, ₹300, ₹500 off)
-- Allows each Partner / Campaign Manager to hold up to one coupon per discount tier.

-- 1. Ensure existing rows match the new invariant before changing constraints
UPDATE public.campaign_coupons
SET reward_amount = GREATEST(0, 1000 - COALESCE(discount_amount, 500))
WHERE discount_amount IN (200, 300, 500);

-- 2. Replace single-coupon uniqueness and 500-only check constraints
ALTER TABLE public.campaign_coupons
  DROP CONSTRAINT IF EXISTS unique_campaign_manager_coupon,
  DROP CONSTRAINT IF EXISTS coupon_code_ends_with_500;

ALTER TABLE public.campaign_coupons
  DROP CONSTRAINT IF EXISTS unique_campaign_manager_tier_coupon,
  DROP CONSTRAINT IF EXISTS coupon_discount_tier_check,
  DROP CONSTRAINT IF EXISTS coupon_code_tier_match_check;

ALTER TABLE public.campaign_coupons
  ADD CONSTRAINT unique_campaign_manager_tier_coupon UNIQUE (campaign_manager_id, discount_amount),
  ADD CONSTRAINT coupon_discount_tier_check CHECK (discount_amount IN (200, 300, 500)),
  ADD CONSTRAINT coupon_code_tier_match_check CHECK (
    (discount_amount = 200 AND code LIKE '%200' AND reward_amount = 800) OR
    (discount_amount = 300 AND code LIKE '%300' AND reward_amount = 700) OR
    (discount_amount = 500 AND code LIKE '%500' AND reward_amount = 500)
  );
