"use client";

import React, { useState, useEffect } from "react";
import { Check, Clock, AlertCircle, ArrowRight, X } from "lucide-react";
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
  const [couponCode, setCouponCode] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Reset state when modal is closed or opened
  useEffect(() => {
    if (!isOpen) {
      setCouponCode("");
      setErrorMsg(null);
      setSuccessMsg(null);
    }
  }, [isOpen]);

  const handleClose = () => {
    setCouponCode("");
    setErrorMsg(null);
    setSuccessMsg(null);
    onClose();
  };

  if (!isOpen) return null;

  const isEligible = completionPct >= 60;
  const missingItems = getProfileCompletionItems(profile).filter((i) => !i.done);
  const isApplied = couponCode.trim().toUpperCase() === "ADI100";

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

      setSuccessMsg(data.message || "Your 100-day free trial application is awaiting confirmation from our team.");
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
          onClick={handleClose}
          className="absolute right-4 top-4 rounded-[5px] p-1 text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--accent)] transition-colors cursor-pointer"
        >
          <X size={16} />
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[5px] bg-[var(--accent)] text-[var(--foreground)] border border-[var(--border)]">
            <Clock size={18} strokeWidth={1.75} />
          </div>
          <div>
            <h3 className="font-headline text-base font-bold text-[var(--foreground)]">
              100-Day Free Trial
            </h3>
            <p className="text-xs text-[var(--muted-foreground)]">
              Experience full Pro Plan features for 100 days
            </p>
          </div>
        </div>

        {/* State A: Success Submitted */}
        {successMsg ? (
          <div className="space-y-4 pt-2 text-center">
            <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-[5px] bg-[var(--accent)] text-[var(--foreground)] border border-[var(--border)]">
              <Check size={20} strokeWidth={2} />
            </div>
            <div>
              <h4 className="font-headline text-sm font-bold text-[var(--foreground)]">
                Application Submitted
              </h4>
              <p className="mt-1 text-xs text-[var(--muted-foreground)] leading-relaxed max-w-sm mx-auto">
                {successMsg}
              </p>
            </div>
            <div className="rounded-[5px] border border-[var(--border)] bg-[var(--accent)]/30 p-3 text-xs text-[var(--muted-foreground)] text-left leading-relaxed">
              Your account status is now set to <strong>Waiting for Approval</strong>. Platform administrators have been notified to review and activate your 100-day trial.
            </div>
            <button
              onClick={handleClose}
              className="w-full rounded-[5px] bg-[var(--primary)] py-2.5 text-xs font-semibold text-[var(--primary-foreground)] hover:opacity-90 transition-opacity cursor-pointer"
            >
              Back to Dashboard
            </button>
          </div>
        ) : !isEligible ? (
          /* State B: Profile completion is under 60% */
          <div className="space-y-4 pt-1">
            <div className="rounded-[5px] border border-[var(--border)] bg-[var(--accent)]/30 p-3.5 space-y-2.5">
              <div className="flex items-center justify-between text-xs font-semibold text-[var(--foreground)]">
                <div className="flex items-center gap-1.5">
                  <AlertCircle size={14} className="text-[var(--muted-foreground)]" />
                  <span>Profile Completion</span>
                </div>
                <span className="font-mono text-[11px] text-[var(--muted-foreground)]">
                  {completionPct}% of 60% required
                </span>
              </div>

              <p className="text-[11px] text-[var(--muted-foreground)] leading-relaxed">
                Complete at least 60% of your business profile details to qualify for the 100-Day Free Trial.
              </p>

              {/* Monochrome progress bar */}
              <div className="h-1.5 w-full rounded-full bg-[var(--muted)] overflow-hidden">
                <div
                  className="h-full rounded-full bg-[var(--foreground)] transition-all duration-300"
                  style={{ width: `${Math.min(100, Math.round((completionPct / 60) * 100))}%` }}
                />
              </div>
            </div>

            {missingItems.length > 0 && (
              <div className="space-y-1.5">
                <span className="font-mono text-[10px] uppercase tracking-wider text-[var(--muted-foreground)] block font-semibold px-0.5">
                  Incomplete profile fields:
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                  {missingItems.slice(0, 4).map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center gap-2 p-2 rounded-[4px] border border-[var(--border)] bg-[var(--card)] text-xs text-[var(--muted-foreground)]"
                    >
                      <span className="h-1.5 w-1.5 rounded-full bg-[var(--muted-foreground)] shrink-0" />
                      <span className="truncate">{item.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <button
              onClick={() => {
                handleClose();
                router.push("/dashboard/profile");
              }}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-[5px] bg-[var(--primary)] text-[var(--primary-foreground)] text-xs font-semibold shadow-xs hover:opacity-90 transition-all cursor-pointer"
            >
              <span>Complete Profile Setup</span>
              <ArrowRight size={14} />
            </button>
          </div>
        ) : (
          /* State C: Eligible (>= 60%), Enter Coupon Code */
          <form onSubmit={handleSubmit} className="space-y-4 pt-1">
            <div className="rounded-[5px] border border-[var(--border)] bg-[var(--accent)]/30 p-3 space-y-1.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-[var(--muted-foreground)] font-medium">Profile Verification</span>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-[4px] border border-[var(--border)] bg-[var(--card)] font-mono text-[11px] font-semibold text-[var(--foreground)]">
                  <Check size={11} className="text-[var(--foreground)]" />
                  <span>{completionPct}% Complete</span>
                </span>
              </div>
              <p className="text-[11px] text-[var(--muted-foreground)] leading-relaxed">
                Your profile meets the 60% requirement. Enter the coupon code below to submit your request for approval.
              </p>
            </div>

            {/* Coupon Code Input */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[var(--foreground)] block">
                Coupon Code
              </label>
              <input
                type="text"
                value={couponCode}
                onChange={(e) => {
                  setCouponCode(e.target.value.toUpperCase());
                  if (errorMsg) setErrorMsg(null);
                }}
                placeholder="ADI100"
                className="w-full rounded-[5px] border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-xs font-mono font-semibold tracking-wider text-[var(--foreground)] outline-none focus:border-[var(--foreground)] transition-colors placeholder:text-[var(--muted-foreground)]/50"
                autoFocus
              />

              {/* Eligible Code Row */}
              <div className="flex items-center justify-between p-2.5 rounded-[5px] border border-[var(--border)] bg-[var(--accent)]/20">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-[var(--muted-foreground)]">Eligible code:</span>
                  <code className="font-mono text-xs font-bold text-[var(--foreground)] bg-[var(--card)] px-2 py-0.5 rounded-[4px] border border-[var(--border)] tracking-wider">
                    ADI100
                  </code>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setCouponCode("ADI100");
                    setErrorMsg(null);
                  }}
                  className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-[4px] border text-[11px] font-medium transition-colors cursor-pointer ${
                    isApplied
                      ? "border-[var(--border)] bg-[var(--accent)] text-[var(--foreground)] font-semibold"
                      : "border-[var(--border)] bg-[var(--card)] hover:bg-[var(--accent)] text-[var(--foreground)]"
                  }`}
                >
                  {isApplied ? (
                    <>
                      <Check size={11} className="text-emerald-500" />
                      <span>Applied</span>
                    </>
                  ) : (
                    <span>Apply Code</span>
                  )}
                </button>
              </div>
            </div>

            {errorMsg && (
              <div className="rounded-[5px] border border-rose-500/20 bg-rose-500/10 p-2.5 text-xs text-rose-600 dark:text-rose-400 flex items-center gap-2">
                <AlertCircle size={14} className="shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-[5px] bg-[var(--primary)] text-[var(--primary-foreground)] text-xs font-semibold shadow-xs hover:opacity-90 active:scale-[0.98] transition-all cursor-pointer disabled:opacity-50"
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
