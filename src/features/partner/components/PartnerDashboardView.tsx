"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/supabase/client";
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
  LogOut,
  ChevronDown,
  Info,
  Bell,
  Maximize2,
  ArrowLeft,
  Lock,
} from "lucide-react";
import { Modal } from "@/admin/shared/ui/Modal";
import { Badge } from "@/admin/shared/ui/Badge";
import { Button } from "@/admin/shared/ui/Button";
import { AdminThemeToggle } from "@/admin/shared/ui/AdminThemeToggle";
import { formatDate } from "@/admin/shared/lib/formatters";
import {
  COUPON_DISCOUNT_TIERS,
  getCouponRewardAmount,
  type CouponDiscountTier,
} from "@/lib/coupons/tiers";

export interface ReferralUser {
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

export interface PartnerKpis {
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

export interface WithdrawalItem {
  id: string;
  amount: number;
  payout_method: "bank_transfer" | "upi";
  account_details: any;
  status: "pending" | "transferred" | "rejected";
  created_at: string;
  transferred_at?: string | null;
}

export interface PartnerNotification {
  id: string;
  title: string;
  message: string;
  type: "signup" | "followup" | "renewal" | "reward" | "payout";
  date: string;
  targetUser?: ReferralUser;
}

const LIFECYCLE_MILESTONES = [
  { key: "greetings_sent", title: "Greetings message sent", description: "Welcome greeting sent to customer", partnerEditable: true },
  { key: "customer_responded_designing", title: "Customer responded and card sent to designer", description: "Requirements gathered and queued in Designer Studio", partnerEditable: true },
  { key: "card_printed_approved", title: "Card printed customer approved ready for dispatch", description: "Physical card printed and artwork approved (Designer / Admin)", partnerEditable: false },
  { key: "card_posted", title: "Card posted", description: "Dispatched via courier (Designer / Admin)", partnerEditable: false },
  { key: "card_delivered", title: "Card delivered", description: "Physical card delivered to customer (Designer / Admin)", partnerEditable: false },
  { key: "followup_1_done", title: "After 30 days 1st follow-up done", description: "Day 30 check-in and usage feedback", partnerEditable: true },
  { key: "followup_2_done", title: "After 60 days second follow-up done", description: "Day 60 check-in and feature review", partnerEditable: true },
  { key: "followup_3_done", title: "After 90 days third follow-up done", description: "Day 90 check-in before expiry", partnerEditable: true },
  { key: "pro_active", title: "Pro active", description: "Customer active on paid Pro subscription", partnerEditable: false },
];

export function PartnerDashboardView() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"referrals" | "coupon" | "withdrawals">("referrals");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Referrals and KPIs
  const [referrals, setReferrals] = useState<ReferralUser[]>([]);
  const [kpis, setKpis] = useState<PartnerKpis>({
    totalUsers: 0,
    upcomingRenewalsCount: 0,
    nextUpcomingRenewal: null,
    revenueThroughReferrals: 0,
    amountPending: 0,
    amountTransferred: 0,
    withdrawableBalance: 0,
    pendingWithdrawalTotal: 0,
  });
  const [partnerProfile, setPartnerProfile] = useState<any>(null);

  // Active coupons by tier (₹200, ₹300, ₹500)
  const [couponsByTier, setCouponsByTier] = useState<Record<CouponDiscountTier, string | null>>({
    200: null,
    300: null,
    500: null,
  });
  const [tierPrefixes, setTierPrefixes] = useState<Record<CouponDiscountTier, string>>({
    200: "",
    300: "",
    500: "",
  });
  const [savingTier, setSavingTier] = useState<CouponDiscountTier | null>(null);
  const [tierMessages, setTierMessages] = useState<
    Partial<Record<CouponDiscountTier, { text: string; isError?: boolean }>>
  >({});
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedTier, setCopiedTier] = useState<CouponDiscountTier | null>(null);

  // Filters & sorting
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "trial" | "pro" | "free" | "expired">("all");
  const [sortBy, setSortBy] = useState<"recently_added" | "a_z" | "z_a" | "expiring_soon">("recently_added");

  // Customer Detail Drawer / Modal
  const [selectedUser, setSelectedUser] = useState<ReferralUser | null>(null);
  const [detailTab, setDetailTab] = useState<"status" | "refer_status" | "company" | "team" | "notes">("status");
  const [togglingMilestoneKey, setTogglingMilestoneKey] = useState<string | null>(null);
  const [partnerFollowupDate, setPartnerFollowupDate] = useState<string>(() =>
    new Date(Date.now() + 86_400_000).toISOString().slice(0, 10)
  );
  const [partnerFollowupNote, setPartnerFollowupNote] = useState("");
  const [savingPartnerFollowup, setSavingPartnerFollowup] = useState(false);
  const [partnerFollowupMsg, setPartnerFollowupMsg] = useState<string | null>(null);

  // Withdrawals
  const [withdrawals, setWithdrawals] = useState<WithdrawalItem[]>([]);
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState<string>("");
  const [payoutMethod, setPayoutMethod] = useState<"bank_transfer" | "upi">("bank_transfer");
  const [bankDetails, setBankDetails] = useState({
    account_number: "",
    confirm_account_number: "",
    ifsc: "",
    account_holder: "",
    bank_name: "",
  });
  const [upiDetails, setUpiDetails] = useState({
    upi_id: "",
    account_holder: "",
  });
  const [submittingWithdraw, setSubmittingWithdraw] = useState(false);
  const [withdrawError, setWithdrawError] = useState<string | null>(null);

