import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminAuth } from "@/admin/shared/lib/admin-auth";

const validityUpdateSchema = z.object({
  subscriptionStartedAt: z.string().nullable().optional(),
  membershipExpiresAt: z.string().nullable().optional(),
  primaryCardCount: z.number().int().min(0).optional(),
  purchasedIdCount: z.number().int().min(0).optional(),
  subscriptionPlan: z.enum(["free", "pro"]).optional(),
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
    const parsed = validityUpdateSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid parameters", details: parsed.error.issues },
        { status: 400 }
      );
    }

    const updates: Record<string, any> = {};
    if (parsed.data.subscriptionStartedAt !== undefined) {
      updates.subscription_started_at = parsed.data.subscriptionStartedAt;
    }
    if (parsed.data.membershipExpiresAt !== undefined) {
      updates.membership_expires_at = parsed.data.membershipExpiresAt;
    }
    if (parsed.data.purchasedIdCount !== undefined) {
      updates.purchased_id_count = parsed.data.purchasedIdCount;
    }
    if (parsed.data.primaryCardCount !== undefined) {
      updates.primary_card_count = parsed.data.primaryCardCount;
    }
    if (parsed.data.subscriptionPlan !== undefined) {
      updates.subscription_plan = parsed.data.subscriptionPlan;
      updates.is_member = parsed.data.subscriptionPlan !== "free";
      if (parsed.data.subscriptionPlan === "free") {
        updates.membership_expires_at = null;
        updates.subscription_started_at = null;
        updates.primary_card_count = 0;
      }
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ message: "No fields to update" });
    }

    const supabase = auth.adminSupabase;
    let { error: updateError } = await supabase
      .from("profiles")
      .update(updates)
      .eq("id", id);

    // If primary_card_count column does not exist yet in Postgres, retry without it
    if (updateError && updateError.message?.includes("primary_card_count")) {
      delete updates.primary_card_count;
      const retry = await supabase
        .from("profiles")
        .update(updates)
        .eq("id", id);
      updateError = retry.error;
    }

    if (updateError) {
      console.error("[Admin API] Failed to update profile validity:", updateError);
      return NextResponse.json(
        { error: updateError.message },
        { status: 500 }
      );
    }

    // Synchronize team members automatically so individual validity setting is not needed
    if (parsed.data.subscriptionPlan !== undefined || parsed.data.membershipExpiresAt !== undefined) {
      const empUpdates: Record<string, any> = {};
      if (parsed.data.subscriptionPlan !== undefined) {
        empUpdates.is_premium = parsed.data.subscriptionPlan !== "free";
      }
      if (parsed.data.subscriptionPlan === "free") {
        empUpdates.is_premium = false;
        empUpdates.subscription_expires_at = null;
        empUpdates.subscription_started_at = null;
      } else if (parsed.data.membershipExpiresAt !== undefined) {
        empUpdates.subscription_expires_at = parsed.data.membershipExpiresAt;
      }
      if (parsed.data.subscriptionStartedAt !== undefined && parsed.data.subscriptionPlan !== "free") {
        empUpdates.subscription_started_at = parsed.data.subscriptionStartedAt;
      }
      if (Object.keys(empUpdates).length > 0) {
        await supabase
          .from("employees")
          .update(empUpdates)
          .eq("owner_id", id);
      }
    }

    return NextResponse.json({ success: true, updates });
  } catch (err: any) {
    console.error("[Admin API] Error updating validity:", err);
    return NextResponse.json(
      { error: err.message || "Failed to update validity" },
      { status: 500 }
    );
  }
}
