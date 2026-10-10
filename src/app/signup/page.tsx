"use client";

import { useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  ArrowRight,
  Loader2,
  AlertCircle,
  Nfc,
  QrCode,
  Share2,
  MailCheck,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { flushPendingSaves } from "@/lib/saved-cards";

/* ------------------------------------------------------------------ */
/*  Hero: a floating "physical" NFC card — always dark, so it reads     */
/*  the same in light and dark mode.                                    */
/* ------------------------------------------------------------------ */

function HeroCard() {
  return (
    <div className="relative mx-auto w-full max-w-[230px] [perspective:1200px] lg:max-w-[300px]">
      {/* NFC signal rings */}
      <div className="pointer-events-none absolute -right-3 -top-3 h-16 w-16">
        <span className="absolute inset-0 animate-ping rounded-full border border-white/20 [animation-duration:2.4s]" />
        <span className="absolute inset-3 animate-ping rounded-full border border-white/25 [animation-duration:2.4s] [animation-delay:0.4s]" />
      </div>

      <div className="auth-card-float relative aspect-[1.6/1] w-full rounded-[22px] border border-white/10 bg-gradient-to-br from-[#262626] via-[#141414] to-[#050505] p-5 shadow-[0_30px_60px_-20px_rgba(0,0,0,0.8)]">
        {/* gloss */}
        <div className="pointer-events-none absolute inset-0 rounded-[22px] bg-[radial-gradient(120%_90%_at_0%_0%,rgba(255,255,255,0.14),transparent_55%)]" />

        <div className="relative flex h-full flex-col justify-between">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/10 font-headline text-sm font-semibold text-white ring-1 ring-white/15">
                NI
              </div>
              <div className="leading-tight">
                <div className="h-2 w-20 rounded-full bg-white/70" />
                <div className="mt-1.5 h-1.5 w-14 rounded-full bg-white/30" />
              </div>
            </div>
            <Nfc size={20} className="text-white/70" strokeWidth={1.6} />
          </div>

          <div className="flex items-end justify-between">
            <div className="space-y-1.5">
              <div className="h-1.5 w-24 rounded-full bg-white/25" />
              <div className="h-1.5 w-16 rounded-full bg-white/25" />
              <p className="pt-1 font-mono text-[10px] tracking-wider text-white/50">
                nammainfo.in/you
              </p>
            </div>
            <div className="grid grid-cols-4 gap-[3px] rounded-md bg-[#fff] p-1.5">
              {Array.from({ length: 16 }).map((_, i) => (
                <span
                  key={i}
                  className={`h-[5px] w-[5px] rounded-[1px] ${
                    [0, 1, 3, 4, 6, 9, 10, 12, 13, 15].includes(i) ? "bg-[#0a0a0a]" : "bg-transparent"
                  }`}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function HeroPanel({ fromTap }: { fromTap: boolean }) {
  return (
    <section className="relative overflow-hidden bg-[#0a0a0a] px-6 pb-12 pt-7 text-[#fafafa] lg:flex lg:min-h-dvh lg:w-1/2 lg:flex-col lg:justify-between lg:px-14 lg:py-12">
      {/* dotted grid */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(rgba(255,255,255,0.08)_1px,transparent_1px)] [background-size:18px_18px] [mask-image:radial-gradient(ellipse_at_center,black_30%,transparent_75%)]" />
      <div className="pointer-events-none absolute -left-24 -top-24 h-72 w-72 rounded-full bg-white/[0.06] blur-3xl" />

      <Link href="/" className="relative font-headline text-sm font-semibold tracking-tight text-white">
        namma info
      </Link>

      <div className="relative mt-5 lg:mt-0">
        <HeroCard />
        <h2 className="mt-7 text-center font-headline text-[26px] font-semibold leading-[1.1] tracking-tight lg:text-left lg:text-5xl">
          Tap. Share.
          <br />
          <span className="text-white/45">Connect.</span>
        </h2>
        <p className="mx-auto mt-3 max-w-xs text-center text-sm text-white/55 lg:mx-0 lg:text-left">
          {fromTap
            ? "You just tapped a Namma Info card. Make your own in under a minute."
            : "Your business card — digital, shareable and always up to date."}
        </p>
      </div>

      <ul className="relative mt-8 hidden gap-6 font-mono text-[11px] uppercase tracking-wider text-white/45 lg:flex">
        <li className="flex items-center gap-2"><Nfc size={14} /> NFC tap</li>
        <li className="flex items-center gap-2"><QrCode size={14} /> QR scan</li>
        <li className="flex items-center gap-2"><Share2 size={14} /> One link</li>
      </ul>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/*  Form pieces                                                         */
/* ------------------------------------------------------------------ */

function Field({
  label,
  icon,
  children,
  trailing,
}: {
  label: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  trailing?: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block font-mono text-[10px] font-semibold uppercase tracking-widest text-[var(--muted-foreground)]">
        {label}
      </span>
      <div className="group relative flex items-center rounded-2xl border border-[var(--border)] bg-[var(--card)] transition focus-within:border-[var(--foreground)] focus-within:shadow-[0_0_0_4px_var(--muted)]">
        <span className="pointer-events-none pl-4 text-[var(--muted-foreground)] transition group-focus-within:text-[var(--foreground)]">
          {icon}
        </span>
        {children}
        {trailing}
      </div>
    </label>
  );
}

const inputClass =
  "w-full bg-transparent px-3 py-3.5 text-[15px] text-[var(--foreground)] outline-none placeholder:text-[var(--muted-foreground)]/60";

function passwordStrength(pw: string) {
  let score = 0;
  if (pw.length >= 6) score++;
  if (pw.length >= 10) score++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score++;
  if (/\d/.test(pw) || /[^A-Za-z0-9]/.test(pw)) score++;
  const labels = ["Too short", "Weak", "Okay", "Good", "Strong"];
  return { score, label: labels[score] };
}

/* ------------------------------------------------------------------ */
/*  Page                                                                */
/* ------------------------------------------------------------------ */

function SignUpForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const ref = searchParams.get("ref"); // the card slug that sent them here

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [mode, setMode] = useState<"signup" | "signin">(
    searchParams.get("mode") === "signin" ? "signin" : "signup"
  );
  // Where to go after signing in (only same-site paths), e.g. back to the
  // card you were saving.
  const nextParam = searchParams.get("next");
  const next = nextParam && nextParam.startsWith("/") && !nextParam.startsWith("//") ? nextParam : null;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(searchParams.get("error"));
  const [checkEmail, setCheckEmail] = useState(false);

  const onboardingUrl = `/onboarding${ref ? `?ref=${encodeURIComponent(ref)}` : ""}`;
  const strength = passwordStrength(password);

  function switchMode(next: "signup" | "signin") {
    setMode(next);
    setError(null);
  }

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
          try {
            localStorage.setItem("nammainfo:hasAccount", "1");
          } catch {}
          await flushPendingSaves();
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
        try {
          localStorage.setItem("nammainfo:hasAccount", "1");
        } catch {}
        await flushPendingSaves();
        router.push(next ?? "/dashboard");
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
      <main className="flex min-h-dvh items-center justify-center bg-[var(--background)] px-6">
        <div className="w-full max-w-sm animate-fade-in text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--muted)]">
            <MailCheck size={28} className="text-[var(--foreground)]" strokeWidth={1.6} />
          </div>
          <h1 className="mt-6 font-headline text-2xl font-semibold tracking-tight text-[var(--foreground)]">
            Check your email
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-[var(--muted-foreground)]">
            We sent a confirmation link to{" "}
            <span className="font-medium text-[var(--foreground)]">{email}</span>. Open it on
            this device to finish setting up your card.
          </p>
          <button
            type="button"
            onClick={() => {
              setCheckEmail(false);
              switchMode("signin");
            }}
            className="mt-8 text-xs font-medium text-[var(--muted-foreground)] underline-offset-4 hover:text-[var(--foreground)] hover:underline"
          >
            Back to sign in
          </button>
        </div>
      </main>
    );
  }

  const isSignup = mode === "signup";

  return (
    <main className="min-h-dvh bg-[var(--background)] lg:flex">
      <HeroPanel fromTap={!!ref} />

      <section className="relative -mt-6 rounded-t-[28px] border-t border-[var(--border)] bg-[var(--background)] px-6 pb-12 pt-7 lg:border-t-0 lg:mt-0 lg:flex lg:w-1/2 lg:items-center lg:justify-center lg:rounded-none lg:px-14">
        <div className="mx-auto w-full max-w-sm animate-fade-in">
          {/* Mode switch */}
          <div
            role="tablist"
            className="relative grid grid-cols-2 rounded-2xl bg-[var(--muted)] p-1"
          >
            <span
              aria-hidden
              className={`absolute bottom-1 top-1 w-[calc(50%-4px)] rounded-xl bg-[var(--card)] shadow-sm ring-1 ring-[var(--border)] transition-transform duration-300 ease-out ${
                isSignup ? "translate-x-1" : "translate-x-[calc(100%+4px)]"
              }`}
            />
            {(["signup", "signin"] as const).map((m) => (
              <button
                key={m}
                type="button"
                role="tab"
                aria-selected={mode === m}
                onClick={() => switchMode(m)}
                className={`relative z-10 py-2.5 text-sm font-medium transition-colors ${
                  mode === m ? "text-[var(--foreground)]" : "text-[var(--muted-foreground)]"
                }`}
              >
                {m === "signup" ? "Create account" : "Sign in"}
              </button>
            ))}
          </div>

          <div className="mt-7">
            <h1 className="font-headline text-[26px] font-semibold tracking-tight text-[var(--foreground)]">
              {isSignup ? "Create your card" : "Welcome back"}
            </h1>
            <p className="mt-1 text-sm text-[var(--muted-foreground)]">
              {isSignup
                ? "Free to start. Set up in under a minute."
                : "Sign in to manage your card and see who tapped it."}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="mt-7 space-y-4">
            <Field label="Email" icon={<Mail size={18} strokeWidth={1.7} />}>
              <input
                type="email"
                required
                autoComplete="email"
                inputMode="email"
                placeholder="you@business.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={inputClass}
              />
            </Field>

            <div>
              <Field
                label="Password"
                icon={<Lock size={18} strokeWidth={1.7} />}
                trailing={
                  <button
                    type="button"
                    onClick={() => setShowPassword((s) => !s)}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    aria-pressed={showPassword}
                    className="mr-2 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-[var(--muted-foreground)] transition hover:bg-[var(--muted)] hover:text-[var(--foreground)]"
                  >
                    {showPassword ? <EyeOff size={18} strokeWidth={1.7} /> : <Eye size={18} strokeWidth={1.7} />}
                  </button>
                }
              >
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  minLength={6}
                  autoComplete={isSignup ? "new-password" : "current-password"}
                  placeholder={isSignup ? "At least 6 characters" : "Your password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={inputClass}
                />
              </Field>

              {isSignup && password.length > 0 && (
                <div className="mt-2.5 flex items-center gap-3">
                  <div className="grid flex-1 grid-cols-4 gap-1.5">
                    {[1, 2, 3, 4].map((i) => (
                      <span
                        key={i}
                        className={`h-1 rounded-full transition-colors duration-300 ${
                          strength.score >= i
                            ? strength.score <= 1
                              ? "bg-red-500"
                              : strength.score === 2
                                ? "bg-amber-500"
                                : "bg-emerald-500"
                            : "bg-[var(--muted)]"
                        }`}
                      />
                    ))}
                  </div>
                  <span className="w-16 text-right font-mono text-[10px] uppercase tracking-wider text-[var(--muted-foreground)]">
                    {strength.label}
                  </span>
                </div>
              )}

              {!isSignup && (
                <div className="mt-2.5 text-right">
                  <Link
                    href="/forgot-password"
                    className="text-xs font-medium text-[var(--muted-foreground)] underline-offset-4 hover:text-[var(--foreground)] hover:underline"
                  >
                    Forgot password?
                  </Link>
                </div>
              )}
            </div>

            {error && (
              <div
                role="alert"
                className="flex items-start gap-2.5 rounded-2xl border border-red-500/25 bg-red-500/[0.07] px-4 py-3 text-xs leading-relaxed text-red-600 dark:text-red-400"
              >
                <AlertCircle size={16} className="mt-px shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="group mt-2 flex w-full items-center justify-center gap-2 rounded-2xl bg-[var(--primary)] px-5 py-4 text-sm font-semibold text-[var(--primary-foreground)] shadow-[0_10px_30px_-12px_rgba(0,0,0,0.5)] transition active:scale-[0.99] disabled:opacity-60"
            >
              {loading ? (
                <>
                  <Loader2 size={17} className="animate-spin" />
                  Please wait…
                </>
              ) : (
                <>
                  {isSignup ? "Create my card" : "Sign in"}
                  <ArrowRight size={17} className="transition-transform group-hover:translate-x-0.5" />
                </>
              )}
            </button>
          </form>

          <p className="mt-8 text-center text-sm text-[var(--muted-foreground)]">
            {isSignup ? "Already have an account?" : "New to Namma Info?"}{" "}
            <button
              type="button"
              onClick={() => switchMode(isSignup ? "signin" : "signup")}
              className="font-semibold text-[var(--foreground)] underline-offset-4 hover:underline"
            >
              {isSignup ? "Sign in" : "Create one"}
            </button>
          </p>
        </div>
      </section>
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
