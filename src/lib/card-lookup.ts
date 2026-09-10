import { createPublicClient } from "@/lib/supabase/server";
import type { Card, Profile } from "@/lib/supabase/types";

/**
 * Resolves a card by its UUID or its friendly `public_slug`
 * (e.g. "wrnxt") — used by both the root vanity route (/[slug]) and the
 * legacy /c/[cardId] route so a card keeps working under either link.
 */
export async function getCardAndProfile(cardIdOrSlug: string) {
  const supabase = createPublicClient();

  const isUuid =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      cardIdOrSlug
    );

  const { data: cardRow } = await supabase
    .from("cards")
    .select("*")
    .eq(isUuid ? "id" : "public_slug", cardIdOrSlug)
    .maybeSingle();

  // Cast to the concrete row type — Supabase's generic `.select("*")`
  // result type doesn't always narrow cleanly through this project's
  // hand-written Database type.
  const card = cardRow as Card | null;
  if (!card || !card.is_active) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", card.profile_id)
    .maybeSingle();

  if (!profile) return null;

  return { card, profile: profile as Profile };
}
