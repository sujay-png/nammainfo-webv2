"use client";

import { useState } from "react";
import { createClient } from "@/supabase/client";
import BusinessTypePicker from "@/features/business-type/components/business-type-picker";

/**
 * One-time, required sheet for existing owners who haven't chosen a
 * business type yet. Can't be dismissed: business type decides how review
 * suggestions are written on their card.
 */
export default function RequireBusinessType({
  userId,
  onDone,
}: {
  userId: string;
  onDone: (type: string) => void;
}) {
  const [value, setValue] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    if (!value) return;
    setSaving(true);
    setError(null);
    const supabase = createClient();
    const { error } = await supabase
      .from("profiles")
      .update({ business_type: value } as Record<string, unknown>)
      .eq("id", userId);
    setSaving(false);
    if (error) {
      setError("Couldn't save. Please check your connection and try again.");
      return;
    }
    onDone(value);
  }

  return (
    <div
      className="fixed inset-0 z-[96] flex items-end justify-center bg-black/55 backdrop-blur-[2px] sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="biz-type-title"
    >
      <div className="max-h-[92dvh] w-full max-w-md animate-slide-up overflow-y-auto rounded-t-[28px] bg-[var(--background)] px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-6 shadow-2xl sm:rounded-[28px] sm:pb-6">
        <h2 id="biz-type-title" className="font-headline text-lg font-semibold tracking-tight text-[var(--foreground)]">
          One quick question
        </h2>
        <p className="mb-5 mt-1 text-sm leading-relaxed text-[var(--muted-foreground)]">
          Tell us what kind of business you are, so the reviews your customers post match what you actually do.
        </p>

        <BusinessTypePicker value={value} onChange={setValue} />

        {error && <p className="mt-3 text-xs text-red-500">{error}</p>}

        <button
          type="button"
          onClick={save}
          disabled={!value || saving}
          className="mt-5 w-full rounded-2xl bg-[var(--primary)] py-4 text-sm font-semibold text-[var(--primary-foreground)] transition active:scale-[0.99] disabled:opacity-40"
        >
          {saving ? "Saving…" : "Save and continue"}
        </button>
      </div>
    </div>
  );
}
