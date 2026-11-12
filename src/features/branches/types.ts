import type { ServiceItem } from "@/supabase/database-types";

/**
 * A branch of a business (migration 20261112_branches.sql).
 *
 * Every override field is optional: NULL means "same as the main
 * profile". `applyBranch()` merges a branch into the owner's Profile, so
 * the public page components render a branch exactly like a profile.
 */
export interface Branch {
  id: string;
  owner_id: string;
  slug: string;
  name: string;
  contact_person: string | null;
  contact_title: string | null;
  phone: string | null;
  whatsapp: string | null;
  email: string | null;
  address: string | null;
  city: string | null;
  pincode: string | null;
  maps_url: string | null;
  google_place_id: string | null;
  cover_url: string | null;
  logo_url: string | null;
  /** NULL = same as the main profile. An array (even empty) = this branch's own list. */
  services: ServiceItem[] | null;
  products: ServiceItem[] | null;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

/** What the public pages need to list branches and build links. */
export type BranchSummary = Pick<Branch, "id" | "slug" | "name" | "city" | "is_active">;

export const MAX_BRANCHES = 50;

/** Same rule as the database: lowercase words joined by single dashes, 2–40 chars. */
export const BRANCH_SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/** "Mangaluru – Kadri Branch" → "mangaluru-kadri-branch" (max 40 chars). */
export function toSlug(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40)
    .replace(/-+$/g, "");
}

export function isValidSlug(slug: string): boolean {
  return slug.length >= 2 && slug.length <= 40 && BRANCH_SLUG_RE.test(slug);
}

/**
 * First free link for `wanted` among the links already used in this
 * business (branch links and team-member links share one namespace).
 * "sujay" → "sujay", or "sujay-2", "sujay-3"… when taken.
 */
export function uniqueSlug(wanted: string, taken: Iterable<string>, fallback = "member"): string {
  const used = new Set(Array.from(taken, (s) => s.toLowerCase()));
  let base = toSlug(wanted);
  if (base.length < 2) base = fallback;
  if (!used.has(base)) return base;
  for (let n = 2; n < 1000; n++) {
    const suffix = `-${n}`;
    const candidate = `${base.slice(0, 40 - suffix.length).replace(/-+$/g, "")}${suffix}`;
    if (!used.has(candidate)) return candidate;
  }
  return `${base.slice(0, 31)}-${Math.random().toString(36).slice(2, 8)}`;
}

/** Fields an owner edits in the branch editor (everything but ids and timestamps). */
export type BranchDraft = Omit<Branch, "id" | "owner_id" | "created_at" | "updated_at">;

export function emptyDraft(sortOrder = 0): BranchDraft {
  return {
    slug: "",
    name: "",
    contact_person: null,
    contact_title: null,
    phone: null,
    whatsapp: null,
    email: null,
    address: null,
    city: null,
    pincode: null,
    maps_url: null,
    google_place_id: null,
    cover_url: null,
    logo_url: null,
    services: null,
    products: null,
    is_active: true,
    sort_order: sortOrder,
  };
}

/** Turns a database / editor error into words an owner understands. */
export function branchErrorMessage(message: string): string {
  if (/branches_owner_slug_key|duplicate key/i.test(message)) {
    return "Another branch already uses that link. Pick a different one.";
  }
  if (/relation .*branches.* does not exist|branches.*schema cache/i.test(message)) {
    return "Branches need a quick database update first (run the 20261112 migration).";
  }
  if (/branches_slug_format/i.test(message)) {
    return "The link can use only small letters, numbers and dashes (2–40 characters).";
  }
  if (/team member|paid plan|up to 50/i.test(message)) return message;
  return "Couldn't save. Please check your connection and try again.";
}
