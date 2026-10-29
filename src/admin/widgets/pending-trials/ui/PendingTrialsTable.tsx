"use client";

import React, { useState } from "react";
import { Check, X, Clock, ExternalLink, Phone, Mail, Gift, ShieldAlert } from "lucide-react";
import { Badge } from "@/admin/shared/ui/Badge";
import { Button } from "@/admin/shared/ui/Button";
import { formatDate } from "@/admin/shared/lib/formatters";
import { approveFreeTrial, rejectFreeTrial } from "@/admin/entities/company/api/company-api";
import type { Company } from "@/admin/entities/company/model/types";

interface PendingTrialsTableProps {
  companies: Company[];
  loading: boolean;
  onRefresh: () => void;
  onSelectCompany: (company: Company) => void;
}

export const PendingTrialsTable: React.FC<PendingTrialsTableProps> = ({
  companies,
  loading,
  onRefresh,
  onSelectCompany,
}) => {
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [successId, setSuccessId] = useState<string | null>(null);

  // Filter only companies awaiting trial approval
  const pendingList = companies.filter((c) => c.trialStatus === "pending_approval");

  const handleApprove = async (company: Company) => {
    setActionLoadingId(company.id);
    try {
      await approveFreeTrial(company.id);
      setSuccessId(company.id);
      setTimeout(() => setSuccessId(null), 2500);
      onRefresh();
    } catch (err: any) {
      alert(`Failed to approve free trial: ${err.message}`);
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleReject = async (company: Company) => {
    const reason = prompt("Enter a brief reason for rejecting this trial application (optional):");
    if (reason === null) return; // User cancelled prompt

    setActionLoadingId(company.id);
    try {
      await rejectFreeTrial(company.id, reason);
      onRefresh();
    } catch (err: any) {
      alert(`Failed to reject free trial: ${err.message}`);
    } finally {
      setActionLoadingId(null);
    }
  };

  if (loading) {
    return (
      <div className="space-y-3 rounded-[5px] border border-[var(--border)] bg-[var(--card)] p-6">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="flex h-16 animate-pulse items-center justify-between rounded-[5px] bg-[var(--accent)] px-4"
          />
        ))}
      </div>
    );
  }

  if (pendingList.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-[5px] border border-dashed border-[var(--border)] bg-[var(--card)] py-16 text-center">
        <Gift size={36} className="text-[var(--muted-foreground)] opacity-40 mb-3" />
        <h4 className="font-headline text-base font-semibold text-[var(--foreground)]">
          No Pending Free Trial Requests
        </h4>
        <p className="mt-1 text-xs text-[var(--muted-foreground)] max-w-sm">
          All 100-day Free Trial applications have been reviewed. When new users apply using coupon code <strong>ADI100</strong>, they will appear here.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Informative Header Banner */}
      <div className="rounded-[5px] border border-[var(--border)] bg-[var(--card)] p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h3 className="font-headline text-sm font-bold text-[var(--foreground)] flex items-center gap-2">
            <Gift size={16} className="text-amber-500" />
            Pending 100-Day Free Trial Applications
          </h3>
          <p className="mt-0.5 text-xs text-[var(--muted-foreground)]">
            {pendingList.length} application{pendingList.length === 1 ? "" : "s"} awaiting approval. Approving starts the 100-day countdown with full Pro plan capabilities.
          </p>
        </div>
        <div className="shrink-0 flex items-center gap-2">
          <Badge variant="pro">Code: ADI100</Badge>
          <Badge variant="active">Min 60% Profile Verified</Badge>
        </div>
      </div>

      {/* Applications Table */}
      <div className="overflow-hidden rounded-[5px] border border-[var(--border)] bg-[var(--card)] shadow-card">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-[var(--border)] bg-[var(--accent)]/50 font-mono text-[11px] uppercase tracking-wider text-[var(--muted-foreground)]">
              <tr>
                <th scope="col" className="px-5 py-3">Applicant Company</th>
                <th scope="col" className="px-4 py-3">Contact</th>
                <th scope="col" className="px-4 py-3">Profile Completion</th>
                <th scope="col" className="px-4 py-3">Requested At</th>
                <th scope="col" className="px-4 py-3">Coupon Code</th>
                <th scope="col" className="px-5 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {pendingList.map((company) => {
                const completion = company.profileCompletionPercentage ?? 0;
                const isActioning = actionLoadingId === company.id;
                const isSuccess = successId === company.id;

                return (
                  <tr
                    key={company.id}
                    className="transition-colors hover:bg-neutral-100 dark:hover:bg-neutral-800/50"
                  >
                    {/* Company info */}
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[5px] bg-[var(--accent)] font-headline text-xs font-bold text-[var(--foreground)] border border-[var(--border)]">
                          {company.avatarUrl ? (
                            <img
                              src={company.avatarUrl}
                              alt=""
                              className="h-full w-full rounded-[5px] object-cover"
                            />
                          ) : (
                            company.businessName.charAt(0).toUpperCase()
                          )}
                        </div>
                        <div className="min-w-0">
                          <button
                            onClick={() => onSelectCompany(company)}
                            className="text-left font-semibold text-[var(--foreground)] hover:underline truncate block max-w-[200px]"
                          >
                            {company.businessName}
                          </button>
                          <div className="flex items-center gap-1.5 text-[11px] text-[var(--muted-foreground)]">
                            <span>Owner: {company.ownerName}</span>
                            {company.username && (
                              <a
                                href={`/${company.username}`}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-0.5 text-[var(--foreground)] hover:underline"
                                title="Open digital card"
                              >
                                <ExternalLink size={10} />
                              </a>
                            )}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Contact */}
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      <div className="space-y-1">
                        {company.phone ? (
                          <a
                            href={`tel:${company.phone}`}
                            className="flex items-center gap-1.5 font-mono text-[11px] text-[var(--foreground)] hover:underline"
                          >
                            <Phone size={11} className="text-[var(--muted-foreground)]" />
                            {company.phone}
                          </a>
                        ) : (
                          <span className="font-mono text-[11px] text-[var(--muted-foreground)]">—</span>
                        )}
                        {company.email && (
                          <a
                            href={`mailto:${company.email}`}
                            className="flex items-center gap-1.5 font-mono text-[11px] text-[var(--muted-foreground)] hover:underline truncate max-w-[180px]"
                          >
                            <Mail size={11} className="shrink-0" />
                            <span className="truncate">{company.email}</span>
                          </a>
                        )}
                      </div>
                    </td>

                    {/* Profile Completion */}
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      <div className="w-32 space-y-1">
                        <div className="flex items-center justify-between text-[11px] font-mono">
                          <span className="text-[var(--muted-foreground)]">Complete</span>
                          <span className="font-bold text-[var(--foreground)]">{completion}%</span>
                        </div>
                        <div className="h-1.5 w-full rounded-full bg-[var(--muted)] overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-300 ${
                              completion >= 60 ? "bg-emerald-500" : "bg-amber-500"
                            }`}
                            style={{ width: `${Math.min(100, completion)}%` }}
                          />
                        </div>
                      </div>
                    </td>

                    {/* Requested At */}
                    <td className="px-4 py-3.5 font-mono text-[11px] text-[var(--muted-foreground)] whitespace-nowrap">
                      {formatDate(company.trialRequestedAt || company.createdAt)}
                    </td>

                    {/* Coupon Code */}
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-[4px] font-mono text-xs font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                        {company.trialCouponCode || "ADI100"}
                      </span>
                    </td>

                    {/* Action Controls */}
                    <td className="px-5 py-3.5 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-2">
                        {isSuccess ? (
                          <span className="flex items-center gap-1.5 font-mono text-xs font-bold text-emerald-500">
                            <Check size={14} /> Approved!
                          </span>
                        ) : (
                          <>
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => handleReject(company)}
                              disabled={isActioning}
                              className="text-xs text-rose-500 hover:text-rose-600"
                            >
                              <X size={12} className="mr-1" />
                              Reject
                            </Button>
                            <Button
                              size="sm"
                              variant="primary"
                              onClick={() => handleApprove(company)}
                              isLoading={isActioning}
                              className="text-xs font-semibold"
                            >
                              <Check size={13} className="mr-1" />
                              Approve 100-Day Trial
                            </Button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

