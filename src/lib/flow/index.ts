/**
 * PixelManageAI — End-to-End Flow Module
 *
 * Canonical reference for the full upload-to-download pipeline.
 * Synthesises Phases 6.1–6.10 into:
 *   - Project status machine (transitions, predicates, labels)
 *   - Flow stage definitions (10 stages, sync/async classification)
 *   - Render-ready gate check
 *
 * Usage:
 *   import { isRenderReady, canTriggerRender, FLOW_STAGES } from '@/lib/flow';
 */

// Project status machine
export {
  isValidProjectTransition,
  isRenderReady,
  isTerminal,
  canTriggerRender,
  isProcessing,
  hasCompletedOutput,
  PROJECT_STATUS_LABELS,
  PROJECT_STATUS_COLORS,
} from "./project-status";
export type { ProjectStatus, RenderReadyCheck } from "./project-status";

// Flow stage definitions
export {
  FLOW_STAGES,
  getBlockingStages,
  getAsyncStages,
  getWizardStepForStage,
} from "./stages";
export type { FlowStage, StageClassification } from "./stages";
