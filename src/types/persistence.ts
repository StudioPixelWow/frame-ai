/**
 * PixelFrameAI — Project Persistence Types
 *
 * The complete, serialisable snapshot of a wizard session.
 * Stored verbatim in projects.wizard_state (JSONB).
 *
 * Rules:
 * - Increment schemaVersion whenever a field is added or changes type.
 * - Never remove fields — mark them optional and migrate forward.
 * - All values must be JSON-safe (no class instances, no functions, no Dates).
 */

import type { TranscriptSegment } from "@/lib/transcript/types";

// ── Schema version ─────────────────────────────────────────────────────────

export const CURRENT_SCHEMA_VERSION = 3;

// ── Subtitle style ─────────────────────────────────────────────────────────

export interface SubtitleStyleSpec {
  fontFamily: string;
  fontSize: number;
  fontWeight: number;
  lineHeight: number;
  color: string;
  backgroundColor: string;
  backgroundOpacity: number;
  position: "bottom" | "center" | "top";
  borderRadius: number;
  animation: string | null;
}

// ── Canonical persisted state ──────────────────────────────────────────────

export interface ProjectPersistedState {
  schemaVersion: typeof CURRENT_SCHEMA_VERSION;

  // ── Wizard navigation ──────────────────────────────────────────────────
  currentStep: number; // 1–10; where the user left off

  // ── Identity (steps 1–2) ───────────────────────────────────────────────
  title: string;
  client: string;
  tags: string[];
  targetDurationSec: number;

  // ── Source video (step 3) ──────────────────────────────────────────────
  sourceVideo: {
    storageKey: string | null; // null while still a blob (before upload)
    fileName: string | null; // original filename — display only
    durationSec: number;
    width: number;
    height: number;
    fileSizeBytes: number | null;
  } | null;

  // ── Clip / trim (step 4) ───────────────────────────────────────────────
  clip: {
    mode: "full" | "custom";
    startSec: number;
    endSec: number;
    durationSec: number;
  };

  // ── Preset (step 5) ────────────────────────────────────────────────────
  presetId: string;

  // ── Output format (step 6) ─────────────────────────────────────────────
  outputFormatId: string;

  // ── Subtitles (step 7) ─────────────────────────────────────────────────
  subtitleMode: "automatic" | "manual" | "none";
  speechLanguage: string | null; // null when mode !== 'automatic'

  // ── Transcript + edits (step 8) ────────────────────────────────────────
  transcript: {
    segments: TranscriptSegment[];
    analysisComplete: boolean;
  } | null;

  segmentEdits: Record<string, string>; // { [segId]: editedText }
  segmentStatus: Record<string, string>; // { [segId]: 'approved'|'flagged'|... }

  // ── Subtitle appearance (step 8 / style panel) ─────────────────────────
  subtitleStyle: SubtitleStyleSpec | null;

  // ── Creative instructions (step 9+) ────────────────────────────────────
  creativePrompt: string;

  // ── Approval status ────────────────────────────────────────────────────
  status: "draft" | "approved" | "rendering" | "complete";
  approvedAt: string | null; // ISO 8601 timestamp

  // ── Render payload snapshot ────────────────────────────────────────────
  // Snapshotted at the moment the user approves. Null until approval.
  renderPayloadSnapshot: Record<string, unknown> | null;
}

// ── API response types ─────────────────────────────────────────────────────

/** Full project response — returned by GET /api/projects/:id */
export interface ApiProject {
  id: string;
  wizardState: ProjectPersistedState;

  // Pre-signed URLs generated fresh on this request (TTL: 1 hour)
  videoUrl: string | null;
  thumbUrl: string | null;
  outputUrl: string | null;

  // Latest render job status
  renderStatus: "none" | "queued" | "rendering" | "done" | "error";
  renderProgress: number; // 0–100
  renderId: string | null;
}

/** Minimal projection for the project list — no wizard_state JSONB */
export interface ProjectListItem {
  id: string;
  name: string;
  client: string;
  status: string; // draft | approved | rendering | complete
  currentStep: number;
  preset: string;
  format: string;
  thumbUrl: string | null;
  createdAt: string;
  updatedAt: string;
}
