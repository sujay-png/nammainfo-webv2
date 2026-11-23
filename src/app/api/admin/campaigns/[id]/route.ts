import { NextResponse } from "next/server";
import { requireAdminAuth } from "@/admin/shared/lib/admin-auth";
import { getDaysRemaining } from "@/admin/shared/lib/formatters";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const auth = await requireAdminAuth(request);
  if (!auth.authorized) {
    return auth.response;
  }

  try {
    const { id: managerId } = params;
    const supabase = auth.adminSupabase;

    // 1. Fetch manager profile
    const { data: manager, error: mgrErr } = await supabase
      .from("profiles")
      .select("id, business_name, owner_name, email, phone, address, city, pincode, created_at, status, is_campaign_manager, role")
      .eq("id", managerId)
      .single();

    if (mgrErr || !manager) {
      return NextResponse.json({ error: "Campaign manager not found" }, { status: 404 });
    }

    // 2. Fetch coupon
    const { data: coupon } = await supabase
      .from("campaign_coupons")
      .select("code, discount_amount, reward_amount")
      .eq("campaign_manager_id", managerId)
      .maybeSingle();

    // 3. Fetch referrals for this manager
    const { data: referrals, error: refErr } = await supabase
      .from("referrals")
      .select("*")
      .eq("campaign_manager_id", managerId)
      .order("created_at", { ascending: false });

    if (refErr) {
      return NextResponse.json({ error: refErr.message }, { status: 500 });
    }

    const refList = referrals || [];
    const refereeIds = refList.map((r) => r.referred_user_id);

    // Fetch referee profiles
    let profileMap = new Map<string, any>();
    if (refereeIds.length > 0) {
      const { data: refereeProfiles } = await supabase
        .from("profiles")
        .select("id, business_name, owner_name, email, phone, subscription_plan, membership_expires_at, subscription_started_at, status, trial_status, created_at")
        .in("id", refereeIds);

      (refereeProfiles || []).forEach((p) => profileMap.set(p.id, p));
    }

    const now = Date.now();
    let totalPending = 0;
    let totalConvertedSum = 0;

    const enrichedReferrals = refList.map((r) => {
      const p = profileMap.get(r.referred_user_id) || {};
      const plan = p.subscription_plan || "free";
      const validity = getDaysRemaining(p.membership_expires_at, plan);
      const isExpired =
        plan !== "free" &&
        !validity.isLifetime &&
        (validity.isExpired ||
          p.status === "expired" ||
          (p.membership_expires_at ? new Date(p.membership_expires_at).getTime() <= now : false));

      let currentStatus: "free" | "trial" | "pro" | "expired" = "free";
      if (isExpired) {
        currentStatus = "expired";
      } else if (plan === "pro") {
        currentStatus = "pro";
      } else if (plan === "trial") {
        currentStatus = "trial";
      } else {
        currentStatus = "free";
      }

      const pending = Number(r.amount_pending) || 0;
      const converted = Number(r.amount_converted) || 0;
      totalPending += pending;
      totalConvertedSum += converted;

      return {
        id: r.id,
        referredUserId: r.referred_user_id,
        userName: p.owner_name || "User",
        businessName: p.business_name || "Business",
        email: p.email || "",
        phone: p.phone || "",
        status: currentStatus,
        referralStatus: r.status,
        amountPending: pending,
        amountConverted: converted,
        amountTransferred: Number(r.amount_transferred) || 0,
        membershipExpiresAt: p.membership_expires_at || null,
        createdAt: r.created_at,
        convertedAt: r.converted_at,
        renewalCount: r.renewal_count || 0,
      };
    });

    // 4. Fetch withdrawals
    const { data: withdrawals, error: withErr } = await supabase
      .from("campaign_withdrawals")
      .select("*")
      .eq("campaign_manager_id", managerId)
      .order("created_at", { ascending: false });

    if (withErr) {
      return NextResponse.json({ error: withErr.message }, { status: 500 });
    }

    let totalTransferred = 0;
    let pendingWithdrawal: any = null;

    (withdrawals || []).forEach((w) => {
      if (w.status === "transferred") {
        totalTransferred += Number(w.amount) || 0;
      } else if (w.status === "pending" && !pendingWithdrawal) {
        pendingWithdrawal = w;
      }
    });

    const amountConvertedAvailable = Math.max(0, totalConvertedSum - totalTransferred);

    return NextResponse.json({
      manager: {
        id: manager.id,
        name: manager.owner_name || manager.business_name || "Campaign Manager",
        businessName: manager.business_name || "",
        email: manager.email || "",
        phone: manager.phone || "",
        address: manager.address || "",
        createdAt: manager.created_at,
        couponCode: coupon?.code || null,
      },
      stats: {
        referralCount: enrichedReferrals.length,
        amountPending: totalPending,
        amountConverted: amountConvertedAvailable,
        amountTransferred: totalTransferred,
      },
      pendingWithdrawal,
      referrals: enrichedReferrals,
      withdrawals: withdrawals || [],
    });
  } catch (err: any) {
    console.error("[Admin Campaign Manager Detail GET] Exception:", err);
    return NextResponse.json(
      { error: err.message || "Failed to load campaign manager details" },
      { status: 500 }
    );
  }
}
