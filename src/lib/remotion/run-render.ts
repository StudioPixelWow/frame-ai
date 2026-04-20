/**
 * PixelFrameAI — Remotion Render Execution (runtime-only)
 *
 * This module is the ONLY place that touches @remotion/bundler and
 * @remotion/renderer.  Both are loaded via dynamic `await import(...)`
 * INSIDE the exported function, so no top-level import exists.
 *
 * No App-Router code may statically import this file.
 * process-job.ts loads it with:
 *   const { runRender } = await import("@/lib/remotion/run-render");
 *
 * That two-hop dynamic-import chain guarantees Turbopack/webpack
 * never traverses into Remotion's native binaries at build time.
 */
import path from "path";
import fs from "fs";

const tag = "[RunRender]";

export interface RenderResult {
  outputPath: string;
  width: number;
  height: number;
  durationInFrames: number;
  fps: number;
  sizeBytes: number;
}

export interface RenderOptions {
  compositionId: string;
  inputProps: Record<string, unknown>;
  onProgress?: (pct: number, stage: string) => void;
}

/**
 * Resolve a writable directory for the rendered output.
 */
function getOutputDir(): string {
  const preferred = path.join(process.cwd(), "public/renders");
  try {
    if (!fs.existsSync(preferred)) fs.mkdirSync(preferred, { recursive: true });
    const probe = path.join(preferred, ".probe");
    fs.writeFileSync(probe, "");
    fs.unlinkSync(probe);
    return preferred;
  } catch {
    const tmp = "/tmp/pixelframe-renders";
    if (!fs.existsSync(tmp)) fs.mkdirSync(tmp, { recursive: true });
    return tmp;
  }
}

/**
 * Bundle the Remotion project, select the composition, render to MP4.
 *
 * @remotion/bundler and @remotion/renderer are loaded dynamically
 * inside this function — they are NOT top-level imports.
 */
export async function runRender(
  jobId: string,
  opts: RenderOptions,
): Promise<RenderResult> {
  const { compositionId, inputProps, onProgress } = opts;

  // ── Dynamic-import Remotion (runtime only) ──
  // These packages are listed in next.config.ts serverExternalPackages
  // so Turbopack skips parsing them but Vercel still deploys them.
  const { bundle } = await import("@remotion/bundler");
  const { renderMedia, selectComposition } = await import("@remotion/renderer");
  console.log(`${tag} Remotion packages loaded at runtime`);

  // ── Bundle ──
  const entryPoint = path.join(process.cwd(), "src/remotion/index.ts");
  if (!fs.existsSync(entryPoint)) {
    throw new Error(`Remotion entry point not found: ${entryPoint}`);
  }

  console.log(`${tag} Bundling from: ${entryPoint}`);
  onProgress?.(8, "מכין חבילת רינדור");

  const serveUrl = await bundle({
    entryPoint,
    onProgress: (p: number) => {
      if (p % 25 === 0) console.log(`${tag} Bundle: ${p}%`);
    },
  });
  console.log(`${tag} Bundle ready: ${serveUrl}`);

  // ── Select composition (resolves dimensions + duration from inputProps) ──
  onProgress?.(15, "טוען קבצי מקור");
  console.log(`${tag} Selecting composition: ${compositionId}`);

  const composition = await selectComposition({
    serveUrl,
    id: compositionId,
    inputProps,
  });

  console.log(
    `${tag} Composition: ${composition.width}x${composition.height}, ` +
    `${composition.durationInFrames}f @ ${composition.fps}fps ` +
    `(${(composition.durationInFrames / composition.fps).toFixed(1)}s)`,
  );

  // ── Render ──
  const outputDir = getOutputDir();
  const outputPath = path.join(outputDir, `render-${jobId}.mp4`);
  console.log(`${tag} renderMedia → ${outputPath}`);
  onProgress?.(20, "מתחיל רינדור");

  await renderMedia({
    composition,
    serveUrl,
    codec: "h264",
    outputLocation: outputPath,
    inputProps,
    onProgress: ({ progress }) => {
      const pct = Math.round(20 + progress * 65);
      const stage =
        progress < 0.3 ? "מעבד קטעי וידאו" :
        progress < 0.6 ? "משלב אפקטים וכתוביות" :
        progress < 0.9 ? "מחיל שיפורים פרימיום" :
        "רינדור סופי";
      onProgress?.(pct, stage);
    },
  });

  // ── Validate ──
  if (!fs.existsSync(outputPath)) {
    throw new Error("renderMedia completed but output file missing");
  }
  const stats = fs.statSync(outputPath);
  if (stats.size < 1024) {
    try { fs.unlinkSync(outputPath); } catch { /* */ }
    throw new Error(`Rendered file too small: ${stats.size} bytes`);
  }

  console.log(`${tag} Render done: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);

  return {
    outputPath,
    width: composition.width,
    height: composition.height,
    durationInFrames: composition.durationInFrames,
    fps: composition.fps,
    sizeBytes: stats.size,
  };
}
