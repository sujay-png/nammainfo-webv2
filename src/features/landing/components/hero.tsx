"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { NfcCardBack, NfcCardFront, NfcGlyph } from "./nfc-card";
import Magnetic from "./magnetic";
import { hasFinePointer, prefersReducedMotion, useScrollProgress } from "../hooks/use-scroll-progress";
import s from "./landing.module.css";

const HEADLINE = ["One tap", "and they have", "your number."];

export default function Hero() {
  const tiltRef = useRef<HTMLDivElement>(null);
  const [flipped, setFlipped] = useState(false);

  // Parallax: the Kannada word drifts down and the card lifts away as you scroll.
  const heroRef = useScrollProgress<HTMLElement>((p, el) => {
    el.style.setProperty("--hp", p.toFixed(4));
  }, "leave");

  // Card follows the mouse in 3D, with the foil catching the light.
  useEffect(() => {
    const el = tiltRef.current;
    if (!el || !hasFinePointer() || prefersReducedMotion()) return;
    let tx = 0, ty = 0, cx = 0, cy = 0, raf = 0;
    const tick = () => {
      cx += (tx - cx) * 0.08;
      cy += (ty - cy) * 0.08;
      el.style.transform = `rotateX(${(-cy * 18).toFixed(2)}deg) rotateY(${(cx * 26).toFixed(2)}deg) translateZ(0)`;
      el.style.setProperty("--mx", `${(50 + cx * 70).toFixed(1)}%`);
      el.style.setProperty("--my", `${(40 + cy * 70).toFixed(1)}%`);
      raf = Math.abs(tx - cx) + Math.abs(ty - cy) > 0.0008 ? requestAnimationFrame(tick) : 0;
    };
    const kick = () => {
      if (!raf) raf = requestAnimationFrame(tick);
    };
    const onMove = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      tx = Math.max(-1, Math.min(1, (e.clientX - (r.left + r.width / 2)) / (window.innerWidth * 0.45)));
      ty = Math.max(-1, Math.min(1, (e.clientY - (r.top + r.height / 2)) / (window.innerHeight * 0.45)));
      kick();
    };
    const onLeave = () => {
      tx = 0;
      ty = 0;
      kick();
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    document.documentElement.addEventListener("pointerleave", onLeave);
    return () => {
      window.removeEventListener("pointermove", onMove);
      document.documentElement.removeEventListener("pointerleave", onLeave);
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <section ref={heroRef} className="relative isolate overflow-clip pb-20 pt-[110px] sm:pt-[140px] lg:min-h-[100svh] lg:pb-24">
      <div
        aria-hidden
        lang="kn"
        className={`${s.kannada} pointer-events-none absolute -right-[8vw] bottom-[-14vw] -z-10 select-none leading-none sm:bottom-[-10vw]`}
        style={{ transform: "translate3d(0, calc(var(--hp, 0) * 26vh), 0)" }}
      >
        ನಮ್ಮ
      </div>

      <div className="mx-auto grid max-w-[1320px] grid-cols-1 items-center gap-y-16 px-5 sm:px-8 lg:grid-cols-12 lg:gap-x-8 xl:gap-x-10">
        <div className="lg:col-span-7">
          <h1 className={`${s.display} whitespace-nowrap text-[clamp(2.5rem,11.4vw,4.6rem)] font-[760] leading-[0.9] lg:text-[clamp(4rem,6.4vw,7.2rem)]`}>
            {HEADLINE.map((text, i) => (
              <span key={text} className={s.line}>
                <span style={{ "--i": i } as CSSProperties}>{text}</span>
              </span>
            ))}
          </h1>

          <p
            className={`${s.fadeIn} mt-8 max-w-[33rem] text-[17px] leading-[1.6] text-[var(--lp-soft)] sm:text-[19px]`}
            style={{ "--d": "620ms" } as CSSProperties}
          >
            Namma Info is a business card with an NFC chip inside. Hold it near any phone and your profile opens: call,
            WhatsApp, directions, and a button to save your number. Nothing for them to install.
          </p>

          <div className={`${s.fadeIn} mt-10 flex flex-wrap items-center gap-3`} style={{ "--d": "760ms" } as CSSProperties}>
            <Magnetic>
              <Link
                href="/signup"
                className="inline-flex h-14 items-center rounded-full bg-[var(--lp-accent)] px-8 text-[16px] font-semibold text-[var(--lp-accent-ink)] transition hover:brightness-110"
              >
                Get your card
              </Link>
            </Magnetic>
            <a
              href="#how"
              className="inline-flex h-14 items-center rounded-full border border-[var(--lp-line)] px-7 text-[16px] font-medium text-[var(--lp-ink)] transition hover:border-[var(--lp-ink)]"
            >
              See what happens on a tap
            </a>
          </div>
        </div>

        <div className="relative lg:col-span-5" style={{ transform: "translate3d(0, calc(var(--hp, 0) * -12vh), 0)" }}>
          <div className="relative mx-auto w-[min(84vw,450px)] [perspective:1500px] lg:w-full lg:max-w-[450px]">
            <div className={s.cardDrop}>
              <div className={s.float}>
                <div ref={tiltRef} className="will-change-transform [transform-style:preserve-3d]">
                  <button
                    type="button"
                    onClick={() => setFlipped((f) => !f)}
                    aria-label={flipped ? "Show the front of the card" : "Turn the card over"}
                    className={`${s.flipInner} ${flipped ? s.flipped : ""} relative block aspect-[1.586] w-full cursor-pointer rounded-[4.6%/7.3%]`}
                  >
                    <span className={s.face} style={{ borderRadius: "inherit" }}>
                      <NfcCardFront />
                    </span>
                    <span className={`${s.face} ${s.faceBack}`} style={{ borderRadius: "inherit" }}>
                      <NfcCardBack />
                    </span>
                  </button>
                </div>
              </div>
            </div>

            {/* waves coming off the chip */}
            <div className="pointer-events-none absolute -right-3 top-1/2 hidden -translate-y-1/2 translate-x-full text-[var(--lp-accent)] sm:block" aria-hidden>
              {[0, 1, 2].map((i) => (
                <span key={i} className="absolute top-1/2 -translate-y-1/2" style={{ left: `${i * 12}px` }}>
                  <span className={`${s.wave} block`} style={{ "--i": i } as CSSProperties}>
                    <NfcGlyph className="h-16 w-16" strokeWidth={1.4} />
                  </span>
                </span>
              ))}
            </div>

            <div className={s.cardShadow} aria-hidden />
            <p className={`${s.fadeIn} mt-5 text-center text-[13px] text-[var(--lp-soft)]`} style={{ "--d": "1700ms" } as CSSProperties}>
              Tap the card to turn it over
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
