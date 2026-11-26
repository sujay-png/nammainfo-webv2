"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  UserCheck,
  CheckCircle2,
  XCircle,
  Clock,
  Search,
  RefreshCw,
  Loader2,
  Building2,
  Briefcase,
  Mail,
  Phone,
  AlertTriangle,
} from "lucide-react";
import { Modal } from "@/admin/shared/ui/Modal";
import { Button } from "@/admin/shared/ui/Button";
import { formatDate } from "@/admin/shared/lib/formatters";
import { StaffNotificationsBell } from "@/admin/widgets/notifications/ui/StaffNotificationsBell";

interface AffiliateRequestItem {
  id: string;
  userId: string;
  applicantType: "owner" | "employee";
  employeeId: string | null;
  ownerId: string | null;
  fullName: string;
  businessName: string | null;
  designation: string | null;
  email: string;
  phone: string | null;
  note: string | null;
  status: "pending" | "approved" | "rejected";
  rejectionReason: string | null;
  reviewedAt: string | null;
  createdAt: string;
  subscriptionPlan: string;
  publicSlug: string | null;
}

export const AffiliateRequestsView: React.FC<{
  onPendingCountChange?: (count: number) => void;
}> = ({ onPendingCountChange }) => {
  const [requests, setRequests] = useState<AffiliateRequestItem[]>([]);
  const [counts, setCounts] = useState({ pending: 0, approved: 0, rejected: 0, total: 0 });
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<"all" | "pending" | "approved" | "rejected">("pending");
  const [search, setSearch] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [bannerMsg, setBannerMsg] = useState<string | null>(null);

  // Mandatory Confirmation Popup state before Accept / Reject
  const [confirmTarget, setConfirmTarget] = useState<{
    request: AffiliateRequestItem;
    action: "approve" | "reject";
  } | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [submittingDecision, setSubmittingDecision] = useState(false);

  const loadRequests = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/affiliate-requests", { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || "Failed to load affiliate requests");
      }
      setRequests(json.requests || []);
      const nextCounts = json.counts || { pending: 0, approved: 0, rejected: 0, total: 0 };
      setCounts(nextCounts);
      onPendingCountChange?.(nextCounts.pending || 0);
    } catch (err: any) {
      setError(err?.message || "Failed to load affiliate requests");
    } finally {
      setLoading(false);
    }
  }, [onPendingCountChange]);

  useEffect(() => {
    loadRequests();
  }, [loadRequests]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return requests.filter((r) => {
      if (filterStatus !== "all" && r.status !== filterStatus) return false;
      if (!q) return true;
      return (
        r.fullName.toLowerCase().includes(q) ||
        (r.businessName || "").toLowerCase().includes(q) ||
        r.email.toLowerCase().includes(q) ||
        (r.phone || "").toLowerCase().includes(q)
      );
    });
  }, [requests, filterStatus, search]);

  async function executeConfirmedDecision() {
    if (!confirmTarget) return;
    setSubmittingDecision(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/admin/affiliate-requests/${confirmTarget.request.id}/decision`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: confirmTarget.action,
            rejectionReason:
              confirmTarget.action === "reject" ? rejectionReason.trim() : undefined,
          }),
        }
      );
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || "Failed to process affiliate decision");
      }
      setBannerMsg(json.message || "Decision saved.");
      setConfirmTarget(null);
      setRejectionReason("");
      await loadRequests();
    } catch (err: any) {
      setError(err?.message || "Failed to process affiliate decision");
    } finally {
      setSubmittingDecision(false);
    }
  }

  return (
    <div className="flex flex-1 flex-col min-w-0">
      {/* Header */}
      <header className="sticky top-0 z-20 flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-[var(--border)] bg-[var(--card)] px-6 py-4 gap-3 shrink-0">
        <div>
          <h2 className="font-headline text-lg font-bold text-[var(--foreground)]">
            Affiliate Requests
          </h2>
          <p className="text-xs text-[var(--muted-foreground)]">
            Review Partner / Affiliate applications from Business Owners and Employees
          </p>
        </div>

        <div className="flex items-center gap-2">
          <StaffNotificationsBell />
          <Button
            variant="secondary"
            size="sm"
            onClick={loadRequests}
            isLoading={loading}
          >
            {!loading && <RefreshCw size={13} />}
            <span>Refresh</span>
          </Button>
        </div>
      </header>

      <main className="p-6 space-y-5 pb-16">
        {/* Summary KPI Strip */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: "Pending Review", value: counts.pending, status: "pending" as const },
            { label: "Approved Partners", value: counts.approved, status: "approved" as const },
            { label: "Rejected", value: counts.rejected, status: "rejected" as const },
            { label: "All Applications", value: counts.total, status: "all" as const },
          ].map((card) => (
            <button
              key={card.label}
              type="button"
              onClick={() => setFilterStatus(card.status)}
              className={`rounded-[5px] border p-4 text-left cursor-pointer ${
                filterStatus === card.status
                  ? "border-[var(--foreground)] bg-[var(--card)]"
                  : "border-[var(--border)] bg-[var(--card)] hover:bg-[var(--accent)]/40"
              }`}
            >
              <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-[var(--muted-foreground)] block">
                {card.label}
              </span>
              <span className="mt-1.5 font-headline text-2xl font-bold text-[var(--foreground)] block">
                {card.value}
              </span>
            </button>
          ))}
        </div>

        {bannerMsg && (
          <div className="flex items-center justify-between rounded-[5px] border border-[var(--border)] bg-[var(--card)] px-4 py-2.5 text-xs text-[var(--foreground)]">
            <span className="flex items-center gap-2">
              <CheckCircle2 size={14} />
              {bannerMsg}
            </span>
            <button
              type="button"
              onClick={() => setBannerMsg(null)}
              className="text-[var(--muted-foreground)] hover:text-[var(--foreground)] underline cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        )}

        {error && (
          <div className="rounded-[5px] border border-red-500/30 bg-red-500/10 px-4 py-3 text-xs text-red-600 dark:text-red-400">
            {error}
          </div>
        )}

        {/* Filter & Search Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-[5px] border border-[var(--border)] bg-[var(--card)] p-3">
          <div className="flex flex-wrap items-center gap-1.5">
            {(["pending", "approved", "rejected", "all"] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setFilterStatus(tab)}
                className={`rounded-[5px] px-3 py-1.5 text-xs font-medium capitalize cursor-pointer ${
                  filterStatus === tab
                    ? "bg-[var(--foreground)] text-[var(--background)]"
                    : "border border-[var(--border)] bg-[var(--background)] text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          <div className="relative sm:w-72">
            <Search
              size={14}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)]"
            />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name, company, email..."
              className="w-full rounded-[5px] border border-[var(--border)] bg-[var(--background)] py-1.5 pl-8 pr-3 text-xs text-[var(--foreground)] placeholder-[var(--muted-foreground)] outline-none focus:border-[var(--foreground)]"
            />
          </div>
        </div>

        {/* Requests List */}
        {loading ? (
          <div className="flex flex-col items-center justify-center rounded-[5px] border border-[var(--border)] bg-[var(--card)] p-12 text-xs text-[var(--muted-foreground)]">
            <Loader2 size={20} className="animate-spin mb-2 text-[var(--foreground)]" />
            <span>Loading affiliate applications...</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-[5px] border border-[var(--border)] bg-[var(--card)] p-10 text-center space-y-2">
            <UserCheck size={28} className="mx-auto text-[var(--muted-foreground)] opacity-60" />
            <p className="text-sm font-medium text-[var(--foreground)]">
              No {filterStatus === "all" ? "" : filterStatus} affiliate requests
            </p>
            <p className="text-xs text-[var(--muted-foreground)]">
              When owners or employees request to join the Affiliate Program from app Settings, they will appear here.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((req) => (
              <div
                key={req.id}
                className="rounded-[5px] border border-[var(--border)] bg-[var(--card)] p-4 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4"
              >
                <div className="space-y-2 min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-sm font-semibold text-[var(--foreground)]">
                      {req.fullName}
                    </h3>

                    <span className="rounded-[4px] border border-[var(--border)] bg-[var(--background)] px-2 py-0.5 font-mono text-[10px] font-semibold uppercase text-[var(--muted-foreground)]">
                      {req.applicantType === "employee" ? "Employee" : "Business Owner"}
                    </span>

                    <span className="rounded-[4px] border border-[var(--border)] bg-[var(--background)] px-2 py-0.5 font-mono text-[10px] font-semibold uppercase text-[var(--foreground)]">
                      {req.status === "pending" && "Pending"}
                      {req.status === "approved" && "Approved"}
                      {req.status === "rejected" && "Rejected"}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[var(--muted-foreground)]">
                    {req.businessName && (
                      <span className="inline-flex items-center gap-1.5">
                        <Building2 size={13} />
                        {req.businessName}
                      </span>
                    )}
                    {req.designation && (
                      <span className="inline-flex items-center gap-1.5">
                        <Briefcase size={13} />
                        {req.designation}
                      </span>
                    )}
                    {req.email && (
                      <span className="inline-flex items-center gap-1.5">
                        <Mail size={13} />
                        {req.email}
                      </span>
                    )}
                    {req.phone && (
                      <span className="inline-flex items-center gap-1.5 font-mono">
                        <Phone size={13} />
                        {req.phone}
                      </span>
                    )}
                  </div>

                  {req.note && (
                    <div className="rounded-[5px] border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-xs text-[var(--foreground)]">
                      <span className="font-mono text-[10px] uppercase text-[var(--muted-foreground)] mr-1.5">
                        Applicant Note:
                      </span>
                      {req.note}
                    </div>
                  )}

                  {req.status === "rejected" && req.rejectionReason && (
                    <p className="text-xs text-[var(--muted-foreground)]">
                      Rejection reason: {req.rejectionReason}
                    </p>
                  )}

                  <p className="font-mono text-[10px] text-[var(--muted-foreground)]">
                    Requested {formatDate(req.createdAt)}
                    {req.reviewedAt ? ` • Reviewed ${formatDate(req.reviewedAt)}` : ""}
                  </p>
                </div>

                {/* Actions (always open Confirmation Popup) */}
                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  {req.status !== "approved" && (
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => {
                        setRejectionReason("");
                        setConfirmTarget({ request: req, action: "approve" });
                      }}
                    >
                      <CheckCircle2 size={13} />
                      <span>Accept</span>
                    </Button>
                  )}

                  {req.status !== "rejected" && (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => {
                        setRejectionReason("");
                        setConfirmTarget({ request: req, action: "reject" });
                      }}
                    >
                      <XCircle size={13} />
                      <span>Reject</span>
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Mandatory Accept / Reject Confirmation Popup */}
      <Modal
        isOpen={Boolean(confirmTarget)}
        onClose={() => {
          if (!submittingDecision) {
            setConfirmTarget(null);
            setRejectionReason("");
          }
        }}
        title={
          confirmTarget?.action === "approve"
            ? "Confirm Partner Approval"
            : "Confirm Request Rejection"
        }
        maxWidth="md"
      >
        {confirmTarget && (
          <div className="space-y-4">
            <div className="flex items-start gap-3 rounded-[5px] border border-[var(--border)] bg-[var(--background)] p-3.5">
              <AlertTriangle size={18} className="shrink-0 mt-0.5 text-[var(--foreground)]" />
              <div className="space-y-1 text-xs">
                <p className="font-semibold text-[var(--foreground)]">
                  {confirmTarget.action === "approve"
                    ? `Accept ${confirmTarget.request.fullName} into the Partner Program?`
                    : `Reject affiliate request from ${confirmTarget.request.fullName}?`}
                </p>
                <p className="text-[var(--muted-foreground)] leading-relaxed">
                  {confirmTarget.action === "approve"
                    ? `This grants Partner access (${confirmTarget.request.applicantType === "employee" ? "Employee Partner" : "Owner Partner"}) using ${confirmTarget.request.email}. They will be able to access partner.nammainfo.in and earn referral payouts.`
                    : `The applicant (${confirmTarget.request.email}) will see Rejected status in their app Settings and may re-apply later.`}
                </p>
              </div>
            </div>

            {confirmTarget.action === "reject" && (
              <div className="space-y-1.5">
                <label className="font-mono text-[10px] font-semibold uppercase tracking-wider text-[var(--muted-foreground)] block">
                  Rejection Reason (Optional)
                </label>
                <textarea
                  rows={3}
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder="Optional reason shown to the applicant..."
                  className="w-full rounded-[5px] border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-xs text-[var(--foreground)] placeholder-[var(--muted-foreground)] outline-none focus:border-[var(--foreground)]"
                />
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[var(--border)]">
              <Button
                variant="secondary"
                size="sm"
                disabled={submittingDecision}
                onClick={() => {
                  setConfirmTarget(null);
                  setRejectionReason("");
                }}
              >
                Cancel
              </Button>
              <Button
                variant={confirmTarget.action === "reject" ? "danger" : "primary"}
                size="sm"
                isLoading={submittingDecision}
                onClick={executeConfirmedDecision}
              >
                {confirmTarget.action === "approve" ? "Confirm Accept" : "Confirm Reject"}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
