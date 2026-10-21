"use client";

import React, { useState } from "react";
import { Phone, Mail, Clock, Save, Check, ExternalLink } from "lucide-react";
import { Badge } from "@/admin/shared/ui/Badge";
import { formatDate, getDaysRemaining } from "@/admin/shared/lib/formatters";
import { updateCompanyFollowUp } from "@/admin/entities/company/api/company-api";
import type { Company } from "@/admin/entities/company/model/types";

interface UpcomingRenewalsTableProps {
  companies: Company[];
  loading: boolean;
  onRefresh: () => void;
  onSelectCompany: (company: Company) => void;
}

export const UpcomingRenewalsTable: React.FC<UpcomingRenewalsTableProps> = ({
  companies,
  loading,
  onRefresh,
  onSelectCompany,
}) => {
  // Filter only companies with upcoming renewals in the next 15 days
  const upcomingList = companies.filter((c) => {
    if (c.subscriptionPlan !== "pro" || !c.membershipExpiresAt) return false;
    const diff = new Date(c.membershipExpiresAt).getTime() - Date.now();
    return diff > 0 && diff <= 15 * 86400000;
  });

  // Local state for follow-up notes & status per company
  const [followUpNotes, setFollowUpNotes] = useState<Record<string, string>>({});
  const [followUpStatuses, setFollowUpStatuses] = useState<Record<string, "unattended" | "attended">>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [savedSuccessId, setSavedSuccessId] = useState<string | null>(null);

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

  const handleSaveNote = async (company: Company) => {
    const note = getNote(company);
    setSavingId(company.id);
    try {
      await updateCompanyFollowUp(company.id, {
        status: getStatus(company),
        notes: note,
      });
      setSavedSuccessId(company.id);
      setTimeout(() => setSavedSuccessId(null), 2000);
      onRefresh();
    } catch (err: any) {
      alert(`Failed to save note: ${err.message}`);
    } finally {
      setSavingId(null);
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

  if (upcomingList.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-[5px] border border-dashed border-[var(--border)] bg-[var(--card)] py-16 text-center">
        <Clock size={36} className="text-[var(--muted-foreground)] opacity-40 mb-3" />
        <h4 className="font-headline text-base font-semibold text-[var(--foreground)]">
          No Upcoming Renewals
        </h4>
        <p className="mt-1 text-xs text-[var(--muted-foreground)] max-w-sm">
          There are no Pro plan subscriptions expiring within the next 15 days.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-[5px] border border-[var(--border)] bg-[var(--card)]">
      <div className="border-b border-[var(--border)] bg-[var(--accent)]/30 px-5 py-3 flex items-center justify-between">
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--foreground)]">
            Upcoming Pro Renewals (Next 15 Days)
          </h3>
          <p className="text-[11px] text-[var(--muted-foreground)]">
            {upcomingList.length} company account{upcomingList.length === 1 ? "" : "s"} require attention
          </p>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="border-b border-[var(--border)] bg-[var(--accent)]/50 font-mono text-[10px] font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
            <tr>
              <th scope="col" className="px-4 py-3">Name & Company</th>
              <th scope="col" className="px-4 py-3">Member Since</th>
              <th scope="col" className="px-4 py-3">Renewal Date</th>
              <th scope="col" className="px-4 py-3">Contact Details</th>
              <th scope="col" className="px-4 py-3">Follow-Up</th>
              <th scope="col" className="px-4 py-3">Follow-Up Note</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border)]">
            {upcomingList.map((company) => {
              const validity = getDaysRemaining(company.membershipExpiresAt, company.subscriptionPlan);
              const currentStatus = getStatus(company);
              const currentNote = getNote(company);
              const isSaving = savingId === company.id;
              const isSaved = savedSuccessId === company.id;

              return (
                <tr
                  key={company.id}
                  className="transition-colors hover:bg-neutral-100 dark:hover:bg-neutral-800/50"
                >
                  {/* Name & Company Name */}
                  <td className="px-4 py-3.5">
                    <button
                      onClick={() => onSelectCompany(company)}
                      className="text-left flex flex-col"
                    >
                      <span className="font-semibold text-[var(--foreground)]">
                        {company.ownerName || "Unnamed User"}
                      </span>
                      <span className="text-[11px] text-[var(--muted-foreground)] font-medium">
                        {company.businessName}
                      </span>
                      {company.username && (
                        <span className="font-mono text-[10px] text-[var(--muted-foreground)]">
                          @{company.username}
                        </span>
                      )}
                    </button>
                  </td>

                  {/* Member Since */}
                  <td className="px-4 py-3.5 font-mono text-[11px] text-[var(--muted-foreground)] whitespace-nowrap">
                    {formatDate(company.createdAt)}
                  </td>

                  {/* Renewal Date */}
                  <td className="px-4 py-3.5 whitespace-nowrap">
                    <div className="space-y-0.5">
                      <span className="font-mono font-medium text-[var(--foreground)] block">
                        {formatDate(company.membershipExpiresAt)}
                      </span>
                      <span className="text-[10px] font-semibold text-amber-600 dark:text-amber-400 block">
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
                          className="flex items-center gap-1.5 text-[11px] font-medium text-[var(--foreground)] hover:underline transition-colors"
                        >
                          <Phone size={12} className="text-[var(--muted-foreground)] shrink-0" />
                          <span>{company.phoneNumber}</span>
                        </a>
                      ) : (
                        <span className="text-[10px] text-[var(--muted-foreground)]">No phone</span>
                      )}

                      {company.email && (
                        <a
                          href={`mailto:${company.email}`}
                          className="flex items-center gap-1.5 text-[10px] text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors truncate max-w-[160px]"
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
                      className="rounded-[5px] border border-[var(--border)] bg-[var(--background)] px-2 py-1 text-xs font-medium text-[var(--foreground)] outline-none"
                    >
                      <option value="unattended">Unattended</option>
                      <option value="attended">Attended</option>
                    </select>
                  </td>

                  {/* Follow-up Details (Short Note) */}
                  <td className="px-4 py-3.5">
                    <div className="flex items-center gap-1.5 min-w-[220px]">
                      <input
                        type="text"
                        placeholder="Add quick follow-up note..."
                        value={currentNote}
                        onChange={(e) =>
                          setFollowUpNotes((prev) => ({
                            ...prev,
                            [company.id]: e.target.value,
                          }))
                        }
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleSaveNote(company);
                        }}
                        className="w-full rounded-[5px] border border-[var(--border)] bg-[var(--background)] px-2.5 py-1 text-xs text-[var(--foreground)] placeholder-[var(--muted-foreground)] outline-none focus:border-[var(--foreground)]"
                      />
                      <button
                        type="button"
                        onClick={() => handleSaveNote(company)}
                        disabled={isSaving}
                        title="Save follow-up note"
                        className="rounded-[5px] border border-[var(--border)] bg-[var(--background)] p-1.5 text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--accent)] transition-colors shrink-0"
                      >
                        {isSaved ? (
                          <Check size={13} className="text-emerald-600" />
                        ) : (
                          <Save size={13} />
                        )}
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
