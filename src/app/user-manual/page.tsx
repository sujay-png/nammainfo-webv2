import type { Metadata } from "next";
import Image from "next/image";
import { BadgeCheck, CreditCard, Share2, UserPlus, Users, Contact } from "lucide-react";
import ManualShell from "@/features/manuals/components/manual-shell";
import UserManualContent, { userManualToc } from "@/features/manuals/content/user-manual";
import s from "@/features/manuals/components/manual.module.css";

export const metadata: Metadata = {
  title: "User manual",
  description:
    "Step-by-step guide to Namma Info: create your account, build your profile, go live, share your card, and manage contacts, reviews and your team.",
};

const QUICK = [
  { href: "#getting-started", icon: UserPlus, title: "Create your account", text: "Sign up, sign in, reset your password." },
  { href: "#profile", icon: BadgeCheck, title: "Build your profile", text: "Step by step, with every screen." },
  { href: "#go-live", icon: CreditCard, title: "Make your page live", text: "Free trial, Pro plan and payments." },
  { href: "#your-page", icon: Share2, title: "Share your card", text: "Tap, QR code or link." },
  { href: "#saved", icon: Contact, title: "Contacts", text: "People who opened your card." },
  { href: "#team", icon: Users, title: "Your team", text: "Cards and logins for staff." },
];

export default function UserManualPage() {
  const hero = (
    <section className={s.hero}>
      <div className={s.heroInner}>
        <div className={s.heroGrid}>
        <div>
        <span className={s.eyebrow}>
          <span className={s.eyebrowDot} /> User manual
        </span>
        <h1 className={s.heroTitle}>
          Everything you need to run your <em>Namma Info</em> card.
        </h1>
        <p className={s.heroLead}>
          A plain-language guide with real screenshots: from creating your account and building your profile to
          sharing your card, following up with contacts and adding your team. No technical knowledge needed.
        </p>
        <div className={s.heroMeta}>
          <span>13 chapters · about 15 minutes</span>
          <span>For business owners and team members</span>
          <span>Updated 5 Nov 2026</span>
        </div>
        </div>
        <div className={s.heroArt} aria-hidden>
          {["home-free", "page-top", "profile-filled"].map((n) => (
            <div key={n} className={s.heroPhone}>
              <Image src={`/manuals/user/${n}.webp`} alt="" width={450} height={974} sizes="200px" priority />
            </div>
          ))}
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
    <ManualShell active="user" hero={hero} toc={userManualToc}>
      <UserManualContent />
    </ManualShell>
  );
}
