import { Download, MapPin } from "lucide-react";
import CardPreview from "@/components/CardPreview";
import ContactButtons from "@/components/ContactButtons";
import AppCta from "@/components/AppCta";
import type { Card, Profile } from "@/lib/supabase/types";

/**
 * The actual card page markup — shared by the root vanity route
 * (/[slug]) and the legacy /c/[cardId] route so both render identically.
 */
export default function CardPageView({
  card,
  profile,
}: {
  card: Card;
  profile: Profile;
}) {
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

        <AppCta profileId={profile.id} cardSlug={card.public_slug} />
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
