import type { Metadata } from "next";
import DashboardShell from "@/components/layout/dashboard-shell";

/**
 * Install-as-app setup is attached ONLY to the owner dashboard — public
 * profile pages don't get a manifest, so visitors never see an install
 * banner there.
 */
export const metadata: Metadata = {
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "Namma Info",
    statusBarStyle: "black-translucent",
  },
  icons: {
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180" }],
  },
};

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return <DashboardShell>{children}</DashboardShell>;
}
