import { notFound } from "next/navigation";
import { getCardAndProfile } from "@/lib/card-lookup";
import { buildCardMetadata } from "@/lib/card-metadata";
import CardPageView from "@/components/CardPageView";
import type { Metadata } from "next";

/**
 * The vanity card URL — https://nammainfo-webv2.vercel.app/<slug>
 * (e.g. /wrnxt), matched against cards.public_slug. Falls back to a
 * plain 404 for any single-segment path that isn't a known card, so
 * this coexists fine with the rest of the site (/, /c/..., /api/...).
 */
export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  return buildCardMetadata(slug);
}

export default async function SlugCardPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const result = await getCardAndProfile(slug);
  if (!result) notFound();

  return <CardPageView card={result.card} profile={result.profile} />;
}
