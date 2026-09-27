"use client";

import { useState } from "react";
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
  MessageSquare,
  Send,
  X,
} from "lucide-react";

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
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [reviewSubmitted, setReviewSubmitted] = useState(false);
  const [showGooglePrompt, setShowGooglePrompt] = useState(false);
  const [lastReviewComment, setLastReviewComment] = useState("");

  const profileUrl = profile.username
    ? `${window.location.origin}/${profile.username}`
    : card
      ? `${window.location.origin}/${card.public_slug}`
      : window.location.href;

  const avgRating =
    reviews.length > 0
      ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
      : 0;

  async function saveContact() {
    // Build vCard and trigger download
    const vcardContent = [
      "BEGIN:VCARD",
      "VERSION:3.0",
      `FN:${profile.owner_name ?? ""}`,
      `ORG:${profile.business_name ?? ""}`,
      `TITLE:${profile.job_title ?? ""}`,
      profile.phone ? `TEL;TYPE=WORK:${profile.phone}` : "",
      profile.email ? `EMAIL:${profile.email}` : "",
      profile.website ? `URL:${profile.website}` : "",
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
      alert("Link copied!");
    }
  }

  return (
    <main className="mx-auto min-h-dvh max-w-lg bg-white">
      {/* Hero — Business Card */}
      <div className="relative overflow-hidden bg-ink-950 px-6 pb-8 pt-10 text-white">
        <div className="pointer-events-none absolute -right-20 -top-20 h-60 w-60 rounded-full bg-white/[0.03] blur-3xl" />
        <div className="pointer-events-none absolute -bottom-20 -left-10 h-48 w-48 rounded-full bg-white/[0.02] blur-3xl" />

        <div className="relative">
          {/* Logo + name */}
          <div className="flex items-start gap-4">
            {profile.logo_url ? (
              <img
                src={profile.logo_url}
                alt=""
                className="h-16 w-16 rounded-2xl object-cover ring-1 ring-white/10"
              />
            ) : (
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/10 text-xl font-bold ring-1 ring-white/10">
                {initials(profile.owner_name || profile.business_name)}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <h1 className="text-xl font-semibold leading-tight">
                {profile.owner_name || "Namma Info Member"}
              </h1>
              <p className="mt-0.5 text-sm text-white/60">
                {[profile.job_title, profile.business_name]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            </div>
          </div>

          {/* Stats row */}
          {(profile.years_in_business ||
            profile.clients_served ||
            reviews.length > 0) && (
            <div className="mt-5 flex gap-4">
              {profile.years_in_business && (
                <Stat
                  icon={<Clock size={12} />}
                  value={`${profile.years_in_business}y`}
                  label="Experience"
                />
              )}
              {profile.clients_served && (
                <Stat
                  icon={<Users size={12} />}
                  value={`${profile.clients_served}+`}
                  label="Clients"
                />
              )}
              {reviews.length > 0 && (
                <Stat
                  icon={<Star size={12} />}
                  value={avgRating.toFixed(1)}
                  label={`${reviews.length} reviews`}
                />
              )}
            </div>
          )}
        </div>
      </div>

      {/* Action Buttons — the 3 key CTAs */}
      <div className="flex gap-2 px-4 -translate-y-5">
        <button
          onClick={saveContact}
          className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-ink-950 px-3 py-3.5 text-xs font-semibold text-white shadow-card-lg transition hover:bg-ink-800"
        >
          <Download size={15} />
          Add to Contacts
        </button>
        <a
          href="#profile-details"
          className="flex flex-1 items-center justify-center gap-2 rounded-2xl border border-ink-200 bg-white px-3 py-3.5 text-xs font-semibold text-ink-900 shadow-card transition hover:shadow-card-hover"
        >
          <Eye size={15} />
          View Profile
        </a>
      </div>

      {/* Quick contact */}
      <div className="grid grid-cols-4 gap-2 px-4">
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
            href={profile.website}
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

      {/* Profile Details */}
      <div id="profile-details" className="px-4 pt-6 pb-8 space-y-4">
        {/* About */}
        {profile.bio && (
          <ProfileSection title="About" icon={<Briefcase size={15} />}>
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
          </ProfileSection>
        )}

        {/* Social Links */}
        {profile.social_links && profile.social_links.length > 0 && (
          <ProfileSection title="Connect" icon={<Link2 size={15} />}>
            <div className="flex flex-wrap gap-2">
              {profile.social_links.map(
                (link: { platform: string; url: string }, i: number) => (
                  <a
                    key={i}
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 rounded-full border border-ink-200 px-3 py-1.5 text-xs font-medium text-ink-700 transition hover:bg-ink-50"
                  >
                    {link.platform}
                    <ExternalLink size={10} />
                  </a>
                )
              )}
            </div>
          </ProfileSection>
        )}

        {/* Services */}
        {profile.services && profile.services.length > 0 && (
          <ProfileSection title="Services" icon={<Award size={15} />}>
            <div className="space-y-2">
              {profile.services
                .slice(0, 4)
                .map(
                  (
                    s: { name: string; description?: string; price?: string },
                    i: number
                  ) => (
                    <div
                      key={i}
                      className="flex items-center justify-between rounded-xl bg-ink-50 px-3 py-2.5"
                    >
                      <div>
                        <p className="text-sm font-medium">{s.name}</p>
                        {s.description && (
                          <p className="text-xs text-ink-400">
                            {s.description}
                          </p>
                        )}
                      </div>
                      {s.price && (
                        <span className="text-xs font-semibold text-ink-600">
                          {s.price}
                        </span>
                      )}
                    </div>
                  )
                )}
            </div>
            {profile.website && profile.services.length > 4 && (
              <a
                href={profile.website}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 flex items-center gap-1 text-xs font-medium text-ink-950"
              >
                See all services
                <ChevronRight size={12} />
              </a>
            )}
          </ProfileSection>
        )}

        {/* Products */}
        {profile.products && profile.products.length > 0 && (
          <ProfileSection title="Products" icon={<ImageIcon size={15} />}>
            <div className="grid grid-cols-2 gap-2">
              {profile.products
                .slice(0, 4)
                .map(
                  (
                    p: {
                      name: string;
                      description?: string;
                      price?: string;
                      image_url?: string;
                    },
                    i: number
                  ) => (
                    <div
                      key={i}
                      className="overflow-hidden rounded-xl border border-ink-100"
                    >
                      {p.image_url && (
                        <img
                          src={p.image_url}
                          alt={p.name}
                          className="aspect-square w-full object-cover"
                        />
                      )}
                      <div className="p-2.5">
                        <p className="text-xs font-medium">{p.name}</p>
                        {p.price && (
                          <p className="mt-0.5 text-[11px] font-semibold text-ink-500">
                            {p.price}
                          </p>
                        )}
                      </div>
                    </div>
                  )
                )}
            </div>
            {profile.website && profile.products.length > 4 && (
              <a
                href={profile.website}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 flex items-center gap-1 text-xs font-medium text-ink-950"
              >
                See all products
                <ChevronRight size={12} />
              </a>
            )}
          </ProfileSection>
        )}

        {/* Gallery */}
        {profile.gallery && profile.gallery.length > 0 && (
          <ProfileSection title="Gallery" icon={<ImageIcon size={15} />}>
            <div className="grid grid-cols-3 gap-1.5">
              {profile.gallery.map(
                (item: { url: string; caption?: string }, i: number) => (
                  <img
                    key={i}
                    src={item.url}
                    alt={item.caption ?? ""}
                    className="aspect-square rounded-xl object-cover"
                  />
                )
              )}
            </div>
          </ProfileSection>
        )}

        {/* Team */}
        {employees.length > 0 && (
          <ProfileSection title="Team" icon={<Users size={15} />}>
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
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-ink-200 text-xs font-semibold">
                    {initials(emp.name)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{emp.name}</p>
                    <p className="text-[11px] text-ink-400">
                      {emp.designation}
                    </p>
                  </div>
                  <ChevronRight size={14} className="text-ink-300" />
                </Link>
              ))}
            </div>
          </ProfileSection>
        )}

        {/* Reviews */}
        <ProfileSection title="Reviews" icon={<Star size={15} />}>
          {reviews.length > 0 && (
            <div className="mb-4 flex items-center gap-3">
              <span className="text-3xl font-bold">
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
                <p className="text-xs text-ink-400">
                  {reviews.length} review{reviews.length !== 1 && "s"}
                </p>
              </div>
            </div>
          )}

          {reviews.slice(0, 3).map((r) => (
            <div key={r.id} className="mb-2 rounded-xl bg-ink-50 p-3">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold">
                  {r.reviewer_name}
                </span>
                <div className="flex gap-0.5">
                  {[1, 2, 3, 4, 5].map((s) => (
                    <Star
                      key={s}
                      size={9}
                      className={
                        s <= r.rating
                          ? "fill-ink-950 text-ink-950"
                          : "text-ink-200"
                      }
                    />
                  ))}
                </div>
              </div>
              {r.comment && (
                <p className="mt-1.5 text-xs leading-relaxed text-ink-600">
                  {r.comment}
                </p>
              )}
            </div>
          ))}

          {!showReviewForm && !reviewSubmitted && (
            <button
              onClick={() => setShowReviewForm(true)}
              className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl border border-ink-200 py-2.5 text-xs font-medium text-ink-700 transition hover:bg-ink-50"
            >
              <MessageSquare size={14} />
              Write a review
            </button>
          )}

          {reviewSubmitted && (
            <p className="mt-2 rounded-xl bg-green-50 px-4 py-3 text-center text-xs text-green-700">
              Thank you for your review!
            </p>
          )}

          {/* Review Form */}
          {showReviewForm && (
            <ReviewForm
              profileId={profile.id}
              googlePlaceId={profile.google_place_id}
              onSubmit={(comment) => {
                setShowReviewForm(false);
                setReviewSubmitted(true);
                setLastReviewComment(comment);
                if (profile.google_place_id) {
                  setShowGooglePrompt(true);
                }
              }}
              onCancel={() => setShowReviewForm(false)}
            />
          )}
        </ProfileSection>

        {/* Create your profile CTA */}
        <Link
          href="/signup"
          className="flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-ink-200 py-4 text-sm font-medium text-ink-600 transition hover:border-ink-400 hover:text-ink-900"
        >
          <UserPlus size={16} />
          Create your own Namma Info profile
        </Link>

        <p className="pt-4 text-center text-[11px] text-ink-300">
          Powered by Namma Info
        </p>
      </div>

      {/* Google Review Prompt Modal */}
      {showGooglePrompt && profile.google_place_id && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-ink-950/40 backdrop-blur-sm"
            onClick={() => setShowGooglePrompt(false)}
          />
          <div className="animate-scale-in relative w-full max-w-sm rounded-3xl bg-white p-6 shadow-card-lg">
            <h3 className="text-center text-base font-semibold">
              Review us on Google?
            </h3>
            <p className="mt-2 text-center text-xs text-ink-500">
              Would you like to post the same review on our Google Business
              Profile? It helps us a lot!
            </p>
            <div className="mt-5 flex gap-2">
              <button
                onClick={() => setShowGooglePrompt(false)}
                className="flex-1 rounded-xl border border-ink-200 py-2.5 text-xs font-medium text-ink-600 transition hover:bg-ink-50"
              >
                No thanks
              </button>
              <a
                href={googleReviewUrl(profile.google_place_id!)}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setShowGooglePrompt(false)}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-ink-950 py-2.5 text-xs font-medium text-white transition hover:bg-ink-800"
              >
                Review on Google
                <ExternalLink size={11} />
              </a>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

/* ================================================================== */

function Stat({
  icon,
  value,
  label,
}: {
  icon: React.ReactNode;
  value: string;
  label: string;
}) {
  return (
    <div className="flex items-center gap-2 rounded-xl bg-white/5 px-3 py-2">
      <span className="text-white/40">{icon}</span>
      <div>
        <p className="text-sm font-bold leading-none">{value}</p>
        <p className="text-[9px] text-white/40">{label}</p>
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

function ProfileSection({
  title,
  icon,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-ink-100 bg-white p-4">
      <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
        <span className="text-ink-400">{icon}</span>
        {title}
      </div>
      {children}
    </section>
  );
}

function ReviewForm({
  profileId,
  googlePlaceId,
  onSubmit,
  onCancel,
}: {
  profileId: string;
  googlePlaceId: string | null;
  onSubmit: (comment: string) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSubmitting(true);

    try {
      const res = await fetch("/api/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          profile_id: profileId,
          reviewer_name: name.trim(),
          reviewer_email: email.trim() || null,
          rating,
          comment: comment.trim() || null,
        }),
      });
      if (res.ok) {
        onSubmit(comment.trim());
      }
    } catch {
      // ignore
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mt-3 space-y-2 rounded-xl border border-ink-200 p-3"
    >
      <div className="flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setRating(s)}
            className="p-0.5"
          >
            <Star
              size={20}
              className={
                s <= rating
                  ? "fill-ink-950 text-ink-950"
                  : "text-ink-200 hover:text-ink-400"
              }
            />
          </button>
        ))}
      </div>
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Your name *"
        required
        className="w-full rounded-lg border border-ink-200 px-3 py-2 text-xs outline-none"
      />
      <input
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Email (optional)"
        type="email"
        className="w-full rounded-lg border border-ink-200 px-3 py-2 text-xs outline-none"
      />
      <textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        placeholder="Write your review..."
        rows={3}
        className="w-full resize-none rounded-lg border border-ink-200 px-3 py-2 text-xs outline-none"
      />
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 rounded-lg border border-ink-200 py-2 text-xs font-medium text-ink-500"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={submitting || !name.trim()}
          className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-ink-950 py-2 text-xs font-medium text-white disabled:opacity-40"
        >
          <Send size={11} />
          {submitting ? "Sending…" : "Submit"}
        </button>
      </div>
    </form>
  );
}
