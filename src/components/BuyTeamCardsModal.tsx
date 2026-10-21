"use client";

import React, { useState } from "react";
import {
  X,
  Users,
  CreditCard,
  Sparkles,
  ShieldCheck,
  CheckCircle2,
  ArrowRight,
  Loader2,
  Plus,
  Minus,
} from "lucide-react";
import type { Profile } from "@/lib/supabase/types";
import { calculateTeamAddonCost } from "@/lib/pricing";
import { useTheme } from "@/components/ThemeProvider";
import { getTheme } from "@/lib/themes";

interface BuyTeamCardsModalProps {
  isOpen: boolean;
  onClose: () => void;
  profile: Profile;
  currentTeamCount: number;
  onSuccess: () => void;
}

export default function BuyTeamCardsModal({
  isOpen,
  onClose,
  profile,
  currentTeamCount,
  onSuccess,
}: BuyTeamCardsModalProps) {
  const { theme: mode, colorTheme } = useTheme();
  const activePrimaryColor = getTheme(colorTheme).colors[mode]["--primary"];

  const [quantity, setQuantity] = useState<number>(1);
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const primaryCards = Number(profile.primary_card_count || 1);
  const currentTotal = primaryCards + currentTeamCount;
  const cost = calculateTeamAddonCost(currentTotal, quantity);

  const handlePayTeamAddon = async () => {
    setLoading(true);
    setErrorMsg(null);

    try {
      const idempotencyKey = `team_${profile.id}_${Date.now()}`;

      const res = await fetch("/api/payments/razorpay/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderType: "team_addon",
          cardQuantity: quantity,
          idempotencyKey,
          shippingAddress: {
            fullName: profile.owner_name || "Company Owner",
            phone: profile.phone || "",
            street: profile.address || "Company Headquarters",
          },
        }),
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || "Failed to create team order");
      }

      const { razorpayOrderId, amount, key, cardQuantity, unitPrice, totalAmount } = data;

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
        description: `Add ${quantity} Team Member Card(s)`,
        order_id: razorpayOrderId,
        prefill: {
          name: profile.owner_name || "",
          contact: profile.phone || "",
          email: profile.email || "",
        },
        theme: { color: activePrimaryColor || "#0a0a0a" },
        handler: async function (response: any) {
          await verifyAddonPayment({
            razorpayOrderId: response.razorpay_order_id,
            razorpayPaymentId: response.razorpay_payment_id,
            razorpaySignature: response.razorpay_signature,
            orderType: "team_addon",
            cardQuantity: cardQuantity || quantity,
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
      console.error("Team order error:", err);
      setErrorMsg(err.message || "Failed to process team order");
      setLoading(false);
    }
  };

  const verifyAddonPayment = async (payload: any) => {
    try {
      const res = await fetch("/api/payments/razorpay/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || "Verification failed");
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || "Verification failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-md max-h-[92dvh] flex flex-col rounded-3xl border border-[var(--border)] bg-[var(--card)] shadow-2xl relative overflow-hidden">
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-5">
          {/* Header */}
          <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-[var(--accent)] border border-[var(--border)] text-[var(--foreground)] flex items-center justify-center shrink-0">
              <Users size={18} strokeWidth={1.8} />
            </div>
            <div>
              <h3 className="font-headline text-lg font-bold text-[var(--foreground)]">
                Add Team Member Cards
              </h3>
              <p className="text-xs text-[var(--muted-foreground)]">
                Physical NFC & digital ID card quota for employees
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={loading}
            className="p-2 rounded-xl text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--accent)] transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {errorMsg && (
          <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 text-xs">
            {errorMsg}
          </div>
        )}

        {/* Quantity Stepper */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-[var(--foreground)] flex items-center justify-between">
            <span>Additional Team Cards</span>
            <span className="font-mono text-xs font-bold px-2 py-0.5 rounded-full bg-[var(--accent)] border border-[var(--border)] text-[var(--foreground)]">
              +{quantity} {quantity === 1 ? "Card" : "Cards"}
            </span>
          </label>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setQuantity((q) => Math.max(1, q - 1))}
              className="h-11 w-11 rounded-xl border border-[var(--border)] bg-[var(--accent)] hover:bg-[var(--accent)]/80 text-[var(--foreground)] flex items-center justify-center font-bold text-sm transition-colors cursor-pointer"
            >
              <Minus size={16} />
            </button>
            <input
              type="number"
              min="1"
              max="100"
              value={quantity}
              onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
              className="flex-1 h-11 text-center rounded-xl border border-[var(--border)] bg-[var(--background)] font-headline font-bold text-lg outline-none focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)]/20 transition-all text-[var(--foreground)]"
            />
            <button
              type="button"
              onClick={() => setQuantity((q) => q + 1)}
              className="h-11 w-11 rounded-xl border border-[var(--border)] bg-[var(--accent)] hover:bg-[var(--accent)]/80 text-[var(--foreground)] flex items-center justify-center font-bold text-sm transition-colors cursor-pointer"
            >
              <Plus size={16} />
            </button>
          </div>
        </div>

        {/* Pricing Breakdown Card */}
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--accent)]/30 p-4 space-y-3 text-xs">
          <div className="flex items-center justify-between border-b border-[var(--border)] pb-2">
            <span className="text-[var(--muted-foreground)]">Current Organization Cards</span>
            <span className="font-mono font-medium text-[var(--foreground)]">
              {currentTotal} ({primaryCards} Primary + {currentTeamCount} Team)
            </span>
          </div>

          <div className="flex items-center justify-between border-b border-[var(--border)] pb-2">
            <span className="text-[var(--muted-foreground)]">New Total Card Count</span>
            <span className="font-mono font-bold text-[var(--foreground)]">
              {cost.newTotalCards} Total Cards
            </span>
          </div>

          <div className="flex items-center justify-between border-b border-[var(--border)] pb-2">
            <div className="flex items-center gap-1.5">
              <span className="text-[var(--muted-foreground)]">Applied Volume Rate</span>
              {cost.unitPrice < 1999 && (
                <span className="bg-emerald-500/10 text-emerald-600 font-mono text-[9px] px-1.5 py-0.5 rounded font-bold border border-emerald-500/20">
                  Volume Tier
                </span>
              )}
            </div>
            <span className="font-mono font-bold text-[var(--foreground)]">
              ₹{cost.unitPrice} / card
            </span>
          </div>

          <div className="flex items-center justify-between pt-1">
            <span className="font-semibold text-sm text-[var(--foreground)]">Total to Pay Now</span>
            <div className="text-right">
              <span className="font-headline text-2xl font-bold text-[var(--foreground)]">
                ₹{cost.totalAmount.toLocaleString("en-IN")}
              </span>
              <p className="font-mono text-[10px] text-[var(--muted-foreground)]">
                {quantity} × ₹{cost.unitPrice}
              </p>
            </div>
          </div>
        </div>

        {/* Volume Tier Badges */}
        <div className="grid grid-cols-3 gap-2 text-[10px] font-mono text-center">
          <div
            className={`p-2 rounded-xl border transition-all ${
              cost.newTotalCards < 5
                ? "border-[var(--primary)] bg-[var(--accent)] font-bold text-[var(--foreground)]"
                : "border-[var(--border)] text-[var(--muted-foreground)] opacity-70"
            }`}
          >
            <span>1-4 Cards</span>
            <span className="block mt-0.5">₹1,999/card</span>
          </div>
          <div
            className={`p-2 rounded-xl border transition-all ${
              cost.newTotalCards >= 5 && cost.newTotalCards < 25
                ? "border-[var(--primary)] bg-[var(--accent)] font-bold text-[var(--foreground)]"
                : "border-[var(--border)] text-[var(--muted-foreground)] opacity-70"
            }`}
          >
            <span>5-24 Cards</span>
            <span className="block mt-0.5">₹1,499/card</span>
          </div>
          <div
            className={`p-2 rounded-xl border transition-all ${
              cost.newTotalCards >= 25
                ? "border-[var(--primary)] bg-[var(--accent)] font-bold text-[var(--foreground)]"
                : "border-[var(--border)] text-[var(--muted-foreground)] opacity-70"
            }`}
          >
            <span>25+ Cards</span>
            <span className="block mt-0.5">₹999/card</span>
          </div>
        </div>

        {/* Checkout Button */}
        <button
          onClick={handlePayTeamAddon}
          disabled={loading}
          className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-[var(--primary)] text-[var(--primary-foreground)] font-semibold text-xs shadow-md hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-50 cursor-pointer"
        >
          {loading ? (
            <>
              <Loader2 size={15} className="animate-spin" />
              <span>Processing Order...</span>
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
