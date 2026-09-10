"use client";

import { Phone, Mail, Globe, Share2 } from "lucide-react";
import type { Profile } from "@/lib/supabase/types";
import { cardUniversalLink } from "@/lib/deeplink";

function Action({
  href,
  label,
  icon,
}: {
  href: string;
  label: string;
  icon: React.ReactNode;
}) {
  return (
    <a
      href={href}
      className="flex flex-col items-center gap-1.5 rounded-2xl border border-ink-900/10 bg-white px-3 py-3 text-center transition hover:-translate-y-0.5 hover:shadow-card"
    >
      <span className="text-ink-900">{icon}</span>
      <span className="text-[11px] font-medium text-ink-700">{label}</span>
    </a>
  );
}

export default function ContactButtons({
  profile,
  cardSlug,
}: {
  profile: Profile;
  cardSlug: string;
}) {
  async function share() {
    const url = cardUniversalLink(cardSlug);
    const shareData = {
      title: profile.business_name ?? "Namma Info",
      text: `${profile.owner_name ?? ""} · ${profile.business_name ?? ""}`.trim(),
      url,
    };
    if (navigator.share) {
      try {
        await navigator.share(shareData);
      } catch {
        // user cancelled — no-op
      }
    } else {
      await navigator.clipboard.writeText(url);
      alert("Link copied to clipboard");
    }
  }

  return (
    <div className="grid grid-cols-4 gap-2.5">
      {profile.phone && (
        <Action href={`tel:${profile.phone}`} label="Call" icon={<Phone size={18} />} />
      )}
      {profile.email && (
        <Action href={`mailto:${profile.email}`} label="Email" icon={<Mail size={18} />} />
      )}
      {profile.website && (
        <Action
          href={profile.website}
          label="Website"
          icon={<Globe size={18} />}
        />
      )}
      <button
        onClick={share}
        className="flex flex-col items-center gap-1.5 rounded-2xl border border-ink-900/10 bg-white px-3 py-3 text-center transition hover:-translate-y-0.5 hover:shadow-card"
      >
        <Share2 size={18} className="text-ink-900" />
        <span className="text-[11px] font-medium text-ink-700">Share</span>
      </button>
    </div>
  );
}
