"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Profile, Review } from "@/lib/supabase/types";
import { initials } from "@/lib/utils";
import dynamic from "next/dynamic";

const CropModal = dynamic(() => import("@/components/CropModal"), {
  ssr: false,
});
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
  ChevronRight,
  Briefcase,
  Image as ImageIcon,
  Link2,
  X,
  Check,
  Trash2,
  Camera,
  Loader2,
  Banknote,
  Download,
  FileText,
  Upload,
  ChevronDown,
} from "lucide-react";

type EditSection =
  | null
  | "basic"
  | "about"
  | "social"
  | "services"
  | "gallery"
  | "banking"
  | "brochure";

export default function ProfilePage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<EditSection>(null);
  const [saving, setSaving] = useState(false);
  const [cardSlug, setCardSlug] = useState<string | null>(null);

  // Edit form states
  const [editForm, setEditForm] = useState<Partial<Profile>>({});
  const [galleryUploading, setGalleryUploading] = useState(false);
  const [brochureUploading, setBrochureUploading] = useState(false);

  // Google Maps link state
  const [mapsLinkInput, setMapsLinkInput] = useState("");
  const [mapsLinkError, setMapsLinkError] = useState("");
  const [mapsLinkLoading, setMapsLinkLoading] = useState(false);
  const [showGoogleSetup, setShowGoogleSetup] = useState(false);

  async function resolveAndSaveGoogleLink(url: string) {
    if (!profile) return;
    const trimmed = url.trim();
    if (!trimmed) return;

    // Quick validation — must look like a Google Maps URL, Place ID, or Google Business review link
    const isPlaceId = /^ChIJ[A-Za-z0-9_-]+$/.test(trimmed);
    const isGoogleUrl =
      trimmed.includes("google.com/maps") ||
      trimmed.includes("maps.app.goo.gl") ||
      trimmed.includes("goo.gl/maps") ||
      trimmed.includes("maps.google.com") ||
      trimmed.includes("g.page") ||
      trimmed.includes("search.google.com/local/writereview");

    if (!isPlaceId && !isGoogleUrl) {
      setMapsLinkError("Please paste a Google Maps link or Google Business review link");
      return;
    }

    setMapsLinkLoading(true);
    setMapsLinkError("");

    try {
      const res = await fetch("/api/places", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: trimmed }),
      });
      const data = await res.json();

      if (!res.ok) {
        setMapsLinkError(data.error || "Could not process this link");
        setMapsLinkLoading(false);
        return;
      }

      // Prefer review_url (opens review dialog directly), then place_id, then maps URL
      const valueToStore = data.review_url || data.place_id || data.google_maps_url;
      if (!valueToStore) {
        setMapsLinkError("Could not process this link — try a different one");
        setMapsLinkLoading(false);
        return;
      }

      const supabase = createClient();
      await supabase
        .from("profiles")
        .update({ google_place_id: valueToStore } as Record<string, unknown>)
        .eq("id", profile.id);

      setProfile({ ...profile, google_place_id: valueToStore });
      setMapsLinkInput("");
      setMapsLinkError("");
      setShowGoogleSetup(false);
    } catch {
      setMapsLinkError("Network error — please try again");
    }
    setMapsLinkLoading(false);
  }

  // Crop modal state
  const [cropImage, setCropImage] = useState<{
    src: string;
    field: "logo_url" | "cover_url";
  } | null>(null);

  const loadProfile = useCallback(async () => {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const [{ data: profileData }, { data: reviewData }, { data: cardData }] =
      await Promise.all([
        supabase.from("profiles").select("*").eq("id", user.id).single(),
        supabase
          .from("reviews")
          .select("*")
          .eq("profile_id", user.id)
          .order("created_at", { ascending: false }),
        supabase
          .from("cards")
          .select("public_slug")
          .eq("profile_id", user.id)
          .maybeSingle(),
      ]);

    if (profileData) setProfile(profileData as unknown as Profile);
    if (reviewData) setReviews(reviewData as unknown as Review[]);
    if (cardData)
      setCardSlug((cardData as { public_slug: string }).public_slug);
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
        brochure_url: editForm.brochure_url ?? null,
        google_place_id: editForm.google_place_id ?? null,
        gst_number: editForm.gst_number ?? null,
      } as Record<string, unknown>)
      .eq("id", profile.id);

    if (!error) {
      setProfile({ ...profile, ...editForm } as Profile);
      setEditing(null);
    }
    setSaving(false);
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
      alert("Link copied!");
    }
  }

  async function uploadImage(
    fileOrBlob: File | Blob,
    field: "logo_url" | "cover_url"
  ) {
    if (!profile) return;
    const supabase = createClient();
    const ext =
      fileOrBlob instanceof File
        ? fileOrBlob.name.split(".").pop()
        : "jpg";
    const path = `${profile.id}/${field}-${Date.now()}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from("avatars")
      .upload(path, fileOrBlob, {
        upsert: true,
        contentType: fileOrBlob.type || "image/jpeg",
      });

    if (uploadError) return;

    const {
      data: { publicUrl },
    } = supabase.storage.from("avatars").getPublicUrl(path);

    await supabase
      .from("profiles")
      .update({ [field]: publicUrl } as Record<string, unknown>)
      .eq("id", profile.id);

    setProfile({ ...profile, [field]: publicUrl } as Profile);
  }


  function handleImageSelect(
    file: File,
    field: "logo_url" | "cover_url"
  ) {
    const MAX_SIZE = 5 * 1024 * 1024; // 5 MB
    if (file.size > MAX_SIZE) {
      alert("Image must be under 5 MB");
      return;
    }
    const objectUrl = URL.createObjectURL(file);
    setCropImage({ src: objectUrl, field });
  }

  async function handleCropConfirm(blob: Blob) {
    if (!cropImage) return;
    URL.revokeObjectURL(cropImage.src);
    const { field } = cropImage;
    setCropImage(null);
    await uploadImage(blob, field);
  }

  function handleCropCancel() {
    if (cropImage) URL.revokeObjectURL(cropImage.src);
    setCropImage(null);
  }

  // Gallery upload category state
  const [galleryUploadCategory, setGalleryUploadCategory] = useState("");

  async function uploadGalleryImage(file: File) {
    if (!profile) return;
    const MAX_SIZE = 5 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      alert("Image must be under 5 MB");
      return;
    }
    setGalleryUploading(true);
    const supabase = createClient();
    const ext = file.name.split(".").pop();
    const path = `${profile.id}/gallery-${Date.now()}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from("profile-media")
      .upload(path, file, { upsert: true, contentType: file.type || "image/jpeg" });

    if (!uploadError) {
      const { data: { publicUrl } } = supabase.storage.from("profile-media").getPublicUrl(path);
      const updatedGallery = [...(profile.gallery ?? []), { url: publicUrl, caption: "", category: galleryUploadCategory.trim() || "" }];
      await supabase
        .from("profiles")
        .update({ gallery: updatedGallery } as Record<string, unknown>)
        .eq("id", profile.id);
      setProfile({ ...profile, gallery: updatedGallery } as Profile);
    }
    setGalleryUploading(false);
  }

  async function updateGalleryItem(index: number, field: "caption" | "category", value: string) {
    if (!profile) return;
    const supabase = createClient();
    const updatedGallery = [...(profile.gallery ?? [])];
    updatedGallery[index] = { ...updatedGallery[index], [field]: value };
    await supabase
      .from("profiles")
      .update({ gallery: updatedGallery } as Record<string, unknown>)
      .eq("id", profile.id);
    setProfile({ ...profile, gallery: updatedGallery } as Profile);
  }

  async function removeGalleryImage(index: number) {
    if (!profile) return;
    const supabase = createClient();
    const updatedGallery = (profile.gallery ?? []).filter((_, i) => i !== index);
    await supabase
      .from("profiles")
      .update({ gallery: updatedGallery } as Record<string, unknown>)
      .eq("id", profile.id);
    setProfile({ ...profile, gallery: updatedGallery } as Profile);
  }

  async function uploadBrochure(file: File) {
    if (!profile) return;
    const MAX_SIZE = 10 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      alert("File must be under 10 MB");
      return;
    }
    setBrochureUploading(true);
    const supabase = createClient();
    const ext = file.name.split(".").pop();
    const path = `${profile.id}/brochure-${Date.now()}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from("profile-media")
      .upload(path, file, { upsert: true, contentType: file.type });

    if (!uploadError) {
      const { data: { publicUrl } } = supabase.storage.from("profile-media").getPublicUrl(path);
      await supabase
        .from("profiles")
        .update({ brochure_url: publicUrl } as Record<string, unknown>)
        .eq("id", profile.id);
      setProfile({ ...profile, brochure_url: publicUrl } as Profile);
    }
    setBrochureUploading(false);
  }

  async function removeBrochure() {
    if (!profile) return;
    const supabase = createClient();
    await supabase
      .from("profiles")
      .update({ brochure_url: null } as Record<string, unknown>)
      .eq("id", profile.id);
    setProfile({ ...profile, brochure_url: null } as Profile);
  }

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

  const avgRating =
    reviews.length > 0
      ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
      : 0;

  return (
    <div className="mx-auto max-w-lg pb-8">
      {/* ===== COVER PHOTO + AVATAR ===== */}
      <div className="relative">
        {/* Cover */}
        <div className="relative h-44 w-full overflow-hidden bg-ink-950">
          {profile.cover_url ? (
            <img
              src={profile.cover_url}
              alt=""
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-ink-950">
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
                if (f) handleImageSelect(f, "cover_url");
                e.target.value = "";
              }}
            />
          </label>
          <span className="absolute bottom-2 right-3 rounded-full bg-ink-950/50 px-2 py-0.5 text-[9px] text-white/70 backdrop-blur-sm">
            Max 5 MB · JPG, PNG
          </span>
        </div>

        {/* Logo overlapping cover */}
        <div className="absolute -bottom-12 left-5">
          <div className="relative">
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
            <label className="absolute -bottom-1 -right-1 cursor-pointer rounded-full bg-ink-950 p-1.5 text-white shadow-md transition hover:opacity-80">
              <Camera size={12} />
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleImageSelect(f, "logo_url");
                  e.target.value = "";
                }}
              />
            </label>
          </div>
          <p className="mt-1 text-[9px] text-ink-400">Max 5 MB</p>
        </div>
      </div>

      {/* Name + actions (below avatar) */}
      <div className="mt-14 px-5">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-xl font-bold">
              {profile.owner_name || "Your Name"}
            </h1>
            <p className="text-sm text-ink-500">
              {[profile.job_title, profile.business_name]
                .filter(Boolean)
                .join(" · ") || "Add your title"}
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={shareProfile}
              className="rounded-xl border border-ink-200 p-2 transition hover:bg-ink-50"
            >
              <Share2 size={16} />
            </button>
            <button
              onClick={() => startEdit("basic")}
              className="rounded-xl border border-ink-200 p-2 transition hover:bg-ink-50"
            >
              <Edit3 size={16} />
            </button>
          </div>
        </div>

        {profileUrl && (
          <div className="mt-2 flex items-center gap-2 text-xs text-ink-400">
            <Link2 size={12} />
            <span className="font-mono">{profileUrl}</span>
          </div>
        )}

        {/* Stats */}
        {(profile.years_in_business || profile.clients_served || reviews.length > 0) && (
          <div className="mt-4 grid grid-cols-3 gap-3">
            {profile.years_in_business && (
              <div className="rounded-xl bg-ink-50 px-3 py-2 text-center">
                <p className="text-lg font-bold">{profile.years_in_business}</p>
                <p className="text-[10px] text-ink-500">Years</p>
              </div>
            )}
            {profile.clients_served && (
              <div className="rounded-xl bg-ink-50 px-3 py-2 text-center">
                <p className="text-lg font-bold">{profile.clients_served}+</p>
                <p className="text-[10px] text-ink-500">Clients</p>
              </div>
            )}
            {reviews.length > 0 && (
              <div className="rounded-xl bg-ink-50 px-3 py-2 text-center">
                <p className="text-lg font-bold">{avgRating.toFixed(1)}</p>
                <p className="text-[10px] text-ink-500">Rating</p>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="px-4 mt-6">

      {/* Quick actions */}
      <div className="mt-4 grid grid-cols-4 gap-2">
        {profile.phone && (
          <a
            href={`tel:${profile.phone}`}
            className="flex flex-col items-center gap-1 rounded-2xl border border-ink-100 bg-white p-3 transition hover:shadow-card"
          >
            <Phone size={18} className="text-ink-700" />
            <span className="text-[10px] font-medium text-ink-500">Call</span>
          </a>
        )}
        {profile.email && (
          <a
            href={`mailto:${profile.email}`}
            className="flex flex-col items-center gap-1 rounded-2xl border border-ink-100 bg-white p-3 transition hover:shadow-card"
          >
            <Mail size={18} className="text-ink-700" />
            <span className="text-[10px] font-medium text-ink-500">Email</span>
          </a>
        )}
        {profile.website && (
          <a
            href={profile.website}
            target="_blank"
            rel="noopener noreferrer"
            className="flex flex-col items-center gap-1 rounded-2xl border border-ink-100 bg-white p-3 transition hover:shadow-card"
          >
            <Globe size={18} className="text-ink-700" />
            <span className="text-[10px] font-medium text-ink-500">Web</span>
          </a>
        )}
        <button
          onClick={shareProfile}
          className="flex flex-col items-center gap-1 rounded-2xl border border-ink-100 bg-white p-3 transition hover:shadow-card"
        >
          <QrCode size={18} className="text-ink-700" />
          <span className="text-[10px] font-medium text-ink-500">QR</span>
        </button>
      </div>

      {/* About */}
      <Section
        title="About"
        icon={<Briefcase size={16} />}
        onEdit={() => startEdit("about")}
      >
        {profile.bio ? (
          <p className="text-sm leading-relaxed text-ink-600">{profile.bio}</p>
        ) : (
          <p className="text-sm text-ink-400">Add a description about your business</p>
        )}
        {profile.address && (
          <div className="mt-3 flex items-start gap-2">
            <MapPin size={14} className="mt-0.5 shrink-0 text-ink-400" />
            <span className="text-sm text-ink-500">{profile.address}</span>
          </div>
        )}
        {profile.coverage_area && (
          <div className="mt-2 flex items-start gap-2">
            <Globe size={14} className="mt-0.5 shrink-0 text-ink-400" />
            <span className="text-sm text-ink-500">
              Serves: {profile.coverage_area}
            </span>
          </div>
        )}
      </Section>

      {/* Social Links */}
      <Section
        title="Social"
        icon={<Link2 size={16} />}
        onEdit={() => startEdit("social")}
      >
        {(profile.social_links ?? []).length > 0 ? (
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
        ) : (
          <p className="text-sm text-ink-400">Add your social media links</p>
        )}
      </Section>

      {/* Services & Products */}
      <Section
        title="Services & Products"
        icon={<Award size={16} />}
        onEdit={() => startEdit("services")}
      >
        {/* Services sub-section */}
        {(profile.services ?? []).length > 0 && (
          <SubSection title="Services" count={profile.services.length}>
            <div className="space-y-1.5">
              {(() => {
                const svcs = profile.services as { name: string; description?: string; price?: string; category?: string; image_url?: string }[];
                const grouped = svcs.reduce<Record<string, typeof svcs>>((acc, s) => {
                  const cat = s.category?.trim() || "Uncategorized";
                  (acc[cat] ??= []).push(s);
                  return acc;
                }, {});
                const cats = Object.keys(grouped);
                const hasCategories = cats.length > 1 || cats[0] !== "Uncategorized";
                return hasCategories ? (
                  cats.map((cat) => (
                    <div key={cat}>
                      <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-ink-400">{cat}</p>
                      <div className="space-y-1.5">
                        {grouped[cat].map((s, i) => (
                          <div key={i} className="flex items-center gap-2 rounded-xl bg-ink-50 px-3 py-2">
                            {s.image_url && <img src={s.image_url} alt={s.name} className="h-10 w-10 shrink-0 rounded-lg object-cover" />}
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-medium">{s.name}</p>
                              {s.description && <p className="text-[11px] text-ink-400">{s.description}</p>}
                            </div>
                            {s.price && <span className="shrink-0 text-xs font-semibold text-ink-600">{s.price}</span>}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))
                ) : (
                  svcs.map((s, i) => (
                    <div key={i} className="flex items-center gap-2 rounded-xl bg-ink-50 px-3 py-2.5">
                      {s.image_url && <img src={s.image_url} alt={s.name} className="h-10 w-10 shrink-0 rounded-lg object-cover" />}
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium">{s.name}</p>
                        {s.description && <p className="text-[11px] text-ink-400">{s.description}</p>}
                      </div>
                      {s.price && <span className="shrink-0 text-xs font-semibold text-ink-600">{s.price}</span>}
                    </div>
                  ))
                );
              })()}
            </div>
          </SubSection>
        )}

        {/* Products sub-section */}
        {(profile.products ?? []).length > 0 && (
          <SubSection title="Products" count={profile.products.length}>
            <div className="grid grid-cols-2 gap-2">
              {profile.products.map(
                (
                  p: { name: string; description?: string; price?: string; image_url?: string },
                  i: number
                ) => (
                  <div key={i} className="overflow-hidden rounded-xl border border-ink-100">
                    {p.image_url && (
                      <img src={p.image_url} alt={p.name} className="aspect-square w-full object-cover" />
                    )}
                    <div className="p-2.5">
                      <p className="text-xs font-medium">{p.name}</p>
                      {p.price && (
                        <p className="mt-0.5 text-[11px] font-semibold text-ink-500">{p.price}</p>
                      )}
                    </div>
                  </div>
                )
              )}
            </div>
          </SubSection>
        )}

        {(profile.services ?? []).length === 0 && (profile.products ?? []).length === 0 && (
          <p className="text-sm text-ink-400">Showcase your services & products</p>
        )}
      </Section>

      {/* Gallery */}
      <Section
        title="Gallery"
        icon={<ImageIcon size={16} />}
        onEdit={() => startEdit("gallery")}
      >
        {(profile.gallery ?? []).length > 0 ? (
          <div className="grid grid-cols-3 gap-1.5">
            {profile.gallery.slice(0, 6).map((img: { url: string; caption?: string }, i: number) => (
              <div key={i} className="aspect-square overflow-hidden rounded-lg">
                <img src={img.url} alt={img.caption ?? ""} className="h-full w-full object-cover" />
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-ink-400">Add photos to your gallery</p>
        )}
        {(profile.gallery ?? []).length > 6 && (
          <p className="mt-2 text-xs text-ink-400">
            +{profile.gallery.length - 6} more photos
          </p>
        )}
      </Section>

      {/* Reviews & Google Maps */}
      <Section title="Reviews" icon={<Star size={16} />}>
        {/* Google Maps connection */}
        {profile.google_place_id ? (
          <div className="mb-3 flex items-center justify-between rounded-xl bg-green-50 px-3 py-2.5">
            <div className="flex items-center gap-2">
              <MapPin size={14} className="text-green-600" />
              <span className="text-xs font-medium text-green-800">
                Google Maps linked
              </span>
            </div>
            <div className="flex items-center gap-2">
              <a
                href={
                  profile.google_place_id.startsWith("http")
                    ? profile.google_place_id
                    : `https://www.google.com/maps/place/?q=place_id:${profile.google_place_id}`
                }
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-[10px] font-medium text-blue-600 hover:text-blue-800"
              >
                <ExternalLink size={10} />
                {profile.google_place_id.includes("review") || profile.google_place_id.includes("writereview")
                  ? "Test review link"
                  : "View on Maps"}
              </a>
              <button
                type="button"
                onClick={async () => {
                  const supabase = createClient();
                  await supabase.from("profiles").update({ google_place_id: null } as Record<string, unknown>).eq("id", profile.id);
                  setProfile({ ...profile, google_place_id: null });
                }}
                className="text-[10px] font-medium text-red-500 hover:text-red-700"
              >
                Remove
              </button>
            </div>
          </div>
        ) : (
          <div className="mb-3 rounded-xl border border-dashed border-ink-200 p-3">
            {!showGoogleSetup ? (
              <button
                type="button"
                onClick={() => setShowGoogleSetup(true)}
                className="flex w-full items-center gap-2 text-left"
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-ink-100">
                  <MapPin size={14} className="text-ink-500" />
                </div>
                <div className="flex-1">
                  <p className="text-xs font-semibold text-ink-700">Link Google Reviews</p>
                  <p className="text-[10px] text-ink-400">
                    Enable direct Google Reviews on your profile
                  </p>
                </div>
                <ChevronRight size={14} className="text-ink-300" />
              </button>
            ) : (
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <label className="text-xs font-semibold text-ink-700">
                    Paste Google Review Link
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setShowGoogleSetup(false);
                      setMapsLinkInput("");
                      setMapsLinkError("");
                    }}
                    className="rounded p-0.5 text-ink-400 hover:bg-ink-100 hover:text-ink-600"
                  >
                    <X size={12} />
                  </button>
                </div>

                <div className="flex gap-2">
                  <input
                    value={mapsLinkInput}
                    onChange={(e) => {
                      setMapsLinkInput(e.target.value);
                      setMapsLinkError("");
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        resolveAndSaveGoogleLink(mapsLinkInput);
                      }
                    }}
                    onPaste={(e) => {
                      const text = e.clipboardData.getData("text").trim();
                      if (text) {
                        e.preventDefault();
                        setMapsLinkInput(text);
                        resolveAndSaveGoogleLink(text);
                      }
                    }}
                    placeholder="https://g.page/r/.../review or Maps link"
                    className="flex-1 rounded-lg border border-ink-200 bg-white px-3 py-2 text-xs outline-none focus:border-ink-400"
                  />
                  <button
                    type="button"
                    onClick={() => resolveAndSaveGoogleLink(mapsLinkInput)}
                    disabled={mapsLinkLoading || !mapsLinkInput.trim()}
                    className="flex items-center gap-1 rounded-lg bg-ink-900 px-3 py-2 text-[11px] font-medium text-white transition hover:bg-ink-800 disabled:opacity-50"
                  >
                    {mapsLinkLoading ? (
                      <Loader2 size={12} className="animate-spin" />
                    ) : (
                      <Link2 size={12} />
                    )}
                    Link
                  </button>
                </div>

                <p className="mt-1.5 text-[10px] text-ink-400">
                  <strong>Best:</strong> Google Business Profile → Get more reviews → Copy link<br />
                  Or: Google Maps → find your business → Share → Copy link
                </p>

                {mapsLinkError && (
                  <p className="mt-1.5 text-xs text-red-500">{mapsLinkError}</p>
                )}
              </div>
            )}
          </div>
        )}

        {/* Reviews list */}
        {reviews.length > 0 ? (
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <span className="text-3xl font-bold">{avgRating.toFixed(1)}</span>
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
            {reviews.slice(0, 3).map((r) => (
              <div key={r.id} className="rounded-xl bg-ink-50 p-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold">{r.reviewer_name}</span>
                  <div className="flex gap-0.5">
                    {[1, 2, 3, 4, 5].map((s) => (
                      <Star
                        key={s}
                        size={10}
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
          </div>
        ) : (
          <p className="text-sm text-ink-400">No reviews yet</p>
        )}
      </Section>

      {/* Banking & Payment Info */}
      <Section
        title="Banking & Payments"
        icon={<Banknote size={16} />}
        onEdit={() => startEdit("banking")}
      >
        {(profile.bank_accounts ?? []).length > 0 ? (
          <div className="space-y-2">
            {profile.bank_accounts.map(
              (acc: { bank_name?: string; account_holder?: string; account_number?: string; ifsc?: string; upi_id?: string }, i: number) => (
                <div key={i} className="rounded-xl bg-ink-50 px-3 py-2.5">
                  <p className="text-sm font-medium">{acc.bank_name || "Bank Account"}</p>
                  {acc.upi_id && (
                    <p className="text-xs text-ink-400">UPI: {acc.upi_id}</p>
                  )}
                  {acc.account_number && (
                    <p className="text-xs text-ink-400">A/C: {acc.account_number}</p>
                  )}
                </div>
              )
            )}
          </div>
        ) : (
          <p className="text-sm text-ink-400">Add your banking details for customers</p>
        )}
      </Section>

      {/* Brochure / Downloads */}
      <Section
        title="Brochure"
        icon={<FileText size={16} />}
        onEdit={() => startEdit("brochure")}
      >
        {profile.brochure_url ? (
          <div className="flex items-center gap-3 rounded-xl bg-ink-50 px-3 py-2.5">
            <Download size={16} className="text-ink-500" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">Brochure uploaded</p>
              <p className="truncate text-xs text-ink-400">{profile.brochure_url.split("/").pop()}</p>
            </div>
          </div>
        ) : (
          <p className="text-sm text-ink-400">Upload a brochure for your business</p>
        )}
      </Section>

      {/* ============= EDIT SHEETS ============= */}

      {/* Basic Info Edit */}
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
            label="Username (vanity URL)"
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
          />
          <SaveButton saving={saving} onClick={saveProfile} />
        </EditSheet>
      )}

      {/* About Edit */}
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
            label="Google Maps Link"
            value={editForm.google_place_id ?? ""}
            onChange={(v) => setEditForm({ ...editForm, google_place_id: v || null })}
            placeholder="Paste your Google Maps link here"
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
          <SaveButton saving={saving} onClick={saveProfile} />
        </EditSheet>
      )}

      {/* Social Links Edit */}
      {editing === "social" && (
        <EditSheet title="Social Links" onClose={() => setEditing(null)}>
          <SocialLinksEditor
            links={editForm.social_links ?? []}
            onChange={(links) => setEditForm({ ...editForm, social_links: links })}
          />
          <SaveButton saving={saving} onClick={saveProfile} />
        </EditSheet>
      )}

      {/* Services & Products Edit */}
      {editing === "services" && (
        <EditSheet title="Services & Products" onClose={() => setEditing(null)}>
          <div className="space-y-4">
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-ink-500">Services</p>
              <ItemListEditor
                items={(editForm.services ?? []) as { name: string; description?: string; price?: string; category?: string; image_url?: string }[]}
                onChange={(items) =>
                  setEditForm({ ...editForm, services: items })
                }
                label="service"
                showCategory
                showImage
                profileId={profile.id}
              />
            </div>
            <div className="h-px bg-ink-100" />
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-ink-500">Products</p>
              <ItemListEditor
                items={(editForm.products ?? []) as { name: string; description?: string; price?: string; category?: string; image_url?: string }[]}
                onChange={(items) =>
                  setEditForm({ ...editForm, products: items })
                }
                label="product"
                showCategory
                showImage
                profileId={profile.id}
              />
            </div>
          </div>
          <SaveButton saving={saving} onClick={saveProfile} />
        </EditSheet>
      )}

      {/* Gallery Edit */}
      {editing === "gallery" && (
        <EditSheet title="Manage Gallery" onClose={() => setEditing(null)}>
          <div className="space-y-3">
            {(profile.gallery ?? []).length > 0 && (
              <div className="space-y-3">
                {(() => {
                  const imgs = profile.gallery as { url: string; caption?: string; category?: string }[];
                  const galleryCats = Array.from(new Set(imgs.map(g => g.category?.trim()).filter(Boolean)));
                  return (
                    <>
                      <datalist id="gallery-cat-options">
                        {galleryCats.map((cat) => (
                          <option key={cat} value={cat!} />
                        ))}
                      </datalist>
                      {imgs.map((img, i) => (
                        <div key={i} className="flex gap-3 rounded-xl border border-ink-200 p-2">
                          <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-lg">
                            <img src={img.url} alt={img.caption ?? ""} className="h-full w-full object-cover" />
                            <button
                              onClick={() => removeGalleryImage(i)}
                              className="absolute right-0.5 top-0.5 rounded-full bg-ink-950/60 p-0.5 text-white transition hover:bg-red-600"
                            >
                              <X size={10} />
                            </button>
                          </div>
                          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                            <input
                              list="gallery-cat-options"
                              value={img.category ?? ""}
                              onChange={(e) => updateGalleryItem(i, "category", e.target.value)}
                              placeholder="Folder / Category"
                              className="w-full rounded-lg border border-ink-200 bg-white px-2 py-1.5 text-xs outline-none focus:border-ink-400"
                            />
                            <input
                              value={img.caption ?? ""}
                              onChange={(e) => updateGalleryItem(i, "caption", e.target.value)}
                              placeholder="Caption (optional)"
                              className="w-full rounded-lg border border-ink-200 bg-white px-2 py-1.5 text-xs outline-none focus:border-ink-400"
                            />
                          </div>
                        </div>
                      ))}
                    </>
                  );
                })()}
              </div>
            )}
            {/* Upload area with category selector */}
            <div className="rounded-xl border border-ink-200 p-3 space-y-2">
              <input
                list="gallery-cat-options"
                value={galleryUploadCategory}
                onChange={(e) => setGalleryUploadCategory(e.target.value)}
                placeholder="Category for new uploads (optional)"
                className="w-full rounded-lg border border-ink-200 bg-white px-2 py-1.5 text-xs outline-none focus:border-ink-400"
              />
              <label className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed border-ink-200 p-5 text-center transition hover:border-ink-400 hover:bg-ink-50">
                {galleryUploading ? (
                  <Loader2 size={20} className="animate-spin text-ink-400" />
                ) : (
                  <Upload size={20} className="text-ink-400" />
                )}
                <span className="text-xs font-medium text-ink-500">
                  {galleryUploading ? "Uploading…" : "Tap to add photos"}
                </span>
                <span className="text-[10px] text-ink-400">Max 5 MB · JPG, PNG</span>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  disabled={galleryUploading}
                  onChange={async (e) => {
                    const files = Array.from(e.target.files ?? []);
                    for (const f of files) {
                      await uploadGalleryImage(f);
                    }
                    e.target.value = "";
                  }}
                />
              </label>
            </div>
          </div>
        </EditSheet>
      )}

      {/* Banking Edit */}
      {editing === "banking" && (
        <EditSheet title="Banking & Payments" onClose={() => setEditing(null)}>
          <BankAccountsEditor
            accounts={(editForm.bank_accounts ?? []) as { bank_name?: string; account_holder?: string; account_number?: string; ifsc?: string; upi_id?: string; qr_url?: string }[]}
            onChange={(accounts) => setEditForm({ ...editForm, bank_accounts: accounts } as Partial<Profile>)}
            profileId={profile.id}
          />
          <SaveButton saving={saving} onClick={saveProfile} />
        </EditSheet>
      )}

      {/* Brochure Edit */}
      {editing === "brochure" && (
        <EditSheet title="Brochure" onClose={() => setEditing(null)}>
          <div className="space-y-3">
            {profile.brochure_url ? (
              <div className="flex items-center gap-3 rounded-xl border border-ink-100 p-3">
                <FileText size={20} className="shrink-0 text-ink-500" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">Brochure uploaded</p>
                  <p className="truncate text-xs text-ink-400">{profile.brochure_url.split("/").pop()}</p>
                </div>
                <button
                  onClick={removeBrochure}
                  className="rounded-lg p-1.5 text-ink-400 transition hover:bg-red-50 hover:text-red-500"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ) : (
              <p className="text-sm text-ink-400">No brochure uploaded yet</p>
            )}
            <label className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed border-ink-200 p-6 text-center transition hover:border-ink-400 hover:bg-ink-50">
              {brochureUploading ? (
                <Loader2 size={20} className="animate-spin text-ink-400" />
              ) : (
                <Upload size={20} className="text-ink-400" />
              )}
              <span className="text-xs font-medium text-ink-500">
                {brochureUploading ? "Uploading…" : "Upload brochure"}
              </span>
              <span className="text-[10px] text-ink-400">PDF, JPG, PNG · Max 10 MB</span>
              <input
                type="file"
                accept=".pdf,image/*"
                className="hidden"
                disabled={brochureUploading}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) uploadBrochure(f);
                  e.target.value = "";
                }}
              />
            </label>
          </div>
        </EditSheet>
      )}
      </div>{/* end px-4 mt-6 wrapper */}

      {/* Image Crop Modal */}
      {cropImage && (
        <CropModal
          imageSrc={cropImage.src}
          aspect={cropImage.field === "cover_url" ? 16 / 9 : 1}
          title={cropImage.field === "cover_url" ? "Crop Cover Photo" : "Crop Logo"}
          outputSize={
            cropImage.field === "cover_url"
              ? { width: 1200, height: 675 }
              : { width: 400, height: 400 }
          }
          onCancel={handleCropCancel}
          onConfirm={handleCropConfirm}
        />
      )}
    </div>
  );
}

