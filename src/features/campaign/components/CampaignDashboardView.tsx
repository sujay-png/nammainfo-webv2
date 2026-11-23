"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import {
  Users,
  Banknote,
  Clock,
  CheckCircle2,
  AlertCircle,
  Copy,
  Check,
  Search,
  ExternalLink,
  Phone,
  MessageSquare,
  Mail,
  Building2,
  Calendar,
  ChevronRight,
  Loader2,
  RefreshCw,
  Wallet,
  Send,
  History,
  Tag,
  ArrowRight,
  ShieldCheck,
  Share2,
} from "lucide-react";
import { Modal } from "@/admin/shared/ui/Modal";
import { Badge } from "@/admin/shared/ui/Badge";
import { Button } from "@/admin/shared/ui/Button";
import { formatDate } from "@/admin/shared/lib/formatters";

interface ReferralUser {
  id: string;
  referredUserId: string;
  couponCode: string | null;
  source: string;
  referralStatus: string;
  amountPending: number;
  amountConverted: number;
  amountTransferred: number;
  convertedAt: string | null;
  renewalCount: number;
  createdAt: string;

  businessName: string;
  ownerName: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  pincode: string;
  gstNumber: string;
  website: string;
  avatarUrl: string | null;
  slug: string;
  userPlan: "free" | "trial" | "pro" | "expired";
  membershipExpiresAt: string | null;
  subscriptionStartedAt: string | null;
  renewalAmount: number;
  cardProcess: Record<string, { completed?: boolean; updated_at?: string | null }>;
  teamCount: number;
  teamMembers: Array<{
    id: string;
    name: string;
    designation: string;
    phone: string;
    email: string;
    isActive: boolean;
  }>;
}

interface CampaignKpis {
  totalUsers: number;
  upcomingRenewalsCount: number;
  nextUpcomingRenewal: {
    date: string | null;
    amountYouGet: number;
    userName: string;
    businessName: string;
    daysRemaining: number;
  } | null;
  revenueThroughReferrals: number;
  amountPending: number;
  amountTransferred: number;
  withdrawableBalance: number;
  pendingWithdrawalTotal: number;
}

interface WithdrawalItem {
  id: string;
  amount: number;
  payout_method: "bank_transfer" | "upi";
  account_details: any;
  status: "pending" | "transferred" | "rejected";
  created_at: string;
  transferred_at?: string | null;
}

