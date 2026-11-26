import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/supabase/server";
import { createAdminClient } from "@/supabase/admin";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const supabaseUser = await createClient();
    const {
      data: { user },
      error: authErr,
    } = await supabaseUser.auth.getUser();

    if (authErr || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { orderId } = body;

    if (!orderId) {
      return NextResponse.json({ error: "Order ID is required" }, { status: 400 });
    }

    const admin = createAdminClient();

    // Verify the order belongs to this authenticated user
    const { data: order, error: orderErr } = await admin
      .from("orders")
      .select("id, profile_id, status")
      .eq("id", orderId)
      .eq("profile_id", user.id)
      .single();

    if (orderErr || !order) {
      return NextResponse.json(
        { error: "Order not found or unauthorized" },
        { status: 404 }
      );
    }

    const nowIso = new Date().toISOString();

    // 1. Update order status to delivered
    const { error: updateOrderErr } = await admin
      .from("orders")
      .update({
        status: "delivered",
        updated_at: nowIso,
      })
      .eq("id", orderId);

    if (updateOrderErr) {
      console.error("[User Deliver API] Error updating order:", updateOrderErr);
      return NextResponse.json(
        { error: updateOrderErr.message },
        { status: 500 }
      );
    }

    // 2. Synchronize company card_process.card_delivered milestone
    const { data: profile } = await admin
      .from("profiles")
      .select("id, card_process")
      .eq("id", user.id)
      .single();

    if (profile) {
      const existingProcess =
        profile.card_process && typeof profile.card_process === "object"
          ? (profile.card_process as Record<string, any>)
          : {};

      const updatedProcess = {
        ...existingProcess,
        card_delivered: {
          completed: true,
          updated_at: nowIso,
        },
      };

      await admin
        .from("profiles")
        .update({ card_process: updatedProcess })
        .eq("id", user.id);
    }

    try {
      await admin
        .from("fulfillment_jobs")
        .update({
          stage: "delivered",
          delivered_at: nowIso,
          last_updated_by: user.id,
          last_updated_by_role: "customer",
          last_updated_by_name: "Customer Confirmed",
          updated_at: nowIso,
        })
        .eq("order_id", orderId);
    } catch {
      // ignore if fulfillment_jobs not yet migrated
    }

    try {
      revalidatePath("/dashboard/orders");
      revalidatePath("/dashboard/home");
    } catch {
      // ignore
    }

    return NextResponse.json({
      success: true,
      deliveredAt: nowIso,
      message: "Card marked as delivered successfully.",
    });
  } catch (err: any) {
    console.error("[User Deliver API] Unexpected error:", err);
    return NextResponse.json(
      { error: err.message || "Failed to confirm delivery" },
      { status: 500 }
    );
  }
}

