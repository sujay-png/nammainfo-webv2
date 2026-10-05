import { notFound } from "next/navigation";
import { createPublicClient } from "@/lib/supabase/server";
import { buildCardMetadata } from "@/lib/card-metadata";
import PublicProfileView from "@/components/PublicProfileView";
import type { Metadata } from "next";
import type { Profile, Card, Review, Employee } from "@/lib/supabase/types";

// ISR: revalidate every 30 seconds so edits appear quickly
// while repeat visitors get a cached page instantly
export const revalidate = 30;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  return buildCardMetadata(slug);
}

export default async function SlugPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = createPublicClient();

  // Try to find by username first, then by card public_slug
  let profile: Profile | null = null;
  let card: Card | null = null;

  // Check if it's a username
  const { data: profileByUsername } = await supabase
    .from("profiles")
    .select("*")
    .eq("username", slug)
    .maybeSingle();

  if (profileByUsername) {
    profile = profileByUsername as unknown as Profile;
    // card will be fetched in parallel with reviews + employees below
  } else {
    // Check by card slug
    const isUuid =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        slug
      );
    const { data: cardData } = await supabase
      .from("cards")
      .select("*")
      .eq(isUuid ? "id" : "public_slug", slug)
      .maybeSingle();

    card = cardData as Card | null;
    if (card && card.is_active) {
      const { data: profileData } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", card.profile_id)
        .maybeSingle();
      profile = profileData as unknown as Profile | null;
    }
  }

  if (!profile) notFound();

  // Tap counting happens client-side in <TapTracker /> (rendered by
  // PublicProfileView) — this page is ISR-cached, so code here doesn't
  // run once per visitor, and the anon key can't UPDATE cards anyway.

  // Fetch card, reviews and employees in parallel
  const [{ data: cardDataParallel }, { data: reviewsData }, { data: employeesData }] = await Promise.all([
    card
      ? Promise.resolve({ data: card })
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
  if (!card) card = cardDataParallel as Card | null;

  return (
    <PublicProfileView
      profile={profile}
      card={card}
      reviews={(reviewsData as unknown as Review[]) ?? []}
      employees={(employeesData as unknown as Employee[]) ?? []}
    />
  );
}
