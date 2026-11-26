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
  MapPin,
  Printer,
  Users,
  CheckCircle2,
  Truck,
  FileText,
  Image as ImageIcon,
  ChevronRight,
  ArrowLeft,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { AdminThemeToggle } from "@/admin/shared/ui/AdminThemeToggle";
import { Button } from "@/admin/shared/ui/Button";
import { Modal } from "@/admin/shared/ui/Modal";
import { formatDate } from "@/admin/shared/lib/formatters";
import { fetchAdminCompanies } from "@/admin/entities/company/api/company-api";
import { CompanyDetailModal } from "@/admin/widgets/company-detail-modal/ui/CompanyDetailModal";
import { StaffNotificationsBell } from "@/admin/widgets/notifications/ui/StaffNotificationsBell";
import { buildPublicCardUrl } from "@/admin/shared/lib/card-urls";
import type { Company } from "@/admin/entities/company/model/types";
import type { FulfillmentStage } from "@/lib/fulfillment/state-machine";

export type DesignerSidebarTab =
  | "production"
  | "employee_ids"
  | "directory";

export type DesignerStageFilter =
  | "sent_to_designer"
  | "printed_ready"
  | "posted"
  | "delivered"
  | "all";

export interface FulfillmentItemDTO {
  id: string;
  jobId: string;
  profileId: string;
  targetType: "primary" | "employee" | "branch";
  employeeId?: string | null;
  branchId?: string | null;
  displayName: string;
  designation?: string | null;
  phone?: string | null;
  photoUrl?: string | null;
  publicCardUrl: string;
  designMode: "company_template" | "custom_upload" | "team_assist";
  designFileUrl?: string | null;
  designNotes?: string | null;
  isPrinted: boolean;
}

export interface FulfillmentJobDTO {
  id: string;
  profileId: string;
  orderId?: string | null;
  jobType: "pro_initial" | "free_trial" | "team_addon" | "primary_addon" | "reprint";
  stage: FulfillmentStage;
  cardQuantity: number;
  masterTemplateUrl?: string | null;
  designNotes?: string | null;
  shippingAddress?: Record<string, any>;
  courierName?: string | null;
  trackingNumber?: string | null;
  lastUpdatedByRole?: string | null;
  lastUpdatedByName?: string | null;
  createdAt: string;
  updatedAt: string;
  isSyntheticTrial?: boolean;
  company?: {
    id: string;
    businessName: string;
    ownerName: string;
    phone?: string | null;
    email?: string | null;
    username?: string | null;
    slug?: string | null;
    subscriptionPlan?: string;
    logoUrl?: string | null;
    defaultCardTemplateUrl?: string | null;
  } | null;
  items: FulfillmentItemDTO[];
}

const qrThumbCache = new Map<string, string>();

function getInitials(name: string): string {
  if (!name) return "NI";
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() || "")
    .join("");
}

function useQrThumbnail(url: string) {
  const [dataUrl, setDataUrl] = useState<string | null>(() => qrThumbCache.get(url) || null);
  const [generating, setGenerating] = useState<boolean>(!qrThumbCache.has(url));

  useEffect(() => {
    if (!url) return;
    if (qrThumbCache.has(url)) {
      setDataUrl(qrThumbCache.get(url)!);
      setGenerating(false);
      return;
    }
    let mounted = true;
    setGenerating(true);
    QRCode.toDataURL(url, {
      width: 120,
      margin: 1,
      errorCorrectionLevel: "M",
      color: { dark: "#000000", light: "#ffffff" },
    })
      .then((res) => {
        qrThumbCache.set(url, res);
        if (mounted) {
          setDataUrl(res);
          setGenerating(false);
        }
      })
      .catch(() => {
        if (mounted) setGenerating(false);
      });
    return () => {
      mounted = false;
    };
  }, [url]);

  return { dataUrl, generating };
}

