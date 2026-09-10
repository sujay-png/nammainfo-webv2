import type { Metadata } from "next";
import { getCardAndProfile } from "@/lib/card-lookup";

/** Shared page metadata (title/description/OG image) for a card, by
 * UUID or friendly slug — used by both the root vanity route and the
 * legacy /c/[cardId] route. */
export async function buildCardMetadata(cardIdOrSlug: string): Promise<Metadata> {
  const result = await getCardAndProfile(cardIdOrSlug);
  if (!result) return { title: "Card not found" };

  const { profile } = result;
  const title = [profile.owner_name, profile.business_name]
    .filter(Boolean)
    .join(" · ");

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
