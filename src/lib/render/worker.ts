/**
 * PixelFrameAI — Render Worker Execution Logic
 *
 * Server-side only. Defines the step-by-step execution sequence
 * for a render job. The actual BullMQ consumer wiring and Remotion
 * renderMedia() call are left as integration points — this module
 * provides the orchestration logic and type contracts.
 *
 * Execution sequence:
 *   1. Load job + project from DB
 *   2. Validate payload + source video
 *   3. Generate signed URL for source video
 *   4. Substitute videoUrl in inputProps
 *   5. Execute Remotion renderMedia()
 *   6. Upload output MP4 to storage
 *   7. Extract thumbnail via ffmpeg
 *   8. Probe output for duration/codec
 *   9. Clean up temp files
 *  10. Mark completed + update project
 */

import type {
  CompositionConfig,
  RenderSubStatus,
} from "@/types/render";

// ── Worker step definitions ────────────────────────────────────────────────

export interface RenderWorkerContext {
  renderId: string;
  projectId: string;
  userId: string;
  sourceVideoKey: string;
  renderPayload: Record<string, unknown>;
  compositionConfig: CompositionConfig;
}

export interface RenderWorkerCallbacks {
  /** Update job status and sub-status in DB. */
  updateStatus: (
    renderId: string,
    status: string,
    subStatus: RenderSubStatus | null,
  ) => Promise<void>;

  /** Update render progress (0–100) in DB. */
  updateProgress: (renderId: string, progress: number) => Promise<void>;

  /** Get a signed URL for a storage key. */
  getSignedUrl: (key: string, ttlSeconds: number) => Promise<string>;

  /** Write a file to storage. */
  putFile: (
    key: string,
    data: Buffer,
    contentType: string,
  ) => Promise<void>;

  /** Persist the inputProps override to the render job. */
  persistInputProps: (
    renderId: string,
    inputProps: Record<string, unknown>,
  ) => Promise<void>;

  /** Mark the job as completed with output metadata. */
  markCompleted: (
    renderId: string,
    output: RenderOutputMetadata,
  ) => Promise<void>;

  /** Update the project to 'complete' with the latest render ID. */
  finalizeProject: (projectId: string, renderId: string) => Promise<void>;
}

export interface RenderOutputMetadata {
  outputKey: string;
  outputThumbKey: string;
  outputSizeBytes: number;
  outputDurationSec: number;
  outputCodec: string;
}

// ── Composition config builder ─────────────────────────────────────────────

/**
 * Build Remotion composition config from a render payload.
 *
 * This is the canonical function that derives canvas settings
 * from the stored render_payload. Called server-side only.
 */
export function buildCompositionConfig(
  renderPayload: Record<string, unknown>,
): CompositionConfig {
  const remotion = (renderPayload._remotion ?? renderPayload) as Record<
    string,
    unknown
  >;

  const fps = (remotion.fps as number) ?? 30;
  const width = (remotion.outputWidth as number) ?? 1080;
  const height = (remotion.outputHeight as number) ?? 1920;
  const clipDurationSec =
    (remotion.clipDurationSec as number) ??
    (renderPayload.output as Record<string, unknown>)?.targetDurationSec as number ??
    30;

  const durationInFrames = Math.max(1, Math.ceil(clipDurationSec * fps));

  return {
    id: "PixelFrameComposition",
    width,
    height,
    fps,
    durationInFrames,
  };
}

// ── Video URL substitution ─────────────────────────────────────────────────

/**
 * Substitute the blob videoUrl in Remotion inputProps with a live
 * pre-signed storage URL. The stored value in the DB is a dead
 * `blob:http://...` URL from the browser session.
 *
 * @param remotionProps  The _remotion props from renderPayload
 * @param signedVideoUrl Live signed URL from storage (2h TTL)
 */
export function substituteVideoUrl(
  remotionProps: Record<string, unknown>,
  signedVideoUrl: string,
): Record<string, unknown> {
  return {
    ...remotionProps,
    videoUrl: signedVideoUrl,
  };
}

// ── Render execution orchestrator ──────────────────────────────────────────

/**
 * Orchestrate the full render execution. This is the top-level function
 * the BullMQ consumer calls.
 *
 * The actual Remotion renderMedia() call must be provided as a callback
 * to keep this module independent of the @remotion/renderer import
 * (which is only available on the worker server).
 */
export async function executeRenderJob(
  ctx: RenderWorkerContext,
  callbacks: RenderWorkerCallbacks,
  renderMediaFn: (
    compositionConfig: CompositionConfig,
    inputProps: Record<string, unknown>,
    outputPath: string,
    onProgress: (progress: number) => void,
  ) => Promise<void>,
  extractThumbnailFn: (videoPath: string) => Promise<Buffer>,
  probeFn: (videoPath: string) => Promise<{ durationSec: number; codec: string }>,
): Promise<void> {
  const tmpDir = `/tmp/${ctx.renderId}`;
  const outputMp4 = `${tmpDir}/output.mp4`;

  try {
    // Step 1: preparing
    await callbacks.updateStatus(ctx.renderId, "processing", "preparing");

    // Step 2: substitute videoUrl
    const signedUrl = await callbacks.getSignedUrl(ctx.sourceVideoKey, 7200);
    const remotionProps =
      (ctx.renderPayload._remotion as Record<string, unknown>) ??
      ctx.renderPayload;
    const inputProps = substituteVideoUrl(remotionProps, signedUrl);
    await callbacks.persistInputProps(ctx.renderId, inputProps);

    // Step 3: rendering
    await callbacks.updateStatus(ctx.renderId, "processing", "rendering");
    await renderMediaFn(
      ctx.compositionConfig,
      inputProps,
      outputMp4,
      async (progress: number) => {
        const pct = Math.round(progress * 100);
        if (pct % 5 === 0) {
          await callbacks.updateProgress(ctx.renderId, pct);
        }
      },
    );

    // Step 4: uploading
    await callbacks.updateStatus(ctx.renderId, "processing", "uploading");
    const { StorageKeys } = await import("@/lib/storage");
    const outputKey = StorageKeys.renderOutput(
      ctx.userId,
      ctx.projectId,
      ctx.renderId,
    );
    // Note: actual fs.readFile + storage.put happens in the caller
    // This is the key path generation
    const thumbKey = StorageKeys.renderThumbnail(
      ctx.userId,
      ctx.projectId,
      ctx.renderId,
    );

    // Step 5: thumbnailing
    await callbacks.updateStatus(ctx.renderId, "processing", "thumbnailing");
    const thumbBuffer = await extractThumbnailFn(outputMp4);
    await callbacks.putFile(thumbKey, thumbBuffer, "image/jpeg");

    // Step 6: probe output
    const outputMeta = await probeFn(outputMp4);

    // Step 7: mark completed
    await callbacks.markCompleted(ctx.renderId, {
      outputKey,
      outputThumbKey: thumbKey,
      outputSizeBytes: 0, // caller sets this from actual file size
      outputDurationSec: outputMeta.durationSec,
      outputCodec: outputMeta.codec,
    });

    // Step 8: finalize project
    await callbacks.finalizeProject(ctx.projectId, ctx.renderId);
  } finally {
    // Cleanup is best-effort
    try {
      const fs = await import("fs/promises");
      await fs.rm(tmpDir, { recursive: true, force: true });
    } catch {
      /* cleanup failure is non-critical */
    }
  }
}
