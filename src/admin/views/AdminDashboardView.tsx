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
import { CompanyFiltersBar } from "@/admin/features/company-filters/ui/CompanyFiltersBar";
import { CompanyDetailModal } from "@/admin/widgets/company-detail-modal/ui/CompanyDetailModal";
import { DeleteCompanyModal } from "@/admin/features/delete-company/ui/DeleteCompanyModal";
import { AdminOrdersView } from "@/admin/views/AdminOrdersView";
import { fetchAdminCompanies } from "@/admin/entities/company/api/company-api";
import { fetchAdminOrders } from "@/admin/entities/order/api/order-api";
import { getDaysRemaining } from "@/admin/shared/lib/formatters";
import type {
  Company,
  AdminStats,
  CompanyFilters,
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
  });
  const [loading, setLoading] = useState(true);

  // Active top KPI filter view: "all" | "upcoming_renewals" | "expired"
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

  const [unauthorizedEmail, setUnauthorizedEmail] = useState<string | null>(null);

  // Strict Client-Side Admin Auth Verification
  useEffect(() => {
    const checkAdminAuth = async () => {
      try {
        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          router.replace("/admin/login");
          return;
        }

        const { data: profile } = await supabase
          .from("profiles")
          .select("is_admin")
          .eq("id", user.id)
          .maybeSingle();

        if (!profile || !profile.is_admin) {
          setUnauthorizedEmail(user.email || "Current User");
          setAuthLoading(false);
          return;
        }

        setAuthLoading(false);
      } catch (err) {
        console.error("Auth check failed:", err);
        router.replace("/admin/login");
      }
    };

    checkAdminAuth();
  }, [router]);

  const loadData = useCallback(async () => {
    setLoading(true);
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
      setLoading(false);
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
    router.replace("/admin/login");
  };

  // Client-side filtering (All, Pro, Expired)
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
      const isExp = c.subscriptionPlan === "pro" && !validity.isLifetime && (validity.isExpired || (c.status === "expired" && !c.membershipExpiresAt));

      if (filters.tab === "pro") {
        if (c.subscriptionPlan !== "pro") return false;
        if (isExp) return false;
      } else if (filters.tab === "expired") {
        if (!isExp) return false;
      }

      return true;
    });
  }, [companies, filters]);

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
              User <span className="font-semibold text-[var(--foreground)]">{unauthorizedEmail}</span> does not have administrator privileges.
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
      ) : (
        <div className="flex flex-1 flex-col h-screen overflow-y-auto min-w-0">
          <AdminHeader
            onRefresh={loadData}
            loading={loading}
            totalCompaniesCount={stats.totalCompanies}
          />

          <main className="flex-1 space-y-6 p-6 max-w-7xl w-full mx-auto pb-16">
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
                    {activeView === "upcoming_renewals"
                      ? "Upcoming Renewals (Next 15 Days)"
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
            {activeView === "upcoming_renewals" ? (
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
                />
              </div>
            )}
          </main>
        </div>
      )}

      {/* Drill-down Modal */}
      <CompanyDetailModal
        company={selectedCompany}
        isOpen={isDetailOpen}
        onClose={() => {
          setIsDetailOpen(false);
          setSelectedCompany(null);
        }}
        onRefresh={loadData}
        onDeleteRequest={(c) => {
          setIsDetailOpen(false);
          handleDeleteRequest(c);
        }}
      />

      {/* Delete Confirmation Modal */}
      <DeleteCompanyModal
        company={deleteTarget}
        isOpen={isDeleteOpen}
        onClose={() => {
          setIsDeleteOpen(false);
          setDeleteTarget(null);
        }}
        onSuccess={() => {
          loadData();
        }}
      />
    </div>
  );
};
