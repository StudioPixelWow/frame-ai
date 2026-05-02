/**
 * FrameAI — B-roll suggestion public API.
 *
 * import { generateBroll, getTopBrollSuggestions } from "@/lib/broll";
 */

export { generateBroll, getTopBrollSuggestions }          from "./generate";
export {
  extractVisualKeywords,
  extractActionKeywords,
  extractMoodKeywords,
  extractWeightedSignals,
  TONE_MOOD_DEFAULTS,
}                                                         from "./keywords";
export { storeBroll, getBroll, deleteBroll,
         listBrollProjects }                              from "./storage";
export type {
  BrollKeywords,
  BrollSearchTerm,
  BrollSegmentSuggestion,
  BrollResult,
  StoredBrollResult,
  GenerateBrollOptions,
  BrollGenerationMetadata,
}                                                         from "./types";
