"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Shield } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { AdminHeader } from "@/admin/widgets/admin-header/ui/AdminHeader";
import { AdminSidebar } from "@/admin/widgets/admin-sidebar/ui/AdminSidebar";
import {
  KpiMetricsGrid,
  type AdminViewFilter,
} from "@/admin/widgets/kpi-metrics/ui/KpiMetricsGrid";
import { CompaniesTable } from "@/admin/widgets/companies-table/ui/CompaniesTable";
import { UpcomingRenewalsTable } from "@/admin/widgets/upcoming-renewals/ui/UpcomingRenewalsTable";
import { ExpiredCardsTable } from "@/admin/widgets/expired-cards/ui/ExpiredCardsTable";
import { PendingTrialsTable } from "@/admin/widgets/pending-trials/ui/PendingTrialsTable";
import { FreeTrialsTable } from "@/admin/widgets/free-trials/ui/FreeTrialsTable";
import { CompanyFiltersBar } from "@/admin/features/company-filters/ui/CompanyFiltersBar";
import { CompanyDetailModal } from "@/admin/widgets/company-detail-modal/ui/CompanyDetailModal";
import { DeleteCompanyModal } from "@/admin/features/delete-company/ui/DeleteCompanyModal";
import { AdminOrdersView } from "@/admin/views/AdminOrdersView";
import { DesignerDashboardView } from "@/admin/views/DesignerDashboardView";
import { StaffAccountsView } from "@/admin/widgets/staff-accounts/ui/StaffAccountsView";
import { fetchAdminCompanies, updateCompanyValidity } from "@/admin/entities/company/api/company-api";
import { fetchAdminOrders } from "@/admin/entities/order/api/order-api";
import { getDaysRemaining } from "@/admin/shared/lib/formatters";
import type {
  Company,
  AdminStats,
  CompanyFilters,
  SubscriptionPlanType,
  AccountStatus,
} from "@/admin/entities/company/model/types";

