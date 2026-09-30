"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Profile, BankAccount } from "@/lib/supabase/types";
import { initials } from "@/lib/utils";
import {
  Edit3,
  Plus,
  Share2,
  QrCode,
  ExternalLink,
  MapPin,
  Phone,
  Mail,
  Globe,
  Star,
  Clock,
  Award,
  ChevronDown,
  ChevronRight,
  Briefcase,
  Image as ImageIcon,
  Link2,
  X,
  Check,
  Camera,
  User,
  FileText,
  Download,
  Banknote,
  CreditCard,
  Wallet,
  Instagram,
  Youtube,
  Facebook,
  Linkedin,
  MessageCircle,
  Copy,
  BookUser,
  StarIcon,
  Upload,
  Loader2,
} from "lucide-react";
import { googleReviewUrl } from "@/lib/utils";

type EditSection =
  | null
  | "basic"
  | "about"
  | "social"
  | "services"
  | "products"
  | "gallery"
  | "banking";

// Calculate profile completion percentage
function calcCompletion(p: Profile): number {
  const fields = [
    p.owner_name,
    p.business_name,
    p.job_title,
    p.phone,
    p.email,
    p.website,
    p.bio,
    p.address,
    p.username,
    p.logo_url,
    p.cover_url,
    p.gst_number,
    p.google_place_id,
    p.coverage_area,
    (p.social_links as unknown[])?.length > 0 ? true : null,
    (p.services as unknown[])?.length > 0 ? true : null,
    (p.products as unknown[])?.length > 0 ? true : null,
    (p.gallery as unknown[])?.length > 0 ? true : null,
    (p.bank_accounts as unknown[])?.length > 0 ? true : null,
  ];
  const filled = fields.filter(Boolean).length;
  return Math.round((filled / fields.length) * 100);
}

