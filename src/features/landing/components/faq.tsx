"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import s from "./landing.module.css";

const QUESTIONS = [
  {
    q: "Does the other person need to install anything?",
    a: "No. Your profile opens in their phone's browser, like any website.",
  },
  {
    q: "Will it work on iPhone?",
    a: "Yes. iPhone XS and newer read NFC cards without any app. For older phones you can share your QR code or link instead.",
  },
  {
    q: "What if I change my number or move shop?",
    a: "Edit your profile from your dashboard. Every card you've already handed out opens the new details straight away.",
  },
  {
    q: "Can my staff have their own cards?",
    a: "Yes. Each team member gets a card and a login of their own, and you can see the contacts each of them collects.",
  },
  {
    q: "Who can see the details visitors share?",
    a: "Only you, and the team member whose card they opened. Nobody else.",
  },
];

export default function Faq() {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <section id="questions" className="scroll-mt-20 border-t border-[var(--lp-line)] py-24 sm:py-32">
      <div className="mx-auto grid max-w-[1320px] grid-cols-1 gap-10 px-5 sm:px-8 lg:grid-cols-12">
        <h2 className={`${s.display} text-[clamp(2.2rem,4.4vw,4rem)] font-bold leading-[1] lg:col-span-4`}>Questions people ask</h2>
        <div className="lg:col-span-7 lg:col-start-6">
          {QUESTIONS.map((item, i) => {
            const on = open === i;
            return (
              <div key={item.q} className="border-b border-[var(--lp-line)] first:border-t">
                <h3>
                  <button
                    type="button"
                    aria-expanded={on}
                    aria-controls={`faq-${i}`}
                    onClick={() => setOpen(on ? null : i)}
                    className="flex w-full items-center justify-between gap-6 py-6 text-left text-[18px] font-medium sm:text-[20px]"
                  >
                    {item.q}
                    <Plus
                      size={20}
                      className="shrink-0 text-[var(--lp-soft)] transition-transform duration-500 ease-[cubic-bezier(0.2,0.85,0.2,1)]"
                      style={{ transform: on ? "rotate(135deg)" : "none" }}
                    />
                  </button>
                </h3>
                <div
                  id={`faq-${i}`}
                  className="grid transition-[grid-template-rows] duration-500 ease-[cubic-bezier(0.2,0.85,0.2,1)]"
                  style={{ gridTemplateRows: on ? "1fr" : "0fr" }}
                >
                  <p className="min-h-0 overflow-clip pr-10 text-[16px] leading-relaxed text-[var(--lp-soft)]">
                    <span className="block pb-6">{item.a}</span>
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
