import type { Metadata } from "next";
import Link from "next/link";
import { BookOpen, Code2, Database, KeyRound, Layers, ShieldCheck } from "lucide-react";
import ManualShell from "@/features/manuals/components/manual-shell";
import ArchitectureDiagram from "@/features/manuals/components/architecture-diagram";
import HtmlSection from "@/features/manuals/components/html-section";
import { devManualSections, devManualToc } from "@/features/manuals/content/developers-manual-content";
import s from "@/features/manuals/components/manual.module.css";

export const metadata: Metadata = {
  title: "Developer documentation",
  description:
    "How Namma Info is built: architecture, technology choices, database security, and how every feature works, with the code and file locations.",
  robots: { index: false, follow: false },
};

const QUICK = [
  { href: "#overview-and-architecture", icon: Layers, title: "Architecture", text: "How the browser, Vercel, Supabase and Razorpay fit together." },
  { href: "#technology-stack", icon: Code2, title: "Technology stack", text: "Every library we use and why we chose it." },
  { href: "#database-and-security-model", icon: ShieldCheck, title: "Security model", text: "RLS, guard triggers and server-only secrets." },
  { href: "#setup-environment-and-deploying", icon: KeyRound, title: "Setup and deploy", text: "Run it locally, environment variables, migrations." },
  { href: "#google-review-generator", icon: BookOpen, title: "Feature deep dives", text: "Reviews, saved cards, contacts, team, payments…" },
  { href: "#conventions-testing-and-known-gaps", icon: Database, title: "Conventions", text: "Where code goes, testing, and known gaps." },
];

export default function DevelopersManualPage() {
  const hero = (
    <section className={s.hero}>
      <div className={s.heroInner}>
        <div className={s.heroGrid}>
        <div>
        <span className={s.eyebrow}>
          <span className={s.eyebrowDot} /> Developer documentation
        </span>
        <h1 className={s.heroTitle}>
          How Namma Info is <em>built</em>, and why.
        </h1>
        <p className={s.heroLead}>
          The architecture, the technology choices, the security model, and a deep dive into every feature: what each
          file does, where the code lives, and the reasoning behind it. Written so a new developer can answer
          &ldquo;how did you build this?&rdquo; with the code in front of them.
        </p>
        <div className={s.heroMeta}>
          <span>Next.js 14 · TypeScript · Supabase · Razorpay</span>
          <span>Updated 12 Nov 2026</span>
          <span>
            For customers, see the <Link href="/user-manual" style={{ color: "inherit" }}>user manual</Link>
          </span>
        </div>
        </div>
        <div className={s.heroArt} aria-hidden style={{ height: "auto" }}>
          <div className={s.heroCode}>
            <div className={s.heroCodeBar}><span /><span /><span /></div>
            <i>{"// src/lib/payments/fulfill-payment.ts"}</i>{"\n"}
            <b>export async function</b> <em>fulfillPayment</em>(input) {"{"}{"\n"}
            {"  "}<i>{"// 1. Already applied? Same payment twice."}</i>{"\n"}
            {"  "}<b>const</b> existing = <b>await</b> admin.from(<u>&quot;orders&quot;</u>){"\n"}
            {"    "}.eq(<u>&quot;razorpay_payment_id&quot;</u>, id){"\n"}
            {"  "}<i>{"// 2. What was bought: from Razorpay,"}</i>{"\n"}
            {"  "}<i>{"//    never from the browser."}</i>{"\n"}
            {"  "}<b>const</b> order = <b>await</b> razorpay.orders.<em>fetch</em>(id){"\n"}
            {"  "}<i>{"// 3. Record once, then apply the plan."}</i>{"\n"}
            {"}"}
          </div>
        </div>
        </div>
        <div className={s.quickGrid}>
          {QUICK.map((q) => (
            <a key={q.href} href={q.href} className={s.quickCard}>
              <span className={s.quickIcon}>
                <q.icon size={17} />
              </span>
              <span className={s.quickTitle}>{q.title}</span>
              <span className={s.quickText}>{q.text}</span>
            </a>
          ))}
        </div>
      </div>
    </section>
  );

  return (
    <ManualShell active="developers" hero={hero} toc={devManualToc}>
      {devManualSections.map((sec, i) => {
        const [before, after] = sec.html.split("@@ARCH@@");
        return (
          <section key={sec.id} id={sec.id} className={`${s.section} ${s.prose}`}>
            <span className={s.sectionNum}>{String(i + 1).padStart(2, "0")}</span>
            <h2>{sec.title}</h2>
            <HtmlSection html={before} />
            {after !== undefined && (
              <>
                <ArchitectureDiagram />
                <HtmlSection html={after} />
              </>
            )}
          </section>
        );
      })}
    </ManualShell>
  );
}
