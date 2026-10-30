import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { calculateProfileCompletion } from "@/lib/profile-completion";
import { createAdminClient } from "@/supabase/admin";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const cookieStore = cookies();
    const supabase = createServerClient(
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
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const rawCoupon = String(body.couponCode || "").trim().toUpperCase();

    if (!rawCoupon) {
      return NextResponse.json(
        { error: "Please enter a coupon code. Use ADI100 to apply." },
        { status: 400 }
      );
    }

    if (rawCoupon !== "ADI100") {
      return NextResponse.json(
        { error: "Invalid coupon code. Please use coupon code ADI100 to apply for the 100-day Free Trial." },
        { status: 400 }
      );
    }

    // Fetch user profile
    const { data: profile, error: profileErr } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single();

    if (profileErr || !profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    // Check if already on Pro or Trial
    if (profile.subscription_plan === "pro") {
      return NextResponse.json(
        { error: "Your account is already on the Pro Plan." },
        { status: 400 }
      );
    }

    if (profile.subscription_plan === "trial" && profile.status === "active") {
      return NextResponse.json(
        { error: "Your account already has an active 100-day Free Trial." },
        { status: 400 }
      );
    }

    if (profile.trial_status === "pending_approval") {
      return NextResponse.json(
        { error: "Your Free Trial application is already submitted and awaiting confirmation from our team." },
        { status: 400 }
      );
    }

    // Strictly enforce minimum 60% profile completion requirement
    const completion = calculateProfileCompletion(profile);
    if (completion.percentage < 60) {
      return NextResponse.json(
        {
          error: `Profile completion must be at least 60% before applying for the 100-day Free Trial. Your current completion is ${completion.percentage}%. Please complete your business profile first.`,
          percentage: completion.percentage,
          missingItems: completion.missingItems.map((m) => m.label),
        },
        { status: 400 }
      );
    }

    // Trial fields are protected in the database, so the server records the
    // application (the checks above already ran for this signed-in user).
    let admin;
    try {
      admin = createAdminClient();
    } catch {
      return NextResponse.json(
        { error: "Free trial applications are not set up on the server yet (missing SUPABASE_SERVICE_ROLE_KEY)." },
        { status: 500 }
      );
    }
    const now = new Date().toISOString();
    const { error: updateErr } = await admin
      .from("profiles")
      .update({
        trial_status: "pending_approval",
        trial_coupon_code: rawCoupon,
        trial_requested_at: now,
      })
      .eq("id", user.id);

    if (updateErr) {
      console.error("[Trial Apply] Error updating profile:", updateErr);
      return NextResponse.json(
        { error: updateErr.message || "Failed to submit free trial application." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Your 100 days free trial is awaiting confirmation from our team.",
    });
  } catch (err: any) {
    console.error("[Trial Apply] Unexpected error:", err);
    return NextResponse.json(
      { error: err.message || "Internal server error" },
      { status: 500 }
    );
  }
}

