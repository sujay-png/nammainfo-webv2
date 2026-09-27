"use client";

import Link from "next/link";
import type { Profile, Employee } from "@/lib/supabase/types";
import { initials } from "@/lib/utils";
import {
  Download,
  Phone,
  Mail,
  Globe,
  Share2,
  Eye,
  ArrowLeft,
  Briefcase,
  Building2,
} from "lucide-react";

export default function EmployeeCardView({
  employee,
  owner,
}: {
  employee: Employee;
  owner: Profile;
}) {
  const profileUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/${owner.username}/${employee.slug}`
      : "";

  const ownerUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/${owner.username}`
      : `/${owner.username}`;

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
      alert("Link copied!");
    }
  }

  return (
    <main className="mx-auto min-h-dvh max-w-lg bg-white">
      {/* Hero — Employee Card */}
      <div className="relative overflow-hidden bg-ink-950 px-6 pb-8 pt-10 text-white">
        <div className="pointer-events-none absolute -right-20 -top-20 h-60 w-60 rounded-full bg-white/[0.03] blur-3xl" />
        <div className="pointer-events-none absolute -bottom-20 -left-10 h-48 w-48 rounded-full bg-white/[0.02] blur-3xl" />

        {/* Back to company */}
        <Link
          href={ownerUrl}
          className="relative mb-5 inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-xs font-medium text-white/70 backdrop-blur transition hover:bg-white/20 hover:text-white"
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
                className="h-16 w-16 rounded-2xl object-cover ring-1 ring-white/10"
              />
            ) : (
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/10 text-xl font-bold ring-1 ring-white/10">
                {initials(employee.name)}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <h1 className="text-xl font-semibold leading-tight">
                {employee.name}
              </h1>
              <p className="mt-0.5 text-sm text-white/60">
                {employee.designation}
              </p>
              <div className="mt-2 flex items-center gap-1.5 text-xs text-white/40">
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
          className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-ink-950 px-3 py-3.5 text-xs font-semibold text-white shadow-card-lg transition hover:bg-ink-800"
        >
          <Download size={15} />
          Add to Contacts
        </button>
        <Link
          href={ownerUrl}
          className="flex flex-1 items-center justify-center gap-2 rounded-2xl border border-ink-200 bg-white px-3 py-3.5 text-xs font-semibold text-ink-900 shadow-card transition hover:shadow-card-hover"
        >
          <Eye size={15} />
          View Company
        </Link>
      </div>

      {/* Quick Contact */}
      <div className="grid grid-cols-3 gap-2 px-4">
        {employee.phone && (
          <a
            href={`tel:${employee.phone}`}
            className="flex flex-col items-center gap-1.5 rounded-2xl border border-ink-100 bg-white p-3.5 text-center transition hover:shadow-card"
          >
            <Phone size={18} className="text-ink-700" />
            <span className="text-[11px] font-medium text-ink-500">Call</span>
          </a>
        )}
        {employee.email && (
          <a
            href={`mailto:${employee.email}`}
            className="flex flex-col items-center gap-1.5 rounded-2xl border border-ink-100 bg-white p-3.5 text-center transition hover:shadow-card"
          >
            <Mail size={18} className="text-ink-700" />
            <span className="text-[11px] font-medium text-ink-500">Email</span>
          </a>
        )}
        <button
          onClick={shareProfile}
          className="flex flex-col items-center gap-1.5 rounded-2xl border border-ink-100 bg-white p-3.5 text-center transition hover:shadow-card"
        >
          <Share2 size={18} className="text-ink-700" />
          <span className="text-[11px] font-medium text-ink-500">Share</span>
        </button>
      </div>

      {/* Employee Details */}
      <div className="mt-6 space-y-5 px-4 pb-24">
        {/* Role Info */}
        <section className="rounded-2xl border border-ink-100 bg-white p-5">
          <h2 className="mb-3 text-sm font-semibold text-ink-900">
            About
          </h2>
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <Briefcase size={16} className="mt-0.5 shrink-0 text-ink-400" />
              <div>
                <p className="text-sm font-medium text-ink-800">
                  {employee.designation}
                </p>
                <p className="text-xs text-ink-400">Designation</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Building2 size={16} className="mt-0.5 shrink-0 text-ink-400" />
              <div>
                <p className="text-sm font-medium text-ink-800">
                  {owner.business_name ?? "—"}
                </p>
                <p className="text-xs text-ink-400">Company</p>
              </div>
            </div>
            {owner.website && (
              <div className="flex items-start gap-3">
                <Globe size={16} className="mt-0.5 shrink-0 text-ink-400" />
                <div>
                  <a
                    href={owner.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm font-medium text-ink-800 underline decoration-ink-200 underline-offset-2 hover:decoration-ink-400"
                  >
                    {owner.website.replace(/^https?:\/\//, "")}
                  </a>
                  <p className="text-xs text-ink-400">Website</p>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* CTA — Create profile */}
        <section className="rounded-2xl border border-ink-200 bg-ink-50 p-5 text-center">
          <p className="mb-1 text-sm font-semibold text-ink-800">
            Create your own Namma Info profile
          </p>
          <p className="mb-4 text-xs text-ink-400">
            Get your digital business card and start sharing instantly
          </p>
          <Link
            href="/signup"
            className="inline-flex items-center gap-2 rounded-xl bg-ink-950 px-5 py-2.5 text-xs font-semibold text-white transition hover:bg-ink-800"
          >
            Get Started
          </Link>
        </section>
      </div>

      {/* Footer */}
      <div className="border-t border-ink-100 py-6 text-center">
        <p className="text-[11px] text-ink-300">
          Powered by{" "}
          <Link href="/" className="font-medium text-ink-500 hover:text-ink-700">
            Namma Info
          </Link>
        </p>
      </div>
    </main>
  );
}
