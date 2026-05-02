/**
 * PixelManageAI — Error Recovery Handlers
 *
 * Recovery logic for each failure type. These handlers update
 * project and job status to enable the correct recovery path.
 *
 * Key principles:
 *   - Project config is NEVER lost due to a job failure
 *   - Transcript failure → graceful degradation to manual subtitles
 *   - Render failure → project reverts to 'approved' (not 'failed')
 *   - Only truly unworkable videos get `status = 'failed'`
 */

import type { JobErrorDetail } from "./error-detail";

// ── DB query interface (injected) ─────────────────────────────────────────

export interface RecoveryQueryExecutor {
  query: <T = Record<string, unknown>>(
    sql: string,
    params?: unknown[],
  ) => Promise<{ rows: T[] }>;
}

// ── Transcript exhaustion handler ─────────────────────────────────────────

/**
 * Handle transcript job exhaustion — graceful degradation.
 *
 * Instead of blocking the project, flip to manual subtitle mode.
 * The user can still approve and render with manual subtitles,
 * or retry the transcript later.
 *
 * Sets:
 *   - wizard_state.subtitleMode = 'manual'
 *   - analysis_status = 'transcript_failed'
 */
export async function handleTranscriptExhausted(
  db: RecoveryQueryExecutor,
  projectId: string,
  _errorDetail: JobErrorDetail,
): Promise<void> {
  await db.query(
    `UPDATE projects
     SET
       wizard_state = jsonb_set(
         wizard_state,
         '{subtitleMode}',
         '"manual"'
       ),
       analysis_status = 'transcript_failed'
     WHERE id = $1`,
    [projectId],
  );
}

// ── Segment generation failure handler ────────────────────────────────────

/**
 * Handle segment generation failure — same as transcript exhaustion.
 *
 * Empty segments or generation errors fall back to manual subtitle mode.
 * The raw transcript (if available) is preserved in the analysis job output.
 */
export async function handleSegmentGenerationFailed(
  db: RecoveryQueryExecutor,
  projectId: string,
): Promise<void> {
  await db.query(
    `UPDATE projects
     SET
       wizard_state = jsonb_set(
         wizard_state,
         '{subtitleMode}',
         '"manual"'
       ),
       analysis_status = 'segments_failed'
     WHERE id = $1`,
    [projectId],
  );
}

// ── Render exhaustion handler ─────────────────────────────────────────────

/**
 * Handle render job exhaustion.
 *
 * Reverts project status to 'approved' (NOT 'failed') because the
 * project configuration is valid — only the render job failed.
 * The user can trigger a new render immediately without re-approving.
 *
 * Previous successful render_outputs (if any) are not affected.
 */
export async function handleRenderExhausted(
  db: RecoveryQueryExecutor,
  projectId: string,
): Promise<void> {
  await db.query(
    `UPDATE projects
     SET status = 'approved'
     WHERE id = $1 AND status = 'rendering'`,
    [projectId],
  );
}

// ── Video invalid handler ─────────────────────────────────────────────────

/**
 * Handle unrecoverable video validation failure.
 *
 * Sets project to `status = 'failed'` — the video itself is
 * permanently unworkable. Recovery requires uploading a different video.
 *
 * The source_video_key is preserved for storage cleanup.
 */
export async function handleVideoInvalid(
  db: RecoveryQueryExecutor,
  projectId: string,
): Promise<void> {
  await db.query(
    `UPDATE projects
     SET status = 'failed'
     WHERE id = $1`,
    [projectId],
  );
}

// ── Upload failure handler ────────────────────────────────────────────────

/**
 * Handle upload failure.
 *
 * Project stays in 'draft' — upload never completed.
 * No status change needed; source_video_key is NOT set.
 * User can retry the upload immediately.
 */
export async function handleUploadFailed(
  _db: RecoveryQueryExecutor,
  _projectId: string,
): Promise<void> {
  // No DB update needed — project is already in 'draft' status
  // and source_video_key was never set.
}

// ── Missing asset handler ─────────────────────────────────────────────────

/**
 * Handle missing asset reference during render.
 *
 * Project status reverts to 'approved' (same as render exhaustion).
 * The user must re-upload the source video before rendering again.
 */
export async function handleMissingAsset(
  db: RecoveryQueryExecutor,
  projectId: string,
): Promise<void> {
  await db.query(
    `UPDATE projects
     SET status = 'approved'
     WHERE id = $1 AND status = 'rendering'`,
    [projectId],
  );
}

// ── Resolve all asset keys ────────────────────────────────────────────────

export interface StorageExistenceChecker {
  exists: (key: string) => Promise<boolean>;
}

/**
 * Verify that all storage keys referenced in a render payload exist.
 *
 * Throws a PixelManageError('RENDER_SOURCE_MISSING') if any key is missing.
 * Called during the 'preparing' sub-status of render execution.
 */
export async function resolveAllAssetKeys(
  storage: StorageExistenceChecker,
  keysToCheck: Array<{ key: string; name: string }>,
): Promise<void> {
  const missing: string[] = [];

  await Promise.all(
    keysToCheck.map(async ({ key, name }) => {
      if (key && !(await storage.exists(key))) {
        missing.push(name);
      }
    }),
  );

  if (missing.length > 0) {
    // Import dynamically to avoid circular dependency
    const { PixelManageError } = await import("./pixelmanage-error");
    const label = missing.join(", ");
    const plural = missing.length > 1;
    throw new PixelManageError(
      "RENDER_SOURCE_MISSING",
      `The ${label} file${plural ? "s are" : " is"} no longer available. Please re-upload before rendering.`,
    );
  }
}
