import { NextResponse } from "next/server";
import { requireAdminAuth } from "@/admin/shared/lib/admin-auth";
import { createStaffNotification } from "@/lib/fulfillment/service";
import {
  resolveAffiliateDecisionTransition,
  type AffiliateDecision,
} from "@/lib/affiliate/requests";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdminAuth(request);
  if (!auth.authorized) {
    return auth.response;
  }

  try {
    const { id: requestId } = await params;
    const body = await request.json();
    const action = body?.action as AffiliateDecision;
    const rejectionReason =
      typeof body?.rejectionReason === "string" ? body.rejectionReason : null;

    const supabase = auth.adminSupabase;

    const { data: reqRow, error: fetchErr } = await supabase
      .from("affiliate_requests")
      .select("*")
      .eq("id", requestId)
      .maybeSingle();

    if (fetchErr || !reqRow) {
      return NextResponse.json({ error: "Affiliate request not found" }, { status: 404 });
    }

    const transition = resolveAffiliateDecisionTransition(
      reqRow.status,
      action,
      rejectionReason
    );

    if (!transition.ok || !transition.nextStatus || !transition.nextAffiliateStatus) {
      return NextResponse.json(
        { error: transition.error || "Invalid state transition" },
        { status: 400 }
      );
    }

    const nowIso = new Date().toISOString();

    const { error: updateReqErr } = await supabase
      .from("affiliate_requests")
      .update({
        status: transition.nextStatus,
        rejection_reason: transition.cleanedReason,
        reviewed_by: auth.userId,
        reviewed_at: nowIso,
        updated_at: nowIso,
      })
      .eq("id", requestId);

    if (updateReqErr) {
      return NextResponse.json({ error: updateReqErr.message }, { status: 500 });
    }

    if (action === "approve") {
      // Load current profile & auth user metadata so we NEVER overwrite employee/owner role flags
      const [{ data: existingProf }, { data: authUserRes }] = await Promise.all([
        supabase
          .from("profiles")
          .select("id, role, account_type")
          .eq("id", reqRow.user_id)
          .maybeSingle(),
        supabase.auth.admin.getUserById(reqRow.user_id),
      ]);

      const isEmployee =
        reqRow.applicant_type === "employee" ||
        existingProf?.account_type === "employee" ||
        authUserRes?.user?.user_metadata?.role === "employee";

      await supabase
        .from("profiles")
        .update({
          is_partner: true,
          is_campaign_manager: true,
          affiliate_status: "approved",
          ...(existingProf?.role === "admin" || isEmployee ? {} : { role: existingProf?.role || "user" }),
          updated_at: nowIso,
        })
        .eq("id", reqRow.user_id);

      try {
        const prevAppMeta = (authUserRes?.user?.app_metadata as Record<string, any>) || {};
        const prevUserMeta = (authUserRes?.user?.user_metadata as Record<string, any>) || {};
        await supabase.auth.admin.updateUserById(reqRow.user_id, {
          app_metadata: {
            ...prevAppMeta,
            is_partner: true,
            is_campaign_manager: true,
          },
          user_metadata: {
            ...prevUserMeta,
            is_partner: true,
            is_campaign_manager: true,
          },
        });
      } catch (metaErr) {
        console.warn("[Affiliate Decision] Auth metadata update warning:", metaErr);
      }

      await createStaffNotification(supabase, {
        recipientRole: "partner",
        recipientUserId: reqRow.user_id,
        eventType: "affiliate_approved",
        severity: "info",
        title: "Affiliate Application Approved",
        message:
          "Your Namma Info Partner account is now active. Visit partner.nammainfo.in or open the Partner Dashboard from Settings.",
        entityType: "affiliate_request",
        entityId: requestId,
        profileId: reqRow.user_id,
        dedupeKey: `affiliate_approved:${requestId}`,
      });
    } else {
      await supabase
        .from("profiles")
        .update({
          affiliate_status: "rejected",
          updated_at: nowIso,
        })
        .eq("id", reqRow.user_id);
    }

    return NextResponse.json({
      success: true,
      status: transition.nextStatus,
      message:
        action === "approve"
          ? `Approved ${reqRow.full_name || reqRow.email} as a Partner.`
          : `Rejected affiliate request from ${reqRow.full_name || reqRow.email}.`,
    });
  } catch (err: any) {
    console.error("[Admin Affiliate Decision POST] Error:", err);
    return NextResponse.json(
      { error: err?.message || "Failed to process affiliate decision" },
      { status: 500 }
    );
  }
}
