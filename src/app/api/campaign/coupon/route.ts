import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { createAdminClient } from "@/supabase/admin";
import {
  formatTierCouponCode,
  getCouponRewardAmount,
  isValidCouponTier,
  type CouponDiscountTier,
} from "@/lib/coupons/tiers";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const cookieStore = cookies();
    const supabaseUser = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value;
          },
        },
      }
    );

    const {
      data: { user },
    } = await supabaseUser.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const admin = createAdminClient();

    // Verify partner / campaign manager access
    const { data: profile } = await admin
      .from("profiles")
      .select("id, is_partner, is_campaign_manager, role, slug, username")
      .eq("id", user.id)
      .single();

    const isPartner = Boolean(
      (profile as any)?.is_partner ||
      profile?.is_campaign_manager ||
      profile?.role === "partner" ||
      profile?.role === "campaign_manager"
    );

    if (!profile || !isPartner) {
      return NextResponse.json({ error: "Forbidden: Not an authorized Partner" }, { status: 403 });
    }

    const { data: coupons, error } = await admin
      .from("campaign_coupons")
      .select("*")
      .eq("campaign_manager_id", user.id)
      .order("discount_amount", { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const list = coupons || [];
    const defaultCoupon = list.find((c: any) => Number(c.discount_amount) === 500) || list[0] || null;

    return NextResponse.json({
      coupons: list,
      coupon: defaultCoupon,
      managerSlug: profile.slug || profile.username || profile.id,
    });
  } catch (err: any) {
    console.error("[Campaign Coupon GET] Exception:", err);
    return NextResponse.json(
      { error: err.message || "Failed to fetch coupon" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const cookieStore = cookies();
    const supabaseUser = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value;
          },
        },
      }
    );

    const {
      data: { user },
    } = await supabaseUser.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const admin = createAdminClient();

    // Verify partner / campaign manager access
    const { data: profile } = await admin
      .from("profiles")
      .select("id, is_partner, is_campaign_manager, role")
      .eq("id", user.id)
      .single();

    const isPartner = Boolean(
      (profile as any)?.is_partner ||
      profile?.is_campaign_manager ||
      profile?.role === "partner" ||
      profile?.role === "campaign_manager"
    );

    if (!profile || !isPartner) {
      return NextResponse.json({ error: "Forbidden: Not an authorized Partner" }, { status: 403 });
    }

    const body = await req.json();
    const rawDiscount = Number(body.discountAmount ?? 500);
    if (!isValidCouponTier(rawDiscount)) {
      return NextResponse.json(
        { error: "Discount tier must be 200, 300, or 500" },
        { status: 400 }
      );
    }
    const tier: CouponDiscountTier = rawDiscount;
    const rawClean = (body.prefix || "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 12);
    const basePrefix = rawClean.endsWith(String(tier))
      ? rawClean.slice(0, -String(tier).length)
      : rawClean;

    if (!basePrefix || basePrefix.length < 2) {
      return NextResponse.json(
        { error: "Coupon prefix must contain at least 2 alphanumeric characters" },
        { status: 400 }
      );
    }

    const fullCode = formatTierCouponCode(basePrefix, tier);
    const rewardAmount = getCouponRewardAmount(tier);

    // Check if code is already taken by someone else
    const { data: existing } = await admin
      .from("campaign_coupons")
      .select("id, campaign_manager_id")
      .eq("code", fullCode)
      .maybeSingle();

    if (existing && existing.campaign_manager_id !== user.id) {
      return NextResponse.json(
        { error: `The code "${fullCode}" is already taken. Please choose another prefix.` },
        { status: 400 }
      );
    }

    // Upsert coupon for this manager & discount tier
    const { data: saved, error: saveErr } = await admin
      .from("campaign_coupons")
      .upsert(
        {
          campaign_manager_id: user.id,
          code: fullCode,
          discount_amount: tier,
          reward_amount: rewardAmount,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "campaign_manager_id,discount_amount" }
      )
      .select()
      .single();

    if (saveErr) {
      console.error("[Campaign Coupon POST] Upsert error:", saveErr);
      return NextResponse.json({ error: saveErr.message }, { status: 500 });
    }

    const { data: allCoupons } = await admin
      .from("campaign_coupons")
      .select("*")
      .eq("campaign_manager_id", user.id)
      .order("discount_amount", { ascending: true });

    return NextResponse.json({
      success: true,
      code: saved.code,
      coupon: saved,
      coupons: allCoupons || [saved],
      message: `₹${tier} off coupon ${fullCode} saved (you earn ₹${rewardAmount} per Pro conversion)!`,
    });
  } catch (err: any) {
    console.error("[Campaign Coupon POST] Exception:", err);
    return NextResponse.json(
      { error: err.message || "Failed to save coupon" },
      { status: 500 }
    );
  }
}
