"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Search,
  Package,
  QrCode,
  Download,
  Copy,
  Check,
  ExternalLink,
  Loader2,
  RefreshCw,
  LogOut,
  Building2,
  Phone,
  Mail,
  MapPin,
  FileText,
  Clock,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { AdminThemeToggle } from "@/admin/shared/ui/AdminThemeToggle";
import { Button } from "@/admin/shared/ui/Button";
import { Badge } from "@/admin/shared/ui/Badge";
import { formatDate } from "@/admin/shared/lib/formatters";
import { fetchAdminCompanies } from "@/admin/entities/company/api/company-api";
import { fetchAdminOrders } from "@/admin/entities/order/api/order-api";
import { CompanyDetailModal } from "@/admin/widgets/company-detail-modal/ui/CompanyDetailModal";
import { CompanyQrCardRow } from "@/admin/widgets/company-detail-modal/ui/CompanyQrCardRow";
import { buildPublicCardUrl } from "@/admin/shared/lib/card-urls";
import type { Company } from "@/admin/entities/company/model/types";
import type { AdminOrder } from "@/admin/entities/order/model/types";

export type DesignerFilterTab = "production" | "all" | "trial" | "pro" | "free";

export const DesignerDashboardView: React.FC = () => {
  const router = useRouter();
  const [userEmail, setUserEmail] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<DesignerFilterTab>("production");
  const [search, setSearch] = useState<string>("");

  // Data
  const [companies, setCompanies] = useState<Company[]>([]);
  const [orders, setOrders] = useState<AdminOrder[]>([]);

  // Selected company modal in read-only mode
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  const loadAllData = useCallback(async () => {
    setLoading(true);
    try {
      const [compRes, ordRes] = await Promise.all([
        fetchAdminCompanies(),
        fetchAdminOrders(),
      ]);
      setCompanies(compRes.companies || []);
      setOrders(ordRes.orders || []);
    } catch (err) {
      console.error("[Designer] Failed to load assets:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user?.email) setUserEmail(user.email);
    });
    loadAllData();
  }, [loadAllData]);

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    const isSubdomain =
      typeof window !== "undefined" &&
      (window.location.hostname.startsWith("admin.") ||
        window.location.hostname.startsWith("admin.localhost"));
    router.replace(isSubdomain ? "/login" : "/admin/login");
  };

  // Orders that are In Production ("on_work")
  const inProductionOrders = useMemo(() => {
    return orders.filter((o) => {
      if (o.status !== "on_work") return false;
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return (
        o.businessName?.toLowerCase().includes(q) ||
        o.ownerName?.toLowerCase().includes(q) ||
        o.id.toLowerCase().includes(q) ||
        (o.phone && o.phone.includes(q))
      );
    });
  }, [orders, search]);

  // Filtered companies based on active tab
  const filteredCompanies = useMemo(() => {
    return companies.filter((c) => {
      if (search.trim()) {
        const q = search.toLowerCase();
        const matchesName = c.businessName?.toLowerCase().includes(q);
        const matchesOwner = c.ownerName?.toLowerCase().includes(q);
        const matchesEmail = c.email?.toLowerCase().includes(q);
        const matchesUsername = c.username?.toLowerCase().includes(q);
        if (!matchesName && !matchesOwner && !matchesEmail && !matchesUsername) {
          return false;
        }
      }

      if (activeTab === "trial") {
        return c.subscriptionPlan === "trial";
      }
      if (activeTab === "pro") {
        return c.subscriptionPlan === "pro";
      }
      if (activeTab === "free") {
        return c.subscriptionPlan === "free";
      }
      return true; // "all"
    });
  }, [companies, activeTab, search]);

  return (
    <div className="flex min-h-screen flex-col bg-[var(--background)] text-[var(--foreground)]">
      {/* Top Header */}
      <header className="sticky top-0 z-30 border-b border-[var(--border)] bg-[var(--card)]/90 backdrop-blur-md px-5 py-3.5">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="font-headline text-base font-bold tracking-tight">
              Designer Studio
            </h1>
          </div>

          <div className="flex items-center gap-2">
            <span className="hidden sm:inline-block font-mono text-[11px] text-[var(--muted-foreground)] mr-2">
              {userEmail}
            </span>
            <AdminThemeToggle />
            <button
              onClick={handleSignOut}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[5px] border border-[var(--border)] bg-[var(--background)] hover:bg-[var(--accent)] text-xs text-[var(--muted-foreground)] hover:text-red-500 transition-colors cursor-pointer"
              title="Sign Out"
            >
              <LogOut size={13} />
              <span className="hidden sm:inline">Sign Out</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 p-5 sm:p-6 max-w-7xl w-full mx-auto space-y-5">
        {/* Filter Navigation Bar */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-[var(--border)] pb-4">
          {/* Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
            <button
              onClick={() => setActiveTab("production")}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-[5px] text-xs font-semibold uppercase tracking-wider transition-colors cursor-pointer whitespace-nowrap ${
                activeTab === "production"
                  ? "bg-[var(--foreground)] text-[var(--background)]"
                  : "border border-[var(--border)] bg-[var(--card)] text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
              }`}
            >
              <Package size={13} />
              <span>In Production ({orders.filter((o) => o.status === "on_work").length})</span>
            </button>

            <button
              onClick={() => setActiveTab("all")}
              className={`px-3 py-1.5 rounded-[5px] text-xs font-semibold uppercase tracking-wider transition-colors cursor-pointer whitespace-nowrap ${
                activeTab === "all"
                  ? "bg-[var(--foreground)] text-[var(--background)]"
                  : "border border-[var(--border)] bg-[var(--card)] text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
              }`}
            >
              All Companies ({companies.length})
            </button>

            <button
              onClick={() => setActiveTab("pro")}
              className={`px-3 py-1.5 rounded-[5px] text-xs font-semibold uppercase tracking-wider transition-colors cursor-pointer whitespace-nowrap ${
                activeTab === "pro"
                  ? "bg-[var(--foreground)] text-[var(--background)]"
                  : "border border-[var(--border)] bg-[var(--card)] text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
              }`}
            >
              Pro Plan ({companies.filter((c) => c.subscriptionPlan === "pro").length})
            </button>

            <button
              onClick={() => setActiveTab("trial")}
              className={`px-3 py-1.5 rounded-[5px] text-xs font-semibold uppercase tracking-wider transition-colors cursor-pointer whitespace-nowrap ${
                activeTab === "trial"
                  ? "bg-[var(--foreground)] text-[var(--background)]"
                  : "border border-[var(--border)] bg-[var(--card)] text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
              }`}
            >
              Free Trial ({companies.filter((c) => c.subscriptionPlan === "trial").length})
            </button>

            <button
              onClick={() => setActiveTab("free")}
              className={`px-3 py-1.5 rounded-[5px] text-xs font-semibold uppercase tracking-wider transition-colors cursor-pointer whitespace-nowrap ${
                activeTab === "free"
                  ? "bg-[var(--foreground)] text-[var(--background)]"
                  : "border border-[var(--border)] bg-[var(--card)] text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
              }`}
            >
              Free Tier ({companies.filter((c) => c.subscriptionPlan === "free").length})
            </button>
          </div>

          {/* Search bar & Refresh */}
          <div className="flex items-center gap-2">
            <div className="relative min-w-[240px]">
              <Search
                size={13}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)]"
              />
              <input
                type="text"
                placeholder="Search business, owner, slug..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-[5px] border border-[var(--border)] bg-[var(--card)] pl-9 pr-3 py-1.5 text-xs text-[var(--foreground)] outline-none focus:border-[var(--foreground)]"
              />
            </div>

            <Button variant="secondary" size="sm" onClick={loadAllData} disabled={loading}>
              <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
            </Button>
          </div>
        </div>

        {/* View Mode 1: In Production Orders (Primary Focus for Designer) */}
        {activeTab === "production" ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-headline text-sm font-bold text-[var(--foreground)]">
                  Orders In Production
                </h3>
              </div>
            </div>

            {loading ? (
              <div className="p-12 text-center text-xs text-[var(--muted-foreground)]">
                <Loader2 size={18} className="animate-spin inline-block mr-2" />
                Loading production queue...
              </div>
            ) : inProductionOrders.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-[5px] border border-dashed border-[var(--border)] bg-[var(--card)] py-14 text-center">
                <Package size={32} className="text-[var(--muted-foreground)] opacity-40 mb-2" />
                <h4 className="font-headline text-sm font-semibold text-[var(--foreground)]">
                  No Orders Currently In Production
                </h4>
                <p className="text-xs text-[var(--muted-foreground)] mt-1 max-w-sm">
                  Orders moved to <strong>In Production</strong> by Admin will appear here.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4">
                {inProductionOrders.map((order) => {
                  const company = companies.find((c) => c.id === order.profileId);
                  const ownerSlug = company?.username || company?.slug || company?.id || order.profileId;
                  const cardUrl = buildPublicCardUrl(ownerSlug);
                  const dlName = `qr-${(company?.username || order.businessName).toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
                  const cardDetails = order.cardDetails || order.shippingAddress?.cardDetails;
                  const finalDesignUrl = order.designUrl || cardDetails?.fileUrl;
                  const hasCustomDetails = Boolean(
                    cardDetails &&
                      (cardDetails.companyName ||
                        cardDetails.ownerName ||
                        cardDetails.contactNumber ||
                        cardDetails.companyAddress ||
                        cardDetails.logoUrl ||
                        cardDetails.designNotes)
                  );

                  return (
                    <div
                      key={order.id}
                      className="rounded-[5px] border border-[var(--border)] bg-[var(--card)] p-4 sm:p-5 space-y-4 shadow-xs"
                    >
                      {/* Order Identity Row */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[var(--border)] pb-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="font-semibold text-sm text-[var(--foreground)]">
                              {order.businessName}
                            </h4>
                            <span className="font-mono text-[9px] uppercase px-1.5 py-0.2 rounded-[4px] border border-[var(--border)] bg-[var(--accent)] font-semibold">
                              IN PRODUCTION
                            </span>
                            <span className="font-mono text-[10px] text-[var(--muted-foreground)]">
                              #{order.id.slice(0, 8)}
                            </span>
                          </div>
                          <p className="text-xs text-[var(--muted-foreground)] mt-0.5">
                            Customer: {order.ownerName} {order.phone ? `• ${order.phone}` : ""} {order.email ? `• ${order.email}` : ""}
                          </p>
                        </div>

                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-semibold text-[var(--foreground)]">
                            {order.orderType === "team_addon"
                              ? `Team Cards (${order.cardQuantity})`
                              : "Pro Card (1)"}
                          </span>
                          {company && (
                            <button
                              onClick={() => {
                                setSelectedCompany(company);
                                setIsDetailOpen(true);
                              }}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-[4px] border border-[var(--border)] bg-[var(--background)] hover:bg-[var(--accent)] text-xs text-[var(--foreground)] font-medium transition-colors cursor-pointer"
                            >
                              <span>View Company Profile</span>
                              <ExternalLink size={11} />
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Design Assets / Uploads Grid */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* 1. Uploaded Visiting Card / Customer Design Asset */}
                        <div className="rounded-[5px] border border-[var(--border)] bg-[var(--background)] p-3.5 space-y-2">
                          <span className="font-mono text-[10px] uppercase tracking-wider text-[var(--muted-foreground)] font-semibold block">
                            Customer Design Asset / Specifications
                          </span>

                          {finalDesignUrl ? (
                            <div className="flex items-center gap-3">
                              <a
                                href={finalDesignUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="block h-16 w-24 shrink-0 rounded-[4px] border border-[var(--border)] overflow-hidden bg-white/5 hover:opacity-90 transition-opacity"
                              >
                                <img
                                  src={finalDesignUrl}
                                  alt="Customer Card Design"
                                  className="h-full w-full object-cover"
                                />
                              </a>
                              <div className="space-y-1">
                                <a
                                  href={finalDesignUrl}
                                  target="_blank"
                                  download
                                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[4px] border border-[var(--border)] bg-[var(--card)] hover:bg-[var(--accent)] text-xs font-medium text-[var(--foreground)] transition-colors"
                                >
                                  <Download size={12} />
                                  <span>Download Asset</span>
                                </a>
                                <p className="text-[10px] text-[var(--muted-foreground)]">
                                  Provided for custom card engraving/printing.
                                </p>
                              </div>
                            </div>
                          ) : hasCustomDetails ? (
                            <div className="space-y-2 text-xs">
                              <div className="space-y-1">
                                {cardDetails?.companyName && (
                                  <div>
                                    <span className="text-[10px] text-[var(--muted-foreground)] block">Company Name</span>
                                    <span className="font-medium text-[var(--foreground)]">{cardDetails.companyName}</span>
                                  </div>
                                )}
                                {cardDetails?.ownerName && (
                                  <div>
                                    <span className="text-[10px] text-[var(--muted-foreground)] block">Cardholder Name</span>
                                    <span className="font-medium text-[var(--foreground)]">{cardDetails.ownerName}</span>
                                  </div>
                                )}
                                {cardDetails?.contactNumber && (
                                  <div>
                                    <span className="text-[10px] text-[var(--muted-foreground)] block">Phone</span>
                                    <span className="font-mono text-[var(--foreground)]">{cardDetails.contactNumber}</span>
                                  </div>
                                )}
                                {cardDetails?.designNotes && (
                                  <div>
                                    <span className="text-[10px] text-[var(--muted-foreground)] block">Design Instructions</span>
                                    <p className="text-[11px] text-[var(--foreground)] italic">{cardDetails.designNotes}</p>
                                  </div>
                                )}
                              </div>
                              {cardDetails?.logoUrl && (
                                <div className="flex items-center gap-2 pt-1 border-t border-[var(--border)]">
                                  <img
                                    src={cardDetails.logoUrl}
                                    alt="Logo"
                                    className="h-8 w-8 rounded-[4px] object-cover border border-[var(--border)]"
                                  />
                                  <a
                                    href={cardDetails.logoUrl}
                                    target="_blank"
                                    download
                                    className="inline-flex items-center gap-1 text-[11px] text-[var(--foreground)] hover:underline"
                                  >
                                    <Download size={11} />
                                    <span>Download Logo</span>
                                  </a>
                                </div>
                              )}
                            </div>
                          ) : (
                            <div className="p-3 text-xs text-[var(--muted-foreground)] rounded-[4px] border border-dashed border-[var(--border)]">
                              No image asset uploaded. Use custom details & logo from company profile.
                            </div>
                          )}
                        </div>

                        {/* 2. Primary Card QR & URL */}
                        <div className="space-y-1">
                          <span className="font-mono text-[10px] uppercase tracking-wider text-[var(--muted-foreground)] font-semibold block px-0.5">
                            Primary Card Print Asset & QR
                          </span>
                          <CompanyQrCardRow
                            isPrimary
                            title={order.businessName}
                            subtitle={`Owner: ${order.ownerName}`}
                            url={cardUrl}
                            badge="Primary Card"
                            downloadFileName={dlName}
                          />
                        </div>
                      </div>

                      {/* If team order, button to view and download all team member QRs */}
                      {company && order.orderType === "team_addon" && (
                        <div className="pt-2 border-t border-[var(--border)] flex items-center justify-between">
                          <div>
                            <span className="font-mono text-[10px] uppercase tracking-wider text-[var(--muted-foreground)] font-semibold block">
                              Team Member Cards ({order.cardQuantity} Cards Ordered)
                            </span>
                            <p className="text-[11px] text-[var(--muted-foreground)]">
                              View and download individual high-res QR codes for each team member in company profile.
                            </p>
                          </div>
                          <button
                            onClick={() => {
                              setSelectedCompany(company);
                              setIsDetailOpen(true);
                            }}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[4px] border border-[var(--border)] bg-[var(--background)] hover:bg-[var(--accent)] text-xs text-[var(--foreground)] font-medium transition-colors cursor-pointer"
                          >
                            <QrCode size={13} />
                            <span>Download Team QRs</span>
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          /* View Mode 2: Browse Companies (All, Free Trial, Pro, Free Tier) */
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-headline text-sm font-bold text-[var(--foreground)]">
                  {activeTab === "all"
                    ? "All Registered Accounts & QR Codes"
                    : activeTab === "pro"
                    ? "Pro Plan Digital Cards"
                    : activeTab === "trial"
                    ? "100-Day Free Trial Digital Cards"
                    : "Free Tier Digital Cards"}
                </h3>
                <p className="text-xs text-[var(--muted-foreground)]">
                  Inspect public URLs, details, and download high-resolution QR codes for physical printing.
                </p>
              </div>
              <span className="font-mono text-xs text-[var(--muted-foreground)]">
                Showing {filteredCompanies.length} companies
              </span>
            </div>

            {loading ? (
              <div className="p-12 text-center text-xs text-[var(--muted-foreground)]">
                <Loader2 size={18} className="animate-spin inline-block mr-2" />
                Loading companies...
              </div>
            ) : filteredCompanies.length === 0 ? (
              <div className="p-12 text-center text-xs text-[var(--muted-foreground)] rounded-[5px] border border-dashed border-[var(--border)] bg-[var(--card)]">
                No accounts match the current filter.
              </div>
            ) : (
              <div className="space-y-2">
                {filteredCompanies.map((company) => {
                  const ownerSlug = company.username || company.slug || company.id;
                  const cardUrl = buildPublicCardUrl(ownerSlug);
                  const dlName = `qr-${(company.username || company.businessName).toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;

                  return (
                    <div
                      key={company.id}
                      className="rounded-[5px] border border-[var(--border)] bg-[var(--card)] p-3 space-y-2"
                    >
                      <div className="flex items-center justify-between gap-3 flex-wrap">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-xs text-[var(--foreground)]">
                            {company.businessName}
                          </span>
                          <span className="font-mono text-[9px] uppercase px-1.5 py-0.2 rounded-[4px] border border-[var(--border)] bg-[var(--accent)] font-semibold">
                            {company.subscriptionPlan === "pro"
                              ? "Pro Plan"
                              : company.subscriptionPlan === "trial"
                              ? "Free Trial"
                              : "Free Tier"}
                          </span>
                          <span className="text-xs text-[var(--muted-foreground)]">
                            Owner: {company.ownerName}
                          </span>
                        </div>

                        <button
                          onClick={() => {
                            setSelectedCompany(company);
                            setIsDetailOpen(true);
                          }}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-[4px] border border-[var(--border)] bg-[var(--background)] hover:bg-[var(--accent)] text-xs text-[var(--foreground)] font-medium transition-colors cursor-pointer"
                        >
                          <span>View Assets & Team</span>
                          <ExternalLink size={11} />
                        </button>
                      </div>

                      {/* Compact QR Row */}
                      <CompanyQrCardRow
                        isPrimary
                        title={company.businessName}
                        subtitle={`Owner: ${company.ownerName}${company.email ? ` • ${company.email}` : ""}`}
                        url={cardUrl}
                        badge="Primary Card"
                        downloadFileName={dlName}
                      />
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </main>

      {/* Read-Only Company Details Modal for Designer */}
      {selectedCompany && (
        <CompanyDetailModal
          company={selectedCompany}
          isOpen={isDetailOpen}
          onClose={() => {
            setIsDetailOpen(false);
            setSelectedCompany(null);
          }}
          onRefresh={loadAllData}
          readOnly={true}
        />
      )}
    </div>
  );
};
