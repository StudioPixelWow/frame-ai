/**
 * PixelFrameAI — Persistence Module
 *
 * Central export for all project state persistence utilities.
 *
 * Usage:
 *   import { serialiseWizardState, loadProjectState, migratePersistedState, createAutoSave } from '@/lib/persistence';
 */

export { serialiseWizardState } from "./serialise";
export type { WizardState, VideoPreviewState } from "./serialise";

export { loadProjectState } from "./restore";
export type {
  TransientFlags,
  RestoredRenderState,
  RestoredProjectState,
} from "./restore";

export { migratePersistedState, needsMigration } from "./migrate";

export { createAutoSave } from "./auto-save";
