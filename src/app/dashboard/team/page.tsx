"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { getCurrentUser } from "@/lib/supabase/current-user";
import type { Profile, Employee } from "@/lib/supabase/types";
import { initials } from "@/lib/utils";
import dynamic from "next/dynamic";

const CropModal = dynamic(() => import("@/components/CropModal"), {
  ssr: false,
});
import {
  Plus,
  Trash2,
  X,
  Check,
  Users,
  ArrowLeft,
  Copy,
  Mail,
  Phone,
  Edit3,
  Camera,
  Loader2,
  AlertTriangle,
} from "lucide-react";
import Link from "next/link";

export default function TeamPage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingEmp, setEditingEmp] = useState<Employee | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<Employee | null>(null);
  const [newEmp, setNewEmp] = useState({
    name: "",
    designation: "",
    email: "",
    phone: "",
  });

  // Crop modal state
  const [cropImage, setCropImage] = useState<{
    src: string;
    empId: string;
    field: "avatar_url" | "cover_url";
  } | null>(null);
  const [photoUploading, setPhotoUploading] = useState<string | null>(null);

  const load = useCallback(async () => {
    const supabase = createClient();
    const user = await getCurrentUser();
    if (!user) return;

    const [{ data: p }, { data: emps }] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", user.id).single(),
      supabase
        .from("employees")
        .select("*")
        .eq("owner_id", user.id)
        .order("created_at"),
    ]);

    if (p) setProfile(p as unknown as Profile);
    if (emps) setEmployees(emps as unknown as Employee[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function addEmployee() {
    if (!profile || !newEmp.name || !newEmp.designation) return;
    setSaving(true);
    const supabase = createClient();

    const slug = newEmp.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");

    const { error } = await supabase.from("employees").insert({
      owner_id: profile.id,
      name: newEmp.name,
      designation: newEmp.designation,
      email: newEmp.email || null,
      phone: newEmp.phone || null,
      slug,
    });

    if (!error) {
      setNewEmp({ name: "", designation: "", email: "", phone: "" });
      setShowAdd(false);
      load();
    }
    setSaving(false);
  }

  async function updateEmployee() {
    if (!editingEmp) return;
    setSaving(true);
    const supabase = createClient();

    const slug = editingEmp.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");

    const { error } = await supabase
      .from("employees")
      .update({
        name: editingEmp.name,
        designation: editingEmp.designation,
        email: editingEmp.email || null,
        phone: editingEmp.phone || null,
        slug,
      })
      .eq("id", editingEmp.id);

    if (!error) {
      setEditingEmp(null);
      load();
    }
    setSaving(false);
  }

  async function deleteEmployee(id: string) {
    const supabase = createClient();
    await supabase.from("employees").delete().eq("id", id);
    setEmployees(employees.filter((e) => e.id !== id));
    setDeleteConfirm(null);
  }

  function handlePhotoSelect(
    file: File,
    empId: string,
    field: "avatar_url" | "cover_url"
  ) {
    const MAX_SIZE = 5 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      alert("Image must be under 5 MB");
      return;
    }
    const objectUrl = URL.createObjectURL(file);
    setCropImage({ src: objectUrl, empId, field });
  }

  async function handleCropConfirm(blob: Blob) {
    if (!cropImage) return;
    URL.revokeObjectURL(cropImage.src);
    const { empId, field } = cropImage;
    setCropImage(null);
    await uploadEmployeePhoto(empId, field, blob);
  }

  function handleCropCancel() {
    if (cropImage) URL.revokeObjectURL(cropImage.src);
    setCropImage(null);
  }

  async function uploadEmployeePhoto(
    empId: string,
    field: "avatar_url" | "cover_url",
    fileOrBlob: File | Blob
  ) {
    if (!profile) return;
    setPhotoUploading(`${empId}-${field}`);
    const supabase = createClient();
    const ext =
      fileOrBlob instanceof File
        ? fileOrBlob.name.split(".").pop()
        : "jpg";
    // Use profile.id (owner's auth ID) as prefix — required by storage RLS policy
    const path = `${profile.id}/emp-${empId}-${field}-${Date.now()}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from("avatars")
      .upload(path, fileOrBlob, {
        upsert: true,
        contentType: fileOrBlob.type || "image/jpeg",
      });

    if (uploadError) {
      alert(`Upload failed: ${uploadError.message}`);
      setPhotoUploading(null);
      return;
    }

    const {
      data: { publicUrl },
    } = supabase.storage.from("avatars").getPublicUrl(path);

    await supabase
      .from("employees")
      .update({ [field]: publicUrl })
      .eq("id", empId);

    setEmployees((prev) =>
      prev.map((e) =>
        e.id === empId ? { ...e, [field]: publicUrl } : e
      )
    );
    setPhotoUploading(null);
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-lg px-4 py-5">
        <div className="space-y-3">
          <div className="skeleton h-14 rounded-2xl" />
          <div className="skeleton h-20 rounded-2xl" />
          <div className="skeleton h-20 rounded-2xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-5">
      {/* Header */}
      <div className="mb-5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard/settings"
            className="rounded-xl border border-[var(--border)] p-2 transition hover:bg-[var(--accent)]"
          >
            <ArrowLeft size={16} />
          </Link>
          <h1 className="font-headline text-xl font-semibold">
            Team / Employees
          </h1>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-1.5 rounded-xl bg-[var(--foreground)] px-3 py-2 text-xs font-semibold text-[var(--background)] transition hover:opacity-80"
        >
          <Plus size={14} />
          Add
        </button>
      </div>

      <p className="mb-4 text-sm text-[var(--muted-foreground)]">
        Employees get their own digital card with their name and designation.
        When someone scans their NFC or QR, it opens their profile.
      </p>

      {/* Employee list */}
      {employees.length > 0 ? (
        <div className="space-y-3">
          {employees.map((emp) => (
            <div
              key={emp.id}
              className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--card)]"
            >
              {/* Cover photo */}
              <div className="relative h-24 w-full bg-[var(--accent)]">
                {emp.cover_url ? (
                  <img
                    src={emp.cover_url}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center">
                    <Camera size={20} className="text-[var(--muted-foreground)] opacity-30" />
                  </div>
                )}
                <label className="absolute right-2 top-2 cursor-pointer rounded-full bg-black/40 p-1.5 text-white backdrop-blur-sm transition hover:bg-black/60">
                  {photoUploading === `${emp.id}-cover_url` ? (
                    <Loader2 size={12} className="animate-spin" />
                  ) : (
                    <Camera size={12} />
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    disabled={photoUploading === `${emp.id}-cover_url`}
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) handlePhotoSelect(f, emp.id, "cover_url");
                      e.target.value = "";
                    }}
                  />
                </label>
              </div>

              <div className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {/* Avatar */}
                    <div className="relative">
                      <div className="h-12 w-12 overflow-hidden rounded-xl bg-[var(--accent)]">
                        {emp.avatar_url ? (
                          <img
                            src={emp.avatar_url}
                            alt=""
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center font-headline text-sm font-bold">
                            {initials(emp.name)}
                          </div>
                        )}
                      </div>
                      <label className="absolute -bottom-1 -right-1 cursor-pointer rounded-full bg-[var(--foreground)] p-1 text-[var(--background)] shadow-md transition hover:opacity-80">
                        {photoUploading === `${emp.id}-avatar_url` ? (
                          <Loader2 size={8} className="animate-spin" />
                        ) : (
                          <Camera size={8} />
                        )}
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          disabled={photoUploading === `${emp.id}-avatar_url`}
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            if (f) handlePhotoSelect(f, emp.id, "avatar_url");
                            e.target.value = "";
                          }}
                        />
                      </label>
                    </div>

                    <div>
                      <p className="text-sm font-semibold">{emp.name}</p>
                      <p className="font-mono text-[10px] text-[var(--muted-foreground)]">
                        {emp.designation}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setEditingEmp({ ...emp })}
                      className="rounded-lg p-2 text-[var(--muted-foreground)] transition hover:bg-[var(--accent)] hover:text-[var(--foreground)]"
                    >
                      <Edit3 size={14} />
                    </button>
                    <button
                      onClick={() => setDeleteConfirm(emp)}
                      className="rounded-lg p-2 text-[var(--muted-foreground)] transition hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-950/20"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                {/* Contact details */}
                <div className="mt-3 flex flex-wrap gap-2">
                  {emp.email && (
                    <span className="flex items-center gap-1 rounded-lg bg-[var(--accent)] px-2 py-1 text-[10px] text-[var(--muted-foreground)]">
                      <Mail size={10} />
                      {emp.email}
                    </span>
                  )}
                  {emp.phone && (
                    <span className="flex items-center gap-1 rounded-lg bg-[var(--accent)] px-2 py-1 text-[10px] text-[var(--muted-foreground)]">
                      <Phone size={10} />
                      {emp.phone}
                    </span>
                  )}
                </div>

                {/* Profile URL */}
                {profile?.username && (
                  <div className="mt-2 flex items-center justify-between rounded-lg bg-[var(--accent)] px-3 py-1.5">
                    <span className="font-mono text-[10px] text-[var(--muted-foreground)]">
                      nammainfo.in/{profile.username}/{emp.slug}
                    </span>
                    <button
                      onClick={() =>
                        navigator.clipboard.writeText(
                          `https://nammainfo.in/${profile.username}/${emp.slug}`
                        )
                      }
                      className="p-1 text-[var(--muted-foreground)]"
                    >
                      <Copy size={10} />
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-[var(--border)] py-12 text-center">
          <Users size={32} className="text-[var(--muted-foreground)] opacity-40" />
          <p className="text-sm text-[var(--muted-foreground)]">
            No team members yet
          </p>
          <button
            onClick={() => setShowAdd(true)}
            className="flex items-center gap-1.5 rounded-xl bg-[var(--foreground)] px-4 py-2 text-xs font-semibold text-[var(--background)]"
          >
            <Plus size={14} />
            Add first member
          </button>
        </div>
      )}

      {/* Add employee sheet */}
      {showAdd && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center">
          <div
            className="absolute inset-0 bg-ink-950/40 backdrop-blur-sheet"
            onClick={() => setShowAdd(false)}
          />
          <div className="animate-slide-up relative max-h-[85dvh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-[var(--card)] p-5 shadow-card-lg sm:rounded-3xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-headline text-lg font-semibold">
                Add Team Member
              </h2>
              <button
                onClick={() => setShowAdd(false)}
                className="rounded-full bg-[var(--accent)] p-1.5"
              >
                <X size={16} />
              </button>
            </div>
            <div className="space-y-3">
              <Field
                label="Name"
                value={newEmp.name}
                onChange={(v) => setNewEmp({ ...newEmp, name: v })}
                required
              />
              <Field
                label="Designation"
                value={newEmp.designation}
                onChange={(v) => setNewEmp({ ...newEmp, designation: v })}
                required
              />
              <Field
                label="Email"
                value={newEmp.email}
                onChange={(v) => setNewEmp({ ...newEmp, email: v })}
                type="email"
              />
              <Field
                label="Phone"
                value={newEmp.phone}
                onChange={(v) => setNewEmp({ ...newEmp, phone: v })}
                type="tel"
              />
              <button
                onClick={addEmployee}
                disabled={saving || !newEmp.name || !newEmp.designation}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--foreground)] py-3 text-sm font-semibold text-[var(--background)] transition hover:opacity-80 disabled:opacity-40"
              >
                <Check size={14} />
                {saving ? "Adding…" : "Add Member"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit employee sheet */}
      {editingEmp && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center">
          <div
            className="absolute inset-0 bg-ink-950/40 backdrop-blur-sheet"
            onClick={() => setEditingEmp(null)}
          />
          <div className="animate-slide-up relative max-h-[85dvh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-[var(--card)] p-5 shadow-card-lg sm:rounded-3xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-headline text-lg font-semibold">
                Edit Team Member
              </h2>
              <button
                onClick={() => setEditingEmp(null)}
                className="rounded-full bg-[var(--accent)] p-1.5"
              >
                <X size={16} />
              </button>
            </div>
            <div className="space-y-3">
              <Field
                label="Name"
                value={editingEmp.name}
                onChange={(v) =>
                  setEditingEmp({ ...editingEmp, name: v })
                }
                required
              />
              <Field
                label="Designation"
                value={editingEmp.designation}
                onChange={(v) =>
                  setEditingEmp({ ...editingEmp, designation: v })
                }
                required
              />
              <Field
                label="Email"
                value={editingEmp.email ?? ""}
                onChange={(v) =>
                  setEditingEmp({ ...editingEmp, email: v || null })
                }
                type="email"
              />
              <Field
                label="Phone"
                value={editingEmp.phone ?? ""}
                onChange={(v) =>
                  setEditingEmp({ ...editingEmp, phone: v || null })
                }
                type="tel"
              />
              <button
                onClick={updateEmployee}
                disabled={saving || !editingEmp.name || !editingEmp.designation}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--foreground)] py-3 text-sm font-semibold text-[var(--background)] transition hover:opacity-80 disabled:opacity-40"
              >
                <Check size={14} />
                {saving ? "Saving…" : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation dialog */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center">
          <div
            className="absolute inset-0 bg-ink-950/50 backdrop-blur-sm"
            onClick={() => setDeleteConfirm(null)}
          />
          <div className="animate-slide-up relative mx-4 w-full max-w-sm rounded-2xl bg-[var(--card)] p-5 shadow-card-lg">
            <div className="mb-4 flex flex-col items-center gap-3 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-50 dark:bg-red-950/20">
                <AlertTriangle size={24} className="text-red-500" />
              </div>
              <h3 className="text-lg font-semibold">Delete Team Member?</h3>
              <p className="text-sm text-[var(--muted-foreground)]">
                Are you sure you want to remove{" "}
                <span className="font-semibold text-[var(--foreground)]">
                  {deleteConfirm.name}
                </span>
                ? This action cannot be undone.
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="flex flex-1 items-center justify-center rounded-xl border border-[var(--border)] py-2.5 text-sm font-semibold transition hover:bg-[var(--accent)]"
              >
                Cancel
              </button>
              <button
                onClick={() => deleteEmployee(deleteConfirm.id)}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-red-500 py-2.5 text-sm font-semibold text-white transition hover:bg-red-600"
              >
                <Trash2 size={14} />
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Image Crop Modal */}
      {cropImage && (
        <CropModal
          imageSrc={cropImage.src}
          aspect={cropImage.field === "cover_url" ? 16 / 9 : 1}
          title={
            cropImage.field === "cover_url"
              ? "Crop Cover Photo"
              : "Crop Profile Photo"
          }
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

function Field({
  label,
  value,
  onChange,
  type = "text",
  required = false,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  required?: boolean;
}) {
  return (
    <div>
      <label className="mb-1 block font-mono text-[10px] font-semibold uppercase tracking-widest text-[var(--muted-foreground)]">
        {label}
        {required && <span className="text-red-500"> *</span>}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        className="w-full rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 py-2.5 text-sm outline-none transition"
      />
    </div>
  );
}
