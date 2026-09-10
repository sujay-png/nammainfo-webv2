"use client";

import { useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

function SignUpForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const ref = searchParams.get("ref"); // the card slug that sent them here

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"signup" | "signin">("signup");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checkEmail, setCheckEmail] = useState(false);

  const onboardingUrl = `/onboarding${ref ? `?ref=${encodeURIComponent(ref)}` : ""}`;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const supabase = createClient();

    try {
      if (mode === "signup") {
        const { data, error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}${onboardingUrl}`,
          },
        });
        if (signUpError) throw signUpError;

        if (data.session) {
          // Email confirmation is off — we're signed in immediately.
          router.push(onboardingUrl);
        } else {
          // Confirmation email sent; the link carries them straight to
          // /onboarding (with ?ref preserved) once they click it.
          setCheckEmail(true);
        }
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (signInError) throw signInError;
        router.push(onboardingUrl);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Something went wrong.";
      setError(
        message.includes("already registered")
          ? "An account with that email already exists — try signing in instead."
          : message.includes("Invalid login credentials")
            ? "That email and password don't match our records."
            : message
      );
    } finally {
      setLoading(false);
    }
  }

  if (checkEmail) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-sm flex-col items-center justify-center gap-4 px-6 text-center">
        <h1 className="font-display text-2xl font-medium">Check your email</h1>
        <p className="text-sm text-ink-700/80">
          We sent a confirmation link to <strong>{email}</strong>. Open it on this
          device to finish setting up your card.
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-6 px-6 py-12">
      <div className="text-center">
        <h1 className="font-display text-2xl font-medium">
          {mode === "signup" ? "Create your card" : "Welcome back"}
        </h1>
        <p className="mt-1.5 text-sm text-ink-700/70">
          {ref
            ? "You tapped a Namma Info card — make your own in under a minute."
            : "Namma Info — your business card, digitized."}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <input
          type="email"
          required
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="rounded-xl border border-ink-900/10 bg-white px-4 py-3 text-sm outline-none focus:border-ink-900"
        />
        <input
          type="password"
          required
          minLength={6}
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="rounded-xl border border-ink-900/10 bg-white px-4 py-3 text-sm outline-none focus:border-ink-900"
        />

        {error && <p className="text-xs text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="mt-1 rounded-xl bg-ink-950 px-5 py-3 text-sm font-medium text-white shadow-card transition hover:opacity-90 disabled:opacity-50"
        >
          {loading ? "Please wait…" : mode === "signup" ? "Create my card" : "Sign in"}
        </button>
      </form>

      <button
        type="button"
        onClick={() => setMode(mode === "signup" ? "signin" : "signup")}
        className="text-center text-xs text-ink-700/70 underline-offset-4 hover:underline"
      >
        {mode === "signup"
          ? "Already have an account? Sign in"
          : "New to Namma Info? Create an account"}
      </button>
    </main>
  );
}

export default function SignUpPage() {
  return (
    <Suspense>
      <SignUpForm />
    </Suspense>
  );
}
