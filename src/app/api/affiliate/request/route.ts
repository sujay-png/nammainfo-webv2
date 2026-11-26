import { NextResponse } from "next/server";
import { createClient } from "@/supabase/server";
import { createAdminClient } from "@/supabase/admin";
import { createStaffNotification } from "@/lib/fulfillment/service";
import {
  canSubmitAffiliateRequest,
  isActivePartnerAccount,
  normalizeAffiliateStatus,
} from "@/lib/affiliate/requests";

export const dynamic = "force-dynamic";

async function loadAffiliateContext(userId: string, userEmail?: string | null, userMeta?: Record<string, any>) {
  const admin = createAdminClient();

  const [{ data: profile }, { data: requestRow }, { data: employeeRow }] = await Promise.all([
    admin
      .from("profiles")
      .select(
        "id, owner_name, business_name, email, phone, role, is_admin, is_partner, is_campaign_manager, account_type, affiliate_status, slug, username"
      )
      .eq("id", userId)
      .maybeSingle(),
    admin.from("affiliate_requests").select("*").eq("user_id", userId).maybeSingle(),
    admin
      .from("employees")
      .select("id, owner_id, name, designation, email, phone, slug")
      .eq("user_id", userId)
      .maybeSingle(),
  ]);

  let companyName = profile?.business_name || null;
  if (employeeRow?.owner_id) {
    const { data: ownerProf } = await admin
      .from("profiles")
      .select("business_name, owner_name")
      .eq("id", employeeRow.owner_id)
      .maybeSingle();
    if (ownerProf?.business_name) {
      companyName = ownerProf.business_name;
    }
  }

  const isEmployee =
    userMeta?.role === "employee" ||
    profile?.account_type === "employee" ||
    Boolean(employeeRow);

  const isPartner = Boolean(
    profile &&
      isActivePartnerAccount({
        is_partner: (profile as any).is_partner,
        is_campaign_manager: profile.is_campaign_manager,
        role: profile.role,
      })
  );

  let status = normalizeAffiliateStatus((profile as any)?.affiliate_status || requestRow?.status);
  if (isPartner) {
    status = "approved";
  }

  return {
    admin,
    profile,
    requestRow,
    employeeRow,
    isEmployee,
    isPartner,
    status,
    companyName,
    email: userEmail || employeeRow?.email || profile?.email || "",
  };
}

export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const ctx = await loadAffiliateContext(
      user.id,
      user.email,
      (user.user_metadata as Record<string, any> | undefined) ?? {}
    );

    return NextResponse.json({
      status: ctx.status,
      isPartner: ctx.isPartner,
      applicantType: ctx.isEmployee ? "employee" : "owner",
      request: ctx.requestRow
        ? {
            id: ctx.requestRow.id,
            status: ctx.requestRow.status,
            note: ctx.requestRow.note,
            rejectionReason: ctx.requestRow.rejection_reason,
            createdAt: ctx.requestRow.created_at,
            reviewedAt: ctx.requestRow.reviewed_at,
          }
        : null,
      profileSummary: {
        fullName:
          ctx.employeeRow?.name ||
          ctx.profile?.owner_name ||
          (user.user_metadata as any)?.name ||
          ctx.email,
        businessName: ctx.companyName,
        email: ctx.email,
        phone: ctx.employeeRow?.phone || ctx.profile?.phone || null,
        designation: ctx.employeeRow?.designation || null,
      },
    });
  } catch (err: any) {
    console.error("[Affiliate Request GET] Error:", err);
    return NextResponse.json(
      { error: err?.message || "Failed to load affiliate status" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let note = "";
    try {
      const body = await req.json();
      note = typeof body?.note === "string" ? body.note.trim().slice(0, 500) : "";
    } catch {
      // Optional JSON body
    }

    const ctx = await loadAffiliateContext(
      user.id,
      user.email,
      (user.user_metadata as Record<string, any> | undefined) ?? {}
    );

    const check = canSubmitAffiliateRequest({
      isAdmin: ctx.profile?.is_admin,
      role: ctx.profile?.role,
      isPartner: (ctx.profile as any)?.is_partner,
      isCampaignManager: ctx.profile?.is_campaign_manager,
      affiliateStatus: ctx.status,
    });

    if (!check.ok) {
      return NextResponse.json({ error: check.reason }, { status: 400 });
    }

    const nowIso = new Date().toISOString();
    const applicantType = ctx.isEmployee ? "employee" : "owner";
    const fullName =
      ctx.employeeRow?.name ||
      ctx.profile?.owner_name ||
      (user.user_metadata as any)?.name ||
      ctx.email ||
      "Namma Info User";
    const businessName = ctx.companyName || (applicantType === "owner" ? ctx.profile?.business_name : null);
    const phone = ctx.employeeRow?.phone || ctx.profile?.phone || null;

    // Ensure profile row exists (some legacy employee users may need affiliate_status synced)
    if (!ctx.profile) {
      await ctx.admin.from("profiles").insert({
        id: user.id,
        email: ctx.email,
        owner_name: fullName,
        account_type: ctx.isEmployee ? "employee" : "owner",
        subscription_plan: "free",
        affiliate_status: "pending",
        created_at: nowIso,
        updated_at: nowIso,
      });
    } else {
      await ctx.admin
        .from("profiles")
        .update({ affiliate_status: "pending", updated_at: nowIso })
        .eq("id", user.id);
    }

    const { data: savedReq, error: upsertError } = await ctx.admin
      .from("affiliate_requests")
      .upsert(
        {
          user_id: user.id,
          applicant_type: applicantType,
          employee_id: ctx.employeeRow?.id ?? null,
          owner_id: ctx.employeeRow?.owner_id ?? null,
          full_name: fullName,
          business_name: businessName,
          email: ctx.email,
          phone,
          note: note || null,
          status: "pending",
          rejection_reason: null,
          reviewed_by: null,
          reviewed_at: null,
          updated_at: nowIso,
        },
        { onConflict: "user_id" }
      )
      .select("*")
      .single();

    if (upsertError) {
      return NextResponse.json({ error: upsertError.message }, { status: 500 });
    }

    const roleLabel = applicantType === "employee" ? "Employee" : "Business Owner";
    const orgLabel = businessName ? ` (${businessName})` : "";

    await createStaffNotification(ctx.admin, {
      recipientRole: "admin",
      eventType: "affiliate_request_submitted",
      severity: "action_required",
      title: `Affiliate Request: ${fullName}${orgLabel}`,
      message: `${roleLabel} (${ctx.email}) applied to join the Partner / Affiliate Program.`,
      entityType: "affiliate_request",
      entityId: savedReq.id,
      profileId: user.id,
      dedupeKey: `affiliate_req:${savedReq.id}:${nowIso.slice(0, 13)}`,
    });

    return NextResponse.json({
      success: true,
      status: "pending",
      request: {
        id: savedReq.id,
        status: savedReq.status,
        note: savedReq.note,
        rejectionReason: savedReq.rejection_reason,
        createdAt: savedReq.created_at,
        reviewedAt: savedReq.reviewed_at,
      },
    });
  } catch (err: any) {
    console.error("[Affiliate Request POST] Error:", err);
    return NextResponse.json(
      { error: err?.message || "Failed to submit affiliate request" },
      { status: 500 }
    );
  }
}
