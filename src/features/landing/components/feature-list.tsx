"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Copy, PenLine, Star, UserPlus } from "lucide-react";
import { hasFinePointer, prefersReducedMotion } from "../hooks/use-scroll-progress";
import s from "./landing.module.css";

const FEATURES = [
  {
    id: "save",
    title: "Saved to their phone in one tap",
    body: "Name, number, email, business and photo go straight into their contacts. Works on Android and iPhone.",
  },
  {
    id: "reviews",
    title: "More Google reviews",
    body: "Customers who don't know what to write get suggestions based on what you actually sell. They copy one, paste it on Google, done.",
  },
  {
    id: "contacts",
    title: "Know who opened your card",
    body: "Visitors can leave their name and number. You get a contact list you can sort, call back and add notes to.",
  },
  {
    id: "team",
    title: "Cards for your whole team",
    body: "Give each salesperson their own card and login. You see every contact the team brings in.",
  },
  {
    id: "edit",
    title: "Change details any time",
    body: "New number, new address, new timings. Update your profile and every card already out there opens the new version.",
  },
  {
    id: "taps",
    title: "Count every tap",
    body: "See how many times your card has been opened, so you know which events and meetings were worth it.",
  },
] as const;

type FeatureId = (typeof FEATURES)[number]["id"];

