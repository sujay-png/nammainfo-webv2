import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "https://nammainfo.com"),
  title: {
    default: "Namma Info — Digital business cards that just work",
    template: "%s · Namma Info",
  },
  description:
    "Tap, scan, or share your Namma Info card to connect instantly — no app required.",
  icons: { icon: "/favicon.ico" },
};

export const viewport: Viewport = {
  themeColor: "#2B0E09",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-dvh font-sans text-ink-900 antialiased">
        {children}
      </body>
    </html>
  );
}
