/**
 * PixelFrameAI — Render Module
 *
 * The complete render job lifecycle — from approval to downloadable MP4.
 *
 * Usage:
 *   import { submitRender, startRenderPoll, buildCompositionConfig } from '@/lib/render';
 */

// Engine (client-side API calls)
export {
  submitRender,
  getRenderStatus,
  cancelRender,
  RENDER_ENGINE,
} from "./engine";

// Polling (client-side)
export { startRenderPoll } from "./poll";
export type { RenderPollState, PollCallback } from "./poll";

// Job status machine
export {
  isValidRenderTransition,
  isRetryableRenderError,
  getRenderRetryDelay,
  getNextStatusAfterError,
  shouldReportProgress,
  renderSubStatusLabel,
  renderStatusLabel,
} from "./job-status";

// Worker execution (server-side)
export {
  buildCompositionConfig,
  substituteVideoUrl,
  executeRenderJob,
} from "./worker";
export type {
  RenderWorkerContext,
  RenderWorkerCallbacks,
  RenderOutputMetadata,
} from "./worker";
