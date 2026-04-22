/**
 * PixelManageAI — Flow Stage Definitions
 *
 * The 10 stages of the upload-to-download pipeline, annotated with
 * sync/async classification, blocking behaviour, and data outputs.
 *
 * Only two stages block the user:
 *   Stage 1 (Upload) — user waits for upload to finish
 *   Stage 5 (Approval) — user waits for approval confirmation
 * Everything else is async and non-blocking.
 */

// ── Stage classification ──────────────────────────────────────────────────

export type StageClassification =
  | "ui_sync"       // UI + synchronous backend (blocks user)
  | "ui_async"      // UI triggers, backend runs async (non-blocking)
  | "async_only"    // Pure backend, no user action
  | "ui_only"       // UI only, no backend
  | "state_only";   // System state checkpoint, no action

// ── Stage definitions ─────────────────────────────────────────────────────

export interface FlowStage {
  id: number;
  name: string;
  nameHe: string;         // Hebrew label for RTL UI
  wizardStep: number | null; // null = not a wizard step
  classification: StageClassification;
  blocksUser: boolean;
  description: string;
  dataStored: string[];
  outputProduced: string;
}

export const FLOW_STAGES: FlowStage[] = [
  {
    id: 1,
    name: "Upload video",
    nameHe: "העלאת וידאו",
    wizardStep: 2,
    classification: "ui_sync",
    blocksUser: true,
    description: "User selects file, multipart upload to S3, video-inspection job queued",
    dataStored: [
      "S3: source_video_key",
      "projects.source_video_key",
      "wizard_state.sourceVideo",
      "analysis_jobs × 2 (inspection queued, transcription waiting)",
    ],
    outputProduced: "S3 source file + video metadata in DB",
  },
  {
    id: 2,
    name: "Optional trim",
    nameHe: "חיתוך (אופציונלי)",
    wizardStep: 3,
    classification: "ui_async",
    blocksUser: false,
    description: "User sets clip range, transcription job promoted from waiting→queued",
    dataStored: [
      "wizard_state.clip.{startSec, endSec, durationSec}",
      "analysis_jobs transcription: waiting→queued",
    ],
    outputProduced: "Clip range saved; transcription begins async",
  },
  {
    id: 3,
    name: "Subtitle setup",
    nameHe: "הגדרת כתוביות",
    wizardStep: 8,
    classification: "ui_async",
    blocksUser: false,
    description: "Preset, format, direction, subtitle editor — all auto-saved",
    dataStored: [
      "wizard_state.subtitleMode",
      "wizard_state.subtitleStyle",
      "wizard_state.segEdits",
      "wizard_state.segStatus",
      "wizard_state.preset",
      "wizard_state.format",
      "wizard_state.prompt",
    ],
    outputProduced: "Edited segment list in wizard_state",
  },
  {
    id: 4,
    name: "Transcript handling",
    nameHe: "עיבוד תמלול",
    wizardStep: null,
    classification: "async_only",
    blocksUser: false,
    description: "Analysis worker: ffmpeg audio extract → ASR → segments",
    dataStored: [
      "analysis_jobs.output (transcript + segments)",
      "wizard_state.transcript.segments[]",
    ],
    outputProduced: "Timed subtitle segments in Postgres",
  },
  {
    id: 5,
    name: "Export preview approval",
    nameHe: "אישור ויצירת פרויקט",
    wizardStep: 9,
    classification: "ui_sync",
    blocksUser: true,
    description: "buildWizardRenderPayload() → immutable render_payload_snapshot",
    dataStored: [
      "projects.render_payload_snapshot (immutable JSONB)",
      "projects.status = 'approved'",
      "projects.approvedAt",
    ],
    outputProduced: "RenderPayload v2.2 — deterministic render instruction set",
  },
  {
    id: 6,
    name: "Project finalization",
    nameHe: "סיום פרויקט",
    wizardStep: 10,
    classification: "ui_only",
    blocksUser: false,
    description: "Confirmation screen; wizard locked; project appears in list",
    dataStored: [],
    outputProduced: "No new data — status set in stage 5",
  },
  {
    id: 7,
    name: "Analysis job lifecycle",
    nameHe: "מחזור חיי ניתוח",
    wizardStep: null,
    classification: "async_only",
    blocksUser: false,
    description: "Background track: inspection + transcription across stages 1–3",
    dataStored: [
      "analysis_jobs status transitions",
      "wizard_state mirrors",
    ],
    outputProduced: "Video metadata + transcript + segments",
  },
  {
    id: 8,
    name: "Render-ready state",
    nameHe: "מוכן לרנדור",
    wizardStep: null,
    classification: "state_only",
    blocksUser: false,
    description: "System checkpoint: approved + payload + source_video_key all present",
    dataStored: [],
    outputProduced: "No output — state gate for render trigger",
  },
  {
    id: 9,
    name: "Render job",
    nameHe: "עיבוד רנדור",
    wizardStep: null,
    classification: "ui_async",
    blocksUser: false,
    description: "Render worker: prepare → renderMedia → upload → thumbnail → output record",
    dataStored: [
      "render_jobs (status, progress, sub_status, input_props_override, output_id)",
      "render_outputs (full metadata + render_config_snapshot)",
      "projects.latest_output_id",
      "projects.status = 'complete'",
      "S3: output.mp4, thumb.jpg",
    ],
    outputProduced: "Downloadable MP4 + thumbnail in S3",
  },
  {
    id: 10,
    name: "Final output saved",
    nameHe: "שמירת תוצר סופי",
    wizardStep: null,
    classification: "async_only",
    blocksUser: false,
    description: "createOutputRecord() transaction; UI discovers via polling",
    dataStored: [
      "render_outputs row (version_number, is_primary, all metadata)",
      "projects.latest_output_id",
      "projects.status = 'complete'",
    ],
    outputProduced: "Permanent deliverable with signed download URL",
  },
];

// ── Helpers ───────────────────────────────────────────────────────────────

/** Get stages that block the user (require waiting). */
export function getBlockingStages(): FlowStage[] {
  return FLOW_STAGES.filter((s) => s.blocksUser);
}

/** Get stages that involve async backend work. */
export function getAsyncStages(): FlowStage[] {
  return FLOW_STAGES.filter(
    (s) => s.classification === "async_only" || s.classification === "ui_async",
  );
}

/** Get the wizard step number for a given stage, or null. */
export function getWizardStepForStage(stageId: number): number | null {
  return FLOW_STAGES.find((s) => s.id === stageId)?.wizardStep ?? null;
}
