"use client";

import React, { useState, useEffect } from "react";
import {
  Phone,
  Calendar,
  Users,
  Trash2,
  ExternalLink,
  Plus,
  Clock,
  Search,
  Loader2,
  Check,
} from "lucide-react";
import { Modal } from "@/admin/shared/ui/Modal";
import { Badge } from "@/admin/shared/ui/Badge";
import { Button } from "@/admin/shared/ui/Button";
import {
  formatDate,
  formatDateInput,
  getDaysRemaining,
} from "@/admin/shared/lib/formatters";
import {
  fetchCompanyDetails,
  updateCompanyValidity,
} from "@/admin/entities/company/api/company-api";
import type {
  Company,
  CompanyWithEmployees,
  SubscriptionPlanType,
} from "@/admin/entities/company/model/types";

interface CompanyDetailModalProps {
  company: Company | null;
  isOpen: boolean;
  onClose: () => void;
  onRefresh: () => void;
  onDeleteRequest: (company: Company) => void;
}

export const CompanyDetailModal: React.FC<CompanyDetailModalProps> = ({
  company,
  isOpen,
  onClose,
  onRefresh,
  onDeleteRequest,
}) => {
  const [details, setDetails] = useState<CompanyWithEmployees | null>(null);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<"overview" | "subscription" | "employees">("overview");

  // Plan and Date Form state for Company
  const [editPlan, setEditPlan] = useState<SubscriptionPlanType>("free");
  const [editStartDate, setEditStartDate] = useState<string>("");
  const [editExpiryDate, setEditExpiryDate] = useState<string>("");

  // Search in team tab
  const [empSearch, setEmpSearch] = useState<string>("");

  // Save Feedback State
  const [savedSuccess, setSavedSuccess] = useState<boolean>(false);

  useEffect(() => {
    if (company && isOpen) {
      setLoading(true);
      fetchCompanyDetails(company.id)
        .then((data) => {
          setDetails(data);
          const activePlan = data.subscriptionPlan === "pro" ? "pro" : "free";
          setEditPlan(activePlan);
          setEditStartDate(activePlan === "pro" ? formatDateInput(data.subscriptionStartedAt) : "");
          setEditExpiryDate(activePlan === "pro" ? formatDateInput(data.membershipExpiresAt) : "");
        })
        .catch((err) => {
          console.error("Failed to load company details:", err);
        })
        .finally(() => setLoading(false));
    } else {
      setDetails(null);
    }
  }, [company, isOpen]);

  if (!company) return null;

  const current = details || {
    ...company,
    employees: [],
  };

  const validity = getDaysRemaining(current.membershipExpiresAt, current.subscriptionPlan);
  const isExpired = current.status === "expired" || (!validity.isLifetime && validity.isExpired);
  const teamCount = current.employees?.length || 0;

  // Helper: exactly 1 year later (e.g. 2026-10-21 -> 2027-10-21)
  const calculateOneYearLater = (dateStr: string): string => {
    if (!dateStr || !dateStr.includes("-")) return "";
    const [y, m, d] = dateStr.split("-").map(Number);
    if (!y || !m || !d) return "";
    if (m === 2 && d === 29) {
      const nextY = y + 1;
      const isLeap = (nextY % 4 === 0 && nextY % 100 !== 0) || (nextY % 400 === 0);
      return `${nextY}-02-${isLeap ? "29" : "28"}`;
    }
    const nextY = y + 1;
    const mm = String(m).padStart(2, "0");
    const dd = String(d).padStart(2, "0");
    return `${nextY}-${mm}-${dd}`;
  };

  // Plan Selection handler
  const handlePlanSelect = (newPlan: SubscriptionPlanType) => {
    setEditPlan(newPlan);
    if (newPlan === "pro") {
      const today = new Date().toISOString().split("T")[0];
      const start = editStartDate || today;
      setEditStartDate(start);
      setEditExpiryDate(calculateOneYearLater(start));
    } else if (newPlan === "free") {
      setEditStartDate("");
      setEditExpiryDate("");
    }
  };

  // Start Date change handler: automatically sets expiry date to 1 year later
  const handleStartDateChange = (val: string) => {
    setEditStartDate(val);
    if (val) {
      setEditExpiryDate(calculateOneYearLater(val));
    }
  };

  // Direct Save Company Plan & Dates (Cascades automatically to team)
  const handleSaveCompanyPlan = async () => {
    const finalExpiry = editPlan === "free"
      ? null
      : editExpiryDate
      ? new Date(`${editExpiryDate}T23:59:59.000Z`).toISOString()
      : null;

    const finalStart = editPlan === "free"
      ? null
      : editStartDate
      ? new Date(editStartDate).toISOString()
      : null;

    setActionLoading(true);
    try {
      await updateCompanyValidity(current.id, {
        subscriptionPlan: editPlan,
        subscriptionStartedAt: finalStart,
        membershipExpiresAt: finalExpiry,
        primaryCardCount: editPlan === "free" ? 0 : 1,
      });

      setDetails((prev) =>
        prev
          ? {
              ...prev,
              subscriptionPlan: editPlan,
              subscriptionStartedAt: finalStart,
              membershipExpiresAt: finalExpiry,
              primaryCardCount: editPlan === "free" ? 0 : 1,
              employees: (prev.employees || []).map((e) => ({
                ...e,
                isPremium: editPlan !== "free",
                subscriptionStartedAt: finalStart,
                subscriptionExpiresAt: finalExpiry,
              })),
            }
          : null
      );

      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 2500);
      onRefresh();
    } catch (err: any) {
      alert(`Failed to update validity: ${err.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  // Direct Quick Extend 1 Year
  const handleExtend1Year = async () => {
    const baseDate = editExpiryDate
      ? new Date(`${editExpiryDate}T23:59:59.000Z`).getTime()
      : current.membershipExpiresAt
      ? new Date(current.membershipExpiresAt).getTime()
      : Date.now();
    const newExpiry = new Date(baseDate + 365 * 24 * 60 * 60 * 1000).toISOString();

    setActionLoading(true);
    try {
      await updateCompanyValidity(current.id, {
        subscriptionPlan: "pro",
        membershipExpiresAt: newExpiry,
      });

      setDetails((prev) =>
        prev
          ? {
              ...prev,
              subscriptionPlan: "pro",
              membershipExpiresAt: newExpiry,
              employees: (prev.employees || []).map((e) => ({
                ...e,
                isPremium: true,
                subscriptionExpiresAt: newExpiry,
              })),
            }
          : null
      );
      setEditPlan("pro");
      setEditExpiryDate(formatDateInput(newExpiry));
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 2500);
      onRefresh();
    } catch (err: any) {
      alert(`Failed to extend validity: ${err.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <>
      <Modal isOpen={isOpen} onClose={onClose} maxWidth="3xl">
        <div className="space-y-5">
          {/* Modal Header */}
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-center gap-3 min-w-0">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[5px] bg-[var(--accent)] font-headline text-base font-bold text-[var(--foreground)] border border-[var(--border)]">
                {current.avatarUrl ? (
                  <img
                    src={current.avatarUrl}
                    alt=""
                    className="h-full w-full rounded-[5px] object-cover"
                  />
                ) : (
                  current.businessName.charAt(0).toUpperCase()
                )}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="font-headline text-base sm:text-lg font-bold text-[var(--foreground)] truncate">
                    {current.businessName}
                  </h3>
                  {current.username && (
                    <a
                      href={`/${current.username}`}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-1 text-xs text-[var(--muted-foreground)] hover:text-[var(--foreground)] shrink-0"
                    >
                      <span>@{current.username}</span>
                      <ExternalLink size={12} />
                    </a>
                  )}
                </div>
                <p className="text-xs text-[var(--muted-foreground)] truncate">
                  Owner: <span className="font-medium text-[var(--foreground)]">{current.ownerName}</span>
                  {current.email && ` • ${current.email}`}
                </p>
              </div>
            </div>

            <div className="shrink-0">
              <Badge variant={current.subscriptionPlan === "pro" ? "pro" : "free"}>
                {current.subscriptionPlan === "pro" ? "Pro" : "Free"}
              </Badge>
            </div>
          </div>

          {/* Tab Navigation */}
          <div className="flex border-b border-[var(--border)] overflow-x-auto no-scrollbar gap-1">
            <button
              onClick={() => setActiveTab("overview")}
              className={`border-b-2 px-3.5 py-2 text-xs font-semibold uppercase tracking-wider transition-all whitespace-nowrap ${
                activeTab === "overview"
                  ? "border-[var(--foreground)] text-[var(--foreground)]"
                  : "border-transparent text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
              }`}
            >
              Overview & Details
            </button>
            <button
              onClick={() => setActiveTab("subscription")}
              className={`border-b-2 px-3.5 py-2 text-xs font-semibold uppercase tracking-wider transition-all whitespace-nowrap ${
                activeTab === "subscription"
                  ? "border-[var(--foreground)] text-[var(--foreground)]"
                  : "border-transparent text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
              }`}
            >
              Subscription & Validity
            </button>
            <button
              onClick={() => setActiveTab("employees")}
              className={`border-b-2 px-3.5 py-2 text-xs font-semibold uppercase tracking-wider transition-all whitespace-nowrap flex items-center gap-1.5 ${
                activeTab === "employees"
                  ? "border-[var(--foreground)] text-[var(--foreground)]"
                  : "border-transparent text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
              }`}
            >
              <span>Team Members</span>
              <span className="font-mono text-[10px] text-[var(--muted-foreground)]">
                ({teamCount})
              </span>
            </button>
          </div>

          {/* Tab 1: Overview */}
          {activeTab === "overview" && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="rounded-[5px] border border-[var(--border)] bg-[var(--accent)]/30 p-3.5 space-y-1">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
                    Contact Phone
                  </span>
                  <p className="font-medium text-sm text-[var(--foreground)]">
                    {current.phone || "Not provided"}
                  </p>
                </div>
                <div className="rounded-[5px] border border-[var(--border)] bg-[var(--accent)]/30 p-3.5 space-y-1">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
                    Registered On
                  </span>
                  <p className="font-medium text-sm text-[var(--foreground)]">
                    {formatDate(current.createdAt)}
                  </p>
                </div>
                <div className="rounded-[5px] border border-[var(--border)] bg-[var(--accent)]/30 p-3.5 space-y-1">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
                    Team Members
                  </span>
                  <p className="font-medium text-sm text-[var(--foreground)]">
                    {teamCount > 0 ? `${teamCount} Team Member${teamCount === 1 ? "" : "s"}` : "0 Team Members"}
                  </p>
                </div>
                <div className="rounded-[5px] border border-[var(--border)] bg-[var(--accent)]/30 p-3.5 space-y-1">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
                    Subscription Validity
                  </span>
                  <p className="font-medium text-sm text-[var(--foreground)]">
                    {current.subscriptionPlan === "free"
                      ? "N/A"
                      : `${validity.label} (until ${formatDate(current.membershipExpiresAt)})`}
                  </p>
                </div>
              </div>

              {/* Danger Zone: Delete Company (Fully Responsive) */}
              <div className="pt-2">
                <div className="rounded-[5px] border border-[var(--border)] bg-[var(--card)] p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="space-y-0.5">
                    <h5 className="text-xs font-semibold text-[var(--foreground)]">
                      Delete Company Record
                    </h5>
                    <p className="text-[11px] text-[var(--muted-foreground)]">
                      Permanently remove this company, profile, and all associated team members.
                    </p>
                  </div>
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={() => onDeleteRequest(company)}
                    leftIcon={<Trash2 size={14} className="shrink-0" />}
                    className="w-full sm:w-auto shrink-0 whitespace-nowrap"
                  >
                    Delete Company
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Tab 2: Subscription Plan & Validity */}
          {activeTab === "subscription" && (
            <div className="space-y-4">
              <div className="rounded-[5px] border border-[var(--border)] bg-[var(--card)] p-4 sm:p-5 space-y-4">
                <div>
                  <h4 className="font-headline text-sm sm:text-base font-bold text-[var(--foreground)]">
                    Subscription Plan & Validity Settings
                  </h4>
                  <p className="text-xs text-[var(--muted-foreground)]">
                    Select active tier (Free or Pro Plan). Upgrading to Pro or extending validity applies automatically to the business owner and all team members.
                  </p>
                </div>

                {/* Plan Dropdown */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-[var(--foreground)]">
                    Subscription Plan Tier:
                  </label>
                  <select
                    value={editPlan}
                    onChange={(e) => handlePlanSelect(e.target.value as SubscriptionPlanType)}
                    className="w-full rounded-[5px] border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-xs font-medium outline-none focus:border-[var(--foreground)]"
                  >
                    <option value="free">Free Plan</option>
                    <option value="pro">Pro Plan</option>
                  </select>
                </div>

                {/* Free Plan Info */}
                {editPlan === "free" ? (
                  <div className="rounded-[5px] border border-[var(--border)] bg-[var(--accent)]/40 p-3.5 flex items-center gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[5px] bg-[var(--accent)] font-mono font-bold text-xs border border-[var(--border)]">
                      FREE
                    </div>
                    <div>
                      <p className="font-semibold text-xs text-[var(--foreground)]">
                        Free Tier Active
                      </p>
                      <p className="text-[11px] text-[var(--muted-foreground)]">
                        Account has standard profile access. Card subscription validity is N/A until upgraded to Pro.
                      </p>
                    </div>
                  </div>
                ) : (
                  /* Dates Form for Pro */
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                    {/* Start Date */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-[var(--foreground)] flex items-center gap-1.5">
                        <Calendar size={13} />
                        Subscription Start Date:
                      </label>
                      <input
                        type="date"
                        value={editStartDate}
                        onChange={(e) => handleStartDateChange(e.target.value)}
                        className="w-full rounded-[5px] border border-[var(--border)] bg-[var(--background)] px-3 py-1.5 text-xs font-medium outline-none focus:border-[var(--foreground)]"
                      />
                    </div>

                    {/* Expiry Date */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-[var(--foreground)] flex items-center justify-between">
                        <span className="flex items-center gap-1.5">
                          <Clock size={13} />
                          Subscription Expiry Date:
                        </span>
                      </label>
                      <input
                        type="date"
                        value={editExpiryDate}
                        onChange={(e) => setEditExpiryDate(e.target.value)}
                        className="w-full rounded-[5px] border border-[var(--border)] bg-[var(--background)] px-3 py-1.5 text-xs font-medium outline-none focus:border-[var(--foreground)]"
                      />
                    </div>
                  </div>
                )}

                {/* Action Controls */}
                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--border)] pt-4">
                  <div className="flex items-center gap-2">
                    {editPlan === "pro" && (
                      <button
                        type="button"
                        onClick={handleExtend1Year}
                        disabled={actionLoading}
                        className="flex items-center gap-1.5 rounded-[5px] border border-[var(--border)] bg-[var(--accent)] px-3 py-1.5 text-xs font-medium text-[var(--foreground)] hover:bg-[var(--accent)]/80 transition-colors disabled:opacity-40"
                      >
                        <Plus size={13} />
                        <span>+1 Year Extension</span>
                      </button>
                    )}
                  </div>

                  <Button
                    variant={savedSuccess ? "secondary" : "primary"}
                    size="sm"
                    onClick={handleSaveCompanyPlan}
                    isLoading={actionLoading}
                    className={savedSuccess ? "!border-emerald-500/50 !text-emerald-500 font-semibold" : ""}
                  >
                    {savedSuccess ? (
                      <span className="flex items-center gap-1.5">
                        <Check size={14} className="text-emerald-500" />
                        Saved!
                      </span>
                    ) : (
                      "Save All Changes"
                    )}
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Tab 3: Team Members List (Read-only inheritance) */}
          {activeTab === "employees" && (
            <div className="space-y-4">
              {/* Team Validity Inheritance Notice */}
              <div className="rounded-[5px] border border-[var(--border)] bg-[var(--accent)]/30 p-3.5 text-xs">
                <span className="font-semibold text-[var(--foreground)] block">
                  Automatic Team Plan & Validity Inheritance
                </span>
                <p className="mt-1 text-[11px] text-[var(--muted-foreground)] leading-relaxed">
                  All team members automatically inherit the primary company plan ({current.subscriptionPlan === "pro" ? "Pro" : "Free"}) and validity duration. When the company renews or upgrades, all team members are automatically synced.
                </p>
              </div>

              {/* Employee Search Bar */}
              {teamCount > 3 && (
                <div className="relative">
                  <Search
                    size={15}
                    className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)]"
                  />
                  <input
                    type="text"
                    placeholder="Search team member by name, designation, or email..."
                    value={empSearch}
                    onChange={(e) => setEmpSearch(e.target.value)}
                    className="w-full rounded-[5px] border border-[var(--border)] bg-[var(--background)] pl-10 pr-4 py-2 text-xs outline-none focus:border-[var(--foreground)]"
                  />
                </div>
              )}

              {/* Employee Roster */}
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 size={24} className="animate-spin text-[var(--muted-foreground)]" />
                </div>
              ) : current.employees && current.employees.length > 0 ? (
                <div className="divide-y divide-[var(--border)] rounded-[5px] border border-[var(--border)] bg-[var(--card)] overflow-hidden">
                  {(() => {
                    const roster = (current.employees || []).filter((emp) => {
                      if (!empSearch.trim()) return true;
                      const q = empSearch.toLowerCase();
                      return (
                        emp.name?.toLowerCase().includes(q) ||
                        emp.designation?.toLowerCase().includes(q) ||
                        emp.email?.toLowerCase().includes(q) ||
                        emp.slug?.toLowerCase().includes(q)
                      );
                    });

                    if (roster.length === 0) {
                      return (
                        <div className="p-8 text-center text-xs text-[var(--muted-foreground)]">
                          No team members match &quot;{empSearch}&quot;.
                        </div>
                      );
                    }

                    return roster.map((emp) => {
                      return (
                        <div
                          key={emp.id}
                          className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 hover:bg-[var(--accent)]/30 transition-colors"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[5px] bg-[var(--accent)] font-headline text-xs font-bold border border-[var(--border)]">
                              {emp.avatarUrl ? (
                                <img
                                  src={emp.avatarUrl}
                                  alt=""
                                  className="h-full w-full rounded-[5px] object-cover"
                                />
                              ) : (
                                emp.name.charAt(0).toUpperCase()
                              )}
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <p className="font-semibold text-xs text-[var(--foreground)] truncate">
                                  {emp.name}
                                </p>
                                {current.username && (
                                  <a
                                    href={`/${current.username}/${emp.slug}`}
                                    target="_blank"
                                    rel="noreferrer"
                                    title="View employee public card"
                                    className="text-[var(--muted-foreground)] hover:text-[var(--foreground)] shrink-0"
                                  >
                                    <ExternalLink size={12} />
                                  </a>
                                )}
                              </div>
                              <p className="text-[11px] text-[var(--muted-foreground)] truncate">
                                {emp.designation || "Team Member"} {emp.email ? `• ${emp.email}` : ""}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center justify-between sm:justify-end gap-3 pt-2 sm:pt-0 border-t sm:border-t-0 border-[var(--border)] shrink-0">
                            <Badge variant={current.subscriptionPlan === "pro" ? "pro" : "free"}>
                              {current.subscriptionPlan === "pro" ? "Pro" : "Free"}
                            </Badge>

                            <span className="font-mono text-[11px] text-[var(--muted-foreground)]">
                              {current.subscriptionPlan === "free"
                                ? "N/A"
                                : validity.label}
                            </span>
                          </div>
                        </div>
                      );
                    });
                  })()}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center rounded-[5px] border border-dashed border-[var(--border)] bg-[var(--card)] py-10 text-center">
                  <Users size={32} className="text-[var(--muted-foreground)] opacity-40 mb-2" />
                  <p className="text-xs font-semibold text-[var(--foreground)]">
                    No Team Members
                  </p>
                  <p className="text-[11px] text-[var(--muted-foreground)] mt-0.5">
                    This company has not added any employee profiles yet.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </Modal>
    </>
  );
};
