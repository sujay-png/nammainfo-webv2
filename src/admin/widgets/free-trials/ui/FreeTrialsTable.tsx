"use client";

import React, { useState } from "react";
import {
  Clock,
  Calendar,
  Phone,
  Mail,
  Check,
  PlusCircle,
  ExternalLink,
  MessageSquare,
  FileText,
  ChevronDown,
} from "lucide-react";
import { Button } from "@/admin/shared/ui/Button";
import { Modal } from "@/admin/shared/ui/Modal";
import { formatDate, getDaysRemaining } from "@/admin/shared/lib/formatters";
import { extendFreeTrial, updateTrialFollowUp } from "@/admin/entities/company/api/company-api";
import type { Company } from "@/admin/entities/company/model/types";

interface FreeTrialsTableProps {
  companies: Company[];
  loading: boolean;
  onRefresh: () => void;
  onSelectCompany: (company: Company) => void;
}

const DAY_MS = 24 * 60 * 60 * 1000;

interface FollowUpSchedule {
  daysActive: number;
  currentCycle: number; // 1 to 5 (current 20-day interval)
  displayMilestone: number; // which follow-up number to display (1 to 5)
  nextDate: Date;
  daysToNextDate: number;
  isAttended: boolean;
  status: "unattended" | "attended";
}

function calculateFollowUpSchedule(
  startedAtString: string | null | undefined,
  attendedMilestone: number = 0
): FollowUpSchedule {
  const started = startedAtString ? new Date(startedAtString).getTime() : Date.now();
  const now = Date.now();
  const daysActive = Math.max(0, Math.floor((now - started) / DAY_MS));

  // Current 20-day cycle: Days 0-20 -> 1, Days 21-40 -> 2, etc.
  const currentCycle = Math.min(5, Math.floor(daysActive / 20) + 1);

  // If attendedMilestone is >= currentCycle, the current cycle has already been completed!
  const isCurrentAttended = attendedMilestone >= currentCycle;

  let displayMilestone: number;
  if (!isCurrentAttended) {
    // Current cycle is pending attendance
    displayMilestone = currentCycle;
  } else {
    // Current cycle was attended, target is the next milestone
    displayMilestone = Math.min(5, currentCycle + 1);
  }

  const targetDay = displayMilestone * 20;
  const nextDate = new Date(started + targetDay * DAY_MS);
  const daysToNextDate = targetDay - daysActive;

  return {
    daysActive,
    currentCycle,
    displayMilestone,
    nextDate,
    daysToNextDate,
    isAttended: isCurrentAttended,
    status: isCurrentAttended ? "attended" : "unattended",
  };
}

