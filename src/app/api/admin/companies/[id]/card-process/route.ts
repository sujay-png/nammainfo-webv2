import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdminAuth } from "@/admin/shared/lib/admin-auth";
import { saveAdminNotes } from "@/admin/shared/lib/admin-notes";

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

    // Fetch existing profile card_process
    const { data: profile, error: fetchErr } = await supabase
      .from("profiles")
      .select("id, slug, username, card_process")
      .eq("id", id)
      .single();

    if (fetchErr || !profile) {
      return NextResponse.json(
        { error: "Company profile not found" },
        { status: 404 }
      );
    }

    const existingProcess =
      profile.card_process && typeof profile.card_process === "object"
        ? (profile.card_process as Record<string, any>)
        : {};

    const timestamp = completed ? (date || new Date().toISOString()) : null;
    const updatedProcess = {
      ...existingProcess,
      [stepKey]: {
        completed,
        updated_at: timestamp,
      },
    };

    // 1. Save updated card_process to profiles
    const { error: updateErr } = await supabase
      .from("profiles")
      .update({ card_process: updatedProcess })
      .eq("id", id);

    if (updateErr) {
      console.error("[Card Process API] Failed to update card_process:", updateErr);
      return NextResponse.json(
        { error: updateErr.message },
        { status: 500 }
      );
    }

    // 2. Synchronize Order Status side-effects based on milestones
    if (completed) {
      if (stepKey === "customer_responded_designing") {
        await supabase
          .from("orders")
          .update({ status: "card_designed", updated_at: new Date().toISOString() })
          .eq("profile_id", id)
          .eq("status", "under_review");
      } else if (stepKey === "card_printed_approved") {
        await supabase
          .from("orders")
          .update({ status: "ready_to_dispatch", updated_at: new Date().toISOString() })
          .eq("profile_id", id)
          .in("status", ["under_review", "card_designed", "on_work"]);
      } else if (stepKey === "card_posted") {
        await supabase
          .from("orders")
          .update({ status: "out_for_delivery", updated_at: new Date().toISOString() })
          .eq("profile_id", id)
          .in("status", ["under_review", "card_designed", "ready_to_dispatch", "on_work"]);
      } else if (stepKey === "card_delivered") {
        await supabase
          .from("orders")
          .update({ status: "delivered", updated_at: new Date().toISOString() })
          .eq("profile_id", id)
          .neq("status", "cancelled");
      }
    }

    // 3. Synchronize Free Trial follow-up milestone attendance side-effects
    if (stepKey === "followup_1_done") {
      await saveAdminNotes(supabase, id, {
        milestone: completed ? 1 : 0,
        status: completed ? "attended" : "unattended",
        notes: completed ? `Follow-up 1 (Day 30) marked attended on ${new Date().toLocaleDateString("en-IN")}.` : "",
      });
    } else if (stepKey === "followup_2_done") {
      await saveAdminNotes(supabase, id, {
        milestone: completed ? 2 : 1,
        status: completed ? "attended" : "unattended",
        notes: completed ? `Follow-up 2 (Day 60) marked attended on ${new Date().toLocaleDateString("en-IN")}.` : "",
      });
    } else if (stepKey === "followup_3_done") {
      await saveAdminNotes(supabase, id, {
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

