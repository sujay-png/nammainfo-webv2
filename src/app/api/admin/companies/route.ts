import { NextResponse } from "next/server";
import { requireAdminAuth } from "@/admin/shared/lib/admin-auth";
import type { Company, AdminStats, AccountStatus, SubscriptionPlanType } from "@/admin/entities/company/model/types";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await requireAdminAuth(request);
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
    const fifteenDaysMs = 15 * 24 * 60 * 60 * 1000;

    let premiumCompaniesCount = 0;
    let totalCardsIssuedAll = 0;
    let totalPrimaryCardsAll = 0;
    let totalEmployeeCardsAll = 0;
    let totalAssignedIdsAll = 0;
    let totalCardsInUseAll = 0;
    let upcomingRenewalsCount = 0;
    let expiredCardsCount = 0;
    let suspendedCount = 0;

    // Strictly filter out platform administrator accounts so they are not treated as customer companies
    const customerProfiles = (profiles || []).filter(
      (p: any) => !p.is_admin && p.email !== "aksharadigitalindia@outlook.com"
    );

    const companies: Company[] = customerProfiles.map((p: any) => {
      const assignedCount = employeeMap.get(p.id) || 0;
      const employeeCardsIssued = premiumEmployeeMap.get(p.id) || 0;
      const purchasedCount = (p.purchased_id_count && p.purchased_id_count > employeeCardsIssued) 
        ? Number(p.purchased_id_count) 
        : employeeCardsIssued;

      // Determine if company has an active Pro subscription:
      // Either by profile subscription tier OR by having active premium team cards issued
      const hasActiveCards = employeeCardsIssued > 0;
      const hasActiveMembership = Boolean(
        p.subscription_plan === "pro" ||
        p.subscription_plan === "starter" ||
        p.subscription_plan === "enterprise" ||
        p.subscription_plan === "lifetime" ||
        (p.is_member === true && p.membership_expires_at)
      );

      const isPro = hasActiveMembership || hasActiveCards;
      const plan: SubscriptionPlanType = isPro ? "pro" : "free";

      // Primary cards count:
      let primaryCardCount = 0;
      if (plan === "free") {
        primaryCardCount = 0;
      } else if (p.primary_card_count !== undefined && p.primary_card_count !== null) {
        primaryCardCount = Number(p.primary_card_count);
      } else if (
        p.subscription_plan === "pro" ||
        p.subscription_plan === "lifetime" ||
        p.card_designed === true
      ) {
        primaryCardCount = 1;
      }

      // Total cards issued for this company
      const totalCardsIssued = primaryCardCount + employeeCardsIssued;

      // Expiry dates: Free plan has NO subscription expiry
      let expiresAt: string | null = null;
      let startedAt: string | null = null;

      if (plan === "pro") {
        startedAt = p.subscription_started_at || employeeStartMap.get(p.id) || p.created_at;
        if (p.membership_expires_at) {
          expiresAt = p.membership_expires_at;
        } else if (employeeExpiryMap.get(p.id)) {
          expiresAt = employeeExpiryMap.get(p.id)!;
        } else if (p.created_at) {
          const joined = new Date(p.created_at).getTime();
          expiresAt = new Date(joined + 365 * 24 * 60 * 60 * 1000).toISOString();
        }
      }

      // Status mapping
      let status: AccountStatus = (p.status as AccountStatus) || "active";
      if (expiresAt && plan === "pro") {
        const expiryDate = new Date(expiresAt);
        const expiryTime = expiryDate.getTime();
        const diff = expiryTime - now;

        if (diff <= 0) {
          if (status !== "suspended") {
            status = "expired";
          }
          expiredCardsCount++;
        } else if (diff <= fifteenDaysMs) {
          upcomingRenewalsCount++;
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
      }

      // Cards in use: count active cards for non-suspended, non-expired companies
      if (status !== "suspended" && status !== "expired" && totalCardsIssued > 0) {
        totalCardsInUseAll += totalCardsIssued;
      }

      totalPrimaryCardsAll += primaryCardCount;
      totalEmployeeCardsAll += employeeCardsIssued;
      totalCardsIssuedAll += totalCardsIssued;
      totalAssignedIdsAll += assignedCount;

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
