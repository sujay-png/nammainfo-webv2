"use client";

import React, { useState } from "react";
import { Gift, Check, Clock, AlertCircle, ArrowRight, X, Copy } from "lucide-react";
import { useRouter } from "next/navigation";
import type { Profile } from "@/lib/supabase/types";
import { getProfileCompletionItems } from "@/lib/profile-completion";

interface ApplyFreeTrialModalProps {
  isOpen: boolean;
  onClose: () => void;
  profile: Profile | null;
  completionPct: number;
  onSuccess: () => void;
}

export default function ApplyFreeTrialModal({
  isOpen,
  onClose,
  profile,
  completionPct,
  onSuccess,
}: ApplyFreeTrialModalProps) {
  const router = useRouter();
  const [couponCode, setCouponCode] = useState<string>("ADI100");
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const isEligible = completionPct >= 60;
  const missingItems = getProfileCompletionItems(profile).filter((i) => !i.done);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const trimmed = couponCode.trim().toUpperCase();
    if (!trimmed) {
      setErrorMsg("Please enter coupon code ADI100 to apply.");
      return;
    }

    if (trimmed !== "ADI100") {
      setErrorMsg("Invalid coupon code. Please use coupon code ADI100.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/trial/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ couponCode: trimmed }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to submit application");
      }

      setSuccessMsg(data.message || "Your 100 days free trial is awaiting confirmation from our team.");
      onSuccess();
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to apply for free trial.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="relative w-full max-w-md rounded-[5px] border border-[var(--border)] bg-[var(--card)] p-5 sm:p-6 shadow-xl space-y-4 text-[var(--foreground)]">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute right-4 top-4 rounded-[5px] p-1 text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--accent)] transition-colors"
        >
          <X size={16} />
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[5px] bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
            <Gift size={20} strokeWidth={1.8} />
          </div>
          <div>
            <h3 className="font-headline text-base font-bold text-[var(--foreground)]">
              100-Day Free Trial
            </h3>
            <p className="text-xs text-[var(--muted-foreground)]">
              Unlock complete Pro Plan features for 100 days
            </p>
          </div>
        </div>

        {/* State A: Success Submitted */}
        {successMsg ? (
          <div className="space-y-4 pt-2 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
              <Check size={24} />
            </div>
            <div>
              <h4 className="font-headline text-sm font-bold text-[var(--foreground)]">
                Application Submitted!
              </h4>
              <p className="mt-1 text-xs text-[var(--muted-foreground)] leading-relaxed">
                {successMsg}
              </p>
            </div>
            <div className="rounded-[5px] border border-[var(--border)] bg-[var(--accent)]/40 p-3 text-xs text-[var(--muted-foreground)]">
              Your dashboard status is now set to <strong>Waiting for Approval</strong>. Our team will verify and activate your 100-day trial shortly.
            </div>
            <button
              onClick={onClose}
              className="w-full rounded-[5px] bg-[var(--foreground)] py-2 text-xs font-semibold text-[var(--background)] hover:opacity-90 transition-opacity"
            >
              Back to Dashboard
            </button>
          </div>
        ) : !isEligible ? (
          /* State B: Profile completion is under 60% */
          <div className="space-y-4 pt-1">
            <div className="rounded-[5px] border border-amber-500/30 bg-amber-500/10 p-3.5 space-y-2">
              <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 font-semibold text-xs">
                <AlertCircle size={15} />
                <span>Profile Completion: {completionPct}% (Min 60% Required)</span>
              </div>
              <p className="text-[11px] text-[var(--muted-foreground)] leading-relaxed">
                To prevent spam and ensure high-quality digital business cards, we require at least <strong>60% profile completion</strong> before approving the 100-Day Free Trial.
              </p>
              {/* Progress bar */}
              <div className="h-1.5 w-full rounded-full bg-[var(--muted)] overflow-hidden">
                <div
                  className="h-full rounded-full bg-amber-500 transition-all duration-300"
                  style={{ width: `${completionPct}%` }}
                />
              </div>
            </div>

            {missingItems.length > 0 && (
              <div className="space-y-1.5">
                <span className="font-mono text-[10px] uppercase tracking-wider text-[var(--muted-foreground)] block">
                  Quick fields you can complete:
                </span>
                <ul className="space-y-1 text-xs text-[var(--muted-foreground)]">
                  {missingItems.slice(0, 4).map((item) => (
                    <li key={item.id} className="flex items-center gap-1.5">
                      <span className="h-1 w-1 rounded-full bg-amber-500" />
                      <span>{item.label}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <button
              onClick={() => {
                onClose();
                router.push("/dashboard/profile");
              }}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-[5px] bg-[var(--foreground)] text-[var(--background)] text-xs font-semibold shadow-sm hover:opacity-90 transition-all cursor-pointer"
            >
              <span>Complete Profile Setup</span>
              <ArrowRight size={14} />
            </button>
          </div>
        ) : (
          /* State C: Eligible (>= 60%), Enter Coupon Code */
          <form onSubmit={handleSubmit} className="space-y-4 pt-1">
            <div className="rounded-[5px] border border-[var(--border)] bg-[var(--accent)]/30 p-3 space-y-1 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-[var(--muted-foreground)]">Profile Verified:</span>
                <span className="font-mono font-bold text-emerald-500">{completionPct}% Complete ✓</span>
              </div>
              <p className="text-[11px] text-[var(--muted-foreground)] leading-relaxed">
                You qualify for the 100-day Free Trial with full Pro features. Apply the coupon code below to submit your request for approval.
              </p>
            </div>

            {/* Coupon Code Input */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[var(--foreground)] block">
                Enter Coupon Code:
              </label>
              <input
                type="text"
                value={couponCode}
                onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                placeholder="ADI100"
                className="w-full rounded-[5px] border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm font-mono font-semibold tracking-wider text-[var(--foreground)] outline-none focus:border-[var(--foreground)]"
                autoFocus
              />

              {/* Helper badge below text area */}
              <button
                type="button"
                onClick={() => setCouponCode("ADI100")}
                className="w-full flex items-center justify-between p-2.5 rounded-[5px] border border-dashed border-[var(--border)] bg-[var(--accent)]/20 hover:bg-[var(--accent)]/50 transition-colors text-left"
              >
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-[var(--muted-foreground)]">Use coupon code:</span>
                  <span className="font-mono text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
                    ADI100
                  </span>
                </div>
                <span className="font-mono text-[10px] text-[var(--muted-foreground)] underline">
                  Click to fill
                </span>
              </button>
            </div>

            {errorMsg && (
              <div className="rounded-[5px] border border-rose-500/30 bg-rose-500/10 p-2.5 text-xs text-rose-500 flex items-center gap-1.5">
                <AlertCircle size={14} className="shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-[5px] bg-[var(--primary)] text-[var(--primary-foreground)] text-xs font-semibold shadow-sm hover:opacity-90 active:scale-[0.98] transition-all cursor-pointer disabled:opacity-50"
            >
              {loading ? (
                <span>Submitting application...</span>
              ) : (
                <>
                  <span>Apply for 100-Day Free Trial</span>
                  <ArrowRight size={14} />
                </>
              )}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

