"use client";

import EmployeeGate from "@/components/auth/owner-or-employee-gate";
import EmployeeSettings from "@/features/employee-dashboard/components/employee-settings";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/supabase/client";
import { getCurrentUser } from "@/supabase/current-user";
import type { Profile } from "@/supabase/database-types";
import { initials } from "@/lib/utils";
import { useTheme } from "@/hooks/use-theme";
import { SHOW_INSTALL_EVENT, isRunningAsApp } from "@/features/install-app/components/add-to-home-screen-popup";
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
  Monitor,
  Smartphone,
  Users,
  Palette,
  Check,
  Package,
} from "lucide-react";
import UpgradeToProModal from "@/components/UpgradeToProModal";
import RenewalModal from "@/components/RenewalModal";
import { getMembership } from "@/lib/membership";

function OwnerSettingsPage() {
  const router = useRouter();
  const { preference, setPreference, colorTheme, setColorTheme } = useTheme();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showThemes, setShowThemes] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [showRenewalModal, setShowRenewalModal] = useState(false);
  const [teamCount, setTeamCount] = useState(0);
  const [runningAsApp, setRunningAsApp] = useState(true);
  useEffect(() => setRunningAsApp(isRunningAsApp()), []);

  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const user = await getCurrentUser();
      if (!user) return;

      const [profRes, empRes] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", user.id).single(),
        supabase.from("employees").select("id", { count: "exact", head: true }).eq("owner_id", user.id).eq("is_active", true),
      ]);
      if (profRes.data) setProfile(profRes.data as unknown as Profile);
      setTeamCount(empRes.count || 0);
      setLoading(false);
    })();
  }, []);

  async function handleThemeSelect(slug: string) {
    setSaving(true);
    setColorTheme(slug);

    const supabase = createClient();
    const user = await getCurrentUser();
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
          <div className="skeleton h-20 rounded-[5px]" />
          <div className="skeleton h-14 rounded-[5px]" />
          <div className="skeleton h-14 rounded-[5px]" />
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
        <div className="mb-5 flex items-center gap-3 rounded-[5px] border border-[var(--border)] bg-[var(--card)] p-4">
          <div className="relative flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full border border-[var(--border)] bg-[var(--accent)] font-headline text-sm font-semibold text-[var(--accent-foreground)]">
            {profile.logo_url || profile.avatar_url ? (
              <img
                src={profile.logo_url || profile.avatar_url!}
                alt={profile.business_name || profile.owner_name || "Logo"}
                className="h-full w-full object-cover"
              />
            ) : (
              initials(profile.business_name || profile.owner_name)
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-[var(--foreground)]">
              {profile.business_name || profile.owner_name || "Your Business"}
            </p>
            <p className="truncate text-xs text-[var(--muted-foreground)]">
              {profile.email}
            </p>
          </div>
          <button
            onClick={() => router.push("/dashboard/profile")}
            className="rounded-lg p-1.5 text-[var(--muted-foreground)] transition hover:bg-[var(--accent)] cursor-pointer"
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
          sublabel="Personal details, bio, logo & contacts"
          onClick={() => router.push("/dashboard/profile")}
        />
        <SettingsItem
          icon={<Users size={18} />}
          label="Team / Employees"
          sublabel="Manage your organization team members"
          onClick={() => router.push("/dashboard/team")}
        />
        <SettingsItem
          icon={<Package size={18} />}
          label="Card Orders & Fulfillment"
          sublabel="Track physical NFC card production & delivery"
          onClick={() => router.push("/dashboard/orders")}
        />
        <SettingsItem
          icon={<CreditCard size={18} />}
          label="Membership & Plan"
          sublabel="Digital vanity link and NFC card access"
          badge={(() => {
            if (!profile) return "";
            const m = getMembership(profile);
            if (m.isLifetime) return "Lifetime";
            if (m.isFree) return "Free Tier";
            if (m.isExpired) return "Expired";
            const label = m.isTrial ? "Trial" : "Pro";
            return m.daysLeft !== null ? `${label} (${m.daysLeft}d)` : label;
          })()}
          onClick={() => {
            const isMember = Boolean(
              profile?.subscription_plan === "pro" ||
              profile?.subscription_plan === "lifetime" ||
              profile?.is_member
            );
            if (isMember) {
              setShowRenewalModal(true);
            } else {
              setShowUpgradeModal(true);
            }
          }}
        />
      </div>

      {/* Appearance section */}
      <div className="mt-6">
        <p className="mb-2 px-4 font-mono text-[10px] font-semibold uppercase tracking-widest text-[var(--muted-foreground)]">
          Appearance
        </p>

        {/* Light / Dark / System default */}
        <div
          role="radiogroup"
          aria-label="Appearance"
          className="space-y-1"
        >
          {(
            [
              { value: "light", label: "Light mode", icon: <Sun size={18} /> },
              { value: "dark", label: "Dark mode", icon: <Moon size={18} /> },
              { value: "system", label: "System default", icon: <Monitor size={18} /> },
            ] as const
          ).map((opt) => {
            const selected = preference === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => setPreference(opt.value)}
                className="flex w-full items-center justify-between rounded-[5px] px-4 py-3.5 transition hover:bg-[var(--accent)]"
              >
                <div className="flex items-center gap-3">
                  <span className="text-[var(--muted-foreground)]">{opt.icon}</span>
                  <span className="text-sm font-medium">{opt.label}</span>
                </div>
                <span
                  className={`flex h-5 w-5 items-center justify-center rounded-full border-2 transition-colors ${
                    selected ? "border-[var(--foreground)]" : "border-[var(--border)]"
                  }`}
                >
                  {selected && <span className="h-2.5 w-2.5 rounded-full bg-[var(--foreground)]" />}
                </span>
              </button>
            );
          })}
        </div>

        {/* Theme picker toggle */}
        <button
          onClick={() => setShowThemes(!showThemes)}
          className="flex w-full items-center justify-between rounded-[5px] px-4 py-3.5 transition hover:bg-[var(--accent)]"
        >
          <div className="flex items-center gap-3">
            <span className="text-[var(--muted-foreground)]">
              <Palette size={18} />
            </span>
            <span className="text-sm font-medium">Theme</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-[var(--muted-foreground)]">
              {getTheme(colorTheme).name}
            </span>
            <ChevronRight
              size={14}
              className={`text-[var(--muted-foreground)] transition-transform ${
                showThemes ? "rotate-90" : ""
              }`}
            />
          </div>
        </button>

        {/* Theme grid */}
        {showThemes && (
          <div className="mt-1 grid grid-cols-2 gap-2 rounded-[5px] border border-[var(--border)] bg-[var(--card)] p-3">
            {themes.map((t) => {
              const isActive = colorTheme === t.slug;
              return (
                <button
                  key={t.slug}
                  onClick={() => handleThemeSelect(t.slug)}
                  disabled={saving}
                  className={`group relative flex items-center gap-2.5 rounded-[5px] border p-3 transition ${
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
        {!runningAsApp && (
          <SettingsItem
            icon={<Smartphone size={18} />}
            label="Add to home screen"
            sublabel="Open your dashboard like an app"
            onClick={() => window.dispatchEvent(new Event(SHOW_INSTALL_EVENT))}
          />
        )}
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
          className="flex w-full items-center gap-3 rounded-[5px] px-4 py-3.5 text-sm font-medium text-red-500 transition hover:bg-red-50 dark:hover:bg-red-950/20"
        >
          <LogOut size={18} />
          Sign out
        </button>
      </div>



      {/* Upgrade to Pro Modal (for Free Tier) */}
      {profile && (
        <UpgradeToProModal
          isOpen={showUpgradeModal}
          onClose={() => setShowUpgradeModal(false)}
          profile={profile}
        />
      )}

      {/* Organization Renewal Modal (for Pro Tier) */}
      {profile && (
        <RenewalModal
          isOpen={showRenewalModal}
          onClose={() => setShowRenewalModal(false)}
          profile={profile}
          employeesCount={teamCount}
          onSuccess={() => {
            setShowRenewalModal(false);
            window.location.reload();
          }}
        />
      )}
    </div>
  );
}

function SettingsItem({
  icon,
  label,
  sublabel,
  badge,
  onClick,
  href,
}: {
  icon: React.ReactNode;
  label: string;
  sublabel?: string;
  badge?: string;
  onClick?: () => void;
  href?: string;
}) {
  const content = (
    <div className="flex w-full items-center justify-between gap-3 min-w-0">
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <span className="text-[var(--muted-foreground)] shrink-0">{icon}</span>
        <div className="min-w-0 text-left">
          <p className="text-sm font-medium text-[var(--foreground)] leading-snug">
            {label}
          </p>
          {sublabel && (
            <p className="text-xs text-[var(--muted-foreground)] leading-snug mt-0.5">
              {sublabel}
            </p>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0 ml-2">
        {badge && (
          <span className="font-mono text-[10px] font-semibold text-[var(--foreground)] px-2 py-0.5 rounded-full bg-[var(--accent)] border border-[var(--border)]">
            {badge}
          </span>
        )}
        {href ? (
          <ExternalLink size={14} className="text-[var(--muted-foreground)] shrink-0" />
        ) : (
          <ChevronRight size={14} className="text-[var(--muted-foreground)] shrink-0" />
        )}
      </div>
    </div>
  );

  if (href) {
    return (
      <a
        href={href}
        className="flex w-full items-center rounded-[5px] px-4 py-3 transition hover:bg-[var(--accent)] cursor-pointer"
      >
        {content}
      </a>
    );
  }

  return (
    <button
      onClick={onClick}
      className="flex w-full items-center rounded-[5px] px-4 py-3 transition hover:bg-[var(--accent)] text-left cursor-pointer"
    >
      {content}
    </button>
  );
}

export default function SettingsPage() {
  return <EmployeeGate owner={<OwnerSettingsPage />} employee={<EmployeeSettings />} />;
}
