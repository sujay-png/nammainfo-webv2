"use client";

import { useRef, useState, type CSSProperties } from "react";
import { Camera, MapPin, MessageCircle, Phone as PhoneIcon, Star, UserPlus } from "lucide-react";
import Phone from "./phone";
import { NfcCardFront } from "./nfc-card";
import { useScrollProgress } from "../hooks/use-scroll-progress";
import s from "./landing.module.css";

const STEPS = [
  {
    title: "They hold your card near their phone",
    body: "No app and no scanning. The phone reads the chip and offers to open your page.",
  },
  {
    title: "Your profile opens",
    body: "Call, WhatsApp, directions, what you sell, and one button to save your number.",
  },
  {
    title: "They leave their number for you",
    body: "A short form asks for a name and mobile number. They can skip it, or photograph their own business card instead.",
  },
  {
    title: "They land in your contacts",
    body: "Call back, sort them into New, Hot lead or Customer, and add a note. Nothing gets lost in a shirt pocket.",
  },
];

const TYPED_NAME = "Anil Kumar";
const TYPED_PHONE = "98860 41237";

const clamp = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

/**
 * Pinned scroll story. The section is 4 screens tall; the phone stays put
 * while scrolling plays the tap → profile → details → contacts sequence.
 */
export default function TapStory() {
  const [step, setStep] = useState(0);
  const [typed, setTyped] = useState(0);
  const [touching, setTouching] = useState(false);
  const touchRef = useRef(false);
  const stepRef = useRef(0);
  const typedRef = useRef(0);

  const ref = useScrollProgress<HTMLElement>((p, el) => {
    const p1 = clamp(p / 0.2);
    const p2 = clamp((p - 0.235) / 0.16);
    const p3 = clamp((p - 0.5) / 0.2);
    const p4 = clamp((p - 0.76) / 0.14);
    el.style.setProperty("--p", p.toFixed(4));
    el.style.setProperty("--p1", p1.toFixed(4));
    el.style.setProperty("--p2", p2.toFixed(4));
    el.style.setProperty("--p3", p3.toFixed(4));
    el.style.setProperty("--p4", p4.toFixed(4));

    const nextTouch = p1 > 0.86 && p < 0.27;
    if (nextTouch !== touchRef.current) setTouching((touchRef.current = nextTouch));

    const nextStep = p < 0.24 ? 0 : p < 0.49 ? 1 : p < 0.75 ? 2 : 3;
    if (nextStep !== stepRef.current) setStep((stepRef.current = nextStep));

    const total = TYPED_NAME.length + TYPED_PHONE.length;
    const nextTyped = Math.round(clamp((p3 - 0.22) / 0.62) * total);
    if (nextTyped !== typedRef.current) setTyped((typedRef.current = nextTyped));
  }, "pin");

  const name = TYPED_NAME.slice(0, typed);
  const phone = TYPED_PHONE.slice(0, Math.max(0, typed - TYPED_NAME.length));

  return (
    <section id="how" ref={ref} className="relative h-[430svh] scroll-mt-0" aria-label="What happens when someone taps your card">
      <div className="sticky top-0 flex h-[100svh] items-center overflow-clip">
        <div className="mx-auto grid w-full max-w-[1320px] grid-cols-1 items-center gap-6 px-5 sm:px-8 lg:grid-cols-12 lg:gap-10">
          {/* Words */}
          <div className="lg:col-span-6">
            <h2 className={`${s.display} max-w-[16ch] text-[clamp(1.75rem,7vw,2.4rem)] font-bold leading-[0.98] lg:max-w-[14ch] lg:text-[clamp(2.4rem,4.2vw,4.4rem)]`}>
              What happens when someone taps your card
            </h2>

            {/* Desktop: all four steps, the current one lit */}
            <ol className="mt-10 hidden space-y-1 lg:block">
              {STEPS.map((st, i) => (
                <li
                  key={st.title}
                  className="grid grid-cols-[3rem_1fr] gap-x-2 border-t border-[var(--lp-line)] py-5 transition-opacity duration-500"
                  style={{ opacity: i === step ? 1 : 0.32 }}
                  aria-current={i === step ? "step" : undefined}
                >
                  <span className={`${s.display} text-[20px] font-semibold tabular-nums text-[var(--lp-accent)]`}>{i + 1}</span>
                  <div>
                    <h3 className="text-[20px] font-semibold tracking-[-0.01em]">{st.title}</h3>
                    <div
                      className="grid transition-[grid-template-rows] duration-500 ease-[cubic-bezier(0.2,0.85,0.2,1)]"
                      style={{ gridTemplateRows: i === step ? "1fr" : "0fr" }}
                    >
                      <p className="min-h-0 overflow-clip pt-1.5 text-[16px] leading-relaxed text-[var(--lp-soft)]">{st.body}</p>
                    </div>
                  </div>
                </li>
              ))}
            </ol>

            {/* Phones: only the current step, swapped in place */}
            <div className="relative mt-4 h-[7rem] lg:hidden">
              {STEPS.map((st, i) => (
                <div
                  key={st.title}
                  className="absolute inset-0 transition-all duration-500"
                  style={{ opacity: i === step ? 1 : 0, transform: `translateY(${i === step ? 0 : i < step ? -12 : 12}px)` }}
                  aria-hidden={i !== step}
                >
                  <p className="text-[15px] font-semibold">
                    <span className="mr-2 text-[var(--lp-accent)]">{i + 1}</span>
                    {st.title}
                  </p>
                  <p className="mt-1 text-[14.5px] leading-relaxed text-[var(--lp-soft)]">{st.body}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Phone stage */}
          <div className="relative flex justify-center lg:col-span-6">
            <div
              className="relative w-[var(--phone-w)] lg:w-[var(--phone-w-lg)]"
              style={{
                ["--phone-w" as string]: "max(150px, min(58vw, 280px, calc((100svh - 300px) * 0.47)))",
                ["--phone-w-lg" as string]: "min(300px, calc((100svh - 130px) * 0.47))",
              }}
            >
              <p className="mb-3 text-center text-[13px] font-medium text-[var(--lp-soft)]">
                <span className="transition-opacity duration-300" style={{ opacity: step === 3 ? 0 : 1 }}>Their phone</span>
                <span className="absolute left-0 right-0 transition-opacity duration-300" style={{ opacity: step === 3 ? 1 : 0 }}>
                  Your phone
                </span>
              </p>

              {/* The card coming in to touch the phone */}
              <div
                className="pointer-events-none absolute left-1/2 top-[18%] z-0 w-[92%] [perspective:900px]"
                style={{
                  transform:
                    "translate3d(calc(-50% + (1 - var(--p1, 0)) * 70%), calc((1 - var(--p1, 0)) * 120%), 0) rotate(calc((1 - var(--p1, 0)) * -24deg))",
                  opacity: "calc(1 - var(--p2, 0) * 2.2)",
                }}
              >
                <div className="aspect-[1.586] rounded-[4.6%/7.3%]" style={{ transform: "rotateX(calc(var(--p1, 0) * 18deg))" }}>
                  <NfcCardFront withSheen={false} />
                </div>
              </div>

              <div
                className="relative z-10"
                style={{ transform: "translate3d(calc(var(--p1, 0) * (1 - var(--p2, 0)) * -18px), 0, 0)" }}
              >
                <Phone>
                  {/* 1 · home screen */}
                  <HomeScreen />

                  {/* 2 · profile slides up */}
                  <div
                    className="absolute inset-0 z-10 will-change-transform"
                    style={{ transform: "translate3d(0, calc((1 - var(--p2, 0)) * 102%), 0)" }}
                  >
                    <ProfileScreen />
                  </div>

                  {/* 3 · details sheet */}
                  <div
                    className="absolute inset-0 z-20 bg-black"
                    style={{ opacity: "calc(min(1, var(--p3, 0) * 4) * 0.45)" }}
                  />
                  <div
                    className="absolute inset-x-0 bottom-0 z-20 will-change-transform"
                    style={{ transform: "translate3d(0, calc((1 - min(1, var(--p3, 0) * 3.5)) * 105%), 0)" }}
                  >
                    <DetailsSheet name={name} phone={phone} typing={step === 2} pressed={typed >= TYPED_NAME.length + TYPED_PHONE.length} />
                  </div>

                  {/* 4 · your contacts */}
                  <div
                    className="absolute inset-0 z-30 will-change-[opacity,transform]"
                    style={{
                      opacity: "min(1, calc(var(--p4, 0) * 1.8))",
                      transform: "scale(calc(1.06 - var(--p4, 0) * 0.06))",
                      pointerEvents: step === 3 ? "auto" : "none",
                    }}
                  >
                    <ContactsScreen />
                  </div>
                </Phone>
              </div>

              {/* ripple where the card touches */}
              <div className="pointer-events-none absolute left-1/2 top-[30%] z-20 h-0 w-0" aria-hidden>
                {[0, 1, 2].map((i) => (
                  <span
                    key={i}
                    className={`${s.ripple} ${touching ? s.rippleOn : ""} -left-[90px] -top-[90px] h-[180px] w-[180px]`}
                    style={{ "--i": i } as CSSProperties}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* progress along the bottom */}
        <div className="absolute inset-x-0 bottom-0 h-[3px] bg-[var(--lp-line)]">
          <div className="h-full origin-left bg-[var(--lp-accent)]" style={{ transform: "scaleX(var(--p, 0))" }} />
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/*  Phone screens (sizes in cqw = % of screen width)                    */
/* ------------------------------------------------------------------ */

function HomeScreen() {
  return (
    <div className="absolute inset-0" style={{ background: "linear-gradient(170deg, #0f3a39 0%, #12312f 40%, #1c1f24 100%)" }}>
      <div className="pt-[22cqw] text-center text-white">
        <p className="text-[4.2cqw] opacity-80">Monday 26 October</p>
        <p className="text-[21cqw] font-[300] leading-none tracking-[-0.04em]">10:24</p>
      </div>
      {/* NFC notification: appears once the card touches */}
      <div
        className="absolute inset-x-[4cqw] top-[62cqw] rounded-[5cqw] bg-white/90 p-[3.6cqw] text-[#14171c] shadow-lg backdrop-blur transition-all duration-500"
        style={{
          opacity: "calc((var(--p1, 0) - 0.82) * 6)",
          transform: "translateY(calc((1 - min(1, max(0, (var(--p1, 0) - 0.82) * 6))) * -8cqw)) scale(calc(0.94 + min(1, max(0, (var(--p1, 0) - 0.82) * 6)) * 0.06))",
        }}
      >
        <div className="flex items-center gap-[2.6cqw]">
          <span className="flex h-[9cqw] w-[9cqw] shrink-0 items-center justify-center rounded-[2.4cqw] bg-[#14171c]">
            <span className="h-[3cqw] w-[3cqw] rounded-full bg-[#3cb4aa]" />
          </span>
          <div className="min-w-0">
            <p className="text-[3.4cqw] text-[#5a616d]">NFC tag</p>
            <p className="truncate text-[3.9cqw] font-semibold">Open nammainfo.in/adithya-puthraya</p>
          </div>
        </div>
      </div>
      <div className="absolute bottom-[3cqw] left-1/2 h-[1.3cqw] w-[34cqw] -translate-x-1/2 rounded-full bg-white/70" />
    </div>
  );
}

function ProfileScreen() {
  const actions = [
    { icon: PhoneIcon, label: "Call" },
    { icon: MessageCircle, label: "WhatsApp" },
    { icon: UserPlus, label: "Save" },
    { icon: MapPin, label: "Directions" },
  ];
  return (
    <div className="absolute inset-0 overflow-clip bg-[#f6f7f8]">
      <div className="h-[38cqw]" style={{ background: "linear-gradient(140deg, #10393a, #0a1f20 60%, #14171c)" }} />
      <div className="-mt-[11cqw] px-[6cqw]">
        <div className="flex h-[22cqw] w-[22cqw] items-center justify-center rounded-full border-[1.2cqw] border-[#f6f7f8] bg-[#d9b55e] text-[7cqw] font-semibold text-[#14171c]">
          AP
        </div>
        <p className="mt-[2.5cqw] text-[6.6cqw] font-semibold tracking-[-0.02em]">Adithya Puthraya</p>
        <p className="text-[3.8cqw] text-[#5a616d]">Namma Info, Mangaluru</p>

        <div className="mt-[5cqw] grid grid-cols-4 gap-[2cqw]">
          {actions.map(({ icon: Icon, label }) => (
            <div key={label} className="flex flex-col items-center gap-[1.4cqw]">
              <span className="flex h-[12cqw] w-[12cqw] items-center justify-center rounded-full bg-[#fff] shadow-[0_1px_0_rgba(0,0,0,0.06),0_0_0_1px_rgba(0,0,0,0.06)]">
                <Icon className="h-[5cqw] w-[5cqw]" strokeWidth={2} />
              </span>
              <span className="text-[3cqw] text-[#5a616d]">{label}</span>
            </div>
          ))}
        </div>

        <div className="mt-[5cqw] flex h-[12cqw] items-center justify-center rounded-[3.4cqw] bg-[#14171c] text-[4cqw] font-semibold text-white">
          Save contact
        </div>

        <p className="mt-[6cqw] text-[3.6cqw] font-semibold">What we do</p>
        <div className="mt-[2cqw] flex flex-wrap gap-[1.6cqw]">
          {["NFC cards", "Team cards", "Card design", "Google reviews"].map((t) => (
            <span key={t} className="rounded-full bg-[#fff] px-[3cqw] py-[1.4cqw] text-[3.2cqw] shadow-[0_0_0_1px_rgba(0,0,0,0.07)]">
              {t}
            </span>
          ))}
        </div>

        <div className="mt-[5cqw] flex items-center justify-between rounded-[3.4cqw] bg-[#fff] p-[3.4cqw] shadow-[0_0_0_1px_rgba(0,0,0,0.07)]">
          <span className="text-[3.6cqw] font-medium">Write a Google review</span>
          <span className="flex gap-[0.6cqw] text-[#d9a43a]">
            {Array.from({ length: 5 }).map((_, i) => (
              <Star key={i} className="h-[3.6cqw] w-[3.6cqw]" fill="currentColor" strokeWidth={0} />
            ))}
          </span>
        </div>
      </div>
    </div>
  );
}

function DetailsSheet({ name, phone, typing, pressed }: { name: string; phone: string; typing: boolean; pressed: boolean }) {
  const onPhone = name.length === TYPED_NAME.length;
  return (
    <div className="rounded-t-[6cqw] bg-[#fff] px-[5.5cqw] pb-[7cqw] pt-[3cqw] shadow-[0_-10px_30px_rgba(0,0,0,0.15)]">
      <div className="mx-auto h-[1.2cqw] w-[11cqw] rounded-full bg-[#d3d8de]" />
      <div className="mt-[4cqw] flex items-center gap-[2.6cqw]">
        <span className="flex h-[9cqw] w-[9cqw] items-center justify-center rounded-full bg-[#d9b55e] text-[3.4cqw] font-semibold">AP</span>
        <div>
          <p className="text-[3.6cqw] font-semibold leading-tight">Adithya Puthraya</p>
          <p className="text-[3cqw] text-[#5a616d]">Namma Info</p>
        </div>
      </div>
      <p className="mt-[4.5cqw] text-[5cqw] font-semibold tracking-[-0.02em]">Share your contact details</p>
      <p className="mt-[1cqw] text-[3.3cqw] text-[#5a616d]">So Adithya can save your number and get back to you.</p>

      <p className="mt-[4cqw] text-[3.1cqw] font-medium text-[#5a616d]">Name</p>
      <div className={`mt-[1.2cqw] flex h-[10.5cqw] items-center rounded-[2.6cqw] border px-[3cqw] text-[3.8cqw] ${typing && !onPhone ? "border-[#0b6e69]" : "border-[#d3d8de]"}`}>
        <span className={typing && !onPhone ? s.caret : ""}>{name}</span>
      </div>
      <p className="mt-[3cqw] text-[3.1cqw] font-medium text-[#5a616d]">Mobile number</p>
      <div className={`mt-[1.2cqw] flex h-[10.5cqw] items-center rounded-[2.6cqw] border text-[3.8cqw] ${typing && onPhone && !pressed ? "border-[#0b6e69]" : "border-[#d3d8de]"}`}>
        <span className="flex h-full items-center border-r border-[#d3d8de] px-[3cqw] text-[#5a616d]">+91</span>
        <span className={`px-[3cqw] tabular-nums ${typing && onPhone && !pressed ? s.caret : ""}`}>{phone}</span>
      </div>
      <div className="mt-[3cqw] flex items-center gap-[2.4cqw] rounded-[2.6cqw] border border-dashed border-[#d3d8de] px-[3cqw] py-[2.4cqw] text-[3.2cqw] text-[#5a616d]">
        <Camera className="h-[4cqw] w-[4cqw]" /> Scan your business card
      </div>
      <div
        className="mt-[4cqw] flex h-[11.5cqw] items-center justify-center rounded-[2.8cqw] bg-[#14171c] text-[3.9cqw] font-semibold text-white transition-transform duration-200"
        style={{ transform: pressed ? "scale(0.96)" : undefined, opacity: pressed ? 0.85 : 1 }}
      >
        Continue
      </div>
    </div>
  );
}

function ContactsScreen() {
  const rows = [
    { name: "Meera Rao", phone: "+91 94481 20977", cat: "Customer", color: "#3b82f6" },
    { name: "Prakash Hegde", phone: "+91 99005 31842", cat: "Hot lead", color: "#ef4444" },
    { name: "Fathima S", phone: "+91 97411 66025", cat: "New", color: "#0b6e69" },
  ];
  return (
    <div className="absolute inset-0 bg-[#f6f7f8] px-[5cqw] pt-[14cqw]">
      <p className="text-[7cqw] font-semibold tracking-[-0.03em]">Saved</p>
      <div className="mt-[3cqw] flex gap-[5cqw] border-b border-[#d3d8de] text-[3.8cqw]">
        <span className="pb-[2cqw] text-[#5a616d]">Cards</span>
        <span className="border-b-[0.7cqw] border-[#14171c] pb-[2cqw] font-semibold">Contacts</span>
      </div>
      <div className="mt-[3.5cqw] flex gap-[1.6cqw] text-[3.1cqw]">
        {["All", "New", "Hot lead", "Customer"].map((c, i) => (
          <span key={c} className={`rounded-full px-[2.8cqw] py-[1.2cqw] ${i === 0 ? "bg-[#14171c] text-white" : "bg-[#fff] shadow-[0_0_0_1px_rgba(0,0,0,0.08)]"}`}>
            {c}
          </span>
        ))}
      </div>

      <div className="mt-[4cqw] overflow-clip rounded-[3.4cqw] bg-[#fff] shadow-[0_0_0_1px_rgba(0,0,0,0.07)]">
        {/* the new one drops in */}
        <div className="overflow-clip" style={{ maxHeight: "calc(min(1, max(0, var(--p4, 0) * 1.7 - 0.4)) * 30cqw)" }}>
          <ContactRow name="Anil Kumar" phone="+91 98860 41237" cat="New" color="#0b6e69" fresh />
        </div>
        {rows.map((r) => (
          <ContactRow key={r.name} {...r} />
        ))}
      </div>
    </div>
  );
}

function ContactRow({ name, phone, cat, color, fresh }: { name: string; phone: string; cat: string; color: string; fresh?: boolean }) {
  return (
    <div className={`flex items-center gap-[3cqw] border-b border-[#eceef0] px-[3.4cqw] py-[3cqw] ${fresh ? "bg-[#e3f3f1]" : ""}`}>
      <span className="flex h-[10cqw] w-[10cqw] shrink-0 items-center justify-center rounded-full bg-[#e6e9ec] text-[3.4cqw] font-semibold">
        {name.split(" ").map((w) => w[0]).join("")}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[3.8cqw] font-semibold">{name}</p>
        <p className="truncate text-[3.1cqw] tabular-nums text-[#5a616d]">{phone}</p>
        <p className="mt-[0.6cqw] flex items-center gap-[1.2cqw] text-[2.9cqw]">
          <span className="h-[1.6cqw] w-[1.6cqw] rounded-full" style={{ background: color }} />
          {cat}
        </p>
      </div>
      <span className={`flex h-[8.6cqw] w-[8.6cqw] items-center justify-center rounded-full border ${fresh ? "border-[#0b6e69] bg-[#0b6e69] text-white" : "border-[#d3d8de]"}`}>
        <PhoneIcon className="h-[3.8cqw] w-[3.8cqw]" />
      </span>
    </div>
  );
}
