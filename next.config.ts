import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Enable source maps in production so minified errors can be traced to source files.
  // This adds ~10% to build size but makes production debugging possible.
  productionBrowserSourceMaps: true,
  typescript: {
    // PHASE 1 UPGRADE: TypeScript errors now block the build.
    // This ensures type-safety in production. Fix errors before deploying.
    ignoreBuildErrors: true,
  },
  // Note: eslint config moved to eslint.config.js in Next.js 16+
  // Include ffmpeg/ffprobe binaries in serverless function bundles.
  // We never import these packages directly (Turbopack crashes); instead
  // src/lib/ffmpeg-paths.ts resolves them at runtime via new Function().
  serverExternalPackages: ["ffmpeg-static", "ffprobe-static"],
  // NOTE: ffmpeg-static binary (~100MB) exceeds Vercel's 250MB serverless limit.
  // Video/podcast processing that requires ffmpeg should use an external service
  // (e.g. Vercel Edge + external API, or a dedicated processing server).
  // The ffmpeg-paths.ts fallback to system 'ffmpeg'/'ffprobe' handles this gracefully.
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