/** A client the business has worked with, stored in profiles.clients (jsonb array). */
export interface ClientItem {
  id: string;
  /** Client name. Required. */
  name: string;
  /** Processed logo in the profile-media bucket. Optional. */
  logo_url?: string;
  /** Optional: tapping the logo opens this site. Always https://… once saved. */
  website?: string;
}

export const MAX_CLIENTS = 50;

/**
 * Turns "acme.com" or "www.acme.com/about" into "https://acme.com/…".
 * Returns "" for empty input and null for something that isn't a web address.
 */
export function normalizeWebsite(input: string | undefined): string | null {
  const raw = (input ?? "").trim();
  if (!raw) return "";
  const withScheme = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  try {
    const u = new URL(withScheme);
    if (!/^https?:$/.test(u.protocol) || !u.hostname.includes(".")) return null;
    return u.href;
  } catch {
    return null;
  }
}

/** Keeps only well-formed clients with safe http(s) links. */
export function cleanClients(value: unknown): ClientItem[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((c): c is ClientItem => !!c && typeof c === "object" && typeof c.name === "string" && !!c.name.trim())
    .map((c) => {
      const site = typeof c.website === "string" ? normalizeWebsite(c.website) : "";
      return { ...c, website: site || undefined };
    })
    .slice(0, MAX_CLIENTS);
}
