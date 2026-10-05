"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Profile } from "@/lib/supabase/types";
import { useTheme } from "@/components/ThemeProvider";
import { themes, getTheme } from "@/lib/themes";
import {
  LogOut,
  User,
  Bell,
  Shield,
  HelpCircle,
  ChevronRight,
  CreditCard,
  ExternalLink,
  Moon,
  Sun,
  Users,
  Palette,
  Check,
} from "lucide-react";

export default function SettingsPage() {
  const router = useRouter();
  const { theme, toggleTheme, colorTheme, setColorTheme } = useTheme();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showThemes, setShowThemes] = useState(false);

  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();
      if (data) setProfile(data as unknown as Profile);
      setLoading(false);
    })();
  }, []);

  async function handleThemeSelect(slug: string) {
    setSaving(true);
    setColorTheme(slug);

    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      await supabase
        .from("profiles")
        .update({ theme: slug })
        .eq("id", user.id);
    }
    setSaving(false);
  }

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/");
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-lg px-4 py-5">
        <div className="space-y-3">
          <div className="skeleton h-20 rounded-2xl" />
          <div className="skeleton h-14 rounded-2xl" />
          <div className="skeleton h-14 rounded-2xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-5">
      <h1 className="mb-5 font-headline text-xl font-semibold tracking-tight">
        Settings
      </h1>

      {/* Profile card */}
      {profile && (
        <div className="mb-5 flex items-center gap-3 rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--accent)] font-headline text-sm font-semibold text-[var(--accent-foreground)]">
            {profile.owner_name?.[0]?.toUpperCase() ?? "N"}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">
              {profile.owner_name || "Your Name"}
            </p>
            <p className="truncate text-xs text-[var(--muted-foreground)]">
              {profile.email}
            </p>
          </div>
          <button
            onClick={() => router.push("/dashboard/profile")}
            className="rounded-lg p-1.5 text-[var(--muted-foreground)] transition hover:bg-[var(--accent)]"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      )}

      {/* Settings groups */}
      <div className="space-y-1">
        <SettingsItem
          icon={<User size={18} />}
          label="Edit Profile"
          onClick={() => router.push("/dashboard/profile")}
        />
        <SettingsItem
          icon={<Users size={18} />}
          label="Team / Employees"
          sublabel="Manage your team"
          onClick={() => router.push("/dashboard/team")}
        />
        <SettingsItem
          icon={<CreditCard size={18} />}
          label="Membership"
          sublabel={(() => {
            if (!profile) return "";
            const day = 86400000;
            const joined = new Date(profile.created_at);
            const expires = profile.membership_expires_at
              ? new Date(profile.membership_expires_at)
              : new Date(joined.getTime() + 365 * day);
            const left = Math.max(0, Math.ceil((expires.getTime() - Date.now()) / day));
            return left > 0 ? `${left} day${left === 1 ? "" : "s"} left` : "Expired — renew";
          })()}
          onClick={() => {}}
        />
      </div>

      {/* Appearance section */}
      <div className="mt-6">
        <p className="mb-2 px-4 font-mono text-[10px] font-semibold uppercase tracking-widest text-[var(--muted-foreground)]">
          Appearance
        </p>

        {/* Dark mode toggle */}
        <button
          onClick={toggleTheme}
          className="flex w-full items-center justify-between rounded-2xl px-4 py-3.5 transition hover:bg-[var(--accent)]"
        >
          <div className="flex items-center gap-3">
            <span className="text-[var(--muted-foreground)]">
              {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
            </span>
            <span className="text-sm font-medium">
              {theme === "dark" ? "Light Mode" : "Dark Mode"}
            </span>
          </div>
          <div className="relative h-6 w-11 rounded-full bg-[var(--border)] transition-colors">
            <div
              className={`absolute top-0.5 h-5 w-5 rounded-full bg-[var(--foreground)] transition-transform ${
                theme === "dark" ? "translate-x-5" : "translate-x-0.5"
              }`}
            />
          </div>
        </button>

        {/* Theme picker toggle */}
        <button
          onClick={() => setShowThemes(!showThemes)}
          className="flex w-full items-center justify-between rounded-2xl px-4 py-3.5 transition hover:bg-[var(--accent)]"
        >
          <div className="flex items-center gap-3">
            <span className="text-[var(--muted-foreground)]">
              <Palette size={18} />
            </span>
            <div>
              <span className="text-sm font-medium">Theme</span>
              <p className="text-xs text-[var(--muted-foreground)]">
                {getTheme(colorTheme).name}
              </p>
            </div>
          </div>
          <ChevronRight
            size={14}
            className={`text-[var(--muted-foreground)] transition-transform ${
              showThemes ? "rotate-90" : ""
            }`}
          />
        </button>

        {/* Theme grid */}
        {showThemes && (
          <div className="mt-1 grid grid-cols-2 gap-2 rounded-2xl border border-[var(--border)] bg-[var(--card)] p-3">
            {themes.map((t) => {
              const isActive = colorTheme === t.slug;
              return (
                <button
                  key={t.slug}
                  onClick={() => handleThemeSelect(t.slug)}
                  disabled={saving}
                  className={`group relative flex items-center gap-2.5 rounded-xl border p-3 transition ${
                    isActive
                      ? "border-[var(--primary)] bg-[var(--accent)]"
                      : "border-[var(--border)] hover:border-[var(--muted-foreground)] hover:bg-[var(--accent)]"
                  }`}
                >
                  {/* Color swatches */}
                  <div className="flex -space-x-1">
                    <div
                      className="h-6 w-6 rounded-full border-2 border-[var(--card)]"
                      style={{ backgroundColor: t.preview.primary }}
                    />
                    <div
                      className="h-6 w-6 rounded-full border-2 border-[var(--card)]"
                      style={{ backgroundColor: t.preview.accent }}
                    />
                  </div>
                  <span className="text-xs font-medium">{t.name}</span>
                  {isActive && (
                    <Check
                      size={14}
                      className="absolute right-2 top-2 text-[var(--primary)]"
                    />
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Other settings */}
      <div className="mt-4 space-y-1">
        <SettingsItem
          icon={<Bell size={18} />}
          label="Notifications"
          onClick={() => {}}
        />
        <SettingsItem
          icon={<Shield size={18} />}
          label="Privacy"
          onClick={() => {}}
        />
        <SettingsItem
          icon={<HelpCircle size={18} />}
          label="Help & Support"
          href="mailto:support@nammainfo.in"
        />
      </div>

      <div className="mt-6 border-t border-[var(--border)] pt-4">
        <button
          onClick={handleSignOut}
          className="flex w-full items-center gap-3 rounded-2xl px-4 py-3.5 text-sm font-medium text-red-500 transition hover:bg-red-50 dark:hover:bg-red-950/20"
        >
          <LogOut size={18} />
          Sign out
        </button>
      </div>

      <p className="mt-6 text-center font-mono text-[11px] text-[var(--muted-foreground)]">
        Namma Info v2.0 · Made with care
      </p>
    </div>
  );
}

function SettingsItem({
  icon,
  label,
  sublabel,
  onClick,
  href,
}: {
  icon: React.ReactNode;
  label: string;
  sublabel?: string;
  onClick?: () => void;
  href?: string;
}) {
  const content = (
    <>
      <div className="flex items-center gap-3">
        <span className="text-[var(--muted-foreground)]">{icon}</span>
        <span className="text-sm font-medium">{label}</span>
      </div>
      <div className="flex items-center gap-2">
        {sublabel && (
          <span className="text-xs text-[var(--muted-foreground)]">
            {sublabel}
          </span>
        )}
        {href ? (
          <ExternalLink size={14} className="text-[var(--muted-foreground)]" />
        ) : (
          <ChevronRight size={14} className="text-[var(--muted-foreground)]" />
        )}
      </div>
    </>
  );

  if (href) {
    return (
      <a
        href={href}
        className="flex items-center justify-between rounded-2xl px-4 py-3.5 transition hover:bg-[var(--accent)]"
      >
        {content}
      </a>
    );
  }

  return (
    <button
      onClick={onClick}
      className="flex w-full items-center justify-between rounded-2xl px-4 py-3.5 transition hover:bg-[var(--accent)]"
    >
      {content}
    </button>
  );
}
