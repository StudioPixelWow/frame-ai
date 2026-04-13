/**
 * FrameAI — Variation generation public API.
 *
 * import { generateVariations, ALL_STRATEGIES } from "@/lib/variations";
 */

export { generateVariations }                              from "./generate";
export { ALL_STRATEGIES, STRATEGY_CONFIGS }                from "./strategies";
export {
  storeVariations,
  getVariations,
  deleteVariations,
  listVariationProjects,
}                                                          from "./storage";
export type {
  VariationStrategy,
  PacingStyle,
  TransitionStyle,
  BrollDensity,
  MusicTone,
  EditPhase,
  VariationDirective,
  VariationSegment,
  Variation,
  VariationResult,
  VariationMetadata,
  StoredVariationResult,
  GenerateVariationOptions,
} from "./types";
export type { StrategyConfig }                             from "./strategies";
