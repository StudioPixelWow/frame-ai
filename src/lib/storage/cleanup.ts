/**
 * Storage cleanup job — deletes expired files and nullifies DB keys.
 *
 * Schedule: daily at 03:00 (cron job or serverless timer).
 *
 * Policies:
 * - Source videos: delete 30 days after project creation
 * - Rendered outputs (free tier): delete 7 days after render
 * - Rendered outputs (paid tier): delete 90 days after render
 *
 * NOTE: This is a scaffold. The actual DB queries require the database
 * module to be set up (Phase 6.1). Wire this up once the DB layer exists.
 */

import { storage } from "./index";

export interface CleanupStats {
  sourcesDeleted: number;
  rendersDeleted: number;
  errors: string[];
}

/**
 * Run the full cleanup cycle. Call from a cron handler or API route.
 *
 * @param db — the database client (injected to keep this module DB-agnostic)
 */
export async function runStorageCleanup(db: {
  query: (sql: string, params?: unknown[]) => Promise<{ rows: any[] }>;
}): Promise<CleanupStats> {
  const stats: CleanupStats = {
    sourcesDeleted: 0,
    rendersDeleted: 0,
    errors: [],
  };

  // 1. Delete source videos older than 30 days
  try {
    const staleProjects = await db.query(`
      SELECT id, user_id, source_video_key, source_thumb_key
      FROM projects
      WHERE source_video_key IS NOT NULL
        AND created_at < now() - interval '30 days'
    `);

    for (const proj of staleProjects.rows) {
      try {
        await Promise.all([
          storage.delete(proj.source_video_key),
          proj.source_thumb_key
            ? storage.delete(proj.source_thumb_key)
            : null,
        ]);
        await db.query(
          `UPDATE projects SET source_video_key=NULL, source_thumb_key=NULL WHERE id=$1`,
          [proj.id],
        );
        stats.sourcesDeleted++;
      } catch (err) {
        stats.errors.push(
          `Failed to clean source for project ${proj.id}: ${err}`,
        );
      }
    }
  } catch (err) {
    stats.errors.push(`Source cleanup query failed: ${err}`);
  }

  // 2. Delete rendered outputs past retention period
  try {
    const staleJobs = await db.query(`
      SELECT j.id, j.output_key, j.output_thumb_key, p.user_id,
             COALESCE(u.plan, 'free') AS plan
      FROM render_jobs j
      JOIN projects p ON p.id = j.project_id
      JOIN users u ON u.id = p.user_id
      WHERE j.output_key IS NOT NULL
        AND j.finished_at < now() - (
          CASE WHEN COALESCE(u.plan,'free') = 'free' THEN interval '7 days'
               ELSE interval '90 days' END
        )
    `);

    for (const job of staleJobs.rows) {
      try {
        await Promise.all([
          storage.delete(job.output_key),
          job.output_thumb_key
            ? storage.delete(job.output_thumb_key)
            : null,
        ]);
        await db.query(
          `UPDATE render_jobs SET output_key=NULL, output_thumb_key=NULL WHERE id=$1`,
          [job.id],
        );
        stats.rendersDeleted++;
      } catch (err) {
        stats.errors.push(
          `Failed to clean render job ${job.id}: ${err}`,
        );
      }
    }
  } catch (err) {
    stats.errors.push(`Render cleanup query failed: ${err}`);
  }

  return stats;
}
