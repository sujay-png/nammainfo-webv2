"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Profile } from "@/lib/supabase/types";
import { useTheme } from "@/components/ThemeProvider";
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
} from "lucide-react";

export default function SettingsPage() {
  const router = useRouter();
  const { theme, toggleTheme } = useTheme();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

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
          sublabel={profile?.is_member ? "Active" : "Free plan"}
          onClick={() => {}}
        />

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
