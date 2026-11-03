"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import QRCode from "qrcode";
import {
  Search,
  Package,
  QrCode,
  Download,
  Copy,
  Check,
  ExternalLink,
  Loader2,
  RefreshCw,
  LogOut,
  Building2,
  Phone,
  Mail,
  MapPin,
  Clock,
  Printer,
  Users,
  ShieldCheck,
  MessageSquare,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { AdminThemeToggle } from "@/admin/shared/ui/AdminThemeToggle";
import { Button } from "@/admin/shared/ui/Button";
import { formatDate } from "@/admin/shared/lib/formatters";
import { fetchAdminCompanies } from "@/admin/entities/company/api/company-api";
import { fetchAdminOrders } from "@/admin/entities/order/api/order-api";
import { CompanyDetailModal } from "@/admin/widgets/company-detail-modal/ui/CompanyDetailModal";
import { buildPublicCardUrl } from "@/admin/shared/lib/card-urls";
import type { Company } from "@/admin/entities/company/model/types";
import type { AdminOrder } from "@/admin/entities/order/model/types";

export type DesignerFilterTab = "production" | "all" | "trial" | "pro" | "free";

function getInitials(name: string): string {
  if (!name) return "NI";
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() || "")
    .join("");
}

// Global in-memory cache for generated thumbnail QR data URLs
const qrThumbCache = new Map<string, string>();

/* ------------------------------------------------------------------ */
/*  Row Component for Browse Companies (Single unified sleek layout)  */
/* ------------------------------------------------------------------ */

interface DesignerCompanyRowProps {
  company: Company;
  onViewDetails: (company: Company) => void;
}

