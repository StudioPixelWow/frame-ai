/**
 * FrameAI — Highlight detection public API.
 *
 * Import from here:
 *   import { detectHighlights, getTopHighlights } from "@/lib/transcript/highlights";
 */

export { detectHighlights, getTopHighlights }              from "./detect";
export { runAllClassifiers,
         classifyStrongStatement,
         classifyEmotionalPeak,
         classifyBenefitDriven,
         classifyActionDriving }                           from "./classifiers";
export { storeHighlights, getHighlights,
         deleteHighlights, listHighlightProjects }         from "./storage";
export type {
  Highlight,
  HighlightPriority,
  HighlightType,
  HighlightResult,
  HighlightStats,
  HighlightMetadata,
  ClassifierScore,
  StoredHighlightResult,
  DetectOptions,
} from "./types";
