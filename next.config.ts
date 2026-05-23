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
  // Include ffmpeg/ffprobe binaries in serverless function bundles.
  // We never import these packages directly (Turbopack crashes); instead
  // src/lib/ffmpeg-paths.ts resolves them at runtime via new Function().
  serverExternalPackages: ["ffmpeg-static", "ffprobe-static"],
  // Force Vercel's @vercel/nft file tracer to include ffmpeg/ffprobe binaries
  // in ALL API route serverless functions. Required because our `new Function()`
  // dynamic require is invisible to static analysis.
  // NOTE: In Next.js 16+, this is a TOP-LEVEL config option (not inside experimental).
  outputFileTracingIncludes: {
    "/api/*": [
      "./node_modules/ffmpeg-static/ffmpeg",
      "./node_modules/ffmpeg-static/package.json",
      "./node_modules/ffprobe-static/bin/**/*",
      "./node_modules/ffprobe-static/package.json",
      "./node_modules/ffprobe-static/index.js",
    ],
  },
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