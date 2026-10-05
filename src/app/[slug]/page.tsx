import { cache } from "react";
import { notFound } from "next/navigation";
import { createCachedPublicClient } from "@/lib/supabase/server";
import PublicProfileView from "@/components/PublicProfileView";
import type { Metadata } from "next";
import type { Profile, Card, Review, Employee } from "@/lib/supabase/types";

// ISR: revalidate every 30 seconds so edits appear quickly
// while repeat visitors get a cached page instantly
export const revalidate = 30;

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Resolves /<slug> to a profile (+ its card) — by username first, then by
 * card public_slug / id. Wrapped in React `cache()` so generateMetadata and
 * the page share ONE set of queries per request instead of running them
 * twice. (Metadata also used to look only at card slugs, so username URLs
 * got the title "Card not found".)
 */
const resolveSlug = cache(async (slug: string) => {
  const supabase = createCachedPublicClient();

  const { data: byUsername } = await supabase
    .from("profiles")
    .select("*")
    .eq("username", slug)
    .maybeSingle();

  if (byUsername) {
    return { profile: byUsername as unknown as Profile, card: null as Card | null };
  }

  const { data: cardData } = await supabase
    .from("cards")
    .select("*")
    .eq(UUID_RE.test(slug) ? "id" : "public_slug", slug)
    .maybeSingle();
  const card = cardData as Card | null;
  if (!card || !card.is_active) return null;

  const { data: profileData } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", card.profile_id)
    .maybeSingle();
  if (!profileData) return null;

  return { profile: profileData as unknown as Profile, card };
});

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const result = await resolveSlug(slug);
  if (!result) return { title: "Card not found" };

  const { profile } = result;
  const title = [profile.owner_name, profile.business_name].filter(Boolean).join(" · ");
  return {
    title: title || "Namma Info card",
    description:
      profile.bio ?? `Connect with ${profile.owner_name ?? "this business"} on Namma Info.`,
    openGraph: {
      title,
      images: profile.avatar_url ? [profile.avatar_url] : undefined,
    },
  };
}

export default async function SlugPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const result = await resolveSlug(slug);
  if (!result) notFound();

  const { profile } = result;
  const supabase = createCachedPublicClient();

  // Tap counting happens client-side in <TapTracker /> (rendered by
  // PublicProfileView) — this page is cached, so code here doesn't run
  // once per visitor.

  const [{ data: cardData }, { data: reviewsData }, { data: employeesData }] =
    await Promise.all([
      result.card
        ? Promise.resolve({ data: result.card })
        : supabase
            .from("cards")
            .select("*")
            .eq("profile_id", profile.id)
            .eq("is_active", true)
            .maybeSingle(),
      supabase
        .from("reviews")
        .select("*")
        .eq("profile_id", profile.id)
        .order("created_at", { ascending: false })
        .limit(10),
      supabase
        .from("employees")
        .select("*")
        .eq("owner_id", profile.id)
        .eq("is_active", true)
        .order("created_at"),
    ]);

  return (
    <PublicProfileView
      profile={profile}
      card={cardData as Card | null}
      reviews={(reviewsData as unknown as Review[]) ?? []}
      employees={(employeesData as unknown as Employee[]) ?? []}
    />
  );
}
