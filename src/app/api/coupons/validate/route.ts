import { NextResponse } from "next/server";
import { createAdminClient } from "@/supabase/admin";
import {
  getCouponRewardAmount,
  parseDiscountFromCouponCode,
} from "@/lib/coupons/tiers";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const rawCode = (body.code || "").trim().toUpperCase();

    if (!rawCode) {
      return NextResponse.json({ error: "Coupon code is required" }, { status: 400 });
    }

    const tierFromCode = parseDiscountFromCouponCode(rawCode);
    if (!tierFromCode) {
      return NextResponse.json({ error: "Invalid referral coupon code" }, { status: 400 });
    }

    const supabase = createAdminClient();

    // Look up coupon
    const { data: coupon, error } = await supabase
      .from("campaign_coupons")
      .select("id, code, discount_amount, reward_amount, campaign_manager_id")
      .eq("code", rawCode)
      .maybeSingle();

    if (error || !coupon) {
      return NextResponse.json(
        { error: "Coupon code not found or invalid" },
        { status: 404 }
      );
    }

    // Verify partner profile
    const { data: manager } = await supabase
      .from("profiles")
      .select("id, business_name, owner_name, is_partner, is_campaign_manager, role")
      .eq("id", coupon.campaign_manager_id)
      .maybeSingle();

    if (!manager) {
      return NextResponse.json(
        { error: "Coupon owner account not found" },
        { status: 404 }
      );
    }

    const discountAmount = Number(coupon.discount_amount) || tierFromCode;
    const rewardAmount =
      Number(coupon.reward_amount) || getCouponRewardAmount(discountAmount);

    return NextResponse.json({
      valid: true,
      code: coupon.code,
      discountAmount,
      rewardAmount,
      campaignManagerId: coupon.campaign_manager_id,
      managerName: manager.business_name || manager.owner_name || "Partner",
    });
  } catch (err: any) {
    console.error("[Coupon Validate API] Exception:", err);
    return NextResponse.json(
      { error: err.message || "Failed to validate coupon code" },
      { status: 500 }
    );
  }
}
