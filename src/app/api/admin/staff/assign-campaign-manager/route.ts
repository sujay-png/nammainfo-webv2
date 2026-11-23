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
    const { userId } = body;

    if (!userId) {
      return NextResponse.json({ error: "User ID is required" }, { status: 400 });
    }

    const { data: profile, error: profErr } = await supabase
      .from("profiles")
      .select("id, email, owner_name, business_name, role, is_campaign_manager, is_partner")
      .eq("id", userId)
      .single();

    if (profErr || !profile) {
      return NextResponse.json({ error: "User profile not found" }, { status: 404 });
    }

    // 1. Update profiles table: set is_partner = true, is_campaign_manager = true
    // If current role is 'user', set role to 'partner'
    const newRole = profile.role === "admin" ? "admin" : "partner";

    const { error: updateErr } = await supabase
      .from("profiles")
      .update({
        is_partner: true,
        is_campaign_manager: true,
        role: newRole,
        updated_at: new Date().toISOString(),
      })
      .eq("id", userId);

    if (updateErr) {
      console.error("[Assign Partner] DB Update error:", updateErr);
      return NextResponse.json({ error: updateErr.message }, { status: 500 });
    }

    // 2. Update Supabase Auth user metadata
    try {
      await supabase.auth.admin.updateUserById(userId, {
        app_metadata: {
          is_partner: true,
          is_campaign_manager: true,
          role: newRole,
        },
        user_metadata: {
          is_partner: true,
          is_campaign_manager: true,
          role: newRole,
        },
      });
    } catch (authErr) {
      console.warn("[Assign Partner] Auth metadata update warning:", authErr);
    }

    return NextResponse.json({
      success: true,
      message: `Assigned ${profile.owner_name || profile.business_name || profile.email} as Partner.`,
    });
  } catch (err: any) {
    console.error("[Assign Campaign Manager] Exception:", err);
    return NextResponse.json(
      { error: err.message || "Failed to assign campaign manager" },
      { status: 500 }
    );
  }
}
