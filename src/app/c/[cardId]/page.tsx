import { notFound } from "next/navigation";
import { getCardAndProfile } from "@/lib/card-lookup";
import { buildCardMetadata } from "@/lib/card-metadata";
import CardPageView from "@/components/CardPageView";
import type { Metadata } from "next";

/**
 * Legacy path — kept working so any card already written to a physical
 * NFC tag / printed QR code under /c/<id> still resolves. New links
 * should use the vanity route at /[slug] instead (see lib/deeplink.ts).
 */
export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ cardId: string }>;
}): Promise<Metadata> {
  const { cardId } = await params;
  return buildCardMetadata(cardId);
}

export default async function CardPage({
  params,
}: {
  params: Promise<{ cardId: string }>;
}) {
  const { cardId } = await params;
  const result = await getCardAndProfile(cardId);
  if (!result) notFound();

  return <CardPageView card={result.card} profile={result.profile} />;
}
