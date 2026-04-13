/**
 * PixelFrameAI — BullMQ Queue Definitions
 *
 * Two queues shared by the API server (producer) and worker processes (consumers):
 *   - video-analysis: ffprobe inspection + ASR transcription (concurrency 2)
 *   - render:         Remotion renderMedia() (concurrency 1)
 *
 * Job payloads are minimal — workers fetch all context from Postgres.
 * Redis is the execution channel, not the data store.
 */

import { Queue } from "bullmq";
import { createRedisConnection } from "./redis";

// ── Job data contracts ────────────────────────────────────────────────────

export interface VideoAnalysisJobData {
  jobId: string; // analysis_jobs.id (UUID)
}

export interface RenderJobData {
  renderId: string; // render_jobs.id (UUID)
}

// ── Shared retention config ───────────────────────────────────────────────

const defaultJobOptions = {
  removeOnComplete: { count: 500, age: 7 * 24 * 3600 }, // keep last 500 or 7 days
  removeOnFail: { count: 200, age: 30 * 24 * 3600 }, // keep failed for 30 days
};

// ── Queue instances ───────────────────────────────────────────────────────

export const videoAnalysisQueue = new Queue<VideoAnalysisJobData>(
  "video-analysis",
  {
    connection: createRedisConnection(),
    defaultJobOptions: {
      ...defaultJobOptions,
      attempts: 3,
      backoff: { type: "exponential", delay: 5_000 }, // 5s → 10s → 20s
    },
  },
);

export const renderQueue = new Queue<RenderJobData>("render", {
  connection: createRedisConnection(),
  defaultJobOptions: {
    ...defaultJobOptions,
    attempts: 3,
    backoff: { type: "exponential", delay: 10_000 }, // 10s → 20s → 40s
  },
});