/* ================================================================== */
/*  Reusable sub-components                                            */
/* ================================================================== */

function Section({
  title,
  icon,
  onEdit,
  children,
  defaultOpen = false,
}: {
  title: string;
  icon: React.ReactNode;
  onEdit?: () => void;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="mt-4 overflow-hidden rounded-2xl border border-ink-100 bg-white">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between p-4"
      >
        <div className="flex items-center gap-2 text-sm font-semibold">
          <span className="text-ink-400">{icon}</span>
          {title}
        </div>
        <div className="flex items-center gap-1">
          {onEdit && (
            <span
              role="button"
              onClick={(e) => { e.stopPropagation(); onEdit(); }}
              className="rounded-lg p-1.5 text-ink-400 transition hover:bg-ink-50 hover:text-ink-700"
            >
              <Edit3 size={14} />
            </span>
          )}
          <ChevronDown
            size={16}
            className={`text-ink-400 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
          />
        </div>
      </button>
      <div
        className={`grid transition-all duration-200 ${open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}
      >
        <div className="overflow-hidden">
          <div className="px-4 pb-4">{children}</div>
        </div>
      </div>
    </section>
  );
}

function SubSection({
  title,
  count,
  children,
}: {
  title: string;
  count: number;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mt-2">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between rounded-xl bg-ink-50 px-3 py-2.5"
      >
        <span className="text-xs font-semibold text-ink-700">
          {title}
          <span className="ml-1.5 text-ink-400">({count})</span>
        </span>
        <ChevronDown
          size={14}
          className={`text-ink-400 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        />
      </button>
      <div
        className={`grid transition-all duration-200 ${open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}
      >
        <div className="overflow-hidden">
          <div className="pt-2">{children}</div>
        </div>
      </div>
    </div>
  );
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
      <div className="animate-slide-up relative max-h-[85dvh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-white p-5 shadow-card-lg sm:rounded-3xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button
            onClick={onClose}
            className="rounded-full bg-ink-100 p-1.5 transition hover:bg-ink-200"
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
  required,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
  prefix?: string;
  required?: boolean;
}) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-ink-500">
        {label}
        {required && <span className="ml-0.5 text-red-400">*</span>}
      </label>
      <div className="flex">
        {prefix && (
          <span className="flex items-center rounded-l-xl border border-r-0 border-ink-200 bg-ink-50 px-3 text-xs text-ink-400">
            {prefix}
          </span>
        )}
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={`w-full border border-ink-200 bg-white px-3 py-2.5 text-sm text-ink-900 outline-none transition ${
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
      <label className="mb-1 block text-xs font-medium text-ink-500">
        {label}
      </label>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={rows}
        className="w-full resize-none rounded-xl border border-ink-200 bg-white px-3 py-2.5 text-sm text-ink-900 outline-none transition"
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
      className="flex w-full items-center justify-center gap-2 rounded-xl bg-ink-950 py-3 text-sm font-medium text-white transition hover:bg-ink-800 disabled:opacity-40"
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
    "Instagram",
    "LinkedIn",
    "Twitter",
    "Facebook",
    "YouTube",
    "WhatsApp",
    "Telegram",
    "GitHub",
  ];

  return (
    <div className="space-y-3">
      {links.map((link, i) => (
        <div key={i} className="flex gap-2">
          <select
            value={link.platform}
            onChange={(e) => {
              const updated = [...links];
              updated[i] = { ...link, platform: e.target.value };
              onChange(updated);
            }}
            className="w-32 rounded-xl border border-ink-200 bg-white px-2 py-2.5 text-xs"
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
              updated[i] = { ...link, url: e.target.value };
              onChange(updated);
            }}
            placeholder="https://..."
            className="flex-1 rounded-xl border border-ink-200 bg-white px-3 py-2.5 text-xs"
          />
          <button
            onClick={() => onChange(links.filter((_, idx) => idx !== i))}
            className="rounded-xl p-2.5 text-ink-400 hover:bg-red-50 hover:text-red-500"
          >
            <X size={14} />
          </button>
        </div>
      ))}
      <button
        onClick={() =>
          onChange([...links, { platform: "Instagram", url: "" }])
        }
        className="flex items-center gap-1.5 text-xs font-medium text-ink-500 hover:text-ink-700"
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
  showCategory = false,
  showImage = false,
  profileId,
}: {
  items: { name: string; description?: string; price?: string; category?: string; image_url?: string }[];
  onChange: (
    items: { name: string; description?: string; price?: string; category?: string; image_url?: string }[]
  ) => void;
  label: string;
  showCategory?: boolean;
  showImage?: boolean;
  profileId?: string;
}) {
  const [uploadingIndex, setUploadingIndex] = useState<number | null>(null);

  async function handleImageUpload(index: number, file: File) {
    if (!profileId) return;
    const MAX_SIZE = 5 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      alert("Image must be under 5 MB");
      return;
    }
    setUploadingIndex(index);
    const supabase = createClient();
    const ext = file.name.split(".").pop();
    const path = `${profileId}/${label}-${Date.now()}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from("profile-media")
      .upload(path, file, { upsert: true, contentType: file.type || "image/jpeg" });

    if (!uploadError) {
      const { data: { publicUrl } } = supabase.storage.from("profile-media").getPublicUrl(path);
      const updated = [...items];
      updated[index] = { ...items[index], image_url: publicUrl };
      onChange(updated);
    }
    setUploadingIndex(null);
  }

  return (
    <div className="space-y-3">
      {items.map((item, i) => (
        <div key={i} className="rounded-xl border border-ink-200 p-3">
          <div className="flex items-start justify-between">
            <div className="flex-1 space-y-2">
              {showImage && (
                <div className="flex items-center gap-2">
                  {item.image_url ? (
                    <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg">
                      <img src={item.image_url} alt={item.name} className="h-full w-full object-cover" />
                      <button
                        onClick={() => {
                          const updated = [...items];
                          updated[i] = { ...item, image_url: "" };
                          onChange(updated);
                        }}
                        className="absolute right-0.5 top-0.5 rounded-full bg-ink-950/60 p-0.5 text-white hover:bg-red-600"
                      >
                        <X size={8} />
                      </button>
                    </div>
                  ) : (
                    <label className="flex h-16 w-16 shrink-0 cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-ink-200 transition hover:border-ink-400">
                      {uploadingIndex === i ? (
                        <Loader2 size={14} className="animate-spin text-ink-400" />
                      ) : (
                        <Camera size={14} className="text-ink-300" />
                      )}
                      <span className="text-[8px] text-ink-300">Image</span>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        disabled={uploadingIndex === i}
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) handleImageUpload(i, f);
                          e.target.value = "";
                        }}
                      />
                    </label>
                  )}
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
                </div>
              )}
              {!showImage && (
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
              )}
              <input
                value={item.description ?? ""}
                onChange={(e) => {
                  const updated = [...items];
                  updated[i] = { ...item, description: e.target.value };
                  onChange(updated);
                }}
                placeholder="Description"
                className="w-full border-none bg-transparent text-xs text-ink-500 outline-none"
              />
              <input
                value={item.price ?? ""}
                onChange={(e) => {
                  const updated = [...items];
                  updated[i] = { ...item, price: e.target.value };
                  onChange(updated);
                }}
                placeholder="Price (optional)"
                className="w-full border-none bg-transparent text-xs text-ink-500 outline-none"
              />
              {showCategory && (
                <>
                  <input
                    list={`category-options-${label}`}
                    value={item.category ?? ""}
                    onChange={(e) => {
                      const updated = [...items];
                      updated[i] = { ...item, category: e.target.value };
                      onChange(updated);
                    }}
                    placeholder={label === "product" ? "Collection / Category (e.g. Electronics, Clothing)" : "Department / Category (e.g. IT, Media)"}
                    className="w-full rounded-lg border border-ink-200 bg-transparent px-2 py-1.5 text-xs text-ink-500 outline-none focus:border-ink-400"
                  />
                  <datalist id={`category-options-${label}`}>
                    {Array.from(new Set(items.map((it) => it.category?.trim()).filter(Boolean))).map((cat) => (
                      <option key={cat} value={cat!} />
                    ))}
                  </datalist>
                </>
              )}
            </div>
            <button
              onClick={() => onChange(items.filter((_, idx) => idx !== i))}
              className="rounded-lg p-1 text-ink-400 hover:text-red-500"
            >
              <X size={14} />
            </button>
          </div>
        </div>
      ))}
      <button
        onClick={() =>
          onChange([...items, { name: "", description: "", price: "", ...(showCategory ? { category: "" } : {}), ...(showImage ? { image_url: "" } : {}) }])
        }
        className="flex items-center gap-1.5 text-xs font-medium text-ink-500 hover:text-ink-700"
      >
        <Plus size={12} />
        Add {label}
      </button>
    </div>
  );
}

