"use client";

import { useEffect, useState } from "react";
import { ArrowDown, Download, PlusSquare, Share, X } from "lucide-react";

/* ------------------------------------------------------------------ */
/*  "Add to Home Screen" for the owner dashboard                         */
/*                                                                      */
/*  Android / Chrome / Samsung Internet / Edge: the browser's install    */
/*  event is captured and our sheet shows a real "Install app" button.   */
/*  iPhone / iPad: Apple doesn't let websites trigger installs, so the   */
/*  sheet shows the 3 Safari steps (Share → Add to Home Screen → Add).   */
/*  Never shown once installed; "Not now" hides it for 7 days.           */
/*  Settings ▸ "Add to home screen" can open it any time.                */
/* ------------------------------------------------------------------ */

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const SNOOZE_KEY = "nammainfo:installPromptSnoozedAt";
const INSTALLED_KEY = "nammainfo:appInstalled";
const SNOOZE_DAYS = 7;
export const SHOW_INSTALL_EVENT = "nammainfo:show-install";

// Captured as early as possible (when this chunk loads) — the browser can
// fire it before React has mounted the component.
let deferredPrompt: BeforeInstallPromptEvent | null = null;
const listeners = new Set<() => void>();
if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault(); // stop Chrome's own mini banner; we show ours
    deferredPrompt = e as BeforeInstallPromptEvent;
    listeners.forEach((fn) => fn());
  });
  window.addEventListener("appinstalled", () => {
    deferredPrompt = null;
    try {
      localStorage.setItem(INSTALLED_KEY, "1");
    } catch {}
    listeners.forEach((fn) => fn());
  });
}

