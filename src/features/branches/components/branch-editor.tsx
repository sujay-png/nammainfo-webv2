"use client";

import { useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { Camera, Check, Link2, Loader2, RotateCcw, Star, X } from "lucide-react";
import type { Profile, ServiceItem } from "@/supabase/database-types";
import { COVER_IMAGE, SQUARE_PHOTO_IMAGE, ImageProcessError } from "@/lib/images/process-image";
import { deleteProfileImage, uploadProfileImage } from "@/lib/images/profile-media";
import { formatIndianMobile, PHONE_ERROR } from "@/lib/phone";
import { initials } from "@/lib/utils";
import { emptyDraft, isValidSlug, toSlug, type Branch, type BranchDraft } from "../types";
import { createBranch, updateBranch } from "../services/branches.service";
import { displayLink, branchPath } from "../lib/paths";
import BranchItemsEditor from "./branch-items-editor";

const CropModal = dynamic(() => import("@/components/ui/image-crop-modal"), { ssr: false });

const inputCls =
  "w-full rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 py-2.5 text-sm outline-none transition focus:border-[var(--foreground)] placeholder:text-[var(--muted-foreground)]/70";

/** Only images this editor uploaded to profile-media/<id>/branches/ are ever deleted. */
const ownUpload = (url: string | null | undefined) => !!url && url.includes("/profile-media/") && url.includes("/branches/");

/**
 * Add / edit a branch. Every field except the name and link is optional:
 * an empty field shows the main profile's value, which appears as the
 * placeholder so the owner sees what visitors will get.
 */
export default function BranchEditor({
  profile,
  branch,
  takenSlugs,
  nextSortOrder,
  onSaved,
  onClose,
}: {
  profile: Profile;
  branch: Branch | null;
  /** Links already used in this business: other branches and team members. */
  takenSlugs: string[];
  nextSortOrder: number;
  onSaved: (b: Branch) => void;
  onClose: () => void;
}) {
  const [d, setD] = useState<BranchDraft>(() => {
    if (!branch) return emptyDraft(nextSortOrder);
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { id, owner_id, created_at, updated_at, ...rest } = branch;
    return rest;
  });
  const [slugTouched, setSlugTouched] = useState(Boolean(branch));
  const [crop, setCrop] = useState<{ src: string; field: "cover_url" | "logo_url" } | null>(null);
  const [uploading, setUploading] = useState<string | null>(null);
  const [itemsBusy, setItemsBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reviewInput, setReviewInput] = useState("");
  const [reviewBusy, setReviewBusy] = useState(false);
  const [reviewError, setReviewError] = useState<string | null>(null);
  const uploadedNow = useRef<Set<string>>(new Set());

  const handle = profile.username ?? "your-link";
  const taken = useMemo(() => new Set(takenSlugs.map((s) => s.toLowerCase())), [takenSlugs]);
  const slugProblem = !d.slug
    ? null
    : !isValidSlug(d.slug)
      ? "Use 2–40 small letters, numbers and dashes."
      : taken.has(d.slug)
        ? "Already used by another branch or a team member."
        : null;

  const set = <K extends keyof BranchDraft>(k: K, v: BranchDraft[K]) => setD((prev) => ({ ...prev, [k]: v }));

  function setName(name: string) {
    setD((prev) => ({ ...prev, name, slug: slugTouched ? prev.slug : toSlug(name) }));
  }

  function pickPhoto(file: File, field: "cover_url" | "logo_url") {
    if (file.size > 15 * 1024 * 1024) {
      setError("That photo is too large. Please pick one under 15 MB.");
      return;
    }
    setCrop({ src: URL.createObjectURL(file), field });
  }

  async function onCropped(blob: Blob) {
    if (!crop) return;
    const { field, src } = crop;
    URL.revokeObjectURL(src);
    setCrop(null);
    setUploading(field);
    setError(null);
    try {
      const file = new File([blob], "photo.jpg", { type: blob.type || "image/jpeg" });
      const url = await uploadProfileImage(
        profile.id,
        "branches",
        file,
        field === "cover_url" ? COVER_IMAGE : SQUARE_PHOTO_IMAGE
      );
      const old = d[field];
      if (old && uploadedNow.current.has(old)) {
        uploadedNow.current.delete(old);
        deleteProfileImage(old);
      }
      uploadedNow.current.add(url);
      set(field, url);
    } catch (e) {
      setError(e instanceof ImageProcessError || e instanceof Error ? e.message : "Couldn't add that photo.");
    } finally {
      setUploading(null);
    }
  }

  async function connectReviewLink() {
    const url = reviewInput.trim();
    if (!url) return;
    setReviewBusy(true);
    setReviewError(null);
    try {
      const res = await fetch("/api/places", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const data = await res.json();
      const value = res.ok ? data.review_url || data.place_id || data.google_maps_url : null;
      if (!value) {
        setReviewError(data?.error || "Couldn't read that link. Try the share link from this branch's Google listing.");
      } else {
        set("google_place_id", value);
        setReviewInput("");
      }
    } catch {
      setReviewError("Network error. Please try again.");
    } finally {
      setReviewBusy(false);
    }
  }

  function cleanItems(list: ServiceItem[] | null): ServiceItem[] | null {
    if (!Array.isArray(list)) return null;
    return list
      .filter((it) => it.name?.trim())
      .map((it) => ({
        name: it.name.trim().slice(0, 80),
        ...(it.description?.trim() ? { description: it.description.trim().slice(0, 400) } : {}),
        ...(it.price?.trim() ? { price: it.price.trim().slice(0, 40) } : {}),
        ...(it.category?.trim() ? { category: it.category.trim().slice(0, 40) } : {}),
        ...(it.image_url ? { image_url: it.image_url } : {}),
      }));
  }

  async function save() {
    setError(null);
    if (!d.name.trim()) return setError("Give this branch a name, e.g. the city or area.");
    if (!d.slug || slugProblem) return setError(slugProblem ?? "Pick a link for this branch.");

    let phone = d.phone;
    let whatsapp = d.whatsapp;
    if (phone?.trim()) {
      phone = formatIndianMobile(phone) ?? (/^\+?[0-9 ()-]{6,20}$/.test(phone.trim()) ? phone.trim() : null);
      if (!phone) return setError(`Phone: ${PHONE_ERROR}`);
    }
    if (whatsapp?.trim()) {
      whatsapp = formatIndianMobile(whatsapp);
      if (!whatsapp) return setError(`WhatsApp: ${PHONE_ERROR}`);
    }
    if (d.email?.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.email.trim())) {
      return setError("Check the email address.");
    }

    const draft: BranchDraft = {
      ...d,
      phone,
      whatsapp,
      services: cleanItems(d.services),
      products: cleanItems(d.products),
    };

    setSaving(true);
    const res = branch ? await updateBranch(branch.id, draft) : await createBranch(profile.id, draft);
    setSaving(false);
    if (!res.ok) return setError(res.error);

    // Tidy up photos this branch no longer uses.
    for (const f of ["cover_url", "logo_url"] as const) {
      const before = branch?.[f];
      if (before && before !== res.data[f] && ownUpload(before)) deleteProfileImage(before);
    }
    uploadedNow.current.forEach((u) => u !== res.data.cover_url && u !== res.data.logo_url && deleteProfileImage(u));
    uploadedNow.current.clear();
    onSaved(res.data);
  }

  function cancel() {
    uploadedNow.current.forEach((u) => deleteProfileImage(u));
    uploadedNow.current.clear();
    onClose();
  }

  const coverShown = d.cover_url || profile.cover_url;
  const logoShown = d.logo_url || profile.logo_url;
  const busy = saving || uploading !== null || itemsBusy;

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center">
      <div className="absolute inset-0 bg-ink-950/40 backdrop-blur-sheet" onClick={cancel} />
      <div className="animate-slide-up relative flex max-h-[92dvh] w-full max-w-lg flex-col rounded-t-3xl bg-[var(--card)] shadow-card-lg sm:rounded-3xl">
        <div className="flex items-center justify-between border-b border-[var(--border)] px-5 py-4">
          <div>
            <h2 className="font-headline text-lg font-semibold">{branch ? "Edit branch" : "Add a branch"}</h2>
            <p className="text-[11px] text-[var(--muted-foreground)]">
              Leave a field empty to use your main profile&apos;s details.
            </p>
          </div>
          <button onClick={cancel} className="rounded-full bg-[var(--accent)] p-1.5" aria-label="Close">
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 space-y-6 overflow-y-auto px-5 py-5">
          {/* Basics */}
          <Section title="Branch">
            <Labeled label="Branch name" required>
              <input
                value={d.name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Mangaluru"
                maxLength={80}
                className={inputCls}
                autoFocus={!branch}
              />
            </Labeled>
            <Labeled label="Branch link" required>
              <div
                className={`flex items-center overflow-hidden rounded-xl border bg-[var(--card)] ${slugProblem ? "border-red-400" : "border-[var(--border)] focus-within:border-[var(--foreground)]"}`}
              >
                <span className="whitespace-nowrap border-r border-[var(--border)] bg-[var(--accent)] px-2.5 py-2.5 font-mono text-[11px] text-[var(--muted-foreground)]">
                  /{handle}/
                </span>
                <input
                  value={d.slug}
                  onChange={(e) => {
                    setSlugTouched(true);
                    set("slug", e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 40));
                  }}
                  onBlur={() => set("slug", toSlug(d.slug))}
                  placeholder="mangaluru"
                  autoCapitalize="none"
                  className="w-full bg-transparent px-2.5 py-2.5 font-mono text-sm outline-none"
                />
              </div>
              <p className={`mt-1 text-[11px] ${slugProblem ? "text-red-500" : "text-[var(--muted-foreground)]"}`}>
                {slugProblem ??
                  (d.slug
                    ? `${displayLink(branchPath(handle, d.slug))}${branch && branch.slug !== d.slug ? " · the old link will stop working" : ""}`
                    : "Small letters, numbers and dashes.")}
              </p>
            </Labeled>
          </Section>

          {/* Photos */}
          <Section title="Photos" hint="Cover 1920 × 1080 px (16:9) · Photo square, 400 × 400 px+">
            <div className="relative">
              <label className="relative block h-32 w-full cursor-pointer overflow-hidden rounded-2xl bg-[var(--foreground)]">
                {coverShown && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={coverShown}
                    alt=""
                    className={`h-full w-full object-cover ${d.cover_url ? "" : "opacity-40"}`}
                  />
                )}
                <span className="absolute bottom-2 right-2 flex items-center gap-1 rounded-full bg-black/60 px-2.5 py-1 text-[11px] font-medium text-white">
                  {uploading === "cover_url" ? <Loader2 size={12} className="animate-spin" /> : <Camera size={12} />}
                  {d.cover_url ? "Change cover" : "Add branch cover"}
                </span>
                {!d.cover_url && profile.cover_url && (
                  <span className="absolute left-2 top-2 rounded-full bg-black/60 px-2 py-0.5 text-[10px] text-white">
                    Using main cover
                  </span>
                )}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  disabled={uploading !== null}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) pickPhoto(f, "cover_url");
                    e.target.value = "";
                  }}
                />
              </label>
              <div className="absolute -bottom-6 left-4">
                <label className="relative block h-16 w-16 cursor-pointer overflow-hidden rounded-xl border-4 border-[var(--card)] bg-[var(--accent)] shadow-card">
                  {logoShown ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={logoShown} alt="" className={`h-full w-full object-cover ${d.logo_url ? "" : "opacity-40"}`} />
                  ) : (
                    <span className="flex h-full w-full items-center justify-center font-headline text-sm font-bold">
                      {initials(profile.business_name || profile.owner_name)}
                    </span>
                  )}
                  <span className="absolute inset-x-0 bottom-0 flex justify-center bg-black/55 py-0.5 text-white">
                    {uploading === "logo_url" ? <Loader2 size={10} className="animate-spin" /> : <Camera size={10} />}
                  </span>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    disabled={uploading !== null}
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) pickPhoto(f, "logo_url");
                      e.target.value = "";
                    }}
                  />
                </label>
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-1 text-[11px]">
              {d.cover_url && (
                <button type="button" onClick={() => set("cover_url", null)} className="flex items-center gap-1 text-[var(--muted-foreground)] hover:text-[var(--foreground)]">
                  <RotateCcw size={11} /> Main cover
                </button>
              )}
              {d.logo_url && (
                <button type="button" onClick={() => set("logo_url", null)} className="flex items-center gap-1 text-[var(--muted-foreground)] hover:text-[var(--foreground)]">
                  <RotateCcw size={11} /> Main photo
                </button>
              )}
            </div>
          </Section>

          {/* Contact */}
          <Section title="Contact">
            <div className="grid grid-cols-2 gap-3">
              <Labeled label="Contact person">
                <input
                  value={d.contact_person ?? ""}
                  onChange={(e) => set("contact_person", e.target.value)}
                  placeholder={profile.owner_name ?? "Name"}
                  maxLength={80}
                  className={inputCls}
                />
              </Labeled>
              <Labeled label="Their title">
                <input
                  value={d.contact_title ?? ""}
                  onChange={(e) => set("contact_title", e.target.value)}
                  placeholder={d.contact_person ? "Branch Manager" : profile.job_title ?? "Title"}
                  maxLength={60}
                  className={inputCls}
                />
              </Labeled>
            </div>
            <Labeled label="Phone">
              <input
                type="tel"
                inputMode="tel"
                value={d.phone ?? ""}
                onChange={(e) => set("phone", e.target.value)}
                placeholder={profile.phone ?? "+91 98765 43210"}
                className={inputCls}
              />
            </Labeled>
            <Labeled label="WhatsApp">
              <input
                type="tel"
                inputMode="tel"
                value={d.whatsapp ?? ""}
                onChange={(e) => set("whatsapp", e.target.value)}
                placeholder="Same as main profile"
                className={inputCls}
              />
            </Labeled>
            <Labeled label="Email">
              <input
                type="email"
                value={d.email ?? ""}
                onChange={(e) => set("email", e.target.value)}
                placeholder={profile.email ?? "branch@example.com"}
                className={inputCls}
              />
            </Labeled>
          </Section>

          {/* Location */}
          <Section title="Location & directions" hint="Fill these in and “Get Directions” goes to this branch.">
            <Labeled label="Address">
              <textarea
                value={d.address ?? ""}
                onChange={(e) => set("address", e.target.value)}
                placeholder={profile.address ?? "Door no., street, area"}
                rows={2}
                maxLength={300}
                className={`${inputCls} resize-none`}
              />
            </Labeled>
            <div className="grid grid-cols-2 gap-3">
              <Labeled label="City">
                <input
                  value={d.city ?? ""}
                  onChange={(e) => set("city", e.target.value)}
                  placeholder={profile.city ?? "City"}
                  maxLength={60}
                  className={inputCls}
                />
              </Labeled>
              <Labeled label="Pincode">
                <input
                  inputMode="numeric"
                  value={d.pincode ?? ""}
                  onChange={(e) => set("pincode", e.target.value.replace(/[^0-9]/g, "").slice(0, 6))}
                  placeholder={profile.pincode ?? "575001"}
                  className={inputCls}
                />
              </Labeled>
            </div>
            <Labeled label="Google Maps link">
              <input
                value={d.maps_url ?? ""}
                onChange={(e) => set("maps_url", e.target.value)}
                placeholder="https://maps.app.goo.gl/…"
                inputMode="url"
                autoCapitalize="none"
                className={inputCls}
              />
            </Labeled>

            <Labeled label="Google reviews for this branch">
              {d.google_place_id ? (
                <div className="flex items-center justify-between rounded-xl border border-[var(--border)] bg-[var(--accent)] px-3 py-2.5">
                  <span className="flex items-center gap-1.5 text-xs font-medium">
                    <Star size={13} className="fill-amber-400 text-amber-400" /> Branch review link connected
                  </span>
                  <button type="button" onClick={() => set("google_place_id", null)} className="text-[11px] text-[var(--muted-foreground)] hover:text-red-500">
                    Remove
                  </button>
                </div>
              ) : (
                <>
                  <div className="flex gap-2">
                    <input
                      value={reviewInput}
                      onChange={(e) => setReviewInput(e.target.value)}
                      placeholder="Paste this branch's Google review or Maps link"
                      inputMode="url"
                      autoCapitalize="none"
                      className={inputCls}
                    />
                    <button
                      type="button"
                      onClick={connectReviewLink}
                      disabled={!reviewInput.trim() || reviewBusy}
                      className="flex shrink-0 items-center gap-1 rounded-xl bg-[var(--foreground)] px-3 text-xs font-semibold text-[var(--background)] disabled:opacity-40"
                    >
                      {reviewBusy ? <Loader2 size={13} className="animate-spin" /> : <Link2 size={13} />} Connect
                    </button>
                  </div>
                  <p className="mt-1 text-[11px] text-[var(--muted-foreground)]">
                    {reviewError ?? (profile.google_place_id ? "Empty: reviews go to your main Google listing." : "Optional.")}
                  </p>
                </>
              )}
            </Labeled>
          </Section>

          <Section title="Services">
            <BranchItemsEditor
              kind="services"
              ownerId={profile.id}
              mainItems={(profile.services ?? []) as ServiceItem[]}
              value={d.services}
              onChange={(v) => set("services", v)}
              onUploadingChange={setItemsBusy}
            />
          </Section>

          <Section title="Products">
            <BranchItemsEditor
              kind="products"
              ownerId={profile.id}
              mainItems={(profile.products ?? []) as ServiceItem[]}
              value={d.products}
              onChange={(v) => set("products", v)}
              onUploadingChange={setItemsBusy}
            />
          </Section>

          <label className="flex items-center justify-between rounded-xl border border-[var(--border)] px-3.5 py-3">
            <span>
              <span className="block text-sm font-semibold">Show this branch</span>
              <span className="block text-[11px] text-[var(--muted-foreground)]">
                Hidden branches don&apos;t appear on your card and their link stops working.
              </span>
            </span>
            <input
              type="checkbox"
              checked={d.is_active}
              onChange={(e) => set("is_active", e.target.checked)}
              className="h-5 w-5 accent-[var(--foreground)]"
            />
          </label>
        </div>

        <div className="border-t border-[var(--border)] px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3">
          {error && <p className="mb-2 text-xs text-red-500">{error}</p>}
          <button
            onClick={save}
            disabled={busy || !d.name.trim() || !d.slug || Boolean(slugProblem)}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--foreground)] py-3 text-sm font-semibold text-[var(--background)] transition hover:opacity-80 disabled:opacity-40"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
            {saving ? "Saving…" : branch ? "Save branch" : "Add branch"}
          </button>
        </div>
      </div>

      {crop && (
        <CropModal
          imageSrc={crop.src}
          aspect={crop.field === "cover_url" ? 16 / 9 : 1}
          title={crop.field === "cover_url" ? "Branch cover" : "Branch photo"}
          outputSize={crop.field === "cover_url" ? { width: 1920, height: 1080 } : { width: 400, height: 400 }}
          onCancel={() => {
            URL.revokeObjectURL(crop.src);
            setCrop(null);
          }}
          onConfirm={onCropped}
        />
      )}
    </div>
  );
}

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <div>
        <h3 className="font-mono text-[10px] font-semibold uppercase tracking-widest text-[var(--muted-foreground)]">{title}</h3>
        {hint && <p className="mt-0.5 text-[11px] text-[var(--muted-foreground)]">{hint}</p>}
      </div>
      {children}
    </section>
  );
}

function Labeled({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-[var(--foreground)]">
        {label}
        {required && <span className="text-red-500"> *</span>}
      </label>
      {children}
    </div>
  );
}
