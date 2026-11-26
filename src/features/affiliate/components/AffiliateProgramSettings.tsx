"use client";

import React, { useCallback, useEffect, useState } from "react";
import {
  Handshake,
  ChevronRight,
  Clock,
  CheckCircle2,
  XCircle,
  ExternalLink,
  Loader2,
  X,
} from "lucide-react";

type AffiliateStatus = "none" | "pending" | "approved" | "rejected";

interface AffiliateResponse {
  status: AffiliateStatus;
  isPartner: boolean;
  applicantType: "owner" | "employee";
  request: {
    id: string;
    status: string;
    note: string | null;
    rejectionReason: string | null;
    createdAt: string;
    reviewedAt: string | null;
  } | null;
  profileSummary?: {
    fullName: string | null;
    businessName: string | null;
    email: string;
    phone: string | null;
    designation: string | null;
  };
}

export function AffiliateProgramSettings({
  variant = "owner",
}: {
  variant?: "owner" | "employee";
}) {
  const [data, setData] = useState<AffiliateResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [openingPartner, setOpeningPartner] = useState(false);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/affiliate/request", { cache: "no-store" });
      if (!res.ok) return;
      const json = (await res.json()) as AffiliateResponse;
      setData(json);
    } catch {
      // Ignore silent failures on settings load
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  async function handleSubmitRequest(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/affiliate/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || "Could not submit your request. Please try again.");
        return;
      }
      setModalOpen(false);
      setNote("");
      await fetchStatus();
    } catch {
      setError("Network error while submitting request.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleOpenPartnerPortal() {
    setOpeningPartner(true);
    setError(null);
    try {
      const hostname = typeof window !== "undefined" ? window.location.hostname : "";
      const res = await fetch("/api/affiliate/sso", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hostname }),
      });
      const json = await res.json();
      if (res.ok && json.url) {
        window.location.href = json.url;
        return;
      }
      // Safe fallback to same-origin partner dashboard
      window.location.href = "/partner";
    } catch {
      window.location.href = "/partner";
    } finally {
      setOpeningPartner(false);
    }
  }

  const status: AffiliateStatus = data?.isPartner
    ? "approved"
    : data?.status ?? "none";

  return (
    <div className="mt-4">
      {variant === "employee" && (
        <p className="mb-1.5 px-1 font-mono text-[10px] font-semibold uppercase tracking-widest text-[var(--muted-foreground)]">
          Partner Program
        </p>
      )}

      <div className="rounded-[5px] border border-[var(--border)] bg-[var(--card)] p-4">
        {loading ? (
          <div className="flex items-center gap-3 py-1 text-xs text-[var(--muted-foreground)]">
            <Loader2 size={15} className="animate-spin shrink-0" />
            <span>Checking affiliate status...</span>
          </div>
        ) : status === "approved" ? (
          <div className="space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[5px] border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)]">
                  <Handshake size={16} />
                </div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-medium text-[var(--foreground)]">
                      Affiliate Partner Program
                    </p>
                    <span className="inline-flex items-center gap-1 rounded-[4px] border border-[var(--border)] bg-[var(--background)] px-1.5 py-0.5 font-mono text-[10px] font-semibold text-[var(--foreground)]">
                      <CheckCircle2 size={10} />
                      ACCEPTED
                    </span>
                  </div>
                  <p className="mt-1 text-xs leading-relaxed text-[var(--muted-foreground)]">
                    Your request is accepted. You can open{" "}
                    <span className="font-mono font-medium text-[var(--foreground)]">
                      partner.nammainfo.in
                    </span>{" "}
                    anytime using your same email and password, or launch directly below without logging in again.
                  </p>
                </div>
              </div>
            </div>

            <button
              type="button"
              disabled={openingPartner}
              onClick={handleOpenPartnerPortal}
              className="flex w-full items-center justify-center gap-2 rounded-[5px] bg-[var(--foreground)] px-3.5 py-2.5 text-xs font-semibold text-[var(--background)] hover:opacity-90 disabled:opacity-50 cursor-pointer"
            >
              {openingPartner ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <ExternalLink size={14} />
              )}
              <span>
                {openingPartner ? "Opening Partner Dashboard..." : "Open Partner Dashboard"}
              </span>
            </button>
          </div>
        ) : status === "pending" ? (
          <div className="flex items-start gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[5px] border border-[var(--border)] bg-[var(--background)] text-[var(--muted-foreground)]">
              <Clock size={16} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-medium text-[var(--foreground)]">
                  Affiliate Partner Program
                </p>
                <span className="inline-flex items-center gap-1 rounded-[4px] border border-[var(--border)] bg-[var(--background)] px-1.5 py-0.5 font-mono text-[10px] font-semibold text-[var(--muted-foreground)]">
                  PENDING REVIEW
                </span>
              </div>
              <p className="mt-1 text-xs leading-relaxed text-[var(--muted-foreground)]">
                Your application to join as a Namma Info Partner has been submitted and is waiting for admin approval.
              </p>
            </div>
          </div>
        ) : status === "rejected" ? (
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[5px] border border-[var(--border)] bg-[var(--background)] text-[var(--muted-foreground)]">
                <XCircle size={16} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-medium text-[var(--foreground)]">
                    Affiliate Partner Program
                  </p>
                  <span className="inline-flex items-center gap-1 rounded-[4px] border border-[var(--border)] bg-[var(--background)] px-1.5 py-0.5 font-mono text-[10px] font-semibold text-[var(--muted-foreground)]">
                    NOT APPROVED
                  </span>
                </div>
                <p className="mt-1 text-xs leading-relaxed text-[var(--muted-foreground)]">
                  {data?.request?.rejectionReason
                    ? `Reason: ${data.request.rejectionReason}`
                    : "Your previous request was not approved. You can submit a new request anytime."}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setModalOpen(true)}
              className="flex w-full items-center justify-center gap-2 rounded-[5px] border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-xs font-semibold text-[var(--foreground)] hover:bg-[var(--accent)] cursor-pointer"
            >
              <Handshake size={14} />
              <span>Re-apply for Affiliate Program</span>
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className="flex w-full items-center gap-3 text-left cursor-pointer group"
          >
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[5px] border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)]">
              <Handshake size={16} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-[var(--foreground)]">
                Join Affiliate Program
              </p>
              <p className="text-xs text-[var(--muted-foreground)]">
                Become a Namma Info Partner and earn on referrals
              </p>
            </div>
            <ChevronRight
              size={16}
              className="shrink-0 text-[var(--muted-foreground)] group-hover:text-[var(--foreground)]"
            />
          </button>
        )}
      </div>

      {/* Confirmation & Request Modal */}
      {modalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-md rounded-[5px] border border-[var(--border)] bg-[var(--card)] p-5 shadow-xl space-y-4">
            <div className="flex items-start justify-between gap-3 border-b border-[var(--border)] pb-3">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-[5px] border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)]">
                  <Handshake size={16} />
                </div>
                <div>
                  <h3 className="font-headline text-sm font-bold text-[var(--foreground)]">
                    Join Namma Info Affiliate Program
                  </h3>
                  <p className="text-[11px] text-[var(--muted-foreground)]">
                    {variant === "employee"
                      ? "Apply with your employee account to refer new businesses"
                      : "Request partner access using your current account"}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (!submitting) setModalOpen(false);
                }}
                className="rounded-[4px] p-1 text-[var(--muted-foreground)] hover:bg-[var(--accent)] hover:text-[var(--foreground)] cursor-pointer"
                aria-label="Close"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSubmitRequest} className="space-y-4">
              <div className="rounded-[5px] border border-[var(--border)] bg-[var(--background)] p-3 text-xs text-[var(--muted-foreground)] space-y-1.5">
                <p className="font-medium text-[var(--foreground)]">
                  What happens after you apply:
                </p>
                <ul className="list-disc pl-4 space-y-1">
                  <li>Your request is reviewed by the Namma Info Admin team.</li>
                  <li>
                    Once accepted, you can open{" "}
                    <span className="font-mono text-[var(--foreground)]">partner.nammainfo.in</span>{" "}
                    using the same credentials or the direct dashboard link in Settings.
                  </li>
                  <li>
                    Sharing your Namma Info profile card or coupon code automatically credits your Partner referrals.
                  </li>
                </ul>
              </div>

              <div className="space-y-1.5">
                <label className="font-mono text-[10px] font-semibold uppercase tracking-wider text-[var(--muted-foreground)] block">
                  Note for Admin (Optional)
                </label>
                <textarea
                  rows={3}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Share your network, city, or how you plan to refer businesses..."
                  className="w-full rounded-[5px] border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-xs text-[var(--foreground)] placeholder-[var(--muted-foreground)] outline-none focus:border-[var(--foreground)]"
                />
              </div>

              {error && (
                <p className="rounded-[5px] border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-600 dark:text-red-400">
                  {error}
                </p>
              )}

              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => setModalOpen(false)}
                  className="rounded-[5px] border border-[var(--border)] bg-[var(--background)] px-3.5 py-2 text-xs font-medium text-[var(--foreground)] hover:bg-[var(--accent)] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="inline-flex items-center gap-1.5 rounded-[5px] bg-[var(--foreground)] px-4 py-2 text-xs font-semibold text-[var(--background)] hover:opacity-90 disabled:opacity-50 cursor-pointer"
                >
                  {submitting && <Loader2 size={13} className="animate-spin" />}
                  <span>{submitting ? "Submitting..." : "Confirm & Request Partner Access"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
