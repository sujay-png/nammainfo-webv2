"use client";

import Link from "next/link";
import type { CSSProperties } from "react";
import Magnetic from "./magnetic";
import { useScrollProgress } from "../hooks/use-scroll-progress";
import s from "./landing.module.css";

const WORD = "namma info".split("");

/** Last call to action, then a huge wordmark that rises letter by letter. */
export default function SiteFooter() {
  // 0 → 1 as the footer scrolls up until its bottom meets the bottom of the screen.
  const ref = useScrollProgress<HTMLElement>((_p, el) => {
    const r = el.getBoundingClientRect();
    const k = Math.min(1, Math.max(0, (window.innerHeight - r.top) / r.height));
    el.style.setProperty("--fp", Math.min(1, Math.max(0, (k - 0.55) / 0.42)).toFixed(4));
  }, "through");

  return (
    <footer ref={ref} className="relative overflow-clip border-t border-[var(--lp-line)] pt-24 sm:pt-32">
      <div className="mx-auto max-w-[1320px] px-5 sm:px-8">
        <div className="flex flex-col items-start justify-between gap-10 lg:flex-row lg:items-end">
          <h2 className={`${s.display} max-w-[13ch] text-[clamp(2.6rem,6vw,5.8rem)] font-bold leading-[0.95]`}>
            Your next card is the last one you&rsquo;ll print.
          </h2>
          <div className="flex flex-wrap items-center gap-3">
            <Magnetic>
              <Link
                href="/signup"
                className="inline-flex h-16 items-center rounded-full bg-[var(--lp-accent)] px-10 text-[17px] font-semibold text-[var(--lp-accent-ink)] transition hover:brightness-110"
              >
                Get your card
              </Link>
            </Magnetic>
            <Link
              href="/signup?mode=signin"
              className="inline-flex h-16 items-center rounded-full border border-[var(--lp-line)] px-8 text-[17px] font-medium transition hover:border-[var(--lp-ink)]"
            >
              Log in
            </Link>
          </div>
        </div>

        <div className="mt-24 flex flex-col gap-4 border-t border-[var(--lp-line)] pt-6 text-[14px] text-[var(--lp-soft)] sm:flex-row sm:items-center sm:justify-between">
          <p>&copy; {new Date().getFullYear()} Namma Info</p>
          <p>
            <span lang="kn" style={{ fontFamily: "'Noto Sans Kannada', sans-serif", fontWeight: 800 }}>ನಮ್ಮ</span> (namma) means &ldquo;ours&rdquo; in Kannada.
          </p>
        </div>
      </div>

      <div aria-hidden className="mt-6 select-none overflow-clip px-3 sm:px-6">
        <p className={`${s.display} flex justify-between whitespace-pre text-[16.4vw] font-[800] leading-[0.8] tracking-[-0.06em]`}>
          {WORD.map((ch, i) => (
            <span
              key={i}
              className="inline-block will-change-transform"
              style={
                {
                  transform: `translate3d(0, calc(min(1, max(0, 1 - (var(--fp, 0) - ${(i * 0.04).toFixed(2)}) / 0.6)) * 105%), 0)`,
                  color: ch === " " ? undefined : i < 5 ? "var(--lp-ink)" : "var(--lp-accent)",
                } as CSSProperties
              }
            >
              {ch}
            </span>
          ))}
        </p>
      </div>
    </footer>
  );
}
