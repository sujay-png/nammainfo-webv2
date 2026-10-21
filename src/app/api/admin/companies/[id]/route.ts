import { NextResponse } from "next/server";
import { getAdminSupabase } from "@/admin/shared/lib/supabase-admin";
import type { CompanyWithEmployees, AccountStatus, SubscriptionPlanType } from "@/admin/entities/company/model/types";
import type { AdminEmployee } from "@/admin/entities/employee/model/types";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const supabase = await getAdminSupabase();

    // 1. Fetch profile
    const { data: p, error: profileError } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", id)
      .single();

    if (profileError || !p) {
      return NextResponse.json(
        { error: "Company not found" },
        { status: 404 }
      );
    }

    // 2. Fetch employees for this company
    const { data: rawEmployees, error: employeesError } = await supabase
      .from("employees")
      .select("*")
      .eq("owner_id", id)
      .order("created_at", { ascending: true });

    if (employeesError) {
      console.warn("[Admin API] Failed fetching employees:", employeesError.message);
    }

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
    const employeeCardsIssued = employees.filter((e) => e.isPremium).length;
    const purchasedCount = (p.purchased_id_count && p.purchased_id_count > employeeCardsIssued) 
      ? Number(p.purchased_id_count) 
      : employeeCardsIssued;

    // Primary card count
    let primaryCardCount = 0;
    if (p.subscription_plan === "free") {
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

    const totalCardsIssued = primaryCardCount + employeeCardsIssued;

    // Plan mapping: strictly "free" | "pro"
    let plan: SubscriptionPlanType = "free";
    if (p.subscription_plan === "free") {
      plan = "free";
    } else if (
      p.subscription_plan === "pro" ||
      p.subscription_plan === "starter" ||
      p.subscription_plan === "enterprise" ||
      p.subscription_plan === "lifetime"
    ) {
      plan = "pro";
    } else if (p.is_member === true && p.membership_expires_at) {
      plan = "pro";
    } else {
      plan = "free";
    }

    let startedAt: string | null = null;
    let expiresAt: string | null = null;

    if (plan === "pro") {
      startedAt = p.subscription_started_at || p.created_at;
      expiresAt = p.membership_expires_at || (p.created_at ? new Date(new Date(p.created_at).getTime() + 365 * 24 * 60 * 60 * 1000).toISOString() : null);
    }

    const company: CompanyWithEmployees = {
      id: p.id,
      businessName: p.business_name || p.username || "Unnamed Business",
      ownerName: p.owner_name || "Owner",
      email: p.email,
      phone: p.phone,
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
  try {
    const { id } = params;
    const supabase = await getAdminSupabase();

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
