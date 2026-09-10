"use client";

import Link from "next/link";
import { ArrowUpRight, UserPlus } from "lucide-react";
import {
  appIsLive,
  profileDeepLink,
  playStoreUrl,
  appStoreUrl,
} from "@/lib/deeplink";

function isAndroid() {
  return typeof navigator !== "undefined" && /android/i.test(navigator.userAgent);
}
function isIOS() {
  return (
    typeof navigator !== "undefined" && /iphone|ipad|ipod/i.test(navigator.userAgent)
  );
}

export default function AppCta({
  profileId,
  cardSlug,
}: {
  profileId: string;
  cardSlug?: string;
}) {
  if (!appIsLive) {
    // The app isn't published yet — this page already *is* the full
    // experience, so let them create their own card right here instead
    // of dangling a button that leads nowhere.
    return (
      <Link
        href={`/signup${cardSlug ? `?ref=${encodeURIComponent(cardSlug)}` : ""}`}
        className="flex w-full items-center justify-center gap-2 rounded-2xl border border-ink-900/10 bg-white px-4 py-3.5 text-sm font-medium text-ink-800 transition hover:bg-ink-900/5"
      >
        <UserPlus size={16} />
        Create your own Namma Info card
      </Link>
    );
  }

  function openApp() {
    const deepLink = profileDeepLink(profileId);
    const fallback = isAndroid() ? playStoreUrl : isIOS() ? appStoreUrl : "";
    const fallbackTimer = window.setTimeout(() => {
      if (fallback) window.location.href = fallback;
    }, 1200);

    window.addEventListener(
      "blur",
      () => window.clearTimeout(fallbackTimer),
      { once: true }
    );
    window.location.href = deepLink;
  }

  return (
    <button
      type="button"
      onClick={openApp}
      className="flex w-full items-center justify-center gap-2 rounded-2xl border border-ink-900/10 bg-white px-4 py-3.5 text-sm font-medium text-ink-800 transition hover:bg-ink-900/5"
    >
      Open in Namma Info App
      <ArrowUpRight size={16} />
    </button>
  );
}
