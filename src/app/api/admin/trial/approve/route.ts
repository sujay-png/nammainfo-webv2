import { NextResponse } from "next/server";
import { requireAdminAuth } from "@/admin/shared/lib/admin-auth";
import { saveAdminNotes } from "@/admin/shared/lib/admin-notes";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const auth = await requireAdminAuth(request);
  if (!auth.authorized) {
    return auth.response;
  }

  try {
    const supabase = auth.adminSupabase;
    const body = await request.json();
    const { companyId } = body;

    if (!companyId) {
      return NextResponse.json(
        { error: "Company ID is required" },
        { status: 400 }
      );
    }

    const { data: profile, error: fetchErr } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", companyId)
      .single();

    if (fetchErr || !profile) {
      return NextResponse.json(
        { error: "Company profile not found" },
        { status: 404 }
      );
    }

    const now = new Date();
    // 100-day trial countdown begins from the exact day & time of admin approval
    const oneHundredDaysMs = 100 * 24 * 60 * 60 * 1000;
    const expiresAt = new Date(now.getTime() + oneHundredDaysMs).toISOString();

    const approval: Record<string, unknown> = {
      subscription_plan: "trial",
      is_member: true,
      status: "active",
      primary_card_count: 1,
      subscription_started_at: now.toISOString(),
      membership_expires_at: expiresAt,
      trial_status: "approved",
      trial_approved_at: now.toISOString(),
      trial_extension_days: 0,
    };
    let { error: updateErr } = await supabase.from("profiles").update(approval).eq("id", companyId);
    if (updateErr?.message?.includes("primary_card_count")) {
      // Database migration not run yet: approve without that column.
      delete approval.primary_card_count;
      ({ error: updateErr } = await supabase.from("profiles").update(approval).eq("id", companyId));
    }
    if (!updateErr) {
      await saveAdminNotes(supabase, companyId, {
        milestone: 0,
        status: "unattended",
        notes: `100-day Free Trial approved on ${now.toLocaleDateString("en-IN")}. Day 20 follow-up scheduled.`,
      });
    }

    if (updateErr) {
      console.error("[Admin Trial Approve] Error updating profile:", updateErr);
      return NextResponse.json(
        { error: updateErr.message },
        { status: 500 }
      );
    }

    // Ensure digital card exists and is active for public NFC access
    const { data: existingCard } = await supabase
      .from("cards")
      .select("id")
      .eq("profile_id", companyId)
      .maybeSingle();

    if (!existingCard) {
      await supabase.from("cards").insert({
        profile_id: companyId,
        public_slug: profile.slug || profile.username || `user-${companyId.slice(0, 6)}`,
        is_active: true,
      });
    } else {
      await supabase
        .from("cards")
        .update({ is_active: true })
        .eq("id", existingCard.id);
    }

    return NextResponse.json({
      success: true,
      membershipExpiresAt: expiresAt,
      message: `100-day Free Trial successfully approved. Expires on ${new Date(expiresAt).toLocaleDateString("en-IN")}.`,
    });
  } catch (err: any) {
    console.error("[Admin Trial Approve] Unexpected error:", err);
    return NextResponse.json(
      { error: err.message || "Internal server error" },
      { status: 500 }
    );
  }
}

