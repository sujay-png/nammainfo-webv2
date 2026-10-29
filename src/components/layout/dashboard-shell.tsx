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
import { createClient } from "@/supabase/client";
import { getCurrentUser } from "@/supabase/current-user";
import { useTheme } from "@/hooks/use-theme";
import InstallAppPrompt from "@/features/install-app/components/add-to-home-screen-popup";
import { AccountProvider } from "@/components/providers/account-provider";
import RequireBusinessType from "@/features/business-type/components/business-type-required-popup";
import { flushPendingSaves } from "@/features/saved-cards/services/saved-cards.service";

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
  const [isStandalone, setIsStandalone] = useState(false);
  const [needsTypeFor, setNeedsTypeFor] = useState<string | null>(null);

  useEffect(() => {
    // Detect if running in standalone PWA / Add to Home Screen mode
    const checkStandalone = () => {
      const isStandaloneMode =
        window.matchMedia("(display-mode: standalone)").matches ||
        (navigator as unknown as { standalone?: boolean }).standalone === true ||
        document.referrer.includes("android-app://");
      setIsStandalone(Boolean(isStandaloneMode));
    };

    checkStandalone();
    const mediaQuery = window.matchMedia("(display-mode: standalone)");
    mediaQuery.addEventListener?.("change", checkStandalone);
    return () => {
      mediaQuery.removeEventListener?.("change", checkStandalone);
    };
  }, []);

  // Sync color theme and bounce admin accounts out of user dashboard
  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const user = await getCurrentUser();
      if (!user) return;

      const isAdminClaim =
        user.app_metadata?.is_admin === true ||
        user.app_metadata?.role === "admin";

      if (isAdminClaim) {
        router.replace("/admin");
        return;
      }

      const { data: adminProf } = await supabase
        .from("profiles")
        .select("is_admin")
        .eq("id", user.id)
        .maybeSingle();

      if (adminProf?.is_admin) {
        router.replace("/admin");
        return;
      }

      // Remember this phone has an account, and save any cards that were
      // tapped while signed out.
      try {
        localStorage.setItem("nammainfo:hasAccount", "1");
      } catch {}
      flushPendingSaves();

      // Employees use their company's colour theme; nothing else to set up.
      if ((user.user_metadata as { role?: string } | undefined)?.role === "employee") {
        const { data: rec } = await supabase.rpc("my_employee_record");
        const ownerTheme = (Array.isArray(rec) ? rec[0] : rec)?.owner_theme as string | undefined;
        if (ownerTheme && ownerTheme !== colorTheme) setColorTheme(ownerTheme);
        return;
      }

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
  }, [router]);

  return (
    <AccountProvider>
    <div className="flex min-h-dvh flex-col bg-[var(--background)]">
      {/* Top bar — hidden when added to home screen (PWA standalone mode) */}
      <header
        className={clsx(
          "sticky top-0 z-40 items-center justify-between border-b border-[var(--border)] bg-[var(--background)]/80 px-5 py-3 backdrop-blur-xl pwa-hide-header transition-all",
          isStandalone ? "hidden" : "flex"
        )}
      >
        <span className="font-headline text-sm font-semibold tracking-tight">
          namma info
        </span>
      </header>

      {/* Page content */}
      <main className={clsx("flex-1 pb-24", isStandalone && "pt-safe pwa-standalone-main")}>
        {children}
      </main>

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

      {/* Bottom navigation — 5 tabs with popped center scan button */}
      <nav className="fixed inset-x-0 bottom-0 z-50 overflow-visible border-t border-[var(--border)] bg-[var(--background)]/90 backdrop-blur-xl pb-safe">
        <div className="relative mx-auto flex max-w-lg items-center justify-around px-2 py-1.5 overflow-visible">
          {tabs.map(({ href, label, icon: Icon }, index) => {
            const isActive =
              pathname === href || pathname.startsWith(href + "/");
            const isCenter = index === 2;

            if (isCenter) {
              return (
                <Link
                  key={href}
                  href={href}
                  className="relative -top-5 flex flex-col items-center group cursor-pointer"
                  aria-label="Scan Card"
                >
                  <div
                    className={clsx(
                      "flex h-14 w-14 items-center justify-center rounded-full border-4 border-[var(--background)] transition-all duration-200 active:scale-95",
                      isActive
                        ? "bg-[var(--primary)] text-[var(--primary-foreground)] shadow-[0_8px_24px_rgba(0,0,0,0.28)] ring-2 ring-[var(--primary)] scale-105"
                        : "bg-[var(--primary)] text-[var(--primary-foreground)] shadow-[0_6px_18px_rgba(0,0,0,0.18)] hover:scale-105"
                    )}
                  >
                    <Icon size={24} strokeWidth={2.4} />
                  </div>
                  <span
                    className={clsx(
                      "mt-0.5 font-mono text-[10px] font-semibold transition-colors",
                      isActive
                        ? "text-[var(--foreground)]"
                        : "text-[var(--muted-foreground)] group-hover:text-[var(--foreground)]"
                    )}
                  >
                    {label}
                  </span>
                </Link>
              );
            }

            return (
              <Link
                key={href}
                href={href}
                className={clsx(
                  "flex flex-col items-center gap-0.5 rounded-[5px] px-3 py-1.5 font-mono text-[10px] font-medium transition-colors",
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
    </AccountProvider>
  );
}
