import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireStaffAuth } from "@/admin/shared/lib/admin-auth";
import { getMembership } from "@/lib/membership";
import { syncMilestoneChange } from "@/lib/fulfillment/service";
import type { CardProcessStepKey } from "@/lib/fulfillment/state-machine";

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
  request: Request,
  { params }: { params: { id: string } }
) {
  const auth = await requireStaffAuth(request);
  if (!auth.authorized) {
    return auth.response;
  }

  try {
    const { id } = params;
    const body = await request.json();
    const parsed = cardProcessStepSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid parameters", details: parsed.error.issues },
        { status: 400 }
      );
    }

    const { stepKey, completed, date } = parsed.data;
    const supabase = auth.adminSupabase;
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

    const { data: profile } = await (isUuid
      ? supabase
          .from("profiles")
          .select("id, slug, username, subscription_plan, is_member, membership_expires_at, status")
          .eq("id", id)
          .maybeSingle()
      : supabase
          .from("profiles")
          .select("id, slug, username, subscription_plan, is_member, membership_expires_at, status")
          .or(`slug.eq.${id},username.eq.${id}`)
          .maybeSingle());

    if (!profile) {
      return NextResponse.json(
        { error: `Company profile not found for identifier: ${id}` },
        { status: 404 }
      );
    }

    const isTrial = profile.subscription_plan === "trial";
    const hasCompanyProPlan = getMembership(profile).isPaid;
    if (!isTrial && !hasCompanyProPlan) {
      return NextResponse.json(
        { error: "Card process milestones are locked for Free Plan accounts. Upgrade to Pro or Free Trial first." },
        { status: 403 }
      );
    }

    const result = await syncMilestoneChange(supabase, {
      profileId: profile.id,
      stepKey: stepKey as CardProcessStepKey,
      completed,
      actor: { id: auth.userId, role: auth.role },
      date,
    });

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    try {
      if (profile.slug) revalidatePath(`/${profile.slug}`);
      if (profile.username) revalidatePath(`/${profile.username}`);
      revalidatePath("/dashboard/orders");
    } catch {
      // ignore
    }

    return NextResponse.json({
      success: true,
      cardProcess: result.cardProcess,
    });
  } catch (err: any) {
    console.error("[Card Process API] Unexpected error:", err);
    return NextResponse.json(
      { error: err.message || "Failed to update milestone" },
      { status: 500 }
    );
  }
}

