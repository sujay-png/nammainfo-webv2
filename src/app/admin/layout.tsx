import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Admin Console • Namma Info",
  description: "Administrative portal for company subscriptions, employee IDs, and accounts.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[var(--background)] antialiased font-sans">
      {children}
    </div>
  );
}
