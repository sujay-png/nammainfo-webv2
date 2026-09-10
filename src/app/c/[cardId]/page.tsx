import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Download, MapPin } from "lucide-react";
import { createPublicClient } from "@/lib/supabase/server";
import CardPreview from "@/components/CardPreview";
import ContactButtons from "@/components/ContactButtons";
import AppCta from "@/components/AppCta";
import type { Card, Profile } from "@/lib/supabase/types";

export const dynamic = "force-dynamic";

async function getCardAndProfile(cardId: string) {
  const supabase = createPublicClient();

  const isUuid =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      cardId
    );

  const { data: cardRow } = await supabase
    .from("cards")
    .select("*")
    .eq(isUuid ? "id" : "public_slug", cardId)
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

export async function generateMetadata({
  params,
}: {
  params: Promise<{ cardId: string }>;
}): Promise<Metadata> {
  const { cardId } = await params;
  const result = await getCardAndProfile(cardId);
  if (!result) return { title: "Card not found" };

  const { profile } = result;
  const title = [profile.owner_name, profile.business_name]
    .filter(Boolean)
    .join(" · ");

  return {
    title: title || "Namma Info card",
    description: profile.bio ?? `Connect with ${profile.owner_name ?? "this business"} on Namma Info.`,
    openGraph: {
      title,
      images: profile.avatar_url ? [profile.avatar_url] : undefined,
    },
  };
}

export default async function CardPage({
  params,
}: {
  params: Promise<{ cardId: string }>;
}) {
  const { cardId } = await params;
  const result = await getCardAndProfile(cardId);

  if (!result) notFound();
  const { card, profile } = result;

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-5 px-4 py-10 sm:py-16">
      <CardPreview profile={profile} />

      <ContactButtons profile={profile} cardSlug={card.public_slug} />

      <div className="flex flex-col gap-2.5">
        <a
          href={`/api/vcard/${profile.id}`}
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-ink-950 px-4 py-3.5 text-sm font-semibold text-white shadow-card transition hover:opacity-90"
        >
          <Download size={16} />
          Save Contact (.vcf)
        </a>

        <AppCta profileId={profile.id} />
      </div>

      {profile.website && (
        <a
          href={profile.website}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-1.5 text-xs text-ink-700/70 underline-offset-4 hover:underline"
        >
          <MapPin size={13} />
          Find us
        </a>
      )}

      <p className="pt-2 text-center text-[11px] text-ink-700/50">
        Powered by Namma Info
      </p>
    </main>
  );
}