  // Layout & Notifications
  const mainScrollRef = useRef<HTMLDivElement>(null);
  const notificationsRef = useRef<HTMLDivElement>(null);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showAllNotificationsModal, setShowAllNotificationsModal] = useState(false);
  const [partnerNotifFilter, setPartnerNotifFilter] = useState<"all" | "unread" | "followup" | "renewal" | "signup">("all");
  const [partnerNotifSearch, setPartnerNotifSearch] = useState("");
  const [readNotificationIds, setReadNotificationIds] = useState<Set<string>>(() => {
    if (typeof window === "undefined") return new Set();
    try {
      const raw = localStorage.getItem("nammainfo_partner_read_notifications");
      if (raw) return new Set(JSON.parse(raw));
    } catch {}
    return new Set();
  });

  // Close notifications popover on click outside
  useEffect(() => {
    if (!showNotifications) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (notificationsRef.current && !notificationsRef.current.contains(e.target as Node)) {
        setShowNotifications(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showNotifications]);

  const handleTabChange = (tab: "referrals" | "coupon" | "withdrawals") => {
    setActiveTab(tab);
    if (mainScrollRef.current) {
      mainScrollRef.current.scrollTop = 0;
    }
  };

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/partner/login");
  };

  // Fetch referrals, KPIs & active coupon
  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [refRes, couponRes] = await Promise.all([
        fetch("/api/campaign/referrals"),
        fetch("/api/campaign/coupon"),
      ]);

      if (refRes.status === 401 || refRes.status === 403) {
        router.push("/partner/login");
        return;
      }

      const refData = await refRes.json();
      const couponData = await couponRes.json();

      if (refData.error) throw new Error(refData.error);

      setReferrals(refData.referrals || []);
      setKpis(refData.kpis || {
        totalUsers: 0,
        upcomingRenewalsCount: 0,
        nextUpcomingRenewal: null,
        revenueThroughReferrals: 0,
        amountPending: 0,
        amountTransferred: 0,
        withdrawableBalance: 0,
        pendingWithdrawalTotal: 0,
      });
      setPartnerProfile(refData.manager || null);

      const loadedList: any[] = Array.isArray(couponData.coupons)
        ? couponData.coupons
        : couponData.coupon
        ? [couponData.coupon]
        : [];
      const nextCodes: Record<CouponDiscountTier, string | null> = { 200: null, 300: null, 500: null };
      const nextPrefixes: Record<CouponDiscountTier, string> = { 200: "", 300: "", 500: "" };
      for (const c of loadedList) {
        const tier = Number(c?.discount_amount) as CouponDiscountTier;
        if ((tier === 200 || tier === 300 || tier === 500) && c?.code) {
          nextCodes[tier] = c.code;
          nextPrefixes[tier] = String(c.code).replace(new RegExp(`${tier}$`), "");
        }
      }
      setCouponsByTier(nextCodes);
      setTierPrefixes(nextPrefixes);
    } catch (err: any) {
      console.error("[Partner Dashboard] Load error:", err);
      setError(err.message || "Failed to load partner dashboard data");
    } finally {
      setLoading(false);
    }
  };

  const loadWithdrawals = async () => {
    try {
      const res = await fetch("/api/campaign/withdrawals");
      const data = await res.json();
      if (data.withdrawals) {
        setWithdrawals(data.withdrawals);
      }
    } catch (err) {
      console.error("Failed to load withdrawals:", err);
    }
  };

  useEffect(() => {
    loadData();
    loadWithdrawals();
  }, []);

  // Dynamic Notifications: Signups, 30/60/90-Day Follow-ups, Expirations & Payouts
  const notifications = useMemo<PartnerNotification[]>(() => {
    const list: PartnerNotification[] = [];
    const now = new Date();

    // 1. Process referrals
    referrals.forEach((r) => {
      // A. New signup within last 7 days
      const createdDate = new Date(r.createdAt);
      const diffHours = (now.getTime() - createdDate.getTime()) / (1000 * 60 * 60);
      if (diffHours <= 168) {
        list.push({
          id: `signup-${r.id}`,
          title: "New Referral Registered",
          message: `${r.businessName || r.ownerName} signed up through your referral link.`,
          type: "signup",
          date: r.createdAt,
          targetUser: r,
        });
      }

      // B. Pro conversion within last 7 days
      if (r.convertedAt) {
        const convDate = new Date(r.convertedAt);
        const convDiffHours = (now.getTime() - convDate.getTime()) / (1000 * 60 * 60);
        if (convDiffHours <= 168) {
          list.push({
            id: `conv-${r.id}`,
            title: "Pro Reward Converted!",
            message: `${r.businessName} converted to Pro. ₹${r.amountConverted} added to your balance.`,
            type: "reward",
            date: r.convertedAt,
            targetUser: r,
          });
        }
      }

      // C. Trial follow-ups due (30, 60, 90 days)
      if (r.userPlan === "trial" && r.subscriptionStartedAt) {
        const startDate = new Date(r.subscriptionStartedAt);
        const daysElapsed = Math.floor((now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));

        // 30-Day Follow-Up Check (Day 28 to 35)
        if (daysElapsed >= 28 && daysElapsed <= 35 && !r.cardProcess?.followup_1_done?.completed) {
          const timeLabel = daysElapsed === 29 ? "Tomorrow" : daysElapsed === 30 ? "Today" : `Day ${daysElapsed}`;
          list.push({
            id: `f1-${r.id}`,
            title: `30-Day Follow-Up Due (${timeLabel})`,
            message: `Milestone check-in with ${r.businessName} on visiting card usage & customer feedback.`,
            type: "followup",
            date: r.subscriptionStartedAt,
            targetUser: r,
          });
        }

        // 60-Day Follow-Up Check (Day 58 to 65)
        if (daysElapsed >= 58 && daysElapsed <= 65 && !r.cardProcess?.followup_2_done?.completed) {
          const timeLabel = daysElapsed === 59 ? "Tomorrow" : daysElapsed === 60 ? "Today" : `Day ${daysElapsed}`;
          list.push({
            id: `f2-${r.id}`,
            title: `60-Day Follow-Up Due (${timeLabel})`,
            message: `Second milestone review with ${r.businessName} regarding card leads and networking.`,
            type: "followup",
            date: r.subscriptionStartedAt,
            targetUser: r,
          });
        }

        // 90-Day Follow-Up Check (Day 88 to 95)
        if (daysElapsed >= 88 && daysElapsed <= 95 && !r.cardProcess?.followup_3_done?.completed) {
          const timeLabel = daysElapsed === 89 ? "Tomorrow" : daysElapsed === 90 ? "Today" : `Day ${daysElapsed}`;
          list.push({
            id: `f3-${r.id}`,
            title: `90-Day Pre-Expiry Milestone (${timeLabel})`,
            message: `${r.businessName}'s 100-day trial is concluding. Reach out to guide their Pro renewal.`,
            type: "followup",
            date: r.subscriptionStartedAt,
            targetUser: r,
          });
        }
      }

      // D. Plan expiration / renewal upcoming (within next 7 days, highlighting tomorrow / today!)
      if (r.membershipExpiresAt) {
        const expiryDate = new Date(r.membershipExpiresAt);
        const daysLeft = Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        if (daysLeft >= 0 && daysLeft <= 7) {
          const dayText = daysLeft === 0 ? "Today" : daysLeft === 1 ? "Tomorrow" : `in ${daysLeft} days`;
          list.push({
            id: `exp-${r.id}`,
            title: `${r.userPlan === "pro" ? "Pro Plan Renewal" : "Trial Expiring"} (${dayText})`,
            message: `${r.businessName}'s subscription expires ${dayText.toLowerCase()}.${r.userPlan === "pro" ? " Renewal commission: ₹500." : ""}`,
            type: "renewal",
            date: r.membershipExpiresAt,
            targetUser: r,
          });
        }
      }
    });

    // 2. Process withdrawal payouts transferred
    withdrawals.forEach((w) => {
      if (w.status === "transferred" && w.transferred_at) {
        const transDate = new Date(w.transferred_at);
        const diffHours = (now.getTime() - transDate.getTime()) / (1000 * 60 * 60);
        if (diffHours <= 168) {
          list.push({
            id: `w-${w.id}`,
            title: "Payout Disbursed",
            message: `₹${Number(w.amount).toLocaleString("en-IN")} was transferred by Admin to your account.`,
            type: "payout",
            date: w.transferred_at,
          });
        }
      }
    });

    // Sort newest / most urgent first
    return list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [referrals, withdrawals]);

  const unreadCount = useMemo(() => {
    return notifications.filter((n) => !readNotificationIds.has(n.id)).length;
  }, [notifications, readNotificationIds]);

  const markAllAsRead = () => {
    const allIds = new Set(notifications.map((n) => n.id));
    setReadNotificationIds(allIds);
    try {
      localStorage.setItem("nammainfo_partner_read_notifications", JSON.stringify(Array.from(allIds)));
    } catch {}
  };

  const markOneAsRead = (id: string) => {
    setReadNotificationIds((prev) => {
      const next = new Set(prev);
      next.add(id);
      try {
        localStorage.setItem("nammainfo_partner_read_notifications", JSON.stringify(Array.from(next)));
      } catch {}
      return next;
    });
  };

  // Filtered & Sorted Referrals List
  const filteredReferrals = useMemo(() => {
    return referrals
      .filter((r) => {
        if (statusFilter === "trial" && r.userPlan !== "trial") return false;
        if (statusFilter === "pro" && r.userPlan !== "pro") return false;
        if (statusFilter === "free" && r.userPlan !== "free") return false;
        if (statusFilter === "expired" && r.userPlan !== "expired") return false;

        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const matchName =
            (r.businessName || "").toLowerCase().includes(q) ||
            (r.ownerName || "").toLowerCase().includes(q);
          const matchPhone = (r.phone || "").includes(q);
          const matchEmail = (r.email || "").toLowerCase().includes(q);
          return matchName || matchPhone || matchEmail;
        }
        return true;
      })
      .sort((a, b) => {
        if (sortBy === "recently_added") {
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        }
        if (sortBy === "a_z") {
          return (a.businessName || "").localeCompare(b.businessName || "");
        }
        if (sortBy === "z_a") {
          return (b.businessName || "").localeCompare(a.businessName || "");
        }
        if (sortBy === "expiring_soon") {
          const aExp = a.membershipExpiresAt ? new Date(a.membershipExpiresAt).getTime() : Number.MAX_SAFE_INTEGER;
          const bExp = b.membershipExpiresAt ? new Date(b.membershipExpiresAt).getTime() : Number.MAX_SAFE_INTEGER;
          return aExp - bExp;
        }
        return 0;
      });
  }, [referrals, statusFilter, searchQuery, sortBy]);

  // Generate / Update Coupon Code for a specific tier (200 | 300 | 500)
  const handleSaveCoupon = async (tier: CouponDiscountTier, e: React.FormEvent) => {
    e.preventDefault();
    setTierMessages((prev) => ({ ...prev, [tier]: undefined }));
    const cleanPrefix = (tierPrefixes[tier] || "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
    const basePrefix = cleanPrefix.endsWith(String(tier))
      ? cleanPrefix.slice(0, -String(tier).length)
      : cleanPrefix;
    if (!basePrefix || basePrefix.length < 2) {
      setTierMessages((prev) => ({
        ...prev,
        [tier]: { text: "Enter at least 2 alphanumeric characters before the discount code.", isError: true },
      }));
      return;
    }

    setSavingTier(tier);
    try {
      const res = await fetch("/api/campaign/coupon", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prefix: basePrefix, discountAmount: tier }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || "Failed to save coupon code");
      }
      const savedCode = data.code || data.coupon?.code;
      setCouponsByTier((prev) => ({ ...prev, [tier]: savedCode || prev[tier] }));
      if (savedCode) {
        setTierPrefixes((prev) => ({
          ...prev,
          [tier]: String(savedCode).replace(new RegExp(`${tier}$`), ""),
        }));
      }
      setTierMessages((prev) => ({
        ...prev,
        [tier]: {
          text: data.message || `Coupon ${savedCode} saved!`,
          isError: false,
        },
      }));
    } catch (err: any) {
      setTierMessages((prev) => ({
        ...prev,
        [tier]: { text: err.message || "Failed to update code", isError: true },
      }));
    } finally {
      setSavingTier(null);
    }
  };

  // Toggle milestone step for selected customer
  const handleToggleMilestone = async (stepKey: string, completed: boolean) => {
    if (!selectedUser) return;
    setTogglingMilestoneKey(stepKey);
    const nowIso = new Date().toISOString();

    const existingProcess = selectedUser.cardProcess || {};
    const updatedProcess = {
      ...existingProcess,
      [stepKey]: {
        completed,
        updated_at: completed ? nowIso : null,
      },
    };

    // Optimistic UI update
    setSelectedUser((prev) => prev ? { ...prev, cardProcess: updatedProcess } : null);
    setReferrals((prev) =>
      prev.map((r) => (r.referredUserId === selectedUser.referredUserId ? { ...r, cardProcess: updatedProcess } : r))
    );

    try {
      const res = await fetch(`/api/partner/referrals/${selectedUser.referredUserId}/process`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stepKey, completed }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || "Failed to update milestone");
      }
    } catch (err: any) {
      alert(`Milestone update failed: ${err.message}`);
      // Revert optimistic update
      setSelectedUser((prev) => prev ? { ...prev, cardProcess: existingProcess } : null);
      setReferrals((prev) =>
        prev.map((r) => (r.referredUserId === selectedUser.referredUserId ? { ...r, cardProcess: existingProcess } : r))
      );
    } finally {
      setTogglingMilestoneKey(null);
    }
  };

  // Submit Withdrawal Request
  const handleSubmitWithdrawal = async (e: React.FormEvent) => {
    e.preventDefault();
    setWithdrawError(null);
    const amt = Number(withdrawAmount);

    if (!amt || isNaN(amt) || amt <= 0) {
      setWithdrawError("Please enter a valid amount.");
      return;
    }
    if (amt > kpis.withdrawableBalance) {
      setWithdrawError(`Requested amount exceeds your available balance (₹${kpis.withdrawableBalance.toLocaleString("en-IN")}).`);
      return;
    }

    if (payoutMethod === "bank_transfer") {
      if (bankDetails.account_number !== bankDetails.confirm_account_number) {
        setWithdrawError("Bank Account numbers do not match.");
        return;
      }
      if (!bankDetails.account_number || !bankDetails.ifsc || !bankDetails.account_holder) {
        setWithdrawError("Please fill all required bank account fields.");
        return;
      }
    } else if (payoutMethod === "upi") {
      if (!upiDetails.upi_id) {
        setWithdrawError("Please enter your UPI ID.");
        return;
      }
    }

    setSubmittingWithdraw(true);
    try {
      const res = await fetch("/api/campaign/withdrawals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: amt,
          payoutMethod,
          accountDetails: payoutMethod === "bank_transfer" ? bankDetails : upiDetails,
        }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || "Failed to submit withdrawal request");
      }

      setShowWithdrawModal(false);
      setWithdrawAmount("");
      await loadData();
      await loadWithdrawals();
      alert("Withdrawal request submitted successfully! Admin will process your transfer shortly.");
    } catch (err: any) {
      setWithdrawError(err.message || "Failed to submit withdrawal");
    } finally {
      setSubmittingWithdraw(false);
    }
  };

  const partnerSlug =
    partnerProfile?.publicSlug ||
    partnerProfile?.slug ||
    partnerProfile?.username ||
    "";
  const publicReferralLink = partnerSlug ? `https://nammainfo.in/${partnerSlug}` : "https://nammainfo.in";
  const isPartnerSubdomain =
    typeof window !== "undefined" &&
    (window.location.hostname.startsWith("partner.") ||
      window.location.hostname.startsWith("campaign."));

  return (
    <div className="flex h-dvh md:h-screen w-full overflow-hidden bg-[var(--background)] text-[var(--foreground)] select-none">
      {/* ========================================================================= */}
      {/* 1. Fixed Left Sidebar (Desktop md+)                                       */}
      {/* ========================================================================= */}
      <aside className="hidden md:flex flex-col w-64 h-screen border-r border-[var(--border)] bg-[var(--card)] p-5 shrink-0 justify-between select-none">
        <div>
          {/* Brand */}
          <div className="pb-6 border-b border-[var(--border)]">
            <h1 className="font-headline text-base font-bold text-[var(--foreground)] tracking-tight">
              Namma Info
            </h1>
            <span className="font-mono text-[10px] uppercase tracking-wider text-[var(--muted-foreground)] block mt-0.5">
              Partner Console
            </span>
          </div>

          {/* Navigation Tabs */}
          <nav className="mt-6 space-y-1">
            <button
              onClick={() => handleTabChange("referrals")}
              className={`flex w-full items-center justify-between rounded-[5px] px-3 py-2 text-xs font-medium cursor-pointer ${
                activeTab === "referrals"
                  ? "bg-[var(--foreground)] text-[var(--background)] shadow-xs"
                  : "text-[var(--muted-foreground)] hover:bg-[var(--accent)] hover:text-[var(--foreground)]"
              }`}
            >
              <div className="flex items-center gap-3">
                <Users size={15} />
                <span>Referrals & Customers</span>
              </div>
              <span
                className={`font-mono text-[10px] font-bold ${
                  activeTab === "referrals"
                    ? "text-[var(--background)] opacity-90"
                    : "text-[var(--muted-foreground)]"
                }`}
              >
                {referrals.length}
              </span>
            </button>

            <button
              onClick={() => handleTabChange("coupon")}
              className={`flex w-full items-center justify-between rounded-[5px] px-3 py-2 text-xs font-medium cursor-pointer ${
                activeTab === "coupon"
                  ? "bg-[var(--foreground)] text-[var(--background)] shadow-xs"
                  : "text-[var(--muted-foreground)] hover:bg-[var(--accent)] hover:text-[var(--foreground)]"
              }`}
            >
              <div className="flex items-center gap-3">
                <Tag size={15} />
                <span>Coupon Generator</span>
              </div>
              {Object.values(couponsByTier).filter(Boolean).length > 0 && (
                <span
                  className={`font-mono text-[10px] font-bold px-1.5 py-0.5 rounded-[4px] border ${
                    activeTab === "coupon"
                      ? "border-[var(--background)]/30 bg-[var(--background)] text-[var(--foreground)]"
                      : "border-[var(--border)] bg-[var(--background)] text-[var(--foreground)]"
                  }`}
                >
                  {Object.values(couponsByTier).filter(Boolean).length}/3
                </span>
              )}
            </button>

            <button
              onClick={() => handleTabChange("withdrawals")}
              className={`flex w-full items-center justify-between rounded-[5px] px-3 py-2 text-xs font-medium cursor-pointer ${
                activeTab === "withdrawals"
                  ? "bg-[var(--foreground)] text-[var(--background)] shadow-xs"
                  : "text-[var(--muted-foreground)] hover:bg-[var(--accent)] hover:text-[var(--foreground)]"
              }`}
            >
              <div className="flex items-center gap-3">
                <Wallet size={15} />
                <span>Payouts & Balances</span>
              </div>
              <span
                className={`font-mono text-[10px] font-bold ${
                  activeTab === "withdrawals"
                    ? "text-[var(--background)] opacity-90"
                    : "text-emerald-600 dark:text-emerald-400"
                }`}
              >
                ₹{kpis.withdrawableBalance.toLocaleString("en-IN")}
              </span>
            </button>
          </nav>
        </div>

        {/* Sidebar Footer: Back to App (if same origin) & Log Out */}
        <div className="border-t border-[var(--border)] pt-4 space-y-2">
          {!isPartnerSubdomain && (
            <Link
              href="/dashboard/settings"
              className="flex w-full items-center justify-between rounded-[5px] border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-xs font-medium text-[var(--foreground)] hover:bg-[var(--accent)] transition-colors"
            >
              <span className="flex items-center gap-2">
                <ArrowLeft size={14} />
                <span>Back to App</span>
              </span>
            </Link>
          )}
          <button
            onClick={handleSignOut}
            className="flex w-full items-center justify-between rounded-[5px] border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-xs font-medium text-[var(--muted-foreground)] hover:text-red-600 dark:hover:text-red-400 hover:bg-[var(--accent)] transition-colors cursor-pointer"
          >
            <span className="flex items-center gap-2">
              <LogOut size={14} />
              <span>Log Out</span>
            </span>
          </button>
        </div>
      </aside>

      {/* ========================================================================= */}
      {/* 2. Main Content View                                                      */}
      {/* ========================================================================= */}
      <div ref={mainScrollRef} className="flex flex-1 flex-col h-dvh md:h-screen overflow-y-auto min-w-0">
        {/* Top Header Bar (Desktop & Mobile responsive matching main app UI) */}
        <header className="sticky top-0 z-20 flex flex-col md:flex-row md:items-center md:justify-between border-b border-[var(--border)] bg-[var(--card)]/95 backdrop-blur-md px-4 py-3 md:px-6 md:py-4 gap-3 shrink-0">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <div className="flex items-center gap-2 md:hidden mb-0.5">
                <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-[var(--muted-foreground)]">
                  Namma Info · Partner
                </span>
              </div>
              <h2 className="font-headline text-base md:text-lg font-bold text-[var(--foreground)] truncate">
                {activeTab === "referrals" && "Referral Customers"}
                {activeTab === "coupon" && "Partner Code & Link"}
                {activeTab === "withdrawals" && "Earnings & Payouts"}
              </h2>
              <p className="text-[11px] md:text-xs text-[var(--muted-foreground)] truncate">
                Partner: <span className="font-medium text-[var(--foreground)]">{partnerProfile?.name || partnerProfile?.businessName || partnerProfile?.business_name || partnerProfile?.owner_name || "Partner Account"}</span>
              </p>
            </div>

            {/* Mobile quick Back / Logout controls */}
            <div className="flex md:hidden items-center gap-1.5 shrink-0">
              {!isPartnerSubdomain && (
                <Link
                  href="/dashboard/settings"
                  className="inline-flex h-8 items-center gap-1 rounded-[5px] border border-[var(--border)] bg-[var(--background)] px-2.5 text-[11px] font-medium text-[var(--foreground)]"
                >
                  <ArrowLeft size={13} />
                  <span>App</span>
                </Link>
              )}
              <button
                type="button"
                onClick={handleSignOut}
                className="flex h-8 w-8 items-center justify-center rounded-[5px] border border-[var(--border)] bg-[var(--background)] text-[var(--muted-foreground)] hover:text-red-500 cursor-pointer"
                title="Log Out"
                aria-label="Log Out"
              >
                <LogOut size={14} />
              </button>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between md:justify-end gap-2">
            {/* Top Right Wallet Chip with Withdraw Button */}
            <div className="flex flex-1 sm:flex-initial items-center justify-between sm:justify-start gap-2 rounded-[5px] border border-[var(--border)] bg-[var(--background)] px-2.5 md:px-3 py-1.5 shadow-xs">
              <div className="flex items-center gap-1.5 min-w-0">
                <Banknote size={15} className="shrink-0 text-emerald-600 dark:text-emerald-400" />
                <div className="flex items-center gap-1 font-mono text-xs">
                  <span className="text-[10px] uppercase text-[var(--muted-foreground)] font-semibold hidden sm:inline">
                    Withdrawable:
                  </span>
                  <span className="font-bold text-[var(--foreground)]">
                    ₹{kpis.withdrawableBalance.toLocaleString("en-IN")}
                  </span>
                </div>
              </div>
              <button
                type="button"
                disabled={kpis.withdrawableBalance <= 0}
                onClick={() => setShowWithdrawModal(true)}
                className="ml-1 rounded-[4px] bg-[var(--foreground)] text-[var(--background)] px-2.5 py-1 text-[11px] font-semibold hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition shrink-0"
              >
                Withdraw
              </button>
            </div>

            {/* Notifications Popover */}
            <div className="relative" ref={notificationsRef}>
              <button
                type="button"
                onClick={() => setShowNotifications(!showNotifications)}
                className="relative flex h-8 w-8 items-center justify-center rounded-[5px] border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] hover:bg-[var(--accent)] transition-colors cursor-pointer"
                title="Notifications & Alerts"
                aria-label="Notifications"
              >
                <Bell size={15} />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-rose-500 px-1 font-mono text-[9px] font-bold text-white shadow-xs">
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </span>
                )}
              </button>

              {/* Popover Dropdown */}
              {showNotifications && (
                <div className="fixed sm:absolute left-4 right-4 sm:left-auto sm:right-0 top-24 sm:top-auto sm:mt-2 sm:w-96 rounded-[5px] border border-[var(--border)] bg-[var(--card)] shadow-2xl z-50 overflow-hidden divide-y divide-[var(--border)] animate-in fade-in duration-100">
                  {/* Popover Header */}
                  <div className="p-3 bg-[var(--accent)]/40 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-headline text-xs font-bold uppercase tracking-wider text-[var(--foreground)]">
                        Partner Alerts
                      </span>
                      {unreadCount > 0 && (
                        <span className="rounded-full bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/25 px-1.5 py-0.2 font-mono text-[10px] font-bold">
                          {unreadCount} new
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {unreadCount > 0 && (
                        <button
                          type="button"
                          onClick={markAllAsRead}
                          className="text-[11px] font-medium text-[var(--muted-foreground)] hover:text-[var(--foreground)] underline cursor-pointer"
                        >
                          Mark all read
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          setShowNotifications(false);
                          setShowAllNotificationsModal(true);
                        }}
                        className="flex h-6 w-6 items-center justify-center rounded-[4px] border border-[var(--border)] bg-[var(--background)] text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--accent)] cursor-pointer"
                        title="Open full notifications view"
                        aria-label="Open full notifications view"
                      >
                        <Maximize2 size={12} />
                      </button>
                    </div>
                  </div>

                  {/* Popover List (Past 2 days) */}
                  {(() => {
                    const twoDaysCutoff = Date.now() - 2 * 24 * 60 * 60 * 1000;
                    const recentPartnerNotifs = notifications.filter(
                      (n) => !n.date || new Date(n.date).getTime() >= twoDaysCutoff
                    );
                    return (
                      <>
                        <div className="max-h-[340px] overflow-y-auto divide-y divide-[var(--border)]">
                          {recentPartnerNotifs.length === 0 ? (
                            <div className="py-8 text-center text-xs text-[var(--muted-foreground)] p-4 space-y-1">
                              <CheckCircle2 size={24} className="mx-auto text-[var(--muted-foreground)] mb-2 opacity-60" />
                              <p className="font-semibold text-[var(--foreground)]">No alerts in the past 2 days</p>
                              <p className="text-[11px]">
                                {notifications.length > 0
                                  ? `${notifications.length} older alert${notifications.length === 1 ? "" : "s"} available in full view.`
                                  : "New referral signups, 30-day follow-ups, and expirations will appear here."}
                              </p>
                            </div>
                          ) : (
                            recentPartnerNotifs.map((n) => {
                              const isRead = readNotificationIds.has(n.id);
                              return (
                                <div
                                  key={n.id}
                                  onClick={() => {
                                    markOneAsRead(n.id);
                                    if (n.targetUser) {
                                      setSelectedUser(n.targetUser);
                                      setDetailTab("status");
                                      setShowNotifications(false);
                                    }
                                  }}
                                  className={`p-3 transition-colors flex items-start gap-3 cursor-pointer ${
                                    isRead
                                      ? "hover:bg-[var(--accent)]/30 opacity-75"
                                      : "bg-[var(--accent)]/20 hover:bg-[var(--accent)]/40"
                                  }`}
                                >
                                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[5px] border border-[var(--border)] bg-[var(--background)] mt-0.5 text-[var(--foreground)]">
                                    {n.type === "signup" && <Users size={13} className="text-[var(--foreground)]" />}
                                    {n.type === "followup" && <Clock size={13} className="text-amber-500" />}
                                    {n.type === "renewal" && <Calendar size={13} className="text-blue-500" />}
                                    {n.type === "reward" && <CheckCircle2 size={13} className="text-emerald-500" />}
                                    {n.type === "payout" && <Banknote size={13} className="text-emerald-500" />}
                                  </div>

                                  <div className="min-w-0 flex-1">
                                    <div className="flex items-center justify-between gap-2">
                                      <span className={`text-xs font-semibold ${isRead ? "text-[var(--foreground)]" : "text-[var(--foreground)] font-bold"}`}>
                                        {n.title}
                                      </span>
                                      {!isRead && (
                                        <span className="h-1.5 w-1.5 rounded-full bg-rose-500 shrink-0" />
                                      )}
                                    </div>
                                    <p className="text-[11px] text-[var(--muted-foreground)] mt-0.5 leading-relaxed">
                                      {n.message}
                                    </p>
                                    {n.targetUser && (
                                      <span className="inline-block text-[10px] text-[var(--foreground)] underline font-medium mt-1">
                                        View customer & card flow →
                                      </span>
                                    )}
                                  </div>
                                </div>
                              );
                            })
                          )}
                        </div>
                        {notifications.length > 0 && (
                          <div className="px-3 py-2 bg-[var(--accent)]/20 flex items-center justify-between text-[11px]">
                            <span className="text-[var(--muted-foreground)] font-mono text-[10px]">
                              Showing past 2 days ({recentPartnerNotifs.length} of {notifications.length})
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                setShowNotifications(false);
                                setShowAllNotificationsModal(true);
                              }}
                              className="font-semibold text-[var(--foreground)] hover:underline cursor-pointer"
                            >
                              View all →
                            </button>
                          </div>
                        )}
                      </>
                    );
                  })()}
                </div>
              )}
            </div>

            {/* Admin Theme Toggle (Exact same position as Admin Console, fully functional with useTheme hook) */}
            <AdminThemeToggle />

            {/* Refresh Button */}
            <button
              onClick={loadData}
              disabled={loading}
              className="flex items-center gap-1.5 rounded-[5px] border border-[var(--border)] bg-[var(--background)] px-3 py-1.5 text-xs font-medium text-[var(--foreground)] hover:bg-[var(--accent)] transition-colors disabled:opacity-50 cursor-pointer"
              title="Refresh partner data"
            >
              <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
              <span>Refresh</span>
            </button>
          </div>
        </header>

        {/* Content Body */}
        <main className="p-4 md:p-6 pb-24 md:pb-8 space-y-5 md:space-y-6 flex-1">
          {error && (
            <div className="flex items-start gap-2.5 rounded-[5px] border border-rose-500/20 bg-rose-500/10 p-4 text-xs text-rose-500">
              <AlertCircle size={16} className="shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 1: REFERRALS & CUSTOMERS                                              */}
          {/* ========================================================================= */}
          {activeTab === "referrals" && (
            <div className="space-y-6">
              {/* KPIs Grid */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="rounded-[5px] border border-[var(--border)] bg-[var(--card)] p-4 shadow-xs flex flex-col justify-between min-h-[105px]">
                  <div>
                    <span className="font-mono text-[10px] uppercase tracking-wider text-[var(--muted-foreground)] font-semibold block">
                      Total Referred Users
                    </span>
                    <div className="mt-2 flex items-baseline gap-2">
                      <span className="font-headline text-2xl font-bold text-[var(--foreground)]">
                        {kpis.totalUsers}
                      </span>
                      <span className="text-[11px] text-[var(--muted-foreground)]">customers</span>
                    </div>
                  </div>
                  <p className="mt-2 text-[10px] text-[var(--muted-foreground)]">
                    Registered through your links
                  </p>
                </div>

                <div className="rounded-[5px] border border-[var(--border)] bg-[var(--card)] p-4 shadow-xs flex flex-col justify-between min-h-[105px]">
                  <div>
                    <span className="font-mono text-[10px] uppercase tracking-wider text-[var(--muted-foreground)] font-semibold block">
                      Upcoming Renewals
                    </span>
                    <div className="mt-2 flex items-baseline gap-2">
                      <span className="font-headline text-2xl font-bold text-[var(--foreground)]">
                        {kpis.upcomingRenewalsCount}
                      </span>
                      <span className="text-[11px] text-[var(--muted-foreground)]">renewals</span>
                    </div>
                  </div>
                  <div className="mt-2 flex items-center justify-between text-[11px] font-mono">
                    {kpis.nextUpcomingRenewal ? (
                      <span className="text-[10px] text-[var(--muted-foreground)] truncate max-w-[55%]">
                        Next: {kpis.nextUpcomingRenewal.businessName} ({kpis.nextUpcomingRenewal.daysRemaining}d)
                      </span>
                    ) : (
                      <span className="text-[10px] text-[var(--muted-foreground)]">Annual cycle</span>
                    )}
                    <span className="font-semibold text-emerald-600 dark:text-emerald-400 ml-auto">
                      ₹{kpis.upcomingRenewalsCount * 500} reward
                    </span>
                  </div>
                </div>

                <div className="rounded-[5px] border border-[var(--border)] bg-[var(--card)] p-4 shadow-xs flex flex-col justify-between min-h-[105px]">
                  <div>
                    <span className="font-mono text-[10px] uppercase tracking-wider text-[var(--muted-foreground)] font-semibold block">
                      Referral Revenue
                    </span>
                    <div className="mt-2 flex items-baseline gap-2">
                      <span className="font-headline text-2xl font-bold text-emerald-600 dark:text-emerald-400 font-mono">
                        ₹{kpis.revenueThroughReferrals.toLocaleString("en-IN")}
                      </span>
                    </div>
                  </div>
                  <p className="mt-2 text-[10px] text-[var(--muted-foreground)]">
                    Total earned from upgrades & renewals
                  </p>
                </div>

                <div className="rounded-[5px] border border-[var(--border)] bg-[var(--card)] p-4 shadow-xs flex flex-col justify-between min-h-[105px]">
                  <div>
                    <span className="font-mono text-[10px] uppercase tracking-wider text-[var(--muted-foreground)] font-semibold block">
                      Potential Pending
                    </span>
                    <div className="mt-2 flex items-baseline gap-2">
                      <span className="font-headline text-2xl font-bold text-amber-600 dark:text-amber-400 font-mono">
                        ₹{kpis.amountPending.toLocaleString("en-IN")}
                      </span>
                    </div>
                  </div>
                  <p className="mt-2 text-[10px] text-[var(--muted-foreground)]">
                    Earn up to ₹1,000 on Pro upgrades
                  </p>
                </div>
              </div>

              {/* Commission Rule Alert Banner */}
              <div className="flex items-center gap-3 rounded-[5px] border border-[var(--border)] bg-[var(--accent)]/50 p-3 text-xs text-[var(--muted-foreground)]">
                <Info size={15} className="text-[var(--foreground)] shrink-0" />
                <div className="leading-relaxed">
                  <strong className="text-[var(--foreground)]">Partner Commission Split:</strong> When your referral upgrades to Pro using your coupon code, they get ₹500 off and you earn ₹500. If they upgrade directly through your profile link without a coupon, you earn the full <span className="font-semibold text-[var(--foreground)]">₹1,000</span>! Annual renewals reward you <span className="font-semibold text-[var(--foreground)]">₹500</span> per customer.
                </div>
              </div>

              {/* Filter Tabs & Search Bar */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 border-b border-[var(--border)] pb-4">
                <div className="flex flex-wrap items-center gap-1.5">
                  {(["all", "trial", "pro", "free", "expired"] as const).map((tab) => (
                    <button
                      key={tab}
                      onClick={() => setStatusFilter(tab)}
                      className={`rounded-[5px] px-3 py-1.5 text-xs font-semibold uppercase tracking-wider transition-colors cursor-pointer ${
                        statusFilter === tab
                          ? "bg-[var(--foreground)] text-[var(--background)] shadow-xs"
                          : "border border-[var(--border)] bg-[var(--card)] text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
                      }`}
                    >
                      {tab === "all" ? "All Referrals" : tab === "trial" ? "Free Trial" : tab === "pro" ? "Pro Plan" : tab === "free" ? "Free" : "Expired"}
                    </button>
                  ))}
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                  <div className="relative flex flex-1 items-center rounded-[5px] border border-[var(--border)] bg-[var(--card)] px-2.5 py-1.5 text-xs">
                    <Search size={13} className="text-[var(--muted-foreground)] mr-1.5 shrink-0" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search company, owner, phone…"
                      className="bg-transparent text-xs text-[var(--foreground)] outline-none placeholder-[var(--muted-foreground)] w-full sm:w-56"
                    />
                  </div>

                  <select
                    value={sortBy}
                    onChange={(e: any) => setSortBy(e.target.value)}
                    className="rounded-[5px] border border-[var(--border)] bg-[var(--card)] px-2.5 py-1.5 text-xs font-medium text-[var(--foreground)] outline-none cursor-pointer"
                  >
                    <option value="recently_added">Recent Sign-ups</option>
                    <option value="a_z">Alphabetical (A–Z)</option>
                    <option value="z_a">Alphabetical (Z–A)</option>
                    <option value="expiring_soon">Expiring Soon</option>
                  </select>
                </div>
              </div>

              {/* Referrals Mobile Card List (< md) */}
              <div className="md:hidden space-y-2.5">
                {filteredReferrals.length === 0 ? (
                  <div className="rounded-[5px] border border-[var(--border)] bg-[var(--card)] p-6 text-center text-xs text-[var(--muted-foreground)]">
                    No referrals found matching the selected filter.
                  </div>
                ) : (
                  filteredReferrals.map((r) => {
                    const isConverted = r.referralStatus === "converted" || r.referralStatus === "claimed";
                    return (
                      <div
                        key={`mobile-${r.id}`}
                        className="rounded-[5px] border border-[var(--border)] bg-[var(--card)] p-3.5 space-y-2.5"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-[var(--foreground)] truncate">
                              {r.businessName}
                            </p>
                            <p className="text-xs text-[var(--muted-foreground)] truncate">
                              {r.ownerName} {r.phone ? `• ${r.phone}` : ""}
                            </p>
                          </div>
                          <span className="shrink-0 rounded-[4px] border border-[var(--border)] bg-[var(--background)] px-2 py-0.5 font-mono text-[10px] font-semibold uppercase text-[var(--foreground)]">
                            {r.userPlan === "trial" ? "Free Trial" : r.userPlan.toUpperCase()}
                          </span>
                        </div>

                        <div className="flex items-center justify-between gap-2 text-[11px] border-t border-[var(--border)] pt-2">
                          <span className="font-mono text-[var(--muted-foreground)]">
                            {r.couponCode ? `Code: ${r.couponCode}` : "Card Link"}
                          </span>
                          <span className="font-mono font-semibold text-[var(--foreground)]">
                            {isConverted ? `Claimed: ₹${r.amountConverted}` : `Pending: ₹${r.amountPending}`}
                          </span>
                        </div>

                        <button
                          type="button"
                          onClick={() => {
                            setSelectedUser(r);
                            setDetailTab("status");
                          }}
                          className="flex w-full items-center justify-center gap-1.5 rounded-[5px] border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-xs font-semibold text-[var(--foreground)] hover:bg-[var(--accent)] cursor-pointer"
                        >
                          <span>Status &amp; Details</span>
                          <ChevronRight size={13} />
                        </button>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Referrals Customers Table (Desktop md+) */}
              <div className="hidden md:block rounded-[5px] border border-[var(--border)] bg-[var(--card)] overflow-hidden shadow-xs">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-[var(--border)] bg-[var(--accent)]/40 text-[10px] font-mono uppercase tracking-wider text-[var(--muted-foreground)]">
                        <th className="py-3 px-4 font-semibold">Customer / Company</th>
                        <th className="py-3 px-4 font-semibold">Account Status</th>
                        <th className="py-3 px-4 font-semibold">Referral Source</th>
                        <th className="py-3 px-4 font-semibold">Milestone Process</th>
                        <th className="py-3 px-4 font-semibold">Partner Reward</th>
                        <th className="py-3 px-4 text-right font-semibold">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--border)]">
                      {filteredReferrals.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="py-8 text-center text-xs text-[var(--muted-foreground)]">
                            No referrals found matching the selected filter.
                          </td>
                        </tr>
                      ) : (
                        filteredReferrals.map((r) => {
                          const isConverted = r.referralStatus === "converted" || r.referralStatus === "claimed";
                          const hasCoupon = Boolean(r.couponCode);

                          return (
                            <tr key={r.id} className="hover:bg-[var(--accent)]/20 transition-colors">
                              <td className="py-3.5 px-4">
                                <div className="font-semibold text-[var(--foreground)]">
                                  {r.businessName}
                                </div>
                                <div className="text-[11px] text-[var(--muted-foreground)]">
                                  {r.ownerName} {r.phone ? `• ${r.phone}` : ""}
                                </div>
                              </td>

                              <td className="py-3.5 px-4">
                                <span
                                  className={`inline-block rounded-[4px] px-2 py-0.5 text-[10px] font-mono font-semibold border ${
                                    r.userPlan === "pro"
                                      ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                                      : r.userPlan === "trial"
                                      ? "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20"
                                      : r.userPlan === "expired"
                                      ? "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20"
                                      : "bg-zinc-500/10 text-zinc-600 dark:text-zinc-400 border-zinc-500/20"
                                  }`}
                                >
                                  {r.userPlan === "trial" ? "Free Trial" : r.userPlan.toUpperCase()}
                                </span>
                              </td>

                              <td className="py-3.5 px-4">
                                {hasCoupon ? (
                                  <span className="font-mono text-[11px] font-semibold text-[var(--foreground)]">
                                    {r.couponCode}
                                  </span>
                                ) : (
                                  <span className="font-mono text-[10px] text-[var(--muted-foreground)]">
                                    Card Link
                                  </span>
                                )}
                              </td>

                              <td className="py-3.5 px-4">
                                <div className="text-[11px] text-[var(--foreground)] font-medium">
                                  {r.cardProcess?.pro_active?.completed
                                    ? "Pro Active"
                                    : r.cardProcess?.card_delivered?.completed
                                    ? "Card Delivered"
                                    : r.cardProcess?.card_posted?.completed
                                    ? "Card Posted"
                                    : r.cardProcess?.card_printed_approved?.completed
                                    ? "Card Printed"
                                    : r.cardProcess?.customer_responded_designing?.completed
                                    ? "Sent to Designer"
                                    : r.cardProcess?.greetings_sent?.completed
                                    ? "Greetings Sent"
                                    : "Onboarding"}
                                </div>
                              </td>

                              <td className="py-3.5 px-4">
                                {isConverted ? (
                                  <div>
                                    <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                                      Claimed: ₹{r.amountConverted}
                                    </span>
                                    {r.renewalCount > 0 && (
                                      <div className="text-[10px] font-mono text-[var(--muted-foreground)]">
                                        ({r.renewalCount} renewal{r.renewalCount > 1 ? "s" : ""})
                                      </div>
                                    )}
                                  </div>
                                ) : (
                                  <span className="font-mono font-semibold text-amber-600 dark:text-amber-400">
                                    Pending: ₹{r.amountPending}
                                  </span>
                                )}
                              </td>

                              <td className="py-3.5 px-4 text-right">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSelectedUser(r);
                                    setDetailTab("status");
                                  }}
                                  className="rounded-[4px] border border-[var(--border)] bg-[var(--background)] px-2.5 py-1 text-xs font-semibold text-[var(--foreground)] hover:bg-[var(--accent)] transition-colors cursor-pointer"
                                >
                                  Status & Details
                                </button>
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

          {/* ========================================================================= */}
          {/* TAB 2: COUPON GENERATOR                                                   */}
          {/* ========================================================================= */}
          {activeTab === "coupon" && (
            <div className="max-w-3xl space-y-6">
              {/* 3-Tier Generator Card */}
              <div className="rounded-[5px] border border-[var(--border)] bg-[var(--card)] p-5 md:p-6 shadow-xs space-y-5">
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 border-b border-[var(--border)] pb-4">
                  <div>
                    <h3 className="font-headline text-base font-bold text-[var(--foreground)]">
                      Partner Discount Coupons
                    </h3>
                    <p className="text-xs text-[var(--muted-foreground)] mt-1 leading-relaxed">
                      Create up to three coupon codes for different customer discounts (<strong>₹200</strong>, <strong>₹300</strong>, or <strong>₹500</strong> off). Customer discount and your Pro conversion reward always total <strong>₹1,000</strong>.
                    </p>
                  </div>
                  <span className="shrink-0 self-start rounded-[4px] border border-[var(--border)] bg-[var(--background)] px-2 py-1 font-mono text-[10px] font-semibold uppercase text-[var(--muted-foreground)]">
                    {Object.values(couponsByTier).filter(Boolean).length} / 3 Active
                  </span>
                </div>

                <div className="space-y-4">
                  {COUPON_DISCOUNT_TIERS.map((tier) => {
                    const activeCode = couponsByTier[tier];
                    const prefixVal = tierPrefixes[tier] || "";
                    const rewardAmt = getCouponRewardAmount(tier);
                    const isSaving = savingTier === tier;
                    const msg = tierMessages[tier];

                    return (
                      <form
                        key={tier}
                        onSubmit={(e) => handleSaveCoupon(tier, e)}
                        className="rounded-[5px] border border-[var(--border)] bg-[var(--background)] p-4 space-y-3"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="rounded-[4px] border border-[var(--border)] bg-[var(--card)] px-2 py-0.5 font-mono text-[11px] font-bold text-[var(--foreground)]">
                              ₹{tier} OFF
                            </span>
                            <span className="text-xs font-medium text-[var(--foreground)]">
                              Customer saves ₹{tier}
                            </span>
                            <span className="text-xs text-[var(--muted-foreground)]">•</span>
                            <span className="font-mono text-xs font-semibold text-[var(--foreground)]">
                              You earn ₹{rewardAmt}
                            </span>
                          </div>

                          {activeCode && (
                            <div className="flex items-center gap-1.5">
                              <span className="rounded-[4px] border border-[var(--border)] bg-[var(--card)] px-2 py-0.5 font-mono text-xs font-bold tracking-wider text-[var(--foreground)]">
                                {activeCode}
                              </span>
                              <button
                                type="button"
                                onClick={() => {
                                  navigator.clipboard.writeText(activeCode);
                                  setCopiedTier(tier);
                                  setTimeout(() => setCopiedTier((cur) => (cur === tier ? null : cur)), 2000);
                                }}
                                className="inline-flex items-center gap-1 rounded-[4px] border border-[var(--border)] bg-[var(--card)] px-2 py-0.5 text-[11px] font-semibold text-[var(--foreground)] hover:bg-[var(--accent)] cursor-pointer"
                              >
                                {copiedTier === tier ? <Check size={11} /> : <Copy size={11} />}
                                <span>{copiedTier === tier ? "Copied" : "Copy"}</span>
                              </button>
                            </div>
                          )}
                        </div>

                        <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                          <div className="flex-1 flex items-center rounded-[5px] border border-[var(--border)] bg-[var(--card)] focus-within:border-[var(--foreground)]">
                            <input
                              type="text"
                              required
                              maxLength={12}
                              value={prefixVal}
                              onChange={(e) => {
                                const cleaned = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "");
                                setTierPrefixes((prev) => ({ ...prev, [tier]: cleaned }));
                              }}
                              placeholder="PREFIX"
                              aria-label={`Prefix for ₹${tier} off coupon`}
                              className="w-full bg-transparent px-3 py-2 text-sm font-mono font-bold uppercase tracking-wider text-[var(--foreground)] placeholder-[var(--muted-foreground)] outline-none"
                            />
                            <span className="border-l border-[var(--border)] bg-[var(--background)] px-3 py-2 font-mono font-bold text-sm text-[var(--muted-foreground)] select-none rounded-r-[4px]">
                              {tier}
                            </span>
                          </div>

                          <button
                            type="submit"
                            disabled={isSaving || !prefixVal.trim()}
                            className="sm:w-32 rounded-[5px] bg-[var(--foreground)] text-[var(--background)] px-4 py-2 text-xs font-semibold hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition inline-flex items-center justify-center gap-1.5"
                          >
                            {isSaving && <Loader2 size={13} className="animate-spin" />}
                            <span>{activeCode ? "Update" : "Generate"}</span>
                          </button>
                        </div>

                        {msg && (
                          <div
                            className={`rounded-[4px] px-3 py-2 text-xs font-medium border ${
                              msg.isError
                                ? "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/25"
                                : "bg-[var(--card)] text-[var(--foreground)] border-[var(--border)]"
                            }`}
                          >
                            {msg.text}
                          </div>
                        )}
                      </form>
                    );
                  })}
                </div>
              </div>

              {/* Direct Profile Link Card (Locked — Non-Editable) */}
              <div className="rounded-[5px] border border-[var(--border)] bg-[var(--card)] p-5 md:p-6 shadow-xs space-y-4">
                <div>
                  <h3 className="font-headline text-sm font-bold text-[var(--foreground)]">
                    Your Namma Info Profile Link
                  </h3>
                  <p className="text-xs text-[var(--muted-foreground)] mt-0.5 leading-relaxed">
                    Locked to your own Namma Info profile. When someone taps your card or opens this profile link and clicks <em>&quot;Create your own Namma Info profile&quot;</em>, they are automatically credited under your referrals.
                  </p>
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                  <div
                    className="flex flex-1 items-center gap-2 rounded-[5px] border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-xs font-mono text-[var(--foreground)] opacity-90 select-all overflow-x-auto"
                    aria-readonly="true"
                  >
                    <Lock size={12} className="shrink-0 text-[var(--muted-foreground)]" />
                    <span className="truncate">{publicReferralLink}</span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(publicReferralLink);
                        setCopiedLink(true);
                        setTimeout(() => setCopiedLink(false), 2000);
                      }}
                      className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 rounded-[5px] bg-[var(--foreground)] text-[var(--background)] px-3.5 py-2 text-xs font-semibold hover:opacity-90 cursor-pointer transition shadow-xs"
                    >
                      {copiedLink ? <Check size={13} /> : <Copy size={13} />}
                      <span>{copiedLink ? "Copied" : "Copy Link"}</span>
                    </button>
                    {partnerSlug && (
                      <a
                        href={publicReferralLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center justify-center rounded-[5px] border border-[var(--border)] bg-[var(--background)] p-2 text-[var(--foreground)] hover:bg-[var(--accent)] transition-colors"
                        title="Open your public profile"
                        aria-label="Open your public profile"
                      >
                        <ExternalLink size={13} />
                      </a>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 3: WITHDRAWALS & PAYOUTS                                              */}
          {/* ========================================================================= */}
          {activeTab === "withdrawals" && (
            <div className="space-y-6">
              {/* Payout Balances Overview */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="rounded-[5px] border border-[var(--border)] bg-[var(--card)] p-5 shadow-xs">
                  <span className="font-mono text-[10px] uppercase tracking-wider text-[var(--muted-foreground)] font-semibold block">
                    Available Withdrawable
                  </span>
                  <div className="mt-2 flex items-baseline gap-2">
                    <span className="font-headline text-3xl font-bold text-emerald-600 dark:text-emerald-400 font-mono">
                      ₹{kpis.withdrawableBalance.toLocaleString("en-IN")}
                    </span>
                  </div>
                  <button
                    type="button"
                    disabled={kpis.withdrawableBalance <= 0}
                    onClick={() => setShowWithdrawModal(true)}
                    className="mt-4 w-full rounded-[4px] bg-[var(--foreground)] text-[var(--background)] py-2 text-xs font-semibold hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition shadow-xs"
                  >
                    Request Payout
                  </button>
                </div>

                <div className="rounded-[5px] border border-[var(--border)] bg-[var(--card)] p-5 shadow-xs">
                  <span className="font-mono text-[10px] uppercase tracking-wider text-[var(--muted-foreground)] font-semibold block">
                    Transferred to Date
                  </span>
                  <div className="mt-2 flex items-baseline gap-2">
                    <span className="font-headline text-3xl font-bold text-[var(--foreground)] font-mono">
                      ₹{kpis.amountTransferred.toLocaleString("en-IN")}
                    </span>
                  </div>
                  <p className="mt-2 text-xs text-[var(--muted-foreground)]">
                    Successfully disbursed by admin
                  </p>
                </div>

                <div className="rounded-[5px] border border-[var(--border)] bg-[var(--card)] p-5 shadow-xs">
                  <span className="font-mono text-[10px] uppercase tracking-wider text-[var(--muted-foreground)] font-semibold block">
                    Pending Disbursal
                  </span>
                  <div className="mt-2 flex items-baseline gap-2">
                    <span className="font-headline text-3xl font-bold text-amber-600 dark:text-amber-400 font-mono">
                      ₹{kpis.pendingWithdrawalTotal.toLocaleString("en-IN")}
                    </span>
                  </div>
                  <p className="mt-2 text-xs text-[var(--muted-foreground)]">
                    Requests currently under review
                  </p>
                </div>
              </div>

              {/* Withdrawals Transaction History */}
              <div className="rounded-[5px] border border-[var(--border)] bg-[var(--card)] overflow-hidden shadow-xs">
                <div className="p-4 border-b border-[var(--border)] flex items-center justify-between">
                  <h3 className="font-headline text-xs font-bold uppercase tracking-wider text-[var(--foreground)]">
                    Payout Requests History
                  </h3>
                  <button
                    onClick={loadWithdrawals}
                    className="text-xs text-[var(--muted-foreground)] hover:text-[var(--foreground)] flex items-center gap-1 cursor-pointer"
                  >
                    <RefreshCw size={12} />
                    <span>Refresh History</span>
                  </button>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-[var(--border)] bg-[var(--accent)]/40 text-[10px] font-mono uppercase tracking-wider text-[var(--muted-foreground)]">
                        <th className="py-3 px-4 font-semibold">Date</th>
                        <th className="py-3 px-4 font-semibold">Amount</th>
                        <th className="py-3 px-4 font-semibold">Payout Method</th>
                        <th className="py-3 px-4 font-semibold">Account Details</th>
                        <th className="py-3 px-4 font-semibold">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--border)]">
                      {withdrawals.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="py-8 text-center text-xs text-[var(--muted-foreground)]">
                            No withdrawal requests yet.
                          </td>
                        </tr>
                      ) : (
                        withdrawals.map((w) => (
                          <tr key={w.id} className="hover:bg-[var(--accent)]/20 transition-colors">
                            <td className="py-3.5 px-4 font-mono text-[11px] text-[var(--muted-foreground)]">
                              {formatDate(w.created_at)}
                            </td>
                            <td className="py-3.5 px-4 font-mono font-bold text-sm text-[var(--foreground)]">
                              ₹{w.amount.toLocaleString("en-IN")}
                            </td>
                            <td className="py-3.5 px-4 capitalize font-medium text-[var(--foreground)]">
                              {w.payout_method === "bank_transfer" ? "Bank Transfer" : "UPI"}
                            </td>
                            <td className="py-3.5 px-4 text-[11px] font-mono text-[var(--muted-foreground)]">
                              {w.payout_method === "bank_transfer" ? (
                                <div>
                                  {w.account_details?.bank_name} • A/C: {w.account_details?.account_number}
                                </div>
                              ) : (
                                <div>UPI: {w.account_details?.upi_id}</div>
                              )}
                            </td>
                            <td className="py-3.5 px-4">
                              <span
                                className={`rounded-[4px] px-2 py-0.5 text-[10px] font-mono font-semibold border ${
                                  w.status === "transferred"
                                    ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                                    : w.status === "rejected"
                                    ? "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20"
                                    : "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20"
                                }`}
                              >
                                {w.status.toUpperCase()}
                              </span>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* ========================================================================= */}
      {/* 3. Customer Details & Card Process Drawer / Modal                          */}
      {/* ========================================================================= */}
      {selectedUser && (
        <Modal
          isOpen={Boolean(selectedUser)}
          onClose={() => setSelectedUser(null)}
          maxWidth="2xl"
        >
          <div className="space-y-5">
            {/* Customer Header */}
            <div className="flex items-start justify-between border-b border-[var(--border)] pb-4">
              <div>
                <h3 className="font-headline text-base font-bold text-[var(--foreground)]">
                  {selectedUser.businessName}
                </h3>
                <p className="text-xs text-[var(--muted-foreground)] mt-0.5">
                  Owner: {selectedUser.ownerName} {selectedUser.phone ? `• ${selectedUser.phone}` : ""}
                </p>
              </div>
              <span
                className={`rounded-[4px] px-2 py-0.5 text-[10px] font-mono font-semibold border ${
                  selectedUser.userPlan === "pro"
                    ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                    : selectedUser.userPlan === "trial"
                    ? "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20"
                    : "bg-zinc-500/10 text-zinc-600 dark:text-zinc-400 border-zinc-500/20"
                }`}
              >
                {selectedUser.userPlan === "trial" ? "Free Trial" : selectedUser.userPlan.toUpperCase()}
              </span>
            </div>

            {/* Navigation Tabs */}
            <div className="flex items-center gap-1 border-b border-[var(--border)] pb-2 text-xs">
              {(["status", "refer_status", "company", "team", "notes"] as const).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setDetailTab(tab)}
                  className={`rounded-[4px] px-3 py-1.5 font-semibold capitalize transition-colors cursor-pointer ${
                    detailTab === tab
                      ? "bg-[var(--foreground)] text-[var(--background)] shadow-xs"
                      : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
                  }`}
                >
                  {tab === "status"
                    ? "Card Flow Process"
                    : tab === "refer_status"
                    ? "Reward Status"
                    : tab === "company"
                    ? "Company Details"
                    : tab === "team"
                    ? `Team (${selectedUser.teamCount})`
                    : "Notes"}
                </button>
              ))}
            </div>

            {/* Sub-tab 1: Card Flow Process Checklist (1:1 with Admin!) */}
            {detailTab === "status" && (
              <div className="space-y-4">
                <div className="rounded-[5px] border border-[var(--border)] bg-[var(--background)] p-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-headline text-xs font-bold uppercase tracking-wider text-[var(--foreground)]">
                        Lifecycle & Physical Card Production Checklist
                      </h4>
                      <p className="text-[11px] text-[var(--muted-foreground)] mt-0.5">
                        Partners manage onboarding greetings, designer hand-off, and follow-ups. Print &amp; courier steps update automatically from Designer / Admin.
                      </p>
                    </div>
                  </div>

                  {/* Checklist */}
                  <div className="space-y-3 pt-2">
                    {LIFECYCLE_MILESTONES.map((step, idx) => {
                      const stepData = selectedUser.cardProcess?.[step.key];
                      const isCompleted = Boolean(stepData?.completed);
                      const isToggling = togglingMilestoneKey === step.key;
                      const canEdit = step.partnerEditable;

                      return (
                        <div
                          key={step.key}
                          className="flex items-start gap-3 p-2 rounded-[5px] hover:bg-[var(--accent)]/30 transition-colors"
                        >
                          <button
                            type="button"
                            disabled={!canEdit || isToggling}
                            onClick={() => canEdit && handleToggleMilestone(step.key, !isCompleted)}
                            className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border transition-all ${
                              canEdit ? "cursor-pointer" : "cursor-not-allowed opacity-70"
                            } ${
                              isCompleted
                                ? "border-[var(--foreground)] bg-[var(--foreground)] text-[var(--background)] shadow-xs"
                                : "border-[var(--border)] bg-[var(--card)] hover:border-[var(--foreground)] text-[var(--muted-foreground)]"
                            }`}
                            title={!canEdit ? "Updated by Designer / Admin" : undefined}
                          >
                            {isToggling ? (
                              <Loader2 size={11} className="animate-spin" />
                            ) : isCompleted ? (
                              <Check size={12} strokeWidth={2.8} />
                            ) : (
                              <span className="font-mono text-[9px] font-semibold">{idx + 1}</span>
                            )}
                          </button>

                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span
                                className={`text-xs font-semibold ${
                                  isCompleted ? "text-[var(--foreground)]" : "text-[var(--muted-foreground)]"
                                }`}
                              >
                                {step.title}
                              </span>
                              {!canEdit && (
                                <span className="rounded-[4px] border border-[var(--border)] bg-[var(--card)] px-1.5 py-0.5 text-[9px] font-mono text-[var(--muted-foreground)]">
                                  Designer / Admin
                                </span>
                              )}
                              {isCompleted && (
                                <span className="rounded-[4px] border border-[var(--border)] bg-[var(--accent)] px-1.5 py-0.5 text-[9px] font-mono text-[var(--foreground)]">
                                  Done
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-[var(--muted-foreground)] mt-0.5">
                              {step.description}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Schedule Follow-up Reminder (Syncs with Admin) */}
                  <div className="pt-3 border-t border-[var(--border)] space-y-2">
                    <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-[var(--muted-foreground)] block">
                      Schedule Follow-Up Reminder (Synced with Admin)
                    </span>
                    <div className="flex flex-col sm:flex-row gap-2">
                      <input
                        type="date"
                        value={partnerFollowupDate}
                        onChange={(e) => setPartnerFollowupDate(e.target.value)}
                        className="rounded-[5px] border border-[var(--border)] bg-[var(--card)] px-2.5 py-1.5 text-xs text-[var(--foreground)] outline-none"
                      />
                      <input
                        type="text"
                        value={partnerFollowupNote}
                        onChange={(e) => setPartnerFollowupNote(e.target.value)}
                        placeholder="e.g. Call tomorrow for card confirmation..."
                        className="flex-1 rounded-[5px] border border-[var(--border)] bg-[var(--card)] px-3 py-1.5 text-xs text-[var(--foreground)] outline-none"
                      />
                      <button
                        type="button"
                        disabled={savingPartnerFollowup || !partnerFollowupNote.trim()}
                        onClick={async () => {
                          if (!selectedUser || !partnerFollowupNote.trim()) return;
                          setSavingPartnerFollowup(true);
                          setPartnerFollowupMsg(null);
                          try {
                            const res = await fetch("/api/staff/followups", {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({
                                profileId: selectedUser.referredUserId,
                                dueAt: new Date(`${partnerFollowupDate}T09:00:00`).toISOString(),
                                followupType: "custom",
                                notes: partnerFollowupNote.trim(),
                              }),
                            });
                            if (!res.ok) {
                              const err = await res.json().catch(() => ({}));
                              throw new Error(err.error || "Failed to schedule");
                            }
                            setPartnerFollowupNote("");
                            setPartnerFollowupMsg("Follow-up scheduled & synced with Admin.");
                          } catch (err: any) {
                            setPartnerFollowupMsg(err.message || "Failed to schedule follow-up");
                          } finally {
                            setSavingPartnerFollowup(false);
                          }
                        }}
                        className="rounded-[5px] bg-[var(--foreground)] text-[var(--background)] px-3 py-1.5 text-xs font-semibold hover:opacity-90 disabled:opacity-40 cursor-pointer"
                      >
                        {savingPartnerFollowup ? "Saving..." : "Schedule"}
                      </button>
                    </div>
                    {partnerFollowupMsg && (
                      <p className="text-[11px] text-[var(--muted-foreground)]">{partnerFollowupMsg}</p>
                    )}
                  </div>
                </div>

                {/* Customer Renewal Amount Preview */}
                {selectedUser.renewalAmount > 0 && (
                  <div className="rounded-[5px] border border-[var(--border)] bg-[var(--accent)]/30 p-3 flex items-center justify-between text-xs">
                    <span className="font-semibold text-[var(--foreground)]">
                      Customer Annual Renewal Fee:
                    </span>
                    <span className="font-mono font-bold text-sm text-[var(--foreground)]">
                      ₹{selectedUser.renewalAmount.toLocaleString("en-IN")}
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Sub-tab 2: Refer Status */}
            {detailTab === "refer_status" && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="rounded-[5px] border border-[var(--border)] bg-[var(--card)] p-4 shadow-xs">
                    <span className="font-mono text-[10px] uppercase text-[var(--muted-foreground)] font-semibold block">
                      Initial Conversion Reward
                    </span>
                    <div className="mt-2">
                      {selectedUser.amountConverted > 0 ? (
                        <div>
                          <span className="font-mono text-xl font-bold text-emerald-600 dark:text-emerald-400">
                            Claimed: ₹{selectedUser.amountConverted}
                          </span>
                          <p className="text-[11px] text-[var(--muted-foreground)] mt-1">
                            Converted on {formatDate(selectedUser.convertedAt)}
                          </p>
                        </div>
                      ) : (
                        <div>
                          <span className="font-mono text-xl font-bold text-amber-600 dark:text-amber-400">
                            Pending: ₹{selectedUser.amountPending}
                          </span>
                          <p className="text-[11px] text-[var(--muted-foreground)] mt-1">
                            Earned when this user upgrades to Pro
                          </p>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="rounded-[5px] border border-[var(--border)] bg-[var(--card)] p-4 shadow-xs">
                    <span className="font-mono text-[10px] uppercase text-[var(--muted-foreground)] font-semibold block">
                      Upcoming Renewal Reward
                    </span>
                    <div className="mt-2">
                      <span className="font-mono text-xl font-bold text-[var(--foreground)]">
                        ₹500
                      </span>
                      <p className="text-[11px] text-[var(--muted-foreground)] mt-1">
                        Expiry Date: {formatDate(selectedUser.membershipExpiresAt)}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Sub-tab 3: Company Details */}
            {detailTab === "company" && (
              <div className="rounded-[5px] border border-[var(--border)] bg-[var(--background)] p-4 space-y-3 text-xs">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <span className="text-[10px] font-mono uppercase text-[var(--muted-foreground)] block">Phone</span>
                    <span className="font-semibold text-[var(--foreground)]">{selectedUser.phone || "—"}</span>
                  </div>
                  <div>
                    <span className="text-[10px] font-mono uppercase text-[var(--muted-foreground)] block">Email</span>
                    <span className="font-semibold text-[var(--foreground)]">{selectedUser.email || "—"}</span>
                  </div>
                  <div>
                    <span className="text-[10px] font-mono uppercase text-[var(--muted-foreground)] block">City & Pincode</span>
                    <span className="font-semibold text-[var(--foreground)]">
                      {selectedUser.city ? `${selectedUser.city}, ${selectedUser.pincode}` : "—"}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] font-mono uppercase text-[var(--muted-foreground)] block">GST Number</span>
                    <span className="font-semibold text-[var(--foreground)]">{selectedUser.gstNumber || "—"}</span>
                  </div>
                  <div className="col-span-2">
                    <span className="text-[10px] font-mono uppercase text-[var(--muted-foreground)] block">Address</span>
                    <span className="font-semibold text-[var(--foreground)]">{selectedUser.address || "—"}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Sub-tab 4: Team Members */}
            {detailTab === "team" && (
              <div className="space-y-3">
                <div className="text-xs font-semibold text-[var(--foreground)]">
                  Total Team Members: {selectedUser.teamCount}
                </div>
                {selectedUser.teamMembers.length === 0 ? (
                  <p className="text-xs text-[var(--muted-foreground)] py-4 text-center">
                    No team members added yet by this company.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {selectedUser.teamMembers.map((tm) => (
                      <div key={tm.id} className="p-3 rounded-[5px] border border-[var(--border)] bg-[var(--background)] flex items-center justify-between text-xs">
                        <div>
                          <div className="font-semibold text-[var(--foreground)]">{tm.name}</div>
                          <div className="text-[11px] text-[var(--muted-foreground)]">{tm.designation || "Member"} • {tm.phone}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Sub-tab 5: Notes */}
            {detailTab === "notes" && (
              <div className="rounded-[5px] border border-[var(--border)] bg-[var(--background)] p-4 text-xs text-[var(--muted-foreground)]">
                Internal referral record created on {formatDate(selectedUser.createdAt)}.
              </div>
            )}
          </div>
        </Modal>
      )}

      {/* ========================================================================= */}
      {/* 4. Request Withdrawal Modal                                               */}
      {/* ========================================================================= */}
      {showWithdrawModal && (
        <Modal
          isOpen={showWithdrawModal}
          onClose={() => setShowWithdrawModal(false)}
          maxWidth="md"
        >
          <div className="space-y-4">
            <div className="border-b border-[var(--border)] pb-3">
              <h3 className="font-headline text-base font-bold text-[var(--foreground)]">
                Request Partner Payout
              </h3>
              <p className="text-xs text-[var(--muted-foreground)] mt-0.5">
                Available: <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">₹{kpis.withdrawableBalance.toLocaleString("en-IN")}</span>
              </p>
            </div>

            <form onSubmit={handleSubmitWithdrawal} className="space-y-4">
              {withdrawError && (
                <div className="rounded-[4px] border border-rose-500/20 bg-rose-500/10 p-3 text-xs text-rose-500">
                  {withdrawError}
                </div>
              )}

              <div>
                <label className="block text-[11px] font-mono uppercase font-semibold text-[var(--muted-foreground)] mb-1">
                  Withdrawal Amount (₹)
                </label>
                <input
                  type="number"
                  required
                  min={1}
                  max={kpis.withdrawableBalance}
                  value={withdrawAmount}
                  onChange={(e) => setWithdrawAmount(e.target.value)}
                  placeholder="Enter amount"
                  className="w-full rounded-[5px] border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm font-mono font-bold text-[var(--foreground)] outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-mono uppercase font-semibold text-[var(--muted-foreground)] mb-1.5">
                  Payout Method
                </label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setPayoutMethod("bank_transfer")}
                    className={`flex-1 rounded-[5px] border py-2 text-xs font-semibold transition-colors cursor-pointer ${
                      payoutMethod === "bank_transfer"
                        ? "border-[var(--foreground)] bg-[var(--foreground)] text-[var(--background)] shadow-xs"
                        : "border-[var(--border)] bg-[var(--background)] text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
                    }`}
                  >
                    Bank Transfer
                  </button>
                  <button
                    type="button"
                    onClick={() => setPayoutMethod("upi")}
                    className={`flex-1 rounded-[5px] border py-2 text-xs font-semibold transition-colors cursor-pointer ${
                      payoutMethod === "upi"
                        ? "border-[var(--foreground)] bg-[var(--foreground)] text-[var(--background)] shadow-xs"
                        : "border-[var(--border)] bg-[var(--background)] text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
                    }`}
                  >
                    UPI Transfer
                  </button>
                </div>
              </div>

              {payoutMethod === "bank_transfer" ? (
                <div className="space-y-3 pt-1">
                  <div>
                    <label className="block text-[10px] font-mono uppercase text-[var(--muted-foreground)] mb-1">
                      Account Number
                    </label>
                    <input
                      type="text"
                      required
                      value={bankDetails.account_number}
                      onChange={(e) => setBankDetails({ ...bankDetails, account_number: e.target.value })}
                      className="w-full rounded-[5px] border border-[var(--border)] bg-[var(--background)] px-3 py-1.5 text-xs font-mono font-semibold text-[var(--foreground)] outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-mono uppercase text-[var(--muted-foreground)] mb-1">
                      Confirm Account Number
                    </label>
                    <input
                      type="text"
                      required
                      value={bankDetails.confirm_account_number}
                      onChange={(e) => setBankDetails({ ...bankDetails, confirm_account_number: e.target.value })}
                      className="w-full rounded-[5px] border border-[var(--border)] bg-[var(--background)] px-3 py-1.5 text-xs font-mono font-semibold text-[var(--foreground)] outline-none"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[10px] font-mono uppercase text-[var(--muted-foreground)] mb-1">
                        IFSC Code
                      </label>
                      <input
                        type="text"
                        required
                        value={bankDetails.ifsc}
                        onChange={(e) => setBankDetails({ ...bankDetails, ifsc: e.target.value.toUpperCase() })}
                        className="w-full rounded-[5px] border border-[var(--border)] bg-[var(--background)] px-3 py-1.5 text-xs font-mono uppercase font-semibold text-[var(--foreground)] outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-mono uppercase text-[var(--muted-foreground)] mb-1">
                        Bank Name
                      </label>
                      <input
                        type="text"
                        required
                        value={bankDetails.bank_name}
                        onChange={(e) => setBankDetails({ ...bankDetails, bank_name: e.target.value })}
                        className="w-full rounded-[5px] border border-[var(--border)] bg-[var(--background)] px-3 py-1.5 text-xs font-semibold text-[var(--foreground)] outline-none"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[10px] font-mono uppercase text-[var(--muted-foreground)] mb-1">
                      Account Holder Name
                    </label>
                    <input
                      type="text"
                      required
                      value={bankDetails.account_holder}
                      onChange={(e) => setBankDetails({ ...bankDetails, account_holder: e.target.value })}
                      className="w-full rounded-[5px] border border-[var(--border)] bg-[var(--background)] px-3 py-1.5 text-xs font-semibold text-[var(--foreground)] outline-none"
                    />
                  </div>
                </div>
              ) : (
                <div className="space-y-3 pt-1">
                  <div>
                    <label className="block text-[10px] font-mono uppercase text-[var(--muted-foreground)] mb-1">
                      UPI ID
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. mobile@okhdfcbank"
                      value={upiDetails.upi_id}
                      onChange={(e) => setUpiDetails({ ...upiDetails, upi_id: e.target.value })}
                      className="w-full rounded-[5px] border border-[var(--border)] bg-[var(--background)] px-3 py-1.5 text-xs font-mono font-semibold text-[var(--foreground)] outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-mono uppercase text-[var(--muted-foreground)] mb-1">
                      Payee Name (Optional)
                    </label>
                    <input
                      type="text"
                      value={upiDetails.account_holder}
                      onChange={(e) => setUpiDetails({ ...upiDetails, account_holder: e.target.value })}
                      className="w-full rounded-[5px] border border-[var(--border)] bg-[var(--background)] px-3 py-1.5 text-xs font-semibold text-[var(--foreground)] outline-none"
                    />
                  </div>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 border-t border-[var(--border)] pt-3">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowWithdrawModal(false)}
                >
                  Cancel
                </Button>
                <button
                  type="submit"
                  disabled={submittingWithdraw}
                  className="rounded-[5px] bg-[var(--foreground)] text-[var(--background)] px-4 py-1.5 text-xs font-semibold hover:opacity-90 disabled:opacity-40 cursor-pointer transition shadow-xs flex items-center gap-1.5"
                >
                  {submittingWithdraw ? <Loader2 size={13} className="animate-spin" /> : null}
                  <span>Submit Request</span>
                </button>
              </div>
            </form>
          </div>
        </Modal>
      )}
      {/* Full-Screen Partner Notifications Modal */}
      {showAllNotificationsModal && (
        <Modal
          isOpen={showAllNotificationsModal}
          onClose={() => setShowAllNotificationsModal(false)}
          title="Partner Alerts"
          description={`Complete notification history (${notifications.length} total • ${unreadCount} unread)`}
          maxWidth="3xl"
        >
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
              <div className="flex flex-wrap items-center gap-1.5">
                {(
                  [
                    { id: "all", label: "All" },
                    { id: "unread", label: `Unread (${unreadCount})` },
                    { id: "followup", label: "Follow-ups" },
                    { id: "renewal", label: "Renewals" },
                    { id: "signup", label: "Signups" },
                  ] as const
                ).map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setPartnerNotifFilter(f.id)}
                    className={`rounded-[5px] px-2.5 py-1 text-xs font-semibold cursor-pointer ${
                      partnerNotifFilter === f.id
                        ? "bg-[var(--foreground)] text-[var(--background)]"
                        : "border border-[var(--border)] bg-[var(--background)] text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-2">
                <div className="relative flex-1 sm:w-56">
                  <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)]" />
                  <input
                    type="text"
                    value={partnerNotifSearch}
                    onChange={(e) => setPartnerNotifSearch(e.target.value)}
                    placeholder="Search alerts..."
                    className="w-full rounded-[5px] border border-[var(--border)] bg-[var(--background)] pl-8 pr-2.5 py-1 text-xs text-[var(--foreground)] outline-none focus:border-[var(--foreground)]"
                  />
                </div>
                {unreadCount > 0 && (
                  <button
                    type="button"
                    onClick={markAllAsRead}
                    className="shrink-0 rounded-[5px] border border-[var(--border)] bg-[var(--background)] hover:bg-[var(--accent)] px-2.5 py-1 text-xs font-semibold text-[var(--foreground)] cursor-pointer"
                  >
                    Mark all read
                  </button>
                )}
              </div>
            </div>

            <div className="max-h-[60vh] overflow-y-auto divide-y divide-[var(--border)] rounded-[5px] border border-[var(--border)] bg-[var(--background)]">
              {(() => {
                const filtered = notifications.filter((n) => {
                  const isRead = readNotificationIds.has(n.id);
                  if (partnerNotifFilter === "unread" && isRead) return false;
                  if (
                    partnerNotifFilter !== "all" &&
                    partnerNotifFilter !== "unread" &&
                    n.type !== partnerNotifFilter
                  ) {
                    return false;
                  }
                  if (partnerNotifSearch.trim()) {
                    const q = partnerNotifSearch.toLowerCase();
                    return (
                      n.title.toLowerCase().includes(q) ||
                      n.message.toLowerCase().includes(q)
                    );
                  }
                  return true;
                });

                if (filtered.length === 0) {
                  return (
                    <div className="py-12 text-center text-xs text-[var(--muted-foreground)]">
                      No notifications match the selected filter.
                    </div>
                  );
                }

                return filtered.map((n) => {
                  const isRead = readNotificationIds.has(n.id);
                  return (
                    <div
                      key={n.id}
                      onClick={() => {
                        markOneAsRead(n.id);
                        setShowAllNotificationsModal(false);
                        if (n.targetUser) {
                          setSelectedUser(n.targetUser);
                          setDetailTab("status");
                        }
                      }}
                      className={`p-3.5 hover:bg-[var(--accent)]/40 flex items-start gap-3 cursor-pointer ${
                        !isRead ? "bg-[var(--accent)]/20" : ""
                      }`}
                    >
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[5px] border border-[var(--border)] bg-[var(--card)] mt-0.5 text-[var(--foreground)]">
                        {n.type === "signup" && <Users size={13} />}
                        {n.type === "followup" && <Clock size={13} className="text-amber-500" />}
                        {n.type === "renewal" && <Calendar size={13} />}
                        {n.type === "reward" && <CheckCircle2 size={13} className="text-emerald-500" />}
                        {n.type === "payout" && <Banknote size={13} className="text-emerald-500" />}
                      </div>
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className={`text-xs ${!isRead ? "font-bold" : "font-semibold"} text-[var(--foreground)]`}>
                            {n.title}
                          </span>
                          <span className="font-mono text-[10px] text-[var(--muted-foreground)] shrink-0">
                            {n.date ? formatDate(n.date) : ""}
                          </span>
                        </div>
                        <p className="text-xs text-[var(--muted-foreground)] leading-relaxed">
                          {n.message}
                        </p>
                      </div>
                    </div>
                  );
                });
              })()}
            </div>
          </div>
        </Modal>
      )}

      {/* Mobile Bottom Navigation Bar (< md, matching main app shell UI) */}
      <nav className="md:hidden fixed inset-x-0 bottom-0 z-40 border-t border-[var(--border)] bg-[var(--background)]/95 backdrop-blur-xl pb-safe">
        <div className="mx-auto flex max-w-lg items-center justify-around px-2 py-1.5">
          <button
            type="button"
            onClick={() => handleTabChange("referrals")}
            className={`flex flex-1 flex-col items-center gap-0.5 rounded-[5px] py-1 font-mono text-[10px] font-medium cursor-pointer ${
              activeTab === "referrals"
                ? "text-[var(--foreground)] font-semibold"
                : "text-[var(--muted-foreground)]"
            }`}
          >
            <Users size={18} strokeWidth={activeTab === "referrals" ? 2.2 : 1.7} />
            <span>Referrals ({referrals.length})</span>
          </button>

          <button
            type="button"
            onClick={() => handleTabChange("coupon")}
            className={`flex flex-1 flex-col items-center gap-0.5 rounded-[5px] py-1 font-mono text-[10px] font-medium cursor-pointer ${
              activeTab === "coupon"
                ? "text-[var(--foreground)] font-semibold"
                : "text-[var(--muted-foreground)]"
            }`}
          >
            <Tag size={18} strokeWidth={activeTab === "coupon" ? 2.2 : 1.7} />
            <span>Code &amp; Link</span>
          </button>

          <button
            type="button"
            onClick={() => handleTabChange("withdrawals")}
            className={`flex flex-1 flex-col items-center gap-0.5 rounded-[5px] py-1 font-mono text-[10px] font-medium cursor-pointer ${
              activeTab === "withdrawals"
                ? "text-[var(--foreground)] font-semibold"
                : "text-[var(--muted-foreground)]"
            }`}
          >
            <Wallet size={18} strokeWidth={activeTab === "withdrawals" ? 2.2 : 1.7} />
            <span>Payouts</span>
          </button>
        </div>
      </nav>
    </div>
  );
}