async function downloadHighResQr(url: string, filename: string) {
  const highRes = await QRCode.toDataURL(url, {
    width: 512,
    margin: 2,
    errorCorrectionLevel: "H",
    color: { dark: "#000000", light: "#ffffff" },
  });
  const a = document.createElement("a");
  a.href = highRes;
  a.download = `${filename}.png`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

/* ------------------------------------------------------------------ */
/*  Reusable QR & URL Action Row for Employee/Branch Print Items      */
/* ------------------------------------------------------------------ */

const PrintItemCard: React.FC<{
  item: FulfillmentItemDTO;
  masterTemplateUrl?: string | null;
  companySlug: string;
}> = ({ item, masterTemplateUrl, companySlug }) => {
  const { dataUrl, generating } = useQrThumbnail(item.publicCardUrl);
  const [copied, setCopied] = useState(false);
  const [downloadingQr, setDownloadingQr] = useState(false);

  const effectiveDesignUrl =
    item.designMode === "custom_upload"
      ? item.designFileUrl
      : item.designMode === "company_template"
      ? item.designFileUrl || masterTemplateUrl
      : null;

  const dlName = `qr-${companySlug}-${item.displayName}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-");

  return (
    <div className="rounded-[5px] border border-[var(--border)] bg-[var(--background)] p-3.5 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
      {/* Identity + Photo Download */}
      <div className="flex items-start gap-3 min-w-0 flex-1">
        <div className="relative h-11 w-11 shrink-0 rounded-[5px] border border-[var(--border)] bg-[var(--accent)] overflow-hidden flex items-center justify-center text-xs font-bold text-[var(--foreground)]">
          {item.photoUrl ? (
            <img src={item.photoUrl} alt={item.displayName} className="h-full w-full object-cover" />
          ) : (
            <span>{getInitials(item.displayName)}</span>
          )}
        </div>
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs font-semibold text-[var(--foreground)] truncate">
              {item.displayName}
            </span>
            <span className="rounded-[4px] border border-[var(--border)] bg-[var(--card)] px-1.5 py-0.5 font-mono text-[9px] uppercase text-[var(--muted-foreground)]">
              {item.targetType}
            </span>
            <span className="rounded-[4px] border border-[var(--border)] bg-[var(--accent)] px-1.5 py-0.5 font-mono text-[9px] text-[var(--foreground)]">
              {item.designMode === "company_template"
                ? "Company Template"
                : item.designMode === "custom_upload"
                ? "Custom Upload"
                : "Team Design"}
            </span>
          </div>
          <p className="text-[11px] text-[var(--muted-foreground)] truncate">
            {item.designation || "Card Holder"}
            {item.phone ? ` • ${item.phone}` : ""}
          </p>
          {item.designNotes && (
            <p className="text-[11px] text-[var(--foreground)] italic">
              Note: &ldquo;{item.designNotes}&rdquo;
            </p>
          )}

          {/* Asset Downloads */}
          <div className="flex flex-wrap items-center gap-2 pt-1">
            {item.photoUrl && (
              <a
                href={item.photoUrl}
                target="_blank"
                rel="noreferrer"
                download
                className="inline-flex items-center gap-1 rounded-[4px] border border-[var(--border)] bg-[var(--card)] hover:bg-[var(--accent)] px-2 py-1 text-[10px] font-medium text-[var(--foreground)]"
              >
                <ImageIcon size={11} />
                <span>Photo</span>
                <Download size={10} />
              </a>
            )}
            {effectiveDesignUrl && (
              <a
                href={effectiveDesignUrl}
                target="_blank"
                rel="noreferrer"
                download
                className="inline-flex items-center gap-1 rounded-[4px] border border-[var(--border)] bg-[var(--card)] hover:bg-[var(--accent)] px-2 py-1 text-[10px] font-medium text-[var(--foreground)]"
              >
                <FileText size={11} />
                <span>{item.designMode === "custom_upload" ? "Custom Artwork" : "Master Template"}</span>
                <Download size={10} />
              </a>
            )}
          </div>
        </div>
      </div>

      {/* URL + 512px QR */}
      <div className="flex flex-wrap sm:flex-nowrap items-center gap-2.5 shrink-0">
        <div className="flex items-center gap-1.5 rounded-[4px] border border-[var(--border)] bg-[var(--card)] px-2.5 py-1.5 max-w-[260px]">
          <span className="font-mono text-[10px] text-[var(--muted-foreground)] truncate select-all">
            {item.publicCardUrl}
          </span>
          <button
            type="button"
            onClick={async () => {
              await navigator.clipboard.writeText(item.publicCardUrl);
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            }}
            className="shrink-0 text-[var(--muted-foreground)] hover:text-[var(--foreground)] cursor-pointer"
            title="Copy card URL"
          >
            {copied ? <Check size={11} className="text-emerald-500" /> : <Copy size={11} />}
          </button>
          <a
            href={item.publicCardUrl}
            target="_blank"
            rel="noreferrer"
            className="shrink-0 text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
            title="Open live card"
          >
            <ExternalLink size={11} />
          </a>
        </div>

        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[4px] bg-white p-0.5 border border-[var(--border)]">
          {generating ? (
            <Loader2 size={12} className="animate-spin text-neutral-400" />
          ) : dataUrl ? (
            <img src={dataUrl} alt={`QR ${item.displayName}`} className="h-full w-full object-contain" />
          ) : (
            <QrCode size={15} className="text-neutral-400" />
          )}
        </div>

        <button
          type="button"
          disabled={!dataUrl || downloadingQr}
          onClick={async () => {
            setDownloadingQr(true);
            try {
              await downloadHighResQr(item.publicCardUrl, dlName);
            } finally {
              setDownloadingQr(false);
            }
          }}
          className="inline-flex items-center gap-1.5 rounded-[5px] border border-[var(--border)] bg-[var(--card)] hover:bg-[var(--accent)] px-2.5 py-1.5 text-[11px] font-semibold text-[var(--foreground)] cursor-pointer disabled:opacity-50"
        >
          {downloadingQr ? <Loader2 size={12} className="animate-spin" /> : <Download size={12} />}
          <span>QR 512px</span>
        </button>
      </div>
    </div>
  );
};

/* ------------------------------------------------------------------ */
/*  Primary / Trial Production Card                                   */
/* ------------------------------------------------------------------ */

const DesignerProductionJobCard: React.FC<{
  job: FulfillmentJobDTO;
  company?: Company;
  busyStage: boolean;
  onTransition: (job: FulfillmentJobDTO, stage: FulfillmentStage) => void;
  onOpenPostedModal: (job: FulfillmentJobDTO) => void;
  onViewCompany: (company: Company) => void;
}> = ({ job, company, busyStage, onTransition, onOpenPostedModal, onViewCompany }) => {
  const ownerSlug = company?.username || company?.slug || job.company?.username || job.company?.slug || job.profileId;
  const cardUrl = buildPublicCardUrl(ownerSlug);
  const { dataUrl, generating } = useQrThumbnail(cardUrl);
  const [copied, setCopied] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const bizName = company?.businessName || job.company?.businessName || "Unnamed Business";
  const ownerName = company?.ownerName || job.company?.ownerName || "Owner";
  const phone = company?.phoneNumber || company?.phone || job.company?.phone || job.shippingAddress?.phone;
  const cardDetails = job.shippingAddress?.cardDetails;
  const designFileUrl = job.masterTemplateUrl || cardDetails?.fileUrl || job.items[0]?.designFileUrl;

  const jobTypeBadge =
    job.jobType === "free_trial"
      ? "Free Trial"
      : job.jobType === "team_addon"
      ? `Team Batch (${job.cardQuantity})`
      : job.jobType === "primary_addon"
      ? `Extra Primary (${job.cardQuantity})`
      : "Pro Card";

  return (
    <div className="rounded-[5px] border border-[var(--border)] bg-[var(--card)] p-4 space-y-4">
      {/* Header Row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[var(--border)] pb-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[5px] border border-[var(--border)] bg-[var(--accent)] font-headline text-xs font-bold text-[var(--foreground)] overflow-hidden">
            {company?.logoUrl || job.company?.logoUrl ? (
              <img src={(company?.logoUrl || job.company?.logoUrl)!} alt="" className="h-full w-full object-cover" />
            ) : (
              getInitials(bizName)
            )}
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h4 className="font-headline text-sm font-bold text-[var(--foreground)] truncate">
                {bizName}
              </h4>
              <span className="rounded-[4px] border border-[var(--border)] bg-[var(--accent)] px-1.5 py-0.5 font-mono text-[9px] font-semibold uppercase text-[var(--foreground)]">
                {jobTypeBadge}
              </span>
              <span className="rounded-[4px] border border-[var(--border)] bg-[var(--background)] px-1.5 py-0.5 font-mono text-[9px] text-[var(--muted-foreground)]">
                {job.cardQuantity} {job.cardQuantity === 1 ? "Card" : "Cards"}
              </span>
            </div>
            <p className="text-[11px] text-[var(--muted-foreground)] mt-0.5">
              Owner: <span className="font-medium text-[var(--foreground)]">{ownerName}</span>
              {phone ? ` • ${phone}` : ""}
              {job.courierName || job.trackingNumber
                ? ` • Courier: ${job.courierName || ""} ${job.trackingNumber || ""}`
                : ""}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {company && (
            <button
              type="button"
              onClick={() => onViewCompany(company)}
              className="rounded-[5px] border border-[var(--border)] bg-[var(--background)] hover:bg-[var(--accent)] px-2.5 py-1.5 text-xs font-medium text-[var(--foreground)] cursor-pointer"
            >
              Details &amp; Status
            </button>
          )}
        </div>
      </div>

      {/* Assets + QR Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <div className="rounded-[5px] border border-[var(--border)] bg-[var(--background)] p-3.5 space-y-2.5">
          <div className="flex items-center justify-between border-b border-[var(--border)] pb-2">
            <span className="font-mono text-[10px] font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
              Design &amp; Print Specs
            </span>
            {designFileUrl && (
              <a
                href={designFileUrl}
                target="_blank"
                rel="noreferrer"
                download
                className="inline-flex items-center gap-1 rounded-[4px] bg-[var(--foreground)] text-[var(--background)] px-2.5 py-1 text-[10px] font-semibold hover:opacity-90"
              >
                <Download size={11} />
                <span>Download Artwork</span>
              </a>
            )}
          </div>

          <div className="text-xs space-y-1.5">
            {cardDetails?.companyName && (
              <p className="text-[var(--foreground)]">
                <span className="text-[var(--muted-foreground)]">Card Name: </span>
                <span className="font-semibold">{cardDetails.companyName}</span>
              </p>
            )}
            {(job.designNotes || cardDetails?.designNotes) && (
              <p className="text-[var(--foreground)] italic">
                &ldquo;{job.designNotes || cardDetails?.designNotes}&rdquo;
              </p>
            )}
            {!designFileUrl && !job.designNotes && !cardDetails?.designNotes && (
              <p className="text-[11px] text-[var(--muted-foreground)]">
                Use verified company profile logo, name, and details for card layout.
              </p>
            )}
            {job.shippingAddress?.city && (
              <p className="flex items-center gap-1.5 text-[11px] text-[var(--muted-foreground)] pt-1 border-t border-[var(--border)]">
                <MapPin size={11} />
                <span>
                  Ship to: {job.shippingAddress.fullName || ownerName} • {job.shippingAddress.city}
                  {job.shippingAddress.state ? `, ${job.shippingAddress.state}` : ""}
                  {job.shippingAddress.pincode ? ` (${job.shippingAddress.pincode})` : ""}
                </span>
              </p>
            )}
          </div>
        </div>

        <div className="rounded-[5px] border border-[var(--border)] bg-[var(--background)] p-3.5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[5px] bg-white p-1 border border-[var(--border)]">
              {generating ? (
                <Loader2 size={14} className="animate-spin text-neutral-400" />
              ) : dataUrl ? (
                <img src={dataUrl} alt={`QR ${bizName}`} className="h-full w-full object-contain" />
              ) : (
                <QrCode size={18} className="text-neutral-400" />
              )}
            </div>
            <div className="min-w-0 flex-1 space-y-1">
              <span className="text-[10px] font-mono uppercase text-[var(--muted-foreground)] block">
                NFC Card QR Target (512px Level H)
              </span>
              <div className="flex items-center gap-1.5 rounded-[4px] border border-[var(--border)] bg-[var(--card)] px-2 py-1">
                <span className="font-mono text-[10px] text-[var(--muted-foreground)] truncate flex-1 select-all">
                  {cardUrl}
                </span>
                <button
                  type="button"
                  onClick={async () => {
                    await navigator.clipboard.writeText(cardUrl);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 1500);
                  }}
                  className="text-[var(--muted-foreground)] hover:text-[var(--foreground)] cursor-pointer"
                >
                  {copied ? <Check size={11} className="text-emerald-500" /> : <Copy size={11} />}
                </button>
                <a href={cardUrl} target="_blank" rel="noreferrer" className="text-[var(--muted-foreground)] hover:text-[var(--foreground)]">
                  <ExternalLink size={11} />
                </a>
              </div>
            </div>
          </div>

          <button
            type="button"
            disabled={!dataUrl || downloading}
            onClick={async () => {
              setDownloading(true);
              try {
                await downloadHighResQr(cardUrl, `qr-${ownerSlug}`);
              } finally {
                setDownloading(false);
              }
            }}
            className="shrink-0 inline-flex items-center gap-1.5 rounded-[5px] border border-[var(--border)] bg-[var(--card)] hover:bg-[var(--accent)] px-3 py-2 text-xs font-semibold text-[var(--foreground)] cursor-pointer disabled:opacity-50"
          >
            {downloading ? <Loader2 size={12} className="animate-spin" /> : <Download size={12} />}
            <span>QR</span>
          </button>
        </div>
      </div>

      {/* Designer Fulfillment Stage Actions (Auto-Syncs to Admin) */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-[var(--border)]">
        <span className="font-mono text-[10px] text-[var(--muted-foreground)]">
          Updated {formatDate(job.updatedAt)}
          {job.lastUpdatedByRole ? ` • by ${job.lastUpdatedByRole}` : ""}
        </span>

        <div className="flex flex-wrap items-center gap-2">
          {job.stage === "sent_to_designer" && (
            <button
              type="button"
              disabled={busyStage}
              onClick={() => onTransition(job, "printed_ready")}
              className="inline-flex items-center gap-1.5 rounded-[5px] bg-[var(--foreground)] text-[var(--background)] px-3 py-1.5 text-xs font-semibold hover:opacity-90 cursor-pointer disabled:opacity-50"
            >
              {busyStage ? <Loader2 size={12} className="animate-spin" /> : <Printer size={12} />}
              <span>Mark Card Printed</span>
            </button>
          )}

          {(job.stage === "sent_to_designer" || job.stage === "printed_ready") && (
            <button
              type="button"
              disabled={busyStage}
              onClick={() => onOpenPostedModal(job)}
              className="inline-flex items-center gap-1.5 rounded-[5px] border border-[var(--border)] bg-[var(--background)] hover:bg-[var(--accent)] px-3 py-1.5 text-xs font-semibold text-[var(--foreground)] cursor-pointer disabled:opacity-50"
            >
              <Truck size={12} />
              <span>Mark Card Posted</span>
            </button>
          )}

          {(job.stage === "sent_to_designer" || job.stage === "printed_ready" || job.stage === "posted") && (
            <button
              type="button"
              disabled={busyStage}
              onClick={() => onTransition(job, "delivered")}
              className="inline-flex items-center gap-1.5 rounded-[5px] border border-[var(--border)] bg-[var(--background)] hover:bg-[var(--accent)] px-3 py-1.5 text-xs font-semibold text-[var(--foreground)] cursor-pointer disabled:opacity-50"
            >
              <CheckCircle2 size={12} />
              <span>Mark Card Delivered</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

/* ------------------------------------------------------------------ */
/*  Directory Row                                                      */
/* ------------------------------------------------------------------ */

const DirectoryCompanyRow: React.FC<{
  company: Company;
  onViewDetails: (c: Company) => void;
}> = ({ company, onViewDetails }) => {
  const ownerSlug = company.username || company.slug || company.id;
  const cardUrl = buildPublicCardUrl(ownerSlug);
  const { dataUrl, generating } = useQrThumbnail(cardUrl);
  const [copied, setCopied] = useState(false);
  const [downloading, setDownloading] = useState(false);

  return (
    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 p-3.5 rounded-[5px] border border-[var(--border)] bg-[var(--card)] hover:border-[var(--foreground)]/30 transition-all">
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[5px] border border-[var(--border)] bg-[var(--accent)] text-xs font-bold text-[var(--foreground)] overflow-hidden">
          {company.logoUrl ? (
            <img src={company.logoUrl} alt={company.businessName} className="h-full w-full object-cover" />
          ) : (
            getInitials(company.businessName)
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-xs text-[var(--foreground)] truncate">
              {company.businessName}
            </span>
            <span className="rounded-[4px] border border-[var(--border)] bg-[var(--accent)] px-1.5 py-0.5 font-mono text-[9px] uppercase text-[var(--foreground)]">
              {company.subscriptionPlan === "pro"
                ? "Pro"
                : company.subscriptionPlan === "trial"
                ? "Free Trial"
                : "Free"}
            </span>
          </div>
          <p className="font-mono text-[11px] text-[var(--muted-foreground)] truncate mt-0.5">
            {company.ownerName}
            {company.assignedIdCount ? ` • ${company.assignedIdCount} Team IDs` : ""}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 justify-end shrink-0">
        <div className="flex items-center gap-1.5 rounded-[4px] border border-[var(--border)] bg-[var(--background)] px-2 py-1 max-w-[240px]">
          <span className="font-mono text-[10px] text-[var(--muted-foreground)] truncate select-all">
            {cardUrl}
          </span>
          <button
            type="button"
            onClick={async () => {
              await navigator.clipboard.writeText(cardUrl);
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            }}
            className="text-[var(--muted-foreground)] hover:text-[var(--foreground)] cursor-pointer"
          >
            {copied ? <Check size={11} className="text-emerald-500" /> : <Copy size={11} />}
          </button>
        </div>

        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[4px] bg-white p-0.5 border border-[var(--border)]">
          {generating ? (
            <Loader2 size={12} className="animate-spin text-neutral-400" />
          ) : dataUrl ? (
            <img src={dataUrl} alt="" className="h-full w-full object-contain" />
          ) : (
            <QrCode size={14} className="text-neutral-400" />
          )}
        </div>

        <button
          type="button"
          disabled={!dataUrl || downloading}
          onClick={async () => {
            setDownloading(true);
            try {
              await downloadHighResQr(cardUrl, `qr-${ownerSlug}`);
            } finally {
              setDownloading(false);
            }
          }}
          className="inline-flex items-center gap-1 rounded-[5px] border border-[var(--border)] bg-[var(--background)] hover:bg-[var(--accent)] px-2.5 py-1.5 text-xs font-semibold text-[var(--foreground)] cursor-pointer"
        >
          <Download size={12} />
          <span>QR</span>
        </button>

        <button
          type="button"
          onClick={() => onViewDetails(company)}
          className="inline-flex items-center gap-1 rounded-[5px] border border-[var(--border)] bg-[var(--background)] hover:bg-[var(--accent)] px-2.5 py-1.5 text-xs font-medium text-[var(--foreground)] cursor-pointer"
        >
          <span>Manage</span>
          <ChevronRight size={12} />
        </button>
      </div>
    </div>
  );
};

/* ------------------------------------------------------------------ */
/*  Main Designer Console (Matches Admin & Partner Shell 1:1)         */
/* ------------------------------------------------------------------ */

export const DesignerDashboardView: React.FC = () => {
  const router = useRouter();
  const [userEmail, setUserEmail] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<DesignerSidebarTab>("directory");
  const [stageFilter, setStageFilter] = useState<DesignerStageFilter>("sent_to_designer");
  const [sortBy, setSortBy] = useState<"recent" | "a_z" | "z_a">("recent");
  const [search, setSearch] = useState<string>("");

  const [companies, setCompanies] = useState<Company[]>([]);
  const [jobs, setJobs] = useState<FulfillmentJobDTO[]>([]);
  const [busyJobId, setBusyJobId] = useState<string | null>(null);

  // Employee IDs Company Drill-down state
  const [selectedEmpCompanyId, setSelectedEmpCompanyId] = useState<string | null>(null);

  // Posted Modal (optional Courier / Tracking Number)
  const [postedTargetJob, setPostedTargetJob] = useState<FulfillmentJobDTO | null>(null);
  const [courierName, setCourierName] = useState("");
  const [trackingNumber, setTrackingNumber] = useState("");

  // Confirmation Modal for Mark Card Printed & Mark Card Delivered
  const [confirmStageModal, setConfirmStageModal] = useState<{
    job: FulfillmentJobDTO;
    stage: "printed_ready" | "delivered";
    title: string;
    description: string;
  } | null>(null);

  // Company Detail Modal
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  const loadAllData = useCallback(async (opts?: boolean | { silent?: boolean; forceRefresh?: boolean }) => {
    const forceRefresh = typeof opts === "boolean" ? opts : Boolean(opts?.forceRefresh);
    const silent = typeof opts === "object" ? Boolean(opts?.silent) : false;
    if (!silent) setLoading(true);
    try {
      const [compRes, fulRes] = await Promise.all([
        fetchAdminCompanies(forceRefresh),
        fetch("/api/staff/fulfillment", { cache: "no-store" }).then((r) => r.json()),
      ]);
      setCompanies(compRes.companies || []);
      setJobs(fulRes.jobs || []);
    } catch (err) {
      console.error("[Designer] Failed to load workspace:", err);
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

  // Merge DB fulfillment_jobs + any Free Trial / Pro companies marked `sent_to_designer` without a job row yet
  const unifiedJobs = useMemo(() => {
    const existingProfileJobs = new Set(jobs.map((j) => `${j.profileId}:${j.jobType}`));
    const synthetic: FulfillmentJobDTO[] = [];

    for (const c of companies) {
      const cp = c.cardProcess || {};
      const sent = Boolean(cp.customer_responded_designing?.completed);
      if (!sent) continue;

      const jobType = c.subscriptionPlan === "trial" ? "free_trial" : "pro_initial";
      if (existingProfileJobs.has(`${c.id}:${jobType}`)) continue;

      const stage: FulfillmentStage = cp.card_delivered?.completed
        ? "delivered"
        : cp.card_posted?.completed
        ? "posted"
        : cp.card_printed_approved?.completed
        ? "printed_ready"
        : "sent_to_designer";

      const ownerSlug = c.username || c.slug || c.id;
      synthetic.push({
        id: `profile-${c.id}`,
        profileId: c.id,
        jobType,
        stage,
        cardQuantity: 1,
        masterTemplateUrl: c.defaultCardTemplateUrl || null,
        createdAt: c.createdAt,
        updatedAt: cp.customer_responded_designing?.updated_at || c.createdAt,
        isSyntheticTrial: true,
        company: {
          id: c.id,
          businessName: c.businessName,
          ownerName: c.ownerName,
          phone: c.phoneNumber || c.phone,
          email: c.email,
          username: c.username,
          slug: c.slug,
          subscriptionPlan: c.subscriptionPlan,
          logoUrl: c.logoUrl || c.avatarUrl,
          defaultCardTemplateUrl: c.defaultCardTemplateUrl,
        },
        items: [
          {
            id: `primary-${c.id}`,
            jobId: `profile-${c.id}`,
            profileId: c.id,
            targetType: "primary",
            displayName: c.businessName,
            designation: `Owner: ${c.ownerName}`,
            phone: c.phoneNumber || c.phone,
            photoUrl: c.avatarUrl,
            publicCardUrl: buildPublicCardUrl(ownerSlug),
            designMode: c.defaultCardTemplateUrl ? "company_template" : "team_assist",
            designFileUrl: c.defaultCardTemplateUrl || null,
            isPrinted: stage !== "sent_to_designer",
          },
        ],
      });
    }

    return [...jobs, ...synthetic];
  }, [jobs, companies]);

  const handleStageTransition = async (
    job: FulfillmentJobDTO,
    targetStage: FulfillmentStage,
    extra?: { courierName?: string; trackingNumber?: string }
  ) => {
    setBusyJobId(job.id);
    try {
      if (job.isSyntheticTrial || job.id.startsWith("profile-")) {
        const stepKey =
          targetStage === "printed_ready"
            ? "card_printed_approved"
            : targetStage === "posted"
            ? "card_posted"
            : "card_delivered";
        const res = await fetch(`/api/admin/companies/${job.profileId}/card-process`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ stepKey, completed: true }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || "Failed to update stage");
        }
      } else {
        const res = await fetch(`/api/staff/fulfillment/${job.id}/stage`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            stage: targetStage,
            courierName: extra?.courierName || null,
            trackingNumber: extra?.trackingNumber || null,
          }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || "Failed to update stage");
        }
      }

      await loadAllData({ silent: true, forceRefresh: true });
    } catch (err: any) {
      alert(err.message || "Could not update card status");
    } finally {
      setBusyJobId(null);
    }
  };

  const matchesSearch = useCallback(
    (biz?: string, owner?: string, phone?: string | null) => {
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return (
        Boolean(biz?.toLowerCase().includes(q)) ||
        Boolean(owner?.toLowerCase().includes(q)) ||
        Boolean(phone?.includes(q))
      );
    },
    [search]
  );

  // Employee & Branch IDs grouped by Company
  const employeeIdGroups = useMemo(() => {
    const map = new Map<
      string,
      {
        profileId: string;
        company?: Company;
        businessName: string;
        ownerName: string;
        logoUrl?: string | null;
        masterTemplateUrl?: string | null;
        jobs: FulfillmentJobDTO[];
        items: FulfillmentItemDTO[];
        pendingCount: number;
      }
    >();

    for (const job of unifiedJobs) {
      if (job.stage === "awaiting_customer" || job.stage === "cancelled") continue;
      const empOrBranchItems = job.items.filter(
        (it) => it.targetType === "employee" || it.targetType === "branch"
      );
      if (job.jobType !== "team_addon" && empOrBranchItems.length === 0) continue;

      const comp = companies.find((c) => c.id === job.profileId);
      const bizName = comp?.businessName || job.company?.businessName || "Company";
      const ownerName = comp?.ownerName || job.company?.ownerName || "Owner";

      if (!matchesSearch(bizName, ownerName, comp?.phone || job.company?.phone)) continue;

      const existing = map.get(job.profileId) || {
        profileId: job.profileId,
        company: comp,
        businessName: bizName,
        ownerName,
        logoUrl: comp?.logoUrl || job.company?.logoUrl,
        masterTemplateUrl: job.masterTemplateUrl || comp?.defaultCardTemplateUrl || null,
        jobs: [],
        items: [],
        pendingCount: 0,
      };

      existing.jobs.push(job);
      // Fallback: if team_addon has items not yet generated in fulfillment_job_items, synthesize from company.employees
      if (empOrBranchItems.length > 0) {
        existing.items.push(...empOrBranchItems);
      } else if (comp?.employees && comp.employees.length > 0) {
        const ownerSlug = comp.username || comp.slug || comp.id;
        for (const emp of comp.employees) {
          if (!existing.items.some((i) => i.employeeId === emp.id)) {
            existing.items.push({
              id: `emp-${emp.id}`,
              jobId: job.id,
              profileId: comp.id,
              targetType: "employee",
              employeeId: emp.id,
              displayName: emp.name,
              designation: emp.designation,
              phone: emp.phone,
              photoUrl: emp.avatarUrl,
              publicCardUrl: buildPublicCardUrl(ownerSlug, emp.slug || emp.id),
              designMode: comp.defaultCardTemplateUrl ? "company_template" : "team_assist",
              designFileUrl: comp.defaultCardTemplateUrl || null,
              isPrinted: job.stage !== "sent_to_designer",
            });
          }
        }
      }
      if (job.stage === "sent_to_designer") {
        existing.pendingCount += Math.max(1, empOrBranchItems.length || job.cardQuantity);
      }
      map.set(job.profileId, existing);
    }

    return Array.from(map.values());
  }, [unifiedJobs, companies, matchesSearch]);

  const inProductionJobs = useMemo(
    () =>
      unifiedJobs.filter(
        (j) =>
          j.stage === "sent_to_designer" &&
          matchesSearch(j.company?.businessName, j.company?.ownerName, j.company?.phone)
      ),
    [unifiedJobs, matchesSearch]
  );
  const printedReadyJobs = useMemo(
    () =>
      unifiedJobs.filter(
        (j) =>
          j.stage === "printed_ready" &&
          matchesSearch(j.company?.businessName, j.company?.ownerName, j.company?.phone)
      ),
    [unifiedJobs, matchesSearch]
  );
  const postedJobs = useMemo(
    () =>
      unifiedJobs.filter(
        (j) =>
          j.stage === "posted" &&
          matchesSearch(j.company?.businessName, j.company?.ownerName, j.company?.phone)
      ),
    [unifiedJobs, matchesSearch]
  );
  const deliveredJobs = useMemo(
    () =>
      unifiedJobs.filter(
        (j) =>
          j.stage === "delivered" &&
          matchesSearch(j.company?.businessName, j.company?.ownerName, j.company?.phone)
      ),
    [unifiedJobs, matchesSearch]
  );

  const filteredDirectory = useMemo(() => {
    const list = companies.filter((c) =>
      matchesSearch(c.businessName, c.ownerName, c.phoneNumber || c.phone)
    );
    return [...list].sort((a, b) => {
      if (sortBy === "a_z") return (a.businessName || "").localeCompare(b.businessName || "");
      if (sortBy === "z_a") return (b.businessName || "").localeCompare(a.businessName || "");
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }, [companies, matchesSearch, sortBy]);

  const selectedEmpGroup = useMemo(
    () => employeeIdGroups.find((g) => g.profileId === selectedEmpCompanyId) || null,
    [employeeIdGroups, selectedEmpCompanyId]
  );

  const navItems: { id: DesignerSidebarTab; label: string; icon: React.ReactNode; count?: number }[] = [
    { id: "directory", label: "All Card QRs", icon: <QrCode size={15} />, count: companies.length },
    { id: "production", label: "Production Queue", icon: <Package size={15} />, count: inProductionJobs.length },
    { id: "employee_ids", label: "Employee & Branch IDs", icon: <Users size={15} />, count: employeeIdGroups.length },
  ];

  const activeStageJobs = useMemo(() => {
    if (stageFilter === "all") {
      return [...inProductionJobs, ...printedReadyJobs, ...postedJobs, ...deliveredJobs];
    }
    if (stageFilter === "sent_to_designer") return inProductionJobs;
    if (stageFilter === "printed_ready") return printedReadyJobs;
    if (stageFilter === "posted") return postedJobs;
    return deliveredJobs;
  }, [stageFilter, inProductionJobs, printedReadyJobs, postedJobs, deliveredJobs]);

  const stageFilterLabels: Record<DesignerStageFilter, string> = {
    sent_to_designer: "In Production",
    printed_ready: "Printed & Ready",
    posted: "Card Posted",
    delivered: "Delivered",
    all: "All Production Jobs",
  };

  return (
    <div className="flex h-screen w-full overflow-hidden bg-[var(--background)] text-[var(--foreground)]">
      {/* Left Fixed Sidebar (Exact Admin / Partner Console Shell) */}
      <aside className="hidden md:flex flex-col w-64 h-screen border-r border-[var(--border)] bg-[var(--card)] p-5 shrink-0 justify-between select-none">
        <div>
          <div className="pb-6 border-b border-[var(--border)]">
            <h1 className="font-headline text-base font-bold text-[var(--foreground)] tracking-tight">
              Namma Info
            </h1>
            <span className="font-mono text-[10px] uppercase tracking-wider text-[var(--muted-foreground)] block mt-0.5">
              Designer Console
            </span>
          </div>

          <nav className="mt-6 space-y-1">
            {navItems.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setActiveTab(item.id);
                  if (item.id !== "employee_ids") setSelectedEmpCompanyId(null);
                }}
                className={`flex w-full items-center justify-between rounded-[5px] px-3 py-2 text-xs font-medium cursor-pointer ${
                  activeTab === item.id
                    ? "bg-[var(--foreground)] text-[var(--background)]"
                    : "text-[var(--muted-foreground)] hover:bg-[var(--accent)] hover:text-[var(--foreground)]"
                }`}
              >
                <span className="flex items-center gap-2.5 truncate">
                  {item.icon}
                  <span className="truncate">{item.label}</span>
                </span>
                {typeof item.count === "number" && (
                  <span
                    className={`font-mono text-[10px] font-bold px-1.5 py-0.5 rounded-[4px] ${
                      activeTab === item.id
                        ? "bg-[var(--background)] text-[var(--foreground)]"
                        : "bg-[var(--accent)] text-[var(--muted-foreground)]"
                    }`}
                  >
                    {item.count}
                  </span>
                )}
              </button>
            ))}
          </nav>
        </div>

        <div className="border-t border-[var(--border)] pt-4 space-y-2">
          {userEmail && (
            <p className="font-mono text-[10px] text-[var(--muted-foreground)] truncate px-1">
              {userEmail}
            </p>
          )}
          <button
            onClick={handleSignOut}
            className="flex w-full items-center justify-between rounded-[5px] border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-xs font-medium text-[var(--muted-foreground)] hover:text-red-600 dark:hover:text-red-400 hover:bg-[var(--accent)] transition-colors cursor-pointer"
          >
            <span className="flex items-center gap-2">
              <LogOut size={14} />
              <span>Log Out</span>
            </span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex flex-1 flex-col h-screen overflow-y-scroll min-w-0">
        {/* Sticky Header (1:1 with AdminHeader) */}
        <header className="sticky top-0 z-10 flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-[var(--border)] bg-[var(--card)] px-6 py-4 gap-3 shrink-0">
          <div>
            <h2 className="font-headline text-lg font-bold text-[var(--foreground)]">
              {navItems.find((i) => i.id === activeTab)?.label || "Designer Studio"}
            </h2>
            <p className="text-xs text-[var(--muted-foreground)]">
              Card artwork, employee ID templates, 512px QR downloads, and print/dispatch status sync.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <StaffNotificationsBell
              title="Designer Queue Alerts"
              onSelectNotification={(n) => {
                if (n.profile_id) {
                  setActiveTab("production");
                  setStageFilter("sent_to_designer");
                }
              }}
            />
            <AdminThemeToggle />
            <button
              onClick={() => loadAllData(true)}
              disabled={loading}
              className="flex items-center gap-1.5 rounded-[5px] border border-[var(--border)] bg-[var(--background)] px-3 py-1.5 text-xs font-medium text-[var(--foreground)] hover:bg-[var(--accent)] transition-colors disabled:opacity-50 cursor-pointer"
            >
              <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
              <span>Refresh</span>
            </button>
          </div>
        </header>

        {/* Mobile Tab Strip */}
        <div className="flex md:hidden gap-1.5 overflow-x-auto border-b border-[var(--border)] bg-[var(--card)] px-4 py-2">
          {navItems.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setActiveTab(item.id)}
              className={`shrink-0 rounded-[5px] px-3 py-1.5 text-xs font-semibold ${
                activeTab === item.id
                  ? "bg-[var(--foreground)] text-[var(--background)]"
                  : "border border-[var(--border)] bg-[var(--background)] text-[var(--muted-foreground)]"
              }`}
            >
              {item.label} ({item.count ?? 0})
            </button>
          ))}
        </div>

        <main className="flex-1 space-y-5 p-6 w-full pb-16">
          {/* KPI Stage Filter Strip (shown inside Production Queue — never conflicts with sidebar!) */}
          {activeTab === "production" && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {[
                  { id: "sent_to_designer" as DesignerStageFilter, label: "In Production", count: inProductionJobs.length },
                  { id: "printed_ready" as DesignerStageFilter, label: "Printed & Ready", count: printedReadyJobs.length },
                  { id: "posted" as DesignerStageFilter, label: "Card Posted", count: postedJobs.length },
                  { id: "delivered" as DesignerStageFilter, label: "Delivered", count: deliveredJobs.length },
                ].map((kpi) => {
                  const isActive = stageFilter === kpi.id;
                  return (
                    <button
                      key={kpi.id}
                      type="button"
                      onClick={() => setStageFilter(kpi.id)}
                      className={`text-left rounded-[5px] border p-4 cursor-pointer ${
                        isActive
                          ? "border-[var(--foreground)] bg-[var(--accent)]/40"
                          : "border-[var(--border)] bg-[var(--card)] hover:border-[var(--foreground)]/40"
                      }`}
                    >
                      <span className="font-mono text-[10px] uppercase tracking-wider text-[var(--muted-foreground)] block">
                        {kpi.label}
                      </span>
                      <span className="font-headline text-2xl font-bold text-[var(--foreground)] mt-1 block">
                        {kpi.count}
                      </span>
                    </button>
                  );
                })}
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-1.5 overflow-x-auto">
                  {(["sent_to_designer", "printed_ready", "posted", "delivered", "all"] as DesignerStageFilter[]).map((f) => (
                    <button
                      key={f}
                      type="button"
                      onClick={() => setStageFilter(f)}
                      className={`rounded-[5px] px-2.5 py-1 text-xs font-medium cursor-pointer whitespace-nowrap ${
                        stageFilter === f
                          ? "bg-[var(--foreground)] text-[var(--background)]"
                          : "border border-[var(--border)] bg-[var(--card)] text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
                      }`}
                    >
                      {stageFilterLabels[f]}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Search & Sort Controls */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="relative flex-1 min-w-[240px] max-w-md">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)]" />
              <input
                type="text"
                placeholder="Search company, owner, or phone..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-[5px] border border-[var(--border)] bg-[var(--card)] pl-9 pr-3 py-2 text-xs text-[var(--foreground)] outline-none focus:border-[var(--foreground)]"
              />
            </div>

            {activeTab === "directory" && (
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
                  Sort:
                </span>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as "recent" | "a_z" | "z_a")}
                  className="rounded-[5px] border border-[var(--border)] bg-[var(--card)] px-2.5 py-1.5 text-xs font-medium text-[var(--foreground)] outline-none cursor-pointer"
                >
                  <option value="recent">Recent Sign-ups</option>
                  <option value="a_z">Alphabetical (A–Z)</option>
                  <option value="z_a">Alphabetical (Z–A)</option>
                </select>
              </div>
            )}
          </div>

          {loading ? (
            <div className="rounded-[5px] border border-[var(--border)] bg-[var(--card)] p-12 text-center text-xs text-[var(--muted-foreground)]">
              <Loader2 size={18} className="animate-spin inline-block mr-2" />
              Loading designer queue...
            </div>
          ) : activeTab === "employee_ids" ? (
            selectedEmpGroup ? (
              /* Company Employee ID Print Sheet */
              <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-[5px] border border-[var(--border)] bg-[var(--card)] p-4">
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setSelectedEmpCompanyId(null)}
                      className="rounded-[5px] border border-[var(--border)] bg-[var(--background)] p-2 hover:bg-[var(--accent)] cursor-pointer"
                    >
                      <ArrowLeft size={14} />
                    </button>
                    <div>
                      <h3 className="font-headline text-sm font-bold text-[var(--foreground)]">
                        {selectedEmpGroup.businessName} — Employee &amp; Branch Print Sheet
                      </h3>
                      <p className="text-[11px] text-[var(--muted-foreground)]">
                        {selectedEmpGroup.items.length} card item{selectedEmpGroup.items.length === 1 ? "" : "s"} • Owner: {selectedEmpGroup.ownerName}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {selectedEmpGroup.masterTemplateUrl && (
                      <a
                        href={selectedEmpGroup.masterTemplateUrl}
                        target="_blank"
                        rel="noreferrer"
                        download
                        className="inline-flex items-center gap-1.5 rounded-[5px] border border-[var(--border)] bg-[var(--background)] hover:bg-[var(--accent)] px-3 py-1.5 text-xs font-semibold text-[var(--foreground)]"
                      >
                        <FileText size={13} />
                        <span>Download Master Template</span>
                      </a>
                    )}
                    {selectedEmpGroup.jobs[0] && selectedEmpGroup.jobs[0].stage === "sent_to_designer" && (
                      <Button
                        size="sm"
                        variant="primary"
                        isLoading={busyJobId === selectedEmpGroup.jobs[0].id}
                        onClick={() =>
                          setConfirmStageModal({
                            job: selectedEmpGroup.jobs[0],
                            stage: "printed_ready",
                            title: "Confirm Card Batch Printed",
                            description: `Mark ${selectedEmpGroup.businessName} (${selectedEmpGroup.items.length || selectedEmpGroup.jobs[0].cardQuantity} card${(selectedEmpGroup.items.length || selectedEmpGroup.jobs[0].cardQuantity) === 1 ? "" : "s"}) as printed and ready for dispatch? This syncs immediately with Admin.`,
                          })
                        }
                      >
                        Mark Batch Printed
                      </Button>
                    )}
                    {selectedEmpGroup.jobs[0] &&
                      ["sent_to_designer", "printed_ready"].includes(selectedEmpGroup.jobs[0].stage) && (
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => setPostedTargetJob(selectedEmpGroup.jobs[0])}
                        >
                          Mark Posted
                        </Button>
                      )}
                    {selectedEmpGroup.jobs[0] &&
                      ["sent_to_designer", "printed_ready", "posted"].includes(selectedEmpGroup.jobs[0].stage) && (
                        <Button
                          size="sm"
                          variant="secondary"
                          isLoading={busyJobId === selectedEmpGroup.jobs[0].id}
                          onClick={() =>
                            setConfirmStageModal({
                              job: selectedEmpGroup.jobs[0],
                              stage: "delivered",
                              title: "Confirm Card Delivered",
                              description: `Mark ${selectedEmpGroup.businessName}'s card batch as delivered to the customer? This updates Admin, Partner, and Customer tracking immediately.`,
                            })
                          }
                        >
                          Mark Delivered
                        </Button>
                      )}
                  </div>
                </div>

                {selectedEmpGroup.items.length === 0 ? (
                  <div className="rounded-[5px] border border-dashed border-[var(--border)] bg-[var(--card)] p-10 text-center text-xs text-[var(--muted-foreground)]">
                    Owner has purchased slots, waiting for employee details or template assignment.
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {selectedEmpGroup.items.map((item) => (
                      <PrintItemCard
                        key={item.id}
                        item={item}
                        masterTemplateUrl={selectedEmpGroup.masterTemplateUrl}
                        companySlug={
                          selectedEmpGroup.company?.username ||
                          selectedEmpGroup.company?.slug ||
                          selectedEmpGroup.profileId
                        }
                      />
                    ))}
                  </div>
                )}
              </div>
            ) : employeeIdGroups.length === 0 ? (
              <div className="rounded-[5px] border border-dashed border-[var(--border)] bg-[var(--card)] py-14 text-center space-y-2">
                <Users size={26} className="mx-auto text-[var(--muted-foreground)] opacity-50" />
                <p className="text-sm font-semibold text-[var(--foreground)]">
                  No Employee or Branch IDs in Production
                </p>
                <p className="text-xs text-[var(--muted-foreground)] max-w-md mx-auto">
                  When owners purchase team/branch slots and Admin marks them sent to designer, companies appear here grouped by organization.
                </p>
              </div>
            ) : (
              <div className="rounded-[5px] border border-[var(--border)] bg-[var(--card)] divide-y divide-[var(--border)]">
                {employeeIdGroups.map((group) => (
                  <button
                    key={group.profileId}
                    type="button"
                    onClick={() => setSelectedEmpCompanyId(group.profileId)}
                    className="w-full text-left p-4 hover:bg-[var(--accent)]/40 transition-colors flex items-center justify-between gap-3 cursor-pointer"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[5px] border border-[var(--border)] bg-[var(--accent)] text-xs font-bold overflow-hidden">
                        {group.logoUrl ? (
                          <img src={group.logoUrl} alt="" className="h-full w-full object-cover" />
                        ) : (
                          getInitials(group.businessName)
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-xs text-[var(--foreground)] truncate">
                            {group.businessName}
                          </span>
                          <span className="rounded-[4px] border border-[var(--border)] bg-[var(--background)] px-1.5 py-0.5 font-mono text-[10px] font-semibold">
                            {group.items.length} Card{group.items.length === 1 ? "" : "s"}
                          </span>
                          {group.masterTemplateUrl && (
                            <span className="rounded-[4px] border border-[var(--border)] bg-[var(--accent)] px-1.5 py-0.5 font-mono text-[9px] text-[var(--foreground)]">
                              Master Template Attached
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-[var(--muted-foreground)] mt-0.5">
                          Owner: {group.ownerName}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 text-xs font-medium text-[var(--muted-foreground)]">
                      <span>Open Print Sheet</span>
                      <ChevronRight size={14} />
                    </div>
                  </button>
                ))}
              </div>
            )
          ) : activeTab === "directory" ? (
            <div className="space-y-2.5">
              {filteredDirectory.map((company) => (
                <DirectoryCompanyRow
                  key={company.id}
                  company={company}
                  onViewDetails={(c) => {
                    setSelectedCompany(c);
                    setIsDetailOpen(true);
                  }}
                />
              ))}
            </div>
          ) : activeStageJobs.length === 0 ? (
            <div className="rounded-[5px] border border-dashed border-[var(--border)] bg-[var(--card)] py-14 text-center space-y-2">
              <Package size={26} className="mx-auto text-[var(--muted-foreground)] opacity-50" />
              <p className="text-sm font-semibold text-[var(--foreground)]">
                No Cards in {stageFilterLabels[stageFilter]}
              </p>
              <p className="text-xs text-[var(--muted-foreground)] max-w-md mx-auto">
                Cards marked &ldquo;Customer responded and card sent to designer&rdquo; by Admin (Pro or Free Trial) automatically appear in In Production.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {activeStageJobs.map((job) => {
                const company = companies.find((c) => c.id === job.profileId);
                return (
                  <DesignerProductionJobCard
                    key={job.id}
                    job={job}
                    company={company}
                    busyStage={busyJobId === job.id}
                    onTransition={(j, stage) => {
                      const biz = company?.businessName || j.company?.businessName || "this customer";
                      if (stage === "printed_ready") {
                        setConfirmStageModal({
                          job: j,
                          stage: "printed_ready",
                          title: "Confirm Card Printed",
                          description: `Are you sure you want to mark ${biz}'s card (${j.cardQuantity} card${j.cardQuantity === 1 ? "" : "s"}) as printed and ready for dispatch? This syncs immediately with Admin.`,
                        });
                      } else if (stage === "delivered") {
                        setConfirmStageModal({
                          job: j,
                          stage: "delivered",
                          title: "Confirm Card Delivered",
                          description: `Are you sure you want to mark ${biz}'s card as delivered? This updates Admin, Partner, and Customer order tracking.`,
                        });
                      } else {
                        handleStageTransition(j, stage);
                      }
                    }}
                    onOpenPostedModal={(j) => {
                      setCourierName(j.courierName || "");
                      setTrackingNumber(j.trackingNumber || "");
                      setPostedTargetJob(j);
                    }}
                    onViewCompany={(c) => {
                      setSelectedCompany(c);
                      setIsDetailOpen(true);
                    }}
                  />
                );
              })}
            </div>
          )}
        </main>
      </div>

      {/* Optional Courier & Tracking Modal on "Mark Card Posted" */}
      {postedTargetJob && (
        <Modal
          isOpen={Boolean(postedTargetJob)}
          onClose={() => setPostedTargetJob(null)}
          title="Mark Card Posted"
          description="Courier & tracking details are optional — you can confirm dispatch right away."
          maxWidth="sm"
        >
          <div className="space-y-3">
            <div>
              <label className="block font-mono text-[10px] uppercase text-[var(--muted-foreground)] mb-1">
                Courier Partner (Optional)
              </label>
              <input
                type="text"
                value={courierName}
                onChange={(e) => setCourierName(e.target.value)}
                placeholder="e.g. DTDC, BlueDart, India Post"
                className="w-full rounded-[5px] border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-xs text-[var(--foreground)] outline-none focus:border-[var(--foreground)]"
              />
            </div>
            <div>
              <label className="block font-mono text-[10px] uppercase text-[var(--muted-foreground)] mb-1">
                Tracking / AWB Number (Optional)
              </label>
              <input
                type="text"
                value={trackingNumber}
                onChange={(e) => setTrackingNumber(e.target.value)}
                placeholder="e.g. D89123456"
                className="w-full rounded-[5px] border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-xs font-mono text-[var(--foreground)] outline-none focus:border-[var(--foreground)]"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-[var(--border)]">
              <Button variant="secondary" size="sm" onClick={() => setPostedTargetJob(null)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                isLoading={busyJobId === postedTargetJob.id}
                onClick={async () => {
                  const target = postedTargetJob;
                  setPostedTargetJob(null);
                  await handleStageTransition(target, "posted", {
                    courierName: courierName.trim() || undefined,
                    trackingNumber: trackingNumber.trim() || undefined,
                  });
                }}
              >
                Confirm Card Posted
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Confirmation Modal for Printed & Delivered */}
      {confirmStageModal && (
        <Modal
          isOpen={Boolean(confirmStageModal)}
          onClose={() => !busyJobId && setConfirmStageModal(null)}
          title={confirmStageModal.title}
          maxWidth="sm"
        >
          <div className="space-y-4">
            <p className="text-xs text-[var(--muted-foreground)] leading-relaxed">
              {confirmStageModal.description}
            </p>
            <div className="flex items-center justify-end gap-2 pt-3 border-t border-[var(--border)]">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setConfirmStageModal(null)}
                disabled={Boolean(busyJobId)}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                isLoading={busyJobId === confirmStageModal.job.id}
                onClick={async () => {
                  const target = confirmStageModal;
                  setConfirmStageModal(null);
                  await handleStageTransition(target.job, target.stage);
                }}
              >
                {confirmStageModal.stage === "printed_ready"
                  ? "Yes, Mark Card Printed"
                  : "Yes, Mark Card Delivered"}
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Designer Company Detail Modal (Can mark Printed/Posted/Delivered, cannot edit billing) */}
      {selectedCompany && (
        <CompanyDetailModal
          company={selectedCompany}
          isOpen={isDetailOpen}
          onClose={() => {
            setIsDetailOpen(false);
            setSelectedCompany(null);
          }}
          onRefresh={() => loadAllData({ silent: true, forceRefresh: true })}
          userRole="designer"
        />
      )}
    </div>
  );
};
