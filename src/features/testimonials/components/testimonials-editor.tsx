"use client";

import { useRef, useState } from "react";
import { Camera, Check, Loader2, Plus, Star, Trash2 } from "lucide-react";
import { createClient } from "@/supabase/client";
import { AVATAR_IMAGE, ImageProcessError } from "@/lib/images/process-image";
import { deleteProfileImage, uploadProfileImage } from "@/lib/images/profile-media";
import { MAX_QUOTE, MAX_TESTIMONIALS, type Testimonial } from "../types";

const input =
  "w-full rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-ink-400";

const newId = () => Math.random().toString(36).slice(2, 10);

/**
 * Edit sheet body for Profile → Testimonials. Photos are shrunk in the
 * browser (320 px square WebP, ~30 KB) and uploaded the moment they are
 * picked; the list is written to profiles.testimonials on Save.
 */
export default function TestimonialsEditor({
  profileId,
  initial,
  onSaved,
  onCancel,
}: {
  profileId: string;
  initial: Testimonial[];
  onSaved: (items: Testimonial[]) => void;
  onCancel: () => void;
}) {
  const [items, setItems] = useState<Testimonial[]>(() =>
    initial.length ? initial : [{ id: newId(), name: "", quote: "", rating: 5 }]
  );
  const [uploading, setUploading] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Photos uploaded in this session: deleted again if the user cancels.
  const uploadedNow = useRef<Set<string>>(new Set());

  function patch(id: string, change: Partial<Testimonial>) {
    setItems((list) => list.map((t) => (t.id === id ? { ...t, ...change } : t)));
  }

  async function pickPhoto(id: string, file: File) {
    setError(null);
    setUploading(id);
    try {
      const url = await uploadProfileImage(profileId, "testimonials", file, AVATAR_IMAGE);
      uploadedNow.current.add(url);
      const old = items.find((t) => t.id === id)?.photo_url;
      if (old && uploadedNow.current.has(old)) {
        uploadedNow.current.delete(old);
        deleteProfileImage(old);
      }
      patch(id, { photo_url: url });
    } catch (e) {
      setError(e instanceof ImageProcessError || e instanceof Error ? e.message : "Couldn't add that photo.");
    } finally {
      setUploading(null);
    }
  }

  async function save() {
    setError(null);
    const filled = items.filter((t) => t.name.trim() || t.quote.trim() || t.photo_url);
    const bad = filled.find((t) => !t.name.trim() || !t.quote.trim());
    if (bad) {
      setError("Each testimonial needs the person's name and what they said.");
      return;
    }
    const clean: Testimonial[] = filled.map((t) => ({
      id: t.id,
      name: t.name.trim().slice(0, 80),
      role: t.role?.trim().slice(0, 80) || undefined,
      quote: t.quote.trim().slice(0, MAX_QUOTE),
      rating: t.rating && t.rating >= 1 && t.rating <= 5 ? Math.round(t.rating) : undefined,
      photo_url: t.photo_url || undefined,
    }));

    setSaving(true);
    const { error: dbError } = await createClient()
      .from("profiles")
      .update({ testimonials: clean } as Record<string, unknown>)
      .eq("id", profileId);
    setSaving(false);
    if (dbError) {
      setError(
        /testimonials/.test(dbError.message)
          ? "Testimonials need a quick database update first (run the 20261104 migration)."
          : "Couldn't save. Please check your connection and try again."
      );
      return;
    }

    // Clean up photos that are no longer used.
    const kept = new Set(clean.map((t) => t.photo_url).filter(Boolean));
    for (const t of initial) if (t.photo_url && !kept.has(t.photo_url)) deleteProfileImage(t.photo_url);
    uploadedNow.current.forEach((u) => !kept.has(u) && deleteProfileImage(u));
    uploadedNow.current.clear();
    onSaved(clean);
  }

  function cancel() {
    uploadedNow.current.forEach((u) => deleteProfileImage(u));
    uploadedNow.current.clear();
    onCancel();
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-ink-400">
        Add what your customers say about you. A photo of the person is optional; it&apos;s resized automatically.
      </p>

      {items.map((t, idx) => (
        <div key={t.id} className="space-y-2.5 rounded-xl border border-ink-200 p-3">
          <div className="flex items-start gap-3">
            <label
              className="relative flex h-16 w-16 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-full border border-dashed border-ink-300 bg-ink-50 text-ink-400 transition hover:border-ink-500"
              aria-label="Add the person's photo"
            >
              {t.photo_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={t.photo_url} alt="" className="h-full w-full object-cover" />
              ) : (
                <Camera size={18} />
              )}
              {uploading === t.id && (
                <span className="absolute inset-0 flex items-center justify-center bg-white/70">
                  <Loader2 size={18} className="animate-spin text-ink-600" />
                </span>
              )}
              <input
                type="file"
                accept="image/*"
                className="hidden"
                disabled={uploading !== null}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) pickPhoto(t.id, f);
                  e.target.value = "";
                }}
              />
            </label>
            <div className="min-w-0 flex-1 space-y-2">
              <input
                value={t.name}
                onChange={(e) => patch(t.id, { name: e.target.value })}
                placeholder="Name *"
                maxLength={80}
                className={input}
              />
              <input
                value={t.role ?? ""}
                onChange={(e) => patch(t.id, { role: e.target.value })}
                placeholder="Role or company (optional)"
                maxLength={80}
                className={input}
              />
            </div>
            <button
              type="button"
              onClick={() => setItems((list) => list.filter((x) => x.id !== t.id))}
              className="rounded-lg p-1.5 text-ink-400 transition hover:bg-red-50 hover:text-red-600"
              aria-label={`Remove testimonial ${idx + 1}`}
            >
              <Trash2 size={15} />
            </button>
          </div>

          <div className="flex items-center gap-1" role="radiogroup" aria-label="Rating">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                role="radio"
                aria-checked={(t.rating ?? 0) === n}
                aria-label={`${n} star${n > 1 ? "s" : ""}`}
                onClick={() => patch(t.id, { rating: n })}
                className="p-0.5"
              >
                <Star
                  size={18}
                  className={(t.rating ?? 0) >= n ? "fill-amber-400 text-amber-400" : "text-ink-200"}
                />
              </button>
            ))}
          </div>

          <div>
            <textarea
              value={t.quote}
              onChange={(e) => patch(t.id, { quote: e.target.value })}
              placeholder="What they said *"
              rows={3}
              maxLength={MAX_QUOTE}
              className={`${input} resize-none`}
            />
            <p className="mt-0.5 text-right font-mono text-[10px] text-ink-300">
              {t.quote.length}/{MAX_QUOTE}
            </p>
          </div>
        </div>
      ))}

      {items.length < MAX_TESTIMONIALS && (
        <button
          type="button"
          onClick={() => setItems((list) => [...list, { id: newId(), name: "", quote: "", rating: 5 }])}
          className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-ink-300 py-2.5 text-sm font-medium text-ink-600 transition hover:border-ink-500 hover:bg-ink-50"
        >
          <Plus size={15} /> Add testimonial
        </button>
      )}

      {error && <p className="text-xs text-red-600">{error}</p>}

      <div className="flex gap-2 pt-1">
        <button
          type="button"
          onClick={cancel}
          className="flex-1 rounded-xl border border-ink-200 py-3 text-sm font-medium text-ink-600 transition hover:bg-ink-50"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={save}
          disabled={saving || uploading !== null}
          className="flex flex-[2] items-center justify-center gap-2 rounded-xl bg-ink-950 py-3 text-sm font-medium text-white transition hover:bg-ink-800 disabled:opacity-40"
        >
          <Check size={14} />
          {saving ? "Saving…" : "Save changes"}
        </button>
      </div>
    </div>
  );
}
