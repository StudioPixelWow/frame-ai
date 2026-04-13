/**
 * PixelFrameAI — Remotion Runtime Handoff Module
 *
 * The connective tissue between the Phase 5 data model and the
 * Phase 6.5 render worker. Covers:
 *   - Composition layout calculation (format → pixel dimensions)
 *   - Coordinate system helpers (frame ↔ clip time ↔ source time)
 *   - Input props validation (pre-renderMedia guard)
 *   - Font loading for the Remotion bundle
 *
 * Usage:
 *   import { calculateCompositionLayout, validateInputProps } from '@/lib/remotion';
 */

// Composition layout
export {
  COMPOSITION_SIZES,
  COMPOSITION_FPS,
  REMOTION_COMPOSITION_ID,
  calculateCompositionLayout,
  frameToClipTimeSec,
  clipTimeToSourceTimeSec,
  clipStartToFrame,
} from "./composition-layout";
export type { CompositionLayout } from "./composition-layout";

// Input props validation
export {
  validateInputProps,
  RenderValidationError,
} from "./validate-props";

// Font loading (Remotion bundle only)
export { loadFontsFromPayload } from "./font-loader";
