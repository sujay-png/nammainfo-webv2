import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { createAdminClient } from "@/supabase/admin";

export const dynamic = "force-dynamic";

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

    const body = await req.json();
    const rawRef = (body.ref || "").trim();

    if (!rawRef) {
      return NextResponse.json({ success: false, message: "No ref provided" });
    }

    const admin = createAdminClient();

    // 1. Resolve referrer profile: could be slug, username, coupon code, or UUID
    let referrer: {
      id: string;
      is_campaign_manager?: boolean;
      role?: string;
      username?: string | null;
      slug?: string | null;
      owner_name?: string | null;
      business_name?: string | null;
    } | null = null;
    let couponCode: string | null = null;

    // Check if rawRef is a coupon code ending in 500
    if (rawRef.toUpperCase().endsWith("500")) {
      const { data: cpn } = await admin
        .from("campaign_coupons")
        .select("campaign_manager_id, code")
        .eq("code", rawRef.toUpperCase())
        .maybeSingle();

      if (cpn) {
        referrer = { id: cpn.campaign_manager_id, is_campaign_manager: true };
        couponCode = cpn.code;
      }
    }

    if (!referrer) {
      // Look up by slug, username, or id in profiles
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(rawRef);
      let query = admin
        .from("profiles")
        .select("id, is_campaign_manager, role, business_name, owner_name, username, slug")
        .limit(1);

      if (isUuid) {
        query = query.or(`id.eq.${rawRef},slug.eq.${rawRef},username.eq.${rawRef}`);
      } else {
        query = query.or(`slug.eq.${rawRef},username.eq.${rawRef}`);
      }

      const { data: match } = await query.maybeSingle();
      if (match) {
        referrer = match;
      }
    }

    // Also look up cards table by public_slug if still not found
    if (!referrer) {
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(rawRef);
      const { data: cardMatch } = await admin
        .from("cards")
        .select("profile_id")
        .eq(isUuid ? "id" : "public_slug", rawRef)
        .maybeSingle();

      if (cardMatch?.profile_id) {
        const { data: profMatch } = await admin
          .from("profiles")
          .select("id, is_campaign_manager, role, business_name, owner_name, username, slug")
          .eq("id", cardMatch.profile_id)
          .maybeSingle();

        if (profMatch) {
          referrer = profMatch;
        }
      }
    }

    if (!referrer || referrer.id === user.id) {
      return NextResponse.json({ success: false, message: "Invalid referrer" });
    }

    // Only link if referrer is a partner / campaign manager
    const isManager = Boolean(
      (referrer as any).is_partner ||
      referrer.is_campaign_manager ||
      referrer.role === "partner" ||
      referrer.role === "campaign_manager"
    );
    if (!isManager) {
      return NextResponse.json({ success: false, message: "Referrer is not an active partner" });
    }

    // Determine if ref was a direct coupon or came via profile/card link
    const isDirectCoupon = Boolean(rawRef.toUpperCase().endsWith("500") && couponCode);

    // 2. Update referee's profile: set referred_by (and only set referred_by_code if they directly used coupon)
    await admin
      .from("profiles")
      .update({
        referred_by: referrer.id,
        referred_by_code: isDirectCoupon ? couponCode : null,
      })
      .eq("id", user.id);

    // 3. Insert or ensure pending referral record
    const { data: existingRef } = await admin
      .from("referrals")
      .select("id")
      .eq("referred_user_id", user.id)
      .maybeSingle();

    if (!existingRef) {
      await admin.from("referrals").insert({
        campaign_manager_id: referrer.id,
        referred_user_id: user.id,
        coupon_code: isDirectCoupon ? couponCode : null,
        source: isDirectCoupon ? "coupon" : "card",
        status: "pending",
        amount_pending: isDirectCoupon ? 500 : 1000,
        amount_converted: 0,
        amount_transferred: 0,
      });
    }

    return NextResponse.json({
      success: true,
      referredBy: referrer.id,
      couponCode: isDirectCoupon ? couponCode : null,
    });
  } catch (err: any) {
    console.error("[Referrals Link API] Exception:", err);
    return NextResponse.json(
      { error: err.message || "Failed to link referral" },
      { status: 500 }
    );
  }
}
