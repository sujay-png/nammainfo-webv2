import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  COUPON_DISCOUNT_TIERS,
  formatTierCouponCode,
  getCouponRewardAmount,
  isValidCouponTier,
  parseDiscountFromCouponCode,
} from "../../src/lib/coupons/tiers";

describe("Partner Multi-Tier Coupon Rules (200 / 300 / 500)", () => {
  it("supports all three discount tiers 200, 300, and 500", () => {
    assert.deepEqual([...COUPON_DISCOUNT_TIERS], [200, 300, 500]);
    assert.equal(isValidCouponTier(200), true);
    assert.equal(isValidCouponTier(300), true);
    assert.equal(isValidCouponTier(500), true);
    assert.equal(isValidCouponTier(400), false);
  });

  it("computes partner reward from the ₹1,000 total pool", () => {
    assert.equal(getCouponRewardAmount(200), 800);
    assert.equal(getCouponRewardAmount(300), 700);
    assert.equal(getCouponRewardAmount(500), 500);
    assert.equal(getCouponRewardAmount(0), 1000);
  });

  it("parses discount tier only for codes ending in 200, 300, or 500", () => {
    assert.equal(parseDiscountFromCouponCode("abc200"), 200);
    assert.equal(parseDiscountFromCouponCode("RAJ300"), 300);
    assert.equal(parseDiscountFromCouponCode("PRO500"), 500);
    assert.equal(parseDiscountFromCouponCode("PRO400"), null);
    assert.equal(parseDiscountFromCouponCode(""), null);
  });

  it("formats tier coupon codes cleanly without duplicating suffix", () => {
    assert.equal(formatTierCouponCode("raju", 200), "RAJU200");
    assert.equal(formatTierCouponCode("raju300", 300), "RAJU300");
    assert.equal(formatTierCouponCode("raju-star", 500), "RAJUSTAR500");
  });
});
