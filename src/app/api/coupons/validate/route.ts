import { NextResponse } from "next/server";
import { createAdminClient } from "@/supabase/admin";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const rawCode = (body.code || "").trim().toUpperCase();

    if (!rawCode) {
      return NextResponse.json({ error: "Coupon code is required" }, { status: 400 });
    }

    if (!rawCode.endsWith("500")) {
      return NextResponse.json({ error: "Invalid referral coupon code" }, { status: 400 });
    }

    const supabase = createAdminClient();

    // Look up coupon
    const { data: coupon, error } = await supabase
      .from("campaign_coupons")
      .select("id, code, discount_amount, campaign_manager_id")
      .eq("code", rawCode)
      .maybeSingle();

    if (error || !coupon) {
      return NextResponse.json(
        { error: "Coupon code not found or invalid" },
        { status: 404 }
      );
    }

    // Verify manager profile
    const { data: manager } = await supabase
      .from("profiles")
      .select("id, business_name, owner_name, is_campaign_manager")
      .eq("id", coupon.campaign_manager_id)
      .maybeSingle();

    if (!manager) {
      return NextResponse.json(
        { error: "Coupon owner account not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      valid: true,
      code: coupon.code,
      discountAmount: Number(coupon.discount_amount) || 500,
      campaignManagerId: coupon.campaign_manager_id,
      managerName: manager.business_name || manager.owner_name || "Campaign Manager",
    });
  } catch (err: any) {
    console.error("[Coupon Validate API] Exception:", err);
    return NextResponse.json(
      { error: err.message || "Failed to validate coupon code" },
      { status: 500 }
    );
  }
}
