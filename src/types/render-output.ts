/**
 * PixelFrameAI — Render Output Types
 *
 * Types for the durable render output record layer.
 * A `render_outputs` row is a permanent deliverable — unlike
 * `render_jobs` which is ephemeral job state.
 *
 * Every completed render creates one output record with a monotonic
 * per-project version number. Only one output per project has
 * `isPrimary = true` at any time.
 *
 * Builds on: Phase 6.5 (render_jobs), Phase 6.2 (storage keys),
 *            Phase 6.3 (project persistence)
 */

// ── Output status lifecycle ───────────────────────────────────────────────

export type OutputStatus = "available" | "archived" | "deleted";

// ── Output format metadata ────────────────────────────────────────────────

export interface OutputFormat {
  formatId: string;       // 'mp4'
  codec: string;          // 'h264' | 'hevc' — verified by ffprobe
  width: number;          // e.g. 1080
  height: number;         // e.g. 1920
  aspectRatio: string;    // '9:16' | '1:1' | '4:5' | '16:9'
}

// ── Signed URL bundle ─────────────────────────────────────────────────────

export interface OutputUrls {
  downloadUrl: string;       // 1-hour TTL, Content-Disposition: attachment
  previewUrl: string;        // 4-hour TTL, Content-Disposition: inline
  thumbUrl: string | null;   // 1-hour TTL, null if not yet generated
}

// ── Output metadata (used at INSERT time) ─────────────────────────────────

export interface OutputMeta extends OutputFormat {
  durationSec: number;       // actual rendered duration from ffprobe
  fileSizeBytes: number;
  outputKey: string;         // 'renders/{uid}/{pid}/{roId}/output.mp4'
  thumbKey: string | null;   // 'renders/{uid}/{pid}/{roId}/thumb.jpg'
}

// ── Full DB record ────────────────────────────────────────────────────────

export interface RenderOutputRecord {
  // Identity
  id: string;
  projectId: string;
  renderJobId: string;
  userId: string;

  // Versioning
  versionNumber: number;       // 1-indexed, monotonic per project
  label: string | null;        // optional user-assigned label
  isPrimary: boolean;          // only one per project is true

  // Lifecycle
  status: OutputStatus;
  createdAt: string;           // ISO 8601
  archivedAt: string | null;
  deletedAt: string | null;

  // Format metadata
  formatId: string;
  codec: string;
  width: number;
  height: number;
  aspectRatio: string;
  durationSec: number;
  fileSizeBytes: number;

  // Storage
  outputKey: string;
  thumbKey: string | null;

  // Provenance
  presetId: string;
  presetLabel: string;         // denormalised for display stability
  renderConfigSnapshot: Record<string, unknown>; // full RenderPayload v2.2
}

// ── API list response item ────────────────────────────────────────────────

/**
 * Shape returned by `GET /api/projects/:projectId/outputs`.
 * Used by both the primary output hero card and version history list.
 *
 * Signed URLs are generated fresh on every request — never stored in DB.
 */
export interface OutputListItem {
  id: string;
  versionNumber: number;
  label: string | null;
  isPrimary: boolean;
  status: "available" | "archived";
  createdAt: string;           // ISO 8601

  // Format metadata
  formatId: string;
  codec: string;
  width: number;
  height: number;
  aspectRatio: string;
  durationSec: number;
  fileSizeMb: number;          // pre-computed: file_size_bytes / 1_048_576

  // Provenance
  presetId: string;
  presetLabel: string;

  // Signed URLs (generated at request time)
  downloadUrl: string;         // 1-hour TTL
  previewUrl: string;          // 4-hour TTL
  thumbUrl: string | null;     // 1-hour TTL
}

// ── PATCH request body ────────────────────────────────────────────────────

export interface OutputUpdatePayload {
  label?: string;
  isPrimary?: boolean;
  status?: "available" | "archived";
}

// ── Comparison (future endpoint) ──────────────────────────────────────────

export interface OutputComparisonDiff {
  preset: { a: string; b: string } | null;
  clipRange: { a: { startSec: number; endSec: number }; b: { startSec: number; endSec: number } } | null;
  targetDuration: { a: number; b: number } | null;
  subtitleStyle: { a: Record<string, unknown>; b: Record<string, unknown> } | null;
  creativePrompt: { a: string | null; b: string | null } | null;
}

export interface OutputComparisonResult {
  outputA: OutputListItem;
  outputB: OutputListItem;
  diff: OutputComparisonDiff;
}
