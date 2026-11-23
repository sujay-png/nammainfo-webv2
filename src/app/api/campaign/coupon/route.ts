import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { createAdminClient } from "@/supabase/admin";

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

    const { data: coupon, error } = await admin
      .from("campaign_coupons")
      .select("*")
      .eq("campaign_manager_id", user.id)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      coupon: coupon || null,
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
    let prefix = (body.prefix || "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "");

    if (!prefix || prefix.length < 2) {
      return NextResponse.json(
        { error: "Coupon prefix must contain at least 2 alphanumeric characters" },
        { status: 400 }
      );
    }

    if (prefix.length > 12) {
      prefix = prefix.slice(0, 12);
    }

    // Always append 500
    const fullCode = prefix.endsWith("500") ? prefix : `${prefix}500`;

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

    // Upsert single coupon for this manager
    const { data: saved, error: saveErr } = await admin
      .from("campaign_coupons")
      .upsert(
        {
          campaign_manager_id: user.id,
          code: fullCode,
          discount_amount: 500,
          reward_amount: 500,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "campaign_manager_id" }
      )
      .select()
      .single();

    if (saveErr) {
      console.error("[Campaign Coupon POST] Upsert error:", saveErr);
      return NextResponse.json({ error: saveErr.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      coupon: saved,
      message: `Coupon code ${fullCode} generated successfully!`,
    });
  } catch (err: any) {
    console.error("[Campaign Coupon POST] Exception:", err);
    return NextResponse.json(
      { error: err.message || "Failed to save coupon" },
      { status: 500 }
    );
  }
}
