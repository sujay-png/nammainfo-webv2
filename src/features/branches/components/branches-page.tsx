"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  Check,
  Copy,
  Edit3,
  ExternalLink,
  Eye,
  EyeOff,
  MapPin,
  Plus,
  Trash2,
  Users,
} from "lucide-react";
import EmployeeGate from "@/components/auth/owner-or-employee-gate";
import UpgradeToProModal from "@/components/UpgradeToProModal";
import { createClient } from "@/supabase/client";
import { getCurrentUser } from "@/supabase/current-user";
import { getMembership } from "@/lib/membership";
import type { Employee, Profile } from "@/supabase/database-types";
import { MAX_BRANCHES, type Branch } from "../types";
import { deleteBranch, listMyBranches, reorderBranches, updateBranch } from "../services/branches.service";
import { absolute, branchPath, displayLink } from "../lib/paths";
import BranchEditor from "./branch-editor";

/**
 * Settings → Branches. One profile, many locations: each branch gets its
 * own link (nammainfo.in/abc/mangaluru), photos, contact details,
 * directions and optionally its own services and products. Everything
 * else comes from the main profile.
 */
function OwnerBranchesPage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [employees, setEmployees] = useState<Pick<Employee, "id" | "slug" | "branch_id">[]>([]);
  const [loading, setLoading] = useState(true);
  const [needsMigration, setNeedsMigration] = useState(false);
  const [editing, setEditing] = useState<Branch | "new" | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Branch | null>(null);
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    const user = await getCurrentUser();
    if (!user) return;
    const supabase = createClient();
    const [{ data: p }, { data: emps }, res] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", user.id).single(),
      supabase.from("employees").select("*").eq("owner_id", user.id),
      listMyBranches(user.id),
    ]);
    if (p) setProfile(p as unknown as Profile);
    setEmployees(((emps ?? []) as unknown as Employee[]).map((e) => ({ id: e.id, slug: e.slug, branch_id: e.branch_id ?? null })));
    if (res.ok) {
      setBranches(res.data);
      setNeedsMigration(false);
    } else {
      setNeedsMigration(Boolean(res.missingTable));
      if (!res.missingTable) setMessage(res.error);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const teamCount = useMemo(() => {
    const m = new Map<string, number>();
    employees.forEach((e) => e.branch_id && m.set(e.branch_id, (m.get(e.branch_id) ?? 0) + 1));
    return m;
  }, [employees]);

  if (loading) {
    return (
      <div className="mx-auto max-w-lg space-y-3 px-4 py-5">
        <div className="skeleton h-14 rounded-2xl" />
        <div className="skeleton h-28 rounded-2xl" />
        <div className="skeleton h-28 rounded-2xl" />
      </div>
    );
  }
  if (!profile) return null;

  const membership = getMembership(profile);
  const handle = profile.username;

  function startAdd() {
    if (!membership.isPaid) return setShowUpgrade(true);
    if (branches.length >= MAX_BRANCHES) return setMessage(`You can add up to ${MAX_BRANCHES} branches.`);
    setEditing("new");
  }

  async function toggle(b: Branch) {
    const res = await updateBranch(b.id, { is_active: !b.is_active });
    if (res.ok) setBranches((list) => list.map((x) => (x.id === b.id ? res.data : x)));
    else setMessage(res.error);
  }

  async function move(i: number, dir: -1 | 1) {
    const j = i + dir;
    if (j < 0 || j >= branches.length) return;
    const next = [...branches];
    [next[i], next[j]] = [next[j], next[i]];
    setBranches(next.map((b, idx) => ({ ...b, sort_order: idx })));
    await reorderBranches(next.map((b) => b.id));
  }

  async function remove(b: Branch) {
    const res = await deleteBranch(b.id);
    setConfirmDelete(null);
    if (!res.ok) return setMessage(res.error);
    setBranches((list) => list.filter((x) => x.id !== b.id));
    setEmployees((list) => list.map((e) => (e.branch_id === b.id ? { ...e, branch_id: null } : e)));
  }

  function copy(b: Branch) {
    if (!handle) return;
    navigator.clipboard.writeText(absolute(branchPath(handle, b.slug)));
    setCopied(b.id);
    setTimeout(() => setCopied(null), 1500);
  }

  const takenFor = (b: Branch | null) => [
    ...branches.filter((x) => x.id !== b?.id).map((x) => x.slug),
    ...employees.map((e) => e.slug),
  ];

  return (
    <div className="mx-auto max-w-lg space-y-4 px-4 py-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard/settings"
            className="rounded-xl border border-[var(--border)] p-2 transition hover:bg-[var(--accent)]"
            aria-label="Back to settings"
          >
            <ArrowLeft size={16} />
          </Link>
          <div>
            <h1 className="font-headline text-xl font-semibold">Branches</h1>
            <p className="font-mono text-[11px] text-[var(--muted-foreground)]">
              {branches.length} {branches.length === 1 ? "branch" : "branches"} · one profile
            </p>
          </div>
        </div>
        {!needsMigration && (
          <button
            onClick={startAdd}
            className="flex cursor-pointer items-center gap-1.5 rounded-xl bg-[var(--primary)] px-3.5 py-2 text-xs font-semibold text-[var(--primary-foreground)] shadow-sm transition-all hover:opacity-90 active:scale-[0.98]"
          >
            <Plus size={14} /> Add branch
          </button>
        )}
      </div>

      {needsMigration && (
        <div className="rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
          Branches need a quick database update first. Run <code className="font-mono">20261112_branches.sql</code> in
          the Supabase SQL Editor, then reload this page.
        </div>
      )}

      {message && (
        <div className="flex items-start justify-between gap-3 rounded-2xl border border-[var(--border)] bg-[var(--accent)] p-3 text-xs">
          <span>{message}</span>
          <button onClick={() => setMessage(null)} className="text-[var(--muted-foreground)]">
            OK
          </button>
        </div>
      )}

      {!handle && !needsMigration && (
        <div className="rounded-2xl border border-[var(--border)] p-4 text-xs text-[var(--muted-foreground)]">
          Set your profile link (username) first; branch links are built from it, like nammainfo.in/
          <b>yourname</b>/mangaluru.
        </div>
      )}

      {/* How it works (shown until the first branch) */}
      {!needsMigration && branches.length === 0 && (
        <div className="rounded-2xl border border-dashed border-[var(--border)] p-5">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--accent)]">
            <MapPin size={20} />
          </span>
          <h2 className="mt-3 font-headline text-base font-semibold">Offices in more than one city?</h2>
          <p className="mt-1 text-sm leading-relaxed text-[var(--muted-foreground)]">
            Add a branch instead of a new profile. Each branch gets its own link, cover photo, phone, address and
            directions. Your about, gallery, testimonials, clients and bank details are shared from your main profile,
            so you edit them once.
          </p>
          <ul className="mt-3 space-y-1.5 font-mono text-[11px] text-[var(--muted-foreground)]">
            <li>nammainfo.in/{handle ?? "abc"} · main profile</li>
            <li>nammainfo.in/{handle ?? "abc"}/mangaluru · branch</li>
            <li>nammainfo.in/{handle ?? "abc"}/mangaluru/sujay · branch team member</li>
          </ul>
          <button
            onClick={startAdd}
            className="mt-4 flex items-center gap-1.5 rounded-xl bg-[var(--foreground)] px-4 py-2.5 text-xs font-semibold text-[var(--background)]"
          >
            <Plus size={14} /> Add your first branch
          </button>
        </div>
      )}

      {/* List */}
      <div className="space-y-3">
        {branches.map((b, i) => {
          const cover = b.cover_url || profile.cover_url;
          const n = teamCount.get(b.id) ?? 0;
          return (
            <div
              key={b.id}
              className={`overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--card)] shadow-card ${b.is_active ? "" : "opacity-60"}`}
            >
              <div className="relative h-20 bg-[var(--foreground)]">
                {cover && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={cover} alt="" className={`h-full w-full object-cover ${b.cover_url ? "" : "opacity-50"}`} />
                )}
                {!b.is_active && (
                  <span className="absolute left-2 top-2 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-semibold text-white">
                    Hidden
                  </span>
                )}
              </div>
              <div className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="flex items-center gap-1.5 truncate text-sm font-semibold">
                      <MapPin size={13} className="shrink-0" /> {b.name}
                    </p>
                    <p className="mt-0.5 font-mono text-[10px] text-[var(--muted-foreground)]">
                      <Users size={10} className="mr-1 inline" />
                      {n} team {n === 1 ? "member" : "members"}
                      {Array.isArray(b.services) || Array.isArray(b.products) ? " · own services/products" : ""}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center">
                    <IconBtn label="Move up" onClick={() => move(i, -1)} disabled={i === 0}>
                      <ArrowUp size={14} />
                    </IconBtn>
                    <IconBtn label="Move down" onClick={() => move(i, 1)} disabled={i === branches.length - 1}>
                      <ArrowDown size={14} />
                    </IconBtn>
                    <IconBtn label={b.is_active ? "Hide branch" : "Show branch"} onClick={() => toggle(b)}>
                      {b.is_active ? <Eye size={14} /> : <EyeOff size={14} />}
                    </IconBtn>
                    <IconBtn label="Edit branch" onClick={() => setEditing(b)}>
                      <Edit3 size={14} />
                    </IconBtn>
                    <IconBtn label="Delete branch" danger onClick={() => setConfirmDelete(b)}>
                      <Trash2 size={14} />
                    </IconBtn>
                  </div>
                </div>

                {handle && (
                  <div className="mt-3 flex items-center justify-between rounded-lg bg-[var(--accent)] px-3 py-1.5">
                    <span className="truncate font-mono text-[10px] text-[var(--muted-foreground)]">
                      {displayLink(branchPath(handle, b.slug))}
                    </span>
                    <span className="flex shrink-0 items-center">
                      <button onClick={() => copy(b)} className="p-1 text-[var(--muted-foreground)]" aria-label="Copy link">
                        {copied === b.id ? <Check size={11} /> : <Copy size={11} />}
                      </button>
                      {b.is_active && (
                        <a
                          href={branchPath(handle, b.slug)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-1 text-[var(--muted-foreground)]"
                          aria-label="Open branch page"
                        >
                          <ExternalLink size={11} />
                        </a>
                      )}
                    </span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {branches.length > 0 && (
        <p className="px-1 text-center text-[11px] leading-relaxed text-[var(--muted-foreground)]">
          Add team members to a branch from{" "}
          <Link href="/dashboard/team" className="font-semibold underline">
            Team
          </Link>
          . Their card link becomes nammainfo.in/{handle ?? "abc"}/branch/name.
        </p>
      )}

      {editing && (
        <BranchEditor
          profile={profile}
          branch={editing === "new" ? null : editing}
          takenSlugs={takenFor(editing === "new" ? null : editing)}
          nextSortOrder={branches.length}
          onClose={() => setEditing(null)}
          onSaved={(saved) => {
            setBranches((list) =>
              list.some((x) => x.id === saved.id) ? list.map((x) => (x.id === saved.id ? saved : x)) : [...list, saved]
            );
            setEditing(null);
          }}
        />
      )}

      {confirmDelete && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center">
          <div className="absolute inset-0 bg-ink-950/50 backdrop-blur-sm" onClick={() => setConfirmDelete(null)} />
          <div className="animate-slide-up relative mx-4 w-full max-w-sm rounded-2xl bg-[var(--card)] p-5 shadow-card-lg">
            <div className="mb-4 flex flex-col items-center gap-3 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-50 dark:bg-red-950/20">
                <AlertTriangle size={24} className="text-red-500" />
              </div>
              <h3 className="text-lg font-semibold">Delete {confirmDelete.name}?</h3>
              <p className="text-sm text-[var(--muted-foreground)]">
                Its link stops working. Team members in this branch stay on your team and move back to the main office.
                Contacts are kept. To pause it instead, hide the branch.
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmDelete(null)}
                className="flex flex-1 items-center justify-center rounded-xl border border-[var(--border)] py-2.5 text-sm font-semibold transition hover:bg-[var(--accent)]"
              >
                Cancel
              </button>
              <button
                onClick={() => remove(confirmDelete)}
                className="flex flex-1 items-center justify-center rounded-xl bg-red-500 py-2.5 text-sm font-semibold text-white transition hover:bg-red-600"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {showUpgrade && <UpgradeToProModal isOpen profile={profile} onClose={() => setShowUpgrade(false)} onSuccess={load} />}
    </div>
  );
}

function IconBtn({
  label,
  onClick,
  disabled,
  danger,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={`rounded-lg p-1.5 text-[var(--muted-foreground)] transition disabled:opacity-30 ${danger ? "hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-950/20" : "hover:bg-[var(--accent)] hover:text-[var(--foreground)]"}`}
    >
      {children}
    </button>
  );
}

export default function BranchesPage() {
  return <EmployeeGate owner={<OwnerBranchesPage />} employee={null} />;
}
