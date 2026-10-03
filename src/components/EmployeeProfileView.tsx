"use client";

import { useState, useMemo, useEffect } from "react";
import type { Profile, Card, Review, Employee } from "@/lib/supabase/types";
import { initials } from "@/lib/utils";
import { getTheme } from "@/lib/themes";
import PublicProfileView from "./PublicProfileView";
import {
  UserPlus,
  Phone,
  Mail,
  Share2,
  Globe,
} from "lucide-react";

/**
 * Ensure a URL string has a protocol prefix.
 */
function ensureProtocol(url: string): string {
  if (!url) return url;
  if (/^https?:\/\//i.test(url)) return url;
  return `https://${url}`;
}

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

  function saveContact() {
    const vcardContent = [
      "BEGIN:VCARD",
      "VERSION:3.0",
      `FN:${employee.name}`,
      `ORG:${owner.business_name ?? ""}`,
      `TITLE:${employee.designation}`,
      employee.phone ? `TEL;TYPE=WORK:${employee.phone}` : "",
      employee.email ? `EMAIL:${employee.email}` : "",
      owner.website ? `URL:${ensureProtocol(owner.website)}` : "",
      owner.address ? `ADR;TYPE=WORK:;;${owner.address};;;;` : "",
      `SOURCE:${profileUrl}`,
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
    <main
      className="mx-auto max-w-lg min-h-dvh bg-[var(--background)]"
      style={themeVars as React.CSSProperties}
    >
      {/* ===== Hero — Cover + Avatar (exact same layout as company profile) ===== */}
      <div className="relative">
        <div className="h-44 w-full overflow-hidden bg-[var(--foreground)]">
          {employee.cover_url ? (
            <img
              src={employee.cover_url}
              alt=""
              className="h-full w-full object-cover"
            />
          ) : owner.cover_url ? (
            <img
              src={owner.cover_url}
              alt=""
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="h-full w-full bg-[var(--foreground)]" />
          )}
        </div>
        <div className="absolute -bottom-12 left-5">
          <div className="h-24 w-24 overflow-hidden rounded-2xl border-4 border-[var(--card)] bg-[var(--accent)] shadow-card">
            {employee.avatar_url ? (
              <img
                src={employee.avatar_url}
                alt=""
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-[var(--foreground)] font-headline text-2xl font-bold text-[var(--background)]">
                {initials(employee.name)}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ===== Name + info ===== */}
      <div className="mt-14 px-5">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="font-headline text-xl font-bold text-[var(--foreground)]">
              {employee.name}
            </h1>
            <p className="text-sm text-[var(--muted-foreground)]">
              {[employee.designation, owner.business_name]
                .filter(Boolean)
                .join(" · ")}
            </p>
          </div>
        </div>
      </div>

      {/* ===== Action CTAs ===== */}
      <div className="mt-5 flex gap-2 px-5">
        <button
          onClick={saveContact}
          className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-[var(--foreground)] py-3.5 text-xs font-semibold text-[var(--background)] shadow-card-lg transition hover:opacity-90"
        >
          <UserPlus size={15} />
          Add to Contacts
        </button>
        {owner.website && (
          <a
            href={ensureProtocol(owner.website)}
            target="_blank"
            rel="noopener noreferrer"
            className="flex flex-1 items-center justify-center gap-2 rounded-2xl border border-[var(--border)] bg-[var(--card)] py-3.5 text-xs font-semibold text-[var(--foreground)] shadow-card transition hover:shadow-card-hover"
          >
            <Globe size={15} />
            Visit Website
          </a>
        )}
      </div>

      {/* ===== Quick contact ===== */}
      <div className="mt-4 grid grid-cols-3 gap-2 px-5">
        {employee.phone && (
          <a
            href={`tel:${employee.phone}`}
            className="flex flex-col items-center gap-1 rounded-2xl border border-[var(--border)] bg-[var(--card)] p-3 transition hover:shadow-card"
          >
            <Phone size={18} className="text-[var(--foreground)]" />
            <span className="text-[10px] font-medium text-[var(--muted-foreground)]">Call</span>
          </a>
        )}
        {employee.email && (
          <a
            href={`mailto:${employee.email}`}
            className="flex flex-col items-center gap-1 rounded-2xl border border-[var(--border)] bg-[var(--card)] p-3 transition hover:shadow-card"
          >
            <Mail size={18} className="text-[var(--foreground)]" />
            <span className="text-[10px] font-medium text-[var(--muted-foreground)]">Email</span>
          </a>
        )}
        <button
          onClick={shareProfile}
          className="flex flex-col items-center gap-1 rounded-2xl border border-[var(--border)] bg-[var(--card)] p-3 transition hover:shadow-card"
        >
          <Share2 size={18} className="text-[var(--foreground)]" />
          <span className="text-[10px] font-medium text-[var(--muted-foreground)]">Share</span>
        </button>
      </div>

      {/* ===== COMPANY PROFILE label ===== */}
      <div className="mt-6 px-5">
        <p className="text-center font-mono text-[10px] font-semibold uppercase tracking-widest text-[var(--muted-foreground)]">
          Company Profile
        </p>
      </div>

      {/* ===== Company sections (services, gallery, reviews, etc.) — no hero ===== */}
      <PublicProfileView
        profile={owner}
        card={card}
        reviews={reviews}
        employees={employees}
        isEmployeeView
        hideHero
      />
    </main>
  );
}
