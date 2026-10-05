"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Lock, CheckCircle2, ArrowLeft, Eye, EyeOff } from "lucide-react";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    setLoading(true);

    const supabase = createClient();

    try {
      const { error: updateError } = await supabase.auth.updateUser({
        password,
      });

      if (updateError) throw updateError;
      setDone(true);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Something went wrong.";
      setError(
        message.includes("same password")
          ? "New password must be different from your current password."
          : message
      );
    } finally {
      setLoading(false);
    }
  }

  if (done) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-sm flex-col items-center justify-center gap-5 px-6 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-green-50">
          <CheckCircle2 size={24} className="text-green-600" />
        </div>
        <div>
          <h1 className="font-display text-2xl font-medium">
            Password updated
          </h1>
          <p className="mt-2 text-sm text-ink-700/80">
            Your password has been reset successfully. You can now sign in with
            your new password.
          </p>
        </div>
        <button
          onClick={() => router.push("/dashboard")}
          className="mt-2 rounded-xl bg-ink-950 px-6 py-3 text-sm font-medium text-white shadow-card transition hover:opacity-90"
        >
          Go to Dashboard
        </button>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-6 px-6 py-12">
      <div className="text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-ink-100">
          <Lock size={24} className="text-ink-600" />
        </div>
        <h1 className="font-display text-2xl font-medium">Set new password</h1>
        <p className="mt-1.5 text-sm text-ink-700/70">
          Enter your new password below. Make sure it&apos;s at least 6
          characters long.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <div className="relative">
          <input
            type={showPassword ? "text" : "password"}
            required
            minLength={6}
            placeholder="New password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-xl border border-ink-900/10 bg-white px-4 py-3 pr-11 text-sm text-ink-900 outline-none focus:border-ink-900"
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-400 hover:text-ink-600"
            tabIndex={-1}
          >
            {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        </div>

        <div className="relative">
          <input
            type={showConfirm ? "text" : "password"}
            required
            minLength={6}
            placeholder="Confirm new password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            className="w-full rounded-xl border border-ink-900/10 bg-white px-4 py-3 pr-11 text-sm text-ink-900 outline-none focus:border-ink-900"
          />
          <button
            type="button"
            onClick={() => setShowConfirm(!showConfirm)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-400 hover:text-ink-600"
            tabIndex={-1}
          >
            {showConfirm ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        </div>

        {error && <p className="text-xs text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="mt-1 rounded-xl bg-ink-950 px-5 py-3 text-sm font-medium text-white shadow-card transition hover:opacity-90 disabled:opacity-50"
        >
          {loading ? "Updating…" : "Update password"}
        </button>
      </form>

      <Link
        href="/signup"
        className="inline-flex items-center justify-center gap-1.5 text-center text-xs text-ink-700/70 underline-offset-4 hover:underline"
      >
        <ArrowLeft size={12} />
        Back to sign in
      </Link>
    </main>
  );
}
