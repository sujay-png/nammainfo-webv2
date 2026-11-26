import { normalizeWebsite } from "@/features/clients/types";

/**
 * Two owner-made link types on the public card:
 *
 * - CustomLink (profiles.custom_links, max 3): label + web address, shown as
 *   buttons at the top of the card, under "Add to Contacts".
 * - CustomButton (profiles.custom_buttons, max 10): label + a web address OR
 *   an uploaded file (PDF / image), shown next to the brochure. For
 *   businesses that have a menu, price list or catalogue instead of a
 *   brochure.
 *
 * Migration: 20261123_custom_links_and_greetings.sql
 */

export interface CustomLink {
  id: string;
  label: string;
  url: string;
}

export interface CustomButton {
  id: string;
  label: string;
  url: string;
  kind: "link" | "file";
  /** Original file name, for uploaded files. */
  file_name?: string;
}

export const MAX_CUSTOM_LINKS = 3;
export const MAX_CUSTOM_BUTTONS = 10;
export const MAX_LABEL = 30;

export const newId = () => Math.random().toString(36).slice(2, 10);

/** Only http(s) addresses survive (no javascript: or data: links). */
function safeUrl(u: unknown): string | null {
  if (typeof u !== "string") return null;
  const n = normalizeWebsite(u);
  return n || null;
}

export function cleanCustomLinks(value: unknown): CustomLink[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((x) => {
      if (!x || typeof x !== "object") return null;
      const o = x as Record<string, unknown>;
      const url = safeUrl(o.url);
      const label = typeof o.label === "string" ? o.label.trim().slice(0, MAX_LABEL) : "";
      if (!url || !label) return null;
      return { id: typeof o.id === "string" ? o.id : newId(), label, url };
    })
    .filter((x): x is CustomLink => !!x)
    .slice(0, MAX_CUSTOM_LINKS);
}

export function cleanCustomButtons(value: unknown): CustomButton[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((x) => {
      if (!x || typeof x !== "object") return null;
      const o = x as Record<string, unknown>;
      const url = safeUrl(o.url);
      const label = typeof o.label === "string" ? o.label.trim().slice(0, MAX_LABEL) : "";
      if (!url || !label) return null;
      const b: CustomButton = {
        id: typeof o.id === "string" ? o.id : newId(),
        label,
        url,
        kind: o.kind === "file" ? "file" : "link",
      };
      if (typeof o.file_name === "string" && o.file_name) b.file_name = o.file_name.slice(0, 80);
      return b;
    })
    .filter((x): x is CustomButton => !!x)
    .slice(0, MAX_CUSTOM_BUTTONS);
}

/** Friendly message for a failed save (e.g. migration not run yet). */
export function saveErrorMessage(message: string, column: string): string {
  if (new RegExp(column).test(message) || /schema cache|does not exist/i.test(message)) {
    return "This needs a quick database update first (run the 20261123 migration).";
  }
  return "Couldn't save. Please check your connection and try again.";
}

/* ---------- Short document links: nammainfo.in/doc/<username>/<key> ---------- */

/** "Price List" → "price-list". Brochure is always "brochure". */
function keyFromLabel(label: string): string {
  return (
    label
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "file"
  );
}

/**
 * The short key of every custom button, in order. Two buttons with the same
 * name get "menu" and "menu-2". The same function runs in the browser (to
 * build links) and on the server (to resolve them), so they always agree.
 */
export function docKeys(buttons: CustomButton[]): Map<string, string> {
  const used = new Set<string>(["brochure"]);
  const out = new Map<string, string>();
  for (const b of buttons) {
    const base = keyFromLabel(b.label);
    let key = base;
    for (let n = 2; used.has(key); n++) key = `${base}-${n}`;
    used.add(key);
    out.set(b.id, key);
  }
  return out;
}

/** Branded short link for a brochure ("brochure") or a custom button's key. */
export function docLink(username: string, key: string, site = "https://nammainfo.in") {
  return `${site}/doc/${encodeURIComponent(username)}/${key}`;
}
