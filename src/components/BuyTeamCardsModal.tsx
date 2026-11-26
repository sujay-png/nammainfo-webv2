"use client";

import React, { useState, useEffect } from "react";
import {
  X,
  Users,
  CreditCard,
  Loader2,
  Plus,
  Minus,
  Upload,
  FileText,
  AlertTriangle,
  Palette,
  Check,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { Profile } from "@/lib/supabase/types";
import { calculateTeamAddonCost } from "@/lib/pricing";
import { getCoTerminationWarning } from "@/lib/fulfillment/state-machine";
import { useTheme } from "@/components/ThemeProvider";
import { getTheme } from "@/lib/themes";

interface BuyTeamCardsModalProps {
  isOpen: boolean;
  onClose: () => void;
  profile: Profile;
  currentTeamCount: number;
  onSuccess: () => void;
  onRequestRenewal?: () => void;
}

export default function BuyTeamCardsModal({
  isOpen,
  onClose,
  profile,
  currentTeamCount,
  onSuccess,
  onRequestRenewal,
}: BuyTeamCardsModalProps) {
  const { theme: mode, colorTheme } = useTheme();
  const activePrimaryColor = getTheme(colorTheme).colors[mode]["--primary"];

  const [quantity, setQuantity] = useState<number>(1);
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Reusable Company Template / Design Choice (outside before/at slot purchase)
  const [designChoice, setDesignChoice] = useState<"upload_template" | "team_assist">(
    profile.default_card_template_url ? "upload_template" : "upload_template"
  );
  const [templateFile, setTemplateFile] = useState<File | null>(null);
  const [existingTemplateUrl, setExistingTemplateUrl] = useState<string | null>(
    profile.default_card_template_url || null
  );
  const [designNotes, setDesignNotes] = useState<string>(
    profile.default_card_design_notes || ""
  );

  // Last-100-Days Co-Termination Validity Acknowledgment
  const [ackCoTerm, setAckCoTerm] = useState<boolean>(false);

  useEffect(() => {
    if (isOpen) {
      setQuantity(1);
      setErrorMsg(null);
      setTemplateFile(null);
      setExistingTemplateUrl(profile.default_card_template_url || null);
      setDesignNotes(profile.default_card_design_notes || "");
      setAckCoTerm(false);
    }
  }, [isOpen, profile.default_card_template_url, profile.default_card_design_notes]);

  if (!isOpen) return null;

  const currentTotal = 1 + currentTeamCount;
  const cost = calculateTeamAddonCost(currentTotal, quantity);
  const validityWarning = getCoTerminationWarning(
    profile.membership_expires_at,
    profile.subscription_plan
  );

  const uploadTemplateFile = async (file: File): Promise<string | null> => {
    try {
      const supabase = createClient();
      const ext = file.name.split(".").pop() || "png";
      const rand = Math.random().toString(36).slice(2, 8);
      const path = `${profile.id}/card-designs/template_${Date.now()}_${rand}.${ext}`;
      const { error } = await supabase.storage
        .from("profile-media")
        .upload(path, file, { upsert: true });
      if (error) {
        console.warn("Template upload failed:", error.message);
        return null;
      }
      return supabase.storage.from("profile-media").getPublicUrl(path).data.publicUrl;
    } catch {
      return null;
    }
  };

  const handlePayTeamAddon = async () => {
    if (validityWarning.shouldWarn && !ackCoTerm) {
      setErrorMsg(
        `Please confirm that you understand these team cards will expire with your plan in ${validityWarning.daysRemaining} days.`
      );
      return;
    }

    setLoading(true);
    setErrorMsg(null);

    try {
      let resolvedTemplateUrl = existingTemplateUrl;
      if (designChoice === "upload_template" && templateFile) {
        resolvedTemplateUrl = await uploadTemplateFile(templateFile);
      }

      const idempotencyKey = `team_${profile.id}_${Date.now()}`;
      const shippingPayload = {
        fullName: profile.owner_name || "Company Owner",
        phone: profile.phone || "",
        street: profile.address || "Company Headquarters",
        cardDetails: {
          mode: designChoice === "upload_template" && resolvedTemplateUrl ? "uploaded_card" : "custom_details",
          fileUrl: resolvedTemplateUrl || null,
          designNotes: designNotes.trim() || undefined,
        },
      };

      const res = await fetch("/api/payments/razorpay/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderType: "team_addon",
          cardQuantity: quantity,
          idempotencyKey,
          designUrl: resolvedTemplateUrl,
          designMode: resolvedTemplateUrl ? "uploaded" : "team_assist",
          shippingAddress: shippingPayload,
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
        description: `Add ${quantity} Team / Branch Card(s)`,
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
            designUrl: resolvedTemplateUrl,
            designMode: resolvedTemplateUrl ? "uploaded" : "team_assist",
            shippingAddress: shippingPayload,
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
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-lg max-h-[92dvh] flex flex-col rounded-[5px] border border-[var(--border)] bg-[var(--card)] shadow-2xl relative overflow-hidden">
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-5">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-[5px] bg-[var(--accent)] border border-[var(--border)] text-[var(--foreground)] flex items-center justify-center shrink-0">
                <Users size={18} strokeWidth={1.8} />
              </div>
              <div>
                <h3 className="font-headline text-lg font-bold text-[var(--foreground)]">
                  Add Team &amp; Branch Cards
                </h3>
                <p className="text-xs text-[var(--muted-foreground)]">
                  Physical NFC &amp; digital ID slots for employees and branches
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              disabled={loading}
              className="p-2 rounded-[5px] text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--accent)] transition-colors cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>

          {errorMsg && (
            <div className="p-3 rounded-[5px] bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs">
              {errorMsg}
            </div>
          )}

          {/* Last-100-Days Co-Termination Validity Warning */}
          {validityWarning.shouldWarn && validityWarning.daysRemaining !== null && (
            <div className="rounded-[5px] border border-amber-500/40 bg-amber-500/10 p-3.5 space-y-2.5 text-xs">
              <div className="flex items-start gap-2.5">
                <AlertTriangle size={16} className="text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-semibold text-[var(--foreground)]">
                    Organization Plan Expires in {validityWarning.daysRemaining} Day{validityWarning.daysRemaining === 1 ? "" : "s"}
                  </p>
                  <p className="text-[11px] text-[var(--muted-foreground)] leading-relaxed">
                    Employee and branch cards share your primary organization&apos;s expiry date (
                    <strong>
                      {new Date(validityWarning.expiresAtIso!).toLocaleDateString("en-IN", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </strong>
                    ). Cards purchased now will remain active for{" "}
                    <strong>{validityWarning.daysRemaining} days</strong> and renew together with your primary plan.
                  </p>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-1 border-t border-amber-500/20">
                <label className="flex items-center gap-2 cursor-pointer select-none text-[11px] font-medium text-[var(--foreground)]">
                  <input
                    type="checkbox"
                    checked={ackCoTerm}
                    onChange={(e) => setAckCoTerm(e.target.checked)}
                    className="rounded border-[var(--border)] accent-[var(--foreground)]"
                  />
                  <span>I&apos;m okay with {validityWarning.daysRemaining} days validity</span>
                </label>
                {onRequestRenewal && (
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onRequestRenewal();
                    }}
                    className="text-[11px] font-semibold underline text-[var(--foreground)] hover:opacity-80 cursor-pointer shrink-0"
                  >
                    Renew Organization Plan First →
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Quantity Stepper */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-[var(--foreground)] flex items-center justify-between">
              <span>Additional Team / Branch Cards</span>
              <span className="font-mono text-xs font-bold px-2 py-0.5 rounded-[4px] bg-[var(--accent)] border border-[var(--border)] text-[var(--foreground)]">
                +{quantity} {quantity === 1 ? "Card" : "Cards"}
              </span>
            </label>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                className="h-10 w-10 rounded-[5px] border border-[var(--border)] bg-[var(--accent)] hover:bg-[var(--accent)]/80 text-[var(--foreground)] flex items-center justify-center font-bold text-sm transition-colors cursor-pointer"
              >
                <Minus size={15} />
              </button>
              <input
                type="number"
                min="1"
                max="100"
                value={quantity}
                onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                className="flex-1 h-10 text-center rounded-[5px] border border-[var(--border)] bg-[var(--background)] font-headline font-bold text-base outline-none focus:border-[var(--foreground)] transition-all text-[var(--foreground)]"
              />
              <button
                type="button"
                onClick={() => setQuantity((q) => q + 1)}
                className="h-10 w-10 rounded-[5px] border border-[var(--border)] bg-[var(--accent)] hover:bg-[var(--accent)]/80 text-[var(--foreground)] flex items-center justify-center font-bold text-sm transition-colors cursor-pointer"
              >
                <Plus size={15} />
              </button>
            </div>
          </div>

          {/* Master Company Card Template (Reused across all employees/branches!) */}
          <div className="rounded-[5px] border border-[var(--border)] bg-[var(--background)] p-4 space-y-3 text-xs">
            <div className="flex items-center justify-between">
              <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-[var(--muted-foreground)]">
                Card Print Template (Reusable Across Employees)
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setDesignChoice("upload_template")}
                className={`flex items-center gap-2 rounded-[5px] border p-2.5 text-left transition-colors cursor-pointer ${
                  designChoice === "upload_template"
                    ? "border-[var(--foreground)] bg-[var(--accent)] font-semibold"
                    : "border-[var(--border)] bg-[var(--card)] text-[var(--muted-foreground)]"
                }`}
              >
                <Upload size={14} className="shrink-0" />
                <span className="text-[11px]">Upload Card Template</span>
              </button>
              <button
                type="button"
                onClick={() => setDesignChoice("team_assist")}
                className={`flex items-center gap-2 rounded-[5px] border p-2.5 text-left transition-colors cursor-pointer ${
                  designChoice === "team_assist"
                    ? "border-[var(--foreground)] bg-[var(--accent)] font-semibold"
                    : "border-[var(--border)] bg-[var(--card)] text-[var(--muted-foreground)]"
                }`}
              >
                <Palette size={14} className="shrink-0" />
                <span className="text-[11px]">Design by Namma Info</span>
              </button>
            </div>

            {designChoice === "upload_template" && (
              <div className="space-y-2">
                {existingTemplateUrl && !templateFile && (
                  <div className="flex items-center justify-between rounded-[4px] border border-[var(--border)] bg-[var(--card)] px-2.5 py-2 text-[11px]">
                    <span className="flex items-center gap-1.5 text-[var(--foreground)] font-medium truncate">
                      <Check size={12} className="text-emerald-500 shrink-0" />
                      <span>Using saved company card template</span>
                    </span>
                    <a
                      href={existingTemplateUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="underline text-[var(--muted-foreground)] hover:text-[var(--foreground)] shrink-0 ml-2"
                    >
                      View
                    </a>
                  </div>
                )}
                <label className="flex items-center justify-center gap-2 rounded-[5px] border border-dashed border-[var(--border)] hover:border-[var(--foreground)] bg-[var(--card)] px-3 py-2.5 cursor-pointer transition-colors">
                  <FileText size={14} className="text-[var(--muted-foreground)]" />
                  <span className="text-[11px] font-medium text-[var(--foreground)] truncate">
                    {templateFile
                      ? templateFile.name
                      : existingTemplateUrl
                      ? "Replace Company Card Template (PNG / JPG / PDF)"
                      : "Upload Master Card Template (PNG / JPG / PDF)"}
                  </span>
                  <input
                    type="file"
                    accept="image/*,application/pdf"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) setTemplateFile(f);
                    }}
                  />
                </label>
                <p className="text-[10px] text-[var(--muted-foreground)]">
                  Upload once and reuse across all employees — you&apos;ll just add each employee&apos;s photo &amp; details inside the Team tab (or upload per-employee later).
                </p>
              </div>
            )}

            <div>
              <input
                type="text"
                value={designNotes}
                onChange={(e) => setDesignNotes(e.target.value)}
                placeholder="Optional print notes (e.g. matte black finish, include branch phone)..."
                className="w-full rounded-[5px] border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-xs text-[var(--foreground)] outline-none focus:border-[var(--foreground)]"
              />
            </div>
          </div>

          {/* Pricing Breakdown Card */}
          <div className="rounded-[5px] border border-[var(--border)] bg-[var(--accent)]/30 p-4 space-y-2.5 text-xs">
            <div className="flex items-center justify-between border-b border-[var(--border)] pb-2">
              <span className="text-[var(--muted-foreground)]">Current Organization Seats</span>
              <span className="font-mono font-medium text-[var(--foreground)]">
                {currentTotal} (1 Primary + {currentTeamCount} Team &amp; Branch)
              </span>
            </div>

            <div className="flex items-center justify-between border-b border-[var(--border)] pb-2">
              <span className="text-[var(--muted-foreground)]">New Total Seats</span>
              <span className="font-mono font-bold text-[var(--foreground)]">
                {cost.newTotalCards} Total Cards
              </span>
            </div>

            <div className="flex items-center justify-between border-b border-[var(--border)] pb-2">
              <div className="flex items-center gap-1.5">
                <span className="text-[var(--muted-foreground)]">Applied Rate</span>
                {cost.newTotalCards >= 5 && (
                  <span className="rounded-[4px] border border-[var(--border)] bg-[var(--card)] px-1.5 py-0.5 font-mono text-[9px] font-semibold text-[var(--foreground)]">
                    Volume Tier ({cost.newTotalCards >= 25 ? "25+ Cards" : "5+ Cards"})
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

          {/* Checkout Button */}
          <button
            onClick={handlePayTeamAddon}
            disabled={loading || (validityWarning.shouldWarn && !ackCoTerm)}
            className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-[5px] bg-[var(--primary)] text-[var(--primary-foreground)] font-semibold text-xs shadow-sm hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-50 cursor-pointer"
          >
            {loading ? (
              <>
                <Loader2 size={15} className="animate-spin" />
                <span>Processing Order...</span>
              </>
            ) : (
              <>
                <CreditCard size={15} />
                <span>Pay ₹{cost.totalAmount.toLocaleString("en-IN")}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
