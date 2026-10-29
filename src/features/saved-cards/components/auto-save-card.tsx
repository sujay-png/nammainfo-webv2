"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Check, Undo2 } from "lucide-react";
import SaveCardExitPrompt from "@/features/saved-cards/components/save-card-before-leaving-popup";
import { getCurrentUser } from "@/supabase/current-user";
import {
  flushPendingSaves,
  readSavedCache,
  saveCard,
  unsaveCard,
  type SavedCardSummary,
} from "@/features/saved-cards/services/saved-cards.service";

const HAS_ACCOUNT_KEY = "nammainfo:hasAccount";

type Status = "idle" | "saved" | "undone" | "guest";

/**
 * Saves the card being viewed into the viewer's "Saved Cards" — the moment
 * the page opens (NFC tap, QR scan or shared link). No button to press.
 *
 * - Signed in (both people have Namma Info): saved instantly, with a
 *   toast + Undo. Nothing to tap.
 * - Not signed in: when they try to leave (Back button / closing on
 *   desktop) they're asked to create an account to save the card — sign-up
 *   is just email + password, then the card is in their Saved Cards.
 * - Viewing your own card: nothing happens.
 */
export default function AutoSaveCard({ card }: { card: Omit<SavedCardSummary, "saved_at"> }) {
  const [status, setStatus] = useState<Status>("idle");
  const [toastVisible, setToastVisible] = useState(false);
  const [hasAccount, setHasAccount] = useState(false);
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
        try {
          setHasAccount(localStorage.getItem(HAS_ACCOUNT_KEY) === "1");
        } catch {}
        setStatus("guest");
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

  if (status === "idle") return null;
  if (status === "guest") return <SaveCardExitPrompt card={card} hasAccount={hasAccount} />;

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

    </div>
  );
}
