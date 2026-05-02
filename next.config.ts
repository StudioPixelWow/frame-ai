import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  // Remotion rendering runs in an external worker (worker.ts), NOT inside
  // Next.js routes. No serverExternalPackages needed — the App never imports them.
  // Allow large file uploads (video files up to 500 MB)
  experimental: {
    serverActions: {
      bodySizeLimit: "500mb",
    },
    // Raise the body clone / proxy limit so large uploads reach route handlers intact
    // Default is 10MB — too small for video files
    proxyClientMaxBodySize: "500mb",
  },
};

export default nextConfig;