export function isRunningAsApp(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

type Platform = "android" | "ios-safari" | "ios-other" | "ios-inapp" | "none";

function detectPlatform(): Platform {
  const ua = navigator.userAgent;
  const isIOS =
    /iPad|iPhone|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  if (isIOS) {
    if (/FBAN|FBAV|Instagram|Line\/|LinkedInApp|Snapchat|GSA\//i.test(ua)) return "ios-inapp";
    if (/CriOS|FxiOS|EdgiOS|OPiOS/i.test(ua)) return "ios-other";
    return "ios-safari";
  }
  return deferredPrompt ? "android" : "none";
}

export default function InstallAppPrompt() {
  const [open, setOpen] = useState(false);
  const [platform, setPlatform] = useState<Platform>("none");
  const [installing, setInstalling] = useState(false);

  useEffect(() => {
    // Register the (no-cache) service worker that makes the app installable.
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
    if (isRunningAsApp()) {
      try {
        localStorage.setItem(INSTALLED_KEY, "1");
      } catch {}
      return;
    }

    function snoozed() {
      try {
        if (localStorage.getItem(INSTALLED_KEY) === "1") return true;
        const at = Number(localStorage.getItem(SNOOZE_KEY) || 0);
        return Date.now() - at < SNOOZE_DAYS * 86_400_000;
      } catch {
        return false;
      }
    }

    let timer: ReturnType<typeof setTimeout> | undefined;
    function maybeShow(force = false) {
      const p = detectPlatform();
      setPlatform(p);
      if (p === "none") return;
      if (!force && snoozed()) return;
      clearTimeout(timer);
      // Small delay so it doesn't jump at people the instant the page opens.
      timer = setTimeout(() => setOpen(true), force ? 0 : 2500);
    }

    const onPromptReady = () => {
      if (!deferredPrompt) {
        setOpen(false); // installed
        return;
      }
      maybeShow();
    };
    const onForceShow = () => maybeShow(true);

    listeners.add(onPromptReady);
    window.addEventListener(SHOW_INSTALL_EVENT, onForceShow);
    maybeShow();
    return () => {
      clearTimeout(timer);
      listeners.delete(onPromptReady);
      window.removeEventListener(SHOW_INSTALL_EVENT, onForceShow);
    };
  }, []);

  function notNow() {
    try {
      localStorage.setItem(SNOOZE_KEY, String(Date.now()));
    } catch {}
    setOpen(false);
  }

  async function install() {
    if (!deferredPrompt) return;
    setInstalling(true);
    try {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      deferredPrompt = null;
      if (outcome === "accepted") {
        try {
          localStorage.setItem(INSTALLED_KEY, "1");
        } catch {}
        setOpen(false);
      } else {
        notNow();
      }
    } finally {
      setInstalling(false);
    }
  }

  if (!open) return null;

  const isPhoneIOS = platform.startsWith("ios") && /iPhone|iPod/.test(navigator.userAgent);

  return (
    <div
      className="fixed inset-0 z-[95] flex items-end justify-center bg-black/50 backdrop-blur-[2px] sm:items-center"
      onClick={notNow}
      role="dialog"
      aria-modal="true"
      aria-labelledby="install-title"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-md animate-slide-up rounded-t-[28px] bg-[var(--background)] px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-3 shadow-2xl sm:rounded-[28px] sm:pb-6"
      >
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-[var(--border)] sm:hidden" />
        <button
          type="button"
          onClick={notNow}
          aria-label="Close"
          className="absolute right-4 top-4 rounded-full p-2 text-[var(--muted-foreground)] transition hover:bg-[var(--muted)]"
        >
          <X size={18} />
        </button>

        <div className="flex items-center gap-4 pr-8">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/icons/icon-192.png"
            alt=""
            className="h-14 w-14 shrink-0 rounded-[16px] shadow-[0_8px_20px_-8px_rgba(0,0,0,0.5)] ring-1 ring-black/5"
          />
          <div>
            <h2 id="install-title" className="font-headline text-lg font-semibold leading-tight tracking-tight text-[var(--foreground)]">
              Add Namma Info to your home screen
            </h2>
            <p className="mt-1 text-xs leading-relaxed text-[var(--muted-foreground)]">
              Open your card, taps and saved cards in one tap. Full screen, just like an app.
            </p>
          </div>
        </div>

        {platform === "android" && (
          <>
            <button
              type="button"
              onClick={install}
              disabled={installing}
              className="mt-6 flex w-full items-center justify-center gap-2 rounded-2xl bg-[var(--primary)] py-4 text-sm font-semibold text-[var(--primary-foreground)] transition active:scale-[0.99] disabled:opacity-60"
            >
              <Download size={17} />
              {installing ? "Installing…" : "Install app"}
            </button>
            <p className="mt-2 text-center text-[11px] text-[var(--muted-foreground)]">
              Free, and uses almost no storage.
            </p>
          </>
        )}

        {platform === "ios-safari" || platform === "ios-other" ? (
          <ol className="mt-6 space-y-3">
            <Step n={1}>
              Tap the{" "}
              <Pill>
                <Share size={14} /> Share
              </Pill>{" "}
              button {platform === "ios-safari" ? (isPhoneIOS ? "at the bottom of Safari" : "at the top of Safari") : "in the address bar"}
            </Step>
            <Step n={2}>
              Scroll down and tap{" "}
              <Pill>
                <PlusSquare size={14} /> Add to Home Screen
              </Pill>
            </Step>
            <Step n={3}>
              Tap <Pill>Add</Pill> in the top corner
            </Step>
          </ol>
        ) : null}

        {platform === "ios-inapp" && (
          <div className="mt-6 rounded-2xl bg-[var(--muted)] p-4 text-sm leading-relaxed text-[var(--foreground)]">
            This page is open inside another app. Tap the <strong>⋯</strong> menu and choose{" "}
            <strong>Open in Safari</strong>, then you can add it to your home screen.
          </div>
        )}

        <button
          type="button"
          onClick={notNow}
          className="mt-3 w-full py-3 text-sm font-medium text-[var(--muted-foreground)] transition hover:text-[var(--foreground)]"
        >
          {platform === "android" ? "Not now" : "Got it"}
        </button>
      </div>

      {/* Pointer to Safari's Share button on iPhone (bottom toolbar) */}
      {platform === "ios-safari" && isPhoneIOS && (
        <div className="pointer-events-none fixed bottom-1 left-1/2 z-[96] -translate-x-1/2 animate-bounce text-white drop-shadow">
          <ArrowDown size={22} strokeWidth={2.5} />
        </div>
      )}
    </div>
  );
}

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-3 text-sm leading-relaxed text-[var(--foreground)]">
      <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--muted)] font-mono text-[11px] font-semibold">
        {n}
      </span>
      <span>{children}</span>
    </li>
  );
}

function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span className="mx-0.5 inline-flex items-center gap-1 whitespace-nowrap rounded-lg border border-[var(--border)] bg-[var(--card)] px-2 py-0.5 text-[13px] font-semibold align-middle">
      {children}
    </span>
  );
}
