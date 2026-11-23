"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  Handshake,
  Users,
  Clock,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  ArrowLeft,
  Loader2,
  RefreshCw,
  Search,
  Phone,
  Mail,
  Building2,
  CreditCard,
  Banknote,
  Send,
  History,
  Check,
  X,
  ExternalLink,
} from "lucide-react";
import { Button } from "@/admin/shared/ui/Button";
import { Badge } from "@/admin/shared/ui/Badge";
import { Modal } from "@/admin/shared/ui/Modal";
import { formatDate } from "@/admin/shared/lib/formatters";

interface CampaignManagerSummary {
  id: string;
  name: string;
  businessName: string;
  email: string;
  phone: string;
  couponCode: string | null;
  referralCount: number;
  amountPending: number;
  amountConverted: number;
  amountTransferred: number;
  createdAt: string;
  pendingWithdrawal: any | null;
}

interface CampaignKpis {
  campaignOwnersCount: number;
  totalReferrals: number;
  totalAmountPending: number;
  totalAmountConverted: number;
  totalAmountTransferred: number;
}

interface ReferralUser {
  id: string;
  referredUserId: string;
  userName: string;
  businessName: string;
  email: string;
  phone: string;
  status: "free" | "trial" | "pro" | "expired";
  referralStatus: string;
  amountPending: number;
  amountConverted: number;
  amountTransferred: number;
  membershipExpiresAt: string | null;
  createdAt: string;
  convertedAt: string | null;
  renewalCount: number;
}

