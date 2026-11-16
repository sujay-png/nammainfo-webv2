import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminAuth } from "@/admin/shared/lib/admin-auth";

const updateEmployeeSchema = z.object({
  isPremium: z.boolean().optional(),
  plan: z.enum(["free", "pro", "trial"]).optional(),
  subscriptionStartedAt: z.string().nullable().optional(),
  subscriptionExpiresAt: z.string().nullable().optional(),
  status: z.enum(["active", "suspended", "unassigned"]).optional(),
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
    const parsed = updateEmployeeSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid parameters", details: parsed.error.issues },
        { status: 400 }
      );
    }

    const updates: Record<string, any> = {};
    if (parsed.data.plan !== undefined) {
      updates.plan = parsed.data.plan;
      if (parsed.data.plan === "free") {
        updates.is_premium = false;
        updates.status = "unassigned";
        updates.subscription_started_at = null;
        updates.subscription_expires_at = null;
      } else {
        updates.is_premium = true;
        updates.status = "active";
      }
    }
    if (parsed.data.isPremium !== undefined && parsed.data.plan === undefined) {
      updates.is_premium = parsed.data.isPremium;
      if (!parsed.data.isPremium) {
        updates.plan = "free";
        updates.status = "unassigned";
        updates.subscription_started_at = null;
        updates.subscription_expires_at = null;
      } else {
        updates.plan = "pro";
        updates.status = "active";
      }
    }
    if (parsed.data.subscriptionStartedAt !== undefined) {
      updates.subscription_started_at = parsed.data.subscriptionStartedAt;
    }
    if (parsed.data.subscriptionExpiresAt !== undefined) {
      updates.subscription_expires_at = parsed.data.subscriptionExpiresAt;
    }
    if (parsed.data.status !== undefined) {
      updates.status = parsed.data.status;
      updates.is_active = parsed.data.status !== "suspended";
    }

    const supabase = auth.adminSupabase;
    let { error: updateError } = await supabase
      .from("employees")
      .update(updates)
      .eq("id", id);

    if (updateError?.message?.includes("plan")) {
      delete updates.plan;
      ({ error: updateError } = await supabase.from("employees").update(updates).eq("id", id));
    }

    if (updateError) {
      console.error("[Admin API] Failed to update employee:", updateError);
      return NextResponse.json(
        { error: updateError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, updates });
  } catch (err: any) {
    console.error("[Admin API] Unexpected error in employee update:", err);
    return NextResponse.json(
      { error: err.message || "Failed to update employee" },
      { status: 500 }
    );
  }
}

export const PATCH = POST;
