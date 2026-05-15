import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Enable source maps in production so minified errors can be traced to source files.
  // This adds ~10% to build size but makes production debugging possible.
  productionBrowserSourceMaps: true,
  typescript: {
    // PHASE 1 UPGRADE: TypeScript errors now block the build.
    // This ensures type-safety in production. Fix errors before deploying.
    ignoreBuildErrors: false,
  },
  // Note: eslint config moved to eslint.config.js in Next.js 16+
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