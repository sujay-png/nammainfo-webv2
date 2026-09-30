"use client";

import { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import type { Profile, Card, Review, Employee } from "@/lib/supabase/types";
import { initials, googleReviewUrl } from "@/lib/utils";
import { getTheme } from "@/lib/themes";
import {
  Download,
  Phone,
  Mail,
  Globe,
  MapPin,
  Share2,
  Star,
  ExternalLink,
  ChevronRight,
  UserPlus,
  Eye,
  Users,
  Award,
  Clock,
  Briefcase,
  Image as ImageIcon,
  RefreshCw,
  MessageCircle,
  Instagram,
  Youtube,
  Facebook,
  Linkedin,
  Banknote,
  CreditCard,
  Wallet,
  Copy,
  FileText,
  BookUser,
} from "lucide-react";

/**
 * Ensure a URL string has a protocol prefix, so it opens as an absolute URL
 * rather than being treated as a relative path under nammainfo.in.
 */
function ensureProtocol(url: string): string {
  if (!url) return url;
  if (/^https?:\/\//i.test(url)) return url;
  return `https://${url}`;
}

/**
 * Build the correct href for a social link.
 * WhatsApp links use wa.me/<number> instead of a raw URL.
 */
function socialHref(link: { platform: string; url: string }): string {
  const p = link.platform.toLowerCase();
  if (p.includes("whatsapp")) {
    // Strip non-digits, build wa.me link
    const digits = link.url.replace(/[^0-9]/g, "");
    return `https://wa.me/${digits}`;
  }
  return ensureProtocol(link.url);
}

/**
 * Generate unique AI-written review suggestions based on the business's
 * services and products.
 */
function generateReviewSuggestions(
  profile: Profile,
  count: number = 4
): string[] {
  const biz = profile.business_name || profile.owner_name || "this business";
  const services = (
    profile.services as { name: string; description?: string }[]
  )?.map((s) => s.name) ?? [];
  const products = (
    profile.products as { name: string; description?: string }[]
  )?.map((p) => p.name) ?? [];
  const area = profile.coverage_area || "";
  const years = profile.years_in_business;

  const templates: ((svc: string, prod: string) => string)[] = [
    (svc) =>
      `Outstanding experience with ${biz}! Their ${svc || "services"} exceeded all my expectations. Highly professional team that truly cares about quality.`,
    (svc) =>
      `I've been using ${biz} for ${svc || "their services"} and the results are consistently excellent. Punctual, reliable, and great value for money.`,
    (_, prod) =>
      `${biz} delivers top-notch ${prod || "products"}. The attention to detail is remarkable. Will definitely recommend to friends and family.`,
    (svc) =>
      `Fantastic ${svc || "service"} by ${biz}! They went above and beyond to ensure everything was perfect. A trustworthy business you can count on.`,
    () =>
      `Best in ${area || "the area"}! ${biz} provides premium quality at fair prices. ${years ? `With ${years}+ years of experience, they know exactly what they're doing.` : "Their expertise really shows."}`,
    (svc) =>
      `Extremely satisfied with the ${svc || "work"} done by ${biz}. Clean, professional, and efficient. Would give 6 stars if I could!`,
    (_, prod) =>
      `The ${prod || "quality"} from ${biz} is second to none. Quick turnaround and excellent communication throughout. Highly recommended!`,
    (svc) =>
      `${biz} transformed my expectations for ${svc || "professional services"}. Their team is knowledgeable, friendly, and delivers on every promise.`,
    () =>
      `A gem of a business! ${biz} treats every customer like family. Transparent pricing, no hidden charges, and exceptional results every time.`,
    (svc, prod) =>
      `I researched many options before choosing ${biz} for ${svc || prod || "my needs"}, and I'm so glad I did. Professional from start to finish.`,
    () =>
      `What sets ${biz} apart is their genuine commitment to customer satisfaction. They don't just meet expectations — they exceed them consistently.`,
    (svc) =>
      `${biz} is my go-to for ${svc || "everything they offer"}. After trying several alternatives, nothing comes close to their quality and reliability.`,
    (_, prod) =>
      `Impressed by ${biz}'s ${prod || "offerings"}! Great quality, competitive pricing, and the team is always ready to help. Five stars well deserved!`,
    (svc) =>
      `Working with ${biz} on ${svc || "my project"} was a breeze. They listened to my requirements carefully and delivered exactly what I needed.`,
    () =>
      `${biz} has set a new standard in the industry. ${years ? `With ${years} years of experience, ` : ""}Their professionalism and quality are unmatched.`,
    (svc, prod) =>
      `Cannot say enough good things about ${biz}! Their ${svc || prod || "service"} is outstanding. I've recommended them to everyone I know.`,
  ];

  const seed = Date.now();
  const shuffled = [...templates].sort(
    () => Math.sin(seed * Math.random()) - 0.5
  );

  return shuffled.slice(0, count).map((fn) => {
    const svc = services[Math.floor(Math.random() * (services.length || 1))] ?? "";
    const prod = products[Math.floor(Math.random() * (products.length || 1))] ?? "";
    return fn(svc, prod);
  });
}

export default function PublicProfileView({
  profile,
  card,
  reviews,
  employees,
}: {
  profile: Profile;
  card: Card | null;
  reviews: Review[];
  employees: Employee[];
}) {
  const ownerTheme = getTheme(profile.theme);
  const [themeMode, setThemeMode] = useState<"light" | "dark">("light");

  useEffect(() => {
    const isDark = document.documentElement.classList.contains("dark") ||
      window.matchMedia("(prefers-color-scheme: dark)").matches;
    setThemeMode(isDark ? "dark" : "light");
  }, []);

  const themeVars = useMemo(() => {
    const vars = ownerTheme.colors[themeMode];
    return vars as Record<string, string>;
  }, [ownerTheme, themeMode]);

  const [reviewSuggestions, setReviewSuggestions] = useState<string[]>([]);

  const [profileUrl, setProfileUrl] = useState(() => {
    const base = "https://nammainfo.in";
    return profile.username
      ? `${base}/${profile.username}`
      : card
        ? `${base}/${card.public_slug}`
        : base;
  });

  useEffect(() => {
    const origin = window.location.origin;
    const url = profile.username
      ? `${origin}/${profile.username}`
      : card
        ? `${origin}/${card.public_slug}`
        : window.location.href;
    setProfileUrl(url);
  }, [profile.username, card]);

  useEffect(() => {
    setReviewSuggestions(generateReviewSuggestions(profile));
  }, [profile]);

  const avgRating =
    reviews.length > 0
      ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
      : 0;

  function refreshSuggestions() {
    setReviewSuggestions(generateReviewSuggestions(profile));
  }

  async function saveContact() {
    const vcardContent = [
      "BEGIN:VCARD",
      "VERSION:3.0",
      `FN:${profile.owner_name ?? ""}`,
      `ORG:${profile.business_name ?? ""}`,
      `TITLE:${profile.job_title ?? ""}`,
      profile.phone ? `TEL;TYPE=WORK:${profile.phone}` : "",
      profile.email ? `EMAIL:${profile.email}` : "",
      profile.website ? `URL:${ensureProtocol(profile.website)}` : "",
      profile.address ? `ADR;TYPE=WORK:;;${profile.address};;;;` : "",
      profile.bio ? `NOTE:${profile.bio}` : "",
      `SOURCE:${profileUrl}`,
      "END:VCARD",
    ]
      .filter(Boolean)
      .join("\r\n");

    const blob = new Blob([vcardContent], { type: "text/vcard" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${(profile.owner_name ?? profile.business_name ?? "contact")
      .replace(/[^a-z0-9 ]/gi, "")
      .trim()}.vcf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  async function shareProfile() {
    if (navigator.share) {
      try {
        await navigator.share({
          title: profile.business_name ?? "Namma Info",
          text: `Check out ${profile.owner_name ?? "this business"} on Namma Info`,
          url: profileUrl,
        });
      } catch {
        /* cancelled */
      }
    } else {
      await navigator.clipboard.writeText(profileUrl);
    }
  }

  /* Cast arrays once */
  const socialLinks = (profile.social_links as { platform: string; url: string }[]) ?? [];
  const servicesList = (profile.services as { name: string; description?: string; price?: string; emoji?: string }[]) ?? [];
  const productsList = (profile.products as { name: string; image_url?: string; price?: string; emoji?: string }[]) ?? [];
  const galleryList = (profile.gallery as { url: string; category?: string; caption?: string }[]) ?? [];
  const bankAccounts = (profile.bank_accounts as { bank_name?: string; account_number?: string; ifsc?: string; upi_id?: string; qr_url?: string }[]) ?? [];

  return (
    <main
      className="mx-auto min-h-dvh max-w-lg bg-[var(--card)]"
      style={themeVars as React.CSSProperties}
    >
      {/* Hero — Cover + Avatar */}
      <div className="relative">
        <div className="h-44 w-full overflow-hidden bg-[var(--foreground)]">
          {profile.cover_url ? (
            <img
              src={profile.cover_url}
              alt=""
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="h-full w-full bg-[var(--foreground)]" />
          )}
        </div>
        <div className="absolute -bottom-12 left-5">
          <div className="h-24 w-24 overflow-hidden rounded-2xl border-4 border-[var(--card)] bg-[var(--accent)] shadow-card">
            {profile.logo_url ? (
              <img
                src={profile.logo_url}
                alt=""
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-[var(--foreground)] font-headline text-2xl font-bold text-[var(--background)]">
                {initials(profile.owner_name || profile.business_name)}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Name + info */}
      <div className="mt-14 px-5">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="font-headline text-xl font-bold text-[var(--foreground)]">
              {profile.owner_name || "Namma Info Member"}
            </h1>
            <p className="text-sm text-[var(--muted-foreground)]">
              {[profile.job_title, profile.business_name]
                .filter(Boolean)
                .join(" · ")}
            </p>
          </div>
          <button
            onClick={shareProfile}
            className="rounded-xl border border-[var(--border)] p-2.5 transition hover:bg-[var(--accent)]"
          >
            <Share2 size={16} className="text-[var(--foreground)]" />
          </button>
        </div>

        {/* Stats */}
        {(profile.years_in_business ||
          profile.clients_served ||
          reviews.length > 0) && (
          <div className="mt-4 flex gap-3">
            {profile.years_in_business && (
              <div className="flex items-center gap-1.5 rounded-lg bg-[var(--accent)] px-3 py-1.5">
                <Clock size={12} className="text-[var(--muted-foreground)]" />
                <span className="font-mono text-xs font-medium text-[var(--foreground)]">
                  {profile.years_in_business} yrs
                </span>
              </div>
            )}
            {profile.clients_served && (
              <div className="flex items-center gap-1.5 rounded-lg bg-[var(--accent)] px-3 py-1.5">
                <Users size={12} className="text-[var(--muted-foreground)]" />
                <span className="font-mono text-xs font-medium text-[var(--foreground)]">
                  {profile.clients_served}+ clients
                </span>
              </div>
            )}
            {reviews.length > 0 && (
              <div className="flex items-center gap-1.5 rounded-lg bg-[var(--accent)] px-3 py-1.5">
                <Star size={12} className="fill-[var(--foreground)] text-[var(--foreground)]" />
                <span className="font-mono text-xs font-medium text-[var(--foreground)]">
                  {avgRating.toFixed(1)}
                </span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Action CTAs */}
      <div className="mt-5 flex gap-2 px-5">
        <button
          onClick={saveContact}
          className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-[var(--foreground)] py-3.5 text-xs font-semibold text-[var(--background)] shadow-card-lg transition hover:opacity-90"
        >
          <Download size={15} />
          Add to Contacts
        </button>
        <a
          href="#details"
          className="flex flex-1 items-center justify-center gap-2 rounded-2xl border border-[var(--border)] bg-[var(--card)] py-3.5 text-xs font-semibold text-[var(--foreground)] shadow-card transition hover:shadow-card-hover"
        >
          <Eye size={15} />
          View Profile
        </a>
      </div>

      {/* Quick contact */}
      <div className="mt-4 grid grid-cols-4 gap-2 px-5">
        {profile.phone && (
          <QuickAction
            href={`tel:${profile.phone}`}
            icon={<Phone size={18} />}
            label="Call"
          />
        )}
        {profile.email && (
          <QuickAction
            href={`mailto:${profile.email}`}
            icon={<Mail size={18} />}
            label="Email"
          />
        )}
        {profile.website && (
          <QuickAction
            href={ensureProtocol(profile.website)}
            icon={<Globe size={18} />}
            label="Website"
          />
        )}
        <button
          onClick={shareProfile}
          className="flex flex-col items-center gap-1 rounded-2xl border border-[var(--border)] bg-[var(--card)] p-3 transition hover:shadow-card"
        >
          <Share2 size={18} className="text-[var(--foreground)]" />
          <span className="text-[10px] font-medium text-[var(--muted-foreground)]">Share</span>
        </button>
      </div>

      {/* ===== ALL SECTIONS — NO ACCORDIONS, EVERYTHING OPEN ===== */}
      <div id="details" className="space-y-4 px-5 pb-8 pt-6">

        {/* ── About Us ── */}
        {profile.bio && (
          <OpenSection title="About Us" icon={<Briefcase size={15} />}>
            <p className="text-sm leading-relaxed text-[var(--muted-foreground)]">
              {profile.bio}
            </p>
            {profile.address && (
              <div className="mt-3 flex items-start gap-2 text-xs text-[var(--muted-foreground)]">
                <MapPin size={13} className="mt-0.5 shrink-0" />
                {profile.address}
              </div>
            )}
            {profile.coverage_area && (
              <div className="mt-1.5 flex items-start gap-2 text-xs text-[var(--muted-foreground)]">
                <Globe size={13} className="mt-0.5 shrink-0" />
                Serves: {profile.coverage_area}
              </div>
            )}
          </OpenSection>
        )}

        {/* ── Services & Products ── */}
        {(servicesList.length > 0 || productsList.length > 0) && (
          <OpenSection
            title="Services & Products"
            icon={<Award size={15} />}
            badge={servicesList.length + productsList.length}
          >
            {servicesList.length > 0 && (
              <>
                <p className="mb-2 font-mono text-[10px] font-semibold uppercase tracking-widest text-[var(--muted-foreground)]">
                  Services
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {servicesList.map((s, i) => (
                    <div key={i} className="rounded-xl border border-[var(--border)] p-3">
                      <div className="mb-1.5 flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--accent)] text-base">
                        {s.emoji || "⚡"}
                      </div>
                      <p className="text-xs font-semibold text-[var(--foreground)]">{s.name}</p>
                      {s.description && (
                        <p className="mt-0.5 text-[10px] text-[var(--muted-foreground)]">{s.description}</p>
                      )}
                      {s.price && (
                        <p className="mt-1 font-mono text-[10px] font-semibold text-[var(--muted-foreground)]">{s.price}</p>
                      )}
                    </div>
                  ))}
                </div>
              </>
            )}
            {productsList.length > 0 && (
              <>
                <p className="mb-2 mt-4 font-mono text-[10px] font-semibold uppercase tracking-widest text-[var(--muted-foreground)]">
                  Products
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {productsList.map((p, i) => (
                    <div key={i} className="overflow-hidden rounded-xl border border-[var(--border)]">
                      {p.image_url ? (
                        <img src={p.image_url} alt={p.name} className="aspect-square w-full object-cover" />
                      ) : (
                        <div className="flex aspect-square w-full items-center justify-center bg-[var(--accent)] text-2xl">
                          {p.emoji || "📦"}
                        </div>
                      )}
                      <div className="p-2.5">
                        <p className="text-xs font-semibold text-[var(--foreground)]">{p.name}</p>
                        {p.price && (
                          <p className="mt-0.5 font-mono text-[10px] font-semibold text-[var(--muted-foreground)]">{p.price}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </OpenSection>
        )}

        {/* ── Gallery ── */}
        {galleryList.length > 0 && (
          <OpenSection
            title="Gallery"
            icon={<ImageIcon size={15} />}
            badge={galleryList.length}
          >
            <PublicGallery gallery={galleryList} />
          </OpenSection>
        )}

        {/* ── Connect With Us ── */}
        {socialLinks.length > 0 && (
          <OpenSection title="Connect With Us" icon={<MessageCircle size={15} />}>
            <div className="grid grid-cols-2 gap-2">
              {socialLinks.map((link, i) => (
                <a
                  key={i}
                  href={socialHref(link)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2.5 rounded-xl border border-[var(--border)] px-3 py-2.5 transition hover:bg-[var(--accent)]"
                >
                  <SocialIcon platform={link.platform} />
                  <span className="text-xs font-medium text-[var(--foreground)]">
                    {link.platform}
                  </span>
                </a>
              ))}
            </div>
          </OpenSection>
        )}

        {/* ── Write a Google Review ── */}
        <section className="rounded-2xl border border-[var(--border)] bg-[var(--card)] overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3.5">
            <div className="flex items-center gap-2 font-headline text-sm font-semibold text-[var(--foreground)]">
              <Star size={15} className="text-[var(--muted-foreground)]" />
              Write a Google Review
            </div>
            {profile.google_place_id && (
              <a
                href={googleReviewUrl(profile.google_place_id)}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 rounded-lg bg-[var(--accent)] px-2 py-1 text-[10px] font-medium text-[var(--muted-foreground)] transition hover:text-[var(--foreground)]"
              >
                Google Reviews
                <ExternalLink size={10} />
              </a>
            )}
          </div>

          <div className="border-t border-[var(--border)] px-4 py-3">
            {/* Existing reviews summary */}
            {reviews.length > 0 && (
              <div className="mb-4 flex items-center gap-3">
                <span className="font-headline text-3xl font-bold text-[var(--foreground)]">
                  {avgRating.toFixed(1)}
                </span>
                <div>
                  <div className="flex gap-0.5">
                    {[1, 2, 3, 4, 5].map((s) => (
                      <Star
                        key={s}
                        size={14}
                        className={
                          s <= Math.round(avgRating)
                            ? "fill-[var(--foreground)] text-[var(--foreground)]"
                            : "text-[var(--muted-foreground)]"
                        }
                      />
                    ))}
                  </div>
                  <p className="font-mono text-[10px] text-[var(--muted-foreground)]">
                    {reviews.length} review{reviews.length !== 1 && "s"}
                  </p>
                </div>
              </div>
            )}

            {/* Recent reviews inline */}
            {reviews.length > 0 && (
              <div className="mb-4 space-y-2">
                {reviews.slice(0, 3).map((review) => (
                  <div key={review.id} className="rounded-xl bg-[var(--accent)] px-3 py-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium text-[var(--foreground)]">
                        {review.reviewer_name}
                      </span>
                      <div className="flex gap-0.5">
                        {[1, 2, 3, 4, 5].map((s) => (
                          <Star
                            key={s}
                            size={10}
                            className={
                              s <= review.rating
                                ? "fill-amber-500 text-amber-500"
                                : "text-[var(--muted-foreground)]"
                            }
                          />
                        ))}
                      </div>
                    </div>
                    {review.comment && (
                      <p className="text-xs leading-relaxed text-[var(--muted-foreground)]">
                        {review.comment}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* AI-generated review suggestions */}
            <div>
              <div className="mb-2 flex items-center justify-between">
                <p className="font-mono text-[10px] font-semibold uppercase tracking-widest text-[var(--muted-foreground)]">
                  {profile.google_place_id
                    ? "Tap to review on Google"
                    : "Share your experience"}
                </p>
                <button
                  onClick={refreshSuggestions}
                  className="flex items-center gap-1 rounded-lg p-1.5 text-[var(--muted-foreground)] transition hover:bg-[var(--accent)] hover:text-[var(--foreground)]"
                  title="Get new suggestions"
                >
                  <RefreshCw size={12} />
                </button>
              </div>
              <div className="space-y-2">
                {reviewSuggestions.map((text, i) => (
                  <button
                    key={i}
                    onClick={() => {
                      navigator.clipboard?.writeText(text);
                      if (profile.google_place_id) {
                        window.open(
                          googleReviewUrl(profile.google_place_id),
                          "_blank"
                        );
                      } else {
                        alert("Review text copied to clipboard!");
                      }
                    }}
                    className="w-full rounded-xl border border-[var(--border)] p-3 text-left transition hover:border-[var(--foreground)]/20 hover:shadow-card"
                  >
                    <div className="mb-1.5 flex gap-0.5">
                      {[1, 2, 3, 4, 5].map((s) => (
                        <Star
                          key={s}
                          size={10}
                          className="fill-[var(--foreground)] text-[var(--foreground)]"
                        />
                      ))}
                    </div>
                    <p className="text-xs leading-relaxed text-[var(--muted-foreground)]">
                      {text}
                    </p>
                    <p className="mt-2 flex items-center gap-1 font-mono text-[9px] font-medium text-[var(--muted-foreground)]">
                      <Copy size={8} />
                      {profile.google_place_id
                        ? "Tap to copy & open Google Reviews"
                        : "Tap to copy review text"}
                    </p>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ── Banking & Payment Info ── */}
        {bankAccounts.length > 0 && (
          <OpenSection
            title="Banking & Payment Info"
            icon={<Banknote size={15} />}
            badge={bankAccounts.length}
          >
            <div className="space-y-3">
              {bankAccounts.map((acc, i) => (
                <div key={i} className="rounded-xl border border-[var(--border)] p-3">
                  {acc.bank_name && (
                    <div className="mb-2 flex items-center gap-2">
                      <CreditCard size={14} className="text-[var(--muted-foreground)]" />
                      <span className="text-sm font-semibold text-[var(--foreground)]">{acc.bank_name}</span>
                    </div>
                  )}
                  {acc.account_number && (
                    <div className="flex items-center justify-between py-1">
                      <span className="font-mono text-xs text-[var(--muted-foreground)]">A/C: {acc.account_number}</span>
                      <button onClick={() => navigator.clipboard.writeText(acc.account_number!)} className="p-1 text-[var(--muted-foreground)]"><Copy size={12} /></button>
                    </div>
                  )}
                  {acc.ifsc && <p className="font-mono text-xs text-[var(--muted-foreground)]">IFSC: {acc.ifsc}</p>}
                  {acc.upi_id && (
                    <div className="mt-2 flex items-center gap-2 rounded-lg bg-[var(--accent)] px-3 py-2">
                      <Wallet size={14} className="text-[var(--muted-foreground)]" />
                      <span className="font-mono text-xs font-medium text-[var(--foreground)]">{acc.upi_id}</span>
                      <button onClick={() => navigator.clipboard.writeText(acc.upi_id!)} className="ml-auto p-1 text-[var(--muted-foreground)]"><Copy size={12} /></button>
                    </div>
                  )}
                  {acc.qr_url && (
                    <div className="mt-2">
                      <img src={acc.qr_url} alt="Payment QR" className="h-32 w-32 rounded-lg object-contain" />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </OpenSection>
        )}

        {/* ── Downloads & Actions ── */}
        <OpenSection title="Downloads & Actions" icon={<Download size={15} />}>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={saveContact}
              className="flex items-center gap-2.5 rounded-xl border border-[var(--border)] px-3 py-3 text-left transition hover:bg-[var(--accent)]"
            >
              <BookUser size={16} className="text-[var(--muted-foreground)]" />
              <span className="text-xs font-medium text-[var(--foreground)]">Save Contact</span>
            </button>
            <button
              onClick={shareProfile}
              className="flex items-center gap-2.5 rounded-xl border border-[var(--border)] px-3 py-3 text-left transition hover:bg-[var(--accent)]"
            >
              <Share2 size={16} className="text-[var(--muted-foreground)]" />
              <span className="text-xs font-medium text-[var(--foreground)]">Share Profile</span>
            </button>
            {profile.brochure_url && (
              <a
                href={profile.brochure_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2.5 rounded-xl border border-[var(--border)] px-3 py-3 transition hover:bg-[var(--accent)]"
              >
                <FileText size={16} className="text-[var(--muted-foreground)]" />
                <span className="text-xs font-medium text-[var(--foreground)]">Brochure</span>
              </a>
            )}
          </div>
        </OpenSection>

        {/* ── Team ── */}
        {employees.length > 0 && (
          <OpenSection title="Team" icon={<Users size={15} />}>
            <div className="space-y-2">
              {employees.map((emp) => (
                <Link
                  key={emp.id}
                  href={
                    profile.username
                      ? `/${profile.username}/${emp.slug}`
                      : "#"
                  }
                  className="flex items-center gap-3 rounded-xl bg-[var(--accent)] p-3 transition hover:opacity-90"
                >
                  {emp.avatar_url ? (
                    <img
                      src={emp.avatar_url}
                      alt={emp.name}
                      className="h-9 w-9 rounded-full object-cover"
                    />
                  ) : (
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--border)] font-headline text-xs font-semibold text-[var(--foreground)]">
                      {initials(emp.name)}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-[var(--foreground)]">{emp.name}</p>
                    <p className="font-mono text-[10px] text-[var(--muted-foreground)]">
                      {emp.designation}
                    </p>
                  </div>
                  <ChevronRight size={14} className="text-[var(--muted-foreground)]" />
                </Link>
              ))}
            </div>
          </OpenSection>
        )}

        {/* GST & Address footer */}
        {(profile.gst_number || profile.address) && (
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4">
            {profile.gst_number && (
              <div className="flex items-center gap-2">
                <FileText size={12} className="text-[var(--muted-foreground)]" />
                <span className="font-mono text-[11px] text-[var(--muted-foreground)]">
                  GST: {profile.gst_number}
                </span>
              </div>
            )}
            {profile.address && (
              <div className="mt-1 flex items-start gap-2">
                <MapPin size={12} className="mt-0.5 shrink-0 text-[var(--muted-foreground)]" />
                <span className="text-[11px] text-[var(--muted-foreground)]">
                  {profile.address}
                </span>
              </div>
            )}
          </div>
        )}

        {/* CTA */}
        <Link
          href="/signup"
          className="flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-[var(--border)] py-4 text-sm font-medium text-[var(--muted-foreground)] transition hover:border-[var(--foreground)] hover:text-[var(--foreground)]"
        >
          <UserPlus size={16} />
          Create your own Namma Info profile
        </Link>

        <p className="pt-4 text-center font-mono text-[11px] text-[var(--muted-foreground)]">
          Powered by Namma Info
        </p>
      </div>
    </main>
  );
}

/* ================================================================== */
/*  Sub-components                                                     */
/* ================================================================== */

/**
 * Open section — always visible, no accordion toggle.
 * Clean card with title bar and optional item-count badge.
 */
function OpenSection({
  title,
  icon,
  badge,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  badge?: number;
  children: React.ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--card)]">
      <div className="flex items-center justify-between px-4 py-3.5">
        <div className="flex items-center gap-2 font-headline text-sm font-semibold text-[var(--foreground)]">
          <span className="text-[var(--muted-foreground)]">{icon}</span>
          {title}
        </div>
        {badge !== undefined && badge > 0 && (
          <span className="flex h-6 min-w-6 items-center justify-center rounded-full bg-[var(--accent)] px-2 font-mono text-[10px] font-medium text-[var(--muted-foreground)]">
            {badge}
          </span>
        )}
      </div>
      <div className="border-t border-[var(--border)] px-4 py-3">
        {children}
      </div>
    </section>
  );
}

function PublicGallery({
  gallery,
}: {
  gallery: { url: string; category?: string; caption?: string }[];
}) {
  const [activeTab, setActiveTab] = useState("All");
  const categories = [
    "All",
    ...Array.from(new Set(gallery.map((g) => g.category).filter(Boolean))),
  ] as string[];
  const filtered =
    activeTab === "All"
      ? gallery
      : gallery.filter((g) => g.category === activeTab);

  return (
    <div>
      {categories.length > 1 && (
        <div className="mb-3 flex gap-2 overflow-x-auto scrollbar-hide">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveTab(cat)}
              className={`whitespace-nowrap rounded-full px-3 py-1 font-mono text-[10px] font-medium transition ${
                activeTab === cat
                  ? "bg-[var(--foreground)] text-[var(--background)]"
                  : "bg-[var(--accent)] text-[var(--muted-foreground)]"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      )}
      <div className="grid grid-cols-3 gap-1.5">
        {filtered.map((img, i) => (
          <img
            key={i}
            src={img.url}
            alt={img.caption ?? ""}
            className="aspect-square rounded-lg object-cover"
          />
        ))}
      </div>
    </div>
  );
}

function QuickAction({
  href,
  icon,
  label,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <a
      href={href}
      target={href.startsWith("http") ? "_blank" : undefined}
      rel={href.startsWith("http") ? "noopener noreferrer" : undefined}
      className="flex flex-col items-center gap-1 rounded-2xl border border-[var(--border)] bg-[var(--card)] p-3 transition hover:shadow-card"
    >
      <span className="text-[var(--foreground)]">{icon}</span>
      <span className="text-[10px] font-medium text-[var(--muted-foreground)]">{label}</span>
    </a>
  );
}

function SocialIcon({ platform }: { platform: string }) {
  const p = platform.toLowerCase();
  const cls = "h-4 w-4 text-[var(--muted-foreground)]";
  if (p.includes("instagram")) return <Instagram className={cls} />;
  if (p.includes("youtube")) return <Youtube className={cls} />;
  if (p.includes("facebook")) return <Facebook className={cls} />;
  if (p.includes("linkedin")) return <Linkedin className={cls} />;
  if (p.includes("whatsapp")) return <MessageCircle className={cls} />;
  return <Globe className={cls} />;
}
