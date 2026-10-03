"use client";

import { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import type { Profile, Card, Review, Employee } from "@/lib/supabase/types";
import { initials } from "@/lib/utils";
import { getTheme } from "@/lib/themes";
import PublicProfileView from "./PublicProfileView";
import {
  Download,
  Phone,
  Mail,
  Share2,
  ArrowLeft,
  Briefcase,
  Building2,
} from "lucide-react";

export default function EmployeeProfileView({
  employee,
  owner,
  card,
  reviews,
  employees,
}: {
  employee: Employee;
  owner: Profile;
  card: Card | null;
  reviews: Review[];
  employees: Employee[];
}) {
  const ownerTheme = getTheme(owner.theme);
  const [themeMode, setThemeMode] = useState<"light" | "dark">("light");

  useEffect(() => {
    const isDark =
      document.documentElement.classList.contains("dark") ||
      window.matchMedia("(prefers-color-scheme: dark)").matches;
    setThemeMode(isDark ? "dark" : "light");
  }, []);

  const themeVars = useMemo(() => {
    const vars = ownerTheme.colors[themeMode];
    return vars as Record<string, string>;
  }, [ownerTheme, themeMode]);

  const [profileUrl, setProfileUrl] = useState("");

  useEffect(() => {
    setProfileUrl(
      `${window.location.origin}/${owner.username}/${employee.slug}`
    );
  }, [owner.username, employee.slug]);

  const ownerUrl = owner.username ? `/${owner.username}` : "/";

  function saveContact() {
    const vcardContent = [
      "BEGIN:VCARD",
      "VERSION:3.0",
      `FN:${employee.name}`,
      `ORG:${owner.business_name ?? ""}`,
      `TITLE:${employee.designation}`,
      employee.phone ? `TEL;TYPE=WORK:${employee.phone}` : "",
      employee.email ? `EMAIL:${employee.email}` : "",
      owner.website ? `URL:${owner.website}` : "",
      owner.address ? `ADR;TYPE=WORK:;;${owner.address};;;;` : "",
      "END:VCARD",
    ]
      .filter(Boolean)
      .join("\r\n");

    const blob = new Blob([vcardContent], { type: "text/vcard" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${employee.name.replace(/[^a-z0-9 ]/gi, "").trim()}.vcf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  async function shareProfile() {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `${employee.name} · ${owner.business_name ?? "Namma Info"}`,
          text: `${employee.name} — ${employee.designation} at ${owner.business_name ?? "Namma Info"}`,
          url: profileUrl,
        });
      } catch {
        /* cancelled */
      }
    } else {
      await navigator.clipboard.writeText(profileUrl);
    }
  }

  return (
    <div style={themeVars as React.CSSProperties}>
      {/* ===== Employee Hero Section ===== */}
      <div className="mx-auto max-w-lg bg-[var(--background)]">
        <div className="relative overflow-hidden bg-[var(--foreground)] px-6 pb-8 pt-10">
          {/* Cover photo background */}
          {employee.cover_url && (
            <img
              src={employee.cover_url}
              alt=""
              className="absolute inset-0 h-full w-full object-cover opacity-30"
            />
          )}
          {/* Back to company */}
          <Link
            href={ownerUrl}
            className="relative mb-5 inline-flex items-center gap-1.5 rounded-full bg-[var(--background)]/10 px-3 py-1.5 text-xs font-medium text-[var(--background)]/70 backdrop-blur transition hover:bg-[var(--background)]/20 hover:text-[var(--background)]"
          >
            <ArrowLeft size={12} />
            {owner.business_name ?? "View Company"}
          </Link>

          <div className="relative">

            {/* Avatar + name */}
            <div className="flex items-start gap-4">
              {employee.avatar_url ? (
                <img
                  src={employee.avatar_url}
                  alt=""
                  className="h-16 w-16 rounded-2xl object-cover ring-1 ring-[var(--background)]/10"
                />
              ) : (
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--background)]/10 text-xl font-bold text-[var(--background)] ring-1 ring-[var(--background)]/10">
                  {initials(employee.name)}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <h1 className="text-xl font-semibold leading-tight text-[var(--background)]">
                  {employee.name}
                </h1>
                <p className="mt-0.5 text-sm text-[var(--background)]/60">
                  {employee.designation}
                </p>
                <div className="mt-2 flex items-center gap-1.5 text-xs text-[var(--background)]/40">
                  <Building2 size={11} />
                  <span>{owner.business_name ?? "Namma Info"}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2 px-4 -translate-y-5">
          <button
            onClick={saveContact}
            className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-[var(--foreground)] px-3 py-3.5 text-xs font-semibold text-[var(--background)] shadow-card-lg transition hover:opacity-90"
          >
            <Download size={15} />
            Add to Contacts
          </button>
          <button
            onClick={shareProfile}
            className="flex flex-1 items-center justify-center gap-2 rounded-2xl border border-[var(--border)] bg-[var(--card)] px-3 py-3.5 text-xs font-semibold text-[var(--foreground)] shadow-card transition hover:shadow-card-hover"
          >
            <Share2 size={15} />
            Share Profile
          </button>
        </div>

        {/* Quick Contact */}
        <div className="flex gap-2 px-4 pb-2">
          {employee.phone && (
            <a
              href={`tel:${employee.phone}`}
              className="flex flex-1 flex-col items-center gap-1.5 rounded-2xl border border-[var(--border)] bg-[var(--card)] p-3.5 text-center transition hover:shadow-card"
            >
              <Phone size={18} className="text-[var(--foreground)]" />
              <span className="text-[11px] font-medium text-[var(--muted-foreground)]">Call</span>
            </a>
          )}
          {employee.email && (
            <a
              href={`mailto:${employee.email}`}
              className="flex flex-1 flex-col items-center gap-1.5 rounded-2xl border border-[var(--border)] bg-[var(--card)] p-3.5 text-center transition hover:shadow-card"
            >
              <Mail size={18} className="text-[var(--foreground)]" />
              <span className="text-[11px] font-medium text-[var(--muted-foreground)]">Email</span>
            </a>
          )}
        </div>

        {/* Employee About card */}
        <div className="px-4 pb-2 pt-2">
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4">
            <h2 className="mb-3 text-sm font-semibold text-[var(--foreground)]">About</h2>
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <Briefcase size={16} className="mt-0.5 shrink-0 text-[var(--muted-foreground)]" />
                <div>
                  <p className="text-sm font-medium text-[var(--foreground)]">
                    {employee.designation}
                  </p>
                  <p className="text-xs text-[var(--muted-foreground)]">Designation</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Building2 size={16} className="mt-0.5 shrink-0 text-[var(--muted-foreground)]" />
                <div>
                  <p className="text-sm font-medium text-[var(--foreground)]">
                    {owner.business_name ?? "—"}
                  </p>
                  <p className="text-xs text-[var(--muted-foreground)]">Company</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Divider label */}
        <div className="px-5 py-3">
          <p className="text-center font-mono text-[10px] font-semibold uppercase tracking-widest text-[var(--muted-foreground)]">
            Company Profile
          </p>
        </div>
      </div>

      {/* ===== Full Company Profile (reusing PublicProfileView) ===== */}
      <PublicProfileView
        profile={owner}
        card={card}
        reviews={reviews}
        employees={employees}
        isEmployeeView
      />
    </div>
  );
}