const DesignerCompanyRow: React.FC<DesignerCompanyRowProps> = ({
  company,
  onViewDetails,
}) => {
  const ownerSlug = company.username || company.slug || company.id;
  const cardUrl = buildPublicCardUrl(ownerSlug);
  const dlName = `qr-${(company.username || company.businessName).toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;

  const [qrDataUrl, setQrDataUrl] = useState<string | null>(() => qrThumbCache.get(cardUrl) || null);
  const [isGenerating, setIsGenerating] = useState<boolean>(!qrThumbCache.has(cardUrl));
  const [downloading, setDownloading] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);

  useEffect(() => {
    if (qrThumbCache.has(cardUrl)) {
      setQrDataUrl(qrThumbCache.get(cardUrl)!);
      setIsGenerating(false);
      return;
    }

    let isMounted = true;
    setIsGenerating(true);

    // Fast 120px thumbnail (< 1ms per card)
    QRCode.toDataURL(cardUrl, {
      width: 120,
      margin: 1,
      errorCorrectionLevel: "M",
      color: {
        dark: "#000000",
        light: "#ffffff",
      },
    })
      .then((dataUrl) => {
        qrThumbCache.set(cardUrl, dataUrl);
        if (isMounted) {
          setQrDataUrl(dataUrl);
          setIsGenerating(false);
        }
      })
      .catch((err) => {
        console.error("Failed to generate QR for:", cardUrl, err);
        if (isMounted) setIsGenerating(false);
      });

    return () => {
      isMounted = false;
    };
  }, [cardUrl]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(cardUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy URL:", err);
    }
  };

  const handleDownload = async () => {
    try {
      setDownloading(true);
      // High-res 512x512 with Level H error correction generated strictly on-demand
      const highRes = await QRCode.toDataURL(cardUrl, {
        width: 512,
        margin: 2,
        errorCorrectionLevel: "H",
        color: {
          dark: "#000000",
          light: "#ffffff",
        },
      });
      const a = document.createElement("a");
      a.href = highRes;
      a.download = `${dlName}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (err) {
      console.error("Failed to generate high-res QR for download:", err);
    } finally {
      setDownloading(false);
    }
  };

  const planBadge =
    company.subscriptionPlan === "pro"
      ? { label: "Pro Plan", style: "border-[var(--foreground)]/30 text-[var(--foreground)] font-semibold" }
      : company.subscriptionPlan === "trial"
      ? { label: "Free Trial", style: "border-amber-500/40 text-amber-500 font-semibold" }
      : { label: "Free Tier", style: "border-[var(--border)] text-[var(--muted-foreground)]" };

  return (
    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 p-3.5 rounded-[5px] border border-[var(--border)] bg-[var(--card)] hover:border-[var(--foreground)]/30 transition-all shadow-xs">
      {/* 1. Identity Block */}
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[5px] border border-[var(--border)] bg-[var(--accent)]/50 text-xs font-bold text-[var(--foreground)] overflow-hidden">
          {company.logoUrl ? (
            <img src={company.logoUrl} alt={company.businessName} className="h-full w-full object-cover" />
          ) : (
            <span>{getInitials(company.businessName)}</span>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-xs text-[var(--foreground)] truncate max-w-[200px] sm:max-w-[280px]">
              {company.businessName}
            </span>
            <span className={`font-mono text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded-[4px] border ${planBadge.style}`}>
              {planBadge.label}
            </span>
          </div>
          <p className="font-mono text-[11px] text-[var(--muted-foreground)] truncate mt-0.5">
            Owner: {company.ownerName}
            {company.phoneNumber || company.phone ? ` • ${company.phoneNumber || company.phone}` : ""}
            {company.assignedIdCount ? ` • ${company.assignedIdCount} Team Member${company.assignedIdCount === 1 ? "" : "s"}` : ""}
          </p>
        </div>
      </div>

      {/* 2. Public Card URL Pill */}
      <div className="flex items-center gap-1.5 min-w-0 lg:w-[38%] rounded-[4px] border border-[var(--border)] bg-[var(--background)] px-2.5 py-1.5">
        <span className="font-mono text-[11px] text-[var(--muted-foreground)] truncate flex-1 select-all" title={cardUrl}>
          {cardUrl}
        </span>
        <button
          onClick={handleCopy}
          className="shrink-0 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-[3px] hover:bg-[var(--accent)] text-[10px] font-mono text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors cursor-pointer"
          title="Copy URL"
        >
          {copied ? (
            <>
              <Check size={11} className="text-emerald-500" />
              <span className="text-emerald-500 font-semibold">Copied</span>
            </>
          ) : (
            <>
              <Copy size={11} />
              <span>Copy</span>
            </>
          )}
        </button>
        <a
          href={cardUrl}
          target="_blank"
          rel="noreferrer"
          className="shrink-0 inline-flex items-center justify-center h-5 w-5 rounded-[3px] hover:bg-[var(--accent)] text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors"
          title="Open profile in new tab"
        >
          <ExternalLink size={11} />
        </a>
      </div>

      {/* 3. QR Thumbnail & Production Actions */}
      <div className="flex items-center gap-2 justify-end shrink-0 pt-2 lg:pt-0 border-t lg:border-t-0 border-[var(--border)]">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[4px] bg-white p-0.5 border border-[var(--border)] shadow-2xs">
          {isGenerating ? (
            <Loader2 size={13} className="animate-spin text-neutral-400" />
          ) : qrDataUrl ? (
            <img src={qrDataUrl} alt={`QR ${company.businessName}`} className="h-full w-full object-contain" />
          ) : (
            <QrCode size={16} className="text-neutral-400" />
          )}
        </div>

        <button
          onClick={handleDownload}
          disabled={!qrDataUrl || isGenerating || downloading}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-[5px] border border-[var(--border)] bg-[var(--background)] hover:bg-[var(--accent)] text-xs font-semibold text-[var(--foreground)] transition-colors cursor-pointer disabled:opacity-50"
          title="Download 512x512 High-Res PNG"
        >
          {downloading ? (
            <Loader2 size={13} className="animate-spin text-[var(--foreground)]" />
          ) : (
            <Download size={13} />
          )}
          <span>{downloading ? "Generating..." : "Download QR"}</span>
        </button>

        <button
          onClick={() => onViewDetails(company)}
          className="inline-flex items-center gap-1 px-3 py-2 rounded-[5px] border border-[var(--border)] bg-[var(--card)] hover:bg-[var(--accent)] text-xs font-medium text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors cursor-pointer"
          title="View card assets, team members & design details"
        >
          <span>Assets & Team</span>
          <ExternalLink size={11} />
        </button>
      </div>
    </div>
  );
};

/* ------------------------------------------------------------------ */
/*  Order Card Component for In Production Queue                      */
/* ------------------------------------------------------------------ */

interface InProductionOrderCardProps {
  order: AdminOrder;
  company?: Company;
  onViewCompany: (company: Company) => void;
}

const InProductionOrderCard: React.FC<InProductionOrderCardProps> = ({
  order,
  company,
  onViewCompany,
}) => {
  const ownerSlug = company?.username || company?.slug || company?.id || order.profileId;
  const cardUrl = buildPublicCardUrl(ownerSlug);
  const dlName = `qr-${(company?.username || order.businessName).toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
  const cardDetails = order.cardDetails || order.shippingAddress?.cardDetails;
  const finalDesignUrl = order.designUrl || cardDetails?.fileUrl;

  const [qrDataUrl, setQrDataUrl] = useState<string | null>(() => qrThumbCache.get(cardUrl) || null);
  const [isGenerating, setIsGenerating] = useState<boolean>(!qrThumbCache.has(cardUrl));
  const [downloading, setDownloading] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);

  const phoneRaw = order.phone || cardDetails?.contactNumber || company?.phoneNumber || company?.phone;
  const cleanPhone = phoneRaw ? phoneRaw.replace(/[^0-9]/g, "") : "";
  const waLink = cleanPhone ? `https://wa.me/91${cleanPhone.slice(-10)}` : null;

  useEffect(() => {
    if (qrThumbCache.has(cardUrl)) {
      setQrDataUrl(qrThumbCache.get(cardUrl)!);
      setIsGenerating(false);
      return;
    }

    let isMounted = true;
    setIsGenerating(true);

    // Fast 120px thumbnail (< 1ms)
    QRCode.toDataURL(cardUrl, {
      width: 120,
      margin: 1,
      errorCorrectionLevel: "M",
      color: {
        dark: "#000000",
        light: "#ffffff",
      },
    })
      .then((dataUrl) => {
        qrThumbCache.set(cardUrl, dataUrl);
        if (isMounted) {
          setQrDataUrl(dataUrl);
          setIsGenerating(false);
        }
      })
      .catch((err) => {
        console.error("Failed to generate QR for order:", cardUrl, err);
        if (isMounted) setIsGenerating(false);
      });

    return () => {
      isMounted = false;
    };
  }, [cardUrl]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(cardUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy URL:", err);
    }
  };

  const handleDownload = async () => {
    try {
      setDownloading(true);
      // High-res 512x512 with Level H error correction generated strictly on-demand
      const highRes = await QRCode.toDataURL(cardUrl, {
        width: 512,
        margin: 2,
        errorCorrectionLevel: "H",
        color: {
          dark: "#000000",
          light: "#ffffff",
        },
      });
      const a = document.createElement("a");
      a.href = highRes;
      a.download = `${dlName}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (err) {
      console.error("Failed to generate high-res QR for download:", err);
    } finally {
      setDownloading(false);
    }
  };

  const isTeamOrder = order.orderType === "team_addon" || (order.cardQuantity && order.cardQuantity > 1);

  return (
    <div className="rounded-[5px] border border-[var(--border)] bg-[var(--card)] p-4 sm:p-5 space-y-4 shadow-xs">
      {/* 1. Header Bar: Order Identity & Meta */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[var(--border)] pb-3.5">
        <div className="space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h4 className="font-headline text-sm font-bold text-[var(--foreground)]">
              {order.businessName}
            </h4>
            <span className="font-mono text-[9px] uppercase px-2 py-0.5 rounded-[4px] border border-[var(--border)] bg-[var(--accent)] font-semibold text-[var(--foreground)]">
              IN PRODUCTION
            </span>
            <span className="font-mono text-[11px] text-[var(--muted-foreground)]">
              Order #{order.id.slice(0, 8).toUpperCase()}
            </span>
            <span className="font-mono text-[10px] text-[var(--muted-foreground)]">
              • Placed on {formatDate(order.createdAt)}
            </span>
          </div>

          <div className="flex items-center gap-3 text-xs text-[var(--muted-foreground)] flex-wrap">
            <span>Customer: <strong className="text-[var(--foreground)] font-medium">{order.ownerName}</strong></span>
            {order.email && <span>• {order.email}</span>}
            {phoneRaw && (
              <span className="flex items-center gap-1.5 font-mono">
                • {phoneRaw}
                {waLink && (
                  <a
                    href={waLink}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-[3px] border border-[var(--border)] bg-[var(--background)] hover:bg-[var(--accent)] text-[10px] font-sans text-emerald-500 font-semibold transition-colors"
                    title="Verify artwork with customer on WhatsApp"
                  >
                    <MessageSquare size={10} />
                    <span>WhatsApp</span>
                  </a>
                )}
              </span>
            )}
          </div>
        </div>

        {/* Right side: Order Type & View Details */}
        <div className="flex items-center gap-2 shrink-0">
          <span className="font-mono text-xs px-2 py-1 rounded-[4px] border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] font-semibold">
            {isTeamOrder ? `Team Cards (${order.cardQuantity} Cards)` : "Pro NFC Card (1 Card)"}
          </span>

          {company && (
            <button
              onClick={() => onViewCompany(company)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[5px] border border-[var(--border)] bg-[var(--background)] hover:bg-[var(--accent)] text-xs text-[var(--foreground)] font-medium transition-colors cursor-pointer"
            >
              <span>Full Profile</span>
              <ExternalLink size={11} />
            </button>
          )}
        </div>
      </div>

      {/* 2. Main Two-Column Production Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Left Column: Customer Design Asset / Artwork Specifications */}
        <div className="rounded-[5px] border border-[var(--border)] bg-[var(--background)] p-4 space-y-3">
          <div className="flex items-center justify-between border-b border-[var(--border)] pb-2">
            <span className="font-mono text-[10px] uppercase tracking-wider text-[var(--muted-foreground)] font-semibold block">
              Customer Artwork & Engraving Specs
            </span>
            {finalDesignUrl && (
              <span className="font-mono text-[10px] text-emerald-500 font-semibold">
                Uploaded Asset Available
              </span>
            )}
          </div>

          {finalDesignUrl ? (
            <div className="flex items-start gap-3.5">
              <a
                href={finalDesignUrl}
                target="_blank"
                rel="noreferrer"
                className="block h-20 w-32 shrink-0 rounded-[4px] border border-[var(--border)] overflow-hidden bg-white/5 hover:opacity-90 transition-opacity"
                title="Click to view full size artwork"
              >
                <img
                  src={finalDesignUrl}
                  alt="Customer Card Artwork"
                  className="h-full w-full object-cover"
                />
              </a>
              <div className="space-y-2 flex-1 min-w-0">
                <p className="text-xs text-[var(--foreground)] font-medium">
                  Customer uploaded visiting card design.
                </p>
                <p className="text-[11px] text-[var(--muted-foreground)] leading-snug">
                  Use for physical card UV printing or laser engraving alignment.
                </p>
                <a
                  href={finalDesignUrl}
                  target="_blank"
                  download
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[4px] border border-[var(--border)] bg-[var(--card)] hover:bg-[var(--accent)] text-xs font-semibold text-[var(--foreground)] transition-colors cursor-pointer"
                >
                  <Download size={12} />
                  <span>Download Artwork File</span>
                </a>
              </div>
            </div>
          ) : cardDetails ? (
            <div className="space-y-2.5 text-xs">
              <div className="grid grid-cols-2 gap-2 text-xs">
                {cardDetails.companyName && (
                  <div>
                    <span className="text-[10px] text-[var(--muted-foreground)] uppercase font-mono block">Company Name</span>
                    <span className="font-medium text-[var(--foreground)]">{cardDetails.companyName}</span>
                  </div>
                )}
                {cardDetails.ownerName && (
                  <div>
                    <span className="text-[10px] text-[var(--muted-foreground)] uppercase font-mono block">Cardholder Name</span>
                    <span className="font-medium text-[var(--foreground)]">{cardDetails.ownerName}</span>
                  </div>
                )}
                {cardDetails.contactNumber && (
                  <div>
                    <span className="text-[10px] text-[var(--muted-foreground)] uppercase font-mono block">Contact Phone</span>
                    <span className="font-mono font-medium text-[var(--foreground)]">{cardDetails.contactNumber}</span>
                  </div>
                )}
                {cardDetails.companyAddress && (
                  <div>
                    <span className="text-[10px] text-[var(--muted-foreground)] uppercase font-mono block">Address</span>
                    <span className="text-[11px] text-[var(--foreground)] line-clamp-1">{cardDetails.companyAddress}</span>
                  </div>
                )}
              </div>

              {cardDetails.designNotes && (
                <div className="rounded-[4px] border border-[var(--border)] bg-[var(--card)] p-2.5">
                  <span className="text-[10px] text-[var(--muted-foreground)] uppercase font-mono block">Customer Instructions</span>
                  <p className="text-xs text-[var(--foreground)] italic mt-0.5 leading-relaxed">&ldquo;{cardDetails.designNotes}&rdquo;</p>
                </div>
              )}

              {cardDetails.logoUrl && (
                <div className="flex items-center justify-between pt-2 border-t border-[var(--border)]">
                  <div className="flex items-center gap-2">
                    <img
                      src={cardDetails.logoUrl}
                      alt="Logo"
                      className="h-8 w-8 rounded-[4px] object-cover border border-[var(--border)]"
                    />
                    <span className="text-xs text-[var(--muted-foreground)]">High-Res Brand Logo</span>
                  </div>
                  <a
                    href={cardDetails.logoUrl}
                    target="_blank"
                    download
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-[4px] border border-[var(--border)] bg-[var(--card)] hover:bg-[var(--accent)] text-xs font-medium text-[var(--foreground)]"
                  >
                    <Download size={11} />
                    <span>Download Logo</span>
                  </a>
                </div>
              )}
            </div>
          ) : (
            <div className="p-4 text-xs text-[var(--muted-foreground)] rounded-[4px] border border-dashed border-[var(--border)] text-center">
              No custom artwork file uploaded. Use company name, logo & details from verified profile.
            </div>
          )}

          {/* Shipping destination quick reference */}
          {order.shippingAddress && (order.shippingAddress.city || order.shippingAddress.state) && (
            <div className="pt-2 border-t border-[var(--border)] flex items-center gap-1.5 text-[11px] text-[var(--muted-foreground)]">
              <MapPin size={12} className="shrink-0" />
              <span>
                Ship to: {order.shippingAddress.fullName || order.ownerName} • {order.shippingAddress.city}, {order.shippingAddress.state} {order.shippingAddress.pincode ? `(${order.shippingAddress.pincode})` : ""}
              </span>
            </div>
          )}
        </div>

        {/* Right Column: Print-Ready QR Code & Link Verification */}
        <div className="rounded-[5px] border border-[var(--border)] bg-[var(--background)] p-4 flex flex-col justify-between space-y-3">
          <div>
            <div className="flex items-center justify-between border-b border-[var(--border)] pb-2">
              <span className="font-mono text-[10px] uppercase tracking-wider text-[var(--muted-foreground)] font-semibold block">
                NFC Smart Card QR Target (512x512 PNG)
              </span>
              <span className="font-mono text-[10px] text-[var(--muted-foreground)]">
                Error Correction: Level H
              </span>
            </div>

            <div className="flex items-center gap-4 mt-3">
              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-[5px] bg-white p-1 border border-[var(--border)] shadow-xs">
                {isGenerating ? (
                  <Loader2 size={16} className="animate-spin text-neutral-400" />
                ) : qrDataUrl ? (
                  <img src={qrDataUrl} alt={`QR code for ${order.businessName}`} className="h-full w-full object-contain" />
                ) : (
                  <QrCode size={22} className="text-neutral-400" />
                )}
              </div>

              <div className="space-y-1.5 min-w-0 flex-1">
                <span className="text-xs font-semibold text-[var(--foreground)] block">
                  Primary Card Print Asset
                </span>
                <div className="flex items-center gap-1.5 rounded-[4px] border border-[var(--border)] bg-[var(--card)] px-2.5 py-1">
                  <span className="font-mono text-[11px] text-[var(--muted-foreground)] truncate flex-1 select-all" title={cardUrl}>
                    {cardUrl}
                  </span>
                  <button
                    onClick={handleCopy}
                    className="shrink-0 inline-flex items-center gap-1 text-[10px] font-mono text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
                  >
                    {copied ? <Check size={11} className="text-emerald-500" /> : <Copy size={11} />}
                  </button>
                  <a
                    href={cardUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="shrink-0 text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
                  >
                    <ExternalLink size={11} />
                  </a>
                </div>
              </div>
            </div>
          </div>

          <div className="pt-3 border-t border-[var(--border)] flex items-center gap-2">
            <button
              onClick={handleDownload}
              disabled={!qrDataUrl || isGenerating || downloading}
              className="flex-1 inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-[5px] bg-[var(--foreground)] text-[var(--background)] text-xs font-semibold hover:opacity-90 active:scale-[0.98] transition-all cursor-pointer disabled:opacity-50"
            >
              {downloading ? (
                <Loader2 size={13} className="animate-spin text-[var(--background)]" />
              ) : (
                <Download size={13} />
              )}
              <span>{downloading ? "Generating Print QR..." : "Download High-Res Print QR"}</span>
            </button>

            {isTeamOrder && company && (
              <button
                onClick={() => onViewCompany(company)}
                className="inline-flex items-center gap-1.5 py-2.5 px-3 rounded-[5px] border border-[var(--border)] bg-[var(--card)] hover:bg-[var(--accent)] text-xs font-medium text-[var(--foreground)] transition-colors cursor-pointer shrink-0"
                title="View and download individual high-res QR codes for each team member"
              >
                <Users size={13} />
                <span>Team QRs ({order.cardQuantity})</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

/* ------------------------------------------------------------------ */
/*  Main Designer Dashboard View Component                            */
/* ------------------------------------------------------------------ */

export const DesignerDashboardView: React.FC = () => {
  const router = useRouter();
  const [userEmail, setUserEmail] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<DesignerFilterTab>("production");
  const [search, setSearch] = useState<string>("");

  // Data
  const [companies, setCompanies] = useState<Company[]>([]);
  const [orders, setOrders] = useState<AdminOrder[]>([]);

  // Selected company modal in read-only mode
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  const loadAllData = useCallback(async (opts?: boolean | { silent?: boolean; forceRefresh?: boolean }) => {
    const forceRefresh = typeof opts === "boolean" ? opts : Boolean(opts?.forceRefresh);
    const silent = typeof opts === "object" ? Boolean(opts?.silent) : false;
    if (!silent) setLoading(true);
    try {
      const [compRes, ordRes] = await Promise.all([
        fetchAdminCompanies(forceRefresh),
        fetchAdminOrders(forceRefresh),
      ]);
      setCompanies(compRes.companies || []);
      setOrders(ordRes.orders || []);
    } catch (err) {
      console.error("[Designer] Failed to load assets:", err);
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user?.email) setUserEmail(user.email);
    });
    loadAllData();
  }, [loadAllData]);

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    const isSubdomain =
      typeof window !== "undefined" &&
      (window.location.hostname.startsWith("admin.") ||
        window.location.hostname.startsWith("admin.localhost"));
    router.replace(isSubdomain ? "/login" : "/admin/login");
  };

  // Orders in Production ("on_work")
  const inProductionOrders = useMemo(() => {
    return orders.filter((o) => {
      if (o.status !== "on_work") return false;
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return (
        o.businessName?.toLowerCase().includes(q) ||
        o.ownerName?.toLowerCase().includes(q) ||
        o.id.toLowerCase().includes(q) ||
        (o.phone && o.phone.includes(q))
      );
    });
  }, [orders, search]);

  // Filtered companies based on active tab
  const filteredCompanies = useMemo(() => {
    return companies.filter((c) => {
      if (search.trim()) {
        const q = search.toLowerCase();
        const matchesName = c.businessName?.toLowerCase().includes(q);
        const matchesOwner = c.ownerName?.toLowerCase().includes(q);
        const matchesEmail = c.email?.toLowerCase().includes(q);
        const matchesUsername = c.username?.toLowerCase().includes(q);
        if (!matchesName && !matchesOwner && !matchesEmail && !matchesUsername) {
          return false;
        }
      }

      if (activeTab === "trial") {
        return c.subscriptionPlan === "trial";
      }
      if (activeTab === "pro") {
        return c.subscriptionPlan === "pro";
      }
      if (activeTab === "free") {
        return c.subscriptionPlan === "free";
      }
      return true; // "all"
    });
  }, [companies, activeTab, search]);

  // Aggregate stats
  const onWorkOrdersCount = useMemo(() => orders.filter((o) => o.status === "on_work").length, [orders]);
  const proCount = useMemo(() => companies.filter((c) => c.subscriptionPlan === "pro").length, [companies]);
  const trialCount = useMemo(() => companies.filter((c) => c.subscriptionPlan === "trial").length, [companies]);
  const freeCount = useMemo(() => companies.filter((c) => c.subscriptionPlan === "free").length, [companies]);

  return (
    <div className="flex min-h-screen flex-col bg-[var(--background)] text-[var(--foreground)]">
      {/* 1. Sleek Studio Header */}
      <header className="sticky top-0 z-30 border-b border-[var(--border)] bg-[var(--card)]/95 backdrop-blur-md px-5 py-3.5">
        <div className="flex items-center justify-between gap-4 max-w-7xl mx-auto w-full">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-[5px] bg-[var(--foreground)] text-[var(--background)]">
              <Printer size={15} strokeWidth={2.2} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-headline text-sm font-bold tracking-tight text-[var(--foreground)]">
                  Designer Studio
                </h1>
              </div>
              <p className="text-[11px] text-[var(--muted-foreground)] leading-none mt-0.5">
                Print asset downloads, physical card engraving specs, and QR targets
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-[5px] border border-[var(--border)] bg-[var(--background)] text-xs">
              <ShieldCheck size={12} className="text-emerald-500" />
              <span className="font-mono text-[11px] text-[var(--muted-foreground)]">
                {userEmail || "Designer Operator"}
              </span>
            </div>
            <AdminThemeToggle />
            <button
              onClick={handleSignOut}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[5px] border border-[var(--border)] bg-[var(--background)] hover:bg-[var(--accent)] text-xs text-[var(--muted-foreground)] hover:text-rose-500 transition-colors cursor-pointer"
              title="Sign Out"
            >
              <LogOut size={13} />
              <span className="hidden sm:inline">Sign Out</span>
            </button>
          </div>
        </div>
      </header>

      {/* 2. Main Studio Workspace */}
      <main className="flex-1 p-5 sm:p-6 max-w-7xl w-full mx-auto space-y-5">
        {/* Quick Metric Strip */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div
            onClick={() => setActiveTab("production")}
            className={`p-3.5 rounded-[5px] border transition-all cursor-pointer ${
              activeTab === "production"
                ? "border-[var(--foreground)] bg-[var(--accent)]/40 shadow-xs"
                : "border-[var(--border)] bg-[var(--card)] hover:border-[var(--foreground)]/30"
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="font-mono text-[10px] uppercase tracking-wider text-[var(--muted-foreground)] font-semibold">
                In Production Queue
              </span>
              <Package size={14} className="text-[var(--muted-foreground)]" />
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="font-headline text-2xl font-bold text-[var(--foreground)] leading-none">
                {onWorkOrdersCount}
              </span>
              <span className="font-mono text-[10px] text-[var(--muted-foreground)]">
                {onWorkOrdersCount === 1 ? "Active Order" : "Active Orders"}
              </span>
            </div>
          </div>

          <div
            onClick={() => setActiveTab("pro")}
            className={`p-3.5 rounded-[5px] border transition-all cursor-pointer ${
              activeTab === "pro"
                ? "border-[var(--foreground)] bg-[var(--accent)]/40 shadow-xs"
                : "border-[var(--border)] bg-[var(--card)] hover:border-[var(--foreground)]/30"
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="font-mono text-[10px] uppercase tracking-wider text-[var(--muted-foreground)] font-semibold">
                Pro Plan Accounts
              </span>
              <QrCode size={14} className="text-[var(--muted-foreground)]" />
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="font-headline text-2xl font-bold text-[var(--foreground)] leading-none">
                {proCount}
              </span>
              <span className="font-mono text-[10px] text-[var(--muted-foreground)]">
                Verified Cards
              </span>
            </div>
          </div>

          <div
            onClick={() => setActiveTab("trial")}
            className={`p-3.5 rounded-[5px] border transition-all cursor-pointer ${
              activeTab === "trial"
                ? "border-[var(--foreground)] bg-[var(--accent)]/40 shadow-xs"
                : "border-[var(--border)] bg-[var(--card)] hover:border-[var(--foreground)]/30"
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="font-mono text-[10px] uppercase tracking-wider text-[var(--muted-foreground)] font-semibold">
                100-Day Free Trials
              </span>
              <Clock size={14} className="text-[var(--muted-foreground)]" />
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="font-headline text-2xl font-bold text-[var(--foreground)] leading-none">
                {trialCount}
              </span>
              <span className="font-mono text-[10px] text-[var(--muted-foreground)]">
                Active Digital Cards
              </span>
            </div>
          </div>
        </div>

        {/* Filter Navigation & Search Bar */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-[var(--border)] pb-4">
          {/* Tabs with crisp micro counters */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
            <button
              onClick={() => setActiveTab("production")}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-[5px] text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                activeTab === "production"
                  ? "bg-[var(--foreground)] text-[var(--background)] shadow-xs"
                  : "border border-[var(--border)] bg-[var(--card)] text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
              }`}
            >
              <Package size={13} />
              <span>In Production</span>
              <span className={`font-mono text-[10px] px-1.5 py-0.2 rounded-[3px] ${
                activeTab === "production" ? "bg-[var(--background)] text-[var(--foreground)] font-bold" : "bg-[var(--accent)] text-[var(--muted-foreground)]"
              }`}>
                {onWorkOrdersCount}
              </span>
            </button>

            <button
              onClick={() => setActiveTab("all")}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-[5px] text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                activeTab === "all"
                  ? "bg-[var(--foreground)] text-[var(--background)] shadow-xs"
                  : "border border-[var(--border)] bg-[var(--card)] text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
              }`}
            >
              <span>All Accounts</span>
              <span className={`font-mono text-[10px] px-1.5 py-0.2 rounded-[3px] ${
                activeTab === "all" ? "bg-[var(--background)] text-[var(--foreground)] font-bold" : "bg-[var(--accent)] text-[var(--muted-foreground)]"
              }`}>
                {companies.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab("pro")}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-[5px] text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                activeTab === "pro"
                  ? "bg-[var(--foreground)] text-[var(--background)] shadow-xs"
                  : "border border-[var(--border)] bg-[var(--card)] text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
              }`}
            >
              <span>Pro Plan</span>
              <span className={`font-mono text-[10px] px-1.5 py-0.2 rounded-[3px] ${
                activeTab === "pro" ? "bg-[var(--background)] text-[var(--foreground)] font-bold" : "bg-[var(--accent)] text-[var(--muted-foreground)]"
              }`}>
                {proCount}
              </span>
            </button>

            <button
              onClick={() => setActiveTab("trial")}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-[5px] text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                activeTab === "trial"
                  ? "bg-[var(--foreground)] text-[var(--background)] shadow-xs"
                  : "border border-[var(--border)] bg-[var(--card)] text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
              }`}
            >
              <span>Free Trial</span>
              <span className={`font-mono text-[10px] px-1.5 py-0.2 rounded-[3px] ${
                activeTab === "trial" ? "bg-[var(--background)] text-[var(--foreground)] font-bold" : "bg-[var(--accent)] text-[var(--muted-foreground)]"
              }`}>
                {trialCount}
              </span>
            </button>

            <button
              onClick={() => setActiveTab("free")}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-[5px] text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                activeTab === "free"
                  ? "bg-[var(--foreground)] text-[var(--background)] shadow-xs"
                  : "border border-[var(--border)] bg-[var(--card)] text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
              }`}
            >
              <span>Free Tier</span>
              <span className={`font-mono text-[10px] px-1.5 py-0.2 rounded-[3px] ${
                activeTab === "free" ? "bg-[var(--background)] text-[var(--foreground)] font-bold" : "bg-[var(--accent)] text-[var(--muted-foreground)]"
              }`}>
                {freeCount}
              </span>
            </button>
          </div>

          {/* Search bar & Refresh */}
          <div className="flex items-center gap-2">
            <div className="relative min-w-[260px]">
              <Search
                size={13}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)]"
              />
              <input
                type="text"
                placeholder="Search business, owner, order, or slug..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-[5px] border border-[var(--border)] bg-[var(--card)] pl-9 pr-3 py-1.5 text-xs text-[var(--foreground)] outline-none focus:border-[var(--foreground)] transition-colors"
              />
            </div>

            <Button variant="secondary" size="sm" onClick={() => loadAllData(true)} disabled={loading} title="Reload Assets">
              <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
            </Button>
          </div>
        </div>

        {/* View Mode 1: In Production Orders */}
        {activeTab === "production" ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-headline text-sm font-bold text-[var(--foreground)]">
                  Active Production Orders
                </h3>
                <p className="text-xs text-[var(--muted-foreground)] mt-0.5">
                  Print orders approved and moved to production. Download artwork files, logos, and high-resolution QR codes.
                </p>
              </div>
              <span className="font-mono text-xs text-[var(--muted-foreground)]">
                Showing {inProductionOrders.length} {inProductionOrders.length === 1 ? "order" : "orders"}
              </span>
            </div>

            {loading ? (
              <div className="p-14 text-center text-xs text-[var(--muted-foreground)] rounded-[5px] border border-[var(--border)] bg-[var(--card)]">
                <Loader2 size={18} className="animate-spin inline-block mr-2" />
                Loading production queue...
              </div>
            ) : inProductionOrders.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-[5px] border border-dashed border-[var(--border)] bg-[var(--card)] py-16 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-[5px] bg-[var(--accent)] text-[var(--muted-foreground)] mb-3">
                  <Package size={22} />
                </div>
                <h4 className="font-headline text-sm font-semibold text-[var(--foreground)]">
                  No Orders Currently in Production
                </h4>
                <p className="text-xs text-[var(--muted-foreground)] mt-1 max-w-sm">
                  Orders marked as <strong>In Production</strong> in the Orders panel will appear here with customer artwork and print targets.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4">
                {inProductionOrders.map((order) => {
                  const company = companies.find((c) => c.id === order.profileId);
                  return (
                    <InProductionOrderCard
                      key={order.id}
                      order={order}
                      company={company}
                      onViewCompany={(c) => {
                        setSelectedCompany(c);
                        setIsDetailOpen(true);
                      }}
                    />
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          /* View Mode 2: Browse Companies */
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-headline text-sm font-bold text-[var(--foreground)]">
                  {activeTab === "all"
                    ? "All Registered Accounts & QR Codes"
                    : activeTab === "pro"
                    ? "Pro Plan Digital Cards"
                    : activeTab === "trial"
                    ? "100-Day Free Trial Digital Cards"
                    : "Free Tier Digital Cards"}
                </h3>
                <p className="text-xs text-[var(--muted-foreground)] mt-0.5">
                  Inspect public card URLs and download 512x512 high-resolution QR codes for physical card printing.
                </p>
              </div>
              <span className="font-mono text-xs text-[var(--muted-foreground)]">
                Showing {filteredCompanies.length} accounts
              </span>
            </div>

            {loading ? (
              <div className="p-14 text-center text-xs text-[var(--muted-foreground)] rounded-[5px] border border-[var(--border)] bg-[var(--card)]">
                <Loader2 size={18} className="animate-spin inline-block mr-2" />
                Loading accounts...
              </div>
            ) : filteredCompanies.length === 0 ? (
              <div className="p-12 text-center text-xs text-[var(--muted-foreground)] rounded-[5px] border border-dashed border-[var(--border)] bg-[var(--card)]">
                No accounts match the current filter.
              </div>
            ) : (
              <div className="space-y-2.5">
                {filteredCompanies.map((company) => (
                  <DesignerCompanyRow
                    key={company.id}
                    company={company}
                    onViewDetails={(c) => {
                      setSelectedCompany(c);
                      setIsDetailOpen(true);
                    }}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      {/* Read-Only Company Details Modal for Designer */}
      {selectedCompany && (
        <CompanyDetailModal
          company={selectedCompany}
          isOpen={isDetailOpen}
          onClose={() => {
            setIsDetailOpen(false);
            setSelectedCompany(null);
          }}
          onRefresh={loadAllData}
          readOnly={true}
        />
      )}
    </div>
  );
};
