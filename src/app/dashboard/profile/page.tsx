"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Profile, Employee, Review } from "@/lib/supabase/types";
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
  Users,
  Clock,
  Award,
  ChevronRight,
  Briefcase,
  Image as ImageIcon,
  Link2,
  X,
  Check,
  Trash2,
} from "lucide-react";

type EditSection =
  | null
  | "basic"
  | "about"
  | "social"
  | "services"
  | "products"
  | "gallery"
  | "employees";

export default function ProfilePage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<EditSection>(null);
  const [saving, setSaving] = useState(false);
  const [cardSlug, setCardSlug] = useState<string | null>(null);

  // Edit form states
  const [editForm, setEditForm] = useState<Partial<Profile>>({});
  const [newEmployee, setNewEmployee] = useState({
    name: "",
    designation: "",
    email: "",
    phone: "",
  });

  const loadProfile = useCallback(async () => {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const [{ data: profileData }, { data: empData }, { data: reviewData }, { data: cardData }] =
      await Promise.all([
        supabase.from("profiles").select("*").eq("id", user.id).single(),
        supabase
          .from("employees")
          .select("*")
          .eq("owner_id", user.id)
          .order("created_at"),
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
    if (empData) setEmployees(empData as unknown as Employee[]);
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

  async function addEmployee() {
    if (!profile || !newEmployee.name || !newEmployee.designation) return;
    setSaving(true);
    const supabase = createClient();

    const slug = newEmployee.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");

    const { error } = await supabase.from("employees").insert({
      owner_id: profile.id,
      name: newEmployee.name,
      designation: newEmployee.designation,
      email: newEmployee.email || null,
      phone: newEmployee.phone || null,
      slug,
    });

    if (!error) {
      setNewEmployee({ name: "", designation: "", email: "", phone: "" });
      loadProfile();
    }
    setSaving(false);
  }

  async function deleteEmployee(id: string) {
    const supabase = createClient();
    await supabase.from("employees").delete().eq("id", id);
    setEmployees(employees.filter((e) => e.id !== id));
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
    <div className="mx-auto max-w-lg px-4 py-5">
      {/* Header Card */}
      <div className="relative overflow-hidden rounded-3xl bg-ink-950 p-6 text-white">
        <div className="pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full bg-white/5 blur-3xl" />

        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            {profile.logo_url ? (
              <img
                src={profile.logo_url}
                alt=""
                className="h-14 w-14 rounded-2xl object-cover ring-1 ring-white/10"
              />
            ) : (
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/10 text-lg font-bold ring-1 ring-white/10">
                {initials(profile.owner_name || profile.business_name)}
              </div>
            )}
            <div>
              <h1 className="text-lg font-semibold">
                {profile.owner_name || "Your Name"}
              </h1>
              <p className="text-xs text-white/60">
                {[profile.job_title, profile.business_name]
                  .filter(Boolean)
                  .join(" · ") || "Add your title"}
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={shareProfile}
              className="rounded-xl bg-white/10 p-2 transition hover:bg-white/20"
            >
              <Share2 size={16} />
            </button>
            <button
              onClick={() => startEdit("basic")}
              className="rounded-xl bg-white/10 p-2 transition hover:bg-white/20"
            >
              <Edit3 size={16} />
            </button>
          </div>
        </div>

        {profileUrl && (
          <div className="mt-4 flex items-center gap-2 rounded-xl bg-white/10 px-3 py-2 text-xs text-white/70">
            <Link2 size={12} />
            <span className="font-mono">{profileUrl}</span>
          </div>
        )}

        {/* Stats */}
        <div className="mt-4 grid grid-cols-3 gap-3">
          {profile.years_in_business && (
            <div className="rounded-xl bg-white/5 px-3 py-2 text-center">
              <p className="text-lg font-bold">{profile.years_in_business}</p>
              <p className="text-[10px] text-white/50">Years</p>
            </div>
          )}
          {profile.clients_served && (
            <div className="rounded-xl bg-white/5 px-3 py-2 text-center">
              <p className="text-lg font-bold">{profile.clients_served}+</p>
              <p className="text-[10px] text-white/50">Clients</p>
            </div>
          )}
          {reviews.length > 0 && (
            <div className="rounded-xl bg-white/5 px-3 py-2 text-center">
              <p className="text-lg font-bold">{avgRating.toFixed(1)}</p>
              <p className="text-[10px] text-white/50">Rating</p>
            </div>
          )}
        </div>
      </div>

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

      {/* Services */}
      <Section
        title="Services"
        icon={<Award size={16} />}
        onEdit={() => startEdit("services")}
      >
        {(profile.services ?? []).length > 0 ? (
          <div className="space-y-2">
            {profile.services.map(
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
                      <p className="text-xs text-ink-400">{s.description}</p>
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
        ) : (
          <p className="text-sm text-ink-400">Showcase your services</p>
        )}
        {profile.website && (profile.services ?? []).length > 0 && (
          <a
            href={profile.website}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 flex items-center gap-1 text-xs font-medium text-ink-950 hover:underline"
          >
            See all services
            <ChevronRight size={12} />
          </a>
        )}
      </Section>

      {/* Products */}
      <Section
        title="Products"
        icon={<ImageIcon size={16} />}
        onEdit={() => startEdit("products")}
      >
        {(profile.products ?? []).length > 0 ? (
          <div className="grid grid-cols-2 gap-2">
            {profile.products.map(
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
        ) : (
          <p className="text-sm text-ink-400">Showcase your products</p>
        )}
        {profile.website && (profile.products ?? []).length > 0 && (
          <a
            href={profile.website}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 flex items-center gap-1 text-xs font-medium text-ink-950 hover:underline"
          >
            See all products
            <ChevronRight size={12} />
          </a>
        )}
      </Section>

      {/* Reviews */}
      <Section title="Reviews" icon={<Star size={16} />}>
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

      {/* Employees */}
      <Section
        title="Team"
        icon={<Users size={16} />}
        onEdit={() => startEdit("employees")}
      >
        {employees.length > 0 ? (
          <div className="space-y-2">
            {employees.map((emp) => (
              <div
                key={emp.id}
                className="flex items-center justify-between rounded-xl bg-ink-50 px-3 py-2.5"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-ink-200 text-xs font-semibold">
                    {initials(emp.name)}
                  </div>
                  <div>
                    <p className="text-sm font-medium">{emp.name}</p>
                    <p className="text-[11px] text-ink-400">
                      {emp.designation}
                    </p>
                  </div>
                </div>
                {profile.username && (
                  <span className="font-mono text-[10px] text-ink-400">
                    /{profile.username}/{emp.slug}
                  </span>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-ink-400">Add team members</p>
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

      {/* Services Edit */}
      {editing === "services" && (
        <EditSheet title="Services" onClose={() => setEditing(null)}>
          <ItemListEditor
            items={(editForm.services ?? []) as { name: string; description?: string; price?: string }[]}
            onChange={(items) =>
              setEditForm({ ...editForm, services: items })
            }
            label="service"
          />
          <SaveButton saving={saving} onClick={saveProfile} />
        </EditSheet>
      )}

      {/* Products Edit */}
      {editing === "products" && (
        <EditSheet title="Products" onClose={() => setEditing(null)}>
          <ItemListEditor
            items={(editForm.products ?? []) as { name: string; description?: string; price?: string }[]}
            onChange={(items) =>
              setEditForm({ ...editForm, products: items })
            }
            label="product"
          />
          <SaveButton saving={saving} onClick={saveProfile} />
        </EditSheet>
      )}

      {/* Employees Edit */}
      {editing === "employees" && (
        <EditSheet title="Manage Team" onClose={() => setEditing(null)}>
          <div className="space-y-3">
            {employees.map((emp) => (
              <div
                key={emp.id}
                className="flex items-center justify-between rounded-xl bg-ink-50 p-3"
              >
                <div>
                  <p className="text-sm font-medium">{emp.name}</p>
                  <p className="text-xs text-ink-400">{emp.designation}</p>
                </div>
                <button
                  onClick={() => deleteEmployee(emp.id)}
                  className="rounded-lg p-1.5 text-ink-400 transition hover:bg-red-50 hover:text-red-500"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
          <div className="mt-4 space-y-2 border-t border-ink-100 pt-4">
            <p className="text-xs font-medium text-ink-500">Add team member</p>
            <InputField
              label="Name"
              value={newEmployee.name}
              onChange={(v) => setNewEmployee({ ...newEmployee, name: v })}
            />
            <InputField
              label="Designation"
              value={newEmployee.designation}
              onChange={(v) =>
                setNewEmployee({ ...newEmployee, designation: v })
              }
            />
            <InputField
              label="Email"
              value={newEmployee.email}
              onChange={(v) => setNewEmployee({ ...newEmployee, email: v })}
            />
            <InputField
              label="Phone"
              value={newEmployee.phone}
              onChange={(v) => setNewEmployee({ ...newEmployee, phone: v })}
            />
            <button
              onClick={addEmployee}
              disabled={saving || !newEmployee.name || !newEmployee.designation}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-ink-950 py-3 text-sm font-medium text-white transition hover:bg-ink-800 disabled:opacity-40"
            >
              <Plus size={14} />
              Add Member
            </button>
          </div>
        </EditSheet>
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
}: {
  title: string;
  icon: React.ReactNode;
  onEdit?: () => void;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-4 rounded-2xl border border-ink-100 bg-white p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <span className="text-ink-400">{icon}</span>
          {title}
        </div>
        {onEdit && (
          <button
            onClick={onEdit}
            className="rounded-lg p-1.5 text-ink-400 transition hover:bg-ink-50 hover:text-ink-700"
          >
            <Edit3 size={14} />
          </button>
        )}
      </div>
      {children}
    </section>
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
      <label className="mb-1 block text-xs font-medium text-ink-500">
        {label}
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
          className={`w-full border border-ink-200 bg-white px-3 py-2.5 text-sm outline-none transition ${
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
        className="w-full resize-none rounded-xl border border-ink-200 bg-white px-3 py-2.5 text-sm outline-none transition"
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
}: {
  items: { name: string; description?: string; price?: string }[];
  onChange: (
    items: { name: string; description?: string; price?: string }[]
  ) => void;
  label: string;
}) {
  return (
    <div className="space-y-3">
      {items.map((item, i) => (
        <div key={i} className="rounded-xl border border-ink-200 p-3">
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
          onChange([...items, { name: "", description: "", price: "" }])
        }
        className="flex items-center gap-1.5 text-xs font-medium text-ink-500 hover:text-ink-700"
      >
        <Plus size={12} />
        Add {label}
      </button>
    </div>
  );
}
