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
import { FreeTrialsTable } from "@/admin/widgets/free-trials/ui/FreeTrialsTable";
import { CompanyFiltersBar } from "@/admin/features/company-filters/ui/CompanyFiltersBar";
import { CompanyDetailModal } from "@/admin/widgets/company-detail-modal/ui/CompanyDetailModal";
import { DeleteCompanyModal } from "@/admin/features/delete-company/ui/DeleteCompanyModal";
import { AdminOrdersView } from "@/admin/views/AdminOrdersView";
import { DesignerDashboardView } from "@/admin/views/DesignerDashboardView";
import { StaffAccountsView } from "@/admin/widgets/staff-accounts/ui/StaffAccountsView";
import { AdminCampaignsView } from "@/admin/views/AdminCampaignsView";
import { AffiliateRequestsView } from "@/admin/views/AffiliateRequestsView";
import { fetchAdminCompanies } from "@/admin/entities/company/api/company-api";
import { fetchAdminOrders } from "@/admin/entities/order/api/order-api";
import { getDaysRemaining } from "@/admin/shared/lib/formatters";
import type {
  Company,
  AdminStats,
  CompanyFilters,
} from "@/admin/entities/company/model/types";

const VIEWED_STORAGE_KEY = "nammainfo_admin_viewed_companies";
// Highlight new accounts created in the last 5 days until viewed
const RECENT_CUTOFF_MS = 5 * 24 * 60 * 60 * 1000;

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

  // Active top KPI filter view: "all" | "active_trials" | "upcoming_renewals" | "expired"
  const [activeView, setActiveView] = useState<AdminViewFilter>("all");

  // Filters state for all companies
  const [filters, setFilters] = useState<CompanyFilters>({
    search: "",
    tab: "all",
    sortBy: "recent",
  });

  // Modal states
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Company | null>(null);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [pendingOrdersCount, setPendingOrdersCount] = useState<number>(0);
  const [pendingAffiliateCount, setPendingAffiliateCount] = useState<number>(0);
  const [userRole, setUserRole] = useState<"admin" | "designer">("admin");

  const [unauthorizedEmail, setUnauthorizedEmail] = useState<string | null>(null);

  // Track company IDs that have been viewed by admin (email-style read tracking)
  const [viewedCompanyIds, setViewedCompanyIds] = useState<Set<string>>(() => {
    if (typeof window === "undefined") return new Set();
    try {
      const raw = localStorage.getItem(VIEWED_STORAGE_KEY);
      if (raw) return new Set(JSON.parse(raw));
    } catch (e) {
      console.warn("Failed to read viewed companies from localStorage:", e);
    }
    return new Set();
  });

  // Seed older accounts on first run so they don't all look unread
  useEffect(() => {
    if (typeof window === "undefined" || companies.length === 0) return;
    try {
      const raw = localStorage.getItem(VIEWED_STORAGE_KEY);
      if (!raw) {
        const now = Date.now();
        // Mark accounts older than 5 days as already viewed
        const olderIds = companies
          .filter((c) => now - new Date(c.createdAt).getTime() > RECENT_CUTOFF_MS)
          .map((c) => c.id);
        const initialSet = new Set(olderIds);
        setViewedCompanyIds(initialSet);
        localStorage.setItem(VIEWED_STORAGE_KEY, JSON.stringify(Array.from(initialSet)));
      }
    } catch (e) {
      console.warn("Failed to initialize viewed companies:", e);
    }
  }, [companies]);

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

        const isAdmin = Boolean(profile?.is_admin || profile?.role === "admin");
        const isDesigner = !isAdmin && profile?.role === "designer";
        const isStaff = isAdmin || isDesigner;

        if (!profile || !isStaff) {
          setUnauthorizedEmail(user.email || "Current User");
          setAuthLoading(false);
          return;
        }

        setUserRole(isDesigner ? "designer" : "admin");
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
      fetch("/api/admin/affiliate-requests", { cache: "no-store" })
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => {
          if (d?.counts?.pending !== undefined) {
            setPendingAffiliateCount(d.counts.pending);
          }
        })
        .catch(() => {});
    }
  }, [authLoading, unauthorizedEmail, loadData]);

  // Sign out handler
  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.replace(getLoginUrl());
  };

  // Client-side filtering & sorting (All, Free Trial, Pro, Expired)
  const filteredCompanies = useMemo(() => {
    const matched = companies.filter((c) => {
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
        !validity.isLifetime &&
        (validity.isExpired ||
          c.status === "expired" ||
          (c.membershipExpiresAt ? new Date(c.membershipExpiresAt).getTime() <= Date.now() : false));

      if (filters.tab === "trial") {
        if (c.subscriptionPlan !== "trial" || isExp) return false;
      } else if (filters.tab === "pro") {
        if (c.subscriptionPlan !== "pro" || isExp) return false;
      } else if (filters.tab === "expired") {
        if (!isExp) return false;
      }

      return true;
    });

    const sortBy = filters.sortBy || "recent";
    return [...matched].sort((a, b) => {
      if (sortBy === "a_z") {
        return (a.businessName || "").localeCompare(b.businessName || "");
      }
      if (sortBy === "z_a") {
        return (b.businessName || "").localeCompare(a.businessName || "");
      }
      if (sortBy === "expiring_soon") {
        const aExp = a.membershipExpiresAt ? new Date(a.membershipExpiresAt).getTime() : Number.MAX_SAFE_INTEGER;
        const bExp = b.membershipExpiresAt ? new Date(b.membershipExpiresAt).getTime() : Number.MAX_SAFE_INTEGER;
        return aExp - bExp;
      }
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
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

  // Open detail modal and mark company as viewed (removes highlight like an unread mail)
  const handleSelectCompany = (company: Company) => {
    if (!viewedCompanyIds.has(company.id)) {
      setViewedCompanyIds((prev) => {
        const next = new Set(prev);
        next.add(company.id);
        try {
          localStorage.setItem(VIEWED_STORAGE_KEY, JSON.stringify(Array.from(next)));
        } catch (e) {
          console.warn("Failed to save viewed companies:", e);
        }
        return next;
      });
    }
    setSelectedCompany(company);
    setIsDetailOpen(true);
  };

  // Trigger delete modal
  const handleDeleteRequest = (company: Company, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setDeleteTarget(company);
    setIsDeleteOpen(true);
  };

  // Urgent operational radar: expiring in <= 3 days or follow-ups due today / tomorrow
  const urgentOpsAlerts = useMemo(() => {
    const nowMs = Date.now();
    const threeDaysMs = 3 * 86_400_000;
    const twoDaysMs = 2 * 86_400_000;
    const expiring3d: Company[] = [];
    const followupsDue: Company[] = [];

    for (const c of companies) {
      if ((c.subscriptionPlan === "pro" || c.subscriptionPlan === "trial") && c.membershipExpiresAt) {
        const diff = new Date(c.membershipExpiresAt).getTime() - nowMs;
        if (diff > 0 && diff <= threeDaysMs) {
          expiring3d.push(c);
        }
      }
      if (c.nextFollowupAt) {
        const fDiff = new Date(c.nextFollowupAt).getTime() - nowMs;
        if (fDiff <= twoDaysMs) {
          followupsDue.push(c);
        }
      }
    }
    return { expiring3d, followupsDue };
  }, [companies]);

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
        affiliatePendingCount={pendingAffiliateCount}
      />

      {/* Main Admin Content Area */}
      {currentTab === "orders" ? (
        <AdminOrdersView
          onOrderCountUpdate={setPendingOrdersCount}
        />
      ) : currentTab === "campaigns" ? (
        <div className="flex flex-1 flex-col h-full min-h-0 min-w-0 overflow-y-scroll">
          <AdminCampaignsView />
        </div>
      ) : currentTab === "affiliate_requests" ? (
        <div className="flex flex-1 flex-col h-full min-h-0 min-w-0 overflow-y-scroll">
          <AffiliateRequestsView onPendingCountChange={setPendingAffiliateCount} />
        </div>
      ) : currentTab === "staff" ? (
        <div className="flex flex-1 flex-col h-full min-h-0 min-w-0 overflow-y-scroll">
          <StaffAccountsView />
        </div>
      ) : (
        <div className="flex flex-1 flex-col h-screen overflow-y-scroll min-w-0">
          <AdminHeader
            onRefresh={loadData}
            loading={loading}
            totalCompaniesCount={stats.totalCompanies}
            onSelectNotification={(n) => {
              if (n.entity_type === "affiliate_request") {
                setCurrentTab("affiliate_requests");
                return;
              }
              if (n.entity_type === "withdrawal") {
                setCurrentTab("campaigns");
                return;
              }
              if (n.profile_id) {
                const match = companies.find((c) => c.id === n.profile_id);
                if (match) {
                  handleSelectCompany(match);
                  return;
                }
              }
              if (n.entity_type === "order") {
                setCurrentTab("orders");
              }
            }}
          />

          <main className="flex-1 space-y-6 p-6 w-full pb-16">
            {/* Operational Alert Radar: <=3d Expiries & Today/Tomorrow Follow-ups */}
            {(urgentOpsAlerts.expiring3d.length > 0 || urgentOpsAlerts.followupsDue.length > 0) && (
              <div className="rounded-[5px] border border-[var(--border)] bg-[var(--card)] p-3.5 space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-[var(--foreground)]">
                    Action Radar — Expiring Within 3 Days &amp; Upcoming Follow-Ups
                  </span>
                  <span className="font-mono text-[10px] text-[var(--muted-foreground)]">
                    {urgentOpsAlerts.expiring3d.length} expiring ≤3d • {urgentOpsAlerts.followupsDue.length} follow-up{urgentOpsAlerts.followupsDue.length === 1 ? "" : "s"} due
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {urgentOpsAlerts.expiring3d.slice(0, 6).map((c) => {
                    const days = Math.max(0, Math.ceil((new Date(c.membershipExpiresAt!).getTime() - Date.now()) / 86_400_000));
                    return (
                      <button
                        key={`exp-${c.id}`}
                        type="button"
                        onClick={() => handleSelectCompany(c)}
                        className="rounded-[4px] border border-amber-500/40 bg-amber-500/10 px-2 py-1 text-[11px] font-medium text-[var(--foreground)] hover:bg-amber-500/20 transition-colors cursor-pointer"
                      >
                        {c.businessName} · {days}d left
                      </button>
                    );
                  })}
                  {urgentOpsAlerts.followupsDue.slice(0, 6).map((c) => (
                    <button
                      key={`fu-${c.id}`}
                      type="button"
                      onClick={() => handleSelectCompany(c)}
                      className="rounded-[4px] border border-[var(--border)] bg-[var(--accent)] px-2 py-1 text-[11px] font-medium text-[var(--foreground)] hover:border-[var(--foreground)] transition-colors cursor-pointer"
                    >
                      Follow-up: {c.businessName} ({new Date(c.nextFollowupAt!).toLocaleDateString("en-IN", { day: "numeric", month: "short" })})
                    </button>
                  ))}
                </div>
              </div>
            )}
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
                    {activeView === "active_trials"
                      ? "Active 100-Day Free Trials"
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
            {activeView === "active_trials" ? (
              <FreeTrialsTable
                companies={companies.filter((c) => c.subscriptionPlan === "trial")}
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
            ) : (
              /* Unified Companies Registry & Controls (All, Free Trial, Pro, Expired) */
              <div className="space-y-4">
                <CompanyFiltersBar
                  filters={filters}
                  onChange={setFilters}
                  totalFiltered={filteredCompanies.length}
                />

                <CompaniesTable
                  companies={filteredCompanies}
                  loading={loading}
                  viewedCompanyIds={viewedCompanyIds}
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
        isOpen={isDetailOpen}
        onClose={() => {
          setIsDetailOpen(false);
          setSelectedCompany(null);
        }}
        company={selectedCompany}
        onRefresh={() => loadData({ silent: true })}
        onUpdateCompany={handleUpdateCompanyLocally}
        userRole={userRole}
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