export default function ProfilePage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<EditSection>(null);
  const [saving, setSaving] = useState(false);
  const [cardSlug, setCardSlug] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<Profile>>({});
  const [reviews, setReviews] = useState<
    { reviewer_name: string; rating: number; comment: string | null; created_at: string }[]
  >([]);

  // Collapsible section state
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    username: true,
    about: false,
    services: false,
    gallery: false,
    social: false,
    reviews: false,
    banking: false,
    downloads: false,
  });

  const toggleSection = (key: string) =>
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));

  const loadProfile = useCallback(async () => {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const [{ data: profileData }, { data: cardData }, { data: reviewData }] =
      await Promise.all([
        supabase.from("profiles").select("*").eq("id", user.id).single(),
        supabase
          .from("cards")
          .select("public_slug")
          .eq("profile_id", user.id)
          .maybeSingle(),
        supabase
          .from("reviews")
          .select("reviewer_name, rating, comment, created_at")
          .eq("profile_id", user.id)
          .order("created_at", { ascending: false })
          .limit(10),
      ]);

    if (profileData) setProfile(profileData as unknown as Profile);
    if (cardData)
      setCardSlug((cardData as { public_slug: string }).public_slug);
    if (reviewData)
      setReviews(
        reviewData as { reviewer_name: string; rating: number; comment: string | null; created_at: string }[]
      );
    setLoading(false);
  }, []);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  function startEdit(section: EditSection) {
    if (profile) setEditForm({ ...profile });
    setEditing(section);
  }

  async function saveProfile() {
    if (!profile) return;
    setSaving(true);
    const supabase = createClient();

    const { error } = await supabase
      .from("profiles")
      .update({
        owner_name: editForm.owner_name ?? null,
        business_name: editForm.business_name ?? null,
        job_title: editForm.job_title ?? null,
        phone: editForm.phone ?? null,
        email: editForm.email ?? null,
        website: editForm.website ?? null,
        bio: editForm.bio ?? null,
        address: editForm.address ?? null,
        username: editForm.username ?? null,
        years_in_business: editForm.years_in_business ?? null,
        clients_served: editForm.clients_served ?? null,
        coverage_area: editForm.coverage_area ?? null,
        social_links: editForm.social_links ?? [],
        services: editForm.services ?? [],
        products: editForm.products ?? [],
        gallery: editForm.gallery ?? [],
        bank_accounts: editForm.bank_accounts ?? [],
        google_place_id: editForm.google_place_id ?? null,
        gst_number: editForm.gst_number ?? null,
        brochure_url: editForm.brochure_url ?? null,
        cover_url: editForm.cover_url ?? null,
      } as Record<string, unknown>)
      .eq("id", profile.id);

    if (!error) {
      setProfile({ ...profile, ...editForm } as Profile);
      setEditing(null);
    }
    setSaving(false);
  }

  async function uploadImage(
    file: File,
    bucket: string,
    field: "logo_url" | "cover_url" | "avatar_url"
  ) {
    if (!profile) return;
    const supabase = createClient();
    const ext = file.name.split(".").pop();
    const path = `${profile.id}/${field}-${Date.now()}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from(bucket)
      .upload(path, file, { upsert: true });

    if (uploadError) return;

    const {
      data: { publicUrl },
    } = supabase.storage.from(bucket).getPublicUrl(path);

    await supabase
      .from("profiles")
      .update({ [field]: publicUrl } as Record<string, unknown>)
      .eq("id", profile.id);

    setProfile({ ...profile, [field]: publicUrl } as Profile);
  }

  async function shareProfile() {
    const url = profile?.username
      ? `${window.location.origin}/${profile.username}`
      : cardSlug
        ? `${window.location.origin}/${cardSlug}`
        : window.location.origin;
    if (navigator.share) {
      try {
        await navigator.share({
          title: profile?.business_name ?? "Namma Info",
          url,
        });
      } catch {
        /* cancelled */
      }
    } else {
      await navigator.clipboard.writeText(url);
    }
  }

  function generateVCard() {
    if (!profile) return;
    const lines = [
      "BEGIN:VCARD",
      "VERSION:3.0",
      `FN:${profile.owner_name || profile.business_name || ""}`,
      `ORG:${profile.business_name || ""}`,
      `TITLE:${profile.job_title || ""}`,
    ];
    if (profile.phone) lines.push(`TEL;TYPE=WORK:${profile.phone}`);
    if (profile.email) lines.push(`EMAIL:${profile.email}`);
    if (profile.website) {
      const w = profile.website.startsWith("http")
        ? profile.website
        : `https://${profile.website}`;
      lines.push(`URL:${w}`);
    }
    if (profile.address) lines.push(`ADR;TYPE=WORK:;;${profile.address}`);
    lines.push("END:VCARD");

    const blob = new Blob([lines.join("\n")], { type: "text/vcard" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${profile.username || "contact"}.vcf`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const completion = useMemo(
    () => (profile ? calcCompletion(profile) : 0),
    [profile]
  );

  if (loading) {
    return (
      <div className="mx-auto max-w-lg px-4 py-5">
        <div className="space-y-4">
          <div className="skeleton h-48 rounded-3xl" />
          <div className="skeleton h-24 rounded-2xl" />
          <div className="skeleton h-24 rounded-2xl" />
        </div>
      </div>
    );
  }

  if (!profile) return null;

  const profileUrl = profile.username
    ? `nammainfo.in/${profile.username}`
    : cardSlug
      ? `nammainfo.in/${cardSlug}`
      : null;

  return (
    <div className="mx-auto max-w-lg pb-8">
      {/* ===== COVER PHOTO + AVATAR ===== */}
      <div className="relative">
        {/* Cover */}
        <div className="relative h-44 w-full overflow-hidden bg-[var(--accent)]">
          {profile.cover_url ? (
            <img
              src={profile.cover_url}
              alt=""
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-ink-950 dark:bg-ink-800">
              <Camera size={32} className="text-white/20" />
            </div>
          )}
          <label className="absolute right-3 top-3 cursor-pointer rounded-full bg-ink-950/60 p-2 text-white backdrop-blur-sm transition hover:bg-ink-950/80">
            <Camera size={16} />
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) uploadImage(f, "avatars", "cover_url");
              }}
            />
          </label>
        </div>

        {/* Avatar overlapping cover */}
        <div className="absolute -bottom-12 left-5">
          <div className="relative">
            <div className="h-24 w-24 overflow-hidden rounded-2xl border-4 border-[var(--background)] bg-[var(--accent)] shadow-card">
              {profile.logo_url ? (
                <img
                  src={profile.logo_url}
                  alt=""
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-ink-950 font-headline text-2xl font-bold text-white dark:bg-ink-700">
                  {initials(profile.owner_name || profile.business_name)}
                </div>
              )}
            </div>
            <label className="absolute -bottom-1 -right-1 cursor-pointer rounded-full bg-[var(--foreground)] p-1.5 text-[var(--background)] shadow-md transition hover:opacity-80">
              <Camera size={12} />
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) uploadImage(f, "avatars", "logo_url");
                }}
              />
            </label>
          </div>
        </div>
      </div>

      {/* Name + actions (below avatar) */}
      <div className="mt-14 px-5">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="font-headline text-xl font-bold">
              {profile.owner_name || "Your Name"}
            </h1>
            <p className="text-sm text-[var(--muted-foreground)]">
              {[profile.job_title, profile.business_name]
                .filter(Boolean)
                .join(" · ") || "Add your title"}
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={shareProfile}
              className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-2.5 transition hover:bg-[var(--accent)]"
            >
              <Share2 size={16} />
            </button>
            <button
              onClick={() => startEdit("basic")}
              className="rounded-xl bg-[var(--foreground)] p-2.5 text-[var(--background)] transition hover:opacity-80"
            >
              <Edit3 size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* ===== MEMBERSHIP CARD ===== */}
      <div className="mt-5 px-5">
        <div className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--card)]">
          <div className="flex items-center justify-between px-4 py-3">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--foreground)]">
                <Star size={18} className="text-[var(--background)]" />
              </div>
              <div>
                <p className="font-headline text-sm font-semibold">
                  {profile.is_member ? "Premium Member" : "Free Member"}
                </p>
                <p className="font-mono text-[10px] text-[var(--muted-foreground)]">
                  Profile {completion}% complete
                </p>
              </div>
            </div>
            <ChevronRight size={16} className="text-[var(--muted-foreground)]" />
          </div>
          {/* Completion bar */}
          <div className="px-4 pb-3">
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--accent)]">
              <div
                className="h-full rounded-full bg-[var(--foreground)] transition-all duration-500"
                style={{ width: `${completion}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* ===== COLLAPSIBLE SECTIONS ===== */}
      <div className="mt-5 space-y-3 px-5">
        {/* Username & Profile URL */}
        <CollapsibleSection
          title="Username & Profile URL"
          icon={<Link2 size={16} />}
          isOpen={openSections.username}
          onToggle={() => toggleSection("username")}
          onEdit={() => startEdit("basic")}
        >
          {profileUrl ? (
            <div className="flex items-center justify-between rounded-xl bg-[var(--accent)] px-3 py-2.5">
              <span className="font-mono text-sm">{profileUrl}</span>
              <button
                onClick={() => navigator.clipboard.writeText(`https://${profileUrl}`)}
                className="rounded-lg p-1.5 text-[var(--muted-foreground)] transition hover:text-[var(--foreground)]"
              >
                <Copy size={14} />
              </button>
            </div>
          ) : (
            <p className="text-sm text-[var(--muted-foreground)]">
              Set a username to get your profile URL
            </p>
          )}
        </CollapsibleSection>

        {/* About Us */}
        <CollapsibleSection
          title="About Us"
          icon={<Briefcase size={16} />}
          isOpen={openSections.about}
          onToggle={() => toggleSection("about")}
          onEdit={() => startEdit("about")}
        >
          {profile.bio ? (
            <p className="text-sm leading-relaxed text-[var(--muted-foreground)]">
              {profile.bio}
            </p>
          ) : (
            <p className="text-sm text-[var(--muted-foreground)] opacity-60">
              Add a description about your business
            </p>
          )}
          {profile.address && (
            <div className="mt-3 flex items-start gap-2">
              <MapPin size={14} className="mt-0.5 shrink-0 text-[var(--muted-foreground)]" />
              <span className="text-sm text-[var(--muted-foreground)]">
                {profile.address}
              </span>
            </div>
          )}
          {profile.coverage_area && (
            <div className="mt-2 flex items-start gap-2">
              <Globe size={14} className="mt-0.5 shrink-0 text-[var(--muted-foreground)]" />
              <span className="text-sm text-[var(--muted-foreground)]">
                Serves: {profile.coverage_area}
              </span>
            </div>
          )}
          {/* Stats row */}
          {(profile.years_in_business || profile.clients_served) && (
            <div className="mt-3 flex gap-3">
              {profile.years_in_business && (
                <div className="flex items-center gap-1.5 rounded-lg bg-[var(--accent)] px-3 py-1.5">
                  <Clock size={12} className="text-[var(--muted-foreground)]" />
                  <span className="font-mono text-xs font-medium">
                    {profile.years_in_business} yrs
                  </span>
                </div>
              )}
              {profile.clients_served && (
                <div className="flex items-center gap-1.5 rounded-lg bg-[var(--accent)] px-3 py-1.5">
                  <User size={12} className="text-[var(--muted-foreground)]" />
                  <span className="font-mono text-xs font-medium">
                    {profile.clients_served}+ clients
                  </span>
                </div>
              )}
            </div>
          )}
        </CollapsibleSection>

        {/* Services & Products */}
        <CollapsibleSection
          title="Services & Products"
          icon={<Award size={16} />}
          isOpen={openSections.services}
          onToggle={() => toggleSection("services")}
          onEdit={() => startEdit("services")}
        >
          {/* Services */}
          {(profile.services as { name: string; description?: string; price?: string; emoji?: string }[] ?? []).length > 0 && (
            <>
              <p className="mb-2 font-mono text-[10px] font-semibold uppercase tracking-widest text-[var(--muted-foreground)]">
                Services
              </p>
              <div className="grid grid-cols-2 gap-2">
                {(
                  profile.services as {
                    name: string;
                    description?: string;
                    price?: string;
                    emoji?: string;
                  }[]
                ).map((s, i) => (
                  <div
                    key={i}
                    className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-3"
                  >
                    <div className="mb-1.5 flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--accent)] text-base">
                      {s.emoji || "⚡"}
                    </div>
                    <p className="text-xs font-semibold">{s.name}</p>
                    {s.description && (
                      <p className="mt-0.5 text-[10px] text-[var(--muted-foreground)]">
                        {s.description}
                      </p>
                    )}
                    {s.price && (
                      <p className="mt-1 font-mono text-[10px] font-semibold">
                        {s.price}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}

          {/* Products */}
          {(profile.products as { name: string; description?: string; price?: string; image_url?: string; emoji?: string }[] ?? []).length > 0 && (
            <>
              <p className="mb-2 mt-4 font-mono text-[10px] font-semibold uppercase tracking-widest text-[var(--muted-foreground)]">
                Products
              </p>
              <div className="grid grid-cols-2 gap-2">
                {(
                  profile.products as {
                    name: string;
                    description?: string;
                    price?: string;
                    image_url?: string;
                    emoji?: string;
                  }[]
                ).map((p, i) => (
                  <div
                    key={i}
                    className="overflow-hidden rounded-xl border border-[var(--border)]"
                  >
                    {p.image_url ? (
                      <img
                        src={p.image_url}
                        alt={p.name}
                        className="aspect-square w-full object-cover"
                      />
                    ) : (
                      <div className="flex aspect-square w-full items-center justify-center bg-[var(--accent)] text-2xl">
                        {p.emoji || "📦"}
                      </div>
                    )}
                    <div className="p-2.5">
                      <p className="text-xs font-semibold">{p.name}</p>
                      {p.price && (
                        <p className="mt-0.5 font-mono text-[10px] font-semibold text-[var(--muted-foreground)]">
                          {p.price}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {(profile.services as unknown[] ?? []).length === 0 &&
            (profile.products as unknown[] ?? []).length === 0 && (
              <p className="text-sm text-[var(--muted-foreground)] opacity-60">
                Showcase your services and products
              </p>
            )}
        </CollapsibleSection>

        {/* Gallery */}
        <CollapsibleSection
          title="Gallery"
          icon={<ImageIcon size={16} />}
          isOpen={openSections.gallery}
          onToggle={() => toggleSection("gallery")}
          onEdit={() => startEdit("gallery")}
        >
          <GallerySection
            gallery={
              (profile.gallery as {
                url: string;
                category?: string;
                caption?: string;
              }[]) ?? []
            }
          />
        </CollapsibleSection>

        {/* Connect With Us */}
        <CollapsibleSection
          title="Connect With Us"
          icon={<MessageCircle size={16} />}
          isOpen={openSections.social}
          onToggle={() => toggleSection("social")}
          onEdit={() => startEdit("social")}
        >
          {(profile.social_links as { platform: string; url: string }[] ?? []).length > 0 ? (
            <div className="grid grid-cols-2 gap-2">
              {(
                profile.social_links as { platform: string; url: string }[]
              ).map((link, i) => (
                <a
                  key={i}
                  href={link.url.startsWith("http") ? link.url : `https://${link.url}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2.5 rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 py-2.5 transition hover:bg-[var(--accent)]"
                >
                  <SocialIcon platform={link.platform} />
                  <span className="text-xs font-medium">{link.platform}</span>
                </a>
              ))}
            </div>
          ) : (
            <p className="text-sm text-[var(--muted-foreground)] opacity-60">
              Add your social media links
            </p>
          )}
        </CollapsibleSection>

        {/* Write a Google Review */}
        <CollapsibleSection
          title="Write a Google Review"
          icon={<StarIcon size={16} />}
          isOpen={openSections.reviews}
          onToggle={() => toggleSection("reviews")}
          onEdit={() => startEdit("about")}
        >
          {/* Google Place ID link */}
          {profile.google_place_id ? (
            <div className="space-y-3">
              <a
                href={googleReviewUrl(profile.google_place_id)}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 rounded-xl bg-[var(--foreground)] px-4 py-2.5 text-sm font-semibold text-[var(--background)] transition hover:opacity-80"
              >
                <StarIcon size={14} />
                Write a Review on Google
              </a>

              {/* Existing reviews */}
              {reviews.length > 0 && (
                <div className="space-y-2">
                  <p className="font-mono text-[10px] font-semibold uppercase tracking-widest text-[var(--muted-foreground)]">
                    Recent Reviews ({reviews.length})
                  </p>
                  {reviews.map((rev, i) => (
                    <div
                      key={i}
                      className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-3"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold">
                          {rev.reviewer_name}
                        </span>
                        <div className="flex gap-0.5">
                          {Array.from({ length: 5 }).map((_, s) => (
                            <Star
                              key={s}
                              size={10}
                              className={
                                s < rev.rating
                                  ? "fill-amber-400 text-amber-400"
                                  : "text-[var(--muted-foreground)]/30"
                              }
                            />
                          ))}
                        </div>
                      </div>
                      {rev.comment && (
                        <p className="mt-1.5 text-xs leading-relaxed text-[var(--muted-foreground)]">
                          {rev.comment.length > 120
                            ? rev.comment.slice(0, 120) + "…"
                            : rev.comment}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="text-center">
              <p className="text-sm text-[var(--muted-foreground)] opacity-60">
                Add your Google Place ID in the About section to enable reviews
              </p>
              <button
                onClick={() => startEdit("about")}
                className="mt-2 text-xs font-medium text-[var(--foreground)] underline underline-offset-2"
              >
                Set up now
              </button>
            </div>
          )}
        </CollapsibleSection>

        {/* Banking & Payment Info */}
        <CollapsibleSection
          title="Banking & Payment Info"
          icon={<Banknote size={16} />}
          isOpen={openSections.banking}
          onToggle={() => toggleSection("banking")}
          onEdit={() => startEdit("banking")}
        >
          {(profile.bank_accounts as { bank_name?: string; account_number?: string; ifsc?: string; upi_id?: string; qr_url?: string }[] ?? []).length > 0 ? (
            <div className="space-y-3">
              {(
                profile.bank_accounts as {
                  bank_name?: string;
                  account_number?: string;
                  ifsc?: string;
                  upi_id?: string;
                  qr_url?: string;
                }[]
              ).map((acc, i) => (
                <div
                  key={i}
                  className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-3"
                >
                  {acc.bank_name && (
                    <div className="mb-2 flex items-center gap-2">
                      <CreditCard size={14} className="text-[var(--muted-foreground)]" />
                      <span className="text-sm font-semibold">
                        {acc.bank_name}
                      </span>
                    </div>
                  )}
                  {acc.account_number && (
                    <div className="flex items-center justify-between py-1">
                      <span className="font-mono text-xs text-[var(--muted-foreground)]">
                        A/C: {acc.account_number}
                      </span>
                      <button
                        onClick={() =>
                          navigator.clipboard.writeText(acc.account_number!)
                        }
                        className="p-1 text-[var(--muted-foreground)]"
                      >
                        <Copy size={12} />
                      </button>
                    </div>
                  )}
                  {acc.ifsc && (
                    <p className="font-mono text-xs text-[var(--muted-foreground)]">
                      IFSC: {acc.ifsc}
                    </p>
                  )}
                  {acc.upi_id && (
                    <div className="mt-2 flex items-center gap-2 rounded-lg bg-[var(--accent)] px-3 py-2">
                      <Wallet size={14} className="text-[var(--muted-foreground)]" />
                      <span className="font-mono text-xs font-medium">
                        {acc.upi_id}
                      </span>
                      <button
                        onClick={() =>
                          navigator.clipboard.writeText(acc.upi_id!)
                        }
                        className="ml-auto p-1 text-[var(--muted-foreground)]"
                      >
                        <Copy size={12} />
                      </button>
                    </div>
                  )}
                  {acc.qr_url && (
                    <div className="mt-2">
                      <img
                        src={acc.qr_url}
                        alt="Payment QR"
                        className="h-32 w-32 rounded-lg object-contain"
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-[var(--muted-foreground)] opacity-60">
              Add your banking & payment details
            </p>
          )}
        </CollapsibleSection>

        {/* Downloads & Actions */}
        <CollapsibleSection
          title="Downloads & Actions"
          icon={<Download size={16} />}
          isOpen={openSections.downloads}
          onToggle={() => toggleSection("downloads")}
        >
          <div className="grid grid-cols-2 gap-2">
            <ActionButton
              icon={<Download size={16} />}
              label="Download Profile"
              onClick={generateVCard}
            />
            {profile.brochure_url && (
              <ActionButton
                icon={<FileText size={16} />}
                label="Brochure"
                onClick={() => window.open(profile.brochure_url!, "_blank")}
              />
            )}
            <ActionButton
              icon={<BookUser size={16} />}
              label="Save to Contacts"
              onClick={generateVCard}
            />
            <ActionButton
              icon={<Share2 size={16} />}
              label="Share Profile"
              onClick={shareProfile}
            />
          </div>
        </CollapsibleSection>
      </div>

      {/* ===== GST & ADDRESS FOOTER ===== */}
      {(profile.gst_number || profile.address) && (
        <div className="mt-6 border-t border-[var(--border)] px-5 py-4">
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

      {/* ============= EDIT SHEETS ============= */}

      {editing === "basic" && (
        <EditSheet title="Edit Profile" onClose={() => setEditing(null)}>
          <InputField
            label="Your Name"
            value={editForm.owner_name ?? ""}
            onChange={(v) => setEditForm({ ...editForm, owner_name: v })}
          />
          <InputField
            label="Business Name"
            value={editForm.business_name ?? ""}
            onChange={(v) => setEditForm({ ...editForm, business_name: v })}
          />
          <InputField
            label="Job Title"
            value={editForm.job_title ?? ""}
            onChange={(v) => setEditForm({ ...editForm, job_title: v })}
          />
          <InputField
            label="Username"
            value={editForm.username ?? ""}
            onChange={(v) =>
              setEditForm({
                ...editForm,
                username: v
                  .toLowerCase()
                  .replace(/[^a-z0-9-]/g, "")
                  .slice(0, 30),
              })
            }
            prefix="nammainfo.in/"
          />
          <InputField
            label="Phone"
            value={editForm.phone ?? ""}
            onChange={(v) => setEditForm({ ...editForm, phone: v })}
            type="tel"
          />
          <InputField
            label="Email"
            value={editForm.email ?? ""}
            onChange={(v) => setEditForm({ ...editForm, email: v })}
            type="email"
          />
          <InputField
            label="Website"
            value={editForm.website ?? ""}
            onChange={(v) => setEditForm({ ...editForm, website: v })}
            type="url"
            placeholder="https://yoursite.com"
          />
          <SaveButton saving={saving} onClick={saveProfile} />
        </EditSheet>
      )}

      {editing === "about" && (
        <EditSheet title="Edit About" onClose={() => setEditing(null)}>
          <TextareaField
            label="About your business"
            value={editForm.bio ?? ""}
            onChange={(v) => setEditForm({ ...editForm, bio: v })}
            rows={4}
          />
          <InputField
            label="Address"
            value={editForm.address ?? ""}
            onChange={(v) => setEditForm({ ...editForm, address: v })}
          />
          <InputField
            label="Coverage Area"
            value={editForm.coverage_area ?? ""}
            onChange={(v) => setEditForm({ ...editForm, coverage_area: v })}
          />
          <InputField
            label="Years in Business"
            value={String(editForm.years_in_business ?? "")}
            onChange={(v) =>
              setEditForm({
                ...editForm,
                years_in_business: v ? parseInt(v) : null,
              })
            }
            type="number"
          />
          <InputField
            label="Clients Served"
            value={String(editForm.clients_served ?? "")}
            onChange={(v) =>
              setEditForm({
                ...editForm,
                clients_served: v ? parseInt(v) : null,
              })
            }
            type="number"
          />
          <InputField
            label="GST Number"
            value={editForm.gst_number ?? ""}
            onChange={(v) => setEditForm({ ...editForm, gst_number: v })}
          />
          <InputField
            label="Google Place ID (for reviews)"
            value={editForm.google_place_id ?? ""}
            onChange={(v) => setEditForm({ ...editForm, google_place_id: v })}
            placeholder="ChIJ..."
          />
          <div>
            <p className="mb-1.5 text-xs font-medium text-[var(--muted-foreground)]">
              Brochure / Catalog (PDF or Image)
            </p>
            <ImageUploader
              value={editForm.brochure_url ?? ""}
              onChange={(url) => setEditForm({ ...editForm, brochure_url: url })}
              folder="brochures"
              userId={profile?.id ?? ""}
              label="Upload brochure"
              accept="image/*,.pdf"
            />
          </div>
          <SaveButton saving={saving} onClick={saveProfile} />
        </EditSheet>
      )}

      {editing === "social" && (
        <EditSheet title="Social Links" onClose={() => setEditing(null)}>
          <SocialLinksEditor
            links={(editForm.social_links as { platform: string; url: string }[]) ?? []}
            onChange={(links) =>
              setEditForm({ ...editForm, social_links: links })
            }
          />
          <SaveButton saving={saving} onClick={saveProfile} />
        </EditSheet>
      )}

      {editing === "services" && (
        <EditSheet title="Services & Products" onClose={() => setEditing(null)}>
          <p className="font-mono text-[10px] font-semibold uppercase tracking-widest text-[var(--muted-foreground)]">
            Services
          </p>
          <ItemListEditor
            items={
              (editForm.services as {
                name: string;
                description?: string;
                price?: string;
              }[]) ?? []
            }
            onChange={(items) =>
              setEditForm({ ...editForm, services: items })
            }
            label="service"
          />
          <div className="my-3 border-t border-[var(--border)]" />
          <p className="font-mono text-[10px] font-semibold uppercase tracking-widest text-[var(--muted-foreground)]">
            Products
          </p>
          <ItemListEditor
            items={
              (editForm.products as {
                name: string;
                description?: string;
                price?: string;
                image_url?: string;
              }[]) ?? []
            }
            onChange={(items) =>
              setEditForm({ ...editForm, products: items })
            }
            label="product"
            showImage
            userId={profile?.id ?? ""}
          />
          <SaveButton saving={saving} onClick={saveProfile} />
        </EditSheet>
      )}

      {editing === "gallery" && (
        <EditSheet title="Gallery" onClose={() => setEditing(null)}>
          <GalleryEditor
            gallery={
              (editForm.gallery as {
                url: string;
                category?: string;
                caption?: string;
              }[]) ?? []
            }
            onChange={(g) => setEditForm({ ...editForm, gallery: g })}
            userId={profile?.id ?? ""}
          />
          <SaveButton saving={saving} onClick={saveProfile} />
        </EditSheet>
      )}

      {editing === "banking" && (
        <EditSheet title="Banking & Payment" onClose={() => setEditing(null)}>
          <BankAccountsEditor
            accounts={
              (editForm.bank_accounts as {
                bank_name?: string;
                account_holder?: string;
                account_number?: string;
                ifsc?: string;
                upi_id?: string;
                qr_url?: string;
              }[]) ?? []
            }
            onChange={(accs) =>
              setEditForm({ ...editForm, bank_accounts: accs as BankAccount[] })
            }
            userId={profile?.id ?? ""}
          />
          <SaveButton saving={saving} onClick={saveProfile} />
        </EditSheet>
      )}
    </div>
  );
}

/* ================================================================== */
/*  Sub-components                                                     */
/* ================================================================== */

function CollapsibleSection({
  title,
  icon,
  isOpen,
  onToggle,
  onEdit,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  isOpen: boolean;
  onToggle: () => void;
  onEdit?: () => void;
  children: React.ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--card)]">
      <button
        onClick={onToggle}
        className="flex w-full items-center justify-between px-4 py-3.5"
      >
        <div className="flex items-center gap-2.5">
          <span className="text-[var(--muted-foreground)]">{icon}</span>
          <span className="font-headline text-sm font-semibold">{title}</span>
        </div>
        <div className="flex items-center gap-1">
          {onEdit && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onEdit();
              }}
              className="rounded-lg p-1.5 text-[var(--muted-foreground)] transition hover:text-[var(--foreground)]"
            >
              <Edit3 size={13} />
            </button>
          )}
          <ChevronDown
            size={16}
            className={`text-[var(--muted-foreground)] transition-transform ${
              isOpen ? "rotate-180" : ""
            }`}
          />
        </div>
      </button>
      {isOpen && (
        <div className="animate-fade-in border-t border-[var(--border)] px-4 py-3">
          {children}
        </div>
      )}
    </section>
  );
}

function GallerySection({
  gallery,
}: {
  gallery: { url: string; category?: string; caption?: string }[];
}) {
  const [activeTab, setActiveTab] = useState("All");

  if (gallery.length === 0) {
    return (
      <p className="text-sm text-[var(--muted-foreground)] opacity-60">
        Add photos to your gallery
      </p>
    );
  }

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
      {/* Category tabs */}
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
          <div key={i} className="overflow-hidden rounded-lg">
            <img
              src={img.url}
              alt={img.caption ?? ""}
              className="aspect-square w-full object-cover"
            />
          </div>
        ))}
      </div>
    </div>
  );
}

function ActionButton({
  icon,
  label,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-2.5 rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 py-3 text-left transition hover:bg-[var(--accent)]"
    >
      <span className="text-[var(--muted-foreground)]">{icon}</span>
      <span className="text-xs font-medium">{label}</span>
    </button>
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

function EditSheet({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center">
      <div
        className="absolute inset-0 bg-ink-950/40 backdrop-blur-sheet"
        onClick={onClose}
      />
      <div className="animate-slide-up relative max-h-[85dvh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-[var(--card)] p-5 shadow-card-lg sm:rounded-3xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-headline text-lg font-semibold">{title}</h2>
          <button
            onClick={onClose}
            className="rounded-full bg-[var(--accent)] p-1.5 transition hover:opacity-80"
          >
            <X size={16} />
          </button>
        </div>
        <div className="space-y-3">{children}</div>
      </div>
    </div>
  );
}

function InputField({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
  prefix,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
  prefix?: string;
}) {
  return (
    <div>
      <label className="mb-1 block font-mono text-[10px] font-semibold uppercase tracking-widest text-[var(--muted-foreground)]">
        {label}
      </label>
      <div className="flex">
        {prefix && (
          <span className="flex items-center rounded-l-xl border border-r-0 border-[var(--border)] bg-[var(--accent)] px-3 font-mono text-xs text-[var(--muted-foreground)]">
            {prefix}
          </span>
        )}
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={`w-full border border-[var(--border)] bg-[var(--card)] px-3 py-2.5 text-sm outline-none transition ${
            prefix ? "rounded-r-xl" : "rounded-xl"
          }`}
        />
      </div>
    </div>
  );
}

function TextareaField({
  label,
  value,
  onChange,
  rows = 3,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  rows?: number;
}) {
  return (
    <div>
      <label className="mb-1 block font-mono text-[10px] font-semibold uppercase tracking-widest text-[var(--muted-foreground)]">
        {label}
      </label>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={rows}
        className="w-full resize-none rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 py-2.5 text-sm outline-none transition"
      />
    </div>
  );
}

function SaveButton({
  saving,
  onClick,
}: {
  saving: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      disabled={saving}
      className="flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--foreground)] py-3 text-sm font-semibold text-[var(--background)] transition hover:opacity-80 disabled:opacity-40"
    >
      <Check size={14} />
      {saving ? "Saving…" : "Save changes"}
    </button>
  );
}

function SocialLinksEditor({
  links,
  onChange,
}: {
  links: { platform: string; url: string }[];
  onChange: (links: { platform: string; url: string }[]) => void;
}) {
  const platforms = [
    "WhatsApp",
    "Instagram",
    "Facebook",
    "YouTube",
    "LinkedIn",
    "Twitter",
    "Telegram",
    "GitHub",
  ];

  return (
    <div className="space-y-3">
      {links.map((link, i) => {
        const isWhatsApp = link.platform.toLowerCase().includes("whatsapp");
        return (
          <div key={i} className="flex gap-2">
            <select
              value={link.platform}
              onChange={(e) => {
                const updated = [...links];
                updated[i] = { ...link, platform: e.target.value, url: "" };
                onChange(updated);
              }}
              className="w-32 rounded-xl border border-[var(--border)] bg-[var(--card)] px-2 py-2.5 text-xs"
            >
              {platforms.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
            <input
              value={link.url}
              onChange={(e) => {
                const updated = [...links];
                const val = isWhatsApp
                  ? e.target.value.replace(/[^0-9+\s-]/g, "")
                  : e.target.value;
                updated[i] = { ...link, url: val };
                onChange(updated);
              }}
              type={isWhatsApp ? "tel" : "text"}
              placeholder={isWhatsApp ? "+91 98765 43210" : "https://..."}
              inputMode={isWhatsApp ? "tel" : "url"}
              className="flex-1 rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 py-2.5 text-xs"
            />
            <button
              onClick={() => onChange(links.filter((_, idx) => idx !== i))}
              className="rounded-xl p-2.5 text-[var(--muted-foreground)] hover:text-red-500"
            >
              <X size={14} />
            </button>
          </div>
        );
      })}
      <button
        onClick={() =>
          onChange([...links, { platform: "WhatsApp", url: "" }])
        }
        className="flex items-center gap-1.5 text-xs font-medium text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
      >
        <Plus size={12} />
        Add link
      </button>
    </div>
  );
}

function ItemListEditor({
  items,
  onChange,
  label,
  showImage,
  userId,
}: {
  items: { name: string; description?: string; price?: string; image_url?: string }[];
  onChange: (
    items: { name: string; description?: string; price?: string; image_url?: string }[]
  ) => void;
  label: string;
  showImage?: boolean;
  userId?: string;
}) {
  return (
    <div className="space-y-3">
      {items.map((item, i) => (
        <div key={i} className="rounded-xl border border-[var(--border)] p-3">
          <div className="flex items-start justify-between">
            <div className="flex-1 space-y-2">
              <input
                value={item.name}
                onChange={(e) => {
                  const updated = [...items];
                  updated[i] = { ...item, name: e.target.value };
                  onChange(updated);
                }}
                placeholder={`${label} name`}
                className="w-full border-none bg-transparent text-sm font-medium outline-none"
              />
              <input
                value={item.description ?? ""}
                onChange={(e) => {
                  const updated = [...items];
                  updated[i] = { ...item, description: e.target.value };
                  onChange(updated);
                }}
                placeholder="Description"
                className="w-full border-none bg-transparent text-xs text-[var(--muted-foreground)] outline-none"
              />
              <input
                value={item.price ?? ""}
                onChange={(e) => {
                  const updated = [...items];
                  updated[i] = { ...item, price: e.target.value };
                  onChange(updated);
                }}
                placeholder="Price (optional)"
                className="w-full border-none bg-transparent text-xs text-[var(--muted-foreground)] outline-none"
              />
              {showImage && userId && (
                <ImageUploader
                  value={item.image_url ?? ""}
                  onChange={(url) => {
                    const updated = [...items];
                    updated[i] = { ...item, image_url: url };
                    onChange(updated);
                  }}
                  folder="products"
                  userId={userId}
                  label={`Upload ${label} image`}
                />
              )}
            </div>
            <button
              onClick={() => onChange(items.filter((_, idx) => idx !== i))}
              className="rounded-lg p-1 text-[var(--muted-foreground)] hover:text-red-500"
            >
              <X size={14} />
            </button>
          </div>
        </div>
      ))}
      <button
        onClick={() =>
          onChange([...items, { name: "", description: "", price: "" }])
        }
        className="flex items-center gap-1.5 text-xs font-medium text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
      >
        <Plus size={12} />
        Add {label}
      </button>
    </div>
  );
}

/** Upload a file to Supabase Storage and return its public URL */
async function uploadToStorage(
  file: File,
  userId: string,
  folder: string
): Promise<string | null> {
  const supabase = createClient();
  const ext = file.name.split(".").pop();
  const path = `${userId}/${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

  const { error } = await supabase.storage
    .from("profile-media")
    .upload(path, file, { upsert: true });

  if (error) {
    console.error("Upload error:", error);
    return null;
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from("profile-media").getPublicUrl(path);

  return publicUrl;
}

/** Reusable image upload component — replaces paste-URL text inputs */
function ImageUploader({
  value,
  onChange,
  folder,
  userId,
  label = "Upload image",
  accept = "image/*",
  className = "",
}: {
  value: string;
  onChange: (url: string) => void;
  folder: string;
  userId: string;
  label?: string;
  accept?: string;
  className?: string;
}) {
  const [uploading, setUploading] = useState(false);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const url = await uploadToStorage(file, userId, folder);
    if (url) onChange(url);
    setUploading(false);
  }

  return (
    <div className={className}>
      {value ? (
        <div className="relative">
          <img
            src={value}
            alt=""
            className="h-24 w-full rounded-lg object-cover"
          />
          <div className="absolute inset-0 flex items-center justify-center gap-2 rounded-lg bg-black/40 opacity-0 transition hover:opacity-100">
            <label className="cursor-pointer rounded-lg bg-white/90 px-2.5 py-1.5 text-[10px] font-medium text-ink-900">
              Change
              <input
                type="file"
                accept={accept}
                onChange={handleFile}
                className="hidden"
              />
            </label>
            <button
              onClick={() => onChange("")}
              className="rounded-lg bg-white/90 px-2.5 py-1.5 text-[10px] font-medium text-red-600"
            >
              Remove
            </button>
          </div>
        </div>
      ) : (
        <label className="flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-lg border-2 border-dashed border-[var(--border)] py-6 transition hover:border-[var(--foreground)]/30 hover:bg-[var(--accent)]">
          {uploading ? (
            <Loader2 size={20} className="animate-spin text-[var(--muted-foreground)]" />
          ) : (
            <>
              <Upload size={20} className="text-[var(--muted-foreground)]" />
              <span className="text-xs text-[var(--muted-foreground)]">
                {label}
              </span>
            </>
          )}
          <input
            type="file"
            accept={accept}
            onChange={handleFile}
            className="hidden"
            disabled={uploading}
          />
        </label>
      )}
    </div>
  );
}

function GalleryEditor({
  gallery,
  onChange,
  userId,
}: {
  gallery: { url: string; category?: string; caption?: string }[];
  onChange: (
    g: { url: string; category?: string; caption?: string }[]
  ) => void;
  userId: string;
}) {
  return (
    <div className="space-y-3">
      {gallery.map((img, i) => (
        <div key={i} className="rounded-xl border border-[var(--border)] p-3">
          <div className="mb-2 flex items-center justify-end">
            <button
              onClick={() => onChange(gallery.filter((_, idx) => idx !== i))}
              className="p-1 text-[var(--muted-foreground)] hover:text-red-500"
            >
              <X size={14} />
            </button>
          </div>
          <ImageUploader
            value={img.url}
            onChange={(url) => {
              const updated = [...gallery];
              updated[i] = { ...img, url };
              onChange(updated);
            }}
            folder="gallery"
            userId={userId}
            label="Upload gallery image"
          />
          <input
            value={img.category ?? ""}
            onChange={(e) => {
              const updated = [...gallery];
              updated[i] = { ...img, category: e.target.value };
              onChange(updated);
            }}
            placeholder="Category (e.g. Work, Events)"
            className="mt-2 w-full rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-xs outline-none"
          />
        </div>
      ))}
      <button
        onClick={() =>
          onChange([...gallery, { url: "", category: "", caption: "" }])
        }
        className="flex items-center gap-1.5 text-xs font-medium text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
      >
        <Plus size={12} />
        Add image
      </button>
    </div>
  );
}

function BankAccountsEditor({
  accounts,
  onChange,
  userId,
}: {
  accounts: {
    bank_name?: string;
    account_holder?: string;
    account_number?: string;
    ifsc?: string;
    upi_id?: string;
    qr_url?: string;
  }[];
  onChange: (
    accs: {
      bank_name?: string;
      account_holder?: string;
      account_number?: string;
      ifsc?: string;
      upi_id?: string;
      qr_url?: string;
    }[]
  ) => void;
  userId: string;
}) {
  return (
    <div className="space-y-4">
      {accounts.map((acc, i) => (
        <div key={i} className="rounded-xl border border-[var(--border)] p-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="font-mono text-[10px] font-semibold uppercase tracking-widest text-[var(--muted-foreground)]">
              Account {i + 1}
            </span>
            <button
              onClick={() =>
                onChange(accounts.filter((_, idx) => idx !== i))
              }
              className="p-1 text-[var(--muted-foreground)] hover:text-red-500"
            >
              <X size={14} />
            </button>
          </div>
          <div className="space-y-2">
            <input
              value={acc.bank_name ?? ""}
              onChange={(e) => {
                const updated = [...accounts];
                updated[i] = { ...acc, bank_name: e.target.value };
                onChange(updated);
              }}
              placeholder="Bank name"
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm outline-none"
            />
            <input
              value={acc.account_holder ?? ""}
              onChange={(e) => {
                const updated = [...accounts];
                updated[i] = { ...acc, account_holder: e.target.value };
                onChange(updated);
              }}
              placeholder="Account holder name"
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm outline-none"
            />
            <input
              value={acc.account_number ?? ""}
              onChange={(e) => {
                const updated = [...accounts];
                updated[i] = { ...acc, account_number: e.target.value };
                onChange(updated);
              }}
              placeholder="Account number"
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm outline-none"
            />
            <input
              value={acc.ifsc ?? ""}
              onChange={(e) => {
                const updated = [...accounts];
                updated[i] = { ...acc, ifsc: e.target.value };
                onChange(updated);
              }}
              placeholder="IFSC code"
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm outline-none"
            />
            <input
              value={acc.upi_id ?? ""}
              onChange={(e) => {
                const updated = [...accounts];
                updated[i] = { ...acc, upi_id: e.target.value };
                onChange(updated);
              }}
              placeholder="UPI ID (e.g. name@upi)"
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm outline-none"
            />
            <p className="text-xs text-[var(--muted-foreground)]">Payment QR Code</p>
            <ImageUploader
              value={acc.qr_url ?? ""}
              onChange={(url) => {
                const updated = [...accounts];
                updated[i] = { ...acc, qr_url: url };
                onChange(updated);
              }}
              folder="qr-codes"
              userId={userId}
              label="Upload QR code image"
            />
          </div>
        </div>
      ))}
      <button
        onClick={() =>
          onChange([
            ...accounts,
            {
              bank_name: "",
              account_holder: "",
              account_number: "",
              ifsc: "",
              upi_id: "",
              qr_url: "",
            },
          ])
        }
        className="flex items-center gap-1.5 text-xs font-medium text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
      >
        <Plus size={12} />
        Add bank account
      </button>
    </div>
  );
}
