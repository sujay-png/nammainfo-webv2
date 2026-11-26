"use client";

import EmployeeGate from "@/components/auth/owner-or-employee-gate";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/supabase/client";
import { getCurrentUser } from "@/supabase/current-user";
import type { Profile, Employee } from "@/supabase/database-types";
import { initials } from "@/lib/utils";
import dynamic from "next/dynamic";

const CropModal = dynamic(() => import("@/components/ui/image-crop-modal"), {
  ssr: false,
});
import BuyTeamCardsModal from "@/components/BuyTeamCardsModal";
import UpgradeToProModal from "@/components/UpgradeToProModal";
import RenewalModal from "@/components/RenewalModal";
import { calculateRenewalCost, getCardUnitPrice } from "@/lib/pricing";
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
  CreditCard,
  Clock,
  Sparkles,
  ShieldCheck,
  MapPin,
} from "lucide-react";
import Link from "next/link";
import EmployeeLoginAccess from "@/features/team/components/employee-login-access";
import { listMyBranches } from "@/features/branches/services/branches.service";
import { uniqueSlug, type Branch } from "@/features/branches/types";
import { absolute, displayLink, employeePath } from "@/features/branches/lib/paths";

function OwnerTeamPage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showBuyTeamModal, setShowBuyTeamModal] = useState(false);
  const [showRenewalModal, setShowRenewalModal] = useState(false);
  const [editingEmp, setEditingEmp] = useState<Employee | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<Employee | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [newEmp, setNewEmp] = useState({
    name: "",
    designation: "",
    email: "",
    phone: "",
    branch_id: "",
    card_design_mode: "company_template" as "company_template" | "custom_upload" | "team_assist",
    card_design_url: "",
    card_design_notes: "",
  });
  const [uploadingTemplate, setUploadingTemplate] = useState(false);
  const [uploadingEmpArtwork, setUploadingEmpArtwork] = useState(false);
  const [templateNotice, setTemplateNotice] = useState<string | null>(null);

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

    const [{ data: p }, { data: emps }, br] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", user.id).single(),
      supabase
        .from("employees")
        .select("*")
        .eq("owner_id", user.id)
        .order("created_at"),
      listMyBranches(user.id),
    ]);

    if (p) setProfile(p as unknown as Profile);
    if (emps) setEmployees(emps as unknown as Employee[]);
    if (br.ok) setBranches(br.data);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();

    const onVisibilityOrFocus = () => {
      if (document.visibilityState === "visible") {
        load();
      }
    };
    window.addEventListener("focus", onVisibilityOrFocus);
    document.addEventListener("visibilitychange", onVisibilityOrFocus);

    return () => {
      window.removeEventListener("focus", onVisibilityOrFocus);
      document.removeEventListener("visibilitychange", onVisibilityOrFocus);
    };
  }, [load]);

  async function addEmployee() {
    if (!profile || !newEmp.name || !newEmp.designation) return;
    if (!isTrial && availableSlots <= 0) {
      alert("No free card slots. Team members and branches share your slots. Please buy more cards first.");
      setShowBuyTeamModal(true);
      return;
    }
    setSaving(true);
    const supabase = createClient();

    // A free link in this business: team members and branches share
    // nammainfo.in/<you>/<link>, so "sujay" becomes "sujay-2" if taken.
    const slug = uniqueSlug(newEmp.name, [
      ...employees.map((e) => e.slug),
      ...branches.map((b) => b.slug),
    ]);

    const { data: insertedEmp, error } = await supabase
      .from("employees")
      .insert({
        owner_id: profile.id,
        name: newEmp.name,
        designation: newEmp.designation,
        email: newEmp.email || null,
        phone: newEmp.phone || null,
        slug,
        ...(newEmp.branch_id ? { branch_id: newEmp.branch_id } : {}),
        is_premium: true,
        status: "active",
        subscription_started_at: profile.subscription_started_at || new Date().toISOString(),
        subscription_expires_at: profile.membership_expires_at || null,
      })
      .select("id")
      .single();

    if (!error && insertedEmp) {
      // Queue card print specification & notify Admin
      await fetch("/api/team/card-spec", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "submit_card_spec",
          targetType: "employee",
          targetId: insertedEmp.id,
          designMode: newEmp.card_design_mode,
          designFileUrl: newEmp.card_design_url || null,
          designNotes: newEmp.card_design_notes || null,
        }),
      }).catch(() => {});

      setNewEmp({
        name: "",
        designation: "",
        email: "",
        phone: "",
        branch_id: "",
        card_design_mode: "company_template",
        card_design_url: "",
        card_design_notes: "",
      });
      setShowAdd(false);
      load();
    } else if (error && /team slots|card slots/i.test(error.message)) {
      // The database checks paid slots too (e.g. if this page was out of date).
      alert("No free card slots. Team members and branches share your slots. Please buy more cards first.");
      setShowAdd(false);
      setShowBuyTeamModal(true);
    } else if (error) {
      alert(`Couldn't add this member: ${error.message}`);
    }
    setSaving(false);
  }

  async function uploadCardArtworkFile(file: File, prefix: string): Promise<string | null> {
    if (!profile) return null;
    const supabase = createClient();
    const ext = file.name.split(".").pop() || "png";
    const path = `${profile.id}/card-designs/${prefix}_${Date.now()}.${ext}`;
    const { error } = await supabase.storage
      .from("profile-media")
      .upload(path, file, { upsert: true });
    if (error) {
      alert(`Upload failed: ${error.message}`);
      return null;
    }
    return supabase.storage.from("profile-media").getPublicUrl(path).data.publicUrl;
  }

  async function handleCompanyTemplateUpload(file: File) {
    setUploadingTemplate(true);
    setTemplateNotice(null);
    try {
      const url = await uploadCardArtworkFile(file, "master_template");
      if (!url) return;
      const res = await fetch("/api/team/card-spec", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "save_company_template",
          templateUrl: url,
          designNotes: profile?.default_card_design_notes || null,
        }),
      });
      if (res.ok) {
        setTemplateNotice("Company Master Template saved & synced for Designer.");
        await load();
      }
    } finally {
      setUploadingTemplate(false);
    }
  }

  async function updateEmployee() {
    if (!editingEmp) return;
    setSaving(true);
    const supabase = createClient();

    // The card link (slug) is NOT changed on rename: printed cards and
    // QR codes keep working. Moving to a branch changes the link to
    // /<you>/<branch>/<slug>; the old link redirects there.
    const { error } = await supabase
      .from("employees")
      .update({
        name: editingEmp.name,
        designation: editingEmp.designation,
        email: editingEmp.email || null,
        phone: editingEmp.phone || null,
        ...(branches.length > 0 || editingEmp.branch_id ? { branch_id: editingEmp.branch_id || null } : {}),
      })
      .eq("id", editingEmp.id);

    if (!error) {
      await fetch("/api/team/card-spec", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "submit_card_spec",
          targetType: "employee",
          targetId: editingEmp.id,
          designMode: editingEmp.card_design_mode || "company_template",
          designFileUrl: editingEmp.card_design_url || null,
          designNotes: editingEmp.card_design_notes || null,
        }),
      }).catch(() => {});
      setEditingEmp(null);
      load();
    } else {
      alert(`Couldn't save: ${error.message}`);
    }
    setSaving(false);
  }

  async function deleteEmployee(id: string) {
    if (deletingId) return;
    setDeletingId(id);
    try {
      const res = await fetch(`/api/team/employees/${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.deleted) {
        alert(data?.error || "Could not delete team member. Please try again.");
        return;
      }
      setEmployees((prev) => prev.filter((e) => e.id !== id));
      setDeleteConfirm(null);
      await load();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Could not delete team member");
    } finally {
      setDeletingId(null);
    }
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

  /** The member's branch, if it is shown (hidden branches fall back to the main office link). */
  function branchOf(emp: Employee) {
    return emp.branch_id ? branches.find((b) => b.id === emp.branch_id) ?? null : null;
  }

  function empPath(emp: Employee) {
    if (!profile?.username) return null;
    const b = branchOf(emp);
    return employeePath(profile.username, emp.slug, b?.is_active ? b.slug : null);
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

  // Primary card is the business owner's card
  const isTrial = profile?.subscription_plan === "trial";
  const isMember = Boolean(
    profile?.subscription_plan === "pro" ||
    profile?.subscription_plan === "lifetime" ||
    isTrial ||
    profile?.is_member
  );
  const primaryCards = Number(profile?.primary_card_count ?? (isMember ? 1 : 0));

  // Employee quota: Free Trial accounts have unlimited team additions during trial
  // Branches use the same slots as team members (secondary cards), so
  // they count towards slots, the total and the volume price.
  const usedSlots = employees.length + branches.length;
  const quota = isTrial ? usedSlots : isMember ? Number(profile?.purchased_id_count || 0) : 0;
  const availableSlots = isTrial ? 9999 : Math.max(0, quota - usedSlots);
  const totalCards = 1 + usedSlots;
  const renewalCost = calculateRenewalCost(1, usedSlots);
  const cardBreakdown = `1 Primary${primaryCards > 1 ? ` (+${primaryCards - 1} extra physical)` : ""} + ${employees.length} Team${branches.length ? ` + ${branches.length} Branch${branches.length === 1 ? "" : "es"}` : ""}`;

  // Check company expiry (15 days alert)
  const now = Date.now();
  const dayMs = 86400000;
  const expiresAt = profile?.membership_expires_at ? new Date(profile.membership_expires_at).getTime() : null;
  const daysLeft = expiresAt ? Math.max(0, Math.ceil((expiresAt - now) / dayMs)) : null;
  const isExpiringSoon = daysLeft !== null && daysLeft <= 15;

  return (
    <div className="mx-auto max-w-lg px-4 py-5 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 flex-1">
          <Link
            href="/dashboard/settings"
            className="shrink-0 rounded-[5px] border border-[var(--border)] p-2 transition hover:bg-[var(--accent)] text-[var(--foreground)]"
            aria-label="Back to Settings"
          >
            <ArrowLeft size={16} />
          </Link>
          <div className="min-w-0 flex-1">
            <h1 className="font-headline text-lg sm:text-xl font-bold tracking-tight text-[var(--foreground)] truncate">
              Team / Employees
            </h1>
            <p className="font-mono text-[11px] text-[var(--muted-foreground)] truncate">
              {totalCards} Total Cards ({cardBreakdown})
            </p>
          </div>
        </div>
        <div className="shrink-0">
          <button
            onClick={() => {
              if (isTrial || availableSlots > 0) {
                setShowAdd(true);
              } else {
                setShowBuyTeamModal(true);
              }
            }}
            className="shrink-0 whitespace-nowrap inline-flex items-center justify-center gap-1.5 rounded-[5px] bg-[var(--primary)] text-[var(--primary-foreground)] hover:opacity-90 active:scale-[0.98] px-3 py-2 text-xs font-semibold shadow-sm transition-all cursor-pointer"
          >
            <Plus size={14} strokeWidth={2.2} />
            <span>Add Member</span>
          </button>
        </div>
      </div>

      {/* 15-Day Synchronized Company Renewal Warning */}
      {isExpiringSoon && (
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock size={16} className="text-amber-600 dark:text-amber-400" />
              <span className="font-semibold text-sm text-[var(--foreground)]">
                {isTrial ? "Free Trial Ending Soon" : "Organization Subscription Expiring Soon"}
              </span>
            </div>
            <span className="font-mono text-xs font-bold text-amber-700 bg-amber-500/20 px-2 py-0.5 rounded-md">
              {daysLeft} days left
            </span>
          </div>
          <p className="text-xs text-[var(--muted-foreground)] leading-relaxed">
            All team member cards sync with your company&apos;s annual expiry. Upgrading now covers all <strong>{totalCards} cards</strong> ({cardBreakdown}) at the volume rate of <strong>₹{renewalCost.unitPrice}/card</strong>:
          </p>
          <div className="flex items-center justify-between pt-1 border-t border-amber-500/20">
            <span className="font-headline font-bold text-sm text-[var(--foreground)]">
              Total {isTrial ? "Pro Upgrade" : "Renewal"}: ₹{renewalCost.totalAmount.toLocaleString("en-IN")}
            </span>
            <button
              onClick={() => setShowRenewalModal(true)}
              className="px-3.5 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-semibold text-xs shadow-sm transition"
            >
              {isTrial ? "Upgrade to Pro" : "Renew Subscription"}
            </button>
          </div>
        </div>
      )}

      {/* Quota & Cards Allocation Bar */}
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4 space-y-3 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users size={16} className="text-[var(--primary)]" />
            <span className="text-xs font-semibold text-[var(--foreground)]">
              {isTrial ? "Trial Team Members:" : "Card Slots Quota:"}
            </span>
          </div>
          <span className="font-mono text-xs font-bold text-[var(--foreground)]">
            {isTrial
              ? `${employees.length} Team Members Added`
              : `${usedSlots} of ${quota} Slots Used${branches.length ? ` (${branches.length} by branches)` : ""}`}
          </span>
        </div>

        {!isTrial && (
          <div className="h-1.5 overflow-hidden rounded-full bg-[var(--muted)]">
            <div
              className="h-full rounded-full bg-[var(--primary)] transition-all duration-500"
              style={{ width: `${Math.min(100, quota > 0 ? (usedSlots / quota) * 100 : 0)}%` }}
            />
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
          <span className="text-xs text-[var(--muted-foreground)]">
            {isTrial
              ? "Unlimited team members during your 100-day Free Trial. When upgrading to Pro, all cards renew together."
              : availableSlots > 0
              ? `${availableSlots} slot${availableSlots === 1 ? "" : "s"} ready to assign`
              : quota === 0
              ? "0 card slots — buy cards below to add team members or branches"
              : "All card slots are in use (team members and branches)"}
          </span>
          {!isTrial && (
            <button
              onClick={() => setShowBuyTeamModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-[5px] border border-[var(--border)] bg-[var(--accent)] hover:bg-[var(--accent)]/80 text-[var(--foreground)] text-xs font-semibold transition cursor-pointer"
            >
              <CreditCard size={13} />
              <span>Buy More Team Cards</span>
            </button>
          )}
        </div>
      </div>

      {/* Reusable Company Master Card Template Panel */}
      {isMember && (
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4 space-y-2.5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-xs font-semibold text-[var(--foreground)]">
                Company Master Card Template
              </p>
              <p className="text-[11px] text-[var(--muted-foreground)]">
                Upload your card design once and reuse it for every team &amp; branch card — just add each employee&apos;s photo and details.
              </p>
            </div>
            <label className="inline-flex items-center gap-1.5 rounded-[5px] border border-[var(--border)] bg-[var(--accent)] hover:bg-[var(--border)] px-3 py-1.5 text-xs font-semibold text-[var(--foreground)] cursor-pointer transition-colors">
              {uploadingTemplate ? (
                <Loader2 size={12} className="animate-spin" />
              ) : (
                <CreditCard size={12} />
              )}
              <span>
                {uploadingTemplate
                  ? "Uploading..."
                  : profile?.default_card_template_url
                  ? "Update Master Template"
                  : "Upload Master Template"}
              </span>
              <input
                type="file"
                accept="image/*,application/pdf"
                disabled={uploadingTemplate}
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleCompanyTemplateUpload(f);
                  e.target.value = "";
                }}
              />
            </label>
          </div>
          {profile?.default_card_template_url && (
            <div className="flex items-center justify-between rounded-[5px] border border-[var(--border)] bg-[var(--background)] px-3 py-1.5 text-[11px]">
              <span className="text-[var(--foreground)] font-medium">
                Active template ready for Designer
              </span>
              <a
                href={profile.default_card_template_url}
                target="_blank"
                rel="noreferrer"
                className="underline font-semibold text-[var(--foreground)]"
              >
                Preview File
              </a>
            </div>
          )}
          {templateNotice && (
            <p className="text-[11px] font-medium text-[var(--foreground)]">{templateNotice}</p>
          )}
        </div>
      )}

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
                      {branchOf(emp) && (
                        <p className="mt-1 inline-flex items-center gap-1 rounded-full bg-[var(--accent)] px-2 py-0.5 text-[10px] font-semibold">
                          <MapPin size={9} /> {branchOf(emp)!.name}
                        </p>
                      )}
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
                    <span className="truncate font-mono text-[10px] text-[var(--muted-foreground)]">
                      {displayLink(empPath(emp)!)}
                    </span>
                    <button
                      onClick={() => navigator.clipboard.writeText(absolute(empPath(emp)!))}
                      className="p-1 text-[var(--muted-foreground)]"
                    >
                      <Copy size={10} />
                    </button>
                  </div>
                )}

                {/* Login access for this employee */}
                <EmployeeLoginAccess
                  employee={emp}
                  onChanged={(patch) => {
                    setEmployees((prev) => prev.map((e) => (e.id === emp.id ? { ...e, ...patch } : e)));
                    if (patch.user_id === "pending-refresh") load();
                  }}
                />
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
            onClick={() => {
              if (availableSlots > 0) {
                setShowAdd(true);
              } else {
                setShowBuyTeamModal(true);
              }
            }}
            className="flex items-center gap-1.5 rounded-xl bg-[var(--primary)] text-[var(--primary-foreground)] hover:opacity-90 active:scale-[0.98] px-4 py-2 text-xs font-semibold shadow-sm transition-all cursor-pointer"
          >
            <Plus size={14} />
            {availableSlots > 0 ? "Add first member" : "Buy Cards to Add Member"}
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
              {branches.length > 0 && (
                <BranchSelect
                  branches={branches}
                  value={newEmp.branch_id}
                  onChange={(v) => setNewEmp({ ...newEmp, branch_id: v })}
                />
              )}
              <div className="space-y-2 rounded-xl border border-[var(--border)] bg-[var(--background)] p-3">
                <label className="block font-mono text-[10px] font-semibold uppercase tracking-widest text-[var(--muted-foreground)]">
                  Physical Card Design
                </label>
                <select
                  value={newEmp.card_design_mode}
                  onChange={(e) =>
                    setNewEmp({
                      ...newEmp,
                      card_design_mode: e.target.value as "company_template" | "custom_upload" | "team_assist",
                    })
                  }
                  className="w-full rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-xs outline-none"
                >
                  <option value="company_template">
                    Use Company Master Template{profile?.default_card_template_url ? " (Saved)" : ""}
                  </option>
                  <option value="custom_upload">Upload Custom Card Artwork</option>
                  <option value="team_assist">Design by Namma Info Team</option>
                </select>
                {newEmp.card_design_mode === "custom_upload" && (
                  <div className="space-y-1.5">
                    <input
                      type="file"
                      accept="image/*,application/pdf"
                      disabled={uploadingEmpArtwork}
                      onChange={async (e) => {
                        const f = e.target.files?.[0];
                        if (!f) return;
                        setUploadingEmpArtwork(true);
                        const url = await uploadCardArtworkFile(f, "emp_card");
                        if (url) setNewEmp((prev) => ({ ...prev, card_design_url: url }));
                        setUploadingEmpArtwork(false);
                      }}
                      className="text-xs"
                    />
                    {newEmp.card_design_url && (
                      <p className="text-[10px] text-emerald-600 font-medium">Custom artwork uploaded.</p>
                    )}
                  </div>
                )}
                <input
                  type="text"
                  value={newEmp.card_design_notes}
                  onChange={(e) => setNewEmp({ ...newEmp, card_design_notes: e.target.value })}
                  placeholder="Optional print notes (e.g. include branch phone)..."
                  className="w-full rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-xs outline-none"
                />
              </div>
              <button
                onClick={addEmployee}
                disabled={saving || uploadingEmpArtwork || !newEmp.name || !newEmp.designation}
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
              {(branches.length > 0 || editingEmp.branch_id) && (
                <BranchSelect
                  branches={branches}
                  value={editingEmp.branch_id ?? ""}
                  onChange={(v) => setEditingEmp({ ...editingEmp, branch_id: v || null })}
                />
              )}
              <div className="space-y-2 rounded-xl border border-[var(--border)] bg-[var(--background)] p-3">
                <label className="block font-mono text-[10px] font-semibold uppercase tracking-widest text-[var(--muted-foreground)]">
                  Physical Card Design
                </label>
                <select
                  value={editingEmp.card_design_mode || "company_template"}
                  onChange={(e) =>
                    setEditingEmp({
                      ...editingEmp,
                      card_design_mode: e.target.value as "company_template" | "custom_upload" | "team_assist",
                    })
                  }
                  className="w-full rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-xs outline-none"
                >
                  <option value="company_template">
                    Use Company Master Template{profile?.default_card_template_url ? " (Saved)" : ""}
                  </option>
                  <option value="custom_upload">Upload Custom Card Artwork</option>
                  <option value="team_assist">Design by Namma Info Team</option>
                </select>
                {editingEmp.card_design_mode === "custom_upload" && (
                  <div className="space-y-1.5">
                    {editingEmp.card_design_url && (
                      <a
                        href={editingEmp.card_design_url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[11px] underline block"
                      >
                        View current employee card artwork
                      </a>
                    )}
                    <input
                      type="file"
                      accept="image/*,application/pdf"
                      disabled={uploadingEmpArtwork}
                      onChange={async (e) => {
                        const f = e.target.files?.[0];
                        if (!f) return;
                        setUploadingEmpArtwork(true);
                        const url = await uploadCardArtworkFile(f, `emp_${editingEmp.id}`);
                        if (url) {
                          setEditingEmp((prev) => (prev ? { ...prev, card_design_url: url } : null));
                        }
                        setUploadingEmpArtwork(false);
                      }}
                      className="text-xs"
                    />
                  </div>
                )}
                <input
                  type="text"
                  value={editingEmp.card_design_notes ?? ""}
                  onChange={(e) =>
                    setEditingEmp({ ...editingEmp, card_design_notes: e.target.value || null })
                  }
                  placeholder="Optional print notes..."
                  className="w-full rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-xs outline-none"
                />
              </div>
              <button
                onClick={updateEmployee}
                disabled={saving || uploadingEmpArtwork || !editingEmp.name || !editingEmp.designation}
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
                disabled={Boolean(deletingId)}
                onClick={() => setDeleteConfirm(null)}
                className="flex flex-1 items-center justify-center rounded-xl border border-[var(--border)] py-2.5 text-sm font-semibold transition hover:bg-[var(--accent)] disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                disabled={Boolean(deletingId)}
                onClick={() => deleteEmployee(deleteConfirm.id)}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-red-500 py-2.5 text-sm font-semibold text-white transition hover:bg-red-600 disabled:opacity-50"
              >
                <Trash2 size={14} />
                {deletingId === deleteConfirm.id ? "Deleting…" : "Delete"}
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

      {/* Buy Team Member Cards Modal */}
      {profile && (
        <BuyTeamCardsModal
          isOpen={showBuyTeamModal}
          onClose={() => setShowBuyTeamModal(false)}
          profile={profile}
          currentTeamCount={usedSlots}
          onSuccess={() => load()}
          onRequestRenewal={() => setShowRenewalModal(true)}
        />
      )}

      {/* Renewal Modal */}
      {profile && (
        <RenewalModal
          isOpen={showRenewalModal}
          onClose={() => setShowRenewalModal(false)}
          profile={profile}
          employeesCount={usedSlots}
          onSuccess={() => load()}
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

/** "Works at": main office or one of the branches. */
function BranchSelect({
  branches,
  value,
  onChange,
}: {
  branches: Branch[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className="mb-1 block font-mono text-[10px] font-semibold uppercase tracking-widest text-[var(--muted-foreground)]">
        Works at
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 py-2.5 text-sm outline-none transition"
      >
        <option value="">Main office</option>
        {branches.map((b) => (
          <option key={b.id} value={b.id}>
            {b.name}
            {b.is_active ? "" : " (hidden)"}
          </option>
        ))}
      </select>
      <p className="mt-1 text-[10px] text-[var(--muted-foreground)]">
        Their card shows this branch&apos;s address, phone and services.
      </p>
    </div>
  );
}

export default function TeamPage() {
  return <EmployeeGate owner={<OwnerTeamPage />} employee={null} />;
}
