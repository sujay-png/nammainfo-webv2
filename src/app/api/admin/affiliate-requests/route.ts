import { NextResponse } from "next/server";
import { requireAdminAuth } from "@/admin/shared/lib/admin-auth";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await requireAdminAuth(request);
  if (!auth.authorized) {
    return auth.response;
  }

  try {
    const supabase = auth.adminSupabase;

    const { data: rows, error } = await supabase
      .from("affiliate_requests")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const requests = rows || [];
    const userIds = Array.from(new Set(requests.map((r: any) => r.user_id).filter(Boolean)));
    const empIds = Array.from(new Set(requests.map((r: any) => r.employee_id).filter(Boolean)));
    const ownerIds = Array.from(new Set(requests.map((r: any) => r.owner_id).filter(Boolean)));

    const profileIds = Array.from(new Set([...userIds, ...ownerIds]));
    const [{ data: profiles }, { data: employees }] = await Promise.all([
      profileIds.length > 0
        ? supabase
            .from("profiles")
            .select(
              "id, owner_name, business_name, email, phone, account_type, subscription_plan, slug, username, is_partner, is_campaign_manager"
            )
            .in("id", profileIds)
        : Promise.resolve({ data: [] as any[] }),
      empIds.length > 0
        ? supabase
            .from("employees")
            .select("id, name, designation, slug, email, phone, owner_id")
            .in("id", empIds)
        : Promise.resolve({ data: [] as any[] }),
    ]);

    const profileMap = new Map<string, any>((profiles || []).map((p: any) => [p.id, p]));
    const empMap = new Map<string, any>((employees || []).map((e: any) => [e.id, e]));

    const enriched = requests.map((r: any) => {
      const prof = profileMap.get(r.user_id) || {};
      const emp = r.employee_id ? empMap.get(r.employee_id) : null;
      const ownerProf = r.owner_id ? profileMap.get(r.owner_id) : null;
      const companyName =
        ownerProf?.business_name || r.business_name || prof.business_name || null;

      return {
        id: r.id,
        userId: r.user_id,
        applicantType: r.applicant_type as "owner" | "employee",
        employeeId: r.employee_id || null,
        ownerId: r.owner_id || null,
        fullName: emp?.name || r.full_name || prof.owner_name || r.email || "Applicant",
        businessName: companyName,
        designation: emp?.designation || null,
        email: r.email || prof.email || emp?.email || "",
        phone: r.phone || emp?.phone || prof.phone || null,
        note: r.note || null,
        status: r.status as "pending" | "approved" | "rejected",
        rejectionReason: r.rejection_reason || null,
        reviewedAt: r.reviewed_at || null,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
        subscriptionPlan: prof.subscription_plan || "free",
        publicSlug:
          r.applicant_type === "employee" && ownerProf && emp?.slug
            ? `${ownerProf.slug || ownerProf.username || ownerProf.id}/${emp.slug}`
            : prof.slug || prof.username || null,
      };
    });

    const counts = {
      pending: enriched.filter((r) => r.status === "pending").length,
      approved: enriched.filter((r) => r.status === "approved").length,
      rejected: enriched.filter((r) => r.status === "rejected").length,
      total: enriched.length,
    };

    return NextResponse.json({ requests: enriched, counts });
  } catch (err: any) {
    console.error("[Admin Affiliate Requests GET] Error:", err);
    return NextResponse.json(
      { error: err?.message || "Failed to load affiliate requests" },
      { status: 500 }
    );
  }
}