export default function FeatureList() {
  const [active, setActive] = useState<FeatureId>("save");

  return (
    <section id="features" className="scroll-mt-20 border-t border-[var(--lp-line)] py-24 sm:py-32">
      <div className="mx-auto max-w-[1320px] px-5 sm:px-8">
        <h2 className={`${s.display} max-w-[16ch] text-[clamp(2.3rem,5.2vw,5rem)] font-bold leading-[0.97]`}>
          Everything a paper card can&rsquo;t do
        </h2>

        <div className="mt-14 grid grid-cols-1 gap-12 lg:grid-cols-12 lg:gap-10">
          <ul className="min-w-0 lg:col-span-6" role="list">
            {FEATURES.map((f) => {
              const on = f.id === active;
              return (
                <li key={f.id} className="border-t border-[var(--lp-line)] last:border-b">
                  <button
                    type="button"
                    aria-expanded={on}
                    aria-controls={`feature-${f.id}`}
                    onClick={() => setActive(f.id)}
                    onPointerEnter={() => hasFinePointer() && setActive(f.id)}
                    className="group flex w-full items-center gap-4 pt-6 text-left"
                    style={{ paddingBottom: on ? 0 : "1.5rem", transition: "padding 0.5s cubic-bezier(0.2,0.85,0.2,1)" }}
                  >
                    <span
                      className="h-2 w-2 shrink-0 rounded-full transition-all duration-500"
                      style={{ background: on ? "var(--lp-accent)" : "var(--lp-line)", transform: on ? "scale(1.4)" : "scale(1)" }}
                    />
                    <span
                      className={`${s.display} block text-[clamp(1.45rem,2.6vw,2.2rem)] font-semibold leading-tight transition-[color,transform] duration-500 ease-[cubic-bezier(0.2,0.85,0.2,1)] ${
                        on ? "translate-x-1 text-[var(--lp-ink)]" : "text-[var(--lp-soft)] group-hover:text-[var(--lp-ink)]"
                      }`}
                    >
                      {f.title}
                    </span>
                  </button>
                  <div
                    id={`feature-${f.id}`}
                    className="grid min-w-0 pl-6 transition-[grid-template-rows] duration-500 ease-[cubic-bezier(0.2,0.85,0.2,1)]"
                    style={{ gridTemplateRows: on ? "1fr" : "0fr" }}
                  >
                    <div className="min-h-0 overflow-clip">
                      <p className="max-w-[34rem] pb-6 pt-3 text-[16px] leading-relaxed text-[var(--lp-soft)]">{f.body}</p>
                      {/* on phones the preview sits right under the open item */}
                      {on && (
                        <div className="pb-8 lg:hidden">
                          <Preview id={f.id} />
                        </div>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>

          <div className="hidden min-w-0 lg:col-span-6 lg:block">
            <div className="sticky top-28">
              <Preview id={active} />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */

function Preview({ id }: { id: FeatureId }) {
  return (
    <div
      key={id}
      className={`${s.swap} relative flex min-h-[20rem] w-full min-w-0 items-center justify-center overflow-clip rounded-[24px] bg-[var(--lp-surface)] px-4 py-8 shadow-[inset_0_0_0_1px_var(--lp-line)] sm:rounded-[28px] sm:p-10 lg:aspect-[5/4] lg:min-h-0`}
    >
      {id === "save" && <SavePreview />}
      {id === "reviews" && <ReviewPreview />}
      {id === "contacts" && <ContactsPreview />}
      {id === "team" && <TeamPreview />}
      {id === "edit" && <EditPreview />}
      {id === "taps" && <TapsPreview />}
    </div>
  );
}

const panel = "w-full max-w-[360px] rounded-[20px] bg-[var(--lp-raised)] p-5 shadow-[0_0_0_1px_var(--lp-line),0_24px_50px_-28px_rgba(0,0,0,0.35)]";

function SavePreview() {
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setSaved(true), 900);
    return () => clearTimeout(t);
  }, []);
  return (
    <div className={panel}>
      <div className="flex flex-col items-center text-center">
        <span className="flex h-16 w-16 items-center justify-center rounded-full bg-[#d9b55e] text-[20px] font-semibold text-[#14171c]">AP</span>
        <p className="mt-3 text-[19px] font-semibold">Adithya Puthraya</p>
        <p className="text-[14px] text-[var(--lp-soft)]">Namma Info</p>
      </div>
      <dl className="mt-5 divide-y divide-[var(--lp-line)] rounded-xl bg-[var(--lp-surface)] text-[14px] shadow-[0_0_0_1px_var(--lp-line)]">
        {[
          ["mobile", "+91 98450 12345"],
          ["email", "adithya@nammainfo.in"],
          ["city", "Mangaluru, Karnataka"],
        ].map(([k, v]) => (
          <div key={k} className="flex justify-between gap-4 px-4 py-2.5">
            <dt className="text-[var(--lp-soft)]">{k}</dt>
            <dd className="min-w-0 truncate">{v}</dd>
          </div>
        ))}
      </dl>
      <div
        className="mt-4 flex h-12 items-center justify-center gap-2 rounded-xl text-[15px] font-semibold transition-all duration-500"
        style={{
          background: saved ? "var(--lp-accent)" : "var(--lp-ink)",
          color: saved ? "var(--lp-accent-ink)" : "var(--lp-bg)",
        }}
      >
        {saved ? <Check size={17} /> : <UserPlus size={17} />}
        {saved ? "Saved to contacts" : "Save contact"}
      </div>
    </div>
  );
}

const REVIEW =
  "Got NFC business cards from Namma Info for our whole sales team. Adithya helped us with the card design and the cards were delivered on time. Customers now save our number with one tap.";

function ReviewPreview() {
  const [shown, setShown] = useState(prefersReducedMotion() ? REVIEW.length : 0);
  useEffect(() => {
    if (shown >= REVIEW.length) return;
    const t = setTimeout(() => setShown((n) => Math.min(REVIEW.length, n + 3)), 18);
    return () => clearTimeout(t);
  }, [shown]);
  const done = shown >= REVIEW.length;
  return (
    <div className={panel}>
      <div className="flex items-center gap-1 text-[#d9a43a]">
        {Array.from({ length: 5 }).map((_, i) => (
          <Star key={i} size={18} fill="currentColor" strokeWidth={0} />
        ))}
      </div>
      <p className="mt-3 min-h-[7.5rem] text-[15px] leading-relaxed">
        {REVIEW.slice(0, shown)}
        {!done && <span className={s.caret} />}
      </p>
      <div className="mt-4 flex items-center justify-between">
        <span className="text-[13px] text-[var(--lp-soft)]">Suggestion 1 of 3</span>
        <span
          className="flex h-9 items-center gap-1.5 rounded-full px-3.5 text-[13px] font-semibold transition-all duration-500"
          style={{ background: done ? "var(--lp-accent)" : "var(--lp-surface)", color: done ? "var(--lp-accent-ink)" : "var(--lp-ink)" }}
        >
          {done ? <Check size={14} /> : <Copy size={14} />} {done ? "Copied. Paste it on Google" : "Copy"}
        </span>
      </div>
    </div>
  );
}

function ContactsPreview() {
  const rows = [
    { n: "Anil Kumar", p: "+91 98860 41237", c: "New", col: "var(--lp-accent)" },
    { n: "Meera Rao", p: "+91 94481 20977", c: "Customer", col: "#3b82f6" },
    { n: "Prakash Hegde", p: "+91 99005 31842", c: "Hot lead", col: "#ef4444" },
  ];
  return (
    <div className={panel + " !p-0 overflow-clip"}>
      <div className="flex gap-1.5 p-4 pb-3 text-[12.5px]">
        {["All", "New", "Hot lead", "Customer"].map((c, i) => (
          <span key={c} className={`rounded-full px-3 py-1 ${i === 0 ? "bg-[var(--lp-ink)] text-[var(--lp-bg)]" : "bg-[var(--lp-surface)] shadow-[0_0_0_1px_var(--lp-line)]"}`}>
            {c}
          </span>
        ))}
      </div>
      {rows.map((r, i) => (
        <div key={r.n} className={`${s.fadeIn} flex items-center gap-3 border-t border-[var(--lp-line)] px-4 py-3`} style={{ ["--d" as string]: `${120 + i * 120}ms` }}>
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--lp-surface)] text-[13px] font-semibold shadow-[0_0_0_1px_var(--lp-line)]">
            {r.n.split(" ").map((w) => w[0]).join("")}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[15px] font-medium">{r.n}</p>
            <p className="text-[13px] tabular-nums text-[var(--lp-soft)]">{r.p}</p>
          </div>
          <span className="flex items-center gap-1.5 text-[12.5px]">
            <span className="h-2 w-2 rounded-full" style={{ background: r.col }} />
            {r.c}
          </span>
        </div>
      ))}
    </div>
  );
}

function TeamPreview() {
  const team = [
    { n: "Adithya Puthraya", r: "Owner", t: 412 },
    { n: "Deepa N", r: "Sales", t: 268 },
    { n: "Kiran Pai", r: "Sales", t: 197 },
    { n: "Suresh B", r: "Delivery", t: 64 },
  ];
  return (
    <div className="grid w-full max-w-[400px] grid-cols-2 gap-3">
      {team.map((m, i) => (
        <div
          key={m.n}
          className={`${s.fadeIn} aspect-[1.586] rounded-[14px] p-3.5 text-[#efe7d2]`}
          style={{
            background: "linear-gradient(140deg, #10393a 0%, #0a1f20 50%, #0a0c0f 100%)",
            boxShadow: "inset 0 0 0 1px rgba(217,181,94,0.3)",
            ["--d" as string]: `${i * 110}ms`,
          }}
        >
          <div className="flex h-full flex-col justify-between">
            <span className="text-[11px] text-[#b9b096]">{m.t} taps</span>
            <span>
              <span className="block text-[14px] font-medium leading-tight text-[#f6efdc]">{m.n}</span>
              <span className="text-[11.5px] text-[#b9b096]">{m.r}</span>
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

function EditPreview() {
  const [step, setStep] = useState(0);
  useEffect(() => {
    const ts = [setTimeout(() => setStep(1), 700), setTimeout(() => setStep(2), 1700)];
    return () => ts.forEach(clearTimeout);
  }, []);
  return (
    <div className={panel}>
      <p className="text-[13px] font-medium text-[var(--lp-soft)]">Mobile number</p>
      <div className="mt-2 flex h-12 items-center gap-2 rounded-xl bg-[var(--lp-surface)] px-4 text-[16px] tabular-nums shadow-[0_0_0_1px_var(--lp-line)]">
        <PenLine size={15} className="text-[var(--lp-soft)]" />
        <span className="relative">
          <span className="transition-opacity duration-300" style={{ opacity: step === 0 ? 1 : 0 }}>
            +91 98450 12345
          </span>
          <span className="absolute left-0 top-0 whitespace-nowrap transition-opacity duration-300" style={{ opacity: step === 0 ? 0 : 1 }}>
            +91 99001 23456
          </span>
        </span>
      </div>
      <div className="mt-5 space-y-2">
        {["Card in Deepa's wallet", "Card at the trade fair", "Card on your counter"].map((c, i) => (
          <div key={c} className="flex items-center justify-between rounded-xl px-1 text-[14px]">
            <span className="text-[var(--lp-soft)]">{c}</span>
            <span
              className="flex items-center gap-1 text-[13px] font-medium transition-all duration-500"
              style={{ opacity: step === 2 ? 1 : 0, transform: step === 2 ? "none" : "translateX(-6px)", transitionDelay: `${i * 120}ms`, color: "var(--lp-accent)" }}
            >
              <Check size={14} /> Updated
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function TapsPreview() {
  const target = 1284;
  const [n, setN] = useState(prefersReducedMotion() ? target : 0);
  const start = useRef<number | null>(null);
  useEffect(() => {
    if (n >= target) return;
    let raf = 0;
    const run = (t: number) => {
      if (start.current === null) start.current = t;
      const k = Math.min(1, (t - start.current) / 1400);
      setN(Math.round(target * (1 - Math.pow(1 - k, 3))));
      if (k < 1) raf = requestAnimationFrame(run);
    };
    raf = requestAnimationFrame(run);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const bars = [22, 35, 28, 52, 41, 66, 48, 74, 58, 90, 70, 84];
  return (
    <div className={panel}>
      <p className="text-[13px] text-[var(--lp-soft)]">Times your card was opened</p>
      <p className={`${s.display} mt-1 text-[64px] font-bold leading-none tabular-nums`}>{n.toLocaleString("en-IN")}</p>
      <div className="mt-6 flex h-24 items-end gap-1.5">
        {bars.map((h, i) => (
          <span
            key={i}
            className={`${s.fadeIn} flex-1 rounded-t-[4px]`}
            style={{ height: `${h}%`, background: i === bars.length - 1 ? "var(--lp-accent)" : "var(--lp-line)", ["--d" as string]: `${i * 40}ms` }}
          />
        ))}
      </div>
    </div>
  );
}
