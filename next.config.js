/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },
  // Browser auth/database calls go through our own domain, because some
  // networks block *.supabase.co (see src/supabase/client.ts).
  async rewrites() {
    const supabase = (process.env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\/$/, "");
    if (!supabase) return [];
    return [
      { source: "/sb/auth/v1/:path*", destination: `${supabase}/auth/v1/:path*` },
      { source: "/sb/rest/v1/:path*", destination: `${supabase}/rest/v1/:path*` },
      { source: "/sb/functions/v1/:path*", destination: `${supabase}/functions/v1/:path*` },
    ];
  },
  async headers() {
    return [
      {
        source: "/.well-known/apple-app-site-association",
        headers: [{ key: "Content-Type", value: "application/json" }],
      },
      {
        source: "/.well-known/assetlinks.json",
        headers: [{ key: "Content-Type", value: "application/json" }],
      },
      {
        // Public profile pages — short CDN cache so edits appear quickly
        // Only real profile pages — not /dashboard, /signup, etc. (those
        // matched "/:slug" too and were being marked publicly cacheable).
        source:
          "/:slug((?!(?:dashboard|signup|onboarding|forgot-password|reset-password|auth|api|c)(?:/|$))[^/.]+)",
        headers: [
          {
            key: "Cache-Control",
            value: "public, s-maxage=30, stale-while-revalidate=120",
          },
          {
            key: "Vercel-CDN-Cache-Control",
            value: "s-maxage=30, stale-while-revalidate=120",
          },
        ],
      },
      {
        source:
          "/:slug((?!(?:dashboard|signup|onboarding|forgot-password|reset-password|auth|api|c)(?:/|$))[^/.]+)/:employee",
        headers: [
          {
            key: "Cache-Control",
            value: "public, s-maxage=30, stale-while-revalidate=120",
          },
          {
            key: "Vercel-CDN-Cache-Control",
            value: "s-maxage=30, stale-while-revalidate=120",
          },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
