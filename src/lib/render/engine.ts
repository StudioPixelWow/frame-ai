/**
 * PixelFrameAI — Render Engine Client
 *
 * Replaces the prototype RENDER_ENGINE stub with real API calls.
 * Both epApproveAndCreate() and triggerRender() converge to
 * submitRender(projectId) → POST /api/render { projectId }.
 *
 * The browser never sends the payload again after approval — the API
 * reads everything from the project record (render_payload column).
 */

import type { RenderStatusResponse, SubmitRenderResponse } from "@/types/render";
import { RENDER_SERVER } from "@/lib/config/runtime";

// ── Configuration ──────────────────────────────────────────────────────────

function getAuthHeaders(): Record<string, string> {
  return {
    "Content-Type": "application/json",
    // Auth token will be injected when the auth layer is wired up
  };
}

// ── API calls ──────────────────────────────────────────────────────────────

/**
 * Submit a render request. Only requires projectId — the API reads
 * the render_payload from the project record.
 *
 * @returns { renderId } from the newly created render_jobs row
 * @throws On network error, 404, 400 (no payload), or 409 (active render)
 */
export async function submitRender(
  projectId: string,
): Promise<SubmitRenderResponse> {
  const res = await fetch(`${RENDER_SERVER}/api/render`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify({ projectId }),
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(`Render request failed: ${data.error ?? res.statusText}`);
  }

  return res.json();
}

/**
 * Poll the status of a render job.
 *
 * @returns Full status including progress, sub-status, output URLs
 */
export async function getRenderStatus(
  renderId: string,
): Promise<RenderStatusResponse> {
  const res = await fetch(`${RENDER_SERVER}/api/render/${renderId}`, {
    headers: getAuthHeaders(),
  });

  if (!res.ok) {
    throw new Error(`Status poll failed: ${res.status}`);
  }

  return res.json();
}

/**
 * Cancel an in-progress render job.
 */
export async function cancelRender(renderId: string): Promise<void> {
  await fetch(`${RENDER_SERVER}/api/render/${renderId}/cancel`, {
    method: "POST",
    headers: getAuthHeaders(),
  });
}

// ── RENDER_ENGINE compatibility object ─────────────────────────────────────

/**
 * Drop-in replacement for the prototype RENDER_ENGINE stub.
 * Wire this into the SPA where RENDER_ENGINE was previously used.
 */
export const RENDER_ENGINE = {
  submit: (payload: { metadata?: { id?: string }; projectId?: string }) => {
    const projectId = payload.projectId ?? payload.metadata?.id;
    if (!projectId) throw new Error("No projectId in render payload");
    return submitRender(projectId);
  },
  status: (renderId: string) => getRenderStatus(renderId),
  cancel: (renderId: string) => cancelRender(renderId),
};
