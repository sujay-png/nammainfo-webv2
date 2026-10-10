"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { BookmarkCheck, BookmarkPlus, Check, Undo2 } from "lucide-react";
import { getCurrentUser } from "@/lib/supabase/current-user";
import {
  flushPendingSaves,
  queuePendingSave,
  readSavedCache,
  saveCard,
  unsaveCard,
  type SavedCardSummary,
} from "@/lib/saved-cards";

const HAS_ACCOUNT_KEY = "nammainfo:hasAccount";

type Status = "idle" | "saved" | "undone" | "guest" | "queued";

/**
 * Saves the card being viewed into the viewer's "Saved Cards" — the moment
 * the page opens (NFC tap, QR scan or shared link). No button to press.
 *
 * - Signed in: saved instantly (optimistic), with a toast + Undo.
 * - Signed out but has used Namma Info on this phone before: a small
 *   "Save card" pill; tapping it remembers the card and sends them to
 *   sign in — it's saved automatically right after.
 * - Never used Namma Info: nothing extra is shown (they have Save Contact).
 * - Viewing your own card: nothing happens.
 */
export default function AutoSaveCard({ card }: { card: Omit<SavedCardSummary, "saved_at"> }) {
  const [status, setStatus] = useState<Status>("idle");
  const [toastVisible, setToastVisible] = useState(false);
  const userIdRef = useRef<string | null>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout>>();

  function showToast(ms = 3500) {
    setToastVisible(true);
    clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => setToastVisible(false), ms);
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      // Reads the locally stored session — no network wait.
      const user = await getCurrentUser();
      if (cancelled) return;

      if (!user) {
        let hasAccount = false;
        try {
          hasAccount = localStorage.getItem(HAS_ACCOUNT_KEY) === "1";
        } catch {}
        if (hasAccount) setStatus("guest");
        return;
      }

      try {
        localStorage.setItem(HAS_ACCOUNT_KEY, "1");
      } catch {}
      userIdRef.current = user.id;
      flushPendingSaves();

      if (user.id === card.id) return; // own card

      // Already saved (e.g. opened from the Saved list)? Just move it to
      // the top quietly — no toast every time you revisit a card.
      const alreadySaved = (readSavedCache(user.id) ?? []).some((c) => c.id === card.id);
      if (alreadySaved) {
        saveCard(user.id, { ...card, saved_at: new Date().toISOString() }).catch(() => {});
        return;
      }

      setStatus("saved");
      showToast();
      saveCard(user.id, { ...card, saved_at: new Date().toISOString() }).catch(() => {
        if (!cancelled) {
          setStatus("idle");
          setToastVisible(false);
        }
      });
    })();
    return () => {
      cancelled = true;
      clearTimeout(hideTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [card.id]);

  async function undo() {
    const uid = userIdRef.current;
    if (!uid) return;
    setStatus("undone");
    showToast(2500);
    await unsaveCard(uid, card.id).catch(() => {});
  }

  async function saveAgain() {
    const uid = userIdRef.current;
    if (!uid) return;
    setStatus("saved");
    showToast();
    await saveCard(uid, { ...card, saved_at: new Date().toISOString() }).catch(() => setStatus("undone"));
  }

  function saveAsGuest() {
    queuePendingSave(card.id);
    setStatus("queued");
  }

  if (status === "idle") return null;

  const here = typeof window !== "undefined" ? window.location.pathname : "/";
  const name = card.owner_name || card.business_name || "this card";

  return (
    <div className="pointer-events-none fixed inset-x-0 top-3 z-[60] flex justify-center px-4 pt-[env(safe-area-inset-top)]">
      {/* Signed in: saved toast */}
      {(status === "saved" || status === "undone") && (
        <div
          role="status"
          aria-live="polite"
          className={`pointer-events-auto flex max-w-full items-center gap-1 rounded-full bg-[var(--foreground)] py-1.5 pl-3 pr-1.5 text-[var(--background)] shadow-[0_12px_32px_-10px_rgba(0,0,0,0.5)] transition-all duration-300 ease-out ${
            toastVisible ? "translate-y-0 opacity-100" : "-translate-y-16 opacity-0"
          }`}
        >
          {status === "saved" ? (
            <>
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white">
                <Check size={13} strokeWidth={3} />
              </span>
              <span className="truncate px-1.5 text-xs font-medium">Saved to your cards</span>
              <button
                type="button"
                onClick={undo}
                className="flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1.5 text-xs font-semibold opacity-70 transition hover:opacity-100"
              >
                <Undo2 size={13} /> Undo
              </button>
              <Link
                href="/dashboard/saved"
                className="shrink-0 rounded-full bg-[var(--background)] px-3 py-1.5 text-xs font-semibold text-[var(--foreground)]"
              >
                View
              </Link>
            </>
          ) : (
            <>
              <span className="truncate px-1.5 text-xs font-medium">Removed from saved cards</span>
              <button
                type="button"
                onClick={saveAgain}
                className="shrink-0 rounded-full bg-[var(--background)] px-3 py-1.5 text-xs font-semibold text-[var(--foreground)]"
              >
                Save again
              </button>
            </>
          )}
        </div>
      )}

      {/* Signed out on a phone that has used Namma Info before */}
      {status === "guest" && (
        <button
          type="button"
          onClick={saveAsGuest}
          className="pointer-events-auto flex animate-fade-in items-center gap-2 rounded-full bg-[var(--foreground)] px-4 py-2.5 text-xs font-semibold text-[var(--background)] shadow-[0_12px_32px_-10px_rgba(0,0,0,0.5)]"
        >
          <BookmarkPlus size={15} />
          Save {name} to my cards
        </button>
      )}
      {status === "queued" && (
        <div className="pointer-events-auto flex animate-fade-in items-center gap-1 rounded-full bg-[var(--foreground)] py-1.5 pl-3 pr-1.5 text-[var(--background)] shadow-[0_12px_32px_-10px_rgba(0,0,0,0.5)]">
          <BookmarkCheck size={15} />
          <span className="px-1.5 text-xs font-medium">Sign in to finish saving</span>
          <Link
            href={`/signup?mode=signin&next=${encodeURIComponent(here)}`}
            className="rounded-full bg-[var(--background)] px-3 py-1.5 text-xs font-semibold text-[var(--foreground)]"
          >
            Sign in
          </Link>
        </div>
      )}
    </div>
  );
}
