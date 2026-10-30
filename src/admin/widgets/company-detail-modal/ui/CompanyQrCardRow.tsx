"use client";

import React, { useState, useEffect } from "react";
import QRCode from "qrcode";
import { Download, Copy, Check, ExternalLink, Loader2, QrCode } from "lucide-react";

interface CompanyQrCardRowProps {
  title: string;
  subtitle: string;
  url: string;
  badge: string;
  downloadFileName: string;
  isPrimary?: boolean;
}

export const CompanyQrCardRow: React.FC<CompanyQrCardRowProps> = ({
  title,
  subtitle,
  url,
  badge,
  downloadFileName,
  isPrimary = false,
}) => {
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState<boolean>(true);
  const [copied, setCopied] = useState<boolean>(false);

  useEffect(() => {
    let isMounted = true;
    setIsGenerating(true);

    QRCode.toDataURL(url, {
      width: 512,
      margin: 2,
      errorCorrectionLevel: "H",
      color: {
        dark: "#000000",
        light: "#ffffff",
      },
    })
      .then((dataUrl) => {
        if (isMounted) {
          setQrDataUrl(dataUrl);
          setIsGenerating(false);
        }
      })
      .catch((err) => {
        console.error("Failed to generate QR code for:", url, err);
        if (isMounted) setIsGenerating(false);
      });

    return () => {
      isMounted = false;
    };
  }, [url]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy URL to clipboard:", err);
    }
  };

  const handleDownload = () => {
    if (!qrDataUrl) return;
    const a = document.createElement("a");
    a.href = qrDataUrl;
    a.download = `${downloadFileName}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div
      className={`flex flex-col lg:flex-row lg:items-center justify-between gap-2.5 sm:gap-3 p-2.5 sm:px-3 sm:py-2.5 rounded-[5px] border transition-colors ${
        isPrimary
          ? "border-[var(--border)] bg-[var(--accent)]/20 hover:border-[var(--foreground)]/40"
          : "border-[var(--border)] bg-[var(--card)] hover:border-[var(--foreground)]/30"
      }`}
    >
      {/* Left side: [QR 44x44] + Identity (Name + Badge + Subtitle) + [Download] */}
      <div className="flex items-center gap-2.5 min-w-0 flex-1">
        {/* Compact QR Thumbnail */}
        <div className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-[4px] bg-white p-0.5 border border-[var(--border)] shadow-2xs">
          {isGenerating ? (
            <Loader2 size={14} className="animate-spin text-neutral-400" />
          ) : qrDataUrl ? (
            <img
              src={qrDataUrl}
              alt={`QR code for ${title}`}
              className="h-full w-full object-contain"
            />
          ) : (
            <QrCode size={18} className="text-neutral-400" />
          )}
        </div>

        {/* Identity */}
        <div className="min-w-0 flex-1 pr-1">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="font-semibold text-xs text-[var(--foreground)] truncate max-w-[150px] sm:max-w-[200px]">
              {title}
            </span>
            <span
              className={`font-mono text-[9px] uppercase tracking-wider px-1.5 py-0.2 rounded-[4px] border ${
                isPrimary
                  ? "bg-[var(--accent)] text-[var(--foreground)] border-[var(--border)] font-semibold"
                  : "bg-[var(--background)] text-[var(--muted-foreground)] border-[var(--border)]"
              }`}
            >
              {badge}
            </span>
          </div>

          <p
            className="text-[11px] text-[var(--muted-foreground)] truncate max-w-[220px] sm:max-w-[280px] leading-tight mt-0.5"
            title={subtitle}
          >
            {subtitle}
          </p>
        </div>

        {/* Compact Download Button */}
        <button
          onClick={handleDownload}
          disabled={!qrDataUrl || isGenerating}
          className="shrink-0 inline-flex items-center gap-1 px-2.5 py-1 rounded-[4px] border border-[var(--border)] bg-[var(--card)] hover:bg-[var(--accent)] text-[11px] font-medium text-[var(--foreground)] transition-colors cursor-pointer disabled:opacity-50"
          title="Download 512x512 high-resolution PNG"
        >
          <Download size={11} />
          <span>Download</span>
        </button>
      </div>

      {/* Vertical divider on desktop */}
      <div className="hidden lg:block w-px self-stretch bg-[var(--border)] my-0.5" />

      {/* Right side: URL + Copy + Open */}
      <div className="flex items-center gap-1.5 min-w-0 lg:w-[48%] pt-1 lg:pt-0 border-t lg:border-t-0 border-[var(--border)]">
        <div className="flex items-center gap-1.5 flex-1 min-w-0 rounded-[4px] border border-[var(--border)] bg-[var(--background)] px-2 py-1">
          <span
            className="font-mono text-[11px] text-[var(--foreground)] truncate flex-1 select-all"
            title={url}
          >
            {url}
          </span>
          <button
            onClick={handleCopy}
            className="shrink-0 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-[3px] hover:bg-[var(--accent)] text-[10px] font-mono text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors cursor-pointer"
            title="Copy link to clipboard"
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
        </div>

        <a
          href={url}
          target="_blank"
          rel="noreferrer"
          className="shrink-0 inline-flex items-center justify-center h-6.5 w-6.5 rounded-[4px] border border-[var(--border)] bg-[var(--background)] hover:bg-[var(--accent)] text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors"
          title="Open public profile in new tab"
        >
          <ExternalLink size={12} />
        </a>
      </div>
    </div>
  );
};