export const AdminDashboardView: React.FC = () => {
  const router = useRouter();
  const [authLoading, setAuthLoading] = useState(true);
  const [currentTab, setCurrentTab] = useState<string>("overview");
  const [companies, setCompanies] = useState<Company[]>([]);
  const [stats, setStats] = useState<AdminStats>({
    totalCompanies: 0,
    premiumCompaniesCount: 0,
    totalCardsIssued: 0,
    totalPrimaryCards: 0,
    totalEmployeeIds: 0,
    totalPurchasedIds: 0,
    totalAssignedIds: 0,
    expiringSoonCount: 0,
    suspendedCount: 0,
    totalCardsInUse: 0,
    upcomingRenewalsCount: 0,
    expiredCardsCount: 0,
    lostCardsCount: 0,
    pendingTrialsCount: 0,
    activeTrialsCount: 0,
  });
  const [loading, setLoading] = useState(true);

  // Active top KPI filter view: "all" | "pending_trials" | "upcoming_renewals" | "expired"
  const [activeView, setActiveView] = useState<AdminViewFilter>("all");

  // Filters state for all companies
  const [filters, setFilters] = useState<CompanyFilters>({
    search: "",
    tab: "all",
  });

  // Modal states
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Company | null>(null);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [pendingOrdersCount, setPendingOrdersCount] = useState<number>(0);
  const [userRole, setUserRole] = useState<"admin" | "designer">("admin");

  const [unauthorizedEmail, setUnauthorizedEmail] = useState<string | null>(null);

  // Strict Client-Side Admin / Designer Auth Verification
  const getLoginUrl = useCallback(() => {
    const isSubdomain =
      typeof window !== "undefined" &&
      (window.location.hostname.startsWith("admin.") ||
        window.location.hostname.startsWith("admin.localhost"));
    return isSubdomain ? "/login" : "/admin/login";
  }, []);

  useEffect(() => {
    const checkAdminAuth = async () => {
      try {
        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          router.replace(getLoginUrl());
          return;
        }

        let profile: any = null;
        const { data: profileWithRole, error: profileError } = await supabase
          .from("profiles")
          .select("is_admin, role")
          .eq("id", user.id)
          .maybeSingle();

        if (profileError) {
          console.warn("Could not check role column, checking is_admin:", profileError.message);
          const { data: fallbackProfile } = await supabase
            .from("profiles")
            .select("is_admin")
            .eq("id", user.id)
            .maybeSingle();
          profile = fallbackProfile;
        } else {
          profile = profileWithRole;
        }

        const isStaff = Boolean(profile?.is_admin || profile?.role === "admin" || profile?.role === "designer");

        if (!profile || !isStaff) {
          setUnauthorizedEmail(user.email || "Current User");
          setAuthLoading(false);
          return;
        }

        const role = profile.role || (profile.is_admin ? "admin" : "user");
        setUserRole(role === "designer" ? "designer" : "admin");
        setAuthLoading(false);
      } catch (err) {
        console.error("Auth check failed:", err);
        router.replace(getLoginUrl());
      }
    };

    checkAdminAuth();
  }, [router, getLoginUrl]);

  const loadData = useCallback(async (options?: { silent?: boolean }) => {
    if (!options?.silent) {
      setLoading(true);
    }
    try {
      const res = await fetchAdminCompanies();
      const loadedCompanies = res.companies || [];
      setCompanies(loadedCompanies);
      setStats(res.stats);
      setSelectedCompany((prev) =>
        prev ? loadedCompanies.find((c) => c.id === prev.id) || prev : null
      );
    } catch (err: any) {
      console.error("Failed to load admin companies:", err);
    } finally {
      if (!options?.silent) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    if (!authLoading && !unauthorizedEmail) {
      loadData();
      fetchAdminOrders()
        .then((res) => {
          setPendingOrdersCount(res.stats?.underReviewCount || 0);
        })
        .catch((e) => console.warn("Failed to load initial orders count:", e));
    }
  }, [authLoading, unauthorizedEmail, loadData]);

  // Sign out handler
  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.replace(getLoginUrl());
  };

  // Client-side filtering (All, Free Trial, Pro, Expired)
  const filteredCompanies = useMemo(() => {
    return companies.filter((c) => {
      if (filters.search.trim()) {
        const query = filters.search.toLowerCase();
        const matchesName = c.businessName?.toLowerCase().includes(query);
        const matchesOwner = c.ownerName?.toLowerCase().includes(query);
        const matchesEmail = c.email?.toLowerCase().includes(query);
        const matchesPhone = c.phoneNumber?.toLowerCase().includes(query);
        const matchesSlug = c.slug?.toLowerCase().includes(query);
        const matchesUsername = c.username?.toLowerCase().includes(query);
        if (
          !matchesName &&
          !matchesOwner &&
          !matchesEmail &&
          !matchesPhone &&
          !matchesSlug &&
          !matchesUsername
        ) {
          return false;
        }
      }

      const validity = getDaysRemaining(c.membershipExpiresAt, c.subscriptionPlan);
      const isExp =
        (c.subscriptionPlan === "pro" || c.subscriptionPlan === "trial") &&
        !validity.isLifetime &&
        (validity.isExpired || (c.status === "expired" && !c.membershipExpiresAt));

      if (filters.tab === "trial") {
        if (c.subscriptionPlan !== "trial") return false;
      } else if (filters.tab === "pro") {
        if (c.subscriptionPlan !== "pro") return false;
        if (isExp) return false;
      } else if (filters.tab === "expired") {
        if (!isExp) return false;
      }

      return true;
    });
  }, [companies, filters]);

  // Optimistic in-place update for zero latency & no full-page reloads
  const handleUpdateCompanyLocally = useCallback(
    (updated: Partial<Company> & { id: string }) => {
      setCompanies((prev) =>
        prev.map((c) => (c.id === updated.id ? { ...c, ...updated } : c))
      );
      setSelectedCompany((prev) =>
        prev && prev.id === updated.id ? { ...prev, ...updated } : prev
      );
    },
    []
  );

  // 1-click plan change directly from table row without opening modal or page reload
  const handleQuickPlanChange = useCallback(
    async (company: Company, newPlan: SubscriptionPlanType) => {
      const today = new Date().toISOString().split("T")[0];
      let finalStart: string | null = null;
      let finalExpiry: string | null = null;
      const newStatus: AccountStatus =
        company.status === "suspended" ? "suspended" : "active";

      if (newPlan === "trial") {
        finalStart = new Date(`${today}T00:00:00.000Z`).toISOString();
        const trialDaysMs = 99 * 24 * 60 * 60 * 1000;
        const expDate = new Date(new Date(today).getTime() + trialDaysMs)
          .toISOString()
          .split("T")[0];
        finalExpiry = new Date(`${expDate}T23:59:59.000Z`).toISOString();
      } else if (newPlan === "pro") {
        finalStart = new Date(`${today}T00:00:00.000Z`).toISOString();
        const [y, m, d] = today.split("-").map(Number);
        const nextY = y + 1;
        const mm = String(m).padStart(2, "0");
        const dd = String(d).padStart(2, "0");
        const expDate = `${nextY}-${mm}-${dd}`;
        finalExpiry = new Date(`${expDate}T23:59:59.000Z`).toISOString();
      } else {
        finalStart = null;
        finalExpiry = null;
      }

      // 1. Instant local update in 0ms (no reload, instant badge change)
      handleUpdateCompanyLocally({
        id: company.id,
        subscriptionPlan: newPlan,
        subscriptionStartedAt: finalStart,
        membershipExpiresAt: finalExpiry,
        status: newStatus,
        primaryCardCount: newPlan === "free" ? 0 : 1,
      });

      // 2. Persist to API
      try {
        await updateCompanyValidity(company.id, {
          subscriptionPlan: newPlan,
          subscriptionStartedAt: finalStart,
          membershipExpiresAt: finalExpiry,
          primaryCardCount: newPlan === "free" ? 0 : 1,
        });
        // 3. Silent background sync without table spinner
        loadData({ silent: true });
      } catch (err: any) {
        alert(`Failed to update plan: ${err.message}`);
        loadData({ silent: true });
      }
    },
    [handleUpdateCompanyLocally, loadData]
  );

  // Open detail modal
  const handleSelectCompany = (company: Company) => {
    setSelectedCompany(company);
    setIsDetailOpen(true);
  };

  // Trigger delete modal
  const handleDeleteRequest = (company: Company, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setDeleteTarget(company);
    setIsDeleteOpen(true);
  };

  // If verifying authentication, show loading state
  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--background)]">
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-[5px] bg-[var(--foreground)] text-[var(--background)]">
            <Shield size={22} />
          </div>
          <Loader2 size={24} className="animate-spin text-[var(--foreground)]" />
          <p className="font-mono text-xs font-medium text-[var(--muted-foreground)]">
            Verifying administrator credentials...
          </p>
        </div>
      </div>
    );
  }

  // Access Denied / Unauthorized Screen
  if (unauthorizedEmail) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--background)] p-4">
        <div className="max-w-md w-full rounded-[5px] border border-rose-500/20 bg-rose-500/5 p-6 text-center space-y-4">
          <Shield size={36} className="mx-auto text-rose-500" />
          <div>
            <h3 className="font-headline text-lg font-bold text-[var(--foreground)]">
              Access Restricted
            </h3>
            <p className="text-xs text-[var(--muted-foreground)] mt-1">
              User <span className="font-semibold text-[var(--foreground)]">{unauthorizedEmail}</span> does not have staff or administrator privileges.
            </p>
          </div>
          <button
            onClick={handleSignOut}
            className="w-full rounded-[5px] bg-[var(--foreground)] py-2 text-xs font-semibold text-[var(--background)] hover:opacity-90 transition-opacity"
          >
            Sign in with a different account
          </button>
        </div>
      </div>
    );
  }

  // Designer Studio (Read-only order assets & QR downloads)
  if (userRole === "designer") {
    return <DesignerDashboardView />;
  }

  return (
    <div className="flex h-screen w-full overflow-hidden bg-[var(--background)] text-[var(--foreground)]">
      {/* Isolated Admin Sidebar (Fixed, non-scrolling) */}
      <AdminSidebar
        currentTab={currentTab}
        onTabChange={setCurrentTab}
        onSignOut={handleSignOut}
        ordersPendingCount={pendingOrdersCount}
      />

      {/* Main Admin Content Area */}
      {currentTab === "orders" ? (
        <AdminOrdersView
          onOrderCountUpdate={(cnt) => setPendingOrdersCount(cnt)}
        />
      ) : currentTab === "staff" ? (
        <div className="flex flex-1 flex-col h-screen overflow-y-auto min-w-0">
          <StaffAccountsView />
        </div>
      ) : (
        <div className="flex flex-1 flex-col h-screen overflow-y-auto min-w-0">
          <AdminHeader
            onRefresh={loadData}
            loading={loading}
            totalCompaniesCount={stats.totalCompanies}
          />

          <main className="flex-1 space-y-6 p-6 w-full pb-16">
            {/* Top 4 KPI Metrics Cards */}
            <KpiMetricsGrid
              stats={stats}
              loading={loading}
              activeView={activeView}
              onSelectView={setActiveView}
            />

            {/* Contextual Banner if filtered to a specific summary card view */}
            {activeView !== "all" && (
              <div className="flex items-center justify-between rounded-[5px] border border-[var(--border)] bg-[var(--accent)]/40 px-4 py-2 text-xs">
                <span className="font-medium text-[var(--foreground)]">
                  Viewing:{" "}
                  <span className="font-semibold">
                    {activeView === "pending_trials"
                      ? "Pending Free Trial Requests"
                      : activeView === "upcoming_renewals"
                      ? "Upcoming Renewals (Next 30 Days)"
                      : activeView === "expired"
                      ? "Expired Cards"
                      : "Filtered Cards"}
                  </span>
                </span>
                <button
                  onClick={() => setActiveView("all")}
                  className="font-medium text-[var(--muted-foreground)] hover:text-[var(--foreground)] underline"
                >
                  Clear KPI Filter
                </button>
              </div>
            )}

            {/* KPI Drilldown Views vs Unified Table */}
            {activeView === "pending_trials" ? (
              <PendingTrialsTable
                companies={companies}
                loading={loading}
                onSelectCompany={handleSelectCompany}
                onRefresh={loadData}
              />
            ) : activeView === "upcoming_renewals" ? (
              <UpcomingRenewalsTable
                companies={companies}
                loading={loading}
                onSelectCompany={handleSelectCompany}
                onRefresh={loadData}
              />
            ) : activeView === "expired" ? (
              <ExpiredCardsTable
                companies={companies}
                loading={loading}
                onSelectCompany={handleSelectCompany}
              />
            ) : filters.tab === "trial" ? (
              /* Dedicated 100-Day Free Trial Table with 20-Day Touchpoints & Custom Extensions */
              <div className="space-y-4">
                <CompanyFiltersBar
                  filters={filters}
                  onChange={setFilters}
                  totalFiltered={filteredCompanies.length}
                />
                <FreeTrialsTable
                  companies={filteredCompanies}
                  loading={loading}
                  onSelectCompany={handleSelectCompany}
                  onRefresh={loadData}
                />
              </div>
            ) : (
              /* Unified Companies Registry & Controls */
              <div className="space-y-4">
                <CompanyFiltersBar
                  filters={filters}
                  onChange={setFilters}
                  totalFiltered={filteredCompanies.length}
                />

                <CompaniesTable
                  companies={filteredCompanies}
                  loading={loading}
                  onSelectCompany={handleSelectCompany}
                  onDeleteCompany={handleDeleteRequest}
                  onQuickPlanChange={handleQuickPlanChange}
                />
              </div>
            )}
          </main>
        </div>
      )}

      {/* Drill-down Modal */}
      <CompanyDetailModal
        isOpen={isDetailOpen}
        onClose={() => {
          setIsDetailOpen(false);
          setSelectedCompany(null);
        }}
        company={selectedCompany}
        onRefresh={() => loadData({ silent: true })}
        onUpdateCompany={handleUpdateCompanyLocally}
      />

      {/* Delete Confirmation Modal */}
      <DeleteCompanyModal
        isOpen={isDeleteOpen}
        onClose={() => {
          setIsDeleteOpen(false);
          setDeleteTarget(null);
        }}
        company={deleteTarget}
        onSuccess={loadData}
      />
    </div>
  );
};
