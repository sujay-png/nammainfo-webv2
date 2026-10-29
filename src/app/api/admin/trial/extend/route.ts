import { NextResponse } from "next/server";
import { requireAdminAuth } from "@/admin/shared/lib/admin-auth";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const auth = await requireAdminAuth(request);
  if (!auth.authorized) {
    return auth.response;
  }

  try {
    const supabase = auth.adminSupabase;
    const body = await request.json();
    const { companyId, extensionDays } = body;

    const days = parseInt(extensionDays, 10);
    if (!companyId || isNaN(days) || days <= 0) {
      return NextResponse.json(
        { error: "Valid company ID and extension days (> 0) are required." },
        { status: 400 }
      );
    }

    const { data: profile, error: fetchErr } = await supabase
      .from("profiles")
      .select("id, status, membership_expires_at, trial_extension_days, subscription_plan")
      .eq("id", companyId)
      .single();

    if (fetchErr || !profile) {
      return NextResponse.json(
        { error: "Company profile not found" },
        { status: 404 }
      );
    }

    const now = Date.now();
    const currentExpiryTime = profile.membership_expires_at
      ? new Date(profile.membership_expires_at).getTime()
      : now;

    // If current expiry is in the future, extend from that date; if already expired, extend from now
    const baseTime = currentExpiryTime > now ? currentExpiryTime : now;
    const addedMs = days * 24 * 60 * 60 * 1000;
    const newExpiry = new Date(baseTime + addedMs).toISOString();
    const totalExtension = (profile.trial_extension_days || 0) + days;

    const { error: updateErr } = await supabase
      .from("profiles")
      .update({
        membership_expires_at: newExpiry,
        trial_extension_days: totalExtension,
        status: "active",
      })
      .eq("id", companyId);

    if (updateErr) {
      console.error("[Admin Trial Extend] Error updating expiry:", updateErr);
      return NextResponse.json({ error: updateErr.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      newExpiry,
      totalExtensionDays: totalExtension,
      addedDays: days,
      message: `Free trial extended by ${days} days. New expiry: ${new Date(newExpiry).toLocaleDateString("en-IN")}.`,
    });
  } catch (err: any) {
    console.error("[Admin Trial Extend] Unexpected error:", err);
    return NextResponse.json(
      { error: err.message || "Internal server error" },
      { status: 500 }
    );
  }
}

