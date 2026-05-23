/**
 * FFmpeg / FFprobe binary path resolution for Vercel serverless.
 *
 * The npm packages `ffmpeg-static` and `ffprobe-static` install
 * platform-specific binaries. Their main exports return the binary path.
 *
 * IMPORTANT: We CANNOT use normal `import` or `require()` because
 * Turbopack (Next.js 16+) evaluates those at build time, which crashes
 * when the binary path is undefined on the build machine.
 *
 * Instead we use `new Function(...)` which Turbopack passes through
 * without evaluating. At runtime on Vercel, Node.js's native require
 * resolves the package normally.
 */

let _ffmpegPath: string | null = null;
let _ffprobePath: string | null = null;

/**
 * Safely require a package at runtime, bypassing Turbopack static analysis.
 */
function safeRequire(packageName: string): unknown {
  try {
    // Use Function constructor to create a runtime require that Turbopack
    // cannot statically analyze. At runtime this executes as a normal
    // Node.js require().
    return new Function("name", "return require(name)")(packageName);
  } catch {
    return undefined;
  }
}

/**
 * Resolve the ffmpeg binary path.
 * Tries the `ffmpeg-static` npm package first, falls back to system PATH.
 */
export function getFfmpegPath(): string {
  if (_ffmpegPath) return _ffmpegPath;

  const resolved = safeRequire("ffmpeg-static");
  console.log("[ffmpeg-paths] ffmpeg-static resolved:", typeof resolved, resolved ? String(resolved).slice(0, 120) : "undefined");
  if (typeof resolved === "string" && resolved.length > 0) {
    _ffmpegPath = resolved;
    return resolved;
  }

  console.warn("[ffmpeg-paths] ⚠️ ffmpeg-static not found, falling back to system 'ffmpeg'");
  _ffmpegPath = "ffmpeg";
  return "ffmpeg";
}

/**
 * Resolve the ffprobe binary path.
 * Tries the `ffprobe-static` npm package first, falls back to system PATH.
 */
export function getFfprobePath(): string {
  if (_ffprobePath) return _ffprobePath;

  const resolved = safeRequire("ffprobe-static") as
    | { path?: string }
    | undefined;
  console.log("[ffmpeg-paths] ffprobe-static resolved:", typeof resolved, resolved ? JSON.stringify(resolved).slice(0, 120) : "undefined");
  if (resolved && typeof resolved.path === "string") {
    _ffprobePath = resolved.path;
    return resolved.path;
  }

  console.warn("[ffmpeg-paths] ⚠️ ffprobe-static not found, falling back to system 'ffprobe'");
  _ffprobePath = "ffprobe";
  return "ffprobe";
}
