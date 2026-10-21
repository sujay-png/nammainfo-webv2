"use client";

import React, { useState } from "react";
import {
  X,
  CreditCard,
  Sparkles,
  ShieldCheck,
  CheckCircle2,
  Clock,
  Loader2,
  Users,
} from "lucide-react";
import type { Profile } from "@/lib/supabase/types";
import { calculateRenewalCost } from "@/lib/pricing";
import { useTheme } from "@/components/ThemeProvider";
import { getTheme } from "@/lib/themes";

interface RenewalModalProps {
  isOpen: boolean;
  onClose: () => void;
  profile: Profile;
  employeesCount: number;
  onSuccess?: () => void;
}

export default function RenewalModal({
  isOpen,
  onClose,
  profile,
  employeesCount,
  onSuccess,
}: RenewalModalProps) {
  const { theme: mode, colorTheme } = useTheme();
  const activePrimaryColor = getTheme(colorTheme).colors[mode]["--primary"];

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const primaryCards = Number(profile.primary_card_count ?? 1);
  const totalCards = primaryCards + employeesCount;
  const cost = calculateRenewalCost(primaryCards, employeesCount);

  const handleRenewalPayment = async () => {
    setLoading(true);
    setErrorMsg(null);

    try {
      const idempotencyKey = `renewal_${profile.id}_${Date.now()}`;

      const res = await fetch("/api/payments/razorpay/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderType: "renewal",
          idempotencyKey,
          shippingAddress: {
            fullName: profile.owner_name || "Company Owner",
            phone: profile.phone || "",
            street: profile.address || "Company Headquarters",
          },
        }),
      });

      const orderData = await res.json();
      if (!res.ok || orderData.error) {
        throw new Error(orderData.error || "Failed to initiate renewal order");
      }

      const { razorpayOrderId, amount, key, cardQuantity, unitPrice, totalAmount } = orderData;

      if (!key) {
        throw new Error("Razorpay API Key is not configured. Please add NEXT_PUBLIC_RAZORPAY_KEY_ID in .env.");
      }

      const loadScript = () =>
        new Promise((resolve) => {
          if ((window as any).Razorpay) return resolve(true);
          const script = document.createElement("script");
          script.src = "https://checkout.razorpay.com/v1/checkout.js";
          script.onload = () => resolve(true);
          script.onerror = () => resolve(false);
          document.body.appendChild(script);
        });

      const isLoaded = await loadScript();

      if (!isLoaded || !(window as any).Razorpay) {
        throw new Error("Failed to load Razorpay payment gateway SDK. Please check your internet connection.");
      }

      const options = {
        key,
        amount,
        currency: "INR",
        name: "Namma Info",
        description: `Annual Renewal for ${totalCards} Card(s)`,
        order_id: razorpayOrderId,
        prefill: {
          name: profile.owner_name || "",
          contact: profile.phone || "",
          email: profile.email || "",
        },
        theme: {
          color: activePrimaryColor || "#0a0a0a",
        },
        handler: async function (response: any) {
          await verifyRenewalPayment({
            razorpayOrderId: response.razorpay_order_id,
            razorpayPaymentId: response.razorpay_payment_id,
            razorpaySignature: response.razorpay_signature,
            orderType: "renewal",
            cardQuantity: cardQuantity || totalCards,
            unitPrice: unitPrice || cost.unitPrice,
            totalAmount: totalAmount || cost.totalAmount,
            shippingAddress: {
              fullName: profile.owner_name || "Company Owner",
              phone: profile.phone || "",
              street: profile.address || "Company Headquarters",
            },
            idempotencyKey,
          });
        },
        modal: {
          ondismiss: function () {
            setLoading(false);
          },
        },
      };

      const rzp = new (window as any).Razorpay(options);
      rzp.open();
    } catch (err: any) {
      console.error("Renewal failed:", err);
      setErrorMsg(err.message || "Failed to process renewal payment");
      setLoading(false);
    }
  };

  const verifyRenewalPayment = async (payload: any) => {
    try {
      const res = await fetch("/api/payments/razorpay/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || "Renewal verification failed");
      }

      if (onSuccess) {
        onSuccess();
      } else {
        window.location.reload();
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Could not verify renewal");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-lg max-h-[92dvh] flex flex-col rounded-3xl border border-[var(--border)] bg-[var(--card)] shadow-2xl relative overflow-hidden">
        {/* Close Button */}
        <button
          onClick={onClose}
          disabled={loading}
          className="absolute top-4 right-4 sm:top-5 sm:right-5 p-2 rounded-xl text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--accent)] transition-colors cursor-pointer z-10"
        >
          <X size={18} />
        </button>

        <div className="flex-1 overflow-y-auto p-5 sm:p-7 space-y-5">
          {/* Header */}
        <div className="space-y-1.5">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[var(--accent)] border border-[var(--border)] font-mono text-[10px] font-semibold uppercase tracking-wider text-[var(--foreground)]">
            <Clock size={11} className="text-[var(--primary)]" />
            <span>Annual Organization Renewal</span>
          </div>
          <h2 className="font-headline text-xl sm:text-2xl font-bold text-[var(--foreground)]">
            Renew All Organization Cards
          </h2>
          <p className="text-xs text-[var(--muted-foreground)]">
            Synchronized 365-day extension for your primary card and all team member IDs.
          </p>
        </div>

        {errorMsg && (
          <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 text-xs">
            {errorMsg}
          </div>
        )}

        {/* Invoice breakdown */}
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--accent)]/30 p-4 space-y-3 text-xs">
          <div className="flex items-center justify-between border-b border-[var(--border)] pb-2.5">
            <div>
              <span className="font-semibold text-[var(--foreground)] block">1x Primary Business Card</span>
              <span className="text-[11px] text-[var(--muted-foreground)]">Pro plan & custom vanity profile URL</span>
            </div>
            <span className="font-mono font-bold text-[var(--foreground)]">
              ₹{cost.unitPrice.toLocaleString("en-IN")}
            </span>
          </div>

          {employeesCount > 0 && (
            <div className="flex items-center justify-between border-b border-[var(--border)] pb-2.5">
              <div>
                <span className="font-semibold text-[var(--foreground)] block">
                  {employeesCount}x Team Member ID Cards
                </span>
                <span className="text-[11px] text-[var(--muted-foreground)]">
                  {employeesCount} employee cards @ ₹{cost.unitPrice}/card
                </span>
              </div>
              <span className="font-mono font-bold text-[var(--foreground)]">
                ₹{(employeesCount * cost.unitPrice).toLocaleString("en-IN")}
              </span>
            </div>
          )}

          <div className="flex items-center justify-between border-b border-[var(--border)] pb-2.5">
            <div className="flex items-center gap-1.5">
              <span className="text-[var(--muted-foreground)]">Volume Pricing Tier</span>
              {cost.unitPrice < 1999 && (
                <span className="bg-emerald-500/10 text-emerald-600 font-mono text-[9px] px-1.5 py-0.5 rounded font-bold border border-emerald-500/20">
                  Volume Discount Applied
                </span>
              )}
            </div>
            <span className="font-mono font-bold text-[var(--foreground)]">
              ₹{cost.unitPrice} / card ({totalCards} total)
            </span>
          </div>

          <div className="flex items-center justify-between pt-1">
            <div>
              <span className="font-headline font-bold text-sm text-[var(--foreground)] block">
                Total Renewal Due
              </span>
              <span className="text-[10px] text-[var(--muted-foreground)]">
                All-inclusive 365-day extension for {totalCards} cards
              </span>
            </div>
            <div className="text-right">
              <span className="font-headline text-2xl font-extrabold text-[var(--foreground)]">
                ₹{cost.totalAmount.toLocaleString("en-IN")}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 text-[11px] text-[var(--muted-foreground)]">
          <ShieldCheck size={16} className="text-emerald-500 shrink-0" />
          <span>Secured by Razorpay • Unified annual expiration synchronized across organization</span>
        </div>

        {/* CTA Button */}
        <button
          onClick={handleRenewalPayment}
          disabled={loading}
          className="w-full flex items-center justify-center gap-2 py-3 px-5 rounded-xl bg-[var(--primary)] text-[var(--primary-foreground)] font-semibold text-xs shadow-md hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-50 cursor-pointer"
        >
          {loading ? (
            <>
              <Loader2 size={15} className="animate-spin" />
              <span>Processing Renewal...</span>
            </>
          ) : (
            <>
              <CreditCard size={15} />
              <span>Pay ₹{cost.totalAmount.toLocaleString("en-IN")} via Razorpay</span>
            </>
          )}
        </button>
        </div>
      </div>
    </div>
  );
}