export const CampaignDashboardView: React.FC = () => {
  const [activeTab, setActiveTab] = useState<"referrals" | "coupon">("referrals");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Referrals and KPIs
  const [referrals, setReferrals] = useState<ReferralUser[]>([]);
  const [kpis, setKpis] = useState<CampaignKpis>({
    totalUsers: 0,
    upcomingRenewalsCount: 0,
    nextUpcomingRenewal: null,
    revenueThroughReferrals: 0,
    amountPending: 0,
    amountTransferred: 0,
    withdrawableBalance: 0,
    pendingWithdrawalTotal: 0,
  });
  const [manager, setManager] = useState<any>(null);

  // Coupon state
  const [coupon, setCoupon] = useState<{ code: string } | null>(null);
  const [couponPrefix, setCouponPrefix] = useState("");
  const [couponLoading, setCouponLoading] = useState(false);
  const [couponError, setCouponError] = useState<string | null>(null);
  const [couponSuccess, setCouponSuccess] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  // Filters and sorting
  const [filterStatus, setFilterStatus] = useState<"all" | "trial" | "pro" | "expired">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<"recent" | "a-z" | "z-a">("recent");

  // Referral detail modal state
  const [selectedReferral, setSelectedReferral] = useState<ReferralUser | null>(null);
  const [detailTab, setDetailTab] = useState<"status" | "refer_status" | "company" | "team" | "note">("status");

  // Withdrawal Modal State
  const [isWithdrawOpen, setIsWithdrawOpen] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState<string>("");
  const [payoutMethod, setPayoutMethod] = useState<"bank_transfer" | "upi">("bank_transfer");
  const [bankDetails, setBankDetails] = useState({
    account_holder: "",
    bank_name: "",
    account_number: "",
    confirm_account_number: "",
    ifsc: "",
  });
  const [upiDetails, setUpiDetails] = useState({
    upi_id: "",
    holder_name: "",
  });
  const [withdrawLoading, setWithdrawLoading] = useState(false);
  const [withdrawError, setWithdrawError] = useState<string | null>(null);
  const [withdrawSuccess, setWithdrawSuccess] = useState<string | null>(null);

  // Withdrawal History Modal State
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [withdrawalHistory, setWithdrawalHistory] = useState<WithdrawalItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [refRes, cpnRes] = await Promise.all([
        fetch("/api/campaign/referrals"),
        fetch("/api/campaign/coupon"),
      ]);

      const refData = await refRes.json();
      const cpnData = await cpnRes.json();

      if (!refRes.ok) throw new Error(refData.error || "Failed to load referrals data");

      setReferrals(refData.referrals || []);
      setKpis(refData.kpis || kpis);
      setManager(refData.manager || null);

      if (cpnData.coupon) {
        setCoupon(cpnData.coupon);
        // Pre-fill prefix if ends with 500
        const code = cpnData.coupon.code;
        if (code.endsWith("500")) {
          setCouponPrefix(code.slice(0, -3));
        } else {
          setCouponPrefix(code);
        }
      }
    } catch (err: any) {
      setError(err.message || "Failed to load campaign manager data");
    } finally {
      setLoading(false);
    }
  };

  const loadWithdrawalHistory = async () => {
    setHistoryLoading(true);
    try {
      const res = await fetch("/api/campaign/withdrawals");
      const data = await res.json();
      setWithdrawalHistory(data.withdrawals || []);
    } catch (err) {
      console.error("Failed to load withdrawal history:", err);
    } finally {
      setHistoryLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleGenerateCoupon = async (e: React.FormEvent) => {
    e.preventDefault();
    setCouponError(null);
    setCouponSuccess(null);

    const clean = couponPrefix.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (!clean || clean.length < 2) {
      setCouponError("Prefix must have at least 2 alphanumeric characters.");
      return;
    }

    setCouponLoading(true);
    try {
      const res = await fetch("/api/campaign/coupon", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prefix: clean }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save coupon code");

      setCoupon(data.coupon);
      setCouponSuccess(data.message || "Coupon code saved successfully!");
      setTimeout(() => setCouponSuccess(null), 3000);
    } catch (err: any) {
      setCouponError(err.message || "Failed to save coupon code");
    } finally {
      setCouponLoading(false);
    }
  };

  const handleWithdrawSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setWithdrawError(null);
    setWithdrawSuccess(null);

    const amt = Number(withdrawAmount);
    if (!amt || amt <= 0) {
      setWithdrawError("Please enter a valid amount to withdraw.");
      return;
    }

    if (amt > kpis.withdrawableBalance) {
      setWithdrawError(
        `Amount exceeds your withdrawable balance of ₹${kpis.withdrawableBalance.toLocaleString("en-IN")}.`
      );
      return;
    }

    if (payoutMethod === "bank_transfer") {
      if (!bankDetails.account_number || !bankDetails.ifsc) {
        setWithdrawError("Account number and IFSC code are required.");
        return;
      }
      if (bankDetails.account_number !== bankDetails.confirm_account_number) {
        setWithdrawError("Account numbers do not match.");
        return;
      }
    } else {
      if (!upiDetails.upi_id) {
        setWithdrawError("Please enter your UPI ID.");
        return;
      }
    }

    setWithdrawLoading(true);
    try {
      const accountDetails =
        payoutMethod === "bank_transfer"
          ? {
              account_holder: bankDetails.account_holder || manager?.name,
              bank_name: bankDetails.bank_name,
              account_number: bankDetails.account_number,
              ifsc: bankDetails.ifsc.toUpperCase(),
            }
          : {
              upi_id: upiDetails.upi_id.trim().toLowerCase(),
              holder_name: upiDetails.holder_name || manager?.name,
            };

      const res = await fetch("/api/campaign/withdrawals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: amt,
          payoutMethod,
          accountDetails,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to submit withdrawal request");

      setWithdrawSuccess("Withdrawal request submitted! It is now pending review by admin.");
      loadData();
      setTimeout(() => {
        setIsWithdrawOpen(false);
        setWithdrawAmount("");
        setWithdrawSuccess(null);
      }, 1500);
    } catch (err: any) {
      setWithdrawError(err.message || "Failed to submit withdrawal request");
    } finally {
      setWithdrawLoading(false);
    }
  };

  const copyToClipboard = (text: string, type: "code" | "link") => {
    navigator.clipboard.writeText(text);
    if (type === "code") {
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    } else {
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    }
  };

  const filteredReferrals = useMemo(() => {
    let list = [...referrals];

    // Filter status
    if (filterStatus !== "all") {
      list = list.filter((r) => r.userPlan === filterStatus);
    }

    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (r) =>
          r.businessName.toLowerCase().includes(q) ||
          r.ownerName.toLowerCase().includes(q) ||
          r.phone.includes(q) ||
          r.email.toLowerCase().includes(q)
      );
    }

    // Sort
    if (sortBy === "recent") {
      list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    } else if (sortBy === "a-z") {
      list.sort((a, b) => a.businessName.localeCompare(b.businessName));
    } else if (sortBy === "z-a") {
      list.sort((a, b) => b.businessName.localeCompare(a.businessName));
    }

    return list;
  }, [referrals, filterStatus, searchQuery, sortBy]);

  const referralSignupUrl = coupon
    ? typeof window !== "undefined"
      ? `${window.location.origin}/signup?ref=${coupon.code}`
      : `https://nammainfo.in/signup?ref=${coupon.code}`
    : "";

  return (
    <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)] flex flex-col">
      {/* Top Header */}
      <header className="border-b border-[var(--border)] bg-[var(--card)] px-4 sm:px-6 py-3.5 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-[5px] bg-[var(--foreground)] text-[var(--background)] font-bold text-sm">
              CM
            </div>
            <div>
              <h1 className="font-headline text-base font-bold tracking-tight text-[var(--foreground)] leading-tight">
                Campaign Manager
              </h1>
              <p className="text-[11px] text-[var(--muted-foreground)]">
                {manager?.businessName ? `${manager.businessName} • ` : ""}Referrals & Earnings
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto">
            {/* Link to company profile */}
            <Link
              href="/dashboard"
              className="text-xs font-medium text-[var(--muted-foreground)] hover:text-[var(--foreground)] px-2.5 py-1.5 rounded-[5px] hover:bg-[var(--accent)] transition-colors flex items-center gap-1"
            >
              <span>My Company Profile</span>
              <ExternalLink size={12} />
            </Link>

            {/* Payout History button */}
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                setIsHistoryOpen(true);
                loadWithdrawalHistory();
              }}
            >
              <History size={13} className="mr-1" />
              History
            </Button>

            {/* Withdrawable Balance & Withdraw button */}
            <div className="flex items-center gap-2 border border-[var(--border)] rounded-[5px] bg-[var(--background)] pl-3 pr-1 py-1">
              <div className="flex items-center gap-1.5 font-mono text-xs font-bold text-emerald-600 dark:text-emerald-400">
                <Wallet size={14} />
                <span>₹{kpis.withdrawableBalance.toLocaleString("en-IN")}</span>
              </div>
              <Button
                variant="primary"
                size="sm"
                onClick={() => {
                  setWithdrawAmount(kpis.withdrawableBalance > 0 ? String(kpis.withdrawableBalance) : "");
                  setIsWithdrawOpen(true);
                }}
                disabled={kpis.withdrawableBalance <= 0}
              >
                Withdraw
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 space-y-6">
        {error && (
          <div className="flex items-center gap-2 p-3 rounded-[5px] border border-rose-500/20 bg-rose-500/10 text-xs text-rose-600 dark:text-rose-400">
            <AlertCircle size={15} className="shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Top Navigation Tabs */}
        <div className="flex border-b border-[var(--border)] gap-2">
          <button
            onClick={() => setActiveTab("referrals")}
            className={`border-b-2 px-4 py-2.5 text-xs font-semibold uppercase tracking-wider transition-colors cursor-pointer flex items-center gap-2 ${
              activeTab === "referrals"
                ? "border-[var(--foreground)] text-[var(--foreground)]"
                : "border-transparent text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
            }`}
          >
            <Users size={14} />
            <span>Referrals ({referrals.length})</span>
          </button>
          <button
            onClick={() => setActiveTab("coupon")}
            className={`border-b-2 px-4 py-2.5 text-xs font-semibold uppercase tracking-wider transition-colors cursor-pointer flex items-center gap-2 ${
              activeTab === "coupon"
                ? "border-[var(--foreground)] text-[var(--foreground)]"
                : "border-transparent text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
            }`}
          >
            <Tag size={14} />
            <span>Coupon Code {coupon ? `(${coupon.code})` : ""}</span>
          </button>
        </div>

        {/* TAB 1: REFERRALS */}
        {activeTab === "referrals" && (
          <div className="space-y-6">
            {/* 3 Top KPIs */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* Total Users */}
              <div className="rounded-[5px] border border-[var(--border)] bg-[var(--card)] p-4 shadow-card">
                <div className="flex items-center justify-between text-[var(--muted-foreground)]">
                  <span className="font-mono text-[10px] uppercase tracking-wider font-semibold">
                    Total Users
                  </span>
                  <Users size={16} />
                </div>
                <span className="font-headline text-2xl font-extrabold text-[var(--foreground)] block mt-2">
                  {kpis.totalUsers}
                </span>
                <span className="text-[11px] text-[var(--muted-foreground)] mt-0.5 block">
                  Customers registered via your referral
                </span>
              </div>

              {/* Upcoming Renewal */}
              <div className="rounded-[5px] border border-[var(--border)] bg-[var(--card)] p-4 shadow-card flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between text-[var(--muted-foreground)]">
                    <span className="font-mono text-[10px] uppercase tracking-wider font-semibold">
                      Upcoming Renewal
                    </span>
                    <Clock size={16} />
                  </div>
                  <span className="font-headline text-2xl font-extrabold text-[var(--foreground)] block mt-2">
                    {kpis.upcomingRenewalsCount}
                  </span>
                </div>
                <div className="text-[11px] text-[var(--muted-foreground)] mt-1 pt-1.5 border-t border-[var(--border)]">
                  {kpis.nextUpcomingRenewal ? (
                    <div className="flex items-center justify-between font-mono">
                      <span>{formatDate(kpis.nextUpcomingRenewal.date)}</span>
                      <span className="font-bold text-emerald-600 dark:text-emerald-400">
                        {kpis.nextUpcomingRenewal.amountYouGet > 0
                          ? `+₹${kpis.nextUpcomingRenewal.amountYouGet} reward`
                          : "Free trial to Pro"}
                      </span>
                    </div>
                  ) : (
                    <span>No upcoming renewals in next 60 days</span>
                  )}
                </div>
              </div>

              {/* Revenue Through Referrals */}
              <div className="rounded-[5px] border border-[var(--border)] bg-[var(--card)] p-4 shadow-card">
                <div className="flex items-center justify-between text-[var(--muted-foreground)]">
                  <span className="font-mono text-[10px] uppercase tracking-wider font-semibold">
                    Revenue Through Referrals
                  </span>
                  <Banknote size={16} className="text-emerald-500" />
                </div>
                <span className="font-headline text-2xl font-extrabold text-emerald-600 dark:text-emerald-400 block mt-2">
                  ₹{kpis.revenueThroughReferrals.toLocaleString("en-IN")}
                </span>
                <span className="text-[11px] text-[var(--muted-foreground)] mt-0.5 block font-mono">
                  Pending: ₹{kpis.amountPending.toLocaleString("en-IN")} • Transferred: ₹{kpis.amountTransferred.toLocaleString("en-IN")}
                </span>
              </div>
            </div>

            {/* Filters & Search Bar */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              {/* Search */}
              <div className="relative max-w-xs flex-1">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)]" />
                <input
                  type="text"
                  placeholder="Search customer, phone..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full rounded-[5px] border border-[var(--border)] bg-[var(--card)] pl-9 pr-3 py-1.5 text-xs text-[var(--foreground)] outline-none focus:border-[var(--foreground)]"
                />
              </div>

              {/* Filter pills & Sort */}
              <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
                {/* Filter Pills */}
                <div className="flex items-center gap-1 border border-[var(--border)] rounded-[5px] p-0.5 bg-[var(--card)] shrink-0">
                  {(["all", "trial", "pro", "expired"] as const).map((tab) => (
                    <button
                      key={tab}
                      onClick={() => setFilterStatus(tab)}
                      className={`px-2.5 py-1 text-xs font-semibold rounded-[4px] transition-colors uppercase tracking-wider text-[10px] cursor-pointer ${
                        filterStatus === tab
                          ? "bg-[var(--foreground)] text-[var(--background)]"
                          : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
                      }`}
                    >
                      {tab === "trial" ? "Free Trial" : tab}
                    </button>
                  ))}
                </div>

                {/* Sort */}
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                  className="rounded-[5px] border border-[var(--border)] bg-[var(--card)] px-2.5 py-1.5 text-xs text-[var(--foreground)] outline-none cursor-pointer shrink-0"
                >
                  <option value="recent">Recently Added</option>
                  <option value="a-z">Name A-Z</option>
                  <option value="z-a">Name Z-A</option>
                </select>
              </div>
            </div>

            {/* Referrals Table */}
            <div className="overflow-hidden rounded-[5px] border border-[var(--border)] bg-[var(--card)] shadow-card">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-[var(--border)] bg-[var(--accent)]/50 font-mono text-[11px] uppercase tracking-wider text-[var(--muted-foreground)]">
                    <tr>
                      <th scope="col" className="px-5 py-3">User & Business</th>
                      <th scope="col" className="px-4 py-3">Status</th>
                      <th scope="col" className="px-4 py-3 text-right">Referral Reward</th>
                      <th scope="col" className="px-4 py-3 text-center">Reward Status</th>
                      <th scope="col" className="px-4 py-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border)]">
                    {loading ? (
                      <tr>
                        <td colSpan={5} className="py-12 text-center text-xs text-[var(--muted-foreground)]">
                          <Loader2 size={18} className="animate-spin inline-block mr-2" />
                          Loading referrals...
                        </td>
                      </tr>
                    ) : filteredReferrals.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-12 text-center text-xs text-[var(--muted-foreground)]">
                          No referred users found. Share your coupon code or digital card link to start earning rewards!
                        </td>
                      </tr>
                    ) : (
                      filteredReferrals.map((u) => {
                        const isClaimed = u.userPlan === "pro" || u.amountConverted > 0;
                        return (
                          <tr
                            key={u.id}
                            onClick={() => {
                              setSelectedReferral(u);
                              setDetailTab("status");
                            }}
                            className="transition-colors hover:bg-neutral-100 dark:hover:bg-neutral-800/50 cursor-pointer"
                          >
                            {/* User & Company */}
                            <td className="px-5 py-3.5">
                              <span className="font-semibold text-xs text-[var(--foreground)] block">
                                {u.businessName}
                              </span>
                              <span className="text-[11px] text-[var(--muted-foreground)] block">
                                {u.ownerName} {u.phone ? `• ${u.phone}` : ""}
                              </span>
                            </td>

                            {/* Plan Status */}
                            <td className="px-4 py-3.5 whitespace-nowrap">
                              <Badge variant={u.userPlan}>
                                {u.userPlan === "pro"
                                  ? "Pro Plan"
                                  : u.userPlan === "trial"
                                  ? "Free Trial"
                                  : u.userPlan === "expired"
                                  ? "Expired"
                                  : "Free Plan"}
                              </Badge>
                            </td>

                            {/* Reward Amount */}
                            <td className="px-4 py-3.5 text-right font-mono font-bold text-xs whitespace-nowrap">
                              ₹500
                            </td>

                            {/* Reward Status */}
                            <td className="px-4 py-3.5 text-center whitespace-nowrap">
                              {isClaimed ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-[4px] font-mono text-[10px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                                  <Check size={11} />
                                  Claimed
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-[4px] font-mono text-[10px] font-semibold bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20">
                                  <Clock size={11} />
                                  Pending
                                </span>
                              )}
                            </td>

                            {/* Action */}
                            <td className="px-4 py-3.5 text-right whitespace-nowrap">
                              <span className="text-[11px] font-semibold text-[var(--muted-foreground)] hover:text-[var(--foreground)] inline-flex items-center gap-1">
                                <span>Details</span>
                                <ChevronRight size={13} />
                              </span>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: COUPON CODE GENERATOR */}
        {activeTab === "coupon" && (
          <div className="max-w-xl mx-auto space-y-6">
            <div className="rounded-[5px] border border-[var(--border)] bg-[var(--card)] p-6 shadow-card space-y-5">
              <div>
                <h3 className="font-headline text-base font-bold text-[var(--foreground)]">
                  Referral Coupon Code Generator
                </h3>
                <p className="text-xs text-[var(--muted-foreground)] mt-1 leading-relaxed">
                  Generate your custom referral coupon code ending in <strong>500</strong>. When customers apply your code or sign up through your card link, they get <strong>₹500 off</strong> their primary card purchase, and you get <strong>₹500</strong> credited when they upgrade to Pro.
                </p>
              </div>

              {couponSuccess && (
                <div className="flex items-center gap-2 p-3 rounded-[5px] border border-emerald-500/20 bg-emerald-500/10 text-xs text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 size={15} className="shrink-0" />
                  <span>{couponSuccess}</span>
                </div>
              )}

              {couponError && (
                <div className="flex items-center gap-2 p-3 rounded-[5px] border border-rose-500/20 bg-rose-500/10 text-xs text-rose-600 dark:text-rose-400">
                  <AlertCircle size={15} className="shrink-0" />
                  <span>{couponError}</span>
                </div>
              )}

              {/* Active Coupon Box if generated */}
              {coupon && (
                <div className="rounded-[5px] border border-[var(--border)] bg-[var(--accent)]/40 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[10px] uppercase tracking-wider text-[var(--muted-foreground)] font-semibold">
                      Your Active Coupon Code
                    </span>
                    <span className="font-mono text-[11px] text-emerald-600 dark:text-emerald-400 font-bold">
                      ₹500 Off Active
                    </span>
                  </div>

                  <div className="flex items-center justify-between gap-3 bg-[var(--card)] border border-[var(--border)] rounded-[5px] p-3">
                    <span className="font-mono text-xl sm:text-2xl font-extrabold tracking-widest text-[var(--foreground)]">
                      {coupon.code}
                    </span>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(coupon.code, "code")}
                      className="px-3 py-1.5 rounded-[4px] border border-[var(--border)] hover:bg-[var(--accent)] text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
                    >
                      {copiedCode ? <Check size={13} /> : <Copy size={13} />}
                      <span>{copiedCode ? "Copied" : "Copy Code"}</span>
                    </button>
                  </div>

                  {referralSignupUrl && (
                    <div className="pt-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono text-[11px] text-[var(--muted-foreground)] truncate">
                          {referralSignupUrl}
                        </span>
                        <button
                          type="button"
                          onClick={() => copyToClipboard(referralSignupUrl, "link")}
                          className="shrink-0 px-2.5 py-1 text-[11px] font-semibold text-[var(--foreground)] hover:underline flex items-center gap-1 cursor-pointer"
                        >
                          {copiedLink ? <Check size={12} /> : <Share2 size={12} />}
                          <span>{copiedLink ? "Link Copied" : "Copy Link"}</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Generator Form: create or update code */}
              <form onSubmit={handleGenerateCoupon} className="space-y-4 pt-2">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-[var(--foreground)] block">
                    {coupon ? "Update Your Coupon Code Prefix:" : "Create Your Code Prefix:"}
                  </label>
                  <div className="flex items-center gap-2">
                    <div className="relative flex-1 flex items-center rounded-[5px] border border-[var(--border)] bg-[var(--background)] overflow-hidden focus-within:border-[var(--foreground)]">
                      <input
                        type="text"
                        required
                        placeholder="ENTER_PREFIX"
                        value={couponPrefix}
                        onChange={(e) => setCouponPrefix(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))}
                        className="flex-1 bg-transparent px-3 py-2 text-xs font-mono font-bold tracking-wider uppercase text-[var(--foreground)] outline-none"
                        maxLength={12}
                      />
                      <span className="bg-[var(--accent)] font-mono font-bold text-xs px-3 py-2 text-[var(--muted-foreground)] border-l border-[var(--border)] select-none">
                        500
                      </span>
                    </div>

                    <Button variant="primary" size="sm" type="submit" isLoading={couponLoading}>
                      {coupon ? "Update Code" : "Generate"}
                    </Button>
                  </div>
                  <p className="text-[11px] text-[var(--muted-foreground)]">
                    Suffix <strong>500</strong> is automatically appended. Only letters and digits allowed.
                  </p>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>

      {/* REFERRAL USER DETAIL MODAL / DRAWER */}
      {selectedReferral && (
        <Modal
          isOpen={Boolean(selectedReferral)}
          onClose={() => setSelectedReferral(null)}
          title={selectedReferral.businessName}
          maxWidth="2xl"
        >
          <div className="space-y-5 pt-1">
            {/* Modal Header Summary */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-[var(--border)] pb-3">
              <div>
                <h3 className="font-headline text-base font-bold text-[var(--foreground)]">
                  {selectedReferral.businessName}
                </h3>
                <p className="text-xs text-[var(--muted-foreground)]">
                  {selectedReferral.ownerName} {selectedReferral.phone ? `• ${selectedReferral.phone}` : ""}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <Badge variant={selectedReferral.userPlan}>
                  {selectedReferral.userPlan === "pro"
                    ? "Pro Plan"
                    : selectedReferral.userPlan === "trial"
                    ? "Free Trial"
                    : selectedReferral.userPlan === "expired"
                    ? "Expired"
                    : "Free Plan"}
                </Badge>
              </div>
            </div>

            {/* Renewal Amount Banner: If Pro or Free Trial show renewal amount, if Free show nothing */}
            {selectedReferral.renewalAmount > 0 && (
              <div className="rounded-[5px] border border-[var(--border)] bg-[var(--accent)]/40 p-3 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2 text-[var(--muted-foreground)]">
                  <Calendar size={14} className="text-[var(--foreground)]" />
                  <span>
                    Renewal Amount:{" "}
                    <strong className="text-[var(--foreground)]">
                      ₹{selectedReferral.renewalAmount.toLocaleString("en-IN")}
                    </strong>
                  </span>
                </div>
                {selectedReferral.membershipExpiresAt && (
                  <span className="font-mono text-[11px] text-[var(--muted-foreground)]">
                    Due by: {formatDate(selectedReferral.membershipExpiresAt)}
                  </span>
                )}
              </div>
            )}

            {/* Modal Tabs Navigation: Status, Refer Status, Company Details, Team Members, Note */}
            <div className="flex border-b border-[var(--border)] overflow-x-auto gap-1 text-xs">
              <button
                onClick={() => setDetailTab("status")}
                className={`border-b-2 px-3 py-2 font-semibold uppercase tracking-wider transition-colors cursor-pointer whitespace-nowrap ${
                  detailTab === "status"
                    ? "border-[var(--foreground)] text-[var(--foreground)]"
                    : "border-transparent text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
                }`}
              >
                Status
              </button>
              <button
                onClick={() => setDetailTab("refer_status")}
                className={`border-b-2 px-3 py-2 font-semibold uppercase tracking-wider transition-colors cursor-pointer whitespace-nowrap ${
                  detailTab === "refer_status"
                    ? "border-[var(--foreground)] text-[var(--foreground)]"
                    : "border-transparent text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
                }`}
              >
                Refer Status
              </button>
              <button
                onClick={() => setDetailTab("company")}
                className={`border-b-2 px-3 py-2 font-semibold uppercase tracking-wider transition-colors cursor-pointer whitespace-nowrap ${
                  detailTab === "company"
                    ? "border-[var(--foreground)] text-[var(--foreground)]"
                    : "border-transparent text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
                }`}
              >
                Company Details
              </button>
              <button
                onClick={() => setDetailTab("team")}
                className={`border-b-2 px-3 py-2 font-semibold uppercase tracking-wider transition-colors cursor-pointer whitespace-nowrap ${
                  detailTab === "team"
                    ? "border-[var(--foreground)] text-[var(--foreground)]"
                    : "border-transparent text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
                }`}
              >
                Team Members ({selectedReferral.teamCount})
              </button>
              <button
                onClick={() => setDetailTab("note")}
                className={`border-b-2 px-3 py-2 font-semibold uppercase tracking-wider transition-colors cursor-pointer whitespace-nowrap ${
                  detailTab === "note"
                    ? "border-[var(--foreground)] text-[var(--foreground)]"
                    : "border-transparent text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
                }`}
              >
                Note
              </button>
            </div>

            {/* TAB CONTENT */}

            {/* 1. Status: Lifecycle process milestones */}
            {detailTab === "status" && (
              <div className="space-y-3 py-1">
                <div className="rounded-[5px] border border-[var(--border)] divide-y divide-[var(--border)]">
                  {/* Free Trial Step */}
                  <div className="p-3 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-3">
                      <div
                        className={`flex h-6 w-6 items-center justify-center rounded-full border ${
                          selectedReferral.userPlan === "trial" || selectedReferral.userPlan === "pro"
                            ? "bg-emerald-500 text-white border-emerald-500"
                            : "border-[var(--border)] text-[var(--muted-foreground)]"
                        }`}
                      >
                        <Check size={12} strokeWidth={3} />
                      </div>
                      <div>
                        <span className="font-semibold text-[var(--foreground)] block">Free Trial</span>
                        <span className="text-[11px] text-[var(--muted-foreground)]">
                          {selectedReferral.userPlan === "trial"
                            ? "Customer is currently enjoying active free trial"
                            : selectedReferral.userPlan === "pro"
                            ? "Onboarded with trial & upgraded to Pro"
                            : "Customer registered on free plan"}
                        </span>
                      </div>
                    </div>
                    {(selectedReferral.userPlan === "trial" || selectedReferral.userPlan === "pro") && (
                      <span className="font-mono text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold">
                        Active
                      </span>
                    )}
                  </div>

                  {/* After 30 days */}
                  <div className="p-3 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-3">
                      <div
                        className={`flex h-6 w-6 items-center justify-center rounded-full border ${
                          selectedReferral.cardProcess?.followup_1_done?.completed || selectedReferral.userPlan === "pro"
                            ? "bg-emerald-500 text-white border-emerald-500"
                            : "border-[var(--border)] text-[var(--muted-foreground)]"
                        }`}
                      >
                        <Check size={12} strokeWidth={3} />
                      </div>
                      <div>
                        <span className="font-semibold text-[var(--foreground)] block">After 30 days</span>
                        <span className="text-[11px] text-[var(--muted-foreground)]">
                          Day 30 milestone check-in
                        </span>
                      </div>
                    </div>
                    {selectedReferral.cardProcess?.followup_1_done?.completed && (
                      <span className="font-mono text-[10px] text-[var(--muted-foreground)]">Done</span>
                    )}
                  </div>

                  {/* After 60 days */}
                  <div className="p-3 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-3">
                      <div
                        className={`flex h-6 w-6 items-center justify-center rounded-full border ${
                          selectedReferral.cardProcess?.followup_2_done?.completed || selectedReferral.userPlan === "pro"
                            ? "bg-emerald-500 text-white border-emerald-500"
                            : "border-[var(--border)] text-[var(--muted-foreground)]"
                        }`}
                      >
                        <Check size={12} strokeWidth={3} />
                      </div>
                      <div>
                        <span className="font-semibold text-[var(--foreground)] block">After 60 days</span>
                        <span className="text-[11px] text-[var(--muted-foreground)]">
                          Day 60 milestone check-in
                        </span>
                      </div>
                    </div>
                    {selectedReferral.cardProcess?.followup_2_done?.completed && (
                      <span className="font-mono text-[10px] text-[var(--muted-foreground)]">Done</span>
                    )}
                  </div>

                  {/* After 90 days */}
                  <div className="p-3 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-3">
                      <div
                        className={`flex h-6 w-6 items-center justify-center rounded-full border ${
                          selectedReferral.cardProcess?.followup_3_done?.completed || selectedReferral.userPlan === "pro"
                            ? "bg-emerald-500 text-white border-emerald-500"
                            : "border-[var(--border)] text-[var(--muted-foreground)]"
                        }`}
                      >
                        <Check size={12} strokeWidth={3} />
                      </div>
                      <div>
                        <span className="font-semibold text-[var(--foreground)] block">After 90 days</span>
                        <span className="text-[11px] text-[var(--muted-foreground)]">
                          Day 90 pre-expiration check-in
                        </span>
                      </div>
                    </div>
                    {selectedReferral.cardProcess?.followup_3_done?.completed && (
                      <span className="font-mono text-[10px] text-[var(--muted-foreground)]">Done</span>
                    )}
                  </div>

                  {/* Pro Active */}
                  <div className="p-3 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-3">
                      <div
                        className={`flex h-6 w-6 items-center justify-center rounded-full border ${
                          selectedReferral.userPlan === "pro"
                            ? "bg-emerald-500 text-white border-emerald-500"
                            : "border-[var(--border)] text-[var(--muted-foreground)]"
                        }`}
                      >
                        <Check size={12} strokeWidth={3} />
                      </div>
                      <div>
                        <span className="font-semibold text-[var(--foreground)] block">Pro active</span>
                        <span className="text-[11px] text-[var(--muted-foreground)]">
                          Upgraded to commercial Pro membership
                        </span>
                      </div>
                    </div>
                    {selectedReferral.userPlan === "pro" && (
                      <span className="font-mono text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold">
                        Pro Member
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* 2. Refer Status: Status card & Upcoming renewal card */}
            {detailTab === "refer_status" && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-1">
                {/* Reward Status Card */}
                <div className="rounded-[5px] border border-[var(--border)] bg-[var(--card)] p-4 space-y-2">
                  <span className="font-mono text-[10px] uppercase tracking-wider text-[var(--muted-foreground)] font-semibold">
                    Referral Status
                  </span>
                  <div className="flex items-center gap-2">
                    {selectedReferral.userPlan === "pro" || selectedReferral.amountConverted > 0 ? (
                      <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-bold text-sm">
                        <CheckCircle2 size={16} />
                        <span>Claimed (₹500 Credited)</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400 font-bold text-sm">
                        <Clock size={16} />
                        <span>Pending (₹500 on Pro Upgrade)</span>
                      </div>
                    )}
                  </div>
                  <p className="text-[11px] text-[var(--muted-foreground)] leading-relaxed">
                    {selectedReferral.userPlan === "pro"
                      ? "This referral has upgraded to Pro. Your ₹500 referral commission is claimed."
                      : "Once this customer upgrades to Pro, your ₹500 reward will be added to your withdrawable balance."}
                  </p>
                </div>

                {/* Upcoming Renewal Card */}
                <div className="rounded-[5px] border border-[var(--border)] bg-[var(--card)] p-4 space-y-2">
                  <span className="font-mono text-[10px] uppercase tracking-wider text-[var(--muted-foreground)] font-semibold">
                    Upcoming Renewal
                  </span>
                  <div className="space-y-1">
                    <p className="text-xs text-[var(--foreground)]">
                      <span className="text-[var(--muted-foreground)]">Renewal Date: </span>
                      <strong className="font-mono">
                        {selectedReferral.membershipExpiresAt
                          ? formatDate(selectedReferral.membershipExpiresAt)
                          : "Not scheduled (Free tier)"}
                      </strong>
                    </p>
                    <p className="text-xs text-[var(--foreground)]">
                      <span className="text-[var(--muted-foreground)]">Amount you get: </span>
                      <strong className="font-mono text-emerald-600 dark:text-emerald-400">
                        {selectedReferral.userPlan === "pro"
                          ? "₹250"
                          : "—"}
                      </strong>
                    </p>
                  </div>
                  <p className="text-[11px] text-[var(--muted-foreground)]">
                    {selectedReferral.userPlan === "pro"
                      ? "When this Pro customer renews their annual membership, you get ₹250."
                      : "No renewal commission for Free Trial to Pro conversion."}
                  </p>
                </div>
              </div>
            )}

            {/* 3. Company Details */}
            {detailTab === "company" && (
              <div className="rounded-[5px] border border-[var(--border)] bg-[var(--card)] p-4 space-y-3 text-xs">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <span className="text-[11px] font-mono text-[var(--muted-foreground)] uppercase">Phone</span>
                    <div className="flex items-center gap-2 mt-0.5">
                      <a href={`tel:${selectedReferral.phone}`} className="font-semibold text-[var(--foreground)] hover:underline">
                        {selectedReferral.phone || "—"}
                      </a>
                    </div>
                  </div>

                  <div>
                    <span className="text-[11px] font-mono text-[var(--muted-foreground)] uppercase">WhatsApp</span>
                    <div className="flex items-center gap-2 mt-0.5">
                      {selectedReferral.phone ? (
                        <a
                          href={`https://wa.me/91${selectedReferral.phone.replace(/[^0-9]/g, "").slice(-10)}`}
                          target="_blank"
                          rel="noreferrer"
                          className="font-semibold text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1"
                        >
                          <MessageSquare size={13} />
                          <span>Chat on WhatsApp</span>
                        </a>
                      ) : (
                        <span>—</span>
                      )}
                    </div>
                  </div>

                  <div>
                    <span className="text-[11px] font-mono text-[var(--muted-foreground)] uppercase">Email</span>
                    <p className="font-mono text-[var(--foreground)] mt-0.5">{selectedReferral.email || "—"}</p>
                  </div>

                  <div>
                    <span className="text-[11px] font-mono text-[var(--muted-foreground)] uppercase">GST Number</span>
                    <p className="font-mono text-[var(--foreground)] mt-0.5">{selectedReferral.gstNumber || "Not provided"}</p>
                  </div>
                </div>

                <div className="pt-2 border-t border-[var(--border)]">
                  <span className="text-[11px] font-mono text-[var(--muted-foreground)] uppercase">Address</span>
                  <p className="text-[var(--foreground)] mt-0.5 leading-relaxed">
                    {selectedReferral.address || "Address not provided"}
                    {selectedReferral.city ? `, ${selectedReferral.city}` : ""}
                    {selectedReferral.pincode ? ` - ${selectedReferral.pincode}` : ""}
                  </p>
                </div>
              </div>
            )}

            {/* 4. Team Members */}
            {detailTab === "team" && (
              <div className="space-y-3">
                {selectedReferral.teamMembers.length === 0 ? (
                  <div className="rounded-[5px] border border-[var(--border)] p-8 text-center text-xs text-[var(--muted-foreground)]">
                    No team members added yet for this business.
                  </div>
                ) : (
                  <div className="rounded-[5px] border border-[var(--border)] divide-y divide-[var(--border)] overflow-hidden">
                    {selectedReferral.teamMembers.map((emp) => (
                      <div key={emp.id} className="p-3 flex items-center justify-between text-xs">
                        <div>
                          <span className="font-semibold text-[var(--foreground)] block">{emp.name}</span>
                          <span className="text-[11px] text-[var(--muted-foreground)] block">
                            {emp.designation || "Team Member"} {emp.phone ? `• ${emp.phone}` : ""}
                          </span>
                        </div>
                        <span className="font-mono text-[10px] text-[var(--muted-foreground)]">
                          {emp.isActive ? "Active" : "Inactive"}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* 5. Note */}
            {detailTab === "note" && (
              <div className="rounded-[5px] border border-[var(--border)] bg-[var(--card)] p-4 space-y-2 text-xs">
                <span className="font-mono text-[11px] font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
                  Referral Note & History
                </span>
                <p className="text-[var(--foreground)] leading-relaxed">
                  Referred on <strong>{formatDate(selectedReferral.createdAt)}</strong> via{" "}
                  <strong>{selectedReferral.source === "card" ? "Digital Card Profile" : "Coupon Code"}</strong>.
                  {selectedReferral.couponCode && ` Used Coupon: ${selectedReferral.couponCode}.`}
                </p>
              </div>
            )}

            <div className="flex justify-end pt-2 border-t border-[var(--border)]">
              <Button variant="secondary" size="sm" onClick={() => setSelectedReferral(null)}>
                Close
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* WITHDRAWAL REQUEST MODAL */}
      {isWithdrawOpen && (
        <Modal
          isOpen={isWithdrawOpen}
          onClose={() => setIsWithdrawOpen(false)}
          title="Withdraw Referral Revenue"
          maxWidth="md"
        >
          <form onSubmit={handleWithdrawSubmit} className="space-y-4 pt-1">
            <div className="rounded-[5px] border border-[var(--border)] bg-[var(--accent)]/40 p-3 flex items-center justify-between text-xs">
              <span className="text-[var(--muted-foreground)]">Available Balance:</span>
              <span className="font-mono text-base font-bold text-emerald-600 dark:text-emerald-400">
                ₹{kpis.withdrawableBalance.toLocaleString("en-IN")}
              </span>
            </div>

            {withdrawError && (
              <div className="flex items-center gap-2 p-2.5 rounded-[5px] border border-rose-500/20 bg-rose-500/10 text-xs text-rose-600 dark:text-rose-400">
                <AlertCircle size={14} className="shrink-0" />
                <span>{withdrawError}</span>
              </div>
            )}

            {withdrawSuccess && (
              <div className="flex items-center gap-2 p-2.5 rounded-[5px] border border-emerald-500/20 bg-emerald-500/10 text-xs text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 size={14} className="shrink-0" />
                <span>{withdrawSuccess}</span>
              </div>
            )}

            {/* Withdrawal Amount */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-[var(--foreground)] block">
                Withdrawal Amount (₹):
              </label>
              <input
                type="number"
                min="1"
                max={kpis.withdrawableBalance}
                required
                value={withdrawAmount}
                onChange={(e) => setWithdrawAmount(e.target.value)}
                className="w-full rounded-[5px] border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm font-mono font-bold text-[var(--foreground)] outline-none focus:border-[var(--foreground)]"
                placeholder="Enter amount"
              />
            </div>

            {/* Payout Method selection */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[var(--foreground)] block">
                Select Payout Method:
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setPayoutMethod("bank_transfer")}
                  className={`p-2.5 rounded-[5px] border text-xs font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer ${
                    payoutMethod === "bank_transfer"
                      ? "border-[var(--foreground)] bg-[var(--accent)] text-[var(--foreground)]"
                      : "border-[var(--border)] text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
                  }`}
                >
                  <Building2 size={14} />
                  <span>Bank Transfer</span>
                </button>

                <button
                  type="button"
                  onClick={() => setPayoutMethod("upi")}
                  className={`p-2.5 rounded-[5px] border text-xs font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer ${
                    payoutMethod === "upi"
                      ? "border-[var(--foreground)] bg-[var(--accent)] text-[var(--foreground)]"
                      : "border-[var(--border)] text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
                  }`}
                >
                  <Send size={14} />
                  <span>UPI Payout</span>
                </button>
              </div>
            </div>

            {/* Bank Transfer Inputs */}
            {payoutMethod === "bank_transfer" ? (
              <div className="space-y-2.5 pt-1 text-xs">
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <label className="text-[11px] font-mono text-[var(--muted-foreground)]">Account Holder Name</label>
                    <input
                      type="text"
                      required
                      value={bankDetails.account_holder}
                      onChange={(e) => setBankDetails({ ...bankDetails, account_holder: e.target.value })}
                      placeholder="Name as per bank"
                      className="w-full rounded-[5px] border border-[var(--border)] bg-[var(--background)] px-2.5 py-1.5 text-xs text-[var(--foreground)] outline-none focus:border-[var(--foreground)]"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] font-mono text-[var(--muted-foreground)]">Bank Name</label>
                    <input
                      type="text"
                      required
                      value={bankDetails.bank_name}
                      onChange={(e) => setBankDetails({ ...bankDetails, bank_name: e.target.value })}
                      placeholder="e.g. HDFC Bank"
                      className="w-full rounded-[5px] border border-[var(--border)] bg-[var(--background)] px-2.5 py-1.5 text-xs text-[var(--foreground)] outline-none focus:border-[var(--foreground)]"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-mono text-[var(--muted-foreground)]">Account Number</label>
                  <input
                    type="password"
                    required
                    value={bankDetails.account_number}
                    onChange={(e) => setBankDetails({ ...bankDetails, account_number: e.target.value })}
                    placeholder="Enter account number"
                    className="w-full rounded-[5px] border border-[var(--border)] bg-[var(--background)] px-2.5 py-1.5 text-xs font-mono text-[var(--foreground)] outline-none focus:border-[var(--foreground)]"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-mono text-[var(--muted-foreground)]">Confirm Account Number</label>
                  <input
                    type="text"
                    required
                    value={bankDetails.confirm_account_number}
                    onChange={(e) => setBankDetails({ ...bankDetails, confirm_account_number: e.target.value })}
                    placeholder="Re-enter account number"
                    className="w-full rounded-[5px] border border-[var(--border)] bg-[var(--background)] px-2.5 py-1.5 text-xs font-mono text-[var(--foreground)] outline-none focus:border-[var(--foreground)]"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-mono text-[var(--muted-foreground)]">IFSC Code</label>
                  <input
                    type="text"
                    required
                    value={bankDetails.ifsc}
                    onChange={(e) => setBankDetails({ ...bankDetails, ifsc: e.target.value.toUpperCase() })}
                    placeholder="e.g. HDFC0001234"
                    className="w-full rounded-[5px] border border-[var(--border)] bg-[var(--background)] px-2.5 py-1.5 text-xs font-mono uppercase text-[var(--foreground)] outline-none focus:border-[var(--foreground)]"
                  />
                </div>
              </div>
            ) : (
              /* UPI Inputs */
              <div className="space-y-2.5 pt-1 text-xs">
                <div className="space-y-1">
                  <label className="text-[11px] font-mono text-[var(--muted-foreground)]">UPI ID or Mobile VPA</label>
                  <input
                    type="text"
                    required
                    value={upiDetails.upi_id}
                    onChange={(e) => setUpiDetails({ ...upiDetails, upi_id: e.target.value })}
                    placeholder="username@okhdfcbank or 9876543210@paytm"
                    className="w-full rounded-[5px] border border-[var(--border)] bg-[var(--background)] px-2.5 py-1.5 text-xs font-mono text-[var(--foreground)] outline-none focus:border-[var(--foreground)]"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-mono text-[var(--muted-foreground)]">Registered Name (Optional)</label>
                  <input
                    type="text"
                    value={upiDetails.holder_name}
                    onChange={(e) => setUpiDetails({ ...upiDetails, holder_name: e.target.value })}
                    placeholder="Name as registered on UPI"
                    className="w-full rounded-[5px] border border-[var(--border)] bg-[var(--background)] px-2.5 py-1.5 text-xs text-[var(--foreground)] outline-none focus:border-[var(--foreground)]"
                  />
                </div>
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-[var(--border)]">
              <Button
                variant="secondary"
                size="sm"
                type="button"
                onClick={() => setIsWithdrawOpen(false)}
                disabled={withdrawLoading}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                type="submit"
                isLoading={withdrawLoading}
                disabled={withdrawLoading || kpis.withdrawableBalance <= 0}
              >
                <Send size={13} className="mr-1.5" />
                Submit Withdrawal
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* WITHDRAWAL HISTORY MODAL */}
      {isHistoryOpen && (
        <Modal
          isOpen={isHistoryOpen}
          onClose={() => setIsHistoryOpen(false)}
          title="Withdrawal & Payout History"
          maxWidth="lg"
        >
          <div className="space-y-4 pt-1 max-h-[70vh] overflow-y-auto">
            {historyLoading ? (
              <div className="py-12 text-center text-xs text-[var(--muted-foreground)]">
                <Loader2 size={16} className="animate-spin inline-block mr-2" />
                Loading history...
              </div>
            ) : withdrawalHistory.length === 0 ? (
              <div className="py-10 text-center text-xs text-[var(--muted-foreground)]">
                No past withdrawals recorded yet.
              </div>
            ) : (
              <div className="overflow-hidden rounded-[5px] border border-[var(--border)]">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-[var(--border)] bg-[var(--accent)]/50 font-mono text-[11px] uppercase tracking-wider text-[var(--muted-foreground)]">
                    <tr>
                      <th scope="col" className="px-3 py-2.5">Date</th>
                      <th scope="col" className="px-3 py-2.5">Amount</th>
                      <th scope="col" className="px-3 py-2.5">Method</th>
                      <th scope="col" className="px-3 py-2.5 text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border)]">
                    {withdrawalHistory.map((w) => (
                      <tr key={w.id}>
                        <td className="px-3 py-2.5 font-mono text-[11px]">
                          {formatDate(w.created_at)}
                        </td>
                        <td className="px-3 py-2.5 font-mono font-bold text-[var(--foreground)]">
                          ₹{Number(w.amount).toLocaleString("en-IN")}
                        </td>
                        <td className="px-3 py-2.5 font-mono text-[11px]">
                          {w.payout_method === "bank_transfer" ? "Bank" : "UPI"}
                        </td>
                        <td className="px-3 py-2.5 text-right">
                          <span
                            className={`inline-flex items-center px-1.5 py-0.5 rounded-[4px] font-mono text-[10px] font-semibold uppercase tracking-wider border ${
                              w.status === "transferred"
                                ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                                : "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20"
                            }`}
                          >
                            {w.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="flex justify-end pt-2">
              <Button variant="secondary" size="sm" onClick={() => setIsHistoryOpen(false)}>
                Close
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
