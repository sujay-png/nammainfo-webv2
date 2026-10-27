"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import ThemeSwitch from "./theme-switch";
import s from "./landing.module.css";

const LINKS = [
  { href: "#how", label: "How it works" },
  { href: "#features", label: "Features" },
  { href: "#questions", label: "Questions" },
];

/** Top bar. Slides away while scrolling down, comes back on scroll up. */
export default function LandingNav() {
  const [hidden, setHidden] = useState(false);
  const [solid, setSolid] = useState(false);

  useEffect(() => {
    let lastY = window.scrollY;
    let raf = 0;
    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        const y = window.scrollY;
        setSolid(y > 12);
        if (Math.abs(y - lastY) > 8) {
          setHidden(y > lastY && y > 480);
          lastY = y;
        }
      });
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 transition-transform duration-500 ease-[cubic-bezier(0.2,0.85,0.2,1)] ${
        hidden ? "-translate-y-full" : "translate-y-0"
      }`}
    >
      <div
        className={`mx-auto flex h-[64px] max-w-[1320px] items-center gap-3 px-4 sm:h-[68px] sm:gap-6 transition-colors duration-300 sm:px-8 ${
          solid ? "backdrop-blur-xl" : ""
        }`}
        style={{ background: solid ? "color-mix(in srgb, var(--lp-bg) 78%, transparent)" : "transparent" }}
      >
        <Link href="/" className={`${s.display} flex shrink-0 items-center gap-2 whitespace-nowrap text-[19px] font-bold sm:text-[21px]`}>
          <span className="relative flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-[6px] bg-[var(--lp-ink)]">
            <span className="h-[7px] w-[7px] rounded-full bg-[var(--lp-accent)]" />
          </span>
          namma info
        </Link>

        <nav className="ml-4 hidden items-center gap-1 lg:flex" aria-label="Sections">
          {LINKS.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="whitespace-nowrap rounded-full px-3.5 py-2 text-[14px] text-[var(--lp-soft)] transition hover:text-[var(--lp-ink)]"
            >
              {l.label}
            </a>
          ))}
        </nav>

        <div className="ml-auto flex shrink-0 items-center gap-1 sm:gap-2">
          <ThemeSwitch />
          <Link
            href="/signup?mode=signin"
            className="hidden whitespace-nowrap rounded-full px-4 py-2 text-[14px] font-medium text-[var(--lp-ink)] transition hover:bg-[var(--lp-surface)] sm:inline-block"
          >
            Log in
          </Link>
          <Link
            href="/signup"
            className="whitespace-nowrap rounded-full bg-[var(--lp-ink)] px-3.5 py-2.5 text-[13px] font-medium sm:px-4 sm:text-[14px] text-[var(--lp-bg)] transition hover:opacity-85"
          >
            Get your card
          </Link>
        </div>
      </div>
      <div
        className={`h-px w-full bg-[var(--lp-line)] transition-opacity duration-300 ${solid ? "opacity-100" : "opacity-0"}`}
      />
    </header>
  );
}
