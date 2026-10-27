"use client";

import { useEffect, useRef } from "react";
import { hasFinePointer, prefersReducedMotion } from "../hooks/use-scroll-progress";

/** Wrap a button so it leans toward the mouse pointer. Mouse only. */
export default function Magnetic({ children, strength = 0.28 }: { children: React.ReactNode; strength?: number }) {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || !hasFinePointer() || prefersReducedMotion()) return;
    const move = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      const x = e.clientX - (r.left + r.width / 2);
      const y = e.clientY - (r.top + r.height / 2);
      el.style.transitionDuration = "120ms";
      el.style.transform = `translate3d(${x * strength}px, ${y * strength}px, 0)`;
    };
    const leave = () => {
      el.style.transitionDuration = "600ms";
      el.style.transform = "";
    };
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerleave", leave);
    return () => {
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerleave", leave);
    };
  }, [strength]);

  return (
    <span ref={ref} className="inline-block transition-transform ease-[cubic-bezier(0.2,0.85,0.2,1)]">
      {children}
    </span>
  );
}
