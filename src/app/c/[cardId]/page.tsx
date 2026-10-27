import { notFound } from "next/navigation";
import { getCardAndProfile } from "@/features/public-profile/lib/card-lookup";
import { buildCardMetadata } from "@/features/public-profile/lib/card-page-metadata";
import CardPageView from "@/features/public-profile/components/card-page-view";
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
