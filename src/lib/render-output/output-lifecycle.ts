/**
 * PixelFrameAI — Output Lifecycle Management
 *
 * Status transitions for render output records:
 *   available → archived → deleted
 *
 * Storage cleanup is deferred: a nightly background job finds
 * `status='deleted'` rows older than 7 days and purges the actual
 * storage objects. The 7-day grace period allows accidental deletions
 * to be recovered by flipping status back to 'archived'.
 */

import type { OutputStatus } from "@/types/render-output";

// ── Lifecycle constants ───────────────────────────────────────────────────

/** Days to wait after soft-delete before purging storage objects. */
export const DELETION_GRACE_PERIOD_DAYS = 7;

// ── Valid status transitions ──────────────────────────────────────────────

const VALID_TRANSITIONS: Record<OutputStatus, OutputStatus[]> = {
  available: ["archived"],
  archived: ["available", "deleted"],
  deleted: [], // terminal — no transitions out
};

/**
 * Check if a status transition is valid.
 */
export function isValidOutputTransition(
  from: OutputStatus,
  to: OutputStatus,
): boolean {
  return VALID_TRANSITIONS[from]?.includes(to) ?? false;
}

// ── DB query interface (injected) ─────────────────────────────────────────

export interface QueryExecutor {
  query: <T = Record<string, unknown>>(
    sql: string,
    params?: unknown[],
  ) => Promise<{ rows: T[] }>;
}

// ── Archive ───────────────────────────────────────────────────────────────

/**
 * Archive an output — hides it from the default project details view.
 * The storage object is preserved and the URL still works.
 *
 * If the archived output was primary, is_primary is NOT reassigned
 * automatically — the caller (or UI) should promote another version.
 */
export async function archiveOutput(
  db: QueryExecutor,
  outputId: string,
): Promise<void> {
  await db.query(
    `UPDATE render_outputs
     SET status = 'archived', archived_at = NOW()
     WHERE id = $1 AND status = 'available'`,
    [outputId],
  );
}

/**
 * Restore an archived output back to available status.
 */
export async function restoreOutput(
  db: QueryExecutor,
  outputId: string,
): Promise<void> {
  await db.query(
    `UPDATE render_outputs
     SET status = 'available', archived_at = NULL
     WHERE id = $1 AND status = 'archived'`,
    [outputId],
  );
}

// ── Soft delete ───────────────────────────────────────────────────────────

/**
 * Soft-delete an output — schedules its storage key for cleanup.
 * Can only be called on archived outputs (not directly from available).
 *
 * The actual storage purge happens in `runOutputCleanup()` after the
 * grace period expires.
 */
export async function softDeleteOutput(
  db: QueryExecutor,
  outputId: string,
): Promise<void> {
  await db.query(
    `UPDATE render_outputs
     SET status = 'deleted', deleted_at = NOW()
     WHERE id = $1 AND status = 'archived'`,
    [outputId],
  );
}

// ── Storage cleanup job ───────────────────────────────────────────────────

export interface StorageDeleteProvider {
  delete: (key: string) => Promise<void>;
}

interface DeletableOutput {
  id: string;
  output_key: string;
  thumb_key: string | null;
}

/**
 * Run the nightly storage cleanup job.
 *
 * Finds soft-deleted output records past the grace period and
 * purges their storage objects. Called by the scheduled cleanup
 * worker (Phase 6.2 §6).
 *
 * @returns Number of outputs purged
 */
export async function runOutputCleanup(
  db: QueryExecutor,
  storage: StorageDeleteProvider,
): Promise<number> {
  // Find outputs past grace period
  const result = await db.query<DeletableOutput>(
    `SELECT id, output_key, thumb_key
     FROM render_outputs
     WHERE status = 'deleted'
       AND deleted_at < NOW() - INTERVAL '${DELETION_GRACE_PERIOD_DAYS} days'`,
  );

  let purged = 0;

  for (const row of result.rows) {
    try {
      // Delete storage objects
      await storage.delete(row.output_key);
      if (row.thumb_key) {
        await storage.delete(row.thumb_key);
      }

      // Remove the DB row entirely (storage is gone, no reason to keep it)
      await db.query(
        `DELETE FROM render_outputs WHERE id = $1`,
        [row.id],
      );

      purged++;
    } catch (err) {
      // Log but continue — one failed purge shouldn't block others
      console.error(
        `[output-cleanup] Failed to purge output ${row.id}:`,
        err instanceof Error ? err.message : err,
      );
    }
  }

  return purged;
}
