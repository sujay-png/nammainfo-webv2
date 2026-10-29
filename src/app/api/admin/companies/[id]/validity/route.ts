import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminAuth } from "@/admin/shared/lib/admin-auth";

const validityUpdateSchema = z.object({
  subscriptionStartedAt: z.string().nullable().optional(),
  membershipExpiresAt: z.string().nullable().optional(),
  primaryCardCount: z.number().int().min(0).optional(),
  purchasedIdCount: z.number().int().min(0).optional(),
  subscriptionPlan: z.enum(["free", "pro", "trial", "lifetime"]).optional(),
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
    if (parsed.data.subscriptionPlan !== undefined) {
      updates.subscription_plan = parsed.data.subscriptionPlan;
      updates.is_member = parsed.data.subscriptionPlan !== "free";
      if (parsed.data.subscriptionPlan === "free") {
        updates.membership_expires_at = null;
        updates.subscription_started_at = null;
      }
    }

    const supabase = auth.adminSupabase;

    // Check current status so we never override manual admin suspensions
    const { data: currentProfile } = await supabase
      .from("profiles")
      .select("status")
      .eq("id", id)
      .single();

    if (currentProfile && currentProfile.status !== "suspended") {
      if (parsed.data.subscriptionPlan === "free") {
        updates.status = "active";
      } else if (parsed.data.membershipExpiresAt !== undefined) {
        if (parsed.data.membershipExpiresAt) {
          const isFuture = new Date(parsed.data.membershipExpiresAt).getTime() > Date.now();
          updates.status = isFuture ? "active" : "expired";
        }
      }
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ message: "No fields to update" });
    }

    const { error: updateError } = await supabase
      .from("profiles")
      .update(updates)
      .eq("id", id);

    if (updateError) {
      console.error("[Admin API] Failed to update profile validity:", updateError);
      return NextResponse.json(
        { error: updateError.message },
        { status: 500 }
      );
    }

    // Synchronize team members according to company plan:
    // If company is set to Free -> all team members become Free
    if (parsed.data.subscriptionPlan === "free") {
      await supabase
        .from("employees")
        .update({
          is_premium: false,
          subscription_expires_at: null,
          subscription_started_at: null,
          status: "active",
        })
        .eq("owner_id", id);
    } else if (parsed.data.membershipExpiresAt !== undefined) {
      // If company validity is renewed/updated, sync expiry and status only for employees on Pro plan
      const isFuture = parsed.data.membershipExpiresAt
        ? new Date(parsed.data.membershipExpiresAt).getTime() > Date.now()
        : true;
      const empUpdates: Record<string, any> = {
        subscription_expires_at: parsed.data.membershipExpiresAt,
        status: isFuture ? "active" : "expired",
      };
      if (parsed.data.subscriptionStartedAt !== undefined) {
        empUpdates.subscription_started_at = parsed.data.subscriptionStartedAt;
      }
      await supabase
        .from("employees")
        .update(empUpdates)
        .eq("owner_id", id)
        .eq("is_premium", true);
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
