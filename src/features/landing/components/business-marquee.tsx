"use client";

import { Fragment, useEffect, useRef } from "react";
import { NfcGlyph } from "./nfc-card";
import { prefersReducedMotion } from "../hooks/use-scroll-progress";
import s from "./landing.module.css";

const ROW_ONE = ["Retailers", "Manufacturers", "Doctors", "Freelancers", "Builders", "Wholesalers", "Caterers"];
const ROW_TWO = ["Cafés", "Salons", "Real estate", "Clinics", "Distributors", "Photographers", "Traders"];

/**
 * Two rows of business types drifting in opposite directions. Scrolling
 * speeds them up and they follow the scroll direction, leaning a little
 * with the speed.
 */
export default function BusinessMarquee() {
  const section = useRef<HTMLElement>(null);
  const rowOne = useRef<HTMLDivElement>(null);
  const rowTwo = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const a = rowOne.current;
    const b = rowTwo.current;
    if (!a || !b || !section.current || prefersReducedMotion()) return;

    let xa = 0;
    let xb = -b.scrollWidth / 2;
    let lastY = window.scrollY;
    let lastT = performance.now();
    let speed = 0;
    let dir = 1;
    let raf = 0;

    const wrap = (x: number, w: number) => (x <= -w ? x + w : x > 0 ? x - w : x);
    const tick = (t: number) => {
      const dt = Math.min(48, t - lastT);
      lastT = t;
      const y = window.scrollY;
      const dy = y - lastY;
      lastY = y;
      if (dy !== 0) dir = dy > 0 ? 1 : -1;
      speed += (Math.min(70, Math.abs(dy)) - speed) * 0.08;

      const move = (0.045 + speed * 0.018) * dt * dir;
      xa = wrap(xa - move, a.scrollWidth / 2);
      xb = wrap(xb + move, b.scrollWidth / 2);
      const lean = Math.min(9, speed * 0.22) * dir;
      a.style.transform = `translate3d(${xa.toFixed(1)}px,0,0) skewX(${(-lean).toFixed(2)}deg)`;
      b.style.transform = `translate3d(${xb.toFixed(1)}px,0,0) skewX(${lean.toFixed(2)}deg)`;
      raf = requestAnimationFrame(tick);
    };

    const io = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && !raf) {
        lastT = performance.now();
        lastY = window.scrollY;
        raf = requestAnimationFrame(tick);
      } else if (!entry.isIntersecting && raf) {
        cancelAnimationFrame(raf);
        raf = 0;
      }
    });
    io.observe(section.current);
    return () => {
      io.disconnect();
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <section ref={section} className="overflow-clip py-28 sm:py-36" aria-labelledby="who-heading">
      <div className="mx-auto max-w-[1320px] px-5 sm:px-8">
        <h2 id="who-heading" className="max-w-[24rem] text-[17px] leading-relaxed text-[var(--lp-soft)]">
          Made for people who hand out a dozen cards before lunch.
        </h2>
      </div>
      <div className="mt-10 space-y-2 sm:space-y-4" aria-hidden>
        <Row refEl={rowOne} words={ROW_ONE} />
        <Row refEl={rowTwo} words={ROW_TWO} outline />
      </div>
      <p className="sr-only">{[...ROW_ONE, ...ROW_TWO].join(", ")}</p>
    </section>
  );
}

function Row({ refEl, words, outline }: { refEl: React.RefObject<HTMLDivElement>; words: string[]; outline?: boolean }) {
  const set = (
    <>
      {words.map((w) => (
        <Fragment key={w}>
          <span className={`${s.display} ${outline ? s.outlineText : ""} whitespace-nowrap px-[0.18em]`}>{w}</span>
          <NfcGlyph className="mx-[0.25em] h-[0.42em] w-[0.42em] shrink-0 text-[var(--lp-accent)]" strokeWidth={2.4} />
        </Fragment>
      ))}
    </>
  );
  return (
    <div className="whitespace-nowrap text-[clamp(3.2rem,9.5vw,9rem)] font-bold leading-[1.02]">
      <div ref={refEl} className="inline-flex items-center will-change-transform">
        {set}
        {set}
      </div>
    </div>
  );
}
