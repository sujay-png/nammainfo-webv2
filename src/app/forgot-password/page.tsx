"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { ArrowLeft, Mail } from "lucide-react";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = createClient();

    try {
      const { error: resetError } =
        await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
        });

      if (resetError) throw resetError;
      setSent(true);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Something went wrong.";
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  if (sent) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-sm flex-col items-center justify-center gap-5 px-6 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-green-50">
          <Mail size={24} className="text-green-600" />
        </div>
        <div>
          <h1 className="font-display text-2xl font-medium">Check your email</h1>
          <p className="mt-2 text-sm leading-relaxed text-ink-700/80">
            We sent a password reset link to{" "}
            <strong className="text-ink-900">{email}</strong>. Click the link in
            the email to set a new password.
          </p>
        </div>
        <p className="text-xs text-ink-700/50">
          Didn&apos;t receive it? Check your spam folder or{" "}
          <button
            type="button"
            onClick={() => setSent(false)}
            className="underline underline-offset-2 hover:text-ink-700"
          >
            try again
          </button>
          .
        </p>
        <Link
          href="/signup"
          className="mt-2 inline-flex items-center gap-1.5 text-xs text-ink-700/70 underline-offset-4 hover:underline"
        >
          <ArrowLeft size={12} />
          Back to sign in
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-6 px-6 py-12">
      <div className="text-center">
        <h1 className="font-display text-2xl font-medium">Reset your password</h1>
        <p className="mt-1.5 text-sm text-ink-700/70">
          Enter the email address you used to create your account and we&apos;ll
          send you a link to reset your password.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <input
          type="email"
          required
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="rounded-xl border border-ink-900/10 bg-white px-4 py-3 text-sm text-ink-900 outline-none focus:border-ink-900"
        />

        {error && <p className="text-xs text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="mt-1 rounded-xl bg-ink-950 px-5 py-3 text-sm font-medium text-white shadow-card transition hover:opacity-90 disabled:opacity-50"
        >
          {loading ? "Sending…" : "Send reset link"}
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
