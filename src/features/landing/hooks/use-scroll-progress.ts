"use client";

import { useEffect, useRef } from "react";

/**
 * How far the user has scrolled through an element, as a number 0 → 1.
 *
 * - "through": 0 when the element's top enters the bottom of the screen,
 *              1 when its bottom leaves the top.
 * - "pin":     for tall sections with a sticky child. 0 when the section's
 *              top hits the top of the screen, 1 when its bottom reaches
 *              the bottom of the screen.
 * - "leave":   0 at the top of the page, 1 once the element has scrolled
 *              completely off the top (used for the hero parallax).
 *
 * The callback runs at most once per animation frame and only while the
 * element is near the screen, and it does NOT re-render React, so
 * components write straight to CSS variables / styles from it.
 */
export type ScrollMode = "through" | "pin" | "leave";

const clamp = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

export function useScrollProgress<T extends HTMLElement>(
  onFrame: (progress: number, el: T) => void,
  mode: ScrollMode = "through"
) {
  const ref = useRef<T>(null);
  const callback = useRef(onFrame);
  callback.current = onFrame;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let raf = 0;
    let visible = true;
    let last = -1;

    const measure = () => {
      raf = 0;
      const r = el.getBoundingClientRect();
      const vh = window.innerHeight;
      const p =
        mode === "pin"
          ? clamp(-r.top / Math.max(1, r.height - vh))
          : mode === "leave"
            ? clamp(-r.top / Math.max(1, r.height))
            : clamp((vh - r.top) / (vh + r.height));
      if (p !== last) {
        last = p;
        callback.current(p, el);
      }
    };
    const onScroll = () => {
      if (visible && !raf) raf = requestAnimationFrame(measure);
    };
    const io = new IntersectionObserver(
      ([entry]) => {
        visible = entry.isIntersecting;
        measure(); // settle on the final value when it leaves the screen
      },
      { rootMargin: "120px 0px" }
    );
    io.observe(el);
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    measure();
    return () => {
      io.disconnect();
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      cancelAnimationFrame(raf);
    };
  }, [mode]);

  return ref;
}

/** True when the visitor has asked their device for less motion. */
export function prefersReducedMotion() {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** True on a mouse / trackpad (not touch screens). */
export function hasFinePointer() {
  return typeof window !== "undefined" && window.matchMedia("(hover: hover) and (pointer: fine)").matches;
}
