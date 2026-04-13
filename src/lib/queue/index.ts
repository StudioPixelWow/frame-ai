/**
 * PixelFrameAI — Queue Module
 *
 * Background job infrastructure built on BullMQ + Redis.
 * Two queues, shared by the API server (producer) and separate
 * worker processes (consumers).
 *
 * Usage:
 *   import { videoAnalysisQueue, renderQueue } from '@/lib/queue';       // API server
 *   import { createWorker, setupGracefulShutdown } from '@/lib/queue';   // worker processes
 */

// Redis connection
export { createRedisConnection } from "./redis";

// Queue instances + job data types
export {
  videoAnalysisQueue,
  renderQueue,
} from "./queues";
export type { VideoAnalysisJobData, RenderJobData } from "./queues";

// Worker factory
export { createWorker, makeProgressUpdater } from "./base-worker";
export type { WorkerConfig } from "./base-worker";

// Error classification
export { isRetryable } from "./error-classification";

// Alerts
export { alertJobExhausted } from "./alerts";

// Graceful shutdown
export { setupGracefulShutdown } from "./shutdown";
