"use client";

import React from "react";
import Link from "next/link";
import { Lock, AlertCircle, ShieldAlert, Sparkles, ArrowRight, ExternalLink } from "lucide-react";
import type { Profile } from "@/lib/supabase/types";

interface GatedProfileViewProps {
  profile: Profile;
  reason: "free" | "expired" | "suspended";
}

export default function GatedProfileView({ profile, reason }: GatedProfileViewProps) {
  const businessName = profile.business_name || profile.owner_name || "Namma Info Member";
  const avatarText = (businessName.charAt(0) || "N").toUpperCase();

  return (
    <div className="min-h-screen bg-[var(--background)] flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md mx-auto space-y-6 text-center">
        {/* Brand / Profile Avatar */}
        <div className="relative mx-auto w-24 h-24">
          <div className="w-24 h-24 rounded-3xl bg-[var(--accent)] border border-[var(--border)] overflow-hidden flex items-center justify-center shadow-lg">
            {profile.logo_url || profile.avatar_url ? (
              <img
                src={profile.logo_url || profile.avatar_url || ""}
                alt={businessName}
                className="w-full h-full object-cover"
              />
            ) : (
              <span className="font-headline text-3xl font-bold text-[var(--foreground)]">
                {avatarText}
              </span>
            )}
          </div>

          <div className="absolute -bottom-2 -right-2 p-2 rounded-2xl bg-[var(--card)] border border-[var(--border)] shadow-md">
            {reason === "free" && <Lock size={18} className="text-blue-500" />}
            {reason === "expired" && <AlertCircle size={18} className="text-amber-500" />}
            {reason === "suspended" && <ShieldAlert size={18} className="text-rose-500" />}
          </div>
        </div>

        {/* Business Title & Tag */}
        <div className="space-y-1">
          <h1 className="font-headline text-2xl font-bold text-[var(--foreground)] tracking-tight">
            {businessName}
          </h1>
          {profile.username && (
            <p className="font-mono text-xs text-[var(--muted-foreground)]">
              @{profile.username}
            </p>
          )}
        </div>

        {/* Notice Card */}
        <div className="rounded-3xl border border-[var(--border)] bg-[var(--card)] p-6 space-y-4 shadow-sm text-left">
          {reason === "free" && (
            <>
              <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400 font-semibold text-sm">
                <Lock size={16} />
                <span>Profile Available on Pro Plan</span>
              </div>
              <p className="text-xs leading-relaxed text-[var(--muted-foreground)]">
                This business is currently using the <strong>Free Tier</strong> of Namma Info.
                Ask them to upgrade to a <strong>Pro plan</strong> so they can share their custom profile URL, digital catalog, and physical NFC business card!
              </p>
            </>
          )}

          {reason === "expired" && (
            <>
              <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 font-semibold text-sm">
                <AlertCircle size={16} />
                <span>Card Subscription Expired</span>
              </div>
              <p className="text-xs leading-relaxed text-[var(--muted-foreground)]">
                This business profile is temporarily inactive because its annual NFC card subscription has expired. Once the owner renews their plan, access will be restored immediately.
              </p>
            </>
          )}

          {reason === "suspended" && (
            <>
              <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400 font-semibold text-sm">
                <ShieldAlert size={16} />
                <span>Account Suspended</span>
              </div>
              <p className="text-xs leading-relaxed text-[var(--muted-foreground)]">
                This profile is temporarily suspended. If you are the owner, please check your administrative status or contact support.
              </p>
            </>
          )}

          {/* Owner CTA */}
          <div className="pt-3 border-t border-[var(--border)] space-y-2">
            <p className="text-[11px] font-semibold text-[var(--foreground)] uppercase tracking-wider">
              Are you the owner of this business?
            </p>
            <Link
              href="/dashboard/home"
              className="flex items-center justify-between w-full px-4 py-2.5 rounded-xl bg-[var(--primary)] text-[var(--primary-foreground)] text-xs font-semibold hover:opacity-95 transition-opacity"
            >
              <span>{reason === "expired" ? "Log in to Renew Subscription" : "Log in to Upgrade to Pro"}</span>
              <ArrowRight size={14} />
            </Link>
          </div>
        </div>

        {/* Footer Promo */}
        <div className="space-y-2">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-xs text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors"
          >
            <Sparkles size={13} className="text-blue-500" />
            <span>Get your own smart NFC business card at <strong>Namma Info</strong></span>
          </Link>
        </div>
      </div>
    </div>
  );
}