export const FreeTrialsTable: React.FC<FreeTrialsTableProps> = ({
  companies,
  loading,
  onRefresh,
  onSelectCompany,
}) => {
  // Filter companies that are actively or previously on Free Trial
  const trialList = companies.filter((c) => c.subscriptionPlan === "trial");

  // Local state for follow-up notes & status per company
  const [followUpNotes, setFollowUpNotes] = useState<Record<string, string>>({});
  const [followUpStatuses, setFollowUpStatuses] = useState<Record<string, "unattended" | "attended">>({});

  // Extend Modal State
  const [extendTarget, setExtendTarget] = useState<Company | null>(null);
  const [extendDays, setExtendDays] = useState<number>(15);
  const [isExtending, setIsExtending] = useState<boolean>(false);
  const [extendSuccessMsg, setExtendSuccessMsg] = useState<string | null>(null);

  // Follow-up Note Modal State
  const [noteModalTarget, setNoteModalTarget] = useState<Company | null>(null);
  const [noteModalText, setNoteModalText] = useState<string>("");
  const [isSavingNote, setIsSavingNote] = useState<boolean>(false);

  const getNote = (c: Company) =>
    followUpNotes[c.id] !== undefined ? followUpNotes[c.id] : c.trialFollowUpNotes || "";

  const getStatus = (c: Company, schedule: FollowUpSchedule): "unattended" | "attended" => {
    if (followUpStatuses[c.id] !== undefined) {
      return followUpStatuses[c.id];
    }
    return schedule.status;
  };

  const handleOpenNoteModal = (company: Company) => {
    setNoteModalTarget(company);
    setNoteModalText(getNote(company));
  };

  const handleSaveModalNote = async () => {
    if (!noteModalTarget) return;
    setIsSavingNote(true);
    try {
      const schedule = calculateFollowUpSchedule(
        noteModalTarget.subscriptionStartedAt,
        noteModalTarget.trialFollowUpMilestone || 0
      );
      const status = getStatus(noteModalTarget, schedule);

      await updateTrialFollowUp(noteModalTarget.id, {
        status,
        notes: noteModalText.trim(),
        milestone: status === "attended" ? schedule.currentCycle : noteModalTarget.trialFollowUpMilestone || 0,
      });

      setFollowUpNotes((prev) => ({ ...prev, [noteModalTarget.id]: noteModalText.trim() }));
      setNoteModalTarget(null);
      onRefresh();
    } catch (err: any) {
      alert(`Failed to save note: ${err.message}`);
    } finally {
      setIsSavingNote(false);
    }
  };

  const handleStatusChange = async (company: Company, newStatus: "unattended" | "attended") => {
    const schedule = calculateFollowUpSchedule(
      company.subscriptionStartedAt,
      company.trialFollowUpMilestone || 0
    );

    const updatedMilestone =
      newStatus === "attended"
        ? schedule.currentCycle
        : Math.max(0, schedule.currentCycle - 1);

    setFollowUpStatuses((prev) => ({ ...prev, [company.id]: newStatus }));

    try {
      await updateTrialFollowUp(company.id, {
        status: newStatus,
        notes: getNote(company),
        milestone: updatedMilestone,
      });
      onRefresh();
    } catch (err: any) {
      alert(`Failed to update follow-up status: ${err.message}`);
    }
  };

  const handleConfirmExtension = async () => {
    if (!extendTarget || extendDays <= 0) return;
    setIsExtending(true);
    try {
      const res = await extendFreeTrial(extendTarget.id, extendDays);
      setExtendSuccessMsg(res.message);
      setTimeout(() => {
        setExtendSuccessMsg(null);
        setExtendTarget(null);
        onRefresh();
      }, 1500);
    } catch (err: any) {
      alert(`Failed to extend trial: ${err.message}`);
    } finally {
      setIsExtending(false);
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

  if (trialList.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-[5px] border border-dashed border-[var(--border)] bg-[var(--card)] py-16 text-center">
        <Clock size={32} className="text-[var(--muted-foreground)] opacity-40 mb-3" />
        <h4 className="font-headline text-base font-semibold text-[var(--foreground)]">
          No Active Free Trial Accounts
        </h4>
        <p className="mt-1 text-xs text-[var(--muted-foreground)] max-w-sm">
          There are currently no companies on the 100-day Free Trial program. When applications are approved from the <strong>Pending Trials</strong> tab, they will appear here with automated 20-day follow-up schedules.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Main Table */}
      <div className="overflow-hidden rounded-[5px] border border-[var(--border)] bg-[var(--card)] shadow-card">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-[var(--border)] bg-[var(--accent)]/50 font-mono text-[11px] uppercase tracking-wider text-[var(--muted-foreground)]">
              <tr>
                <th scope="col" className="px-5 py-3">Company & Owner</th>
                <th scope="col" className="px-4 py-3">100-Day Countdown</th>
                <th scope="col" className="px-4 py-3">Next Follow-Up</th>
                <th scope="col" className="px-4 py-3">Status</th>
                <th scope="col" className="px-4 py-3 whitespace-nowrap">Notes & Feedback</th>
                <th scope="col" className="px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {trialList.map((company) => {
                const validity = getDaysRemaining(company.membershipExpiresAt, company.subscriptionPlan);
                const schedule = calculateFollowUpSchedule(
                  company.subscriptionStartedAt,
                  company.trialFollowUpMilestone || 0
                );
                const currentStatus = getStatus(company, schedule);
                const extensionDays = company.trialExtensionDays || 0;
                const noteText = getNote(company);

                // WhatsApp clean URL
                const rawPhone = company.phone ? company.phone.replace(/[^0-9]/g, "") : null;
                const waUrl = rawPhone ? `https://wa.me/${rawPhone.startsWith("91") ? rawPhone : `91${rawPhone}`}` : null;

                return (
                  <tr
                    key={company.id}
                    className="transition-colors hover:bg-neutral-100 dark:hover:bg-neutral-800/50"
                  >
                    {/* Company Info */}
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
                            className="text-left font-semibold text-[var(--foreground)] hover:underline truncate block max-w-[190px]"
                          >
                            {company.businessName}
                          </button>
                          <div className="flex items-center gap-1.5 text-[11px] text-[var(--muted-foreground)]">
                            <span className="truncate max-w-[120px]">Owner: {company.ownerName}</span>
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

                    {/* 100-Day Countdown */}
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`font-mono text-xs font-bold ${
                              validity.isExpired
                                ? "text-rose-500"
                                : validity.days <= 15
                                ? "text-amber-500"
                                : "text-[var(--foreground)]"
                            }`}
                          >
                            {validity.isExpired ? "Trial Expired" : `${validity.days} days left`}
                          </span>
                          {extensionDays > 0 && (
                            <span className="inline-flex items-center px-1.5 py-0.2 rounded font-mono text-[9px] font-semibold bg-[var(--accent)] text-[var(--foreground)] border border-[var(--border)]">
                              +{extensionDays}d
                            </span>
                          )}
                        </div>
                        <p className="font-mono text-[10px] text-[var(--muted-foreground)]">
                          Day {schedule.daysActive} of 100 • Exp: {formatDate(company.membershipExpiresAt)}
                        </p>
                      </div>
                    </td>

                    {/* Dynamic Next Follow-up Date */}
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-1.5">
                          <Calendar size={12} className="text-[var(--muted-foreground)] shrink-0" />
                          <span className="font-semibold text-xs text-[var(--foreground)]">
                            {formatDate(schedule.nextDate.toISOString())}
                          </span>
                        </div>
                        <p className="font-mono text-[10px] text-[var(--muted-foreground)]">
                          {schedule.daysToNextDate > 0
                            ? `Due in ${schedule.daysToNextDate} days`
                            : schedule.daysToNextDate === 0
                            ? "Due today"
                            : `Overdue by ${Math.abs(schedule.daysToNextDate)} days`}{" "}
                          • Follow-up {schedule.displayMilestone} of 5
                        </p>
                      </div>
                    </td>

                    {/* Clean Status Selector (Attended / Unattended) */}
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      <div className="relative inline-flex items-center">
                        <select
                          value={currentStatus}
                          onChange={(e) =>
                            handleStatusChange(
                              company,
                              e.target.value as "unattended" | "attended"
                            )
                          }
                          className={`appearance-none rounded-[5px] border pl-2.5 pr-6 py-1 text-xs font-mono font-medium outline-none transition-colors cursor-pointer ${
                            currentStatus === "attended"
                              ? "border-[var(--border)] bg-[var(--accent)] text-[var(--foreground)] font-semibold"
                              : "border-[var(--border)] bg-[var(--card)] text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:border-[var(--foreground)]/40"
                          }`}
                        >
                          <option value="unattended">Unattended</option>
                          <option value="attended">Attended</option>
                        </select>
                        <ChevronDown size={11} className="pointer-events-none absolute right-2 text-[var(--muted-foreground)]" />
                      </div>
                    </td>

                    {/* Notes & Feedback Button */}
                    <td className="px-4 py-3.5 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                      {noteText ? (
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleOpenNoteModal(company)}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[5px] border border-[var(--border)] bg-[var(--accent)] hover:border-[var(--foreground)] text-xs font-medium text-[var(--foreground)] transition-colors cursor-pointer"
                            title={noteText}
                          >
                            <FileText size={12} className="text-[var(--foreground)] shrink-0" />
                            <span>View / Edit Note</span>
                          </button>
                          <span className="text-[11px] text-[var(--muted-foreground)] max-w-[130px] truncate" title={noteText}>
                            {noteText}
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

                    {/* Action Controls */}
                    <td className="px-5 py-3.5 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1.5">
                        {/* WhatsApp / Phone links */}
                        {waUrl && (
                          <a
                            href={waUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex h-7 w-7 items-center justify-center rounded-[5px] border border-[var(--border)] bg-[var(--accent)] text-[var(--foreground)] hover:border-[var(--foreground)] transition-colors"
                            title="Chat on WhatsApp"
                          >
                            <MessageSquare size={13} />
                          </a>
                        )}
                        {company.phone && (
                          <a
                            href={`tel:${company.phone}`}
                            className="inline-flex h-7 w-7 items-center justify-center rounded-[5px] border border-[var(--border)] bg-[var(--accent)] text-[var(--foreground)] hover:border-[var(--foreground)] transition-colors"
                            title="Call phone"
                          >
                            <Phone size={13} />
                          </a>
                        )}

                        {/* Extend Trial Button */}
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => {
                            setExtendTarget(company);
                            setExtendDays(15);
                          }}
                          className="text-xs font-semibold ml-1"
                        >
                          <PlusCircle size={12} className="mr-1" />
                          Extend Trial
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Custom Extension Modal */}
      {extendTarget && (
        <Modal
          isOpen={Boolean(extendTarget)}
          onClose={() => setExtendTarget(null)}
          title={`Extend Free Trial: ${extendTarget.businessName}`}
        >
          <div className="space-y-4 pt-2">
            <p className="text-xs text-[var(--muted-foreground)]">
              Specify how many days to extend the Free Trial for{" "}
              <strong className="text-[var(--foreground)]">{extendTarget.ownerName}</strong>. The user will be notified on their dashboard with an invitation to upgrade to Pro.
            </p>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[var(--foreground)]">
                Number of Extension Days:
              </label>
              <input
                type="number"
                min="1"
                max="365"
                placeholder="e.g. 15, 30"
                value={extendDays || ""}
                onChange={(e) => setExtendDays(parseInt(e.target.value, 10) || 0)}
                className="w-full rounded-[5px] border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm font-mono font-semibold text-[var(--foreground)] outline-none focus:border-[var(--foreground)]"
              />
              <p className="text-[11px] text-[var(--muted-foreground)]">
                Enter the exact number of days to extend this company's trial.
              </p>
            </div>

            {extendSuccessMsg && (
              <div className="rounded-[5px] border border-[var(--border)] bg-[var(--accent)] p-3 text-xs font-medium text-[var(--foreground)]">
                {extendSuccessMsg}
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-[var(--border)]">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setExtendTarget(null)}
                disabled={isExtending}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={handleConfirmExtension}
                isLoading={isExtending}
              >
                Confirm Extension (+{extendDays} Days)
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Follow-up Note Popup Modal */}
      {noteModalTarget && (
        <Modal
          isOpen={Boolean(noteModalTarget)}
          onClose={() => setNoteModalTarget(null)}
          title={`Follow-up Note: ${noteModalTarget.businessName}`}
        >
          <div className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[var(--foreground)]">
                Notes and Feedback
              </label>
              <textarea
                rows={6}
                value={noteModalText}
                onChange={(e) => setNoteModalText(e.target.value)}
                placeholder="Enter client conversation details, feedback, card usage experience, or upgrade readiness discussion..."
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
