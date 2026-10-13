import { createClient } from "@/lib/supabase/client";
import { getCurrentUser } from "@/lib/supabase/current-user";

/**
 * Saved Cards — client helpers.
 *
 * Speed tricks:
 *  - Saving is optimistic: the UI says "Saved" immediately and the
 *    database call happens in the background.
 *  - The Saved page reads a local cache first (instant), then refreshes
 *    from the database. A card saved on a profile page is added to that
 *    cache straight away, so it's already there when you open Saved.
 *  - If you tap "Save" while signed out, the card is remembered locally
 *    and saved automatically the moment you sign in or sign up.
 */

export interface SavedCardSummary {
  id: string;
  owner_name: string | null;
  business_name: string | null;
  job_title: string | null;
  logo_url: string | null;
  avatar_url?: string | null;
  username: string | null;
  slug: string | null;
  saved_at: string;
}

const PENDING_KEY = "nammainfo:pendingSaves";
const cacheKey = (userId: string) => `nammainfo:saved:${userId}`;

/* ---------- local cache ---------- */

export function readSavedCache(userId: string): SavedCardSummary[] | null {
  try {
    const raw = localStorage.getItem(cacheKey(userId));
    return raw ? (JSON.parse(raw) as SavedCardSummary[]) : null;
  } catch {
    return null;
  }
}

export function writeSavedCache(userId: string, cards: SavedCardSummary[]) {
  try {
    localStorage.setItem(cacheKey(userId), JSON.stringify(cards.slice(0, 500)));
  } catch {}
}

function upsertCache(userId: string, card: SavedCardSummary) {
  const list = (readSavedCache(userId) ?? []).filter((c) => c.id !== card.id);
  writeSavedCache(userId, [card, ...list]);
}

function removeFromCache(userId: string, ownerId: string) {
  const list = readSavedCache(userId);
  if (list) writeSavedCache(userId, list.filter((c) => c.id !== ownerId));
}

/* ---------- pending saves (signed-out taps) ---------- */

function readPending(): string[] {
  try {
    return JSON.parse(localStorage.getItem(PENDING_KEY) || "[]") as string[];
  } catch {
    return [];
  }
}

export function queuePendingSave(ownerId: string) {
  try {
    const list = readPending().filter((id) => id !== ownerId);
    localStorage.setItem(PENDING_KEY, JSON.stringify([...list, ownerId].slice(-50)));
  } catch {}
}

/**
 * Saves any cards tapped while signed out. Two sources:
 *  - this browser's local queue (signed in on the same phone), and
 *  - `pending_save` on the account itself, set at sign-up — so it still
 *    works if the confirmation email is opened in another browser/app.
 * Concurrent callers share one run, so a page that awaits this always
 * sees the save finished before it loads the list.
 */
let inflight: Promise<void> | null = null;

export function flushPendingSaves(): Promise<void> {
  if (!inflight) {
    inflight = doFlush().finally(() => {
      inflight = null;
    });
  }
  return inflight;
}

async function doFlush() {
  const user = await getCurrentUser();
  if (!user) return;

  const fromAccount = (user.user_metadata as { pending_save?: string | null } | undefined)?.pending_save;
  const ids = new Set(readPending());
  if (fromAccount) ids.add(fromAccount);
  ids.delete(user.id);
  if (ids.size === 0) return;

  const supabase = createClient();
  const results = await Promise.all(
    Array.from(ids).map((id) => supabase.rpc("save_card", { p_owner_id: id } as never))
  );
  if (results.some((r) => r.error)) return; // keep the queue; retry next time

  try {
    localStorage.removeItem(PENDING_KEY);
  } catch {}
  if (fromAccount) {
    await supabase.auth.updateUser({ data: { pending_save: null } }).catch(() => {});
  }
}

/* ---------- save / unsave ---------- */

export async function saveCard(userId: string, card: SavedCardSummary) {
  upsertCache(userId, card); // instant
  const supabase = createClient();
  const { error } = await supabase.rpc("save_card", { p_owner_id: card.id } as never);
  if (error) {
    removeFromCache(userId, card.id);
    throw error;
  }
}

export async function unsaveCard(userId: string, ownerId: string) {
  removeFromCache(userId, ownerId); // instant
  const supabase = createClient();
  await supabase.rpc("unsave_card", { p_owner_id: ownerId } as never);
}
