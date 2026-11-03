import { NextResponse } from "next/server";
import { requireAdminAuth, requireStaffAuth } from "@/admin/shared/lib/admin-auth";
import type { CompanyWithEmployees, AccountStatus, SubscriptionPlanType } from "@/admin/entities/company/model/types";
import type { AdminEmployee } from "@/admin/entities/employee/model/types";
import { getMembership } from "@/lib/membership";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const auth = await requireStaffAuth(request);
  if (!auth.authorized) {
    return auth.response;
  }

  try {
    const { id } = params;
    const supabase = auth.adminSupabase;

    // 1. Fetch profile and employees in parallel for instant response
    const [profileRes, employeesRes] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", id).single(),
      supabase
        .from("employees")
        .select("*")
        .eq("owner_id", id)
        .order("created_at", { ascending: true }),
    ]);

    const p = profileRes.data;
    if (profileRes.error || !p) {
      return NextResponse.json(
        { error: "Company not found" },
        { status: 404 }
      );
    }

    if (p.is_admin || p.role === "admin" || p.role === "designer" || p.subscription_plan === "none") {
      return NextResponse.json(
        { error: "Staff accounts are operators, not customer companies." },
        { status: 404 }
      );
    }

    if (employeesRes.error) {
      console.warn("[Admin API] Failed fetching employees:", employeesRes.error.message);
    }

    const rawEmployees = employeesRes.data;
    const employees: AdminEmployee[] = (rawEmployees || []).map((e: any) => ({
      id: e.id,
      ownerId: e.owner_id,
      name: e.name,
      designation: e.designation,
      email: e.email,
      phone: e.phone,
      slug: e.slug,
      avatarUrl: e.avatar_url,
      coverUrl: e.cover_url,
      isActive: e.is_active ?? true,
      isPremium: Boolean(e.is_premium),
      subscriptionStartedAt: e.subscription_started_at || e.created_at,
      subscriptionExpiresAt: e.subscription_expires_at || p.membership_expires_at,
      status: e.status || (e.is_active ? (e.is_premium ? "active" : "unassigned") : "suspended"),
      createdAt: e.created_at,
    }));

    // Employee IDs quota & issued count (only active premium employees)
    const premiumEmployees = employees.filter((e) => e.isPremium);
    const premEmpCount = premiumEmployees.length;
    const purchasedCount = (p.purchased_id_count && p.purchased_id_count > premEmpCount) 
      ? Number(p.purchased_id_count) 
      : premEmpCount;

    // Determine latest employee expiry and earliest start date among active premium cards
    let latestEmployeeExpiry: string | null = null;
    let earliestEmployeeStart: string | null = null;
    for (const emp of premiumEmployees) {
      if (emp.subscriptionExpiresAt) {
        if (!latestEmployeeExpiry || new Date(emp.subscriptionExpiresAt).getTime() > new Date(latestEmployeeExpiry).getTime()) {
          latestEmployeeExpiry = emp.subscriptionExpiresAt;
        }
      }
      if (emp.subscriptionStartedAt) {
        if (!earliestEmployeeStart || new Date(emp.subscriptionStartedAt).getTime() < new Date(earliestEmployeeStart).getTime()) {
          earliestEmployeeStart = emp.subscriptionStartedAt;
        }
      }
    }

    const now = Date.now();
    const hasValidEmpExpiry = Boolean(latestEmployeeExpiry && new Date(latestEmployeeExpiry).getTime() > now);

    // Free Trial & Pro Determination (consistent with companies list endpoint)
    void hasValidEmpExpiry;
    const isTrial = p.subscription_plan === "trial";
    const hasCompanyProPlan = getMembership(p).isPaid;

    const plan: SubscriptionPlanType = isTrial
      ? "trial"
      : hasCompanyProPlan
      ? "pro"
      : "free";

    // Primary card count: if company is on Pro or Trial, 1 primary card
    const primaryCardCount = plan === "pro" || plan === "trial" ? 1 : 0;

    // Team cards in use: active premium team members within Pro/Trial company
    const employeeCardsIssued = plan === "pro" || plan === "trial" ? premiumEmployees.length : 0;

    const totalCardsIssued = primaryCardCount + employeeCardsIssued;

    let startedAt: string | null = null;
    let expiresAt: string | null = null;

    if (plan === "trial") {
      startedAt = p.subscription_started_at || p.trial_approved_at || p.created_at;
      expiresAt = p.membership_expires_at;
    } else if (plan === "pro") {
      startedAt = p.subscription_started_at || earliestEmployeeStart || p.created_at;
      if (p.membership_expires_at) {
        expiresAt = p.membership_expires_at;
      } else if (latestEmployeeExpiry) {
        expiresAt = latestEmployeeExpiry;
      } else if (p.created_at) {
        expiresAt = new Date(new Date(p.created_at).getTime() + 365 * 24 * 60 * 60 * 1000).toISOString();
      }
    }

    const company: CompanyWithEmployees = {
      id: p.id,
      businessName: p.business_name || p.username || "Unnamed Business",
      ownerName: p.owner_name || "Owner",
      email: p.email,
      phone: p.phone,
      phoneNumber: p.phone,
      username: p.username,
      slug: p.slug || p.username || p.id,
      status: (p.status as AccountStatus) || "active",
      subscriptionPlan: plan,
      primaryCardCount,
      purchasedIdCount: purchasedCount,
      assignedIdCount: employees.length,
      totalCardsIssued,
      subscriptionStartedAt: startedAt,
      membershipExpiresAt: expiresAt,
      createdAt: p.created_at,
      avatarUrl: p.avatar_url,
      logoUrl: p.logo_url,
      employees,

      // 100-Day Free Trial details
      trialStatus: p.trial_status || "none",
      trialCouponCode: p.trial_coupon_code || null,
      trialRequestedAt: p.trial_requested_at || null,
      trialApprovedAt: p.trial_approved_at || null,
      trialExtensionDays: p.trial_extension_days || 0,
      trialFollowUpMilestone: p.trial_follow_up_milestone || 0,
      trialFollowUpStatus: (p.trial_follow_up_status as "unattended" | "attended") || "unattended",
      trialFollowUpNotes: p.trial_follow_up_notes || "",
    };

    return NextResponse.json({ company });
  } catch (err: any) {
    console.error("[Admin API] Error in company detail:", err);
    return NextResponse.json(
      { error: err.message || "Failed to fetch company" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  const auth = await requireAdminAuth(request);
  if (!auth.authorized) {
    return auth.response;
  }

  try {
    const { id } = params;
    const supabase = auth.adminSupabase;

    // 1. Delete associated data
    await supabase.from("employees").delete().eq("owner_id", id);
    await supabase.from("cards").delete().eq("profile_id", id);
    await supabase.from("posts").delete().eq("profile_id", id);
    await supabase.from("reviews").delete().eq("profile_id", id);

    // 2. Delete profile
    const { error: profileDeleteError } = await supabase
      .from("profiles")
      .delete()
      .eq("id", id);

    if (profileDeleteError) {
      return NextResponse.json(
        { error: profileDeleteError.message },
        { status: 500 }
      );
    }

    // 3. If service role is available, remove from auth.users as well
    if (process.env.SUPABASE_SERVICE_ROLE_KEY && "auth" in supabase && (supabase as any).auth?.admin) {
      try {
        await (supabase as any).auth.admin.deleteUser(id);
      } catch (authErr) {
        console.warn("[Admin API] Could not delete from auth.users:", authErr);
      }
    }

    return NextResponse.json({ success: true, message: "Company deleted successfully" });
  } catch (err: any) {
    console.error("[Admin API] Error deleting company:", err);
    return NextResponse.json(
      { error: err.message || "Failed to delete company" },
      { status: 500 }
    );
  }
}
