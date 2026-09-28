"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Profile, Employee } from "@/lib/supabase/types";
import { initials } from "@/lib/utils";
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
} from "lucide-react";
import Link from "next/link";

export default function TeamPage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [saving, setSaving] = useState(false);
  const [newEmp, setNewEmp] = useState({
    name: "",
    designation: "",
    email: "",
    phone: "",
  });

  const load = useCallback(async () => {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
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

  async function deleteEmployee(id: string) {
    const supabase = createClient();
    await supabase.from("employees").delete().eq("id", id);
    setEmployees(employees.filter((e) => e.id !== id));
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
              className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--accent)] font-headline text-sm font-bold">
                    {initials(emp.name)}
                  </div>
                  <div>
                    <p className="text-sm font-semibold">{emp.name}</p>
                    <p className="font-mono text-[10px] text-[var(--muted-foreground)]">
                      {emp.designation}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => deleteEmployee(emp.id)}
                  className="rounded-lg p-2 text-[var(--muted-foreground)] transition hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-950/20"
                >
                  <Trash2 size={14} />
                </button>
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
          <div className="animate-slide-up relative w-full max-w-lg rounded-t-3xl bg-[var(--card)] p-5 shadow-card-lg sm:rounded-3xl">
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
