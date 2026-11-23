"use client";

import { useState } from "react";
import { ArrowDown, ArrowUp, Check, Plus, Trash2 } from "lucide-react";
import { createClient } from "@/supabase/client";
import { normalizeWebsite } from "@/features/clients/types";
import { MAX_CUSTOM_LINKS, MAX_LABEL, newId, saveErrorMessage, type CustomLink } from "../types";

const input =
  "w-full rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-ink-400";

/** Ready-made labels people tap instead of typing. */
const SUGGESTIONS = ["Book appointment", "Order online", "Our menu", "Catalogue", "Location", "Instagram", "Portfolio"];

/**
 * Edit sheet body for Profile → Links at the top. Up to 3 buttons, each a
 * label and a web address, shown under "Add to Contacts" on the card.
 */
export default function CustomLinksEditor({
  profileId,
  initial,
  onSaved,
  onCancel,
}: {
  profileId: string;
  initial: CustomLink[];
  onSaved: (items: CustomLink[]) => void;
  onCancel: () => void;
}) {
  const [items, setItems] = useState<CustomLink[]>(() =>
    initial.length ? initial : [{ id: newId(), label: "", url: "" }]
  );
  const [bad, setBad] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const patch = (id: string, change: Partial<CustomLink>) =>
    setItems((list) => list.map((l) => (l.id === id ? { ...l, ...change } : l)));

  function move(i: number, dir: -1 | 1) {
    const j = i + dir;
    if (j < 0 || j >= items.length) return;
    const next = [...items];
    [next[i], next[j]] = [next[j], next[i]];
    setItems(next);
  }

  async function save() {
    setError(null);
    const filled = items.filter((l) => l.label.trim() || l.url.trim());
    const invalid = new Set(
      filled.filter((l) => !l.label.trim() || !normalizeWebsite(l.url)).map((l) => l.id)
    );
    setBad(invalid);
    if (invalid.size) return setError("Each link needs a button name and a web address like example.com/menu.");
    const clean: CustomLink[] = filled.map((l) => ({
      id: l.id,
      label: l.label.trim().slice(0, MAX_LABEL),
      url: normalizeWebsite(l.url) as string,
    }));
    setSaving(true);
    const { error: dbError } = await createClient()
      .from("profiles")
      .update({ custom_links: clean } as Record<string, unknown>)
      .eq("id", profileId);
    setSaving(false);
    if (dbError) return setError(saveErrorMessage(dbError.message, "custom_links"));
    onSaved(clean);
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-ink-400">
        Up to {MAX_CUSTOM_LINKS} buttons at the top of your card, under &ldquo;Add to Contacts&rdquo;. For example a
        booking page, online store or Instagram.
      </p>

      {items.map((l, i) => (
        <div key={l.id} className={`space-y-2 rounded-xl border p-3 ${bad.has(l.id) ? "border-red-300" : "border-ink-200"}`}>
          <div className="flex items-center gap-2">
            <input
              value={l.label}
              onChange={(e) => patch(l.id, { label: e.target.value })}
              placeholder="Button name, e.g. Book appointment"
              maxLength={MAX_LABEL}
              className={input}
            />
            <div className="flex shrink-0">
              <IconBtn label="Move up" onClick={() => move(i, -1)} disabled={i === 0}><ArrowUp size={14} /></IconBtn>
              <IconBtn label="Move down" onClick={() => move(i, 1)} disabled={i === items.length - 1}><ArrowDown size={14} /></IconBtn>
              <IconBtn label="Remove" danger onClick={() => setItems((list) => list.filter((x) => x.id !== l.id))}><Trash2 size={14} /></IconBtn>
            </div>
          </div>
          <input
            value={l.url}
            onChange={(e) => patch(l.id, { url: e.target.value })}
            placeholder="Link, e.g. example.com/book"
            inputMode="url"
            autoCapitalize="none"
            className={input}
          />
          {!l.label && (
            <div className="flex flex-wrap gap-1">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => patch(l.id, { label: s })}
                  className="rounded-full border border-ink-200 px-2 py-0.5 text-[11px] text-ink-500 transition hover:border-ink-400 hover:text-ink-800"
                >
                  {s}
                </button>
              ))}
            </div>
          )}
        </div>
      ))}

      {items.length < MAX_CUSTOM_LINKS && (
        <button
          type="button"
          onClick={() => setItems((list) => [...list, { id: newId(), label: "", url: "" }])}
          className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-ink-300 py-2.5 text-sm font-medium text-ink-600 transition hover:border-ink-500 hover:bg-ink-50"
        >
          <Plus size={15} /> Add link ({items.length}/{MAX_CUSTOM_LINKS})
        </button>
      )}

      {error && <p className="text-xs text-red-600">{error}</p>}

      <div className="flex gap-2 pt-1">
        <button type="button" onClick={onCancel} className="flex-1 rounded-xl border border-ink-200 py-3 text-sm font-medium text-ink-600 transition hover:bg-ink-50">
          Cancel
        </button>
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="flex flex-[2] items-center justify-center gap-2 rounded-xl bg-ink-950 py-3 text-sm font-medium text-white transition hover:bg-ink-800 disabled:opacity-40"
        >
          <Check size={14} />
          {saving ? "Saving…" : "Save links"}
        </button>
      </div>
    </div>
  );
}

export function IconBtn({
  label,
  onClick,
  disabled,
  danger,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
      className={`rounded-lg p-1.5 text-ink-400 transition disabled:opacity-30 ${danger ? "hover:bg-red-50 hover:text-red-600" : "hover:bg-ink-50 hover:text-ink-800"}`}
    >
      {children}
    </button>
  );
}
