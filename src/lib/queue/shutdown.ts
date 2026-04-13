/**
 * PixelFrameAI — Graceful Worker Shutdown
 *
 * Hooks SIGTERM/SIGINT to drain the BullMQ worker before exiting.
 * The currently-executing job is allowed to finish; no new jobs are
 * accepted once shutdown begins.
 *
 * Safety timeout: 10 minutes. If the current job hasn't finished by
 * then, the process force-exits. The stall detector in BullMQ will
 * re-queue the job on another container.
 *
 * Container orchestrator integration:
 *   - Kubernetes:  terminationGracePeriodSeconds: 600
 *   - Fly.io:     kill_timeout = "10m"
 *   - ECS:        stopTimeout: 600
 */

import type { Worker } from "bullmq";

const FORCE_EXIT_TIMEOUT_MS = 10 * 60_000; // 10 minutes

/**
 * Register graceful shutdown handlers for a BullMQ worker.
 *
 * @param worker  The BullMQ Worker instance to drain on shutdown
 */
export function setupGracefulShutdown(worker: Worker): void {
  let shuttingDown = false;

  async function shutdown(signal: string): Promise<void> {
    if (shuttingDown) return;
    shuttingDown = true;

    console.log(`[shutdown] ${signal} received — draining queue worker…`);

    // Tell BullMQ to stop accepting new jobs.
    // Any currently-executing job will be allowed to finish.
    await worker.close();

    console.log("[shutdown] worker drained — exiting");
    process.exit(0);
  }

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));

  // Safety timeout — force-exit if the current job takes too long after SIGTERM
  process.on("SIGTERM", () => {
    setTimeout(() => {
      console.error("[shutdown] force exit after 10 min timeout");
      process.exit(1);
    }, FORCE_EXIT_TIMEOUT_MS).unref();
  });
}
