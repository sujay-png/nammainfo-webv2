"use client";

import { useRef, useState } from "react";
import { Check, ImagePlus, Loader2, Plus, Trash2 } from "lucide-react";
import { createClient } from "@/supabase/client";
import { ImageProcessError, LOGO_IMAGE } from "@/lib/images/process-image";
import { deleteProfileImage, uploadProfileImage } from "@/lib/images/profile-media";
import { MAX_CLIENTS, normalizeWebsite, type ClientItem } from "../types";

const input =
  "w-full rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-ink-400";

const newId = () => Math.random().toString(36).slice(2, 10);

/**
 * Edit sheet body for Profile → Our Clients. Each client has a name, an
 * optional logo (shrunk to fit 480×240, transparency kept) and an optional
 * website that opens when the logo is tapped. Saved to profiles.clients.
 */
export default function ClientsEditor({
  profileId,
  initial,
  onSaved,
  onCancel,
}: {
  profileId: string;
  initial: ClientItem[];
  onSaved: (items: ClientItem[]) => void;
  onCancel: () => void;
}) {
  const [items, setItems] = useState<ClientItem[]>(() => (initial.length ? initial : [{ id: newId(), name: "" }]));
  const [uploading, setUploading] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [badSite, setBadSite] = useState<Set<string>>(new Set());
  const uploadedNow = useRef<Set<string>>(new Set());

  function patch(id: string, change: Partial<ClientItem>) {
    setItems((list) => list.map((c) => (c.id === id ? { ...c, ...change } : c)));
  }

  async function pickLogo(id: string, file: File) {
    setError(null);
    setUploading(id);
    try {
      const url = await uploadProfileImage(profileId, "clients", file, LOGO_IMAGE);
      uploadedNow.current.add(url);
      const old = items.find((c) => c.id === id)?.logo_url;
      if (old && uploadedNow.current.has(old)) {
        uploadedNow.current.delete(old);
        deleteProfileImage(old);
      }
      patch(id, { logo_url: url });
    } catch (e) {
      setError(e instanceof ImageProcessError || e instanceof Error ? e.message : "Couldn't add that logo.");
    } finally {
      setUploading(null);
    }
  }

  async function save() {
    setError(null);
    const filled = items.filter((c) => c.name.trim() || c.logo_url || c.website?.trim());
    if (filled.some((c) => !c.name.trim())) {
      setError("Each client needs a name.");
      return;
    }
    const invalid = new Set(filled.filter((c) => normalizeWebsite(c.website) === null).map((c) => c.id));
    setBadSite(invalid);
    if (invalid.size) {
      setError("Check the highlighted website. Use something like acme.com, or leave it empty.");
      return;
    }
    const clean: ClientItem[] = filled.map((c) => ({
      id: c.id,
      name: c.name.trim().slice(0, 80),
      logo_url: c.logo_url || undefined,
      website: normalizeWebsite(c.website) || undefined,
    }));

    setSaving(true);
    const { error: dbError } = await createClient()
      .from("profiles")
      .update({ clients: clean } as Record<string, unknown>)
      .eq("id", profileId);
    setSaving(false);
    if (dbError) {
      setError(
        /clients/.test(dbError.message)
          ? "Clients need a quick database update first (run the 20261104 migration)."
          : "Couldn't save. Please check your connection and try again."
      );
      return;
    }

    const kept = new Set(clean.map((c) => c.logo_url).filter(Boolean));
    for (const c of initial) if (c.logo_url && !kept.has(c.logo_url)) deleteProfileImage(c.logo_url);
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
        Show the businesses you&apos;ve worked with. The logo and website are optional; if you add a website, tapping
        the logo opens it.
      </p>

      {items.map((c, idx) => (
        <div key={c.id} className="flex items-start gap-3 rounded-xl border border-ink-200 p-3">
          <label
            className="relative flex h-16 w-24 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-lg border border-dashed border-ink-300 bg-white text-ink-400 transition hover:border-ink-500"
            aria-label="Add the client's logo"
          >
            {c.logo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={c.logo_url} alt="" className="h-full w-full object-contain p-1.5" />
            ) : (
              <span className="flex flex-col items-center gap-0.5 text-[10px]">
                <ImagePlus size={18} /> Logo
              </span>
            )}
            {uploading === c.id && (
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
                if (f) pickLogo(c.id, f);
                e.target.value = "";
              }}
            />
          </label>
          <div className="min-w-0 flex-1 space-y-2">
            <input
              value={c.name}
              onChange={(e) => patch(c.id, { name: e.target.value })}
              placeholder="Client name *"
              maxLength={80}
              className={input}
            />
            <input
              value={c.website ?? ""}
              onChange={(e) => {
                patch(c.id, { website: e.target.value });
                if (badSite.has(c.id)) setBadSite((s) => new Set([...s].filter((x) => x !== c.id)));
              }}
              placeholder="Website (optional)"
              inputMode="url"
              autoCapitalize="none"
              className={`${input} ${badSite.has(c.id) ? "border-red-400 focus:border-red-500" : ""}`}
            />
          </div>
          <button
            type="button"
            onClick={() => setItems((list) => list.filter((x) => x.id !== c.id))}
            className="rounded-lg p-1.5 text-ink-400 transition hover:bg-red-50 hover:text-red-600"
            aria-label={`Remove client ${idx + 1}`}
          >
            <Trash2 size={15} />
          </button>
        </div>
      ))}

      {items.length < MAX_CLIENTS && (
        <button
          type="button"
          onClick={() => setItems((list) => [...list, { id: newId(), name: "" }])}
          className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-ink-300 py-2.5 text-sm font-medium text-ink-600 transition hover:border-ink-500 hover:bg-ink-50"
        >
          <Plus size={15} /> Add client
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
