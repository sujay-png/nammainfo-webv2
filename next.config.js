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
        source: "/:slug",
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
        source: "/:slug/:employee",
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
