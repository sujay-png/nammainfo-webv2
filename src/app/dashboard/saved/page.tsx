"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { getCurrentUser } from "@/lib/supabase/current-user";
import {
  flushPendingSaves,
  readSavedCache,
  writeSavedCache,
  type SavedCardSummary,
} from "@/lib/saved-cards";
import { initials, formatDistanceToNow } from "@/lib/utils";
import { Bookmark, ChevronRight, Search } from "lucide-react";

export default function SavedPage() {
  const router = useRouter();
  const [profiles, setProfiles] = useState<SavedCardSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const user = await getCurrentUser();
      if (!user || cancelled) return;

      // 1. Instant: show what we already know (includes cards saved a
      //    moment ago on a profile page).
      const cached = readSavedCache(user.id);
      if (cached) {
        setProfiles(cached);
        setLoading(false);
      }

      // 2. Background: save anything tapped while signed out, then refresh.
      await flushPendingSaves();
      const supabase = createClient();
      const { data: connections } = await supabase
        .from("connections")
        .select("connected_user_id, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      const rows = (connections ?? []) as { connected_user_id: string; created_at: string }[];
      let fresh: SavedCardSummary[] = [];
      if (rows.length > 0) {
        const { data: profileData } = await supabase
          .from("profiles")
          .select("id, owner_name, business_name, job_title, logo_url, avatar_url, username, slug")
          .in("id", rows.map((r) => r.connected_user_id));

        const byId = new Map(
          ((profileData ?? []) as Omit<SavedCardSummary, "saved_at">[]).map((p) => [p.id, p])
        );
        // Preserve the connections order (most recently tapped first)
        fresh = rows
          .map((r) => {
            const p = byId.get(r.connected_user_id);
            return p ? { ...p, saved_at: r.created_at } : null;
          })
          .filter(Boolean) as SavedCardSummary[];
      }

      if (cancelled) return;
      setProfiles(fresh);
      writeSavedCache(user.id, fresh);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = profiles.filter((p) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      p.owner_name?.toLowerCase().includes(q) ||
      p.business_name?.toLowerCase().includes(q) ||
      p.job_title?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="mx-auto max-w-lg px-4 py-5">
      <h1 className="mb-4 text-xl font-semibold tracking-tight">
        Saved Cards
      </h1>

      {/* Search */}
      <div className="relative mb-4">
        <Search
          size={16}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400"
        />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search saved cards..."
          className="w-full rounded-xl border border-ink-200 bg-white py-2.5 pl-9 pr-3 text-sm outline-none transition"
        />
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="skeleton h-20 rounded-2xl" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-ink-100">
            <Bookmark size={20} className="text-ink-400" />
          </div>
          <p className="text-sm font-medium text-ink-600">
            {search ? "No matching cards" : "No saved cards yet"}
          </p>
          <p className="mt-1 text-xs text-ink-400">
            {search
              ? "Try a different search term"
              : "Tap or scan a Namma Info card to save it here"}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((profile) => (
            <button
              key={profile.id}
              onClick={() => {
                const slug = profile.username || profile.slug;
                if (slug) router.push(`/${slug}`);
              }}
              className="flex w-full items-center gap-3 rounded-2xl border border-ink-100 bg-white p-3.5 text-left transition hover:shadow-card"
            >
              {profile.logo_url || profile.avatar_url ? (
                <img
                  src={(profile.logo_url || profile.avatar_url)!}
                  alt=""
                  loading="lazy"
                  className="h-12 w-12 rounded-xl object-cover"
                />
              ) : (
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-ink-100 text-sm font-semibold text-ink-600">
                  {initials(profile.owner_name || profile.business_name)}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">
                  {profile.owner_name || profile.business_name || "Unknown"}
                </p>
                <p className="truncate text-xs text-ink-400">
                  {[profile.job_title, profile.business_name]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
                {profile.saved_at && (
                  <p className="mt-0.5 font-mono text-[10px] text-ink-300">
                    Saved {formatDistanceToNow(profile.saved_at)}
                  </p>
                )}
              </div>
              <ChevronRight size={16} className="shrink-0 text-ink-300" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
