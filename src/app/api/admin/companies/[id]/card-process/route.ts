import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdminAuth } from "@/admin/shared/lib/admin-auth";
import { saveAdminNotes } from "@/admin/shared/lib/admin-notes";
import { getMembership } from "@/lib/membership";

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
  const auth = await requireAdminAuth(request);
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

    // Check if id parameter is a valid UUID
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

    // Fetch existing profile with fallback if card_process column is not yet migrated in DB
    let profile: any = null;
    let fetchErr: any = null;

    if (isUuid) {
      const res = await supabase
        .from("profiles")
        .select("id, slug, username, subscription_plan, is_member, membership_expires_at, status, card_process")
        .eq("id", id)
        .maybeSingle();
      profile = res.data;
      fetchErr = res.error;
    }

    if (!profile && fetchErr?.message?.includes("card_process")) {
      // Column does not exist in database yet
      const res = await (isUuid
        ? supabase.from("profiles").select("id, slug, username, subscription_plan, is_member, membership_expires_at, status").eq("id", id).maybeSingle()
        : supabase.from("profiles").select("id, slug, username, subscription_plan, is_member, membership_expires_at, status").or(`slug.eq.${id},username.eq.${id}`).maybeSingle());
      profile = res.data;
      fetchErr = res.error;
    }

    // Fallback: If not found by UUID or id was a slug/username, search by slug or username
    if (!profile) {
      const res = await supabase
        .from("profiles")
        .select("id, slug, username, subscription_plan, is_member, membership_expires_at, status, card_process")
        .or(`slug.eq.${id},username.eq.${id}`)
        .maybeSingle();
      if (res.data) {
        profile = res.data;
        fetchErr = null;
      }
    }

    if (!profile) {
      return NextResponse.json(
        { error: `Company profile not found for identifier: ${id}` },
        { status: 404 }
      );
    }

    // Verify company tier: Free Plan accounts are locked from milestone updates (Free Trial & Pro are unlocked)
    const isTrial = profile.subscription_plan === "trial";
    const hasCompanyProPlan = getMembership(profile).isPaid;
    if (!isTrial && !hasCompanyProPlan) {
      return NextResponse.json(
        { error: "Card process milestones are locked for Free Plan accounts. Upgrade to Pro or Free Trial first." },
        { status: 403 }
      );
    }

    // Fetch existing process from profiles.card_process or fallback in profile_admin_notes
    let existingProcess: Record<string, any> = {};
    if (profile.card_process && typeof profile.card_process === "object") {
      existingProcess = profile.card_process;
    } else {
      const { data: notes } = await supabase
        .from("profile_admin_notes")
        .select("follow_up_notes")
        .eq("profile_id", profile.id)
        .maybeSingle();
      if (notes?.follow_up_notes?.startsWith("__CARD_PROCESS_JSON__:")) {
        try {
          existingProcess = JSON.parse(notes.follow_up_notes.replace("__CARD_PROCESS_JSON__:", ""));
        } catch {
          existingProcess = {};
        }
      }
    }

    const timestamp = completed ? (date || new Date().toISOString()) : null;
    const updatedProcess = {
      ...existingProcess,
      [stepKey]: {
        completed,
        updated_at: timestamp,
      },
    };

    // 1. Save updated card_process to profiles, with automatic fallback to profile_admin_notes
    let { error: updateErr } = await supabase
      .from("profiles")
      .update({ card_process: updatedProcess })
      .eq("id", profile.id);

    if (updateErr) {
      console.warn("[Card Process API] profiles.card_process update error, saving to admin notes fallback:", updateErr.message);
      // Fallback: save into profile_admin_notes so it works even before migration is executed
      const marker = `__CARD_PROCESS_JSON__:${JSON.stringify(updatedProcess)}`;
      await supabase
        .from("profile_admin_notes")
        .upsert(
          {
            profile_id: profile.id,
            follow_up_notes: marker,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "profile_id" }
        );
      updateErr = null;
    }

    // 2. Synchronize Order Status side-effects based on milestones
    if (completed) {
      if (stepKey === "customer_responded_designing") {
        await supabase
          .from("orders")
          .update({ status: "card_designed", updated_at: new Date().toISOString() })
          .eq("profile_id", profile.id)
          .eq("status", "under_review");
      } else if (stepKey === "card_printed_approved") {
        await supabase
          .from("orders")
          .update({ status: "ready_to_dispatch", updated_at: new Date().toISOString() })
          .eq("profile_id", profile.id)
          .in("status", ["under_review", "card_designed", "on_work"]);
      } else if (stepKey === "card_posted") {
        await supabase
          .from("orders")
          .update({ status: "out_for_delivery", updated_at: new Date().toISOString() })
          .eq("profile_id", profile.id)
          .in("status", ["under_review", "card_designed", "ready_to_dispatch", "on_work"]);
      } else if (stepKey === "card_delivered") {
        await supabase
          .from("orders")
          .update({ status: "delivered", updated_at: new Date().toISOString() })
          .eq("profile_id", profile.id)
          .neq("status", "cancelled");
      }
    }

    // 3. Synchronize Free Trial follow-up milestone attendance side-effects
    if (stepKey === "followup_1_done") {
      await saveAdminNotes(supabase, profile.id, {
        milestone: completed ? 1 : 0,
        status: completed ? "attended" : "unattended",
        notes: completed ? `Follow-up 1 (Day 30) marked attended on ${new Date().toLocaleDateString("en-IN")}.` : "",
      });
    } else if (stepKey === "followup_2_done") {
      await saveAdminNotes(supabase, profile.id, {
        milestone: completed ? 2 : 1,
        status: completed ? "attended" : "unattended",
        notes: completed ? `Follow-up 2 (Day 60) marked attended on ${new Date().toLocaleDateString("en-IN")}.` : "",
      });
    } else if (stepKey === "followup_3_done") {
      await saveAdminNotes(supabase, profile.id, {
        milestone: completed ? 3 : 2,
        status: completed ? "attended" : "unattended",
        notes: completed ? `Follow-up 3 (Day 90) marked attended on ${new Date().toLocaleDateString("en-IN")}.` : "",
      });
    }

    // Purge cache paths
    try {
      revalidatePath("/dashboard/orders");
    } catch {
      // ignore
    }

    return NextResponse.json({
      success: true,
      cardProcess: updatedProcess,
    });
  } catch (err: any) {
    console.error("[Card Process API] Unexpected error:", err);
    return NextResponse.json(
      { error: err.message || "Failed to update milestone" },
      { status: 500 }
    );
  }
}

