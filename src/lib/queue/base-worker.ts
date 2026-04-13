/**
 * PixelFrameAI — Base Worker Factory
 *
 * Shared worker creation pattern used by both the analysis worker
 * and render worker processes. Provides:
 *   - Consistent BullMQ Worker configuration
 *   - Event logging (completed, failed, stalled, error)
 *   - Dual-channel progress updater (BullMQ Redis + Postgres)
 *
 * Usage:
 *   const worker = createWorker<VideoAnalysisJobData>(config, processor);
 */

import { Worker, type Job } from "bullmq";
import { createRedisConnection } from "./redis";

// ── Worker config ─────────────────────────────────────────────────────────

export interface WorkerConfig {
  queueName: string;
  concurrency: number;
  stalledInterval: number; // ms between stall checks
  maxStalledCount: number; // stalls before permanent failure
}

// ── Progress updater factory ──────────────────────────────────────────────

/**
 * Create a dual-channel progress updater.
 *
 * - BullMQ progress (Redis): updated on every call for internal events / Bull Board
 * - Postgres: throttled to every 5% to avoid write amplification
 *
 * The `dbUpdateFn` is optional — when omitted, only BullMQ progress is written.
 * This allows processors that manage their own DB writes to skip the auto-update.
 */
export function makeProgressUpdater(
  job: Job,
  dbUpdateFn?: (pct: number) => Promise<void>,
): (pct: number) => Promise<void> {
  let lastDbWrite = -1;

  return async (pct: number) => {
    const rounded = Math.round(pct);

    // Always write to BullMQ (Redis)
    await job.updateProgress(rounded);

    // Throttle Postgres writes to every 5%
    if (dbUpdateFn && (rounded >= lastDbWrite + 5 || rounded === 100)) {
      await dbUpdateFn(rounded);
      lastDbWrite = rounded;
    }
  };
}

// ── Worker factory ────────────────────────────────────────────────────────

/**
 * Create a BullMQ worker with standard configuration and event logging.
 *
 * @param config     Queue name, concurrency, stall settings
 * @param processor  The job processing function — receives the job and a
 *                   progress updater callback
 */
export function createWorker<TData>(
  config: WorkerConfig,
  processor: (
    job: Job<TData>,
    updateProgress: (pct: number) => Promise<void>,
  ) => Promise<void>,
): Worker<TData> {
  const worker = new Worker<TData>(
    config.queueName,
    async (job) => {
      const updateProgress = async (pct: number) => {
        await job.updateProgress(pct);
      };
      await processor(job, updateProgress);
    },
    {
      connection: createRedisConnection(),
      concurrency: config.concurrency,
      stalledInterval: config.stalledInterval,
      maxStalledCount: config.maxStalledCount,
      lockDuration: 60_000, // must renew lock every 60s or job is considered stalled
    },
  );

  // ── Event logging ─────────────────────────────────────────────────────

  worker.on("completed", (job) => {
    console.log(`[${config.queueName}] ✓ job ${job.id} completed`);
  });

  worker.on("failed", (job, err) => {
    console.error(
      `[${config.queueName}] ✗ job ${job?.id} failed (attempt ${job?.attemptsMade}):`,
      err.message,
    );
  });

  worker.on("stalled", (jobId) => {
    console.warn(
      `[${config.queueName}] ⚠ job ${jobId} stalled — will be re-queued`,
    );
  });

  worker.on("error", (err) => {
    console.error(`[${config.queueName}] worker error:`, err);
    // Non-fatal — the worker continues processing other jobs
  });

  return worker;
}
