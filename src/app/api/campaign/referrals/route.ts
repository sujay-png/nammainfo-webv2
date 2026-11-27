import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { createAdminClient } from "@/supabase/admin";
import { getDaysRemaining } from "@/admin/shared/lib/formatters";

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

    // Verify partner / campaign manager
    const { data: managerProfile } = await admin
      .from("profiles")
      .select(
        "id, is_partner, is_campaign_manager, role, account_type, business_name, owner_name, email, phone, slug, username"
      )
      .eq("id", user.id)
      .single();

    const isPartner = Boolean(
      (managerProfile as any)?.is_partner ||
      managerProfile?.is_campaign_manager ||
      managerProfile?.role === "partner" ||
      managerProfile?.role === "campaign_manager"
    );

    if (!managerProfile || !isPartner) {
      return NextResponse.json({ error: "Forbidden: Not an authorized Partner" }, { status: 403 });
    }

    // 1. Fetch all referrals for this manager
    const { data: rawReferrals, error: refError } = await admin
      .from("referrals")
      .select("*")
      .eq("campaign_manager_id", user.id)
      .order("created_at", { ascending: false });

    if (refError) {
      console.error("[Campaign Referrals API] Error fetching referrals:", refError);
      return NextResponse.json({ error: refError.message }, { status: 500 });
    }

    const referrals = rawReferrals || [];
    const refereeUserIds = referrals.map((r) => r.referred_user_id);

    // 2. Fetch profiles of referee users
    let profileMap = new Map<string, any>();
    let employeesMap = new Map<string, any[]>();

    if (refereeUserIds.length > 0) {
      const { data: profiles } = await admin
        .from("profiles")
        .select(
          "id, business_name, owner_name, email, phone, address, city, pincode, gst_number, website, avatar_url, subscription_plan, membership_expires_at, subscription_started_at, status, trial_status, trial_approved_at, card_process, created_at, slug, username"
        )
        .in("id", refereeUserIds);

      if (profiles) {
        profiles.forEach((p) => profileMap.set(p.id, p));
      }

      const { data: employees } = await admin
        .from("employees")
        .select("id, owner_id, name, designation, phone, email, is_active, status, plan")
        .in("owner_id", refereeUserIds);

      if (employees) {
        employees.forEach((emp) => {
          const list = employeesMap.get(emp.owner_id) || [];
          list.push(emp);
          employeesMap.set(emp.owner_id, list);
        });
      }
    }

    // 3. Fetch withdrawals to determine total transferred
    const { data: withdrawals } = await admin
      .from("campaign_withdrawals")
      .select("amount, status")
      .eq("campaign_manager_id", user.id);

    let totalTransferred = 0;
    let pendingWithdrawalTotal = 0;
    if (withdrawals) {
      withdrawals.forEach((w) => {
        if (w.status === "transferred") {
          totalTransferred += Number(w.amount) || 0;
        } else if (w.status === "pending") {
          pendingWithdrawalTotal += Number(w.amount) || 0;
        }
      });
    }

    // 4. Build enriched referrals list and compute KPIs
    let totalPendingAmount = 0;
    let totalConvertedAmount = 0;
    let upcomingRenewalsCount = 0;
    let nextUpcomingRenewal: {
      date: string | null;
      amountYouGet: number;
      userName: string;
      businessName: string;
      daysRemaining: number;
    } | null = null;

    const now = Date.now();
    const sixtyDaysMs = 60 * 24 * 60 * 60 * 1000;

    const enrichedReferrals = referrals.map((r) => {
      const p = profileMap.get(r.referred_user_id) || {};
      const team = employeesMap.get(r.referred_user_id) || [];

      // Determine real-time subscription status: free, trial, pro, expired
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

      const pendingAmount = Number(r.amount_pending) || 0;
      const convertedAmount = Number(r.amount_converted) || 0;
      totalPendingAmount += pendingAmount;
      totalConvertedAmount += convertedAmount;

      // Check upcoming renewal
      if (!isExpired && (currentStatus === "pro" || currentStatus === "trial") && p.membership_expires_at) {
        const expTime = new Date(p.membership_expires_at).getTime();
        const diff = expTime - now;
        if (diff > 0 && diff <= sixtyDaysMs) {
          upcomingRenewalsCount++;
          const amountYouGet = currentStatus === "pro" ? 500 : 0;
          const daysRemaining = Math.ceil(diff / (24 * 60 * 60 * 1000));

          if (!nextUpcomingRenewal || expTime < new Date(nextUpcomingRenewal.date!).getTime()) {
            nextUpcomingRenewal = {
              date: p.membership_expires_at,
              amountYouGet,
              userName: p.owner_name || "User",
              businessName: p.business_name || "Business",
              daysRemaining,
            };
          }
        }
      }

      // Renewal fee for referee to renew: ₹1,999 base + ₹500 per extra card or team
      const teamCount = team.length;
      let renewalAmount = 0;
      if (currentStatus === "pro" || currentStatus === "trial") {
        renewalAmount = 1999 + Math.max(0, teamCount) * 500;
      }

      return {
        id: r.id,
        referredUserId: r.referred_user_id,
        couponCode: r.coupon_code,
        source: r.source,
        referralStatus: r.status, // "pending" | "converted" | "claimed"
        amountPending: pendingAmount,
        amountConverted: convertedAmount,
        amountTransferred: Number(r.amount_transferred) || 0,
        convertedAt: r.converted_at,
        renewalCount: r.renewal_count || 0,
        createdAt: r.created_at,

        // Profile details
        businessName: p.business_name || "Unnamed Business",
        ownerName: p.owner_name || "User",
        email: p.email || "",
        phone: p.phone || "",
        address: p.address || "",
        city: p.city || "",
        pincode: p.pincode || "",
        gstNumber: p.gst_number || "",
        website: p.website || "",
        avatarUrl: p.avatar_url || null,
        slug: p.slug || p.username || "",
        userPlan: currentStatus,
        membershipExpiresAt: p.membership_expires_at || null,
        subscriptionStartedAt: p.subscription_started_at || null,
        renewalAmount,
        cardProcess: p.card_process || {},
        teamCount,
        teamMembers: team.map((t) => ({
          id: t.id,
          name: t.name,
          designation: t.designation,
          phone: t.phone,
          email: t.email,
          isActive: t.is_active,
        })),
      };
    });

    const withdrawableBalance = Math.max(0, totalConvertedAmount - totalTransferred);

    // Resolve public referral slug (preferring live profile username / card slug, and employee path for employee Partners)
    let managerPublicSlug: string = managerProfile.username || managerProfile.slug || "";
    if (!managerPublicSlug) {
      const { data: ownCard } = await admin
        .from("cards")
        .select("public_slug")
        .eq("profile_id", user.id)
        .eq("is_active", true)
        .limit(1)
        .maybeSingle();
      if (ownCard?.public_slug) {
        managerPublicSlug = ownCard.public_slug;
      }
    }
    let employeeDisplayName: string | null = null;
    let isEmployeePartner = managerProfile.account_type === "employee";

    const { data: empRow } = await admin
      .from("employees")
      .select("id, name, slug, owner_id, branch_id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (empRow) {
      isEmployeePartner = true;
      employeeDisplayName = empRow.name;
      const { data: ownerProf } = await admin
        .from("profiles")
        .select("slug, username, business_name")
        .eq("id", empRow.owner_id)
        .maybeSingle();
      const ownerSeg = ownerProf?.username || ownerProf?.slug;
      let branchSeg: string | null = null;
      if (empRow.branch_id) {
        const { data: b } = await admin
          .from("branches")
          .select("slug")
          .eq("id", empRow.branch_id)
          .maybeSingle();
        branchSeg = b?.slug || null;
      }
      if (ownerSeg && empRow.slug) {
        managerPublicSlug = branchSeg
          ? `${ownerSeg}/${branchSeg}/${empRow.slug}`
          : `${ownerSeg}/${empRow.slug}`;
      }
    }

    return NextResponse.json({
      kpis: {
        totalUsers: enrichedReferrals.length,
        upcomingRenewalsCount,
        nextUpcomingRenewal,
        revenueThroughReferrals: totalConvertedAmount,
        amountPending: totalPendingAmount,
        amountTransferred: totalTransferred,
        withdrawableBalance,
        pendingWithdrawalTotal,
      },
      referrals: enrichedReferrals,
      manager: {
        id: managerProfile.id,
        name: employeeDisplayName || managerProfile.owner_name || managerProfile.business_name || "Campaign Manager",
        businessName: managerProfile.business_name,
        email: managerProfile.email,
        phone: managerProfile.phone,
        slug: managerProfile.slug || null,
        username: managerProfile.username || null,
        publicSlug: managerPublicSlug || null,
        isEmployeePartner,
      },
    });
  } catch (err: any) {
    console.error("[Campaign Referrals GET] Exception:", err);
    return NextResponse.json(
      { error: err.message || "Failed to load campaign referrals" },
      { status: 500 }
    );
  }
}
