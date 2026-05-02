/**
 * PixelManageAI — Project Status Machine
 *
 * Canonical status transitions for the full project lifecycle.
 * Synthesised from Phases 6.3–6.9 into a single authoritative reference.
 *
 * Status flow:
 *   draft → analysing → approved → rendering → complete
 *                ↘ failed (unrecoverable video)
 *                ↘ analysis_failed → draft (fallback to manual)
 *                              approved ← rendering (render failure reverts)
 *
 * Key invariants:
 *   - `render_payload_snapshot` is immutable after 'approved'
 *   - Render failure reverts to 'approved', NOT 'failed'
 *   - Only invalid video sets 'failed' (terminal)
 *   - Transcript failure degrades to manual subtitles, not failure
 */

// ── Project status type ───────────────────────────────────────────────────

export type ProjectStatus =
  | "draft"              // wizard in progress, no approval yet
  | "analysing"          // upload complete, analysis jobs running
  | "analysis_failed"    // transcript exhausted (soft — falls back to manual)
  | "approved"           // wizard complete, render_payload_snapshot frozen
  | "rendering"          // render job in progress
  | "complete"           // at least one successful render output exists
  | "failed";            // terminal — video itself is unworkable

// ── Valid transitions ─────────────────────────────────────────────────────

const VALID_TRANSITIONS: Record<ProjectStatus, ProjectStatus[]> = {
  draft: ["analysing"],
  analysing: ["approved", "analysis_failed", "failed"],
  analysis_failed: ["draft", "approved"],  // draft = retry; approved = continue with manual
  approved: ["rendering"],
  rendering: ["complete", "approved"],     // approved = render exhausted (reverts)
  complete: ["rendering"],                 // re-render creates new version
  failed: [],                              // terminal
};

/**
 * Check if a project status transition is valid.
 */
export function isValidProjectTransition(
  from: ProjectStatus,
  to: ProjectStatus,
): boolean {
  return VALID_TRANSITIONS[from]?.includes(to) ?? false;
}

// ── Render-ready check ────────────────────────────────────────────────────

/**
 * A project is render-ready when it has been approved and has all
 * data the render worker needs. The worker reads only from Postgres
 * and S3 — it does not communicate with the wizard or analysis worker.
 *
 * SQL equivalent:
 *   SELECT * FROM projects
 *   WHERE status = 'approved'
 *     AND render_payload_snapshot IS NOT NULL
 *     AND source_video_key IS NOT NULL;
 */
export interface RenderReadyCheck {
  status: ProjectStatus;
  hasRenderPayload: boolean;
  hasSourceVideoKey: boolean;
}

export function isRenderReady(check: RenderReadyCheck): boolean {
  return (
    (check.status === "approved" || check.status === "complete") &&
    check.hasRenderPayload &&
    check.hasSourceVideoKey
  );
}

// ── Status display helpers ────────────────────────────────────────────────

/** Hebrew labels for project statuses (matching the approved RTL UI). */
export const PROJECT_STATUS_LABELS: Record<ProjectStatus, string> = {
  draft: "טיוטה",
  analysing: "מנתח...",
  analysis_failed: "ניתוח נכשל",
  approved: "מאושר",
  rendering: "מעבד...",
  complete: "הושלם",
  failed: "נכשל",
};

/** Status badge colour mapping for the UI. */
export const PROJECT_STATUS_COLORS: Record<ProjectStatus, string> = {
  draft: "var(--muted)",
  analysing: "var(--accent)",
  analysis_failed: "var(--yellow)",
  approved: "var(--accent2)",
  rendering: "var(--accent)",
  complete: "var(--green, #22c55e)",
  failed: "var(--red, #ef4444)",
};

// ── Status predicates ─────────────────────────────────────────────────────

/** Is the project in a terminal state (no more transitions possible)? */
export function isTerminal(status: ProjectStatus): boolean {
  return status === "failed";
}

/** Can the user trigger a render from this status? */
export function canTriggerRender(status: ProjectStatus): boolean {
  return status === "approved" || status === "complete";
}

/** Is the project actively processing (analysis or render)? */
export function isProcessing(status: ProjectStatus): boolean {
  return status === "analysing" || status === "rendering";
}

/** Does the project have at least one completed output? */
export function hasCompletedOutput(status: ProjectStatus): boolean {
  return status === "complete";
}
