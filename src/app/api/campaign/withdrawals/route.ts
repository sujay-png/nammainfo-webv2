import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { createAdminClient } from "@/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET() {
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

    const { data: withdrawals, error } = await admin
      .from("campaign_withdrawals")
      .select("*")
      .eq("campaign_manager_id", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ withdrawals: withdrawals || [] });
  } catch (err: any) {
    console.error("[Campaign Withdrawals GET] Exception:", err);
    return NextResponse.json(
      { error: err.message || "Failed to load withdrawals" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
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

    // Verify manager
    const { data: profile } = await admin
      .from("profiles")
      .select("id, is_partner, is_campaign_manager, role")
      .eq("id", user.id)
      .single();

    const isPartner = Boolean(
      (profile as any)?.is_partner ||
      profile?.is_campaign_manager ||
      profile?.role === "partner" ||
      profile?.role === "campaign_manager"
    );

    if (!profile || !isPartner) {
      return NextResponse.json({ error: "Forbidden: Not an authorized Partner" }, { status: 403 });
    }

    const body = await req.json();
    const amount = Number(body.amount);
    const payoutMethod: "bank_transfer" | "upi" = body.payoutMethod;
    const accountDetails = body.accountDetails || {};

    if (!amount || isNaN(amount) || amount <= 0) {
      return NextResponse.json({ error: "Please enter a valid withdrawal amount" }, { status: 400 });
    }

    if (payoutMethod !== "bank_transfer" && payoutMethod !== "upi") {
      return NextResponse.json({ error: "Please choose Bank Transfer or UPI" }, { status: 400 });
    }

    if (payoutMethod === "bank_transfer") {
      if (!accountDetails.account_number || !accountDetails.ifsc) {
        return NextResponse.json(
          { error: "Account Number and IFSC Code are required for Bank Transfer" },
          { status: 400 }
        );
      }
    } else if (payoutMethod === "upi") {
      if (!accountDetails.upi_id) {
        return NextResponse.json(
          { error: "UPI ID or UPI Mobile Number is required" },
          { status: 400 }
        );
      }
    }

    // Calculate current available balance
    const { data: referrals } = await admin
      .from("referrals")
      .select("amount_converted")
      .eq("campaign_manager_id", user.id);

    const totalConverted = (referrals || []).reduce(
      (sum, r) => sum + (Number(r.amount_converted) || 0),
      0
    );

    const { data: withdrawals } = await admin
      .from("campaign_withdrawals")
      .select("amount, status")
      .eq("campaign_manager_id", user.id);

    let totalTransferredOrPending = 0;
    (withdrawals || []).forEach((w) => {
      if (w.status === "transferred" || w.status === "pending") {
        totalTransferredOrPending += Number(w.amount) || 0;
      }
    });

    const availableBalance = Math.max(0, totalConverted - totalTransferredOrPending);

    if (amount > availableBalance) {
      return NextResponse.json(
        {
          error: `Insufficient withdrawable balance. Available: ₹${availableBalance.toLocaleString(
            "en-IN"
          )}`,
        },
        { status: 400 }
      );
    }

    // Insert withdrawal request
    const { data: newWithdrawal, error: insertErr } = await admin
      .from("campaign_withdrawals")
      .insert({
        campaign_manager_id: user.id,
        amount,
        payout_method: payoutMethod,
        account_details: accountDetails,
        status: "pending",
      })
      .select()
      .single();

    if (insertErr) {
      console.error("[Campaign Withdrawals POST] Error inserting:", insertErr);
      return NextResponse.json({ error: insertErr.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      withdrawal: newWithdrawal,
      message: "Withdrawal request submitted successfully. It will be reviewed by admin.",
    });
  } catch (err: any) {
    console.error("[Campaign Withdrawals POST] Exception:", err);
    return NextResponse.json(
      { error: err.message || "Failed to submit withdrawal request" },
      { status: 500 }
    );
  }
}
