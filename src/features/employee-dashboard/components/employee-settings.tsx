"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronRight, Eye, EyeOff, KeyRound, Loader2, LogOut, Monitor, Moon, Smartphone, Sun } from "lucide-react";
import { createClient } from "@/supabase/client";
import { useAccount } from "@/hooks/use-account";
import { useTheme } from "@/hooks/use-theme";
import { SHOW_INSTALL_EVENT, isRunningAsApp } from "@/features/install-app/components/add-to-home-screen-popup";
import Avatar from "@/components/ui/avatar";
import Sheet, { ui } from "@/components/ui/sheet";

const group = "divide-y divide-[var(--border)] overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--card)]";
const row = "flex w-full items-center gap-3 px-4 py-3 text-left text-[15px] transition hover:bg-[var(--muted)]";
const sectionTitle = "mb-2 mt-6 px-1 text-[13px] font-medium text-[var(--muted-foreground)]";

export default function EmployeeSettings() {
  const router = useRouter();
  const { email, employee } = useAccount();
  const { preference, setPreference } = useTheme();
  const [pwOpen, setPwOpen] = useState(false);
  const [runningAsApp, setRunningAsApp] = useState(true);
  useEffect(() => setRunningAsApp(isRunningAsApp()), []);

  async function signOut() {
    await createClient().auth.signOut();
    router.push("/");
  }

  return (
    <div className="mx-auto max-w-lg px-4 pb-8 pt-5">
      <h1 className="px-1 text-[22px] font-semibold tracking-[-0.02em]">Settings</h1>

      <div className="mt-4 flex items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--card)] px-4 py-3.5">
        <Avatar name={employee?.name} src={employee?.avatar_url} size={44} shape="rounded" />
        <div className="min-w-0">
          <p className="truncate text-[15px] font-semibold">{employee?.name}</p>
          <p className="truncate text-[13px] text-[var(--muted-foreground)]">{email}</p>
          <p className="truncate text-xs text-[var(--muted-foreground)]">
            {[employee?.designation, employee?.owner_business_name].filter(Boolean).join(" · ")}
          </p>
        </div>
      </div>

      <h2 className={sectionTitle}>Account</h2>
      <div className={group}>
        <button type="button" onClick={() => setPwOpen(true)} className={row}>
          <KeyRound size={18} className="text-[var(--muted-foreground)]" />
          <span className="flex-1">Change password</span>
          <ChevronRight size={16} className="text-[var(--muted-foreground)]" />
        </button>
        {!runningAsApp && (
          <button type="button" onClick={() => window.dispatchEvent(new Event(SHOW_INSTALL_EVENT))} className={row}>
            <Smartphone size={18} className="text-[var(--muted-foreground)]" />
            <span className="flex-1">Add to home screen</span>
            <ChevronRight size={16} className="text-[var(--muted-foreground)]" />
          </button>
        )}
      </div>

      <h2 className={sectionTitle}>Appearance</h2>
      <div role="radiogroup" aria-label="Appearance" className={group}>
        {(
          [
            { value: "light", label: "Light", icon: Sun },
            { value: "dark", label: "Dark", icon: Moon },
            { value: "system", label: "System default", icon: Monitor },
          ] as const
        ).map(({ value, label, icon: Icon }) => {
          const selected = preference === value;
          return (
            <button key={value} type="button" role="radio" aria-checked={selected} onClick={() => setPreference(value)} className={row}>
              <Icon size={18} className="text-[var(--muted-foreground)]" />
              <span className="flex-1">{label}</span>
              {selected && <Check size={17} className="text-[var(--foreground)]" />}
            </button>
          );
        })}
      </div>

      <div className={`${group} mt-6`}>
        <button type="button" onClick={signOut} className={`${row} text-red-600 dark:text-red-400`}>
          <LogOut size={18} />
          <span className="flex-1">Sign out</span>
        </button>
      </div>

      {pwOpen && <ChangePasswordSheet onClose={() => setPwOpen(false)} />}
    </div>
  );
}

function ChangePasswordSheet({ onClose }: { onClose: () => void }) {
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function save() {
    if (pw.length < 8) return setError("Use at least 8 characters.");
    if (pw !== pw2) return setError("The two passwords don't match.");
    setBusy(true);
    setError(null);
    const { error } = await createClient().auth.updateUser({ password: pw });
    setBusy(false);
    if (error) return setError(error.message);
    setDone(true);
    setTimeout(onClose, 1200);
  }

  return (
    <Sheet
      title="Change password"
      description="Choose a password you haven't used before."
      onClose={onClose}
      footer={
        <button type="button" onClick={save} disabled={busy || done} className={ui.primary}>
          {busy ? <Loader2 size={16} className="animate-spin" /> : done ? <Check size={16} /> : null}
          {done ? "Password changed" : "Update password"}
        </button>
      }
    >
      <div className="space-y-4">
        <label className="block">
          <span className={ui.label}>New password</span>
          <div className="relative">
            <input type={show ? "text" : "password"} autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} className={`${ui.input} pr-11`} />
            <button
              type="button"
              onClick={() => setShow((s) => !s)}
              aria-label={show ? "Hide password" : "Show password"}
              className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
            >
              {show ? <EyeOff size={17} /> : <Eye size={17} />}
            </button>
          </div>
          <span className={ui.hint}>At least 8 characters.</span>
        </label>
        <label className="block">
          <span className={ui.label}>Confirm new password</span>
          <input type={show ? "text" : "password"} autoComplete="new-password" value={pw2} onChange={(e) => setPw2(e.target.value)} className={ui.input} />
        </label>
      </div>
      {error && <p className={ui.error}>{error}</p>}
    </Sheet>
  );
}
