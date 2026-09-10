/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  compress: true,
  images: {
    // Cloud object storage domains (fill in production bucket/CDN host)
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**.r2.cloudflarestorage.com",
      },
      {
        // Cloudflare R2 public dev subdomain (pub-xxxx.r2.dev)
        protocol: "https",
        hostname: "**.r2.dev",
      },
      {
        // Atomic Pathshala's custom R2 CDN domain (STORAGE_PUBLIC_URL).
        // Without this, next/image refuses to render uploaded question /
        // profile / module images served from the bucket.
        protocol: "https",
        hostname: "assets.atomicpathshala.in",
      },
      {
        protocol: "https",
        hostname: "**.supabase.co",
      },
      {
        protocol: "https",
        hostname: "**.amazonaws.com",
      },
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com",
      },
    ],
  },
  experimental: {
    // `@heroicons/react` was listed but isn't a dependency — dropped.
    // Both remaining entries are barrel-heavy packages imported across many
    // client bundles; per-icon / per-function import rewriting keeps route
    // chunks small.
    optimizePackageImports: ["lucide-react", "date-fns"],
    serverActions: {
      bodySizeLimit: "10mb",
    },
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(self), microphone=(self), geolocation=()" },
        ],
      },
      {
        // The service worker must never be held in the HTTP cache, so a
        // deploy's new sw.js is picked up on the next visit. Allow it to
        // control the whole origin.
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "public, max-age=0, must-revalidate" },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
      {
        source: "/manifest.webmanifest",
        headers: [{ key: "Cache-Control", value: "public, max-age=3600" }],
      },
    ];
  },
};

export default nextConfig;
