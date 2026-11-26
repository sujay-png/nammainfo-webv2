import { NextResponse } from "next/server";
import { requireAdminAuth } from "@/admin/shared/lib/admin-auth";
import { createStaffNotification } from "@/lib/fulfillment/service";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const auth = await requireAdminAuth(request);
  if (!auth.authorized) {
    return auth.response;
  }

  try {
    const { id: withdrawalId } = params;
    const supabase = auth.adminSupabase;

    // 1. Fetch withdrawal
    const { data: withdrawal, error: fetchErr } = await supabase
      .from("campaign_withdrawals")
      .select("*")
      .eq("id", withdrawalId)
      .single();

    if (fetchErr || !withdrawal) {
      return NextResponse.json({ error: "Withdrawal request not found" }, { status: 404 });
    }

    if (withdrawal.status === "transferred") {
      return NextResponse.json(
        { error: "This withdrawal has already been transferred" },
        { status: 400 }
      );
    }

    const transferAmount = Number(withdrawal.amount) || 0;
    const now = new Date().toISOString();

    // 2. Mark withdrawal as transferred
    const { error: updateErr } = await supabase
      .from("campaign_withdrawals")
      .update({
        status: "transferred",
        transferred_at: now,
        transferred_by: auth.userId,
      })
      .eq("id", withdrawalId);

    if (updateErr) {
      console.error("[Withdrawal Transfer API] Error updating withdrawal:", updateErr);
      return NextResponse.json({ error: updateErr.message }, { status: 500 });
    }

    // 3. Increment amount_transferred on the campaign manager's converted referrals
    //    Distribute transferAmount across converted referrals until fully accounted for
    const { data: convertedRefs } = await supabase
      .from("referrals")
      .select("id, amount_converted, amount_transferred")
      .eq("campaign_manager_id", withdrawal.campaign_manager_id)
      .gt("amount_converted", 0)
      .order("created_at", { ascending: true });

    let remainingToAttribute = transferAmount;
    if (convertedRefs && convertedRefs.length > 0) {
      for (const ref of convertedRefs) {
        if (remainingToAttribute <= 0) break;
        const currentTransferred = Number(ref.amount_transferred) || 0;
        const currentConverted = Number(ref.amount_converted) || 0;
        const availableInRef = Math.max(0, currentConverted - currentTransferred);

        if (availableInRef > 0) {
          const toAdd = Math.min(availableInRef, remainingToAttribute);
          await supabase
            .from("referrals")
            .update({
              amount_transferred: currentTransferred + toAdd,
              updated_at: now,
            })
            .eq("id", ref.id);
          remainingToAttribute -= toAdd;
        }
      }
    }

    await createStaffNotification(supabase, {
      recipientRole: "partner",
      recipientUserId: withdrawal.campaign_manager_id,
      eventType: "partner_withdrawal_transferred",
      severity: "info",
      title: `Payout Transferred: ₹${transferAmount.toLocaleString("en-IN")}`,
      message: `Admin transferred your withdrawal of ₹${transferAmount.toLocaleString("en-IN")}.`,
      entityType: "withdrawal",
      entityId: withdrawalId,
    });

    return NextResponse.json({
      success: true,
      message: `Successfully transferred ₹${transferAmount.toLocaleString("en-IN")}.`,
      withdrawalId,
    });
  } catch (err: any) {
    console.error("[Withdrawal Transfer API] Exception:", err);
    return NextResponse.json(
      { error: err.message || "Failed to process transfer" },
      { status: 500 }
    );
  }
}
