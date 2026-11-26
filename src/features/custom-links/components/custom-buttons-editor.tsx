"use client";

import { useRef, useState } from "react";
import { ArrowDown, ArrowUp, Check, FileText, Link2, Loader2, Plus, Trash2, Upload } from "lucide-react";
import { createClient } from "@/supabase/client";
import { normalizeWebsite } from "@/features/clients/types";
import { deleteProfileImage, uploadProfileFile } from "@/lib/images/profile-media";
import { MAX_CUSTOM_BUTTONS, MAX_LABEL, newId, saveErrorMessage, type CustomButton } from "../types";
import { IconBtn } from "./custom-links-editor";

const input =
  "w-full rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-ink-400";

const SUGGESTIONS = ["Menu", "Price list", "Catalogue", "Rate card", "Product list", "Certificates"];

/**
 * Edit sheet body for Profile → Custom buttons. Each button has a name and
 * either a link (Google Drive, Zomato, website…) or an uploaded PDF/image
 * (menu, price list). Shown next to the brochure on the card.
 */
export default function CustomButtonsEditor({
  profileId,
  initial,
  onSaved,
  onCancel,
}: {
  profileId: string;
  initial: CustomButton[];
  onSaved: (items: CustomButton[]) => void;
  onCancel: () => void;
}) {
  const [items, setItems] = useState<CustomButton[]>(() =>
    initial.length ? initial : [{ id: newId(), label: "", url: "", kind: "file" }]
  );
  const [uploading, setUploading] = useState<string | null>(null);
  const [bad, setBad] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const uploadedNow = useRef<Set<string>>(new Set());

  const patch = (id: string, change: Partial<CustomButton>) =>
    setItems((list) => list.map((b) => (b.id === id ? { ...b, ...change } : b)));

  function move(i: number, dir: -1 | 1) {
    const j = i + dir;
    if (j < 0 || j >= items.length) return;
    const next = [...items];
    [next[i], next[j]] = [next[j], next[i]];
    setItems(next);
  }

  async function pickFile(id: string, file: File) {
    setError(null);
    setUploading(id);
    try {
      const url = await uploadProfileFile(profileId, "buttons", file);
      uploadedNow.current.add(url);
      const old = items.find((b) => b.id === id)?.url;
      if (old && uploadedNow.current.has(old)) {
        uploadedNow.current.delete(old);
        deleteProfileImage(old);
      }
      const cur = items.find((b) => b.id === id);
      const guess = file.name.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ").trim().slice(0, MAX_LABEL);
      patch(id, { url, kind: "file", file_name: file.name.slice(0, 80), ...(cur?.label ? {} : { label: guess }) });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't upload that file.");
    } finally {
      setUploading(null);
    }
  }

  async function save() {
    setError(null);
    const filled = items.filter((b) => b.label.trim() || b.url.trim());
    const invalid = new Set(filled.filter((b) => !b.label.trim() || !normalizeWebsite(b.url)).map((b) => b.id));
    setBad(invalid);
    if (invalid.size) return setError("Each button needs a name and a file or link.");
    const clean: CustomButton[] = filled.map((b) => ({
      id: b.id,
      label: b.label.trim().slice(0, MAX_LABEL),
      url: normalizeWebsite(b.url) as string,
      kind: b.kind,
      ...(b.kind === "file" && b.file_name ? { file_name: b.file_name } : {}),
    }));
    setSaving(true);
    const { error: dbError } = await createClient()
      .from("profiles")
      .update({ custom_buttons: clean } as Record<string, unknown>)
      .eq("id", profileId);
    setSaving(false);
    if (dbError) return setError(saveErrorMessage(dbError.message, "custom_buttons"));

    const kept = new Set(clean.map((b) => b.url));
    for (const b of initial) if (b.kind === "file" && !kept.has(b.url)) deleteProfileImage(b.url);
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
        No brochure? Add a <b>Menu</b>, <b>Price list</b> or anything else. Upload a PDF or photo, or paste a link
        (Google Drive, Zomato, your website…).
      </p>

      {items.map((b, i) => (
        <div key={b.id} className={`space-y-2 rounded-xl border p-3 ${bad.has(b.id) ? "border-red-300" : "border-ink-200"}`}>
          <div className="flex items-center gap-2">
            <input
              value={b.label}
              onChange={(e) => patch(b.id, { label: e.target.value })}
              placeholder="Button name, e.g. Menu"
              maxLength={MAX_LABEL}
              className={input}
            />
            <div className="flex shrink-0">
              <IconBtn label="Move up" onClick={() => move(i, -1)} disabled={i === 0}><ArrowUp size={14} /></IconBtn>
              <IconBtn label="Move down" onClick={() => move(i, 1)} disabled={i === items.length - 1}><ArrowDown size={14} /></IconBtn>
              <IconBtn label="Remove" danger onClick={() => setItems((list) => list.filter((x) => x.id !== b.id))}><Trash2 size={14} /></IconBtn>
            </div>
          </div>

          {!b.label && (
            <div className="flex flex-wrap gap-1">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => patch(b.id, { label: s })}
                  className="rounded-full border border-ink-200 px-2 py-0.5 text-[11px] text-ink-500 transition hover:border-ink-400 hover:text-ink-800"
                >
                  {s}
                </button>
              ))}
            </div>
          )}

          <div className="grid grid-cols-2 gap-1 rounded-lg bg-ink-50 p-1 text-xs font-medium">
            {(["file", "link"] as const).map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => b.kind !== k && patch(b.id, { kind: k, url: "", file_name: undefined })}
                className={`flex items-center justify-center gap-1 rounded-md py-1.5 transition ${b.kind === k ? "bg-white shadow-sm" : "text-ink-500"}`}
              >
                {k === "file" ? <Upload size={12} /> : <Link2 size={12} />}
                {k === "file" ? "Upload file" : "Paste link"}
              </button>
            ))}
          </div>

          {b.kind === "file" ? (
            <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-ink-300 px-3 py-2.5 text-xs text-ink-500 transition hover:border-ink-500">
              {uploading === b.id ? <Loader2 size={15} className="animate-spin" /> : <FileText size={15} />}
              <span className="min-w-0 flex-1 truncate">
                {uploading === b.id ? "Uploading…" : b.url ? b.file_name || "File uploaded" : "Choose a PDF or photo (max 10 MB)"}
              </span>
              {b.url && uploading !== b.id && <span className="shrink-0 font-medium text-ink-700">Replace</span>}
              <input
                type="file"
                accept=".pdf,image/jpeg,image/png,image/webp"
                className="hidden"
                disabled={uploading !== null}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) pickFile(b.id, f);
                  e.target.value = "";
                }}
              />
            </label>
          ) : (
            <input
              value={b.url}
              onChange={(e) => patch(b.id, { url: e.target.value })}
              placeholder="Link, e.g. drive.google.com/…"
              inputMode="url"
              autoCapitalize="none"
              className={input}
            />
          )}
        </div>
      ))}

      {items.length < MAX_CUSTOM_BUTTONS && (
        <button
          type="button"
          onClick={() => setItems((list) => [...list, { id: newId(), label: "", url: "", kind: "file" }])}
          className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-ink-300 py-2.5 text-sm font-medium text-ink-600 transition hover:border-ink-500 hover:bg-ink-50"
        >
          <Plus size={15} /> Add button
        </button>
      )}

      {error && <p className="text-xs text-red-600">{error}</p>}

      <div className="flex gap-2 pt-1">
        <button type="button" onClick={cancel} className="flex-1 rounded-xl border border-ink-200 py-3 text-sm font-medium text-ink-600 transition hover:bg-ink-50">
          Cancel
        </button>
        <button
          type="button"
          onClick={save}
          disabled={saving || uploading !== null}
          className="flex flex-[2] items-center justify-center gap-2 rounded-xl bg-ink-950 py-3 text-sm font-medium text-white transition hover:bg-ink-800 disabled:opacity-40"
        >
          <Check size={14} />
          {saving ? "Saving…" : "Save buttons"}
        </button>
      </div>
    </div>
  );
}
