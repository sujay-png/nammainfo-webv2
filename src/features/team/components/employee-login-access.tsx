"use client";

import { useState } from "react";
import { Check, Copy, KeyRound, Loader2, MessageCircle, RefreshCw, ShieldOff, ShieldCheck } from "lucide-react";
import Sheet, { ui } from "@/components/ui/sheet";
import type { Employee } from "@/supabase/database-types";

/* Owner-side controls for an employee's login (Team page). */

function generatePassword() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  const arr = new Uint32Array(10);
  crypto.getRandomValues(arr);
  return Array.from(arr, (n) => chars[n % chars.length]).join("");
}

async function callAccess(body: Record<string, unknown>) {
  const res = await fetch("/api/team/access", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string; email?: string };
  if (!res.ok || !json.ok) throw new Error(json.error || "Something went wrong");
  return json;
}

export async function removeEmployeeLogin(employeeId: string) {
  return callAccess({ action: "remove", employeeId });
}

export default function EmployeeLoginAccess({
  employee,
  onChanged,
}: {
  employee: Employee;
  onChanged: (patch: Partial<Employee>) => void;
}) {
  const [sheet, setSheet] = useState<null | "grant" | "reset">(null);
  const [email, setEmail] = useState(employee.email ?? "");
  const [password, setPassword] = useState(generatePassword);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ email: string; password: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const hasLogin = !!employee.user_id;
  const enabled = hasLogin && employee.login_enabled !== false;

  function open(kind: "grant" | "reset") {
    setSheet(kind);
    setError(null);
    setDone(null);
    setPassword(generatePassword());
    if (kind === "grant") setEmail(employee.email ?? "");
  }

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      if (sheet === "grant") {
        const r = await callAccess({ action: "grant", employeeId: employee.id, email, password });
        onChanged({ user_id: "pending-refresh", login_email: r.email ?? email, login_enabled: true });
        setDone({ email: r.email ?? email, password });
      } else {
        await callAccess({ action: "reset", employeeId: employee.id, password });
        setDone({ email: employee.login_email ?? "", password });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    }
    setBusy(false);
  }

  async function toggle() {
    setBusy(true);
    try {
      await callAccess({ action: enabled ? "disable" : "enable", employeeId: employee.id });
      onChanged({ login_enabled: !enabled });
    } catch (e) {
      alert(e instanceof Error ? e.message : "Something went wrong");
    }
    setBusy(false);
  }

  const loginUrl = typeof window !== "undefined" ? `${window.location.origin}/signup?mode=signin` : "https://nammainfo.in/signup?mode=signin";
  const shareText = done
    ? `Hi ${employee.name}, your Namma Info login is ready.\n\nLogin: ${loginUrl}\nEmail: ${done.email}\nPassword: ${done.password}\n\nYou can change the password in Settings after logging in.`
    : "";
  const waNumber = (employee.phone ?? "").replace(/[^0-9]/g, "");
  const waHref = `https://wa.me/${waNumber.length >= 10 ? (waNumber.length === 10 ? `91${waNumber}` : waNumber) : ""}?text=${encodeURIComponent(shareText)}`;

  const smallBtn =
    "inline-flex h-8 items-center gap-1.5 rounded-md border border-[var(--border)] bg-[var(--card)] px-2.5 text-xs font-medium text-[var(--foreground)] transition hover:bg-[var(--muted)] disabled:opacity-50";

  return (
    <>
      <div className="mt-3 flex items-center justify-between gap-3 border-t border-[var(--border)] pt-3">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-[13px] font-medium">
            <span
              aria-hidden
              className={`h-1.5 w-1.5 rounded-full ${enabled ? "bg-emerald-500" : hasLogin ? "bg-amber-500" : "bg-[var(--border)]"}`}
            />
            {enabled ? "Login active" : hasLogin ? "Login paused" : "No login"}
          </p>
          <p className="mt-0.5 truncate text-xs text-[var(--muted-foreground)]">
            {hasLogin ? employee.login_email : "Give them their own dashboard"}
          </p>
        </div>
        {hasLogin ? (
          <div className="flex shrink-0 items-center gap-1.5">
            <button type="button" onClick={() => open("reset")} className={smallBtn}>
              <KeyRound size={13} /> Reset
            </button>
            <button type="button" onClick={toggle} disabled={busy} className={smallBtn}>
              {busy ? <Loader2 size={13} className="animate-spin" /> : enabled ? <ShieldOff size={13} /> : <ShieldCheck size={13} />}
              {enabled ? "Pause" : "Allow"}
            </button>
          </div>
        ) : (
          <button type="button" onClick={() => open("grant")} className={smallBtn}>
            <KeyRound size={13} /> Create login
          </button>
        )}
      </div>

      {sheet && !done && (
        <Sheet
          title={sheet === "grant" ? `Create login for ${employee.name}` : `Reset password for ${employee.name}`}
          description={
            sheet === "grant"
              ? "They get their own dashboard with their card, saved cards, contacts and scanner. They can only change their photos and password."
              : "Their current password will stop working immediately."
          }
          onClose={() => !busy && setSheet(null)}
          footer={
            <button
              type="button"
              onClick={submit}
              disabled={busy || password.length < 8 || (sheet === "grant" && !email.trim())}
              className={ui.primary}
            >
              {busy && <Loader2 size={16} className="animate-spin" />}
              {sheet === "grant" ? "Create login" : "Set new password"}
            </button>
          }
        >
          <div className="space-y-4">
            {sheet === "grant" && (
              <label className="block">
                <span className={ui.label}>Email</span>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@company.com"
                  className={ui.input}
                />
                <span className={ui.hint}>They will use this to sign in.</span>
              </label>
            )}
            <label className="block">
              <span className={ui.label}>{sheet === "grant" ? "Temporary password" : "New password"}</span>
              <div className="flex gap-2">
                <input value={password} onChange={(e) => setPassword(e.target.value)} className={`${ui.input} font-mono`} />
                <button
                  type="button"
                  onClick={() => setPassword(generatePassword())}
                  aria-label="Generate another password"
                  title="Generate another"
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-[var(--border)] text-[var(--muted-foreground)] transition hover:bg-[var(--muted)] hover:text-[var(--foreground)]"
                >
                  <RefreshCw size={15} />
                </button>
              </div>
              <span className={ui.hint}>At least 8 characters. They can change it in Settings.</span>
            </label>
          </div>
          {error && <p className={ui.error}>{error}</p>}
        </Sheet>
      )}

      {sheet && done && (
        <Sheet
          title="Login details ready"
          description={`Send these to ${employee.name}. The password is shown only once.`}
          onClose={() => setSheet(null)}
          footer={
            <div className="space-y-2">
              <a href={waHref} target="_blank" rel="noopener noreferrer" className={ui.primary}>
                <MessageCircle size={16} /> Send on WhatsApp
              </a>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard?.writeText(shareText);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1500);
                }}
                className={ui.secondary}
              >
                {copied ? <Check size={16} /> : <Copy size={16} />}
                {copied ? "Copied" : "Copy details"}
              </button>
            </div>
          }
        >
          <dl className="divide-y divide-[var(--border)] rounded-lg border border-[var(--border)] text-sm">
            <div className="flex items-center justify-between gap-4 px-3 py-2.5">
              <dt className="text-[var(--muted-foreground)]">Email</dt>
              <dd className="truncate">{done.email}</dd>
            </div>
            <div className="flex items-center justify-between gap-4 px-3 py-2.5">
              <dt className="text-[var(--muted-foreground)]">Password</dt>
              <dd className="font-mono">{done.password}</dd>
            </div>
            <div className="flex items-center justify-between gap-4 px-3 py-2.5">
              <dt className="text-[var(--muted-foreground)]">Sign in at</dt>
              <dd className="truncate text-[13px]">{loginUrl.replace(/^https?:\/\//, "").replace("?mode=signin", "")}</dd>
            </div>
          </dl>
        </Sheet>
      )}
    </>
  );
}
