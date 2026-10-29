"use client";

import { flushSync } from "react-dom";
import { useTheme } from "@/hooks/use-theme";
import s from "./landing.module.css";

type ViewTransitionDoc = Document & {
  startViewTransition?: (update: () => void) => { ready: Promise<void> };
};

/**
 * Light / dark switch. Uses the same saved setting as the dashboard.
 * On browsers that support it, the new theme spreads out in a circle
 * from the button.
 */
export default function ThemeSwitch() {
  const { setPreference } = useTheme();

  function toggle(e: React.MouseEvent<HTMLButtonElement>) {
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
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label="Switch between light and dark mode"
      title="Light / dark"
      className="flex h-10 w-10 items-center justify-center rounded-full text-[var(--lp-ink)] transition hover:bg-[var(--lp-surface)]"
    >
      <svg viewBox="0 0 24 24" className={`${s.sunMoon} h-[19px] w-[19px]`} aria-hidden>
        <mask id="lp-moon-cut">
          <rect width="24" height="24" fill="white" />
          <circle className={s.moonCut} cx="17" cy="7" r="7" fill="black" />
        </mask>
        <circle className={s.core} cx="12" cy="12" r="5" fill="currentColor" mask="url(#lp-moon-cut)" />
        <g className={s.rays} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
          <path d="M12 1.8v2.2M12 20v2.2M1.8 12h2.2M20 12h2.2M4.8 4.8l1.5 1.5M17.7 17.7l1.5 1.5M4.8 19.2l1.5-1.5M17.7 6.3l1.5-1.5" />
        </g>
      </svg>
    </button>
  );
}
