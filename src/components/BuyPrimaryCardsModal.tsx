"use client";

import React, { useState, useEffect } from "react";
import {
  X,
  CreditCard,
  Truck,
  ShieldCheck,
  ArrowRight,
  ArrowLeft,
  Loader2,
  Minus,
  Plus,
} from "lucide-react";
import type { Profile } from "@/lib/supabase/types";
import { useTheme } from "@/components/ThemeProvider";
import { getTheme } from "@/lib/themes";

interface BuyPrimaryCardsModalProps {
  isOpen: boolean;
  onClose: () => void;
  profile: Profile;
  onSuccess?: () => void;
}

export default function BuyPrimaryCardsModal({
  isOpen,
  onClose,
  profile,
  onSuccess,
}: BuyPrimaryCardsModalProps) {
  const { theme: mode, colorTheme } = useTheme();
  const activePrimaryColor = getTheme(colorTheme).colors[mode]["--primary"];

  const [step, setStep] = useState<1 | 2>(1);
  const [quantity, setQuantity] = useState<number>(1);
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [shippingData, setShippingData] = useState({
    fullName: profile.owner_name || profile.business_name || "",
    phone: profile.phone || "",
    street: profile.address || "",
    city: profile.city || "",
    state: "Karnataka",
    pincode: profile.pincode || "",
  });

  const [idempotencyKey, setIdempotencyKey] = useState<string>("");

  useEffect(() => {
    if (isOpen) {
      setStep(1);
      setQuantity(1);
      setErrorMsg(null);
      setIdempotencyKey(`primary_addon_${profile.id}_${Date.now()}`);
      setShippingData({
        fullName: profile.owner_name || profile.business_name || "",
        phone: profile.phone || "",
        street: profile.address || "",
        city: profile.city || "",
        state: "Karnataka",
        pincode: profile.pincode || "",
      });
    }
  }, [isOpen, profile]);

  if (!isOpen) return null;

  const unitPrice = 500;
  const totalAmount = quantity * unitPrice;
  const currentPrimaryCards = Number(profile.primary_card_count || 1);

  const handleNextToAddress = () => {
    setErrorMsg(null);
    setStep(2);
  };

  const handleRazorpayPayment = async () => {
    if (!shippingData.fullName.trim() || !shippingData.phone.trim() || !shippingData.street.trim()) {
      setErrorMsg("Please provide your delivery recipient name, phone, and street address.");
      return;
    }

    setLoading(true);
    setErrorMsg(null);

    try {
      // Step 1: Call create-order backend API
      const res = await fetch("/api/payments/razorpay/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderType: "primary_card_addon",
          cardQuantity: quantity,
          shippingAddress: shippingData,
          idempotencyKey,
        }),
      });

      const orderData = await res.json();

      if (!res.ok || orderData.error) {
        throw new Error(orderData.error || "Failed to create payment order");
      }

      const { razorpayOrderId, amount, key } = orderData;

      if (!key) {
        throw new Error("Razorpay API Key is not configured in environment variables.");
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
        throw new Error("Failed to load Razorpay payment gateway SDK.");
      }

      const options = {
        key,
        amount,
        currency: "INR",
        name: "Namma Info",
        description: `Additional Primary NFC Card (${quantity} ${quantity === 1 ? "Card" : "Cards"})`,
        order_id: razorpayOrderId,
        prefill: {
          name: shippingData.fullName,
          contact: shippingData.phone,
          email: profile.email || "",
        },
        theme: {
          color: activePrimaryColor || "#0a0a0a",
        },
        handler: async function (response: any) {
          await verifyPayment({
            razorpayOrderId: response.razorpay_order_id,
            razorpayPaymentId: response.razorpay_payment_id,
            razorpaySignature: response.razorpay_signature,
            orderType: "primary_card_addon",
            cardQuantity: quantity,
            unitPrice,
            totalAmount,
            shippingAddress: shippingData,
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
      console.error("Payment flow error:", err);
      setErrorMsg(err.message || "Payment initialization failed. Please try again.");
      setLoading(false);
    }
  };

  const verifyPayment = async (verifyPayload: any) => {
    try {
      const res = await fetch("/api/payments/razorpay/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(verifyPayload),
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || "Payment verification failed");
      }

      if (onSuccess) {
        onSuccess();
      } else {
        window.location.reload();
      }
      onClose();
    } catch (err: any) {
      console.error("Verification error:", err);
      setErrorMsg(err.message || "Payment verified locally, but sync failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-lg max-h-[92dvh] flex flex-col rounded-[5px] border border-[var(--border)] bg-[var(--card)] shadow-2xl relative overflow-hidden">
        {/* Close Button */}
        <button
          onClick={onClose}
          disabled={loading}
          className="absolute top-4 right-4 p-2 rounded-[5px] text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--accent)] transition-colors cursor-pointer z-10"
        >
          <X size={18} />
        </button>

        {/* Modal Header */}
        <div className="p-5 sm:p-6 pb-3 border-b border-[var(--border)] space-y-1">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 font-mono text-[10px] font-semibold uppercase tracking-wider text-[var(--primary)] border border-[var(--border)] rounded-[4px] px-2 py-0.5 bg-[var(--accent)]">
              Primary Card Addon
            </span>
            <span className="font-mono text-[11px] text-[var(--muted-foreground)]">
              Current: {currentPrimaryCards} active
            </span>
          </div>
          <h2 className="font-headline text-lg sm:text-xl font-bold text-[var(--foreground)]">
            Order Additional Primary NFC Cards
          </h2>
          <p className="text-xs text-[var(--muted-foreground)]">
            Get additional engraved NFC cards for your primary business profile at ₹500 each with free doorstep delivery.
          </p>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-4">
          {errorMsg && (
            <div className="rounded-[5px] border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-600 dark:text-red-400">
              {errorMsg}
            </div>
          )}

          {step === 1 && (
            <div className="space-y-4">
              {/* Quantity Stepper */}
              <div className="rounded-[5px] border border-[var(--border)] bg-[var(--background)] p-4 space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <span className="font-semibold text-xs text-[var(--foreground)] block">
                      Number of Cards
                    </span>
                    <span className="text-[11px] text-[var(--muted-foreground)]">
                      ₹500 per additional physical card
                    </span>
                  </div>
                  <div className="flex items-center gap-2 border border-[var(--border)] rounded-[5px] bg-[var(--card)] px-2.5 py-1">
                    <button
                      type="button"
                      onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                      disabled={quantity <= 1}
                      className="p-1 rounded-[4px] text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--accent)] disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed transition"
                      aria-label="Decrease cards"
                    >
                      <Minus size={14} />
                    </button>
                    <span className="w-8 text-center font-mono font-bold text-xs text-[var(--foreground)]">
                      {quantity}
                    </span>
                    <button
                      type="button"
                      onClick={() => setQuantity((q) => Math.min(20, q + 1))}
                      disabled={quantity >= 20}
                      className="p-1 rounded-[4px] text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--accent)] disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed transition"
                      aria-label="Increase cards"
                    >
                      <Plus size={14} />
                    </button>
                  </div>
                </div>

                <div className="border-t border-[var(--border)] pt-2.5 space-y-1.5 text-xs">
                  <div className="flex items-center justify-between text-[var(--muted-foreground)]">
                    <span>Card Rate:</span>
                    <span className="font-mono text-[var(--foreground)]">₹500 / card</span>
                  </div>
                  <div className="flex items-center justify-between text-[var(--muted-foreground)]">
                    <span>Shipping & Handling:</span>
                    <span className="font-mono text-emerald-600 dark:text-emerald-400 font-semibold">FREE</span>
                  </div>
                  <div className="flex items-center justify-between pt-1 border-t border-[var(--border)]">
                    <span className="font-semibold text-[var(--foreground)]">Total Due:</span>
                    <span className="font-headline font-bold text-base text-[var(--foreground)]">
                      ₹{totalAmount.toLocaleString("en-IN")}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="button"
                  onClick={handleNextToAddress}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-[5px] bg-[var(--primary)] text-[var(--primary-foreground)] font-semibold text-xs shadow-sm hover:opacity-90 active:scale-[0.98] transition-all cursor-pointer"
                >
                  <span>Confirm Shipping Address</span>
                  <ArrowRight size={14} />
                </button>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <div className="space-y-3 text-xs">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="font-semibold text-[var(--foreground)] text-[11px] font-mono uppercase tracking-wider">
                      Recipient Name
                    </label>
                    <input
                      type="text"
                      value={shippingData.fullName}
                      onChange={(e) => setShippingData({ ...shippingData, fullName: e.target.value })}
                      className="w-full rounded-[5px] border border-[var(--border)] bg-[var(--background)] px-3.5 py-2 outline-none focus:border-[var(--primary)] transition-all text-xs"
                      placeholder="Enter recipient name"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="font-semibold text-[var(--foreground)] text-[11px] font-mono uppercase tracking-wider">
                      Phone Number
                    </label>
                    <input
                      type="text"
                      value={shippingData.phone}
                      onChange={(e) => setShippingData({ ...shippingData, phone: e.target.value })}
                      className="w-full rounded-[5px] border border-[var(--border)] bg-[var(--background)] px-3.5 py-2 outline-none focus:border-[var(--primary)] transition-all text-xs"
                      placeholder="10-digit mobile number"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="font-semibold text-[var(--foreground)] text-[11px] font-mono uppercase tracking-wider">
                    Street Address / Landmark
                  </label>
                  <textarea
                    rows={2}
                    value={shippingData.street}
                    onChange={(e) => setShippingData({ ...shippingData, street: e.target.value })}
                    className="w-full rounded-[5px] border border-[var(--border)] bg-[var(--background)] px-3.5 py-2 outline-none focus:border-[var(--primary)] transition-all text-xs"
                    placeholder="Building, street name, locality"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="font-semibold text-[var(--foreground)] text-[11px] font-mono uppercase tracking-wider">
                      City
                    </label>
                    <input
                      type="text"
                      value={shippingData.city}
                      onChange={(e) => setShippingData({ ...shippingData, city: e.target.value })}
                      className="w-full rounded-[5px] border border-[var(--border)] bg-[var(--background)] px-3.5 py-2 outline-none focus:border-[var(--primary)] transition-all text-xs"
                      placeholder="e.g. Bengaluru"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="font-semibold text-[var(--foreground)] text-[11px] font-mono uppercase tracking-wider">
                      PIN Code
                    </label>
                    <input
                      type="text"
                      value={shippingData.pincode}
                      onChange={(e) => setShippingData({ ...shippingData, pincode: e.target.value })}
                      className="w-full rounded-[5px] border border-[var(--border)] bg-[var(--background)] px-3.5 py-2 outline-none focus:border-[var(--primary)] transition-all text-xs"
                      placeholder="6-digit PIN"
                    />
                  </div>
                </div>
              </div>

              {/* Order summary box */}
              <div className="rounded-[5px] border border-[var(--border)] bg-[var(--accent)]/30 p-3.5 space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-[var(--muted-foreground)]">Item:</span>
                  <span className="font-medium text-[var(--foreground)]">
                    {quantity} × Additional Primary NFC Card
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[var(--muted-foreground)]">Deliver to:</span>
                  <span className="font-medium text-[var(--foreground)] truncate max-w-[200px]">
                    {shippingData.city ? `${shippingData.city}, ${shippingData.pincode}` : shippingData.street}
                  </span>
                </div>
                <div className="flex items-center justify-between pt-1 border-t border-[var(--border)]">
                  <span className="font-semibold text-[var(--foreground)]">Total:</span>
                  <span className="font-headline font-bold text-base text-[var(--foreground)]">
                    ₹{totalAmount.toLocaleString("en-IN")}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2 text-[11px] text-[var(--muted-foreground)]">
                <ShieldCheck size={15} className="text-emerald-500 shrink-0" />
                <span>Secured by Razorpay • 100% Safe Payment</span>
              </div>

              <div className="flex items-center justify-between pt-2">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  disabled={loading}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-[5px] text-xs font-semibold text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--accent)] transition-colors cursor-pointer"
                >
                  <ArrowLeft size={14} />
                  <span>Back</span>
                </button>
                <button
                  type="button"
                  onClick={handleRazorpayPayment}
                  disabled={loading}
                  className="flex items-center gap-2 px-6 py-2.5 rounded-[5px] bg-[var(--primary)] text-[var(--primary-foreground)] font-semibold text-xs shadow-md hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-50 cursor-pointer"
                >
                  {loading ? (
                    <>
                      <Loader2 size={15} className="animate-spin" />
                      <span>Processing...</span>
                    </>
                  ) : (
                    <>
                      <CreditCard size={15} />
                      <span>Pay ₹{totalAmount.toLocaleString("en-IN")} via Razorpay</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
