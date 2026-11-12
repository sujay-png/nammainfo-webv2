import { cache } from "react";
import { createCachedPublicClient } from "@/supabase/server";
import GatedProfileView from "@/components/GatedProfileView";
import { getMembership } from "@/lib/membership";
import type { Card, Employee, Profile, Review } from "@/supabase/database-types";
import type { Branch } from "../types";

/**
 * Shared data loading for the public card routes:
 *   /[slug]                      main profile
 *   /[slug]/[employee]           branch, or team member (legacy link)
 *   /[slug]/[employee]/[member]  team member of a branch
 *
 * Each loader is wrapped in React `cache()`, so generateMetadata and the
 * page share one set of queries per request. All of them tolerate the
 * branches migration not being run yet (they just find no branches).
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** /<slug> → profile (+ card when found by card link). Username first, then card public_slug / id. */
export const resolveOwner = cache(async (slug: string) => {
  const supabase = createCachedPublicClient();

  const { data: byUsername } = await supabase.from("profiles").select("*").eq("username", slug).maybeSingle();
  if (byUsername) return { profile: byUsername as unknown as Profile, card: null as Card | null };

  const { data: cardData } = await supabase
    .from("cards")
    .select("*")
    .eq(UUID_RE.test(slug) ? "id" : "public_slug", slug)
    .maybeSingle();
  const card = cardData as Card | null;
  if (!card || !card.is_active) return null;

  const { data: profileData } = await supabase.from("profiles").select("*").eq("id", card.profile_id).maybeSingle();
  if (!profileData) return null;
  return { profile: profileData as unknown as Profile, card };
});

/** Active branches of a business, in the owner's order. */
export const getBranches = cache(async (ownerId: string): Promise<Branch[]> => {
  const { data, error } = await createCachedPublicClient()
    .from("branches")
    .select("*")
    .eq("owner_id", ownerId)
    .eq("is_active", true)
    .order("sort_order")
    .order("created_at");
  if (error) return []; // table not created yet
  return (data ?? []) as unknown as Branch[];
});

export const findBranch = cache(async (ownerId: string, slug: string): Promise<Branch | null> => {
  const s = slug.toLowerCase();
  return (await getBranches(ownerId)).find((b) => b.slug === s) ?? null;
});

/** An active team member by link. If old data has two with the same link, the first one wins. */
export const findEmployee = cache(async (ownerId: string, slug: string): Promise<Employee | null> => {
  const { data } = await createCachedPublicClient()
    .from("employees")
    .select("*")
    .eq("owner_id", ownerId)
    .eq("slug", slug)
    .eq("is_active", true)
    .order("created_at")
    .limit(1);
  return ((data ?? [])[0] as unknown as Employee) ?? null;
});

/** Card, latest reviews and team for a business page. */
export const loadPageData = cache(async (ownerId: string, knownCard: Card | null) => {
  const supabase = createCachedPublicClient();
  const [{ data: cardData }, { data: reviewsData }, { data: employeesData }] = await Promise.all([
    knownCard
      ? Promise.resolve({ data: knownCard })
      : supabase.from("cards").select("*").eq("profile_id", ownerId).eq("is_active", true).maybeSingle(),
    supabase
      .from("reviews")
      .select("*")
      .eq("profile_id", ownerId)
      .order("created_at", { ascending: false })
      .limit(10),
    supabase.from("employees").select("*").eq("owner_id", ownerId).eq("is_active", true).order("created_at"),
  ]);
  return {
    card: cardData as Card | null,
    reviews: (reviewsData as unknown as Review[]) ?? [],
    employees: (employeesData as unknown as Employee[]) ?? [],
  };
});

/**
 * Suspended, free (never paid) or expired accounts get a holding page
 * instead of the profile, on every route: main, branch and team member.
 * Returns the holding page, or null when the page may show.
 */
export function membershipGate(profile: Profile) {
  const m = getMembership(profile);
  if (m.isSuspended) return <GatedProfileView profile={profile} reason="suspended" />;
  if (m.isFree) return <GatedProfileView profile={profile} reason="free" />;
  if (m.isExpired) return <GatedProfileView profile={profile} reason="expired" />;
  return null;
}

/** The link name a business is reached by: its username, else the slug it was opened with. */
export function publicHandle(profile: Profile, openedWith: string) {
  return profile.username || openedWith;
}