export const AdminCampaignsView: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [managers, setManagers] = useState<CampaignManagerSummary[]>([]);
  const [kpis, setKpis] = useState<CampaignKpis>({
    campaignOwnersCount: 0,
    totalReferrals: 0,
    totalAmountPending: 0,
    totalAmountConverted: 0,
    totalAmountTransferred: 0,
  });
  const [overallTransactions, setOverallTransactions] = useState<any[]>([]);

  // Search filter
  const [search, setSearch] = useState("");

  // Selected Campaign Manager Detail View
  const [selectedManagerId, setSelectedManagerId] = useState<string | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [managerDetail, setManagerDetail] = useState<{
    manager: any;
    stats: any;
    pendingWithdrawal: any | null;
    referrals: ReferralUser[];
    withdrawals: any[];
  } | null>(null);

  // Overall Transaction History Modal
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);

  // Transfer action state
  const [transferringId, setTransferringId] = useState<string | null>(null);
  const [transferSuccess, setTransferSuccess] = useState<string | null>(null);
  const [transferError, setTransferError] = useState<string | null>(null);

  const fetchCampaigns = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/campaigns");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load campaigns");
      setManagers(data.managers || []);
      setKpis(
        data.kpis || {
          campaignOwnersCount: 0,
          totalReferrals: 0,
          totalAmountPending: 0,
          totalAmountConverted: 0,
          totalAmountTransferred: 0,
        }
      );
      setOverallTransactions(data.overallTransactions || []);
    } catch (err: any) {
      setError(err.message || "Failed to load campaigns");
    } finally {
      setLoading(false);
    }
  };

  const fetchManagerDetail = async (id: string) => {
    setDetailLoading(true);
    setTransferError(null);
    setTransferSuccess(null);
    try {
      const res = await fetch(`/api/admin/campaigns/${id}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load manager details");
      setManagerDetail(data);
    } catch (err: any) {
      alert(`Error loading details: ${err.message}`);
    } finally {
      setDetailLoading(false);
    }
  };

  useEffect(() => {
    fetchCampaigns();
  }, []);

  const handleSelectManager = (id: string) => {
    setSelectedManagerId(id);
    fetchManagerDetail(id);
  };

  const handleBackToList = () => {
    setSelectedManagerId(null);
    setManagerDetail(null);
    fetchCampaigns();
  };

  const handleProcessTransfer = async (withdrawalId: string) => {
    if (!withdrawalId) return;
    setTransferringId(withdrawalId);
    setTransferError(null);
    setTransferSuccess(null);

    try {
      const res = await fetch(`/api/admin/campaigns/withdrawals/${withdrawalId}/transfer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to transfer payout");

      setTransferSuccess(data.message || "Payout transferred successfully!");
      if (selectedManagerId) {
        fetchManagerDetail(selectedManagerId);
      }
      fetchCampaigns();
    } catch (err: any) {
      setTransferError(err.message || "Failed to transfer payout");
    } finally {
      setTransferringId(null);
    }
  };

  const filteredManagers = useMemo(() => {
    if (!search.trim()) return managers;
    const q = search.toLowerCase();
    return managers.filter(
      (m) =>
        m.name.toLowerCase().includes(q) ||
        m.businessName.toLowerCase().includes(q) ||
        m.email.toLowerCase().includes(q) ||
        m.phone.includes(q) ||
        (m.couponCode && m.couponCode.toLowerCase().includes(q))
    );
  }, [managers, search]);

  // If a campaign manager is selected, render drill-down view
  if (selectedManagerId) {
    return (
      <div className="flex-1 space-y-6 p-6 w-full pb-16 overflow-y-auto">
        {/* Breadcrumb / Top Bar */}
        <div className="flex items-center justify-between gap-4 border-b border-[var(--border)] pb-4">
          <button
            onClick={handleBackToList}
            className="flex items-center gap-1.5 text-xs font-semibold text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors cursor-pointer"
          >
            <ArrowLeft size={14} />
            <span>Back to Partners</span>
          </button>

          <Button
            variant="secondary"
            size="sm"
            onClick={() => fetchManagerDetail(selectedManagerId)}
            disabled={detailLoading}
          >
            <RefreshCw size={13} className={detailLoading ? "animate-spin mr-1.5" : "mr-1.5"} />
            Refresh
          </Button>
        </div>

        {detailLoading && !managerDetail ? (
          <div className="py-20 text-center text-xs text-[var(--muted-foreground)]">
            <Loader2 size={20} className="animate-spin inline-block mr-2" />
            Loading partner details...
          </div>
        ) : managerDetail ? (
          <div className="space-y-6">
            {/* Top Cards: Left = Manager Details, Right = Pending Payout Transfer Box */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
              {/* Left Side: Partner Info */}
              <div className="lg:col-span-2 rounded-[5px] border border-[var(--border)] bg-[var(--card)] p-5 shadow-card space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[5px] bg-[var(--accent)] font-bold text-base border border-[var(--border)] text-[var(--foreground)]">
                      {managerDetail.manager.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <h3 className="font-headline text-lg font-bold text-[var(--foreground)]">
                        {managerDetail.manager.name}
                      </h3>
                      <p className="text-xs text-[var(--muted-foreground)] flex items-center gap-2">
                        <span>{managerDetail.manager.businessName || "Registered Business"}</span>
                        {managerDetail.manager.couponCode && (
                          <span className="font-mono text-[11px] font-bold px-2 py-0.5 rounded-[4px] bg-[var(--accent)] text-[var(--foreground)] border border-[var(--border)]">
                            Code: {managerDetail.manager.couponCode}
                          </span>
                        )}
                      </p>
                    </div>
                  </div>

                  <span className="font-mono text-[10px] font-semibold uppercase tracking-wider px-2 py-1 rounded-[4px] border border-[var(--border)] bg-[var(--accent)]/40 text-[var(--foreground)]">
                    Partner
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs pt-1 border-t border-[var(--border)]">
                  <div className="flex items-center gap-2 text-[var(--muted-foreground)]">
                    <Phone size={13} className="shrink-0" />
                    <span>{managerDetail.manager.phone || "No phone listed"}</span>
                  </div>
                  <div className="flex items-center gap-2 text-[var(--muted-foreground)]">
                    <Mail size={13} className="shrink-0" />
                    <span className="font-mono truncate">{managerDetail.manager.email}</span>
                  </div>
                </div>

                {/* Balance Metrics Bar */}
                <div className="grid grid-cols-3 gap-2.5 pt-3 border-t border-[var(--border)] text-center">
                  <div className="rounded-[5px] border border-[var(--border)] bg-[var(--background)] p-2.5">
                    <span className="font-mono text-[10px] uppercase tracking-wider text-[var(--muted-foreground)] block">
                      Amount Pending
                    </span>
                    <span className="font-mono text-base font-bold text-[var(--foreground)] block mt-0.5">
                      ₹{managerDetail.stats.amountPending.toLocaleString("en-IN")}
                    </span>
                    <span className="text-[10px] text-[var(--muted-foreground)]">Free / Trial referees</span>
                  </div>

                  <div className="rounded-[5px] border border-[var(--border)] bg-[var(--background)] p-2.5">
                    <span className="font-mono text-[10px] uppercase tracking-wider text-[var(--muted-foreground)] block">
                      Amount Converted
                    </span>
                    <span className="font-mono text-base font-bold text-emerald-600 dark:text-emerald-400 block mt-0.5">
                      ₹{managerDetail.stats.amountConverted.toLocaleString("en-IN")}
                    </span>
                    <span className="text-[10px] text-[var(--muted-foreground)]">Ready for transfer</span>
                  </div>

                  <div className="rounded-[5px] border border-[var(--border)] bg-[var(--background)] p-2.5">
                    <span className="font-mono text-[10px] uppercase tracking-wider text-[var(--muted-foreground)] block">
                      Amount Transferred
                    </span>
                    <span className="font-mono text-base font-bold text-[var(--foreground)] block mt-0.5">
                      ₹{managerDetail.stats.amountTransferred.toLocaleString("en-IN")}
                    </span>
                    <span className="text-[10px] text-[var(--muted-foreground)]">Paid out to partner</span>
                  </div>
                </div>
              </div>

              {/* Right Side: Pending Withdrawal Payout Box */}
              <div className="rounded-[5px] border border-[var(--border)] bg-[var(--card)] p-5 shadow-card flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between pb-3 border-b border-[var(--border)]">
                    <div className="flex items-center gap-1.5 font-mono text-[11px] font-semibold uppercase tracking-wider text-[var(--foreground)]">
                      <Banknote size={15} />
                      <span>Pending Withdrawal</span>
                    </div>
                    {managerDetail.pendingWithdrawal && (
                      <span className="font-mono text-[10px] font-bold px-2 py-0.5 rounded-[4px] bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30">
                        Action Required
                      </span>
                    )}
                  </div>

                  {transferSuccess && (
                    <div className="mt-3 flex items-center gap-2 p-2.5 rounded-[5px] border border-emerald-500/20 bg-emerald-500/10 text-xs text-emerald-600 dark:text-emerald-400">
                      <CheckCircle2 size={14} className="shrink-0" />
                      <span>{transferSuccess}</span>
                    </div>
                  )}

                  {transferError && (
                    <div className="mt-3 flex items-center gap-2 p-2.5 rounded-[5px] border border-rose-500/20 bg-rose-500/10 text-xs text-rose-600 dark:text-rose-400">
                      <AlertCircle size={14} className="shrink-0" />
                      <span>{transferError}</span>
                    </div>
                  )}

                  {managerDetail.pendingWithdrawal ? (
                    <div className="space-y-3 pt-3 text-xs">
                      <div className="flex items-baseline justify-between">
                        <span className="text-[var(--muted-foreground)]">Requested Amount:</span>
                        <span className="font-mono text-xl font-extrabold text-[var(--foreground)]">
                          ₹{Number(managerDetail.pendingWithdrawal.amount).toLocaleString("en-IN")}
                        </span>
                      </div>

                      <div className="rounded-[5px] border border-[var(--border)] bg-[var(--background)] p-3 space-y-1.5 text-[11px]">
                        <div className="flex items-center justify-between font-mono font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
                          <span>Payout Method</span>
                          <span>
                            {managerDetail.pendingWithdrawal.payout_method === "bank_transfer"
                              ? "Bank Transfer"
                              : "UPI"}
                          </span>
                        </div>

                        {managerDetail.pendingWithdrawal.payout_method === "bank_transfer" ? (
                          <div className="space-y-1 pt-1 font-mono text-[11px]">
                            <p className="text-[var(--foreground)]">
                              <span className="text-[var(--muted-foreground)]">Holder: </span>
                              {managerDetail.pendingWithdrawal.account_details?.account_holder ||
                                managerDetail.manager.name}
                            </p>
                            <p className="text-[var(--foreground)]">
                              <span className="text-[var(--muted-foreground)]">Bank: </span>
                              {managerDetail.pendingWithdrawal.account_details?.bank_name || "Bank"}
                            </p>
                            <p className="text-[var(--foreground)]">
                              <span className="text-[var(--muted-foreground)]">Acc No: </span>
                              <span className="font-bold">
                                {managerDetail.pendingWithdrawal.account_details?.account_number}
                              </span>
                            </p>
                            <p className="text-[var(--foreground)]">
                              <span className="text-[var(--muted-foreground)]">IFSC: </span>
                              <span className="font-bold">
                                {managerDetail.pendingWithdrawal.account_details?.ifsc}
                              </span>
                            </p>
                          </div>
                        ) : (
                          <div className="space-y-1 pt-1 font-mono text-[11px]">
                            <p className="text-[var(--foreground)]">
                              <span className="text-[var(--muted-foreground)]">UPI ID: </span>
                              <span className="font-bold">
                                {managerDetail.pendingWithdrawal.account_details?.upi_id}
                              </span>
                            </p>
                            {managerDetail.pendingWithdrawal.account_details?.holder_name && (
                              <p className="text-[var(--foreground)]">
                                <span className="text-[var(--muted-foreground)]">Name: </span>
                                {managerDetail.pendingWithdrawal.account_details?.holder_name}
                              </p>
                            )}
                          </div>
                        )}

                        <p className="text-[10px] text-[var(--muted-foreground)] pt-1">
                          Requested on {formatDate(managerDetail.pendingWithdrawal.created_at)}
                        </p>
                      </div>

                      <Button
                        variant="primary"
                        size="sm"
                        className="w-full mt-2"
                        onClick={() => handleProcessTransfer(managerDetail.pendingWithdrawal.id)}
                        isLoading={transferringId === managerDetail.pendingWithdrawal.id}
                      >
                        <Send size={13} className="mr-1.5" />
                        Transfer Payout
                      </Button>
                    </div>
                  ) : (
                    <div className="py-8 text-center text-xs text-[var(--muted-foreground)] space-y-2">
                      <CheckCircle2 size={24} className="mx-auto text-emerald-500 opacity-60" />
                      <p>No pending withdrawal requests from this campaign master.</p>
                    </div>
                  )}
                </div>

                <div className="pt-3 border-t border-[var(--border)] mt-4">
                  <span className="text-[11px] text-[var(--muted-foreground)]">
                    Total Referrals: <strong className="text-[var(--foreground)]">{managerDetail.referrals.length}</strong>
                  </span>
                </div>
              </div>
            </div>

            {/* Referrals Table for this Campaign Manager */}
            <div className="overflow-hidden rounded-[5px] border border-[var(--border)] bg-[var(--card)] shadow-card space-y-3 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-headline text-sm font-bold text-[var(--foreground)]">
                    Referral Customers ({managerDetail.referrals.length})
                  </h4>
                  <p className="text-xs text-[var(--muted-foreground)]">
                    Customers linked through {managerDetail.manager.name}&apos;s referral code or card profile link.
                  </p>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-[var(--border)] bg-[var(--accent)]/50 font-mono text-[11px] uppercase tracking-wider text-[var(--muted-foreground)]">
                    <tr>
                      <th scope="col" className="px-4 py-2.5">Customer & Company</th>
                      <th scope="col" className="px-4 py-2.5">Subscription Status</th>
                      <th scope="col" className="px-4 py-2.5 text-right">Amount Pending</th>
                      <th scope="col" className="px-4 py-2.5 text-right">Amount Converted</th>
                      <th scope="col" className="px-4 py-2.5 text-right">Amount Transferred</th>
                      <th scope="col" className="px-4 py-2.5 text-right">Joined Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border)]">
                    {managerDetail.referrals.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-10 text-center text-xs text-[var(--muted-foreground)]">
                          No referrals recorded yet for this partner.
                        </td>
                      </tr>
                    ) : (
                      managerDetail.referrals.map((r) => (
                        <tr key={r.id} className="transition-colors hover:bg-neutral-100 dark:hover:bg-neutral-800/40">
                          <td className="px-4 py-3">
                            <span className="font-semibold text-[var(--foreground)] block">
                              {r.businessName}
                            </span>
                            <span className="text-[11px] text-[var(--muted-foreground)] block">
                              {r.userName} {r.phone ? `• ${r.phone}` : ""}
                            </span>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <Badge variant={r.status}>
                              {r.status === "pro"
                                ? "Pro Active"
                                : r.status === "trial"
                                ? "Free Trial"
                                : r.status === "expired"
                                ? "Expired"
                                : "Free Plan"}
                            </Badge>
                          </td>
                          <td className="px-4 py-3 text-right font-mono font-medium whitespace-nowrap">
                            {r.amountPending > 0 ? `₹${r.amountPending.toLocaleString("en-IN")}` : "₹0"}
                          </td>
                          <td className="px-4 py-3 text-right font-mono font-semibold text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
                            ₹{r.amountConverted.toLocaleString("en-IN")}
                          </td>
                          <td className="px-4 py-3 text-right font-mono font-medium whitespace-nowrap text-[var(--muted-foreground)]">
                            ₹{r.amountTransferred.toLocaleString("en-IN")}
                          </td>
                          <td className="px-4 py-3 text-right font-mono text-[11px] text-[var(--muted-foreground)] whitespace-nowrap">
                            {formatDate(r.createdAt)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Individual Transaction Payout History */}
            {managerDetail.withdrawals.length > 0 && (
              <div className="overflow-hidden rounded-[5px] border border-[var(--border)] bg-[var(--card)] shadow-card p-4 space-y-3">
                <h4 className="font-headline text-sm font-bold text-[var(--foreground)]">
                  Payout Transaction History
                </h4>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="border-b border-[var(--border)] bg-[var(--accent)]/50 font-mono text-[11px] uppercase tracking-wider text-[var(--muted-foreground)]">
                      <tr>
                        <th scope="col" className="px-4 py-2.5">Date</th>
                        <th scope="col" className="px-4 py-2.5">Amount</th>
                        <th scope="col" className="px-4 py-2.5">Method & Destination</th>
                        <th scope="col" className="px-4 py-2.5">Status</th>
                        <th scope="col" className="px-4 py-2.5 text-right">Transferred At</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--border)]">
                      {managerDetail.withdrawals.map((w) => (
                        <tr key={w.id}>
                          <td className="px-4 py-2.5 font-mono text-[11px]">
                            {formatDate(w.created_at)}
                          </td>
                          <td className="px-4 py-2.5 font-mono font-bold text-[var(--foreground)]">
                            ₹{Number(w.amount).toLocaleString("en-IN")}
                          </td>
                          <td className="px-4 py-2.5 font-mono text-[11px]">
                            {w.payout_method === "bank_transfer" ? (
                              <span>
                                {w.account_details?.bank_name || "Bank"} • Acc: {w.account_details?.account_number} (IFSC: {w.account_details?.ifsc})
                              </span>
                            ) : (
                              <span>UPI: {w.account_details?.upi_id}</span>
                            )}
                          </td>
                          <td className="px-4 py-2.5">
                            <span
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-[4px] font-mono text-[10px] font-semibold uppercase tracking-wider border ${
                                w.status === "transferred"
                                  ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                                  : "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20"
                              }`}
                            >
                              {w.status}
                            </span>
                          </td>
                          <td className="px-4 py-2.5 text-right font-mono text-[11px] text-[var(--muted-foreground)]">
                            {w.transferred_at ? formatDate(w.transferred_at) : "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        ) : null}
      </div>
    );
  }

  // Master List View
  return (
    <div className="flex-1 space-y-6 p-6 w-full pb-16 overflow-y-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-[var(--border)] pb-5">
        <div>
          <h2 className="font-headline text-xl font-bold tracking-tight text-[var(--foreground)]">
            Partner Program & Referral Management
          </h2>
          <p className="text-xs text-[var(--muted-foreground)] mt-1">
            Monitor partners, track referral earnings, and process payout transfers.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={() => setIsHistoryModalOpen(true)}>
            <History size={13} className="mr-1.5" />
            Payout History
          </Button>
          <Button variant="secondary" size="sm" onClick={fetchCampaigns} disabled={loading}>
            <RefreshCw size={13} className={loading ? "animate-spin mr-1.5" : "mr-1.5"} />
            Refresh
          </Button>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 rounded-[5px] border border-rose-500/20 bg-rose-500/10 text-xs text-rose-600 dark:text-rose-400">
          <AlertCircle size={15} />
          <span>{error}</span>
        </div>
      )}

      {/* Top 4 KPI Metrics Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Partners */}
        <div className="rounded-[5px] border border-[var(--border)] bg-[var(--card)] p-4 shadow-card">
          <div className="flex items-center justify-between text-[var(--muted-foreground)]">
            <span className="font-mono text-[10px] uppercase tracking-wider font-semibold">
              Partners
            </span>
            <Handshake size={16} />
          </div>
          <span className="font-headline text-2xl font-extrabold text-[var(--foreground)] block mt-2">
            {kpis.campaignOwnersCount}
          </span>
          <span className="text-[11px] text-[var(--muted-foreground)] mt-0.5 block">
            Registered partners
          </span>
        </div>

        {/* Total Referrals */}
        <div className="rounded-[5px] border border-[var(--border)] bg-[var(--card)] p-4 shadow-card">
          <div className="flex items-center justify-between text-[var(--muted-foreground)]">
            <span className="font-mono text-[10px] uppercase tracking-wider font-semibold">
              Total Referrals
            </span>
            <Users size={16} />
          </div>
          <span className="font-headline text-2xl font-extrabold text-[var(--foreground)] block mt-2">
            {kpis.totalReferrals}
          </span>
          <span className="text-[11px] text-[var(--muted-foreground)] mt-0.5 block">
            Overall customers referred
          </span>
        </div>

        {/* Amount Pending */}
        <div className="rounded-[5px] border border-[var(--border)] bg-[var(--card)] p-4 shadow-card">
          <div className="flex items-center justify-between text-[var(--muted-foreground)]">
            <span className="font-mono text-[10px] uppercase tracking-wider font-semibold">
              Amount Pending
            </span>
            <Clock size={16} />
          </div>
          <span className="font-headline text-2xl font-extrabold text-[var(--foreground)] block mt-2">
            ₹{kpis.totalAmountPending.toLocaleString("en-IN")}
          </span>
          <span className="text-[11px] text-[var(--muted-foreground)] mt-0.5 block">
            Awaiting Pro conversions
          </span>
        </div>

        {/* Amount Converted */}
        <div className="rounded-[5px] border border-[var(--border)] bg-[var(--card)] p-4 shadow-card">
          <div className="flex items-center justify-between text-[var(--muted-foreground)]">
            <span className="font-mono text-[10px] uppercase tracking-wider font-semibold">
              Amount Converted
            </span>
            <CheckCircle2 size={16} className="text-emerald-500" />
          </div>
          <span className="font-headline text-2xl font-extrabold text-emerald-600 dark:text-emerald-400 block mt-2">
            ₹{kpis.totalAmountConverted.toLocaleString("en-IN")}
          </span>
          <span className="text-[11px] text-[var(--muted-foreground)] mt-0.5 block">
            Withdrawable / pending payout
          </span>
        </div>
      </div>

      {/* Search and Table */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="relative max-w-sm flex-1">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)]" />
            <input
              type="text"
              placeholder="Search by name, contact, coupon code..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-[5px] border border-[var(--border)] bg-[var(--card)] pl-9 pr-3 py-2 text-xs text-[var(--foreground)] outline-none focus:border-[var(--foreground)]"
            />
          </div>
          <span className="text-xs text-[var(--muted-foreground)]">
            Showing <strong className="text-[var(--foreground)]">{filteredManagers.length}</strong> partners
          </span>
        </div>

        <div className="overflow-hidden rounded-[5px] border border-[var(--border)] bg-[var(--card)] shadow-card">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-[var(--border)] bg-[var(--accent)]/50 font-mono text-[11px] uppercase tracking-wider text-[var(--muted-foreground)]">
                <tr>
                  <th scope="col" className="px-5 py-3">Partner</th>
                  <th scope="col" className="px-4 py-3">Contact Number</th>
                  <th scope="col" className="px-4 py-3 text-center">Coupon Code</th>
                  <th scope="col" className="px-4 py-3 text-center">Referral Count</th>
                  <th scope="col" className="px-4 py-3 text-right">Amount Pending</th>
                  <th scope="col" className="px-4 py-3 text-right">Amount Converted</th>
                  <th scope="col" className="px-4 py-3 text-right">Amount Transferred</th>
                  <th scope="col" className="px-4 py-3 text-center">Status / Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {loading ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-xs text-[var(--muted-foreground)]">
                      <Loader2 size={18} className="animate-spin inline-block mr-2" />
                      Loading partners...
                    </td>
                  </tr>
                ) : filteredManagers.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-xs text-[var(--muted-foreground)]">
                      No partners found. You can assign existing user accounts as Partners in{" "}
                      <strong>Account Creation & Staff Roles</strong>.
                    </td>
                  </tr>
                ) : (
                  filteredManagers.map((m) => (
                    <tr
                      key={m.id}
                      onClick={() => handleSelectManager(m.id)}
                      className="transition-colors hover:bg-neutral-100 dark:hover:bg-neutral-800/50 cursor-pointer"
                    >
                      {/* Name & Business */}
                      <td className="px-5 py-3.5">
                        <span className="font-semibold text-xs text-[var(--foreground)] block">
                          {m.name}
                        </span>
                        <span className="text-[11px] text-[var(--muted-foreground)] block">
                          {m.businessName}
                        </span>
                      </td>

                      {/* Contact */}
                      <td className="px-4 py-3.5 font-mono text-[11px] text-[var(--foreground)]">
                        {m.phone || "—"}
                      </td>

                      {/* Coupon Code */}
                      <td className="px-4 py-3.5 text-center font-mono">
                        {m.couponCode ? (
                          <span className="px-2 py-0.5 rounded-[4px] bg-[var(--accent)] text-[var(--foreground)] font-bold text-[11px] border border-[var(--border)]">
                            {m.couponCode}
                          </span>
                        ) : (
                          <span className="text-[var(--muted-foreground)] text-[11px]">Not set</span>
                        )}
                      </td>

                      {/* Referral Count */}
                      <td className="px-4 py-3.5 text-center font-mono font-bold text-xs text-[var(--foreground)]">
                        {m.referralCount}
                      </td>

                      {/* Amount Pending */}
                      <td className="px-4 py-3.5 text-right font-mono text-xs text-[var(--muted-foreground)]">
                        ₹{m.amountPending.toLocaleString("en-IN")}
                      </td>

                      {/* Amount Converted */}
                      <td className="px-4 py-3.5 text-right font-mono font-bold text-xs text-emerald-600 dark:text-emerald-400">
                        ₹{m.amountConverted.toLocaleString("en-IN")}
                      </td>

                      {/* Amount Transferred */}
                      <td className="px-4 py-3.5 text-right font-mono text-xs text-[var(--foreground)]">
                        ₹{m.amountTransferred.toLocaleString("en-IN")}
                      </td>

                      {/* Status / Action */}
                      <td className="px-4 py-3.5 text-center">
                        {m.pendingWithdrawal ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-[4px] font-mono text-[10px] font-bold bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30">
                            Transfer Pending
                          </span>
                        ) : (
                          <span className="text-[11px] font-medium text-[var(--muted-foreground)] hover:text-[var(--foreground)] inline-flex items-center gap-1">
                            <span>View</span>
                            <ArrowRight size={12} />
                          </span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Overall Transaction History Modal */}
      {isHistoryModalOpen && (
        <Modal
          isOpen={isHistoryModalOpen}
          onClose={() => setIsHistoryModalOpen(false)}
          title="Overall Payout & Transfer History"
          maxWidth="2xl"
        >
          <div className="space-y-4 pt-1 max-h-[70vh] overflow-y-auto">
            <p className="text-xs text-[var(--muted-foreground)]">
              Complete log of all payout withdrawal requests and bank transfers across all partners.
            </p>

            <div className="overflow-hidden rounded-[5px] border border-[var(--border)]">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-[var(--border)] bg-[var(--accent)]/50 font-mono text-[11px] uppercase tracking-wider text-[var(--muted-foreground)]">
                  <tr>
                    <th scope="col" className="px-3.5 py-2.5">Date</th>
                    <th scope="col" className="px-3.5 py-2.5">Partner</th>
                    <th scope="col" className="px-3.5 py-2.5">Amount</th>
                    <th scope="col" className="px-3.5 py-2.5">Method</th>
                    <th scope="col" className="px-3.5 py-2.5">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]">
                  {overallTransactions.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-xs text-[var(--muted-foreground)]">
                        No transactions recorded yet.
                      </td>
                    </tr>
                  ) : (
                    overallTransactions.map((tx) => (
                      <tr key={tx.id}>
                        <td className="px-3.5 py-2.5 font-mono text-[11px]">
                          {formatDate(tx.created_at)}
                        </td>
                        <td className="px-3.5 py-2.5 font-medium text-[var(--foreground)]">
                          {tx.managerName}
                        </td>
                        <td className="px-3.5 py-2.5 font-mono font-bold text-[var(--foreground)]">
                          ₹{Number(tx.amount).toLocaleString("en-IN")}
                        </td>
                        <td className="px-3.5 py-2.5 font-mono text-[11px]">
                          {tx.payout_method === "bank_transfer" ? "Bank" : "UPI"}
                        </td>
                        <td className="px-3.5 py-2.5">
                          <span
                            className={`inline-flex items-center px-1.5 py-0.5 rounded-[4px] font-mono text-[10px] font-semibold uppercase tracking-wider border ${
                              tx.status === "transferred"
                                ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                                : "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20"
                            }`}
                          >
                            {tx.status}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="flex justify-end pt-2">
              <Button variant="secondary" size="sm" onClick={() => setIsHistoryModalOpen(false)}>
                Close
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
