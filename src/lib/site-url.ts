/**
 * The address to put in links we email (password reset, sign-up
 * confirmation). Always the real site, never a Vercel preview address:
 * those sit behind Vercel's own login, so customers would be asked to
 * "Log in to Vercel".
 *
 * - On nammainfo.in (or localhost while developing): this same site.
 * - Anywhere else (e.g. a *.vercel.app preview): NEXT_PUBLIC_SITE_URL,
 *   or https://nammainfo.in.
 */
const PRODUCTION_URL = "https://nammainfo.in";

export function getSiteUrl(): string {
  if (typeof window !== "undefined") {
    const { hostname, origin } = window.location;
    if (
      hostname === "nammainfo.in" ||
      hostname.endsWith(".nammainfo.in") ||
      hostname === "localhost" ||
      hostname === "127.0.0.1"
    ) {
      return origin;
    }
  }
  const configured = process.env.NEXT_PUBLIC_SITE_URL;
  if (configured && configured.startsWith("https://") && !configured.includes("vercel.app")) {
    return configured.replace(/\/+$/, "");
  }
  return PRODUCTION_URL;
}
