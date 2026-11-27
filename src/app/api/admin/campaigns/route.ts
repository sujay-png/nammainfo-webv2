import { NextResponse } from "next/server";
import { requireAdminAuth } from "@/admin/shared/lib/admin-auth";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await requireAdminAuth(request);
  if (!auth.authorized) {
    return auth.response;
  }

  try {
    const supabase = auth.adminSupabase;

    // 1. Fetch all campaign managers
    const { data: managers, error: mgrError } = await supabase
      .from("profiles")
      .select("id, business_name, owner_name, email, phone, created_at, status, is_campaign_manager, role")
      .or("is_campaign_manager.eq.true,role.eq.campaign_manager")
      .order("created_at", { ascending: false });

    if (mgrError) {
      console.error("[Admin Campaigns] Error fetching managers:", mgrError);
      return NextResponse.json({ error: mgrError.message }, { status: 500 });
    }

    const managerList = managers || [];
    const managerIds = managerList.map((m) => m.id);

    // 2. Fetch all coupons
    const { data: coupons } = await supabase
      .from("campaign_coupons")
      .select("campaign_manager_id, code, discount_amount, reward_amount")
      .order("discount_amount", { ascending: true });

    const couponMap = new Map<string, string[]>();
    (coupons || []).forEach((c) => {
      const list = couponMap.get(c.campaign_manager_id) || [];
      list.push(c.code);
      couponMap.set(c.campaign_manager_id, list);
    });

    // 3. Fetch all referrals
    const { data: allReferrals } = await supabase
      .from("referrals")
      .select("id, campaign_manager_id, referred_user_id, status, amount_pending, amount_converted, amount_transferred, created_at");

    const referralsByManager = new Map<string, any[]>();
    (allReferrals || []).forEach((r) => {
      const list = referralsByManager.get(r.campaign_manager_id) || [];
      list.push(r);
      referralsByManager.set(r.campaign_manager_id, list);
    });

    // 4. Fetch all withdrawals
    const { data: allWithdrawals } = await supabase
      .from("campaign_withdrawals")
      .select("*")
      .order("created_at", { ascending: false });

    const withdrawalsByManager = new Map<string, any[]>();
    const pendingWithdrawalByManager = new Map<string, any>();
    (allWithdrawals || []).forEach((w) => {
      const list = withdrawalsByManager.get(w.campaign_manager_id) || [];
      list.push(w);
      withdrawalsByManager.set(w.campaign_manager_id, list);

      if (w.status === "pending" && !pendingWithdrawalByManager.has(w.campaign_manager_id)) {
        pendingWithdrawalByManager.set(w.campaign_manager_id, w);
      }
    });

    // 5. Aggregate KPIs and map managers
    let overallPending = 0;
    let overallConverted = 0;
    let overallTransferred = 0;

    const formattedManagers = managerList.map((m) => {
      const refs = referralsByManager.get(m.id) || [];
      const managerWithdrawals = withdrawalsByManager.get(m.id) || [];

      let pending = 0;
      let convertedTotal = 0;

      refs.forEach((r) => {
        pending += Number(r.amount_pending) || 0;
        convertedTotal += Number(r.amount_converted) || 0;
      });

      let transferred = 0;
      managerWithdrawals.forEach((w) => {
        if (w.status === "transferred") {
          transferred += Number(w.amount) || 0;
        }
      });

      // Available converted balance awaiting transfer
      const converted = Math.max(0, convertedTotal - transferred);

      overallPending += pending;
      overallConverted += converted;
      overallTransferred += transferred;

      const pendingWithdrawal = pendingWithdrawalByManager.get(m.id) || null;

      return {
        id: m.id,
        name: m.owner_name || m.business_name || "Campaign Manager",
        businessName: m.business_name || "Business",
        email: m.email || "",
        phone: m.phone || "",
        couponCode: couponMap.get(m.id)?.join(", ") || null,
        referralCount: refs.length,
        amountPending: pending,
        amountConverted: converted,
        amountTransferred: transferred,
        createdAt: m.created_at,
        pendingWithdrawal,
      };
    });

    // Enrich all transactions with manager names for overall transaction history
    const managerNameMap = new Map<string, string>();
    managerList.forEach((m) => {
      managerNameMap.set(m.id, m.owner_name || m.business_name || "Manager");
    });

    const overallTransactions = (allWithdrawals || []).map((w) => ({
      ...w,
      managerName: managerNameMap.get(w.campaign_manager_id) || "Campaign Manager",
    }));

    return NextResponse.json({
      kpis: {
        campaignOwnersCount: managerList.length,
        totalReferrals: (allReferrals || []).length,
        totalAmountPending: overallPending,
        totalAmountConverted: overallConverted,
        totalAmountTransferred: overallTransferred,
      },
      managers: formattedManagers,
      overallTransactions,
    });
  } catch (err: any) {
    console.error("[Admin Campaigns GET] Exception:", err);
    return NextResponse.json(
      { error: err.message || "Failed to load admin campaigns" },
      { status: 500 }
    );
  }
}
