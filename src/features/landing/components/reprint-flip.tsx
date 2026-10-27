"use client";

import { useRef, useState } from "react";
import { NfcCardFront } from "./nfc-card";
import { useScrollProgress } from "../hooks/use-scroll-progress";
import s from "./landing.module.css";

const clamp = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

/**
 * Pinned section: a paper card gets its old number crossed out by hand,
 * then flips over into a Namma Info card as you scroll.
 */
export default function ReprintFlip() {
  const [digital, setDigital] = useState(false);
  const digitalRef = useRef(false);

  const ref = useScrollProgress<HTMLElement>((p, el) => {
    const strike = clamp((p - 0.08) / 0.2);
    const write = clamp((p - 0.26) / 0.16);
    const flip = clamp((p - 0.5) / 0.3);
    el.style.setProperty("--strike", strike.toFixed(4));
    el.style.setProperty("--write", write.toFixed(4));
    el.style.setProperty("--flip", flip.toFixed(4));
    const d = flip > 0.5;
    if (d !== digitalRef.current) setDigital((digitalRef.current = d));
  }, "pin");

  return (
    <section ref={ref} className="relative h-[260svh] border-t border-[var(--lp-line)]">
      <div className="sticky top-0 flex h-[100svh] items-center overflow-clip">
        <div className="mx-auto grid w-full max-w-[1320px] grid-cols-1 items-center gap-12 px-5 sm:px-8 lg:grid-cols-12">
          <div className="relative min-h-[15rem] sm:min-h-[13rem] lg:col-span-5">
            <Copy
              on={!digital}
              title="Change your number and every card you printed is wrong."
              body="So you cross it out with a pen, or order another box of 500."
            />
            <Copy
              on={digital}
              title="Change it once. Every card you've handed out shows the new one."
              body="Your card opens your live profile, so a new number, address or offer shows up the moment you save it."
            />
          </div>

          <div className="flex justify-center lg:col-span-7">
            <div className="w-[min(86vw,520px)] [perspective:1600px]">
              <div
                className="relative aspect-[1.586] [transform-style:preserve-3d]"
                style={{
                  transform:
                    "rotateY(calc(var(--flip, 0) * 180deg)) rotateX(calc(var(--flip, 0) * (1 - var(--flip, 0)) * 50deg)) rotateZ(calc(-4deg + var(--flip, 0) * 4deg)) scale(calc(1 + var(--flip, 0) * (1 - var(--flip, 0)) * 0.5))",
                }}
              >
                {/* Paper front */}
                <div
                  className={`${s.paper} absolute inset-0 overflow-clip rounded-[2.4%/3.8%] text-[#26231d] shadow-[0_30px_60px_-30px_rgba(40,30,10,0.45)] [backface-visibility:hidden]`}
                  style={{ containerType: "inline-size" }}
                >
                  <div className="absolute left-[8%] top-[12%]">
                    <p className="font-serif text-[6.4cqw] font-semibold leading-tight">Adithya Puthraya</p>
                    <p className="mt-[0.6cqw] text-[3.4cqw] tracking-[0.04em] text-[#6b6455]">Namma Info</p>
                  </div>
                  <div className="absolute bottom-[12%] left-[8%] space-y-[1.2cqw] text-[3.5cqw] text-[#3b372e]">
                    <p className="relative inline-block tabular-nums">
                      +91 98450 12345
                      <svg className="absolute -inset-x-[3%] top-1/2 h-[1.6em] w-[106%] -translate-y-1/2 overflow-visible" viewBox="0 0 100 10" preserveAspectRatio="none" aria-hidden>
                        <path
                          d="M1 6 C 20 3, 35 8, 50 5 S 80 3, 99 5"
                          fill="none"
                          stroke="#1f3fa8"
                          strokeWidth="1.6"
                          strokeLinecap="round"
                          pathLength={1}
                          strokeDasharray="1"
                          style={{ strokeDashoffset: "calc(1 - var(--strike, 0))" }}
                          vectorEffect="non-scaling-stroke"
                        />
                        <path
                          d="M2 3.5 C 25 6, 40 2, 60 4.5 S 85 6.5, 98 3"
                          fill="none"
                          stroke="#1f3fa8"
                          strokeWidth="1.4"
                          strokeLinecap="round"
                          pathLength={1}
                          strokeDasharray="1"
                          style={{ strokeDashoffset: "calc(1 - max(0, var(--strike, 0) * 2 - 1))" }}
                          vectorEffect="non-scaling-stroke"
                        />
                      </svg>
                    </p>
                    <p>Mangaluru, Karnataka</p>
                  </div>
                  {/* handwritten new number */}
                  <p
                    className={`${s.hand} absolute bottom-[34%] left-[43%] -rotate-[6deg] whitespace-nowrap text-[6.4cqw] font-semibold text-[#1f3fa8]`}
                    style={{ clipPath: "inset(-20% calc((1 - var(--write, 0)) * 100%) -20% -5%)" }}
                  >
                    new: 99001 23456
                  </p>
                </div>

                {/* Namma Info back */}
                <div className="absolute inset-0 rounded-[4.6%/7.3%] [backface-visibility:hidden] [transform:rotateY(180deg)]">
                  <NfcCardFront />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function Copy({ on, title, body }: { on: boolean; title: string; body: string }) {
  return (
    <div
      className="absolute inset-x-0 top-1/2 transition-all duration-700 ease-[cubic-bezier(0.2,0.85,0.2,1)]"
      style={{ opacity: on ? 1 : 0, transform: `translateY(calc(-50% + ${on ? 0 : 24}px))`, filter: on ? "none" : "blur(6px)" }}
      aria-hidden={!on}
    >
      <h2 className={`${s.display} text-[clamp(2rem,4vw,3.6rem)] font-bold leading-[1.02]`}>{title}</h2>
      <p className="mt-5 max-w-[30rem] text-[17px] leading-relaxed text-[var(--lp-soft)]">{body}</p>
    </div>
  );
}
