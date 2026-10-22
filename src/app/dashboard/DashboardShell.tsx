"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Home,
  User,
  ScanLine,
  Bookmark,
  Settings,
} from "lucide-react";
import { clsx } from "clsx";
import { createClient } from "@/lib/supabase/client";
import { getCurrentUser } from "@/lib/supabase/current-user";
import { useTheme } from "@/components/ThemeProvider";
import InstallAppPrompt from "@/components/InstallAppPrompt";
import RequireBusinessType from "@/components/RequireBusinessType";
import { flushPendingSaves } from "@/lib/saved-cards";

const tabs = [
  { href: "/dashboard/home", label: "Home", icon: Home },
  { href: "/dashboard/saved", label: "Saved", icon: Bookmark },
  { href: "/dashboard/scanner", label: "Scan", icon: ScanLine },
  { href: "/dashboard/profile", label: "Profile", icon: User },
  { href: "/dashboard/settings", label: "Settings", icon: Settings },
] as const;

export default function DashboardShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { colorTheme, setColorTheme } = useTheme();
  const [needsTypeFor, setNeedsTypeFor] = useState<string | null>(null);

  // Sync color theme from Supabase on first dashboard load
  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const user = await getCurrentUser();
      if (!user) return;

      // Remember this phone has an account, and save any cards that were
      // tapped while signed out.
      try {
        localStorage.setItem("nammainfo:hasAccount", "1");
      } catch {}
      flushPendingSaves();

      const { data } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

      const row = data as { theme?: string; business_name?: string | null; business_type?: string | null } | null;
      const saved = row?.theme;
      if (saved && saved !== colorTheme) {
        setColorTheme(saved);
      }

      // Business type is required for owners who have set up a business.
      // (Skipped for people who only signed up to save someone's card, and
      // until the business_type column exists.)
      if (row && "business_type" in row && !row.business_type && row.business_name?.trim()) {
        setNeedsTypeFor(user.id);
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex min-h-dvh flex-col bg-[var(--background)]">
      {/* Top bar */}
      <header className="sticky top-0 z-40 flex items-center justify-between border-b border-[var(--border)] bg-[var(--background)]/80 px-5 py-3 backdrop-blur-xl">
        <span className="font-headline text-sm font-semibold tracking-tight">
          namma info
        </span>
      </header>

      {/* Page content */}
      <main className="flex-1 pb-20">{children}</main>

      {/* "Add to home screen" — owners only (dashboard), never on public profiles */}
      {needsTypeFor ? (
        <RequireBusinessType
          userId={needsTypeFor}
          onDone={() => {
            setNeedsTypeFor(null);
            // Let open pages (e.g. Profile) pick up the new value.
            router.refresh();
          }}
        />
      ) : (
        <InstallAppPrompt />
      )}

      {/* Bottom navigation — 5 tabs */}
      <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-[var(--border)] bg-[var(--background)]/90 backdrop-blur-xl pb-safe">
        <div className="mx-auto flex max-w-lg items-center justify-around px-2 py-1.5">
          {tabs.map(({ href, label, icon: Icon }) => {
            const isActive =
              pathname === href || pathname.startsWith(href + "/");
            return (
              <Link
                key={href}
                href={href}
                className={clsx(
                  "flex flex-col items-center gap-0.5 rounded-xl px-3 py-1.5 font-mono text-[10px] font-medium transition-colors",
                  isActive
                    ? "text-[var(--foreground)]"
                    : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
                )}
              >
                <Icon
                  size={20}
                  strokeWidth={isActive ? 2.2 : 1.6}
                />
                <span>{label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
