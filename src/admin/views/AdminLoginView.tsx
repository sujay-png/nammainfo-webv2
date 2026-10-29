"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Shield, Mail, Lock, Eye, EyeOff, Loader2, AlertCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/admin/shared/ui/Button";

export const AdminLoginView: React.FC = () => {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const supabase = createClient();

      // 1. Authenticate with Supabase Auth
      const { data: authData, error: signInError } =
        await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });

      if (signInError) throw signInError;
      if (!authData.user) throw new Error("No user returned from login.");

      // 2. Verify platform admin privileges in profiles table
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("is_admin, business_name")
        .eq("id", authData.user.id)
        .maybeSingle();

      if (profileError) {
        console.warn("Could not check admin profile flag:", profileError.message);
      }

      // If is_admin flag is false or missing, deny access and sign out
      if (!profile || !profile.is_admin) {
        await supabase.auth.signOut();
        throw new Error(
          "Access Denied: This account is authenticated but does not have administrator privileges."
        );
      }

      // 3. Successful admin login -> route to admin dashboard
      const isSubdomain =
        typeof window !== "undefined" &&
        (window.location.hostname.startsWith("admin.") ||
          window.location.hostname.startsWith("admin.localhost"));
      router.push(isSubdomain ? "/" : "/admin");
    } catch (err: any) {
      console.error("[Admin Login Error]:", err);
      const msg = err.message || "Failed to sign in.";
      if (msg.includes("Invalid login credentials")) {
        setError("Invalid email or password. Please try again.");
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--background)] px-4 py-12">
      <div className="w-full max-w-md space-y-6">
        {/* Branding & Header */}
        <div className="text-center space-y-2">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--foreground)] text-[var(--background)] shadow-lg shadow-black/10">
            <Shield size={28} />
          </div>
          <h1 className="font-headline text-2xl font-bold tracking-tight text-[var(--foreground)]">
            Admin Portal
          </h1>
          <p className="text-xs text-[var(--muted-foreground)]">
            Sign in with your administrator credentials to manage companies and subscriptions.
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

          <form onSubmit={handleLogin} className="space-y-4">
            {/* Email Field */}
            <div className="space-y-1.5">
              <label className="font-mono text-[11px] font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
                Admin Email
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
                  placeholder="admin@nammainfo.in"
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
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
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
                Sign In to Admin
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
};
