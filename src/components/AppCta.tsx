"use client";

import { useState } from "react";
import { ArrowUpRight, Check } from "lucide-react";
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

export default function AppCta({ profileId }: { profileId: string }) {
  const [confirmed, setConfirmed] = useState(false);

  if (!appIsLive) {
    // The app isn't published yet — never dangle a button that leads
    // nowhere. This page already *is* the full experience.
    return (
      <button
        type="button"
        onClick={() => setConfirmed(true)}
        className="flex w-full items-center justify-center gap-2 rounded-2xl border border-ink-900/10 bg-white px-4 py-3.5 text-sm font-medium text-ink-800 transition hover:bg-ink-900/5"
      >
        {confirmed ? (
          <>
            <Check size={16} className="text-emerald-600" />
            You&rsquo;re all set — this is the full Namma Info experience
          </>
        ) : (
          "Continue in Web App"
        )}
      </button>
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