function BankAccountsEditor({
  accounts,
  onChange,
  profileId,
}: {
  accounts: { bank_name?: string; account_holder?: string; account_number?: string; ifsc?: string; upi_id?: string; qr_url?: string }[];
  onChange: (accounts: { bank_name?: string; account_holder?: string; account_number?: string; ifsc?: string; upi_id?: string; qr_url?: string }[]) => void;
  profileId: string;
}) {
  const [qrUploading, setQrUploading] = useState<number | null>(null);

  async function uploadQr(file: File, index: number) {
    const MAX_SIZE = 5 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      alert("QR image must be under 5 MB");
      return;
    }
    setQrUploading(index);
    const supabase = createClient();
    const ext = file.name.split(".").pop();
    const path = `${profileId}/qr-${index}-${Date.now()}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from("profile-media")
      .upload(path, file, { upsert: true, contentType: file.type });

    if (!uploadError) {
      const { data: { publicUrl } } = supabase.storage.from("profile-media").getPublicUrl(path);
      const updated = [...accounts];
      updated[index] = { ...accounts[index], qr_url: publicUrl };
      onChange(updated);
    }
    setQrUploading(null);
  }

  function removeQr(index: number) {
    const updated = [...accounts];
    updated[index] = { ...accounts[index], qr_url: undefined };
    onChange(updated);
  }

  return (
    <div className="space-y-3">
      {accounts.map((acc, i) => (
        <div key={i} className="rounded-xl border border-ink-200 p-3">
          <div className="flex items-start justify-between">
            <div className="flex-1 space-y-2">
              <input
                value={acc.bank_name ?? ""}
                onChange={(e) => {
                  const updated = [...accounts];
                  updated[i] = { ...acc, bank_name: e.target.value };
                  onChange(updated);
                }}
                placeholder="Bank Name"
                className="w-full border-none bg-transparent text-sm font-medium outline-none"
              />
              <input
                value={acc.account_holder ?? ""}
                onChange={(e) => {
                  const updated = [...accounts];
                  updated[i] = { ...acc, account_holder: e.target.value };
                  onChange(updated);
                }}
                placeholder="Account Holder Name"
                className="w-full border-none bg-transparent text-xs text-ink-500 outline-none"
              />
              <input
                value={acc.account_number ?? ""}
                onChange={(e) => {
                  const updated = [...accounts];
                  updated[i] = { ...acc, account_number: e.target.value };
                  onChange(updated);
                }}
                placeholder="Account Number"
                className="w-full border-none bg-transparent text-xs text-ink-500 outline-none"
              />
              <input
                value={acc.ifsc ?? ""}
                onChange={(e) => {
                  const updated = [...accounts];
                  updated[i] = { ...acc, ifsc: e.target.value };
                  onChange(updated);
                }}
                placeholder="IFSC Code"
                className="w-full border-none bg-transparent text-xs text-ink-500 outline-none"
              />
              <input
                value={acc.upi_id ?? ""}
                onChange={(e) => {
                  const updated = [...accounts];
                  updated[i] = { ...acc, upi_id: e.target.value };
                  onChange(updated);
                }}
                placeholder="UPI ID (e.g. name@upi)"
                className="w-full border-none bg-transparent text-xs text-ink-500 outline-none"
              />

              {/* QR Code Upload */}
              <div className="pt-1">
                {acc.qr_url ? (
                  <div className="flex items-center gap-3 rounded-lg border border-ink-100 p-2">
                    <img
                      src={acc.qr_url}
                      alt="Payment QR"
                      className="h-16 w-16 rounded-lg object-contain"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium text-ink-600">Payment QR</p>
                    </div>
                    <button
                      onClick={() => removeQr(i)}
                      className="rounded-lg p-1.5 text-ink-400 transition hover:bg-red-50 hover:text-red-500"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ) : (
                  <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-ink-200 p-2.5 transition hover:border-ink-400 hover:bg-ink-50">
                    {qrUploading === i ? (
                      <Loader2 size={16} className="animate-spin text-ink-400" />
                    ) : (
                      <QrCode size={16} className="text-ink-400" />
                    )}
                    <span className="text-xs font-medium text-ink-500">
                      {qrUploading === i ? "Uploading…" : "Upload Payment QR"}
                    </span>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      disabled={qrUploading === i}
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) uploadQr(f, i);
                        e.target.value = "";
                      }}
                    />
                  </label>
                )}
              </div>
            </div>
            <button
              onClick={() => onChange(accounts.filter((_, idx) => idx !== i))}
              className="rounded-lg p-1 text-ink-400 hover:text-red-500"
            >
              <X size={14} />
            </button>
          </div>
        </div>
      ))}
      <button
        onClick={() =>
          onChange([...accounts, { bank_name: "", account_holder: "", account_number: "", ifsc: "", upi_id: "", qr_url: "" }])
        }
        className="flex items-center gap-1.5 text-xs font-medium text-ink-500 hover:text-ink-700"
      >
        <Plus size={12} />
        Add bank account
      </button>
    </div>
  );
}
