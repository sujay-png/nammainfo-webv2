"use client";

import { useState } from "react";
import { Phone } from "lucide-react";
import { createClient } from "@/supabase/client";
import { formatIndianMobile, PHONE_ERROR } from "@/lib/phone";

/**
 * Required, one-time sheet for business owners whose profile has no
 * mobile number (accounts made before the number became mandatory).
 * Can't be dismissed: the number is how customers call and WhatsApp them.
 */
export default function RequirePhone({
  userId,
  onDone,
}: {
  userId: string;
  onDone: (phone: string) => void;
}) {
  const [value, setValue] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const phone = formatIndianMobile(value);
    if (!phone) {
      setError(PHONE_ERROR);
      return;
    }
    setSaving(true);
    setError(null);
    const { error: dbError } = await createClient()
      .from("profiles")
      .update({ phone } as Record<string, unknown>)
      .eq("id", userId);
    setSaving(false);
    if (dbError) {
      setError("Couldn't save. Please check your connection and try again.");
      return;
    }
    onDone(phone);
  }

  return (
    <div
      className="fixed inset-0 z-[96] flex items-end justify-center bg-black/55 backdrop-blur-[2px] sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="phone-required-title"
    >
      <form
        onSubmit={save}
        className="w-full max-w-md animate-slide-up rounded-t-[28px] bg-[var(--background)] px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-6 shadow-2xl sm:rounded-[28px] sm:pb-6"
      >
        <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--muted)] text-[var(--foreground)]">
          <Phone size={20} />
        </span>
        <h2 id="phone-required-title" className="mt-4 font-headline text-lg font-semibold tracking-tight text-[var(--foreground)]">
          Add your mobile number
        </h2>
        <p className="mb-5 mt-1 text-sm leading-relaxed text-[var(--muted-foreground)]">
          Customers use it to call and WhatsApp you from your card. It&apos;s needed to continue.
        </p>

        <div className="flex overflow-hidden rounded-2xl border border-[var(--border)] focus-within:border-[var(--foreground)]">
          <span className="flex items-center border-r border-[var(--border)] bg-[var(--muted)] px-3.5 text-sm text-[var(--muted-foreground)]">
            +91
          </span>
          <input
            type="tel"
            inputMode="numeric"
            autoComplete="tel-national"
            autoFocus
            placeholder="98765 43210"
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              if (error) setError(null);
            }}
            className="w-full bg-transparent px-3.5 py-3.5 text-sm text-[var(--foreground)] outline-none placeholder:text-[var(--muted-foreground)]"
          />
        </div>
        {error && <p className="mt-2 text-xs text-red-500">{error}</p>}

        <button
          type="submit"
          disabled={saving || !value.trim()}
          className="mt-5 w-full rounded-2xl bg-[var(--primary)] py-4 text-sm font-semibold text-[var(--primary-foreground)] transition active:scale-[0.99] disabled:opacity-40"
        >
          {saving ? "Saving…" : "Save and continue"}
        </button>
      </form>
    </div>
  );
}
