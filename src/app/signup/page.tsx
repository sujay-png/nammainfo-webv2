"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { ArrowRight, Eye, EyeOff, Loader2 } from "lucide-react";

export default function SignUpPage() {
  return (
    <Suspense fallback={<div className="flex min-h-dvh items-center justify-center bg-white" />}>
      <SignUpForm />
    </Suspense>
  );
}

function SignUpForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const ref = searchParams.get("ref");

  const [mode, setMode] = useState<"signup" | "login">("signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const supabase = createClient();

    if (mode === "signup") {
      const { error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { ref: ref || undefined },
        },
      });

      if (signUpError) {
        setError(signUpError.message);
        setLoading(false);
        return;
      }

      // After signup, go to onboarding
      router.push("/onboarding");
    } else {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) {
        setError(signInError.message);
        setLoading(false);
        return;
      }

      router.push("/dashboard");
    }
  }

  return (
    <main className="flex min-h-dvh items-center justify-center bg-white px-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="mb-10 text-center">
          <Link href="/" className="inline-block">
            <h1 className="text-2xl font-bold tracking-tight text-ink-950">
              namma<span className="font-light">info</span>
            </h1>
          </Link>
          <p className="mt-2 text-sm text-ink-400">
            {mode === "signup"
              ? "Create your digital business card"
              : "Welcome back"}
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email address"
              required
              className="w-full rounded-2xl border border-ink-200 bg-white px-4 py-3.5 text-sm outline-none transition placeholder:text-ink-300 focus:border-ink-400 focus:ring-1 focus:ring-ink-400"
            />
          </div>

          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              required
              minLength={6}
              className="w-full rounded-2xl border border-ink-200 bg-white px-4 py-3.5 pr-11 text-sm outline-none transition placeholder:text-ink-300 focus:border-ink-400 focus:ring-1 focus:ring-ink-400"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-ink-400"
            >
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>

          {error && (
            <p className="rounded-xl bg-red-50 px-4 py-2.5 text-xs font-medium text-red-600">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-ink-950 py-3.5 text-sm font-semibold text-white transition hover:bg-ink-800 disabled:opacity-50"
          >
            {loading ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <>
                {mode === "signup" ? "Create Account" : "Sign In"}
                <ArrowRight size={15} />
              </>
            )}
          </button>
        </form>

        {/* Toggle mode */}
        <p className="mt-6 text-center text-sm text-ink-400">
          {mode === "signup" ? (
            <>
              Already have an account?{" "}
              <button
                onClick={() => {
                  setMode("login");
                  setError("");
                }}
                className="font-medium text-ink-700 hover:text-ink-900"
              >
                Sign in
              </button>
            </>
          ) : (
            <>
              Don&apos;t have an account?{" "}
              <button
                onClick={() => {
                  setMode("signup");
                  setError("");
                }}
                className="font-medium text-ink-700 hover:text-ink-900"
              >
                Create one
              </button>
            </>
          )}
        </p>
      </div>
    </main>
  );
}
