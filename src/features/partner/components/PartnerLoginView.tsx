"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Handshake, Mail, Lock, Eye, EyeOff, AlertCircle } from "lucide-react";
import { createClient } from "@/supabase/client";
import { Button } from "@/admin/shared/ui/Button";
import { AdminThemeToggle } from "@/admin/shared/ui/AdminThemeToggle";

export function PartnerLoginView() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const supabase = createClient();
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (signInError) throw signInError;

      const authUser = data.user;
      if (!authUser) {
        throw new Error("Unable to authenticate session. Please try again.");
      }

      // Verify Partner privileges in profiles
      const { data: profile, error: profErr } = await supabase
        .from("profiles")
        .select("id, is_partner, is_campaign_manager, role, is_admin")
        .eq("id", authUser.id)
        .maybeSingle();

      const isAdmin = Boolean(
        profile?.is_admin ||
        profile?.role === "admin" ||
        authUser.app_metadata?.role === "admin" ||
        authUser.app_metadata?.is_admin === true
      );

      const isPartner = Boolean(
        (profile as any)?.is_partner ||
        profile?.is_campaign_manager ||
        profile?.role === "partner" ||
        profile?.role === "campaign_manager" ||
        authUser.app_metadata?.is_campaign_manager === true ||
        authUser.app_metadata?.is_partner === true
      );

      // Administrators cannot log in to the Partner Portal
      if (isAdmin && !isPartner) {
        await supabase.auth.signOut();
        setError("Access Denied: Administrators cannot log in to the Partner Portal. Please use the Admin Console at admin.nammainfo.in.");
        setLoading(false);
        return;
      }

      if (!isPartner) {
        await supabase.auth.signOut();
        setError("This account does not have Partner privileges. Please contact the administrator.");
        setLoading(false);
        return;
      }

      // Check if accessing via partner subdomain or main domain
      const isSubdomain =
        typeof window !== "undefined" &&
        (window.location.hostname.startsWith("partner.") ||
          window.location.hostname.startsWith("partner.localhost"));

      if (isSubdomain) {
        router.push("/");
      } else {
        router.push("/partner");
      }
    } catch (err: any) {
      console.error("[Partner Login] Error:", err);
      const msg = err?.message || "Failed to sign in.";
      if (/invalid login credentials/i.test(msg)) {
        setError("Invalid email or password. Please try again.");
      } else if (/unexpected token|not valid json|<!doctype|doctype|syntaxerror|failed to fetch|network/i.test(msg)) {
        setError("Unable to reach the sign-in service right now. Please try again in a moment.");
      } else if (msg.includes("<") || msg.includes(">") || msg.includes("{") || msg.length > 120) {
        setError("Something went wrong while signing in. Please try again.");
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-[var(--background)] px-4 py-12 select-none">
      <div className="fixed top-4 right-4 z-50">
        <AdminThemeToggle />
      </div>

      <div className="w-full max-w-md space-y-6">
        {/* Branding & Header */}
        <div className="text-center space-y-2">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--foreground)] text-[var(--background)] shadow-lg shadow-black/10">
            <Handshake size={28} />
          </div>
          <h1 className="font-headline text-2xl font-bold tracking-tight text-[var(--foreground)]">
            Partner Portal
          </h1>
          <p className="text-xs text-[var(--muted-foreground)]">
            Sign in with your partner credentials to access the referral console.
          </p>
        </div>

        {/* Login Card */}
        <div className="rounded-3xl border border-[var(--border)] bg-[var(--card)] p-6 sm:p-8 shadow-xl shadow-black/5">
          {error && (
            <div className="mb-5 flex items-start gap-2.5 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3.5 text-xs text-rose-700 dark:text-rose-400">
              <AlertCircle size={16} className="shrink-0 mt-0.5" />
              <p className="leading-relaxed">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Email Field */}
            <div className="space-y-1.5">
              <label className="font-mono text-[11px] font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
                Email Address
              </label>
              <div className="relative">
                <Mail
                  size={16}
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)]"
                />
                <input
                  type="email"
                  required
                  autoFocus
                  placeholder="partner@nammainfo.in"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-xl border border-[var(--border)] bg-[var(--background)] py-2.5 pl-10 pr-4 text-sm text-[var(--foreground)] placeholder-[var(--muted-foreground)] outline-none transition focus:border-[var(--foreground)] focus:ring-1 focus:ring-[var(--foreground)]"
                />
              </div>
            </div>

            {/* Password Field */}
            <div className="space-y-1.5">
              <label className="font-mono text-[11px] font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
                Password
              </label>
              <div className="relative">
                <Lock
                  size={16}
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)]"
                />
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  placeholder="••••••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-xl border border-[var(--border)] bg-[var(--background)] py-2.5 pl-10 pr-10 text-sm text-[var(--foreground)] placeholder-[var(--muted-foreground)] outline-none transition focus:border-[var(--foreground)] focus:ring-1 focus:ring-[var(--foreground)]"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors cursor-pointer"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <div className="pt-2">
              <Button
                type="submit"
                variant="primary"
                size="md"
                isLoading={loading}
                className="w-full py-3 text-sm font-semibold"
              >
                Sign In to Partner Portal
              </Button>
            </div>
          </form>
        </div>

        {/* Security Note */}
        <p className="text-center font-mono text-[10px] text-[var(--muted-foreground)]">
          Protected Area • Unauthorized access attempts are monitored
        </p>
      </div>
    </div>
  );
}
