"use client";

import React from "react";
import { flushSync } from "react-dom";
import { useTheme } from "@/hooks/use-theme";
import s from "@/features/landing/components/landing.module.css";

type ViewTransitionDoc = Document & {
  startViewTransition?: (update: () => void) => { ready: Promise<void> };
};

export const AdminThemeToggle: React.FC = () => {
  const { setPreference } = useTheme();

  const toggle = (e: React.MouseEvent<HTMLButtonElement>) => {
    const next = document.documentElement.classList.contains("dark") ? "light" : "dark";
    const doc = document as ViewTransitionDoc;
    if (!doc.startViewTransition || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setPreference(next);
      return;
    }
    const r = e.currentTarget.getBoundingClientRect();
    const x = r.left + r.width / 2;
    const y = r.top + r.height / 2;
    const radius = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y));
    const transition = doc.startViewTransition(() => {
      flushSync(() => setPreference(next));
    });
    transition.ready
      .then(() => {
        document.documentElement.animate(
          { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${radius}px at ${x}px ${y}px)`] },
          { duration: 700, easing: "cubic-bezier(0.7, 0, 0.2, 1)", pseudoElement: "::view-transition-new(root)" }
        );
      })
      .catch(() => {});
  };

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label="Toggle light and dark mode"
      title="Toggle light / dark mode"
      className="flex h-8 w-8 items-center justify-center rounded-[5px] border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] hover:bg-[var(--accent)] transition-colors cursor-pointer"
    >
      <svg viewBox="0 0 24 24" className={`${s.sunMoon} h-[16px] w-[16px]`} aria-hidden>
        <mask id="admin-moon-cut">
          <rect width="24" height="24" fill="white" />
          <circle className={s.moonCut} cx="17" cy="7" r="7" fill="black" />
        </mask>
        <circle className={s.core} cx="12" cy="12" r="5" fill="currentColor" mask="url(#admin-moon-cut)" />
        <g className={s.rays} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
          <path d="M12 1.8v2.2M12 20v2.2M1.8 12h2.2M20 12h2.2M4.8 4.8l1.5 1.5M17.7 17.7l1.5 1.5M4.8 19.2l1.5-1.5M17.7 6.3l1.5-1.5" />
        </g>
      </svg>
    </button>
  );
};
