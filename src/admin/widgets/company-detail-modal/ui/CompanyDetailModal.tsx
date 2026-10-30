"use client";

import React, { useState, useEffect } from "react";
import {
  Phone,
  Calendar,
  Users,
  Trash2,
  ExternalLink,
  Clock,
  Search,
  Loader2,
  Check,
  QrCode,
  Copy,
  Download,
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
  updateEmployeeValidity,
} from "@/admin/entities/company/api/company-api";
import type {
  Company,
  CompanyWithEmployees,
  SubscriptionPlanType,
} from "@/admin/entities/company/model/types";
import { CompanyQrCardRow } from "./CompanyQrCardRow";
import { buildPublicCardUrl } from "@/admin/shared/lib/card-urls";

interface CompanyDetailModalProps {
  company: Company | null;
  isOpen: boolean;
  onClose: () => void;
  onRefresh: () => void;
  onDeleteRequest?: (company: Company) => void;
  readOnly?: boolean;
}

export const CompanyDetailModal: React.FC<CompanyDetailModalProps> = ({
  company,
  isOpen,
  onClose,
  onRefresh,
  onDeleteRequest,
  readOnly = false,
}) => {
  const [details, setDetails] = useState<CompanyWithEmployees | null>(null);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<"overview" | "subscription" | "employees" | "qrcodes">("overview");

  // Plan and Date Form state for Company
  const [editPlan, setEditPlan] = useState<SubscriptionPlanType>("free");
  const [editStartDate, setEditStartDate] = useState<string>("");
  const [editExpiryDate, setEditExpiryDate] = useState<string>("");

  // Search in team tab & QR tab
  const [empSearch, setEmpSearch] = useState<string>("");
  const [qrSearch, setQrSearch] = useState<string>("");

  // Save Feedback State
  const [savedSuccess, setSavedSuccess] = useState<boolean>(false);

  // State for updating an individual employee plan
  const [updatingEmpId, setUpdatingEmpId] = useState<string | null>(null);

  useEffect(() => {
    if (company?.id && isOpen) {
      setLoading(true);
      fetchCompanyDetails(company.id)
        .then((data) => {
          setDetails(data);
          const activePlan: SubscriptionPlanType =
            data.subscriptionPlan === "trial"
              ? "trial"
              : data.subscriptionPlan === "pro"
              ? "pro"
              : "free";
          setEditPlan(activePlan);
          setEditStartDate(activePlan !== "free" ? formatDateInput(data.subscriptionStartedAt) : "");
          setEditExpiryDate(activePlan !== "free" ? formatDateInput(data.membershipExpiresAt) : "");
        })
        .catch((err) => {
          console.error("Failed to load company details:", err);
        })
        .finally(() => setLoading(false));
    } else if (!isOpen) {
      setDetails(null);
    }
  }, [company?.id, isOpen]);

  if (!company) return null;

  const current = details || {
    ...company,
    employees: [],
  };

  const validity = getDaysRemaining(current.membershipExpiresAt, current.subscriptionPlan);
  const isExpired =
    (current.subscriptionPlan === "pro" || current.subscriptionPlan === "trial") &&
    (!validity.isLifetime && (validity.isExpired || (current.status === "expired" && !current.membershipExpiresAt)));
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
    const today = new Date().toISOString().split("T")[0];
    const start = editStartDate || today;
    if (newPlan === "pro") {
      setEditStartDate(start);
      if (!editExpiryDate) {
        setEditExpiryDate(calculateOneYearLater(start));
      }
    } else if (newPlan === "trial") {
      setEditStartDate(start);
      const oneHundredDaysMs = 100 * 24 * 60 * 60 * 1000;
      const exp = new Date(new Date(start).getTime() + oneHundredDaysMs).toISOString().split("T")[0];
      setEditExpiryDate(exp);
    } else if (newPlan === "free") {
      setEditStartDate("");
      setEditExpiryDate("");
    }
  };

  // Start Date change handler: automatically sets expiry date to 1 year later
  const handleStartDateChange = (val: string) => {
    setEditStartDate(val);
    if (val) {
      if (editPlan === "trial") {
        const oneHundredDaysMs = 100 * 24 * 60 * 60 * 1000;
        const exp = new Date(new Date(val).getTime() + oneHundredDaysMs).toISOString().split("T")[0];
        setEditExpiryDate(exp);
      } else {
        setEditExpiryDate(calculateOneYearLater(val));
      }
    }
  };

  // Direct Save Company Plan & Dates
  const handleSaveCompanyPlan = async () => {
    const finalExpiry = editPlan === "free"
      ? null
      : editExpiryDate
      ? new Date(`${editExpiryDate}T23:59:59.000Z`).toISOString()
      : null;

    const finalStart = editPlan === "free"
      ? null
      : editStartDate
      ? new Date(`${editStartDate}T00:00:00.000Z`).toISOString()
      : null;

    setActionLoading(true);
    try {
      await updateCompanyValidity(current.id, {
        subscriptionPlan: editPlan,
        subscriptionStartedAt: finalStart,
        membershipExpiresAt: finalExpiry,
        primaryCardCount: editPlan === "free" ? 0 : 1,
      });

      const isFuture = finalExpiry ? new Date(finalExpiry).getTime() > Date.now() : true;
      const newStatus = current.status === "suspended" ? "suspended" : (editPlan === "free" || isFuture ? "active" : "expired");

      setDetails((prev) => {
        if (!prev) return null;
        const updatedEmployees = (prev.employees || []).map((e) => ({
          ...e,
          // If company is set to free, team becomes free; if pro/trial, keep existing team allocation
          isPremium: editPlan === "free" ? false : e.isPremium,
          subscriptionStartedAt: editPlan === "free" ? null : (e.isPremium ? finalStart : e.subscriptionStartedAt),
          subscriptionExpiresAt: editPlan === "free" ? null : (e.isPremium ? finalExpiry : e.subscriptionExpiresAt),
        }));
        const premiumCount = updatedEmployees.filter((e) => e.isPremium).length;
        const primaryCount = editPlan === "free" ? 0 : 1;
        return {
          ...prev,
          status: newStatus,
          subscriptionPlan: editPlan,
          subscriptionStartedAt: finalStart,
          membershipExpiresAt: finalExpiry,
          primaryCardCount: primaryCount,
          totalCardsIssued: primaryCount + premiumCount,
          employees: updatedEmployees,
        };
      });

      setEditStartDate(finalStart ? formatDateInput(finalStart) : "");
      setEditExpiryDate(finalExpiry ? formatDateInput(finalExpiry) : "");

      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 2500);
      onRefresh();
    } catch (err: any) {
      alert(`Failed to update validity: ${err.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  // Individual employee plan toggle (Free Plan vs Pro Plan)
  const handleEmployeePlanChange = async (employeeId: string, newPlan: "pro" | "free") => {
    if (newPlan === "pro" && current.subscriptionPlan === "free") {
      alert("This company is currently on the Free Plan. Please upgrade the company to Pro Plan or Free Trial first in the 'Subscription & Plan' tab before assigning Pro cards to team members.");
      return;
    }

    setUpdatingEmpId(employeeId);
    try {
      const isPremium = newPlan === "pro";
      const start = isPremium ? (current.subscriptionStartedAt || new Date().toISOString()) : null;
      const expiry = isPremium ? (current.membershipExpiresAt || `${calculateOneYearLater(new Date().toISOString().split("T")[0])}T23:59:59.000Z`) : null;

      await updateEmployeeValidity(employeeId, {
        isPremium,
        subscriptionStartedAt: start,
        subscriptionExpiresAt: expiry,
      });

      setDetails((prev) => {
        if (!prev) return null;
        const updatedEmployees = (prev.employees || []).map((e) =>
          e.id === employeeId
            ? {
                ...e,
                isPremium,
                subscriptionStartedAt: start,
                subscriptionExpiresAt: expiry,
              }
            : e
        );
        const premiumCount = updatedEmployees.filter((e) => e.isPremium).length;
        const primaryCount = prev.subscriptionPlan !== "free" ? 1 : 0;
        return {
          ...prev,
          employees: updatedEmployees,
          totalCardsIssued: primaryCount + premiumCount,
        };
      });

      onRefresh();
    } catch (err: any) {
      alert(`Failed to update team member plan: ${err.message}`);
    } finally {
      setUpdatingEmpId(null);
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
              <Badge
                variant={
                  current.subscriptionPlan === "pro"
                    ? "pro"
                    : current.subscriptionPlan === "trial"
                    ? "renew"
                    : "free"
                }
              >
                {current.subscriptionPlan === "pro"
                  ? "Pro Plan"
                  : current.subscriptionPlan === "trial"
                  ? "Free Trial"
                  : "Free Plan"}
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
            {!readOnly && (
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
            )}
            <button
              onClick={() => setActiveTab("employees")}
              className={`border-b-2 px-3.5 py-2 text-xs font-semibold uppercase tracking-wider transition-all whitespace-nowrap ${
                activeTab === "employees"
                  ? "border-[var(--foreground)] text-[var(--foreground)]"
                  : "border-transparent text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
              }`}
            >
              Team Members ({teamCount})
            </button>
            <button
              onClick={() => setActiveTab("qrcodes")}
              className={`border-b-2 px-3.5 py-2 text-xs font-semibold uppercase tracking-wider transition-all whitespace-nowrap flex items-center gap-1.5 ${
                activeTab === "qrcodes"
                  ? "border-[var(--foreground)] text-[var(--foreground)]"
                  : "border-transparent text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
              }`}
            >
              <QrCode size={13} />
              <span>QR Codes & URLs ({1 + teamCount})</span>
            </button>
          </div>

          {/* Tab 1: Overview & Metadata */}
          {activeTab === "overview" && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <div className="rounded-[5px] border border-[var(--border)] bg-[var(--accent)]/30 p-3">
                  <span className="font-mono text-[10px] uppercase tracking-wider text-[var(--muted-foreground)] block">
                    Account Status
                  </span>
                  <div className="mt-1 flex items-center gap-1.5">
                    <span
                      className={`inline-block h-2 w-2 rounded-full ${
                        current.status === "active"
                          ? "bg-emerald-500"
                          : current.status === "suspended"
                          ? "bg-amber-500"
                          : "bg-rose-500"
                      }`}
                    />
                    <span className="font-mono text-xs font-bold uppercase text-[var(--foreground)]">
                      {current.status}
                    </span>
                  </div>
                </div>

                <div className="rounded-[5px] border border-[var(--border)] bg-[var(--accent)]/30 p-3">
                  <span className="font-mono text-[10px] uppercase tracking-wider text-[var(--muted-foreground)] block">
                    Total Cards
                  </span>
                  <span className="font-headline text-base font-bold text-[var(--foreground)] mt-0.5 block">
                    {current.totalCardsIssued} Issued
                  </span>
                </div>

                <div className="rounded-[5px] border border-[var(--border)] bg-[var(--accent)]/30 p-3">
                  <span className="font-mono text-[10px] uppercase tracking-wider text-[var(--muted-foreground)] block">
                    Primary Card
                  </span>
                  <span className="font-headline text-base font-bold text-[var(--foreground)] mt-0.5 block">
                    {current.primaryCardCount} Assigned
                  </span>
                </div>

                <div className="rounded-[5px] border border-[var(--border)] bg-[var(--accent)]/30 p-3">
                  <span className="font-mono text-[10px] uppercase tracking-wider text-[var(--muted-foreground)] block">
                    Team Members
                  </span>
                  <span className="font-headline text-base font-bold text-[var(--foreground)] mt-0.5 block">
                    {teamCount} Profile{teamCount === 1 ? "" : "s"}
                  </span>
                </div>
              </div>

              {/* Contact & Registration Information */}
              <div className="rounded-[5px] border border-[var(--border)] bg-[var(--card)] p-4 space-y-3">
                <h4 className="font-headline text-xs font-bold uppercase tracking-wider text-[var(--foreground)]">
                  Contact & Organization Info
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="text-[var(--muted-foreground)] block">Phone Number</span>
                    <span className="font-mono font-medium text-[var(--foreground)]">
                      {current.phoneNumber || current.phone || "—"}
                    </span>
                  </div>
                  <div>
                    <span className="text-[var(--muted-foreground)] block">Email Address</span>
                    <span className="font-mono font-medium text-[var(--foreground)]">
                      {current.email || "—"}
                    </span>
                  </div>
                  <div>
                    <span className="text-[var(--muted-foreground)] block">Member Since</span>
                    <span className="font-mono font-medium text-[var(--foreground)]">
                      {formatDate(current.createdAt)}
                    </span>
                  </div>
                  <div>
                    <span className="text-[var(--muted-foreground)] block">Current Validity</span>
                    <span
                      className={`font-mono font-bold ${
                        isExpired
                          ? "text-rose-500"
                          : validity.isEndingSoon
                          ? "text-amber-500"
                          : "text-[var(--foreground)]"
                      }`}
                    >
                      {current.subscriptionPlan === "free"
                        ? "N/A (Free Tier)"
                        : isExpired
                        ? "Subscription Expired"
                        : validity.label}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Tab 2: Subscription & Validity Settings */}
          {activeTab === "subscription" && (
            <div className="space-y-4">
              <div className="rounded-[5px] border border-[var(--border)] bg-[var(--card)] p-4 space-y-4">
                <div>
                  <h4 className="font-headline text-xs font-bold uppercase tracking-wider text-[var(--foreground)]">
                    Subscription Plan & Validity Settings
                  </h4>
                  <p className="text-[11px] text-[var(--muted-foreground)] mt-0.5">
                    Select active tier (Free, Free Trial, or Pro Plan). Adjusting validity applies automatically to the business owner and synchronized team members.
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
                    <option value="trial">Free Trial (100 Days)</option>
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
                        Account has standard profile access. Card subscription validity is N/A until upgraded to Pro or granted a Free Trial.
                      </p>
                    </div>
                  </div>
                ) : (
                  /* Dates Form for Pro / Free Trial */
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
                        {editPlan === "trial" && (
                          <span className="text-[10px] font-mono text-emerald-500 font-semibold">
                            (100 Days Standard)
                          </span>
                        )}
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
                <div className="flex items-center justify-end border-t border-[var(--border)] pt-4">
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

          {/* Tab 3: Team Members List */}
          {activeTab === "employees" && (
            <div className="space-y-4">
              {/* Team Members & Cards Allocation Notice */}
              <div className="rounded-[5px] border border-[var(--border)] bg-[var(--accent)]/30 p-3.5 text-xs">
                <span className="font-semibold text-[var(--foreground)] block">
                  Team Members & Card Allocation
                </span>
                <p className="mt-1 text-[11px] text-[var(--muted-foreground)] leading-relaxed">
                  Assign individual card plans for team members. If a manual order was placed without purchasing extra team cards, set members to <span className="font-semibold text-[var(--foreground)]">Free Plan</span>. Set to <span className="font-semibold text-emerald-400">Pro Plan</span> for members with active card slots.
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

              {/* Employees List */}
              {teamCount > 0 ? (
                <div className="space-y-2 max-h-[360px] overflow-y-auto pr-1">
                  {(() => {
                    const filtered = (current.employees || []).filter((e) => {
                      if (!empSearch.trim()) return true;
                      const q = empSearch.toLowerCase();
                      return (
                        e.name.toLowerCase().includes(q) ||
                        (e.designation && e.designation.toLowerCase().includes(q)) ||
                        (e.email && e.email.toLowerCase().includes(q))
                      );
                    });

                    if (filtered.length === 0) {
                      return (
                        <div className="p-6 text-center text-xs text-[var(--muted-foreground)]">
                          No team members matched &quot;{empSearch}&quot;
                        </div>
                      );
                    }

                    return filtered.map((emp) => {
                      return (
                        <div
                          key={emp.id}
                          className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-[5px] border border-[var(--border)] bg-[var(--card)] hover:border-[var(--foreground)]/40 transition-colors"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[5px] bg-[var(--accent)] font-headline text-xs font-bold text-[var(--foreground)] border border-[var(--border)]">
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
                              <div className="flex items-center gap-1.5">
                                <span className="font-semibold text-xs text-[var(--foreground)] truncate">
                                  {emp.name}
                                </span>
                                {emp.slug && (
                                  <a
                                    href={`/${emp.slug}`}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
                                    title="Open team member card"
                                  >
                                    <ExternalLink size={10} />
                                  </a>
                                )}
                              </div>
                              <p className="text-[11px] text-[var(--muted-foreground)] truncate">
                                {emp.designation || "Team Member"} {emp.email ? `• ${emp.email}` : ""}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center justify-between sm:justify-end gap-3 pt-2 sm:pt-0 border-t sm:border-t-0 border-[var(--border)] shrink-0">
                            {readOnly ? (
                              <span className="px-2 py-0.5 rounded-[4px] border border-[var(--border)] bg-[var(--accent)] font-mono text-[10px] font-semibold text-[var(--foreground)]">
                                {emp.isPremium && current.subscriptionPlan !== "free" ? "Pro Card" : "Free Plan"}
                              </span>
                            ) : (
                              <div className="flex items-center gap-2">
                                <select
                                  value={emp.isPremium && current.subscriptionPlan !== "free" ? "pro" : "free"}
                                  onChange={(e) => handleEmployeePlanChange(emp.id, e.target.value as "pro" | "free")}
                                  disabled={updatingEmpId === emp.id}
                                  className={`rounded-[5px] border px-2.5 py-1 text-xs font-semibold outline-none cursor-pointer transition-all ${
                                    emp.isPremium && current.subscriptionPlan !== "free"
                                      ? "border-[var(--border)] bg-[var(--accent)] text-[var(--foreground)] font-semibold"
                                      : "border-[var(--border)] bg-[var(--background)] text-[var(--muted-foreground)] hover:text-[var(--foreground)] focus:border-[var(--foreground)]"
                                  }`}
                                >
                                  <option value="pro" className="bg-[#18181b] text-gray-100 font-medium">Pro Plan (Team Card)</option>
                                  <option value="free" className="bg-[#18181b] text-gray-300 font-medium">Free Plan (No Card)</option>
                                </select>
                                {updatingEmpId === emp.id && (
                                  <Loader2 size={13} className="animate-spin text-[var(--muted-foreground)]" />
                                )}
                              </div>
                            )}

                            <span className="font-mono text-[11px] text-[var(--muted-foreground)] min-w-[70px] text-right">
                              {!emp.isPremium || current.subscriptionPlan === "free"
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

          {/* Tab 4: QR Codes & Public URLs */}
          {activeTab === "qrcodes" && (
            <div className="space-y-4">
              {/* Optional Search bar if there are multiple team members */}
              {teamCount > 2 && (
                <div className="relative">
                  <Search
                    size={14}
                    className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)]"
                  />
                  <input
                    type="text"
                    placeholder="Search QR code by team member name, designation, or email..."
                    value={qrSearch}
                    onChange={(e) => setQrSearch(e.target.value)}
                    className="w-full rounded-[5px] border border-[var(--border)] bg-[var(--background)] pl-10 pr-4 py-2 text-xs outline-none focus:border-[var(--foreground)]"
                  />
                </div>
              )}

              {/* QR Code List */}
              <div className="space-y-3 max-h-[440px] overflow-y-auto pr-1">
                {/* 1. Primary Company / Owner Card */}
                {(() => {
                  const ownerMatches =
                    !qrSearch.trim() ||
                    current.businessName.toLowerCase().includes(qrSearch.toLowerCase()) ||
                    current.ownerName.toLowerCase().includes(qrSearch.toLowerCase()) ||
                    (current.username && current.username.toLowerCase().includes(qrSearch.toLowerCase()));

                  if (!ownerMatches) return null;

                  const ownerSlug = current.username || current.slug || current.id;
                  const ownerUrl = buildPublicCardUrl(ownerSlug);
                  const ownerFileName = `qr-${(current.username || current.businessName).toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;

                  return (
                    <div className="space-y-1">
                      <span className="font-mono text-[10px] uppercase tracking-wider text-[var(--muted-foreground)] block font-semibold px-0.5">
                        Primary Card
                      </span>
                      <CompanyQrCardRow
                        isPrimary
                        title={current.businessName}
                        subtitle={`Owner: ${current.ownerName}${current.email ? ` • ${current.email}` : ""}`}
                        url={ownerUrl}
                        badge="Primary"
                        downloadFileName={ownerFileName}
                      />
                    </div>
                  );
                })()}

                {/* 2. Team Member Cards */}
                {teamCount > 0 ? (
                  (() => {
                    const filteredTeam = (current.employees || []).filter((emp) => {
                      if (!qrSearch.trim()) return true;
                      const q = qrSearch.toLowerCase();
                      return (
                        emp.name.toLowerCase().includes(q) ||
                        (emp.designation && emp.designation.toLowerCase().includes(q)) ||
                        (emp.email && emp.email.toLowerCase().includes(q))
                      );
                    });

                    if (filteredTeam.length === 0 && qrSearch.trim()) {
                      return (
                        <div className="p-6 text-center text-xs text-[var(--muted-foreground)] rounded-[5px] border border-dashed border-[var(--border)]">
                          No team members matched &quot;{qrSearch}&quot;
                        </div>
                      );
                    }

                    return (
                      <div className="space-y-1 pt-1">
                        <span className="font-mono text-[10px] uppercase tracking-wider text-[var(--muted-foreground)] block font-semibold px-0.5">
                          Team Cards ({filteredTeam.length})
                        </span>
                        <div className="space-y-1.5">
                          {filteredTeam.map((emp) => {
                            const ownerSlug = current.username || current.slug || current.id;
                            const empSlug = emp.slug || emp.id;
                            const empUrl = buildPublicCardUrl(ownerSlug, empSlug);
                            const dlName = `qr-${ownerSlug}-${empSlug}`.toLowerCase().replace(/[^a-z0-9]+/g, "-");

                            return (
                              <CompanyQrCardRow
                                key={emp.id}
                                title={emp.name}
                                subtitle={`${emp.designation || "Team Member"}${emp.email ? ` • ${emp.email}` : ""}`}
                                url={empUrl}
                                badge={
                                  emp.isPremium && current.subscriptionPlan !== "free"
                                    ? "Team Pro"
                                    : "Team Member"
                                }
                                downloadFileName={dlName}
                              />
                            );
                          })}
                        </div>
                      </div>
                    );
                  })()
                ) : (
                  <div className="rounded-[5px] border border-dashed border-[var(--border)] p-4 text-center">
                    <p className="text-xs text-[var(--muted-foreground)]">
                      No team member cards yet. You can add employees in the <strong>Team Members</strong> tab.
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </Modal>
    </>
  );
};
