"use client";

import React, { useState, useEffect } from "react";
import {
  X,
  CreditCard,
  Upload,
  CheckCircle2,
  Phone,
  MapPin,
  Sparkles,
  ShieldCheck,
  ArrowRight,
  ArrowLeft,
  Loader2,
  FileText,
  AlertCircle,
  Check,
  Palette,
  Truck,
  Image as ImageIcon,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { Profile } from "@/lib/supabase/types";
import { useTheme } from "@/components/ThemeProvider";
import { getTheme } from "@/lib/themes";

import { useRouter } from "next/navigation";
import { calculateProfileCompletion } from "@/lib/profile-completion";

interface UpgradeToProModalProps {
  isOpen: boolean;
  onClose: () => void;
  profile: Profile;
  onSuccess?: () => void;
}

type DesignOption = "upload" | "concierge";

export default function UpgradeToProModal({
  isOpen,
  onClose,
  profile,
  onSuccess,
}: UpgradeToProModalProps) {
  const router = useRouter();
  const { theme: mode, colorTheme } = useTheme();
  const activePrimaryColor = getTheme(colorTheme).colors[mode]["--primary"];

  const completion = calculateProfileCompletion(profile);

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Step 1: Design State (Explicit choice required before continuing)
  const [designOption, setDesignOption] = useState<DesignOption | null>(null);
  const [designFile, setDesignFile] = useState<File | null>(null);
  const [designPreview, setDesignPreview] = useState<string | null>(null);
  const [uploadingDesign, setUploadingDesign] = useState<boolean>(false);

  // Step 2: Shipping Address State (default: same as profile)
  const [sameAsProfile, setSameAsProfile] = useState<boolean>(true);
  const [shippingData, setShippingData] = useState({
    fullName: profile.owner_name || profile.business_name || "",
    phone: profile.phone || "",
    street: profile.address || "",
    city: "",
    state: "Karnataka",
    pincode: "",
    notes: "",
  });

  // Unique idempotency key per checkout attempt
  const [idempotencyKey, setIdempotencyKey] = useState<string>("");

  useEffect(() => {
    if (isOpen) {
      setStep(1);
      setErrorMsg(null);
      setDesignOption(null);
      setDesignFile(null);
      setDesignPreview(null);
      setIdempotencyKey(`pro_${profile.id}_${Date.now()}`);
      setShippingData((prev) => ({
        ...prev,
        fullName: profile.owner_name || profile.business_name || prev.fullName,
        phone: profile.phone || prev.phone,
        street: profile.address || prev.street,
      }));
    }
  }, [isOpen, profile]);

  if (!isOpen) return null;

  if (!completion.isComplete) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
        <div className="w-full max-w-lg max-h-[92dvh] flex flex-col rounded-3xl border border-[var(--border)] bg-[var(--card)] shadow-2xl relative overflow-hidden">
          {/* Close Button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 sm:top-5 sm:right-5 p-2 rounded-xl text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--accent)] transition-colors cursor-pointer z-10"
          >
            <X size={18} />
          </button>

          <div className="flex-1 overflow-y-auto p-5 sm:p-7 space-y-4 sm:space-y-5">

          {/* Header */}
          <div className="space-y-2">
            <div className="inline-flex items-center gap-1.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-400">
              <AlertCircle size={12} />
              <span>100% Profile Required</span>
            </div>
            <h2 className="font-headline text-xl sm:text-2xl font-bold text-[var(--foreground)]">
              Complete Profile Before Upgrading
            </h2>
            <p className="text-xs text-[var(--muted-foreground)] leading-relaxed">
              To ensure your custom physical NFC card is engraved accurately and your vanity link (<code className="font-mono text-[11px] text-[var(--foreground)]">namma.info/{profile.username || "username"}</code>) is ready for public sharing, your profile must be 100% complete before checkout.
            </p>
          </div>

          {/* Progress Bar */}
          <div className="space-y-2 p-3.5 rounded-2xl bg-[var(--accent)]/40 border border-[var(--border)]">
            <div className="flex items-center justify-between text-xs font-medium">
              <span className="text-[var(--foreground)] font-semibold">Profile Completion</span>
              <span className="font-mono text-xs font-bold text-[var(--primary)]">
                {completion.percentage}% ({completion.completedCount}/{completion.totalCount} completed)
              </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--muted)]">
              <div
                className="h-full rounded-full bg-[var(--primary)] transition-all duration-500"
                style={{ width: `${completion.percentage}%` }}
              />
            </div>
          </div>

          {/* Missing Checklist */}
          <div className="space-y-2">
            <span className="text-xs font-semibold text-[var(--foreground)] block">
              Remaining items to finish ({completion.missingItems.length}):
            </span>
            <div className="space-y-1.5 max-h-52 overflow-y-auto pr-1">
              {completion.missingItems.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between p-2.5 rounded-xl border border-[var(--border)] bg-[var(--background)] text-xs"
                >
                  <div className="flex items-center gap-2">
                    <div className="h-4 w-4 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-600 flex items-center justify-center shrink-0">
                      <AlertCircle size={10} />
                    </div>
                    <span className="text-[var(--foreground)] font-medium">{item.label}</span>
                  </div>
                  <span className="text-[10px] font-mono text-[var(--muted-foreground)] uppercase">
                    Pending
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* CTA Buttons */}
          <div className="space-y-2 pt-1">
            <button
              onClick={() => {
                onClose();
                router.push("/dashboard/profile");
              }}
              className="w-full flex items-center justify-center gap-2 py-3 px-5 rounded-xl bg-[var(--primary)] text-[var(--primary-foreground)] font-semibold text-xs shadow-md hover:opacity-90 active:scale-[0.98] transition-all cursor-pointer"
            >
              <span>Complete Profile Now</span>
              <ArrowRight size={14} />
            </button>
            <button
              onClick={onClose}
              className="w-full py-2.5 px-4 rounded-xl text-xs font-medium text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--accent)] transition-colors cursor-pointer text-center"
            >
              I&apos;ll do this later
            </button>
          </div>
        </div>
        </div>
      </div>
    );
  }

  // Handle file selection
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setDesignFile(file);
      setDesignOption("upload");
      setErrorMsg(null);
      setDesignPreview(URL.createObjectURL(file));
    }
  };

  // Upload card design to Supabase Storage
  const uploadDesignFile = async (): Promise<string | null> => {
    if (!designFile) return null;
    setUploadingDesign(true);
    try {
      const supabase = createClient();
      const ext = designFile.name.split(".").pop();
      const path = `card-designs/${profile.id}/${Date.now()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("profile-media")
        .upload(path, designFile);

      if (uploadError) {
        console.warn("Storage upload error:", uploadError);
        return null;
      }

      const { data } = supabase.storage.from("profile-media").getPublicUrl(path);
      return data?.publicUrl || null;
    } catch (err) {
      console.error("Design upload failed:", err);
      return null;
    } finally {
      setUploadingDesign(false);
    }
  };

  // Step 1 -> Step 2 validation: Must make an explicit choice
  const goToStep2 = () => {
    if (!designOption) {
      setErrorMsg("Please choose an option to continue: upload your artwork or choose complimentary design concierge.");
      return;
    }
    if (designOption === "upload" && !designFile) {
      setErrorMsg("Please upload your card artwork file (PNG, JPG, or PDF) to continue with custom artwork.");
      return;
    }
    setErrorMsg(null);
    setStep(2);
  };

  const goToStep3 = () => {
    if (!shippingData.fullName.trim() || !shippingData.phone.trim() || !shippingData.street.trim()) {
      setErrorMsg("Please provide your delivery recipient name, phone, and street address.");
      return;
    }
    setErrorMsg(null);
    setStep(3);
  };

  // Initialize Razorpay Payment
  const handleRazorpayPayment = async () => {
    setLoading(true);
    setErrorMsg(null);

    try {
      let uploadedUrl: string | null = null;
      if (designOption === "upload" && designFile) {
        uploadedUrl = await uploadDesignFile();
      }

      // Step 1: Call create-order backend API
      const res = await fetch("/api/payments/razorpay/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderType: "pro_initial",
          cardQuantity: 1,
          designUrl: uploadedUrl,
          designMode: designOption === "concierge" ? "team_assist" : "uploaded",
          shippingAddress: shippingData,
          idempotencyKey,
        }),
      });

      const orderData = await res.json();

      if (!res.ok || orderData.error) {
        throw new Error(orderData.error || "Failed to create payment order");
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

      // Open official Razorpay modal (supports Test Mode with rzp_test_ keys or Live Mode with rzp_live_ keys)
      const options = {
        key,
        amount,
        currency: "INR",
        name: "Namma Info",
        description: "Pro Subscription + Custom NFC Business Card",
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
            orderType: "pro_initial",
            cardQuantity: cardQuantity || 1,
            unitPrice: unitPrice || 1999,
            totalAmount: totalAmount || 1999,
            designUrl: uploadedUrl,
            designMode: designOption === "concierge" ? "team_assist" : "uploaded",
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
    } catch (err: any) {
      setErrorMsg(err.message || "Could not verify payment");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-xl max-h-[92dvh] flex flex-col rounded-3xl border border-[var(--border)] bg-[var(--card)] shadow-2xl relative overflow-hidden">
        {/* Close Button */}
        <button
          onClick={onClose}
          disabled={loading}
          className="absolute top-4 right-4 sm:top-5 sm:right-5 p-2 rounded-xl text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--accent)] transition-colors cursor-pointer z-10"
        >
          <X size={18} />
        </button>

        <div className="flex-1 overflow-y-auto p-5 sm:p-7 space-y-5">
          {/* Modal Header */}
        <div className="space-y-1.5">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[var(--accent)] border border-[var(--border)] font-mono text-[10px] font-semibold uppercase tracking-wider text-[var(--foreground)]">
            <Sparkles size={11} className="text-[var(--primary)]" />
            <span>Pro Membership & NFC Card</span>
          </div>
          <h2 className="font-headline text-xl sm:text-2xl font-bold text-[var(--foreground)]">
            Claim Your Custom NFC Smart Card
          </h2>
          <p className="text-xs text-[var(--muted-foreground)]">
            Activate your vanity profile URL and get your high-finish NFC card delivered to your door.
          </p>
        </div>

        {/* Step Indicator */}
        <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
          {[
            { num: 1, label: "Design", icon: Palette },
            { num: 2, label: "Shipping", icon: Truck },
            { num: 3, label: "Review & Pay", icon: CreditCard },
          ].map((s) => {
            const isActive = step === s.num;
            const isCompleted = step > s.num;
            const Icon = s.icon;
            return (
              <div
                key={s.num}
                className={`flex items-center justify-center gap-1 sm:gap-1.5 py-1.5 sm:py-2 px-1.5 sm:px-2.5 rounded-xl border text-[11px] sm:text-xs font-medium transition-all ${
                  isActive
                    ? "bg-[var(--primary)] text-[var(--primary-foreground)] border-transparent shadow-sm font-semibold"
                    : isCompleted
                    ? "bg-[var(--accent)] text-[var(--foreground)] border-[var(--border)]"
                    : "bg-[var(--accent)]/30 text-[var(--muted-foreground)] border-transparent"
                }`}
              >
                {isCompleted ? (
                  <Check size={11} strokeWidth={2.5} className="shrink-0" />
                ) : (
                  <Icon size={11} className="shrink-0" />
                )}
                <span className="truncate">{s.label}</span>
              </div>
            );
          })}
        </div>

        {errorMsg && (
          <div className="flex items-center gap-2 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 text-xs">
            <AlertCircle size={15} className="shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* STEP 1: Card Design */}
        {step === 1 && (
          <div className="space-y-4">
            <div className="space-y-3">
              <span className="block text-xs font-semibold text-[var(--foreground)]">
                Choose one option before proceeding to shipping:
              </span>

              {/* Option A: Upload Own Artwork */}
              <div
                onClick={() => {
                  setDesignOption("upload");
                  setErrorMsg(null);
                  if (!designPreview) {
                    document.getElementById("card-design-input")?.click();
                  }
                }}
                className={`p-4 rounded-2xl border transition-all cursor-pointer ${
                  designOption === "upload"
                    ? "border-[var(--primary)] bg-[var(--accent)]/50 ring-1 ring-[var(--primary)]/30 shadow-xs"
                    : "border-[var(--border)] bg-[var(--card)] hover:border-[var(--primary)]/60 hover:bg-[var(--accent)]/30"
                }`}
              >
                <input
                  id="card-design-input"
                  type="file"
                  accept="image/*,.pdf"
                  className="hidden"
                  onChange={handleFileChange}
                />
                
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className="h-10 w-10 rounded-xl bg-[var(--accent)] border border-[var(--border)] flex items-center justify-center text-[var(--foreground)] shrink-0 mt-0.5">
                      <Upload size={18} />
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs font-semibold text-[var(--foreground)]">
                        Upload Your Own Artwork or Logo
                      </p>
                      <p className="text-[11px] text-[var(--muted-foreground)]">
                        High-resolution PNG, JPG, or PDF print file (up to 10MB)
                      </p>
                    </div>
                  </div>

                  {/* Radio selector circle */}
                  <div
                    className={`h-5 w-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-all mt-0.5 ${
                      designOption === "upload"
                        ? "border-[var(--primary)] bg-[var(--primary)] text-[var(--primary-foreground)]"
                        : "border-[var(--border)]"
                    }`}
                  >
                    {designOption === "upload" && <Check size={11} strokeWidth={3} />}
                  </div>
                </div>

                {/* Uploaded File Details / Dropzone Trigger */}
                {designOption === "upload" && (
                  <div className="mt-3 pt-3 border-t border-[var(--border)]">
                    {designPreview ? (
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <img
                            src={designPreview}
                            alt="Card Preview"
                            className="h-12 w-16 object-cover rounded-lg border border-[var(--border)] shadow-xs shrink-0"
                          />
                          <div>
                            <p className="text-xs font-semibold text-[var(--foreground)] truncate max-w-[200px]">
                              {designFile?.name || "Uploaded File"}
                            </p>
                            <p className="font-mono text-[10px] text-emerald-600 font-medium">
                              Ready for production ({(designFile ? (designFile.size / 1024).toFixed(0) : "0")} KB)
                            </p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            document.getElementById("card-design-input")?.click();
                          }}
                          className="text-[11px] font-semibold text-[var(--primary)] hover:underline cursor-pointer"
                        >
                          Change File
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          document.getElementById("card-design-input")?.click();
                        }}
                        className="w-full py-2.5 px-3 rounded-xl border border-dashed border-[var(--border)] hover:border-[var(--primary)] text-center text-xs font-medium text-[var(--foreground)] bg-[var(--background)] cursor-pointer"
                      >
                        Click to select image or PDF from your computer
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Option B: Complimentary Team Assistance */}
              <div
                onClick={() => {
                  setDesignOption("concierge");
                  setDesignFile(null);
                  setDesignPreview(null);
                  setErrorMsg(null);
                }}
                className={`p-4 rounded-2xl border transition-all cursor-pointer ${
                  designOption === "concierge"
                    ? "border-[var(--primary)] bg-[var(--accent)]/50 ring-1 ring-[var(--primary)]/30 shadow-xs"
                    : "border-[var(--border)] bg-[var(--card)] hover:border-[var(--primary)]/60 hover:bg-[var(--accent)]/30"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className="h-10 w-10 rounded-xl bg-[var(--accent)] border border-[var(--border)] flex items-center justify-center text-[var(--foreground)] shrink-0 mt-0.5">
                      <Sparkles size={18} className="text-[var(--primary)]" />
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <p className="text-xs font-semibold text-[var(--foreground)]">
                          Complimentary Design Concierge
                        </p>
                        <span className="font-mono text-[9px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                          FREE
                        </span>
                      </div>
                      <p className="text-[11px] text-[var(--muted-foreground)] leading-relaxed">
                        Don&apos;t have a design ready? Choose this option — our graphic design team will call you to build a custom-branded card layout before manufacturing.
                      </p>
                    </div>
                  </div>

                  {/* Radio selector circle */}
                  <div
                    className={`h-5 w-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-all mt-0.5 ${
                      designOption === "concierge"
                        ? "border-[var(--primary)] bg-[var(--primary)] text-[var(--primary-foreground)]"
                        : "border-[var(--border)]"
                    }`}
                  >
                    {designOption === "concierge" && <Check size={11} strokeWidth={3} />}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={goToStep2}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[var(--primary)] text-[var(--primary-foreground)] font-semibold text-xs shadow-sm hover:opacity-90 active:scale-[0.98] transition-all cursor-pointer"
              >
                <span>Continue to Shipping</span>
                <ArrowRight size={14} />
              </button>
            </div>
          </div>
        )}

        {/* STEP 2: Shipping & Delivery Address */}
        {step === 2 && (
          <div className="space-y-4">
            <label className="flex items-start sm:items-center gap-3 p-3.5 rounded-2xl border border-[var(--border)] bg-[var(--accent)]/40 hover:bg-[var(--accent)]/70 cursor-pointer text-xs transition-colors">
              <input
                type="checkbox"
                checked={sameAsProfile}
                onChange={(e) => {
                  const checked = e.target.checked;
                  setSameAsProfile(checked);
                  if (checked) {
                    setShippingData((prev) => ({
                      ...prev,
                      fullName: profile.owner_name || profile.business_name || prev.fullName,
                      phone: profile.phone || prev.phone,
                      street: profile.address || prev.street,
                    }));
                  }
                }}
                className="mt-0.5 sm:mt-0 h-4 w-4 rounded border-[var(--border)] text-[var(--primary)] focus:ring-[var(--primary)]/30 accent-[var(--primary)]"
              />
              <div className="flex-1 min-w-0">
                <span className="font-semibold text-[var(--foreground)] block">
                  Same as address in profile
                </span>
                <span className="text-[11px] text-[var(--muted-foreground)] block mt-0.5 truncate">
                  {profile.address
                    ? `${profile.address}${profile.phone ? ` • ${profile.phone}` : ""}`
                    : "Auto-fill courier contact and address from your business profile"}
                </span>
              </div>
            </label>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-semibold text-[var(--foreground)] text-[11px] font-mono uppercase tracking-wider">
                    Recipient Full Name
                  </label>
                  <input
                    type="text"
                    value={shippingData.fullName}
                    onChange={(e) => setShippingData({ ...shippingData, fullName: e.target.value })}
                    className="w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-3.5 py-2.5 outline-none focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)]/20 transition-all text-xs"
                    placeholder="Enter recipient name"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-semibold text-[var(--foreground)] text-[11px] font-mono uppercase tracking-wider">
                    Phone (Courier contact)
                  </label>
                  <input
                    type="text"
                    value={shippingData.phone}
                    onChange={(e) => setShippingData({ ...shippingData, phone: e.target.value })}
                    className="w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-3.5 py-2.5 outline-none focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)]/20 transition-all text-xs"
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
                  className="w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-3.5 py-2.5 outline-none focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)]/20 transition-all text-xs"
                  placeholder="Flat/House number, Building, Street, Area"
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
                    className="w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-3.5 py-2.5 outline-none focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)]/20 transition-all text-xs"
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
                    className="w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-3.5 py-2.5 outline-none focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)]/20 transition-all text-xs"
                    placeholder="6-digit PIN code"
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between pt-2">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--accent)] transition-colors cursor-pointer"
              >
                <ArrowLeft size={14} />
                <span>Back</span>
              </button>
              <button
                type="button"
                onClick={goToStep3}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[var(--primary)] text-[var(--primary-foreground)] font-semibold text-xs shadow-sm hover:opacity-90 active:scale-[0.98] transition-all cursor-pointer"
              >
                <span>Review & Pay</span>
                <ArrowRight size={14} />
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: Payment & Summary */}
        {step === 3 && (
          <div className="space-y-4">
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--accent)]/30 p-4 space-y-3">
              <div className="flex items-center justify-between border-b border-[var(--border)] pb-2 text-xs">
                <div>
                  <span className="font-semibold text-[var(--foreground)] block">Pro Membership (1 Year)</span>
                  <span className="text-[11px] text-[var(--muted-foreground)]">Custom vanity profile URL & premium features</span>
                </div>
                <span className="font-mono font-bold text-[var(--foreground)]">Included</span>
              </div>

              <div className="flex items-center justify-between border-b border-[var(--border)] pb-2 text-xs">
                <div>
                  <span className="font-semibold text-[var(--foreground)] block">Custom NFC Physical Card</span>
                  <span className="text-[11px] text-[var(--muted-foreground)]">Tap-to-share contactless business card</span>
                </div>
                <span className="font-mono font-bold text-[var(--foreground)]">Included</span>
              </div>

              <div className="flex items-center justify-between border-b border-[var(--border)] pb-2 text-xs">
                <span className="text-[var(--muted-foreground)]">Design Mode</span>
                <span className="font-medium text-[var(--foreground)]">
                  {designOption === "concierge"
                    ? "Complimentary Design Concierge (Design team will call you)"
                    : `Artwork Uploaded (${designFile?.name || "Custom File"})`}
                </span>
              </div>

              <div className="flex items-center justify-between border-b border-[var(--border)] pb-2 text-xs">
                <span className="text-[var(--muted-foreground)]">Delivery Address</span>
                <span className="font-medium text-[var(--foreground)] truncate max-w-[220px]">
                  {shippingData.city ? `${shippingData.city}, ${shippingData.pincode}` : shippingData.street}
                </span>
              </div>

              <div className="flex items-center justify-between pt-1">
                <div>
                  <span className="font-headline font-bold text-sm text-[var(--foreground)] block">Total Due</span>
                  <span className="text-[10px] text-[var(--muted-foreground)]">All-inclusive • Free doorstep delivery</span>
                </div>
                <div className="text-right">
                  <span className="font-headline text-2xl font-extrabold text-[var(--foreground)]">
                    ₹1,999
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 text-[11px] text-[var(--muted-foreground)]">
              <ShieldCheck size={16} className="text-emerald-500 shrink-0" />
              <span>Secured by Razorpay • 100% Safe & Secure Payment</span>
            </div>

            <div className="flex items-center justify-between pt-2">
              <button
                type="button"
                onClick={() => setStep(2)}
                disabled={loading}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--accent)] transition-colors cursor-pointer"
              >
                <ArrowLeft size={14} />
                <span>Back</span>
              </button>
              <button
                type="button"
                onClick={handleRazorpayPayment}
                disabled={loading}
                className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-[var(--primary)] text-[var(--primary-foreground)] font-semibold text-xs shadow-md hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-50 cursor-pointer"
              >
                {loading ? (
                  <>
                    <Loader2 size={15} className="animate-spin" />
                    <span>Processing Order...</span>
                  </>
                ) : (
                  <>
                    <CreditCard size={15} />
                    <span>Pay ₹1,999 via Razorpay</span>
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
