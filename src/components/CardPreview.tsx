import type { Profile } from "@/lib/supabase/types";

function initials(name: string | null) {
  if (!name) return "NI";
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase()).join("") || "NI";
}

export default function CardPreview({ profile }: { profile: Profile }) {
  return (
    <div className="card-foil relative overflow-hidden rounded-[28px] p-6 text-white shadow-card sm:p-8">
      <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/5 blur-2xl" />
      <div className="pointer-events-none absolute -bottom-16 -left-10 h-48 w-48 rounded-full bg-white/5 blur-3xl" />

      <div className="relative flex items-start justify-between">
        <span className="text-[11px] font-medium uppercase tracking-[0.2em] text-white/60">
          Digital Business Card
        </span>
        <span className="rounded-full border border-white/15 px-2.5 py-1 text-[10px] font-medium tracking-wide text-white/70">
          NAMMA INFO
        </span>
      </div>

      <div className="relative mt-10 flex items-center gap-4">
        {profile.avatar_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={profile.avatar_url}
            alt={profile.owner_name ?? "Profile photo"}
            className="h-16 w-16 rounded-2xl object-cover ring-1 ring-white/15"
          />
        ) : (
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/10 text-lg font-semibold ring-1 ring-white/15">
            {initials(profile.owner_name)}
          </div>
        )}
        <div className="min-w-0">
          <h1 className="truncate font-display text-2xl font-medium leading-tight">
            {profile.owner_name || "Namma Info Member"}
          </h1>
          <p className="truncate text-sm text-white/70">
            {[profile.job_title, profile.business_name]
              .filter(Boolean)
              .join(" · ") || "Business profile"}
          </p>
        </div>
      </div>

      {profile.bio && (
        <p className="relative mt-5 text-sm leading-relaxed text-white/75">
          {profile.bio}
        </p>
      )}
    </div>
  );
}
