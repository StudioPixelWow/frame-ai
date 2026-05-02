/**
 * PixelManageAI — Render Job Types
 *
 * Types for the full render job lifecycle — from approval through
 * to a downloadable MP4. Covers the status machine, Remotion composition
 * config, and the input props contract.
 */

import type { SubtitleStyleSpec } from "./persistence";

// ── Status machine ─────────────────────────────────────────────────────────

export type RenderJobStatus =
  | "queued"      // in queue, worker hasn't started
  | "processing"  // worker is actively executing
  | "completed"   // MP4 uploaded, output_key written
  | "failed"      // error occurred; may retry
  | "exhausted";  // all retries failed

export type RenderSubStatus =
  | "preparing"     // validating payload, generating signed URL
  | "rendering"     // Remotion renderMedia() running (progress 0–100)
  | "uploading"     // output MP4 being streamed to storage
  | "thumbnailing"; // ffmpeg extracting first frame

// ── Composition config ─────────────────────────────────────────────────────

/**
 * Canvas settings derived from RenderPayload at job creation time.
 * Passed to Remotion's renderMedia() as the composition definition.
 */
export interface CompositionConfig {
  id: string;           // 'PixelManageComposition'
  width: number;
  height: number;
  fps: number;
  durationInFrames: number;
}

// ── Remotion input props ───────────────────────────────────────────────────

/**
 * The exact interface the PixelManageComposition React component receives.
 * The worker passes this to renderMedia() verbatim (after videoUrl substitution).
 */
export interface PixelManageInputProps {
  // Source video
  videoUrl: string;       // signed CDN URL (substituted by worker — never blob)
  videoWidth: number;
  videoHeight: number;
  videoDuration: number;

  // Clip selection
  clipStartSec: number;
  clipEndSec: number;
  clipDurationSec: number;

  // Output format
  outputWidth: number;
  outputHeight: number;
  outputFormat: string;   // '9:16' | '16:9' | '1:1' | '4:5'

  // Brand / preset
  presetId: string;
  colorPalette: Record<string, unknown>;
  fontConfig: Record<string, unknown>;

  // Subtitles
  subtitle: {
    mode: "automatic" | "manual" | "none";
    segments: SubtitleSegment[];
    style: SubtitleStyleSpec;
    font: Record<string, unknown>;
  };

  // Render config
  editStyle: string;
  pacingStyle: string;
  editIntensity: number;
  transitionPreference: string;
  motionIntensity: number;

  // Metadata
  projectTitle: string;
  speechLang: string;
}

export interface SubtitleSegment {
  id: string;
  text: string;
  startMs: number;
  endMs: number;
}

// ── Render job record ──────────────────────────────────────────────────────

export interface RenderJob {
  id: string;
  projectId: string;
  status: RenderJobStatus;
  subStatus: RenderSubStatus | null;
  attempt: number;
  maxAttempts: number;
  progress: number; // 0–100
  error: string | null;
  compositionConfig: CompositionConfig | null;
  inputPropsOverride: Record<string, unknown> | null;
  outputKey: string | null;
  outputThumbKey: string | null;
  outputSizeBytes: number | null;
  outputDurationSec: number | null;
  outputCodec: string | null;
  queuedAt: string | null;
  startedAt: string | null;
  finishedAt: string | null;
}

// ── API responses ──────────────────────────────────────────────────────────

export interface RenderStatusResponse {
  renderId: string;
  status: RenderJobStatus;
  subStatus: RenderSubStatus | null;
  progress: number;
  url: string | null;       // signed MP4 URL (null until completed)
  thumbUrl: string | null;  // signed JPEG URL (null until completed)
  error: string | null;
  durationSec: number | null;
  sizeMb: number | null;
  startedAt: string | null;
  finishedAt: string | null;
}

export interface SubmitRenderResponse {
  renderId: string;
}
