/**
 * Resolves the public base URL for public digital cards and QR codes.
 * Ensures that if the admin console is running on an admin subdomain (e.g. admin.nammainfo.in or admin.localhost:3000),
 * the public card URL points to the main customer site (e.g. https://nammainfo.in or http://localhost:3000).
 */
export function getPublicBaseUrl(): string {
  // 1. If explicit environment variable is set
  if (process.env.NEXT_PUBLIC_SITE_URL) {
    const envUrl = process.env.NEXT_PUBLIC_SITE_URL.trim().replace(/\/+$/, "");
    if (envUrl) return envUrl;
  }

  // 2. In browser, derive dynamically from current window.location
  if (typeof window !== "undefined") {
    const { protocol, host } = window.location;
    // Strip "admin." subdomain if accessing via admin portal (e.g. admin.nammainfo.in -> nammainfo.in)
    const mainHost = host.replace(/^admin\./i, "");
    return `${protocol}//${mainHost}`.replace(/\/+$/, "");
  }

  // 3. Fallback to production domain
  return "https://nammainfo.in";
}

/**
 * Returns full public URL for a company or employee digital business card
 */
export function buildPublicCardUrl(ownerSlug: string, employeeSlug?: string | null): string {
  const base = getPublicBaseUrl();
  const cleanOwner = (ownerSlug || "").trim().replace(/^\/+/, "");
  if (!cleanOwner) return base;

  if (employeeSlug) {
    const cleanEmp = employeeSlug.trim().replace(/^\/+/, "");
    return `${base}/${cleanOwner}/${cleanEmp}`;
  }

  return `${base}/${cleanOwner}`;
}

