import type { Metadata, Viewport } from "next";
import "./globals.css";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { themes } from "@/lib/themes";

// slug -> { light: vars, dark: vars }, inlined into the no-flash script.
const themeBootstrapJson = JSON.stringify(
  Object.fromEntries(themes.map((t) => [t.slug, t.colors]))
).replace(/</g, "\\u003c");

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL ?? "https://nammainfo.in"
  ),
  title: {
    default: "Namma Info",
    template: "%s · Namma Info",
  },
  description:
    "Your digital identity. Tap, scan, or share your Namma Info card to connect instantly.",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/icons/favicon-32.png", type: "image/png", sizes: "32x32" },
      { url: "/icons/icon-192.png", type: "image/png", sizes: "192x192" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180" }],
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#FFFFFF" },
    { media: "(prefers-color-scheme: dark)", color: "#0A0A0A" },
  ],
  // Declares that the site supports both schemes natively, so mobile
  // browsers don't apply their own forced/auto dark mode on top of it.
  colorScheme: "light dark",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=Geist:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
        {/* Landing page display fonts. Font files only download on pages that use them. */}
        <link
          href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,400..800&family=Caveat:wght@600&display=swap"
          rel="stylesheet"
        />
        {/* Just the four Kannada letters used on the home page (ನಮ್ಮ), a few KB. */}
        <link
          href="https://fonts.googleapis.com/css2?family=Noto+Sans+Kannada:wght@800&text=%E0%B2%A8%E0%B2%AE%E0%B3%8D%E0%B2%AE&display=swap"
          rel="stylesheet"
        />
        {/* Inline script: applies the saved light/dark/system choice AND
            the saved colour theme before first paint, so there's no flash
            and no half-applied theme while JS loads. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var THEMES = ${themeBootstrapJson};
                  var pref = localStorage.getItem('theme');
                  var dark = pref === 'dark' || ((pref !== 'light') && window.matchMedia('(prefers-color-scheme: dark)').matches);
                  var root = document.documentElement;
                  if (dark) root.classList.add('dark');
                  root.style.colorScheme = dark ? 'dark' : 'light';
                  var t = THEMES[localStorage.getItem('colorTheme') || 'default'] || THEMES['default'];
                  var vars = t[dark ? 'dark' : 'light'];
                  for (var k in vars) root.style.setProperty(k, vars[k]);
                } catch(e) {}
              })();
            `,
          }}
        />
      </head>
      <body className="min-h-dvh bg-[var(--background)] font-body text-[var(--foreground)] antialiased">
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
