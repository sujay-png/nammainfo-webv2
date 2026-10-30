import { NextResponse } from "next/server";
import { requireStaffAuth } from "@/admin/shared/lib/admin-auth";
import type { Company, AdminStats, AccountStatus, SubscriptionPlanType } from "@/admin/entities/company/model/types";
import { calculateProfileCompletion } from "@/lib/profile-completion";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await requireStaffAuth(request);
  if (!auth.authorized) {
    return auth.response;
  }

  try {
    const supabase = auth.adminSupabase;

    // 1. Fetch all profiles
    const { data: profiles, error: profilesError } = await supabase
      .from("profiles")
      .select("*")
      .order("created_at", { ascending: false });

    if (profilesError) {
      console.error("[Admin API] Error fetching profiles:", profilesError);
      return NextResponse.json(
        { error: profilesError.message },
        { status: 500 }
      );
    }

    // 2. Fetch all employees to aggregate assigned ID counts and active cards
    const { data: employees, error: employeesError } = await supabase
      .from("employees")
      .select("id, owner_id, is_premium, is_active, subscription_started_at, subscription_expires_at");

    if (employeesError) {
      console.warn("[Admin API] Warning fetching employees:", employeesError.message);
    }

    const employeeMap = new Map<string, number>();
    const premiumEmployeeMap = new Map<string, number>();
    const employeeExpiryMap = new Map<string, string>();
    const employeeStartMap = new Map<string, string>();
    if (employees) {
      for (const emp of employees) {
        const count = employeeMap.get(emp.owner_id) || 0;
        employeeMap.set(emp.owner_id, count + 1);
        if (emp.is_premium) {
          const premCount = premiumEmployeeMap.get(emp.owner_id) || 0;
          premiumEmployeeMap.set(emp.owner_id, premCount + 1);

          if (emp.subscription_expires_at) {
            const currentExp = employeeExpiryMap.get(emp.owner_id);
            if (!currentExp || new Date(emp.subscription_expires_at).getTime() > new Date(currentExp).getTime()) {
              employeeExpiryMap.set(emp.owner_id, emp.subscription_expires_at);
            }
          }
          if (emp.subscription_started_at) {
            const currentStart = employeeStartMap.get(emp.owner_id);
            if (!currentStart || new Date(emp.subscription_started_at).getTime() < new Date(currentStart).getTime()) {
              employeeStartMap.set(emp.owner_id, emp.subscription_started_at);
            }
          }
        }
      }
    }

    // 3. Fetch cards to know physical/digital cards issued and lost cards
    const { data: cards } = await supabase
      .from("cards")
      .select("id, profile_id, is_active, is_lost");

    const cardMap = new Map<string, number>();
    let lostCardsCount = 0;
    if (cards) {
      for (const card of cards as any[]) {
        const count = cardMap.get(card.profile_id) || 0;
        cardMap.set(card.profile_id, count + 1);
        if (card.is_lost === true) {
          lostCardsCount++;
        }
      }
    }

    const now = Date.now();
    // 30 days renewal threshold as requested
    const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;

    let premiumCompaniesCount = 0;
    let totalCardsIssuedAll = 0;
    let totalPrimaryCardsAll = 0;
    let totalEmployeeCardsAll = 0;
    let totalAssignedIdsAll = 0;
    let totalCardsInUseAll = 0;
    let upcomingRenewalsCount = 0;
    let expiredCardsCount = 0;
    let suspendedCount = 0;
    let pendingTrialsCount = 0;
    let activeTrialsCount = 0;

    // Strictly filter out platform administrator & internal agency accounts so they are not treated as customer companies
    const customerProfiles = (profiles || []).filter(
      (p: any) =>
        !p.is_admin &&
        p.email !== "aksharadigitalindia@outlook.com" &&
        p.email !== "adithyaputhraya@gmail.com"
    );

    const companies: Company[] = customerProfiles.map((p: any) => {
      const assignedCount = employeeMap.get(p.id) || 0;
      const premEmpCount = premiumEmployeeMap.get(p.id) || 0;
      const latestEmpExpiry = employeeExpiryMap.get(p.id);
      const hasValidEmpExpiry = Boolean(latestEmpExpiry && new Date(latestEmpExpiry).getTime() > now);

      // Free Trial & Pro Determination
      const isTrial = p.subscription_plan === "trial";
      if (p.trial_status === "pending_approval") {
        pendingTrialsCount++;
      }

      const hasCompanyProPlan = Boolean(
        p.subscription_plan === "pro" ||
        p.subscription_plan === "starter" ||
        p.subscription_plan === "enterprise" ||
        p.subscription_plan === "lifetime" ||
        (p.is_member === true && p.membership_expires_at && new Date(p.membership_expires_at).getTime() > now) ||
        (p.membership_expires_at && new Date(p.membership_expires_at).getTime() > now) ||
        hasValidEmpExpiry
      );

      const plan: SubscriptionPlanType = isTrial
        ? "trial"
        : hasCompanyProPlan
        ? "pro"
        : "free";

      // 1. Primary Card: Pro and Free Trial plans both grant 1 primary card
      const primaryCardCount = plan === "pro" || plan === "trial" ? 1 : 0;

      // 2. Team Cards: Only active premium team members count as team cards
      const employeeCardsIssued = plan === "pro" || plan === "trial" ? premEmpCount : 0;

      // 3. Purchased ID Count
      const purchasedCount = (p.purchased_id_count && p.purchased_id_count > employeeCardsIssued) 
        ? Number(p.purchased_id_count) 
        : employeeCardsIssued;

      // Total cards issued for this company
      const totalCardsIssued = primaryCardCount + employeeCardsIssued;

      // Expiry dates: Free plan has NO subscription expiry
      let expiresAt: string | null = null;
      let startedAt: string | null = null;

      if (plan === "trial") {
        startedAt = p.subscription_started_at || p.trial_approved_at || p.created_at;
        expiresAt = p.membership_expires_at;
      } else if (plan === "pro") {
        startedAt = p.subscription_started_at || employeeStartMap.get(p.id) || p.created_at;
        if (p.membership_expires_at) {
          expiresAt = p.membership_expires_at;
        } else if (latestEmpExpiry) {
          expiresAt = latestEmpExpiry;
        } else if (p.created_at) {
          const joined = new Date(p.created_at).getTime();
          expiresAt = new Date(joined + 365 * 24 * 60 * 60 * 1000).toISOString();
        }
      }

      // Status mapping: determine active/expired dynamically based on valid subscription dates
      let status: AccountStatus = (p.status as AccountStatus) || "active";
      if (expiresAt && (plan === "pro" || plan === "trial")) {
        const expiryDate = new Date(expiresAt);
        const expiryTime = expiryDate.getTime();
        const diff = expiryTime - now;

        if (diff <= 0) {
          if (status !== "suspended") {
            status = "expired";
          }
          expiredCardsCount++;
        } else {
          if (status !== "suspended") {
            status = "active";
          }
          if (diff <= thirtyDaysMs) {
            upcomingRenewalsCount++;
          }
        }
      } else if (plan === "free") {
        if (status !== "suspended") {
          status = "active";
        }
      } else if (status === "expired") {
        expiredCardsCount++;
      }

      if (status === "suspended") {
        suspendedCount++;
      }

      const isPremium = plan !== "free";
      if (isPremium) {
        premiumCompaniesCount++;
        if (plan === "trial" && status === "active") {
          activeTrialsCount++;
        }
      }

      // Cards in use: count active cards for non-suspended, non-expired companies
      if (status !== "suspended" && status !== "expired") {
        totalCardsInUseAll += totalCardsIssued;
        totalPrimaryCardsAll += primaryCardCount;
        totalEmployeeCardsAll += employeeCardsIssued;
      }

      totalCardsIssuedAll += totalCardsIssued;
      totalAssignedIdsAll += assignedCount;

      const completion = calculateProfileCompletion(p);

      return {
        id: p.id,
        businessName: p.business_name || p.username || "Unnamed Business",
        ownerName: p.owner_name || "Owner",
        email: p.email || null,
        phone: p.phone || null,
        phoneNumber: p.phone || null,
        username: p.username || null,
        slug: p.slug || p.username || p.id,
        status,
        subscriptionPlan: plan,
        primaryCardCount,
        purchasedIdCount: purchasedCount,
        assignedIdCount: assignedCount,
        totalCardsIssued,
        subscriptionStartedAt: startedAt,
        membershipExpiresAt: expiresAt,
        createdAt: p.created_at,
        avatarUrl: p.avatar_url,
        logoUrl: p.logo_url,
        followUpStatus: (p.follow_up_status as "unattended" | "attended") || "unattended",
        followUpNotes: p.follow_up_notes || "",

        // 100-Day Free Trial details
        trialStatus: p.trial_status || "none",
        trialCouponCode: p.trial_coupon_code || null,
        trialRequestedAt: p.trial_requested_at || null,
        trialApprovedAt: p.trial_approved_at || null,
        trialExtensionDays: p.trial_extension_days || 0,
        trialFollowUpMilestone: p.trial_follow_up_milestone || 0,
        trialFollowUpStatus: (p.trial_follow_up_status as "unattended" | "attended") || "unattended",
        trialFollowUpNotes: p.trial_follow_up_notes || "",
        profileCompletionPercentage: completion.percentage,
      };
    });

    const stats: AdminStats = {
      totalCardsInUse: totalCardsInUseAll,
      upcomingRenewalsCount,
      expiredCardsCount,
      lostCardsCount,
      totalCompanies: companies.length,
      premiumCompaniesCount,
      totalCardsIssued: totalCardsIssuedAll,
      totalPrimaryCards: totalPrimaryCardsAll,
      totalEmployeeIds: totalEmployeeCardsAll,
      totalPurchasedIds: totalEmployeeCardsAll,
      totalAssignedIds: totalAssignedIdsAll,
      expiringSoonCount: upcomingRenewalsCount,
      suspendedCount,
      pendingTrialsCount,
      activeTrialsCount,
    };

    return NextResponse.json({
      companies,
      stats,
    });
  } catch (err: any) {
    console.error("[Admin API] Unexpected error:", err);
    return NextResponse.json(
      { error: err.message || "Internal server error" },
      { status: 500 }
    );
  }
}
