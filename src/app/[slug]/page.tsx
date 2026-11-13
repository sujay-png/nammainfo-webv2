import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import PublicProfileView from "@/features/public-profile/components/public-profile-view";
import {
  getBranches,
  loadPageData,
  membershipGate,
  publicHandle,
  resolveOwner,
} from "@/features/branches/services/public-pages.service";

// ISR: revalidate every 30 seconds so edits appear quickly
// while repeat visitors get a cached page instantly
export const revalidate = 30;

function sanitizeSlug(raw: string): string {
  try {
    const decoded = decodeURIComponent(raw);
    return decoded.replace(/^(\{+[\d\w_]+\}+|%7b+[\d\w_]+%7d+)/i, "").trim();
  } catch {
    return raw.replace(/^(\{+[\d\w_]+\}+|%7b+[\d\w_]+%7d+)/i, "").trim();
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const clean = sanitizeSlug(slug);
  const result = await resolveOwner(clean);
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
  const clean = sanitizeSlug(slug);
  if (clean && clean !== slug) {
    redirect(`/${clean}`);
  }
  const result = await resolveOwner(clean);
  if (!result) notFound();

  const { profile } = result;

  // Suspended, free or expired accounts show a holding page instead.
  const gate = membershipGate(profile);
  if (gate) return gate;

  // Tap counting happens client-side in <TapTracker /> (rendered by
  // PublicProfileView) — this page is cached, so code here doesn't run
  // once per visitor.
  const [{ card, reviews, employees }, branches] = await Promise.all([
    loadPageData(profile.id, result.card),
    getBranches(profile.id),
  ]);

  return (
    <PublicProfileView
      profile={profile}
      card={card}
      reviews={reviews}
      employees={employees}
      branches={branches}
      handle={publicHandle(profile, slug)}
    />
  );
}
