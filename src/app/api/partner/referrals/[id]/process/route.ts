import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { createAdminClient } from "@/supabase/admin";
import { z } from "zod";
import { syncMilestoneChange } from "@/lib/fulfillment/service";
import { canRoleToggleMilestone, type CardProcessStepKey } from "@/lib/fulfillment/state-machine";

export const dynamic = "force-dynamic";

const cardProcessStepSchema = z.object({
  stepKey: z.enum([
    "greetings_sent",
    "customer_responded_designing",
    "card_printed_approved",
    "card_posted",
    "card_delivered",
    "followup_1_done",
    "followup_2_done",
    "followup_3_done",
    "pro_active",
  ]),
  completed: z.boolean(),
  date: z.string().optional(),
});

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const cookieStore = cookies();
    const supabaseUser = createServerClient(
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
    } = await supabaseUser.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const admin = createAdminClient();
    const { id: targetUserId } = params;

    // Check partner authorization
    const { data: partnerProfile } = await admin
      .from("profiles")
      .select("id, owner_name, business_name, is_partner, is_campaign_manager, role, is_admin")
      .eq("id", user.id)
      .single();

    const isAdmin = Boolean(partnerProfile?.is_admin || partnerProfile?.role === "admin");
    const isPartner = Boolean(
      (partnerProfile as any)?.is_partner ||
      partnerProfile?.is_campaign_manager ||
      partnerProfile?.role === "partner" ||
      partnerProfile?.role === "campaign_manager"
    );

    if (!isAdmin && !isPartner) {
      return NextResponse.json({ error: "Forbidden: Not an active Partner" }, { status: 403 });
    }

    // Verify ownership of the referral unless admin
    if (!isAdmin) {
      const { data: refRecord } = await admin
        .from("referrals")
        .select("id")
        .eq("campaign_manager_id", user.id)
        .eq("referred_user_id", targetUserId)
        .maybeSingle();

      if (!refRecord) {
        const { data: targetProfileCheck } = await admin
          .from("profiles")
          .select("referred_by")
          .eq("id", targetUserId)
          .maybeSingle();

        if (targetProfileCheck?.referred_by !== user.id) {
          return NextResponse.json(
            { error: "Forbidden: You are not the referring partner for this customer" },
            { status: 403 }
          );
        }
      }
    }

    const body = await req.json();
    const parsed = cardProcessStepSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid payload", details: parsed.error.issues },
        { status: 400 }
      );
    }

    const { stepKey, completed, date } = parsed.data;
    const actorRole = isAdmin ? "admin" : "partner";
    if (!canRoleToggleMilestone(actorRole, stepKey as CardProcessStepKey)) {
      return NextResponse.json(
        { error: "Physical print, dispatch, and delivery stages are handled by Designer & Admin." },
        { status: 403 }
      );
    }

    const actorName =
      partnerProfile?.owner_name || partnerProfile?.business_name || (isAdmin ? "Admin" : "Partner");

    const result = await syncMilestoneChange(admin, {
      profileId: targetUserId,
      stepKey: stepKey as CardProcessStepKey,
      completed,
      actor: { id: user.id, role: actorRole, name: actorName },
      date,
    });

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    return NextResponse.json({
      success: true,
      cardProcess: result.cardProcess,
    });
  } catch (err: any) {
    console.error("[Partner Card Process API] Exception:", err);
    return NextResponse.json(
      { error: err.message || "Failed to update milestone" },
      { status: 500 }
    );
  }
}
