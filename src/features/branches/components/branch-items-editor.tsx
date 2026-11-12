"use client";

import { useState } from "react";
import { ArrowDown, ArrowUp, ImagePlus, Loader2, Plus, Trash2, X } from "lucide-react";
import type { ServiceItem } from "@/supabase/database-types";
import { ITEM_IMAGE, ImageProcessError } from "@/lib/images/process-image";
import { uploadProfileImage } from "@/lib/images/profile-media";

const input =
  "w-full rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm outline-none transition focus:border-[var(--foreground)]";

/**
 * The "Same as main profile / Custom for this branch" switch plus a compact
 * list editor for a branch's own services or products.
 *
 * value === null → the branch shows the main profile's list.
 * value is an array → the branch shows exactly this list.
 */
export default function BranchItemsEditor({
  kind,
  ownerId,
  mainItems,
  value,
  onChange,
  onUploadingChange,
}: {
  kind: "services" | "products";
  ownerId: string;
  mainItems: ServiceItem[];
  value: ServiceItem[] | null;
  onChange: (items: ServiceItem[] | null) => void;
  onUploadingChange?: (busy: boolean) => void;
}) {
  const [uploading, setUploading] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const label = kind === "services" ? "service" : "product";
  const custom = Array.isArray(value);
  const items = value ?? [];

  function patch(i: number, change: Partial<ServiceItem>) {
    onChange(items.map((it, idx) => (idx === i ? { ...it, ...change } : it)));
  }

  function move(i: number, dir: -1 | 1) {
    const j = i + dir;
    if (j < 0 || j >= items.length) return;
    const next = [...items];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  }

  async function pickPhoto(i: number, file: File) {
    setError(null);
    setUploading(i);
    onUploadingChange?.(true);
    try {
      const url = await uploadProfileImage(ownerId, "branches", file, ITEM_IMAGE);
      patch(i, { image_url: url });
    } catch (e) {
      setError(e instanceof ImageProcessError || e instanceof Error ? e.message : "Couldn't add that photo.");
    } finally {
      setUploading(null);
      onUploadingChange?.(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-1 rounded-xl bg-[var(--accent)] p-1" role="radiogroup">
        <button
          type="button"
          role="radio"
          aria-checked={!custom}
          onClick={() => onChange(null)}
          className={`rounded-lg px-2 py-2 text-xs font-semibold transition ${!custom ? "bg-[var(--card)] shadow-sm" : "text-[var(--muted-foreground)]"}`}
        >
          Same as main ({mainItems.length})
        </button>
        <button
          type="button"
          role="radio"
          aria-checked={custom}
          onClick={() => !custom && onChange(mainItems.map((it) => ({ ...it })))}
          className={`rounded-lg px-2 py-2 text-xs font-semibold transition ${custom ? "bg-[var(--card)] shadow-sm" : "text-[var(--muted-foreground)]"}`}
        >
          Custom for this branch
        </button>
      </div>

      {!custom ? (
        <p className="text-xs leading-relaxed text-[var(--muted-foreground)]">
          This branch shows the {kind} from your main profile. When you change them there, this branch updates too.
        </p>
      ) : (
        <>
          <p className="text-xs leading-relaxed text-[var(--muted-foreground)]">
            We copied your main list to start. Add, remove or change {kind} here; your main profile stays as it is.
          </p>
          {items.map((it, i) => (
            <div key={i} className="rounded-xl border border-[var(--border)] p-3">
              <div className="flex items-start gap-3">
                <label
                  className="relative flex h-16 w-16 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-lg border border-dashed border-[var(--border)] bg-[var(--card)] text-[var(--muted-foreground)]"
                  aria-label={`Photo for ${it.name || `this ${label}`}`}
                >
                  {it.image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={it.image_url} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <ImagePlus size={18} />
                  )}
                  {uploading === i && (
                    <span className="absolute inset-0 flex items-center justify-center bg-[var(--card)]/70">
                      <Loader2 size={16} className="animate-spin" />
                    </span>
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    disabled={uploading !== null}
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) pickPhoto(i, f);
                      e.target.value = "";
                    }}
                  />
                </label>
                <div className="min-w-0 flex-1 space-y-2">
                  <input
                    value={it.name}
                    onChange={(e) => patch(i, { name: e.target.value })}
                    placeholder={`${label[0].toUpperCase()}${label.slice(1)} name *`}
                    maxLength={80}
                    className={input}
                  />
                  <div className="flex gap-2">
                    <input
                      value={it.price ?? ""}
                      onChange={(e) => patch(i, { price: e.target.value || undefined })}
                      placeholder="Price (optional)"
                      maxLength={40}
                      className={input}
                    />
                    <input
                      value={it.category ?? ""}
                      onChange={(e) => patch(i, { category: e.target.value || undefined })}
                      placeholder="Category"
                      maxLength={40}
                      className={input}
                    />
                  </div>
                  <textarea
                    value={it.description ?? ""}
                    onChange={(e) => patch(i, { description: e.target.value || undefined })}
                    placeholder="Short description (optional)"
                    rows={2}
                    maxLength={400}
                    className={`${input} resize-none`}
                  />
                </div>
              </div>
              <div className="mt-2 flex items-center justify-between">
                <div className="flex gap-1">
                  <IconBtn label="Move up" onClick={() => move(i, -1)} disabled={i === 0}>
                    <ArrowUp size={14} />
                  </IconBtn>
                  <IconBtn label="Move down" onClick={() => move(i, 1)} disabled={i === items.length - 1}>
                    <ArrowDown size={14} />
                  </IconBtn>
                  {it.image_url && (
                    <IconBtn label="Remove photo" onClick={() => patch(i, { image_url: undefined })}>
                      <X size={14} />
                    </IconBtn>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => onChange(items.filter((_, idx) => idx !== i))}
                  className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-[var(--muted-foreground)] transition hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/20"
                >
                  <Trash2 size={13} /> Remove
                </button>
              </div>
            </div>
          ))}
          {items.length < 100 && (
            <button
              type="button"
              onClick={() => onChange([...items, { name: "" }])}
              className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-[var(--border)] py-2.5 text-sm font-medium text-[var(--muted-foreground)] transition hover:border-[var(--foreground)] hover:text-[var(--foreground)]"
            >
              <Plus size={15} /> Add {label}
            </button>
          )}
          {error && <p className="text-xs text-red-500">{error}</p>}
        </>
      )}
    </div>
  );
}

function IconBtn({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
      className="rounded-lg p-1.5 text-[var(--muted-foreground)] transition hover:bg-[var(--accent)] hover:text-[var(--foreground)] disabled:opacity-30"
    >
      {children}
    </button>
  );
}
