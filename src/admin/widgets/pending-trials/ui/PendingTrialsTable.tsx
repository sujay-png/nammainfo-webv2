"use client";

import React, { useState } from "react";
import { Check, X, Clock, ExternalLink, Phone, Mail, FileText, ShieldAlert, AlertTriangle } from "lucide-react";
import { Badge } from "@/admin/shared/ui/Badge";
import { Button } from "@/admin/shared/ui/Button";
import { Modal } from "@/admin/shared/ui/Modal";
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

  // Confirmation Modal state
  const [confirmApproveCompany, setConfirmApproveCompany] = useState<Company | null>(null);
  const [confirmRejectCompany, setConfirmRejectCompany] = useState<Company | null>(null);
  const [rejectReason, setRejectReason] = useState<string>("");

  // Filter only companies awaiting trial approval
  const pendingList = companies.filter((c) => c.trialStatus === "pending_approval");

  const executeApprove = async (company: Company) => {
    setActionLoadingId(company.id);
    try {
      await approveFreeTrial(company.id);
      setSuccessId(company.id);
      setConfirmApproveCompany(null);
      setTimeout(() => setSuccessId(null), 2500);
      onRefresh();
    } catch (err: any) {
      alert(`Failed to approve free trial: ${err.message}`);
    } finally {
      setActionLoadingId(null);
    }
  };

  const executeReject = async (company: Company, reason: string) => {
    setActionLoadingId(company.id);
    try {
      await rejectFreeTrial(company.id, reason.trim() || undefined);
      setConfirmRejectCompany(null);
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
        <FileText size={32} className="text-[var(--muted-foreground)] opacity-40 mb-3" />
        <h4 className="font-headline text-base font-semibold text-[var(--foreground)]">
          No Pending Free Trial Requests
        </h4>
        <p className="mt-1 text-xs text-[var(--muted-foreground)] max-w-sm">
          All 100-day Free Trial applications have been reviewed. When new users apply for the free trial, they will appear here.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Informative Header Banner */}
      <div className="rounded-[5px] border border-[var(--border)] bg-[var(--card)] p-4">
        <div>
          <h3 className="font-headline text-sm font-bold text-[var(--foreground)] flex items-center gap-2">
            <Clock size={15} className="text-[var(--muted-foreground)]" />
            Pending 100-Day Free Trial Applications
          </h3>
          <p className="mt-0.5 text-xs text-[var(--muted-foreground)]">
            {pendingList.length} application{pendingList.length === 1 ? "" : "s"} awaiting approval. Approving starts the 100-day countdown with full Pro plan capabilities.
          </p>
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
                          {company.businessName.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="font-semibold text-xs text-[var(--foreground)]">
                              {company.businessName}
                            </span>
                            {company.slug && (
                              <a
                                href={`/${company.slug}`}
                                target="_blank"
                                rel="noreferrer"
                                className="text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors"
                                title="Preview Public Profile"
                              >
                                <ExternalLink size={12} />
                              </a>
                            )}
                          </div>
                          <p className="font-mono text-[11px] text-[var(--muted-foreground)] mt-0.5">
                            Owner: {company.ownerName}
                          </p>
                        </div>
                      </div>
                    </td>

                    {/* Contact */}
                    <td className="px-4 py-3.5 font-mono text-[11px] space-y-1">
                      {company.phone ? (
                        <div className="flex items-center gap-1.5 text-[var(--foreground)]">
                          <Phone size={12} className="text-[var(--muted-foreground)]" />
                          <span>{company.phone}</span>
                        </div>
                      ) : (
                        <span className="text-[var(--muted-foreground)]">No phone</span>
                      )}
                      {company.email && (
                        <div className="flex items-center gap-1.5 text-[var(--muted-foreground)] truncate max-w-[180px]">
                          <Mail size={12} />
                          <span className="truncate">{company.email}</span>
                        </div>
                      )}
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
                            className="h-full rounded-full bg-[var(--foreground)] transition-all duration-300"
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
                      <span className="inline-flex items-center px-2 py-0.5 rounded-[4px] font-mono text-xs font-semibold bg-[var(--accent)] text-[var(--foreground)] border border-[var(--border)]">
                        {company.trialCouponCode || "ADI100"}
                      </span>
                    </td>

                    {/* Action Controls */}
                    <td className="px-5 py-3.5 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-2">
                        {isSuccess ? (
                          <span className="flex items-center gap-1.5 font-mono text-xs font-semibold text-[var(--foreground)]">
                            <Check size={14} /> Approved
                          </span>
                        ) : (
                          <>
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => {
                                setConfirmRejectCompany(company);
                                setRejectReason("");
                              }}
                              disabled={isActioning}
                              className="text-xs text-rose-500 hover:text-rose-600"
                            >
                              <X size={12} className="mr-1" />
                              Reject
                            </Button>
                            <Button
                              size="sm"
                              variant="primary"
                              onClick={() => setConfirmApproveCompany(company)}
                              isLoading={isActioning}
                              className="text-xs font-semibold"
                            >
                              <Check size={13} className="mr-1" />
                              Approve
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

      {/* 1. Modal: Confirmation for Approval */}
      {confirmApproveCompany && (
        <Modal
          isOpen={Boolean(confirmApproveCompany)}
          onClose={() => setConfirmApproveCompany(null)}
          title="Approve Free Trial"
          maxWidth="sm"
        >
          <div className="space-y-4">
            <p className="text-xs text-[var(--muted-foreground)] leading-relaxed">
              Are you sure you want to approve the 100-Day Free Trial for{" "}
              <strong className="text-[var(--foreground)]">{confirmApproveCompany.businessName}</strong>?
            </p>

            <div className="rounded-[5px] border border-[var(--border)] bg-[var(--accent)]/30 p-3 text-xs text-[var(--muted-foreground)] space-y-1.5">
              <div className="flex items-center justify-between">
                <span>Applicant:</span>
                <span className="font-semibold text-[var(--foreground)]">{confirmApproveCompany.ownerName}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Duration:</span>
                <span className="font-mono font-semibold text-[var(--foreground)]">100 Days</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Access:</span>
                <span className="font-semibold text-[var(--foreground)]">Full Pro Plan Features</span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[var(--border)]">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setConfirmApproveCompany(null)}
                disabled={actionLoadingId === confirmApproveCompany.id}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={() => executeApprove(confirmApproveCompany)}
                isLoading={actionLoadingId === confirmApproveCompany.id}
              >
                <Check size={13} className="mr-1" />
                Confirm & Approve
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* 2. Modal: Confirmation for Rejection */}
      {confirmRejectCompany && (
        <Modal
          isOpen={Boolean(confirmRejectCompany)}
          onClose={() => setConfirmRejectCompany(null)}
          title="Reject Free Trial Application"
          maxWidth="sm"
        >
          <div className="space-y-4">
            <p className="text-xs text-[var(--muted-foreground)] leading-relaxed">
              Are you sure you want to decline the trial application for{" "}
              <strong className="text-[var(--foreground)]">{confirmRejectCompany.businessName}</strong>?
              This will remove the request from pending trials.
            </p>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[var(--foreground)] block">
                Reason for Rejection <span className="font-normal text-[var(--muted-foreground)]">(Optional)</span>
              </label>
              <input
                type="text"
                placeholder="e.g. Incomplete profile details, duplicate request..."
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                className="w-full rounded-[5px] border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-xs text-[var(--foreground)] outline-none focus:border-[var(--foreground)] transition-colors placeholder:text-[var(--muted-foreground)]/50"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[var(--border)]">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setConfirmRejectCompany(null)}
                disabled={actionLoadingId === confirmRejectCompany.id}
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                size="sm"
                onClick={() => executeReject(confirmRejectCompany, rejectReason)}
                isLoading={actionLoadingId === confirmRejectCompany.id}
              >
                <X size={13} className="mr-1" />
                Confirm Rejection
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
