"use client";

import React, { useState } from "react";
import { Phone, Mail, Clock, Save, Check, ExternalLink, FileText, PlusCircle } from "lucide-react";
import { Badge } from "@/admin/shared/ui/Badge";
import { Button } from "@/admin/shared/ui/Button";
import { Modal } from "@/admin/shared/ui/Modal";
import { formatDate, getDaysRemaining } from "@/admin/shared/lib/formatters";
import { updateCompanyFollowUp } from "@/admin/entities/company/api/company-api";
import type { Company } from "@/admin/entities/company/model/types";

interface UpcomingRenewalsTableProps {
  companies: Company[];
  loading: boolean;
  onRefresh: () => void;
  onSelectCompany: (company: Company) => void;
}

type RenewalSubTab = "all" | "pro" | "trial";

export const UpcomingRenewalsTable: React.FC<UpcomingRenewalsTableProps> = ({
  companies,
  loading,
  onRefresh,
  onSelectCompany,
}) => {
  const [subTab, setSubTab] = useState<RenewalSubTab>("all");

  // Filter only companies with upcoming renewals in the next 30 days
  const allUpcoming = companies.filter((c) => {
    if ((c.subscriptionPlan !== "pro" && c.subscriptionPlan !== "trial") || !c.membershipExpiresAt) {
      return false;
    }
    const diff = new Date(c.membershipExpiresAt).getTime() - Date.now();
    return diff > 0 && diff <= 30 * 86400000;
  });

  const proUpcoming = allUpcoming.filter((c) => c.subscriptionPlan === "pro");
  const trialUpcoming = allUpcoming.filter((c) => c.subscriptionPlan === "trial");

  const displayedList =
    subTab === "pro"
      ? proUpcoming
      : subTab === "trial"
      ? trialUpcoming
      : allUpcoming;

  // Local state for follow-up notes & status per company
  const [followUpNotes, setFollowUpNotes] = useState<Record<string, string>>({});
  const [followUpStatuses, setFollowUpStatuses] = useState<Record<string, "unattended" | "attended">>({});

  // Renewal Follow-up Note Modal State
  const [noteModalTarget, setNoteModalTarget] = useState<Company | null>(null);
  const [noteModalText, setNoteModalText] = useState<string>("");
  const [isSavingNote, setIsSavingNote] = useState<boolean>(false);

  const handleOpenNoteModal = (company: Company) => {
    setNoteModalTarget(company);
    setNoteModalText(company.followUpNotes || "");
  };

  const handleSaveModalNote = async () => {
    if (!noteModalTarget) return;
    setIsSavingNote(true);
    try {
      const status = getStatus(noteModalTarget);
      await updateCompanyFollowUp(noteModalTarget.id, {
        status,
        notes: noteModalText.trim(),
      });
      setNoteModalTarget(null);
      onRefresh();
    } catch (err: any) {
      alert(`Failed to save note: ${err.message}`);
    } finally {
      setIsSavingNote(false);
    }
  };

  const getNote = (c: Company) =>
    followUpNotes[c.id] !== undefined ? followUpNotes[c.id] : c.followUpNotes || "";

  const getStatus = (c: Company): "unattended" | "attended" =>
    followUpStatuses[c.id] !== undefined
      ? followUpStatuses[c.id]
      : c.followUpStatus === "attended"
      ? "attended"
      : "unattended";

  const handleStatusChange = async (company: Company, status: "unattended" | "attended") => {
    setFollowUpStatuses((prev) => ({ ...prev, [company.id]: status }));
    try {
      await updateCompanyFollowUp(company.id, {
        status,
        notes: getNote(company),
      });
      onRefresh();
    } catch (err: any) {
      alert(`Failed to update status: ${err.message}`);
    }
  };

  if (loading) {
    return (
      <div className="space-y-3 rounded-[5px] border border-[var(--border)] bg-[var(--card)] p-6">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="flex h-14 animate-pulse items-center justify-between rounded-[5px] bg-[var(--accent)] px-4"
          />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Sub-Tabs: All, Pro, Free Trial */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-[5px] border border-[var(--border)] bg-[var(--card)] p-3">
        <div className="flex items-center gap-1.5">
          <span className="mr-1 text-[11px] font-mono font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
            Category:
          </span>
          <button
            onClick={() => setSubTab("all")}
            className={`rounded-[5px] px-3 py-1 text-xs font-semibold transition ${
              subTab === "all"
                ? "bg-[var(--foreground)] text-[var(--background)]"
                : "text-[var(--muted-foreground)] hover:bg-[var(--accent)] hover:text-[var(--foreground)]"
            }`}
          >
            All Upcoming ({allUpcoming.length})
          </button>
          <button
            onClick={() => setSubTab("pro")}
            className={`rounded-[5px] px-3 py-1 text-xs font-semibold transition ${
              subTab === "pro"
                ? "bg-[var(--foreground)] text-[var(--background)]"
                : "text-[var(--muted-foreground)] hover:bg-[var(--accent)] hover:text-[var(--foreground)]"
            }`}
          >
            Pro Plan ({proUpcoming.length})
          </button>
          <button
            onClick={() => setSubTab("trial")}
            className={`rounded-[5px] px-3 py-1 text-xs font-semibold transition ${
              subTab === "trial"
                ? "bg-[var(--foreground)] text-[var(--background)]"
                : "text-[var(--muted-foreground)] hover:bg-[var(--accent)] hover:text-[var(--foreground)]"
            }`}
          >
            Free Trial ({trialUpcoming.length})
          </button>
        </div>
      </div>

      {/* Main Table or Empty State */}
      {displayedList.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-[5px] border border-dashed border-[var(--border)] bg-[var(--card)] py-16 text-center">
          <Clock size={36} className="text-[var(--muted-foreground)] opacity-40 mb-3" />
          <h4 className="font-headline text-base font-semibold text-[var(--foreground)]">
            No Upcoming Renewals
          </h4>
          <p className="mt-1 text-xs text-[var(--muted-foreground)] max-w-sm">
            There are no {subTab === "pro" ? "Pro Plan" : subTab === "trial" ? "Free Trial" : ""} upcoming renewals found.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-[5px] border border-[var(--border)] bg-[var(--card)] shadow-card">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-[var(--border)] bg-[var(--accent)]/50 font-mono text-[10px] font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
                <tr>
                  <th scope="col" className="px-4 py-3">Company & Owner</th>
                  <th scope="col" className="px-4 py-3">Plan Tier</th>
                  <th scope="col" className="px-4 py-3">Expiry / Countdown</th>
                  <th scope="col" className="px-4 py-3">Contact Details</th>
                  <th scope="col" className="px-4 py-3">Follow-Up</th>
                  <th scope="col" className="px-4 py-3 whitespace-nowrap">Follow-Up Note</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {displayedList.map((company) => {
                  const validity = getDaysRemaining(company.membershipExpiresAt, company.subscriptionPlan);
                  const currentStatus = getStatus(company);

                  return (
                    <tr
                      key={company.id}
                      className="transition-colors hover:bg-neutral-100 dark:hover:bg-neutral-800/50"
                    >
                      {/* Name & Company */}
                      <td className="px-4 py-3.5">
                        <button
                          onClick={() => onSelectCompany(company)}
                          className="text-left flex flex-col"
                        >
                          <span className="font-semibold text-[var(--foreground)] hover:underline">
                            {company.businessName}
                          </span>
                          <span className="text-[11px] text-[var(--muted-foreground)] font-medium">
                            Owner: {company.ownerName || "Unnamed User"}
                          </span>
                          {company.username && (
                            <span className="font-mono text-[10px] text-[var(--muted-foreground)]">
                              @{company.username}
                            </span>
                          )}
                        </button>
                      </td>

                      {/* Plan Tier Badge */}
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-[4px] font-mono text-[11px] font-semibold border ${
                            company.subscriptionPlan === "trial"
                              ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                              : "bg-[var(--accent)] text-[var(--foreground)] border-[var(--border)]"
                          }`}
                        >
                          {company.subscriptionPlan === "trial" ? "Free Trial" : "Pro Plan"}
                        </span>
                      </td>

                      {/* Expiry Date */}
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <div className="space-y-0.5">
                          <span className="font-mono font-medium text-[var(--foreground)] block">
                            {formatDate(company.membershipExpiresAt)}
                          </span>
                          <span className="text-[11px] font-bold text-amber-600 dark:text-amber-400 block font-mono">
                            {validity.label}
                          </span>
                        </div>
                      </td>

                      {/* Contact Details */}
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <div className="space-y-1">
                          {company.phoneNumber ? (
                            <a
                              href={`tel:${company.phoneNumber}`}
                              className="flex items-center gap-1.5 text-[11px] font-mono text-[var(--foreground)] hover:underline"
                            >
                              <Phone size={11} className="text-[var(--muted-foreground)] shrink-0" />
                              <span>{company.phoneNumber}</span>
                            </a>
                          ) : (
                            <span className="text-[10px] text-[var(--muted-foreground)] font-mono">No phone</span>
                          )}

                          {company.email && (
                            <a
                              href={`mailto:${company.email}`}
                              className="flex items-center gap-1.5 text-[10px] font-mono text-[var(--muted-foreground)] hover:text-[var(--foreground)] truncate max-w-[160px]"
                            >
                              <Mail size={11} className="text-[var(--muted-foreground)] shrink-0" />
                              <span className="truncate">{company.email}</span>
                            </a>
                          )}
                        </div>
                      </td>

                      {/* Follow-up Dropdown */}
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <select
                          value={currentStatus}
                          onChange={(e) =>
                            handleStatusChange(
                              company,
                              e.target.value as "unattended" | "attended"
                            )
                          }
                          className="rounded-[5px] border border-[var(--border)] bg-[var(--background)] px-2 py-1 text-xs font-semibold text-[var(--foreground)] outline-none cursor-pointer"
                        >
                          <option value="unattended">Unattended</option>
                          <option value="attended">Attended</option>
                        </select>
                      </td>

                      {/* Follow-up Note Button */}
                      <td className="px-4 py-3.5 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                        {company.followUpNotes ? (
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleOpenNoteModal(company)}
                              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[5px] border border-[var(--border)] bg-[var(--accent)] hover:border-[var(--foreground)] text-xs font-medium text-[var(--foreground)] transition-colors cursor-pointer"
                              title={company.followUpNotes}
                            >
                              <FileText size={12} className="text-[var(--primary)] shrink-0" />
                              <span>View / Edit Note</span>
                            </button>
                            <span className="text-[11px] text-[var(--muted-foreground)] max-w-[130px] truncate" title={company.followUpNotes}>
                              {company.followUpNotes}
                            </span>
                          </div>
                        ) : (
                          <button
                            onClick={() => handleOpenNoteModal(company)}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[5px] border border-dashed border-[var(--border)] hover:border-[var(--foreground)] text-xs font-medium text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors cursor-pointer"
                          >
                            <PlusCircle size={12} className="shrink-0" />
                            <span>Add Note</span>
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Renewal Follow-up Note Modal */}
      {noteModalTarget && (
        <Modal
          isOpen={Boolean(noteModalTarget)}
          onClose={() => setNoteModalTarget(null)}
          title={`Renewal Follow-up: ${noteModalTarget.businessName}`}
        >
          <div className="space-y-4 pt-2">
            <div>
              <p className="text-xs font-semibold text-[var(--foreground)]">
                Owner: {noteModalTarget.ownerName} {noteModalTarget.phoneNumber ? `• ${noteModalTarget.phoneNumber}` : ""}
              </p>
              <p className="text-[11px] text-[var(--muted-foreground)] mt-0.5">
                Expiry: {noteModalTarget.membershipExpiresAt ? formatDate(noteModalTarget.membershipExpiresAt) : "N/A"}
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[var(--foreground)]">
                Follow-up Discussion Notes:
              </label>
              <textarea
                rows={6}
                value={noteModalText}
                onChange={(e) => setNoteModalText(e.target.value)}
                placeholder="Enter client renewal discussion details, agreed terms, callback requests, or invoice notes..."
                className="w-full rounded-[5px] border border-[var(--border)] bg-[var(--background)] p-3 text-xs text-[var(--foreground)] outline-none focus:border-[var(--foreground)] resize-none"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-[var(--border)]">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setNoteModalTarget(null)}
                disabled={isSavingNote}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={handleSaveModalNote}
                isLoading={isSavingNote}
              >
                Save Note
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
