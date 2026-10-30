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
    const { companyId, reason } = body;

    if (!companyId) {
      return NextResponse.json(
        { error: "Company ID is required" },
        { status: 400 }
      );
    }

    const { error: updateErr } = await supabase
      .from("profiles")
      .update({
        trial_status: "rejected",
        trial_follow_up_notes: reason ? `Rejected: ${reason}` : "Trial application rejected by admin.",
      })
      .eq("id", companyId);

    if (updateErr) {
      console.error("[Admin Trial Reject] Error:", updateErr);
      return NextResponse.json({ error: updateErr.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("[Admin Trial Reject] Unexpected error:", err);
    return NextResponse.json(
      { error: err.message || "Internal server error" },
      { status: 500 }
    );
  }
}

