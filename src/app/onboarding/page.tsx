"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Profile } from "@/lib/supabase/types";

type SavedConnectionState = "idle" | "saving" | "saved" | "skipped";

function OnboardingForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const ref = searchParams.get("ref");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [connectionState, setConnectionState] = useState<SavedConnectionState>("idle");
  const [connectedBusinessName, setConnectedBusinessName] = useState<string | null>(null);

  const [businessName, setBusinessName] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [phone, setPhone] = useState("");
  const [website, setWebsite] = useState("");
  const [bio, setBio] = useState("");
  const [cardSlug, setCardSlug] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.replace(`/signup${ref ? `?ref=${encodeURIComponent(ref)}` : ""}`);
        return;
      }

      // The signup trigger already created a profile + card row for this
      // user — just load it to prefill the form.
      const { data: profile } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .maybeSingle();

      if (profile) {
        const p = profile as Profile;
        setBusinessName(p.business_name ?? "");
        setOwnerName(p.owner_name ?? "");
        setJobTitle(p.job_title ?? "");
        setPhone(p.phone ?? "");
        setWebsite(p.website ?? "");
        setBio(p.bio ?? "");
      }

      const { data: card } = await supabase
        .from("cards")
        .select("public_slug")
        .eq("profile_id", user.id)
        .maybeSingle();
      if (card) setCardSlug((card as { public_slug: string }).public_slug);

      // Auto-save the connection to whoever's card sent them here.
      if (ref) {
        setConnectionState("saving");
        const { data: referringCard } = await supabase
          .from("cards")
          .select("profile_id")
          .eq("public_slug", ref)
          .maybeSingle();

        const connectedUserId = (referringCard as { profile_id: string } | null)
          ?.profile_id;

        if (connectedUserId && connectedUserId !== user.id) {
          const { error: connErr } = await supabase.from("connections").upsert(
            { user_id: user.id, connected_user_id: connectedUserId },
            { onConflict: "user_id,connected_user_id", ignoreDuplicates: true }
          );
          if (!connErr) {
            setConnectionState("saved");
            const { data: referringProfile } = await supabase
              .from("profiles")
              .select("business_name, owner_name")
              .eq("id", connectedUserId)
              .maybeSingle();
            const rp = referringProfile as
              | { business_name: string | null; owner_name: string | null }
              | null;
            setConnectedBusinessName(rp?.business_name ?? rp?.owner_name ?? "their card");
          } else {
            setConnectionState("skipped");
          }
        } else {
          setConnectionState("skipped");
        }
      }

      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ref]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const supabase = createClient();

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Session expired — please sign in again.");

      const { error: updateError } = await supabase
        .from("profiles")
        .update({
          business_name: businessName.trim() || null,
          owner_name: ownerName.trim() || null,
          job_title: jobTitle.trim() || null,
          phone: phone.trim() || null,
          website: website.trim() || null,
          bio: bio.trim() || null,
        })
        .eq("id", user.id);

      if (updateError) throw updateError;

      router.push(cardSlug ? `/${cardSlug}` : "/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save — try again.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <main className="flex min-h-dvh items-center justify-center">
        <p className="text-sm text-ink-700/70">Setting up your card…</p>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col gap-5 px-6 py-12">
      <div>
        <h1 className="font-display text-2xl font-medium">Your card is ready</h1>
        <p className="mt-1.5 text-sm text-ink-700/70">
          Fill in your details — you can always edit these later.
        </p>
      </div>

      {connectionState === "saved" && (
        <p className="rounded-xl bg-emerald-50 px-4 py-3 text-xs text-emerald-700">
          Saved {connectedBusinessName ?? "the card you tapped"} to your contacts.
        </p>
      )}

      <form onSubmit={handleSave} className="flex flex-col gap-3">
        <input
          placeholder="Business name"
          value={businessName}
          onChange={(e) => setBusinessName(e.target.value)}
          className="rounded-xl border border-ink-900/10 bg-white px-4 py-3 text-sm outline-none focus:border-ink-900"
        />
        <input
          placeholder="Your name"
          value={ownerName}
          onChange={(e) => setOwnerName(e.target.value)}
          className="rounded-xl border border-ink-900/10 bg-white px-4 py-3 text-sm outline-none focus:border-ink-900"
        />
        <input
          placeholder="Job title"
          value={jobTitle}
          onChange={(e) => setJobTitle(e.target.value)}
          className="rounded-xl border border-ink-900/10 bg-white px-4 py-3 text-sm outline-none focus:border-ink-900"
        />
        <input
          type="tel"
          placeholder="Phone"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          className="rounded-xl border border-ink-900/10 bg-white px-4 py-3 text-sm outline-none focus:border-ink-900"
        />
        <input
          type="url"
          placeholder="Website"
          value={website}
          onChange={(e) => setWebsite(e.target.value)}
          className="rounded-xl border border-ink-900/10 bg-white px-4 py-3 text-sm outline-none focus:border-ink-900"
        />
        <textarea
          placeholder="Short bio"
          rows={3}
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          className="resize-none rounded-xl border border-ink-900/10 bg-white px-4 py-3 text-sm outline-none focus:border-ink-900"
        />

        {error && <p className="text-xs text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={saving}
          className="mt-1 rounded-xl bg-ink-950 px-5 py-3 text-sm font-medium text-white shadow-card transition hover:opacity-90 disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save my card"}
        </button>
      </form>
    </main>
  );
}

export default function OnboardingPage() {
  return (
    <Suspense>
      <OnboardingForm />
    </Suspense>
  );
}
