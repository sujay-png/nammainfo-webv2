import type { Employee, Profile } from "@/lib/supabase/types";

/* ------------------------------------------------------------------ */
/*  vCard 3.0 builder                                                  */
/*                                                                     */
/*  Hand-built (instead of vcards-js) so we control escaping: values   */
/*  like "SALES ,MARKETING & OPERATIONS HEAD" or an address with       */
/*  commas/semicolons must be escaped or iOS mis-parses the card.      */
/* ------------------------------------------------------------------ */

function esc(value: string | null | undefined): string {
  return (value ?? "")
    .replace(/\\/g, "\\\\")
    .replace(/\r\n|\r|\n/g, "\\n")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .trim();
}

function ensureProtocol(url: string) {
  return /^https?:\/\//i.test(url) ? url : `https://${url}`;
}

/** Fold long lines at 75 octets as RFC 2426 requires (iOS is strict on PHOTO). */
function fold(line: string): string {
  if (line.length <= 75) return line;
  const parts: string[] = [line.slice(0, 75)];
  for (let i = 75; i < line.length; i += 74) parts.push(" " + line.slice(i, i + 74));
  return parts.join("\r\n");
}

function nameLines(fullName: string, fallback: string) {
  const name = fullName.trim() || fallback.trim() || "Contact";
  const parts = name.split(/\s+/);
  const first = parts[0] ?? "";
  const last = parts.length > 1 ? parts.slice(1).join(" ") : "";
  return [`FN:${esc(name)}`, `N:${esc(last)};${esc(first)};;;`];
}

export interface VCardPhoto {
  base64: string;
  type: "JPEG" | "PNG";
}

/**
 * Downloads an image and returns it base64-encoded for embedding.
 * Never throws — a missing photo must never block saving the contact.
 */
export async function fetchVCardPhoto(url: string | null | undefined): Promise<VCardPhoto | null> {
  if (!url) return null;
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 4000);
    const res = await fetch(url, { signal: ctrl.signal, cache: "no-store" });
    clearTimeout(timer);
    if (!res.ok) return null;
    const ct = res.headers.get("content-type") ?? "";
    const type = ct.includes("png") ? "PNG" : ct.includes("jpeg") || ct.includes("jpg") ? "JPEG" : null;
    if (!type) return null; // webp/svg etc. aren't supported by iOS Contacts
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length > 400_000) return null; // keep the .vcf small
    return { base64: buf.toString("base64"), type };
  } catch {
    return null;
  }
}

function finish(lines: (string | null | false | undefined)[]) {
  return (
    ["BEGIN:VCARD", "VERSION:3.0", ...lines.filter(Boolean), "END:VCARD"]
      .map((l) => fold(l as string))
      .join("\r\n") + "\r\n"
  );
}

export function buildVCard(profile: Profile, opts: { sourceUrl?: string; photo?: VCardPhoto | null } = {}) {
  return finish([
    ...nameLines(profile.owner_name ?? "", profile.business_name ?? ""),
    profile.business_name && `ORG:${esc(profile.business_name)}`,
    profile.job_title && `TITLE:${esc(profile.job_title)}`,
    profile.phone && `TEL;TYPE=WORK,VOICE:${esc(profile.phone)}`,
    profile.email && `EMAIL;TYPE=INTERNET,WORK:${esc(profile.email)}`,
    profile.website && `URL:${esc(ensureProtocol(profile.website))}`,
    profile.address && `ADR;TYPE=WORK:;;${esc(profile.address)};;;;`,
    profile.bio && `NOTE:${esc(profile.bio)}`,
    opts.photo && `PHOTO;ENCODING=b;TYPE=${opts.photo.type}:${opts.photo.base64}`,
    opts.sourceUrl && `SOURCE:${opts.sourceUrl}`,
  ]);
}

export function buildEmployeeVCard(
  employee: Employee,
  owner: Profile,
  opts: { sourceUrl?: string; photo?: VCardPhoto | null } = {}
) {
  return finish([
    ...nameLines(employee.name, owner.business_name ?? ""),
    owner.business_name && `ORG:${esc(owner.business_name)}`,
    employee.designation && `TITLE:${esc(employee.designation)}`,
    employee.phone && `TEL;TYPE=WORK,VOICE:${esc(employee.phone)}`,
    employee.email && `EMAIL;TYPE=INTERNET,WORK:${esc(employee.email)}`,
    owner.website && `URL:${esc(ensureProtocol(owner.website))}`,
    owner.address && `ADR;TYPE=WORK:;;${esc(owner.address)};;;;`,
    opts.photo && `PHOTO;ENCODING=b;TYPE=${opts.photo.type}:${opts.photo.base64}`,
    opts.sourceUrl && `SOURCE:${opts.sourceUrl}`,
  ]);
}

export function vcardFileName(name: string | null | undefined) {
  const base = (name ?? "").replace(/[^a-z0-9 \-_.]/gi, "").trim();
  return `${base || "nammainfo-contact"}.vcf`;
}

/**
 * Response for a .vcf. `inline` (not `attachment`) matters on iOS:
 * Safari then hands the file straight to Contacts and shows the real
 * "Create New Contact" screen, instead of a Quick Look preview whose ✓
 * button only closes the preview without saving anything.
 */
export function vcardResponse(vcf: string, fileName: string) {
  return new Response(vcf, {
    status: 200,
    headers: {
      "Content-Type": "text/vcard; charset=utf-8",
      "Content-Disposition": `inline; filename="${fileName}"`,
      "Cache-Control": "private, max-age=0, must-revalidate",
    },
  });
}
