"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Newspaper,
  User,
  ScanLine,
  Bookmark,
  Settings,
} from "lucide-react";
import { clsx } from "clsx";

const tabs = [
  { href: "/dashboard/feed", label: "Feed", icon: Newspaper },
  { href: "/dashboard/saved", label: "Saved", icon: Bookmark },
  { href: "/dashboard/scanner", label: "Scan", icon: ScanLine },
  { href: "/dashboard/profile", label: "Profile", icon: User },
  { href: "/dashboard/settings", label: "Settings", icon: Settings },
] as const;

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className="flex min-h-dvh flex-col">
      {/* Top bar */}
      <header className="sticky top-0 z-40 flex items-center justify-between border-b border-ink-100 bg-white/80 px-5 py-3 backdrop-blur-xl">
        <span className="text-sm font-semibold tracking-tight">
          namma info
        </span>
      </header>

      {/* Page content */}
      <main className="flex-1 pb-20">{children}</main>

      {/* Bottom navigation — 5 tabs */}
      <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-ink-100 bg-white/90 backdrop-blur-xl pb-safe">
        <div className="mx-auto flex max-w-lg items-center justify-around px-2 py-1.5">
          {tabs.map(({ href, label, icon: Icon }) => {
            const isActive =
              pathname === href || pathname.startsWith(href + "/");
            return (
              <Link
                key={href}
                href={href}
                className={clsx(
                  "flex flex-col items-center gap-0.5 rounded-xl px-3 py-1.5 text-[10px] font-medium transition-colors",
                  isActive
                    ? "text-ink-950"
                    : "text-ink-400 hover:text-ink-600"
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
