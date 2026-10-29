"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Bookmark, Check, ChevronRight, Copy, ExternalLink, Phone, Share2, UserRound } from "lucide-react";
import { createClient } from "@/supabase/client";
import { employeeCardUrl, useAccount } from "@/hooks/use-account";
import { formatDistanceToNow } from "@/lib/utils";
import type { ContactRow } from "@/supabase/database-types";
import EmployeeCardPreview from "@/features/employee-dashboard/components/employee-card-preview";
import Avatar from "@/components/ui/avatar";
import { ui } from "@/components/ui/sheet";

export default function EmployeeHome() {
  const { employee, userId } = useAccount();
  const [savedCount, setSavedCount] = useState<number | null>(null);
  const [contactCount, setContactCount] = useState<number | null>(null);
  const [recent, setRecent] = useState<ContactRow[]>([]);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!userId) return;
    const supabase = createClient();
    Promise.all([
      supabase.from("connections").select("connected_user_id", { count: "exact", head: true }).eq("user_id", userId),
      supabase.from("contacts").select("*", { count: "exact" }).order("last_seen_at", { ascending: false }).limit(3),
    ]).then(([saved, contacts]) => {
      setSavedCount(saved.count ?? 0);
      setContactCount(contacts.count ?? 0);
      setRecent((contacts.data as ContactRow[] | null) ?? []);
    });
  }, [userId]);

  if (!employee) {
    return (
      <div className="mx-auto max-w-lg px-4 py-10">
        <div className="rounded-xl border border-dashed border-[var(--border)] px-6 py-12 text-center">
          <p className="text-sm font-medium">Your login is paused</p>
          <p className="mt-1 text-[13px] text-[var(--muted-foreground)]">Please contact your manager to get access again.</p>
        </div>
      </div>
    );
  }

  const url = employeeCardUrl(employee);
  const first = employee.name.split(" ")[0];
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  async function share() {
    if (!url) return;
    if (navigator.share) {
      try {
        await navigator.share({ title: employee!.name, url });
        return;
      } catch {}
    }
    navigator.clipboard?.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  const iconBtn =
    "flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--card)] text-[var(--muted-foreground)] transition hover:bg-[var(--muted)] hover:text-[var(--foreground)]";

  return (
    <div className="mx-auto max-w-lg space-y-5 px-4 pb-8 pt-5">
      <div className="px-1">
        <h1 className="text-[22px] font-semibold tracking-[-0.02em]">
          {greeting}, {first}
        </h1>
        <p className="mt-0.5 text-[13px] text-[var(--muted-foreground)]">
          Your card at {employee.owner_business_name ?? "your company"}
        </p>
      </div>

      <EmployeeCardPreview employee={employee} />

      {url && (
        <div className="flex gap-2">
          <button type="button" onClick={share} className={`${ui.primary} flex-1`}>
            {copied ? <Check size={16} /> : <Share2 size={16} />}
            {copied ? "Link copied" : "Share my card"}
          </button>
          <button
            type="button"
            onClick={() => {
              navigator.clipboard?.writeText(url);
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            }}
            aria-label="Copy link"
            title="Copy link"
            className={iconBtn}
          >
            <Copy size={16} />
          </button>
          <a href={url} target="_blank" rel="noopener noreferrer" aria-label="Open my card" title="Open my card" className={iconBtn}>
            <ExternalLink size={16} />
          </a>
        </div>
      )}

      <div className="grid grid-cols-2 divide-x divide-[var(--border)] overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--card)]">
        <Link href="/dashboard/saved" className="px-4 py-3.5 transition hover:bg-[var(--muted)]">
          <p className="flex items-center gap-1.5 text-[13px] text-[var(--muted-foreground)]">
            <Bookmark size={14} /> Saved cards
          </p>
          <p className="mt-1 text-2xl font-semibold tabular-nums tracking-tight">{savedCount ?? "–"}</p>
        </Link>
        <Link href="/dashboard/saved?tab=contacts" className="px-4 py-3.5 transition hover:bg-[var(--muted)]">
          <p className="flex items-center gap-1.5 text-[13px] text-[var(--muted-foreground)]">
            <UserRound size={14} /> Contacts
          </p>
          <p className="mt-1 text-2xl font-semibold tabular-nums tracking-tight">{contactCount ?? "–"}</p>
        </Link>
      </div>

      {recent.length > 0 && (
        <section>
          <div className="mb-2 flex items-center justify-between px-1">
            <h2 className="text-[13px] font-medium text-[var(--muted-foreground)]">Recent contacts</h2>
            <Link href="/dashboard/saved?tab=contacts" className="flex items-center text-[13px] text-[var(--muted-foreground)] hover:text-[var(--foreground)]">
              View all <ChevronRight size={14} />
            </Link>
          </div>
          <ul className="divide-y divide-[var(--border)] overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--card)]">
            {recent.map((c) => (
              <li key={c.id} className="flex items-center gap-3 px-3.5 py-3">
                <Avatar name={c.name} size={36} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[15px] font-medium">{c.name}</p>
                  <p className="truncate text-[13px] tabular-nums text-[var(--muted-foreground)]">
                    {(c.phone && /^\d{10}$/.test(c.phone) ? `+91 ${c.phone.slice(0, 5)} ${c.phone.slice(5)}` : c.phone) || c.email || "Business card photo"} · {formatDistanceToNow(c.last_seen_at)}
                  </p>
                </div>
                {c.phone && (
                  <a
                    href={`tel:${c.phone}`}
                    aria-label={`Call ${c.name}`}
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[var(--border)] text-[var(--foreground)] transition hover:bg-[var(--muted)]"
                  >
                    <Phone size={16} />
                  </a>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
