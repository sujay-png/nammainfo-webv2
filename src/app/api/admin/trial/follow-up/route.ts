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
    const { companyId, status, notes, milestone } = body;

    if (!companyId) {
      return NextResponse.json(
        { error: "Company ID is required" },
        { status: 400 }
      );
    }

    const updates: Record<string, any> = {};

    if (status && (status === "unattended" || status === "attended")) {
      updates.trial_follow_up_status = status;
    }

    if (typeof notes === "string") {
      updates.trial_follow_up_notes = notes;
    }

    if (typeof milestone === "number") {
      updates.trial_follow_up_milestone = milestone;
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ message: "No fields to update" });
    }

    const { error: updateErr } = await supabase
      .from("profiles")
      .update(updates)
      .eq("id", companyId);

    if (updateErr) {
      console.error("[Admin Trial Follow-Up] Error:", updateErr);
      return NextResponse.json({ error: updateErr.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, updates });
  } catch (err: any) {
    console.error("[Admin Trial Follow-Up] Unexpected error:", err);
    return NextResponse.json(
      { error: err.message || "Internal server error" },
      { status: 500 }
    );
  }
}

