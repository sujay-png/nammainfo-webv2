"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { BookmarkPlus, X } from "lucide-react";
import { queuePendingSave, type SavedCardSummary } from "@/features/saved-cards/services/saved-cards.service";
import { initials } from "@/lib/utils";

/**
 * Exit-intent prompt for visitors WITHOUT a Namma Info session:
 * "Create your account to save this card".
 *
 * Triggers (once per card per browser session):
 *  - Phone: the Back button. After the visitor's first interaction we add
 *    one history entry for this same page; pressing Back pops it and we
 *    show the prompt instead of leaving. (Browsers ignore history entries
 *    added before any user interaction, hence waiting for the first tap.)
 *  - Desktop: the mouse leaving through the top of the window (heading for
 *    the tab bar / close button).
 *
 * "Create account & save" → sign-up with just email + password; the card
 * lands in their Saved Cards and they go straight there. No onboarding.
 */
export default function SaveCardExitPrompt({
  card,
  hasAccount,
}: {
  card: Omit<SavedCardSummary, "saved_at">;
  hasAccount: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const armedRef = useRef(false);
  const shownRef = useRef(false);
  const storageKey = `nammainfo:exitPrompt:${card.id}`;

  useEffect(() => {
    try {
      if (sessionStorage.getItem(storageKey)) return;
    } catch {}

    function show() {
      if (shownRef.current) return;
      shownRef.current = true;
      try {
        sessionStorage.setItem(storageKey, "1");
      } catch {}
      setOpen(true);
    }

    // Phone back button
    function arm() {
      if (armedRef.current) return;
      armedRef.current = true;
      window.history.pushState({ nmExitPrompt: true }, "", window.location.href);
    }
    function onPopState() {
      if (!armedRef.current || shownRef.current) return;
      show();
    }

    // Desktop exit intent
    function onMouseOut(e: MouseEvent) {
      if (!e.relatedTarget && e.clientY <= 0) show();
    }

    window.addEventListener("pointerdown", arm, { once: true, passive: true });
    window.addEventListener("keydown", arm, { once: true });
    window.addEventListener("popstate", onPopState);
    document.addEventListener("mouseout", onMouseOut);
    return () => {
      window.removeEventListener("pointerdown", arm);
      window.removeEventListener("keydown", arm);
      window.removeEventListener("popstate", onPopState);
      document.removeEventListener("mouseout", onMouseOut);
    };
  }, [storageKey]);

  // Lock background scroll while open
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open) return null;

  const name = card.owner_name || card.business_name || "this card";
  const subtitle = [card.job_title, card.owner_name ? card.business_name : null]
    .filter(Boolean)
    .join(" · ");
  const image = card.logo_url || card.avatar_url;

  const query = new URLSearchParams({ save: card.id, name });

  function go(mode: "signup" | "signin") {
    queuePendingSave(card.id); // same-phone fallback
    if (mode === "signin") query.set("mode", "signin");
    router.push(`/signup?${query.toString()}`);
  }

  function leave() {
    setOpen(false);
    // They pressed Back to leave — honour it now. (On desktop the
    // trigger wasn't Back, so just close.)
    if (armedRef.current && window.history.length > 1) window.history.back();
  }

  return (
    <div
      className="fixed inset-0 z-[90] flex items-end justify-center bg-black/55 backdrop-blur-[2px] sm:items-center"
      onClick={() => setOpen(false)}
      role="dialog"
      aria-modal="true"
      aria-labelledby="save-card-title"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md animate-slide-up rounded-t-[28px] bg-[var(--background)] px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-3 shadow-2xl sm:rounded-[28px] sm:pb-6"
      >
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-[var(--border)] sm:hidden" />
        <button
          type="button"
          onClick={() => setOpen(false)}
          aria-label="Close"
          className="float-right -mr-2 -mt-1 rounded-full p-2 text-[var(--muted-foreground)] transition hover:bg-[var(--muted)]"
        >
          <X size={18} />
        </button>

        {/* The card they're about to lose */}
        <div className="mt-6 flex items-center gap-3 rounded-2xl border border-[var(--border)] bg-[var(--card)] p-3.5">
          {image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={image} alt="" className="h-12 w-12 shrink-0 rounded-xl object-cover" />
          ) : (
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[var(--muted)] text-sm font-semibold text-[var(--foreground)]">
              {initials(name)}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-[var(--foreground)]">{name}</p>
            {subtitle && (
              <p className="truncate text-xs text-[var(--muted-foreground)]">{subtitle}</p>
            )}
          </div>
          <BookmarkPlus size={18} className="shrink-0 text-[var(--muted-foreground)]" />
        </div>

        <h2
          id="save-card-title"
          className="mt-5 font-headline text-xl font-semibold tracking-tight text-[var(--foreground)]"
        >
          Save this card before you go?
        </h2>
        <p className="mt-1.5 text-sm leading-relaxed text-[var(--muted-foreground)]">
          Create a free Namma Info account and {name} will be waiting in your Saved Cards.
          Just an email and password — takes 10 seconds.
        </p>

        <button
          type="button"
          onClick={() => go("signup")}
          className="mt-6 flex w-full items-center justify-center gap-2 rounded-2xl bg-[var(--primary)] py-4 text-sm font-semibold text-[var(--primary-foreground)] transition active:scale-[0.99]"
        >
          <BookmarkPlus size={17} />
          Create account &amp; save
        </button>

        {hasAccount && (
          <button
            type="button"
            onClick={() => go("signin")}
            className="mt-2.5 w-full rounded-2xl border border-[var(--border)] py-3.5 text-sm font-semibold text-[var(--foreground)] transition hover:bg-[var(--muted)]"
          >
            I have an account — sign in
          </button>
        )}

        <button
          type="button"
          onClick={leave}
          className="mt-2 w-full py-3 text-sm font-medium text-[var(--muted-foreground)] transition hover:text-[var(--foreground)]"
        >
          No thanks
        </button>
      </div>
    </div>
  );
}
