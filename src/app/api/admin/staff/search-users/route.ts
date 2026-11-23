import { NextResponse } from "next/server";
import { requireAdminAuth } from "@/admin/shared/lib/admin-auth";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await requireAdminAuth(request);
  if (!auth.authorized) {
    return auth.response;
  }

  try {
    const { searchParams } = new URL(request.url);
    const query = (searchParams.get("q") || "").trim().toLowerCase();

    if (!query || query.length < 2) {
      return NextResponse.json({ users: [] });
    }

    const supabase = auth.adminSupabase;

    const { data: users, error } = await supabase
      .from("profiles")
      .select("id, email, owner_name, business_name, phone, role, is_admin, is_campaign_manager, is_partner, avatar_url, created_at")
      .or(`email.ilike.%${query}%,owner_name.ilike.%${query}%,business_name.ilike.%${query}%`)
      .limit(10);

    if (error) {
      console.error("[Search Users API] Error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const formatted = (users || []).map((u: any) => ({
      id: u.id,
      email: u.email,
      name: u.owner_name || u.business_name || "User",
      businessName: u.business_name,
      phone: u.phone,
      role: u.role || "user",
      isAdmin: Boolean(u.is_admin || u.role === "admin"),
      isCampaignManager: Boolean(u.is_campaign_manager || u.role === "campaign_manager"),
      isPartner: Boolean(u.is_partner || u.is_campaign_manager || u.role === "partner" || u.role === "campaign_manager"),
      avatarUrl: u.avatar_url,
    }));

    return NextResponse.json({ users: formatted });
  } catch (err: any) {
    console.error("[Search Users API] Exception:", err);
    return NextResponse.json(
      { error: err.message || "Failed to search users" },
      { status: 500 }
    );
  }
}
