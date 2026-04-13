/**
 * FrameAI — Transcript intelligence public API.
 *
 * Import from here in the rest of the codebase:
 *   import { analyzeTranscript, getAnalysis } from "@/lib/transcript";
 */

export { analyzeTranscript }               from "./analyze";
export { getAnalysis, storeAnalysis,
         deleteAnalysis, listAnalyses }    from "./storage";
export { analyzeWithFallback }             from "./providers/fallback";
export { analyzeWithAnthropic }            from "./providers/anthropic";
export type {
  TranscriptSegment,
  TranscriptAnalysis,
  TranscriptTone,
  ImportantMoment,
  AnalysisMetadata,
  AnalyzeOptions,
  StoredAnalysis,
} from "./types";

// ─── Highlight detection ──────────────────────────────────────────────────────
export { detectHighlights, getTopHighlights }              from "./highlights/detect";
export { runAllClassifiers }                               from "./highlights/classifiers";
export { storeHighlights, getHighlights,
         deleteHighlights, listHighlightProjects }         from "./highlights/storage";
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
} from "./highlights/types";
