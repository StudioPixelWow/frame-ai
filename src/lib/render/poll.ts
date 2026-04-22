/**
 * PixelManageAI — Render Status Polling
 *
 * Client-side polling logic for tracking render job progress.
 * Replaces the prototype pollRenderStatus() with proper status mapping.
 */

import { getRenderStatus } from "./engine";
import type { RenderStatusResponse } from "@/types/render";

// ── Poll state ─────────────────────────────────────────────────────────────

export interface RenderPollState {
  renderId: string;
  projectId: string;
  status: "rendering" | "done" | "error";
  subStatus: string | null;
  progress: number;
  renderUrl: string | null;
  thumbUrl: string | null;
  error: string | null;
}

export type PollCallback = (state: RenderPollState) => void;

// ── Poller ─────────────────────────────────────────────────────────────────

const POLL_INTERVAL_MS = 2000;
const POLL_ERROR_INTERVAL_MS = 4000;

/**
 * Start polling a render job. Returns a stop function.
 *
 * @param projectId  The project being rendered
 * @param renderId   The render job ID
 * @param onUpdate   Callback for every status update
 */
export function startRenderPoll(
  projectId: string,
  renderId: string,
  onUpdate: PollCallback,
): () => void {
  let stopped = false;

  async function poll() {
    if (stopped) return;

    try {
      const data: RenderStatusResponse = await getRenderStatus(renderId);

      if (data.status === "completed") {
        onUpdate({
          renderId,
          projectId,
          status: "done",
          subStatus: null,
          progress: 100,
          renderUrl: data.url,
          thumbUrl: data.thumbUrl,
          error: null,
        });
        return; // stop polling
      }

      if (data.status === "failed" || data.status === "exhausted") {
        onUpdate({
          renderId,
          projectId,
          status: "error",
          subStatus: null,
          progress: data.progress,
          renderUrl: null,
          thumbUrl: null,
          error: data.error ?? "Render failed",
        });
        return; // stop polling
      }

      // queued or processing — update and keep polling
      onUpdate({
        renderId,
        projectId,
        status: "rendering",
        subStatus: data.subStatus,
        progress: data.progress,
        renderUrl: null,
        thumbUrl: null,
        error: null,
      });

      if (!stopped) {
        setTimeout(poll, POLL_INTERVAL_MS);
      }
    } catch {
      // Transient network error — retry more slowly
      if (!stopped) {
        setTimeout(poll, POLL_ERROR_INTERVAL_MS);
      }
    }
  }

  // Start first poll
  setTimeout(poll, POLL_INTERVAL_MS);

  return () => {
    stopped = true;
  };
}
