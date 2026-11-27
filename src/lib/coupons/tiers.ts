export const COUPON_DISCOUNT_TIERS = [200, 300, 500] as const;
export type CouponDiscountTier = (typeof COUPON_DISCOUNT_TIERS)[number];

export const TOTAL_REFERRAL_POOL = 1000;

export function isValidCouponTier(value: unknown): value is CouponDiscountTier {
  return value === 200 || value === 300 || value === 500;
}

export function getCouponRewardAmount(discountAmount: number): number {
  const safeDiscount = Number(discountAmount) || 0;
  return Math.max(0, TOTAL_REFERRAL_POOL - safeDiscount);
}

/**
 * Parse discount tier from a partner coupon code ending in 200, 300, or 500.
 */
export function parseDiscountFromCouponCode(code: string | null | undefined): CouponDiscountTier | null {
  const normalized = (code || "").trim().toUpperCase();
  if (!normalized) return null;
  if (normalized.endsWith("200")) return 200;
  if (normalized.endsWith("300")) return 300;
  if (normalized.endsWith("500")) return 500;
  return null;
}

/**
 * Normalize an alphanumeric prefix and append the selected tier suffix (200 | 300 | 500).
 */
export function formatTierCouponCode(prefix: string, tier: CouponDiscountTier): string {
  const cleaned = (prefix || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 12);
  const suffix = String(tier);
  if (!cleaned) return "";
  return cleaned.endsWith(suffix) ? cleaned : `${cleaned}${suffix}`;
}
