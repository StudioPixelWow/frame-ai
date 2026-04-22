/**
 * PixelManageAI — Output Record Creation
 *
 * Creates a durable `render_outputs` record after a render job completes.
 * All five writes (version lock, primary reset, INSERT, job update,
 * project update) run in a single transaction — no partial records.
 *
 * This is called by the render worker as the final step of job completion
 * (Phase 6.5 §5d step 10).
 *
 * The DB pool / transaction helper is injected — this module provides
 * the query logic without coupling to a specific Postgres driver.
 */

import type { OutputMeta, RenderOutputRecord } from "@/types/render-output";

// ── Transaction helper type ───────────────────────────────────────────────

/**
 * Minimal transaction executor interface.
 * Implementations must guarantee atomicity — all queries succeed or
 * all are rolled back.
 */
export interface TransactionExecutor {
  query: <T = Record<string, unknown>>(
    sql: string,
    params?: unknown[],
  ) => Promise<{ rows: T[] }>;
}

export interface TransactionRunner {
  transaction: <T>(fn: (tx: TransactionExecutor) => Promise<T>) => Promise<T>;
}

// ── Render job row (subset needed for output creation) ────────────────────

export interface RenderJobRow {
  id: string;
  projectId: string;
  userId: string;
  presetId: string;
  presetLabel: string;
  renderPayloadSnapshot: Record<string, unknown>;
}

// ── Create output record ──────────────────────────────────────────────────

/**
 * Create a render output record in a single atomic transaction.
 *
 * Steps:
 *   1. Lock and determine next version_number for this project
 *   2. Mark all existing primary outputs as superseded
 *   3. INSERT new render_outputs row with is_primary = true
 *   4. Back-reference: render_jobs.output_id → new output ID
 *   5. Forward pointer: projects.latest_output_id → new output ID
 *
 * @returns The newly created output record ID
 */
export async function createOutputRecord(
  db: TransactionRunner,
  job: RenderJobRow,
  outputMeta: OutputMeta,
): Promise<string> {
  return db.transaction(async (tx) => {
    // 1. Determine next version_number (row-level lock prevents duplicates)
    const versionResult = await tx.query<{ next_version: number }>(
      `SELECT COALESCE(MAX(version_number), 0) + 1 AS next_version
       FROM render_outputs
       WHERE project_id = $1
       FOR UPDATE`,
      [job.projectId],
    );
    const nextVersion = versionResult.rows[0]?.next_version ?? 1;

    // 2. Mark existing primary outputs as superseded
    await tx.query(
      `UPDATE render_outputs
       SET is_primary = false
       WHERE project_id = $1 AND is_primary = true`,
      [job.projectId],
    );

    // 3. Insert new output record
    const insertResult = await tx.query<{ id: string }>(
      `INSERT INTO render_outputs (
         project_id, render_job_id, user_id,
         version_number, is_primary, status,
         format_id, codec, width, height, aspect_ratio,
         duration_sec, file_size_bytes,
         output_key, thumb_key,
         preset_id, preset_label, render_config_snapshot
       ) VALUES (
         $1, $2, $3,
         $4, true, 'available',
         $5, $6, $7, $8, $9,
         $10, $11,
         $12, $13,
         $14, $15, $16
       )
       RETURNING id`,
      [
        job.projectId,
        job.id,
        job.userId,
        nextVersion,
        outputMeta.formatId,
        outputMeta.codec,
        outputMeta.width,
        outputMeta.height,
        outputMeta.aspectRatio,
        outputMeta.durationSec,
        outputMeta.fileSizeBytes,
        outputMeta.outputKey,
        outputMeta.thumbKey,
        job.presetId,
        job.presetLabel,
        JSON.stringify(job.renderPayloadSnapshot),
      ],
    );

    const outputId = insertResult.rows[0].id;

    // 4. Back-reference on render_jobs
    await tx.query(
      `UPDATE render_jobs SET output_id = $1 WHERE id = $2`,
      [outputId, job.id],
    );

    // 5. Forward pointer on projects
    await tx.query(
      `UPDATE projects
       SET latest_output_id = $1, status = 'complete'
       WHERE id = $2`,
      [outputId, job.projectId],
    );

    return outputId;
  });
}

// ── Promote version to primary ────────────────────────────────────────────

/**
 * Set a specific output version as the primary for its project.
 * Clears is_primary on all other versions in the same project.
 */
export async function promoteOutputToPrimary(
  db: TransactionRunner,
  outputId: string,
  projectId: string,
): Promise<void> {
  await db.transaction(async (tx) => {
    // Clear existing primary
    await tx.query(
      `UPDATE render_outputs
       SET is_primary = false
       WHERE project_id = $1 AND is_primary = true`,
      [projectId],
    );

    // Set new primary
    await tx.query(
      `UPDATE render_outputs
       SET is_primary = true
       WHERE id = $1 AND project_id = $2`,
      [outputId, projectId],
    );

    // Update project forward pointer
    await tx.query(
      `UPDATE projects SET latest_output_id = $1 WHERE id = $2`,
      [outputId, projectId],
    );
  });
}
