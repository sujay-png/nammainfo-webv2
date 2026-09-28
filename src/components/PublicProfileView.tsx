"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import type { Profile, Card, Review, Employee } from "@/lib/supabase/types";
import { initials, googleReviewUrl } from "@/lib/utils";
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
  Link2,
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
  ChevronDown,
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
 * Generate unique AI-written review suggestions based on the business's
 * services and products. Uses a seeded shuffle so each refresh yields
 * different reviews without repeating within the same view.
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

  // Shuffle using timestamp seed so reviews change on each page load
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
  const [reviewSuggestions, setReviewSuggestions] = useState<string[]>(() =>
    generateReviewSuggestions(profile)
  );

  const profileUrl = profile.username
    ? `${window.location.origin}/${profile.username}`
    : card
      ? `${window.location.origin}/${card.public_slug}`
      : window.location.href;

  const avgRating =
    reviews.length > 0
      ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
      : 0;

  // Collapsible sections for public view
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    about: true,
    services: true,
    gallery: false,
    social: true,
    banking: false,
    team: true,
  });
  const toggleSection = (k: string) =>
    setOpenSections((prev) => ({ ...prev, [k]: !prev[k] }));

  function refreshSuggestions() {
    setReviewSuggestions(generateReviewSuggestions(profile));
  }

  function openGoogleReviewWithText(text: string) {
    if (!profile.google_place_id) return;
    // Google review URL — the review text gets copied to clipboard
    // since Google doesn't support prefilling review text via URL
    navigator.clipboard?.writeText(text);
    window.open(googleReviewUrl(profile.google_place_id), "_blank");
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

  return (
    <main className="mx-auto min-h-dvh max-w-lg bg-white">
      {/* Hero — Cover + Avatar */}
      <div className="relative">
        <div className="h-44 w-full overflow-hidden bg-ink-950">
          {profile.cover_url ? (
            <img
              src={profile.cover_url}
              alt=""
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="h-full w-full bg-ink-950" />
          )}
        </div>
        <div className="absolute -bottom-12 left-5">
          <div className="h-24 w-24 overflow-hidden rounded-2xl border-4 border-white bg-ink-100 shadow-card">
            {profile.logo_url ? (
              <img
                src={profile.logo_url}
                alt=""
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-ink-950 font-headline text-2xl font-bold text-white">
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
            <h1 className="font-headline text-xl font-bold text-ink-950">
              {profile.owner_name || "Namma Info Member"}
            </h1>
            <p className="text-sm text-ink-500">
              {[profile.job_title, profile.business_name]
                .filter(Boolean)
                .join(" · ")}
            </p>
          </div>
          <button
            onClick={shareProfile}
            className="rounded-xl border border-ink-200 p-2.5 transition hover:bg-ink-50"
          >
            <Share2 size={16} className="text-ink-700" />
          </button>
        </div>

        {/* Stats */}
        {(profile.years_in_business ||
          profile.clients_served ||
          reviews.length > 0) && (
          <div className="mt-4 flex gap-3">
            {profile.years_in_business && (
              <div className="flex items-center gap-1.5 rounded-lg bg-ink-50 px-3 py-1.5">
                <Clock size={12} className="text-ink-400" />
                <span className="font-mono text-xs font-medium text-ink-700">
                  {profile.years_in_business} yrs
                </span>
              </div>
            )}
            {profile.clients_served && (
              <div className="flex items-center gap-1.5 rounded-lg bg-ink-50 px-3 py-1.5">
                <Users size={12} className="text-ink-400" />
                <span className="font-mono text-xs font-medium text-ink-700">
                  {profile.clients_served}+ clients
                </span>
              </div>
            )}
            {reviews.length > 0 && (
              <div className="flex items-center gap-1.5 rounded-lg bg-ink-50 px-3 py-1.5">
                <Star size={12} className="fill-ink-950 text-ink-950" />
                <span className="font-mono text-xs font-medium text-ink-700">
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
          className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-ink-950 py-3.5 text-xs font-semibold text-white shadow-card-lg transition hover:bg-ink-800"
        >
          <Download size={15} />
          Add to Contacts
        </button>
        <a
          href="#details"
          className="flex flex-1 items-center justify-center gap-2 rounded-2xl border border-ink-200 bg-white py-3.5 text-xs font-semibold text-ink-900 shadow-card transition hover:shadow-card-hover"
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
          className="flex flex-col items-center gap-1 rounded-2xl border border-ink-100 bg-white p-3 transition hover:shadow-card"
        >
          <Share2 size={18} className="text-ink-700" />
          <span className="text-[10px] font-medium text-ink-500">Share</span>
        </button>
      </div>

      {/* ===== SECTIONS ===== */}
      <div id="details" className="space-y-3 px-5 pb-8 pt-6">
        {/* About */}
        {profile.bio && (
          <PublicCollapsible
            title="About Us"
            icon={<Briefcase size={15} />}
            isOpen={openSections.about}
            onToggle={() => toggleSection("about")}
          >
            <p className="text-sm leading-relaxed text-ink-600">
              {profile.bio}
            </p>
            {profile.address && (
              <div className="mt-3 flex items-start gap-2 text-xs text-ink-500">
                <MapPin size={13} className="mt-0.5 shrink-0" />
                {profile.address}
              </div>
            )}
            {profile.coverage_area && (
              <div className="mt-1.5 flex items-start gap-2 text-xs text-ink-500">
                <Globe size={13} className="mt-0.5 shrink-0" />
                Serves: {profile.coverage_area}
              </div>
            )}
          </PublicCollapsible>
        )}

        {/* Services & Products */}
        {((profile.services as unknown[] ?? []).length > 0 ||
          (profile.products as unknown[] ?? []).length > 0) && (
          <PublicCollapsible
            title="Services & Products"
            icon={<Award size={15} />}
            isOpen={openSections.services}
            onToggle={() => toggleSection("services")}
          >
            {(profile.services as { name: string; description?: string; price?: string; emoji?: string }[] ?? []).length > 0 && (
              <>
                <p className="mb-2 font-mono text-[10px] font-semibold uppercase tracking-widest text-ink-400">
                  Services
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {(profile.services as { name: string; description?: string; price?: string; emoji?: string }[]).map((s, i) => (
                    <div key={i} className="rounded-xl border border-ink-100 p-3">
                      <div className="mb-1.5 flex h-8 w-8 items-center justify-center rounded-lg bg-ink-50 text-base">
                        {s.emoji || "⚡"}
                      </div>
                      <p className="text-xs font-semibold">{s.name}</p>
                      {s.description && (
                        <p className="mt-0.5 text-[10px] text-ink-400">
                          {s.description}
                        </p>
                      )}
                      {s.price && (
                        <p className="mt-1 font-mono text-[10px] font-semibold text-ink-600">
                          {s.price}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </>
            )}
            {(profile.products as { name: string; image_url?: string; price?: string; emoji?: string }[] ?? []).length > 0 && (
              <>
                <p className="mb-2 mt-4 font-mono text-[10px] font-semibold uppercase tracking-widest text-ink-400">
                  Products
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {(profile.products as { name: string; image_url?: string; price?: string; emoji?: string }[]).map((p, i) => (
                    <div key={i} className="overflow-hidden rounded-xl border border-ink-100">
                      {p.image_url ? (
                        <img src={p.image_url} alt={p.name} className="aspect-square w-full object-cover" />
                      ) : (
                        <div className="flex aspect-square w-full items-center justify-center bg-ink-50 text-2xl">
                          {p.emoji || "📦"}
                        </div>
                      )}
                      <div className="p-2.5">
                        <p className="text-xs font-semibold">{p.name}</p>
                        {p.price && (
                          <p className="mt-0.5 font-mono text-[10px] font-semibold text-ink-500">{p.price}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </PublicCollapsible>
        )}

        {/* Gallery */}
        {(profile.gallery as { url: string; category?: string; caption?: string }[] ?? []).length > 0 && (
          <PublicCollapsible
            title="Gallery"
            icon={<ImageIcon size={15} />}
            isOpen={openSections.gallery}
            onToggle={() => toggleSection("gallery")}
          >
            <PublicGallery
              gallery={profile.gallery as { url: string; category?: string; caption?: string }[]}
            />
          </PublicCollapsible>
        )}

        {/* Connect With Us */}
        {(profile.social_links as { platform: string; url: string }[] ?? []).length > 0 && (
          <PublicCollapsible
            title="Connect With Us"
            icon={<MessageCircle size={15} />}
            isOpen={openSections.social}
            onToggle={() => toggleSection("social")}
          >
            <div className="grid grid-cols-2 gap-2">
              {(profile.social_links as { platform: string; url: string }[]).map((link, i) => (
                <a
                  key={i}
                  href={ensureProtocol(link.url)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2.5 rounded-xl border border-ink-100 px-3 py-2.5 transition hover:bg-ink-50"
                >
                  <SocialIcon platform={link.platform} />
                  <span className="text-xs font-medium text-ink-700">
                    {link.platform}
                  </span>
                </a>
              ))}
            </div>
          </PublicCollapsible>
        )}

        {/* Banking & Payment Info */}
        {(profile.bank_accounts as { bank_name?: string; account_number?: string; ifsc?: string; upi_id?: string; qr_url?: string }[] ?? []).length > 0 && (
          <PublicCollapsible
            title="Banking & Payment Info"
            icon={<Banknote size={15} />}
            isOpen={openSections.banking}
            onToggle={() => toggleSection("banking")}
          >
            <div className="space-y-3">
              {(profile.bank_accounts as { bank_name?: string; account_number?: string; ifsc?: string; upi_id?: string; qr_url?: string }[]).map((acc, i) => (
                <div key={i} className="rounded-xl border border-ink-100 p-3">
                  {acc.bank_name && (
                    <div className="mb-2 flex items-center gap-2">
                      <CreditCard size={14} className="text-ink-400" />
                      <span className="text-sm font-semibold">{acc.bank_name}</span>
                    </div>
                  )}
                  {acc.account_number && (
                    <div className="flex items-center justify-between py-1">
                      <span className="font-mono text-xs text-ink-500">A/C: {acc.account_number}</span>
                      <button onClick={() => navigator.clipboard.writeText(acc.account_number!)} className="p-1 text-ink-400"><Copy size={12} /></button>
                    </div>
                  )}
                  {acc.ifsc && <p className="font-mono text-xs text-ink-500">IFSC: {acc.ifsc}</p>}
                  {acc.upi_id && (
                    <div className="mt-2 flex items-center gap-2 rounded-lg bg-ink-50 px-3 py-2">
                      <Wallet size={14} className="text-ink-400" />
                      <span className="font-mono text-xs font-medium">{acc.upi_id}</span>
                      <button onClick={() => navigator.clipboard.writeText(acc.upi_id!)} className="ml-auto p-1 text-ink-400"><Copy size={12} /></button>
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
          </PublicCollapsible>
        )}

        {/* Team */}
        {employees.length > 0 && (
          <PublicCollapsible
            title="Team"
            icon={<Users size={15} />}
            isOpen={openSections.team}
            onToggle={() => toggleSection("team")}
          >
            <div className="space-y-2">
              {employees.map((emp) => (
                <Link
                  key={emp.id}
                  href={
                    profile.username
                      ? `/${profile.username}/${emp.slug}`
                      : "#"
                  }
                  className="flex items-center gap-3 rounded-xl bg-ink-50 p-3 transition hover:bg-ink-100"
                >
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-ink-200 font-headline text-xs font-semibold">
                    {initials(emp.name)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{emp.name}</p>
                    <p className="font-mono text-[10px] text-ink-400">
                      {emp.designation}
                    </p>
                  </div>
                  <ChevronRight size={14} className="text-ink-300" />
                </Link>
              ))}
            </div>
          </PublicCollapsible>
        )}

        {/* ===== REVIEWS — AI-generated suggestions that redirect to Google ===== */}
        <section className="rounded-2xl border border-ink-100 bg-white p-4">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2 font-headline text-sm font-semibold">
              <Star size={15} className="text-ink-400" />
              Reviews
            </div>
            {profile.google_place_id && (
              <a
                href={googleReviewUrl(profile.google_place_id)}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 rounded-lg bg-ink-50 px-2 py-1 text-[10px] font-medium text-ink-600 transition hover:bg-ink-100"
              >
                Google Reviews
                <ExternalLink size={10} />
              </a>
            )}
          </div>

          {/* Existing reviews summary */}
          {reviews.length > 0 && (
            <div className="mb-4 flex items-center gap-3">
              <span className="font-headline text-3xl font-bold">
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
                          ? "fill-ink-950 text-ink-950"
                          : "text-ink-200"
                      }
                    />
                  ))}
                </div>
                <p className="font-mono text-[10px] text-ink-400">
                  {reviews.length} review{reviews.length !== 1 && "s"}
                </p>
              </div>
            </div>
          )}

          {/* AI-generated review suggestions */}
          {profile.google_place_id && (
            <div>
              <div className="mb-2 flex items-center justify-between">
                <p className="font-mono text-[10px] font-semibold uppercase tracking-widest text-ink-400">
                  Tap to review on Google
                </p>
                <button
                  onClick={refreshSuggestions}
                  className="flex items-center gap-1 rounded-lg p-1.5 text-ink-400 transition hover:bg-ink-50 hover:text-ink-600"
                  title="Get new suggestions"
                >
                  <RefreshCw size={12} />
                </button>
              </div>
              <div className="space-y-2">
                {reviewSuggestions.map((text, i) => (
                  <button
                    key={i}
                    onClick={() => openGoogleReviewWithText(text)}
                    className="w-full rounded-xl border border-ink-100 p-3 text-left transition hover:border-ink-300 hover:shadow-card"
                  >
                    <div className="mb-1.5 flex gap-0.5">
                      {[1, 2, 3, 4, 5].map((s) => (
                        <Star
                          key={s}
                          size={10}
                          className="fill-ink-950 text-ink-950"
                        />
                      ))}
                    </div>
                    <p className="text-xs leading-relaxed text-ink-600">
                      {text}
                    </p>
                    <p className="mt-2 flex items-center gap-1 font-mono text-[9px] font-medium text-ink-400">
                      <Copy size={8} />
                      Tap to copy & open Google Reviews
                    </p>
                  </button>
                ))}
              </div>
            </div>
          )}

          {!profile.google_place_id && reviews.length === 0 && (
            <p className="text-sm text-ink-400">No reviews yet</p>
          )}
        </section>

        {/* Downloads */}
        <section className="rounded-2xl border border-ink-100 bg-white p-4">
          <div className="mb-3 flex items-center gap-2 font-headline text-sm font-semibold">
            <Download size={15} className="text-ink-400" />
            Quick Actions
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={saveContact}
              className="flex items-center gap-2.5 rounded-xl border border-ink-100 px-3 py-3 text-left transition hover:bg-ink-50"
            >
              <BookUser size={16} className="text-ink-400" />
              <span className="text-xs font-medium">Save Contact</span>
            </button>
            <button
              onClick={shareProfile}
              className="flex items-center gap-2.5 rounded-xl border border-ink-100 px-3 py-3 text-left transition hover:bg-ink-50"
            >
              <Share2 size={16} className="text-ink-400" />
              <span className="text-xs font-medium">Share Profile</span>
            </button>
            {profile.brochure_url && (
              <a
                href={profile.brochure_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2.5 rounded-xl border border-ink-100 px-3 py-3 transition hover:bg-ink-50"
              >
                <FileText size={16} className="text-ink-400" />
                <span className="text-xs font-medium">Brochure</span>
              </a>
            )}
          </div>
        </section>

        {/* GST & Address footer */}
        {(profile.gst_number || profile.address) && (
          <div className="rounded-2xl border border-ink-100 bg-white p-4">
            {profile.gst_number && (
              <div className="flex items-center gap-2">
                <FileText size={12} className="text-ink-400" />
                <span className="font-mono text-[11px] text-ink-500">
                  GST: {profile.gst_number}
                </span>
              </div>
            )}
            {profile.address && (
              <div className="mt-1 flex items-start gap-2">
                <MapPin size={12} className="mt-0.5 shrink-0 text-ink-400" />
                <span className="text-[11px] text-ink-500">
                  {profile.address}
                </span>
              </div>
            )}
          </div>
        )}

        {/* CTA */}
        <Link
          href="/signup"
          className="flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-ink-200 py-4 text-sm font-medium text-ink-600 transition hover:border-ink-400 hover:text-ink-900"
        >
          <UserPlus size={16} />
          Create your own Namma Info profile
        </Link>

        <p className="pt-4 text-center font-mono text-[11px] text-ink-300">
          Powered by Namma Info
        </p>
      </div>
    </main>
  );
}

/* ================================================================== */
/*  Sub-components                                                     */
/* ================================================================== */

function PublicCollapsible({
  title,
  icon,
  isOpen,
  onToggle,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  isOpen: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-2xl border border-ink-100 bg-white">
      <button
        onClick={onToggle}
        className="flex w-full items-center justify-between px-4 py-3.5"
      >
        <div className="flex items-center gap-2 font-headline text-sm font-semibold">
          <span className="text-ink-400">{icon}</span>
          {title}
        </div>
        <ChevronDown
          size={16}
          className={`text-ink-400 transition-transform ${isOpen ? "rotate-180" : ""}`}
        />
      </button>
      {isOpen && (
        <div className="animate-fade-in border-t border-ink-100 px-4 py-3">
          {children}
        </div>
      )}
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
                  ? "bg-ink-950 text-white"
                  : "bg-ink-50 text-ink-500"
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
      className="flex flex-col items-center gap-1 rounded-2xl border border-ink-100 bg-white p-3 transition hover:shadow-card"
    >
      <span className="text-ink-700">{icon}</span>
      <span className="text-[10px] font-medium text-ink-500">{label}</span>
    </a>
  );
}

function SocialIcon({ platform }: { platform: string }) {
  const p = platform.toLowerCase();
  const cls = "h-4 w-4 text-ink-500";
  if (p.includes("instagram")) return <Instagram className={cls} />;
  if (p.includes("youtube")) return <Youtube className={cls} />;
  if (p.includes("facebook")) return <Facebook className={cls} />;
  if (p.includes("linkedin")) return <Linkedin className={cls} />;
  if (p.includes("whatsapp")) return <MessageCircle className={cls} />;
  return <Globe className={cls} />;
}
