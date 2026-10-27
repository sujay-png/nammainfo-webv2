"use client";

import { BUSINESS_TYPES } from "@/features/business-type/lib/business-types";

/** Required "What best describes your business?" picker. */
export default function BusinessTypePicker({
  value,
  onChange,
  error,
}: {
  value: string | null | undefined;
  onChange: (v: string) => void;
  error?: boolean;
}) {
  return (
    <div>
      <p className="mb-1.5 text-xs font-medium text-ink-500">
        What best describes your business? <span className="text-red-500">*</span>
      </p>
      <div className="grid grid-cols-2 gap-2">
        {BUSINESS_TYPES.map((t) => {
          const active = value === t.value;
          return (
            <button
              key={t.value}
              type="button"
              onClick={() => onChange(t.value)}
              aria-pressed={active}
              className={`rounded-xl border px-3 py-2.5 text-left transition ${
                active
                  ? "border-ink-950 bg-ink-950 text-white"
                  : error
                    ? "border-red-400"
                    : "border-ink-200 hover:border-ink-400"
              } ${t.value === "freelancer" && BUSINESS_TYPES.length % 2 === 1 ? "col-span-2" : ""}`}
            >
              <span className="block text-xs font-semibold">{t.label}</span>
              <span className={`mt-0.5 block text-[10px] leading-snug ${active ? "text-white/70" : "text-ink-400"}`}>
                {t.hint}
              </span>
            </button>
          );
        })}
      </div>
      <p className={`mt-1.5 text-[11px] ${error ? "font-medium text-red-500" : "text-ink-400"}`}>
        {error
          ? "Please choose your business type to continue."
          : "Helps us suggest reviews that match what you actually do."}
      </p>
    </div>
  );
}
