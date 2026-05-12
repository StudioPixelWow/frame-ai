import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Enable source maps in production so minified errors can be traced to source files.
  // This adds ~10% to build size but makes production debugging possible.
  productionBrowserSourceMaps: true,
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
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