"use client";

import { useEffect } from "react";
import { X } from "lucide-react";

/**
 * Bottom sheet on phones, centred dialog on larger screens.
 * Header (title + optional description + close), scrollable body, optional
 * sticky footer for actions.
 */
export default function Sheet({
  title,
  description,
  onClose,
  children,
  footer,
  dismissible = true,
  zIndex = 90,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  onClose?: () => void;
  children?: React.ReactNode;
  footer?: React.ReactNode;
  dismissible?: boolean;
  zIndex?: number;
}) {
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && dismissible && onClose?.();
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [dismissible, onClose]);

  return (
    <div
      className="fixed inset-0 flex items-end justify-center bg-black/40 sm:items-center sm:p-4"
      style={{ zIndex }}
      onClick={() => dismissible && onClose?.()}
      role="dialog"
      aria-modal="true"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[92dvh] w-full max-w-[440px] animate-slide-up flex-col rounded-t-2xl border border-[var(--border)] bg-[var(--background)] shadow-[0_-8px_40px_-12px_rgba(0,0,0,0.25)] sm:rounded-2xl"
      >
        <div className="mx-auto mt-2 h-1 w-9 shrink-0 rounded-full bg-[var(--border)] sm:hidden" />
        <div className="flex shrink-0 items-start justify-between gap-4 px-5 pb-3 pt-4">
          <div className="min-w-0">
            <h2 className="text-[17px] font-semibold leading-snug tracking-[-0.01em] text-[var(--foreground)]">{title}</h2>
            {description && <p className="mt-1 text-[13px] leading-relaxed text-[var(--muted-foreground)]">{description}</p>}
          </div>
          {dismissible && onClose && (
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="-mr-1.5 -mt-0.5 shrink-0 rounded-md p-1.5 text-[var(--muted-foreground)] transition hover:bg-[var(--muted)] hover:text-[var(--foreground)]"
            >
              <X size={18} />
            </button>
          )}
        </div>
        {children && <div className="min-h-0 overflow-y-auto px-5 pb-4">{children}</div>}
        {footer && (
          <div className="shrink-0 border-t border-[var(--border)] px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3">{footer}</div>
        )}
      </div>
    </div>
  );
}

/** Shared form + button styles for the sheets and forms built on them. */
export const ui = {
  label: "mb-1.5 block text-[13px] font-medium text-[var(--foreground)]",
  hint: "mt-1.5 block text-xs text-[var(--muted-foreground)]",
  input:
    "h-11 w-full rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 text-[15px] text-[var(--foreground)] outline-none transition placeholder:text-[var(--muted-foreground)] focus:border-[var(--muted-foreground)] focus:shadow-[0_0_0_3px_var(--muted)]",
  primary:
    "inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-[var(--primary)] px-4 text-[15px] font-medium text-[var(--primary-foreground)] transition hover:opacity-90 active:opacity-80 disabled:opacity-40",
  secondary:
    "inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--card)] px-4 text-[15px] font-medium text-[var(--foreground)] transition hover:bg-[var(--muted)] disabled:opacity-40",
  ghost:
    "inline-flex h-10 w-full items-center justify-center gap-1.5 rounded-lg px-4 text-sm font-medium text-[var(--muted-foreground)] transition hover:bg-[var(--muted)] hover:text-[var(--foreground)]",
  error: "mt-3 rounded-lg border border-red-500/20 bg-red-500/[0.06] px-3 py-2 text-[13px] text-red-600 dark:text-red-400",
};
