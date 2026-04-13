/**
 * FrameAI — Smart trimming orchestrator.
 *
 * Public entrypoint:
 *   generateTrimPlans(segments, highlights?, analysis?, options?)
 *
 * Returns a TrimResult with:
 *   - scoredSegments: all segments ranked by importance
 *   - plans[]: one TrimPlan per target duration (15s / 30s / 45s / custom)
 */

import { scoreSegments }   from "./score";
import { selectForTarget } from "./select";
import type {
  GenerateTrimOptions,
  TrimMetadata,
  TrimPlan,
  TrimResult,
  TrimTarget,
}                           from "./types";
import type { TranscriptSegment }   from "@/lib/transcript/types";
import type { TranscriptAnalysis }  from "@/lib/transcript/types";
import type { HighlightResult }     from "@/lib/transcript/highlights/types";

// ─── Defaults ─────────────────────────────────────────────────────────────────

const DEFAULT_TARGETS: TrimTarget[] = [
  { durationSec: 15, mode: "relaxed" },
  { durationSec: 30, mode: "relaxed" },
  { durationSec: 45, mode: "relaxed" },
];
const DEFAULT_MIN_SCORE    = 0.05;
const DEFAULT_PRESERVE_HOOK = true;
const DEFAULT_PRESERVE_CTA  = true;

// ─── Main entrypoint ──────────────────────────────────────────────────────────

/**
 * Generate trim plans for one or more target durations.
 *
 * @param segments   Full transcript segments in timeline order
 * @param highlights Optional highlight detection result (enriches scores)
 * @param analysis   Optional transcript analysis (adds important-moment bonuses)
 * @param options    Target durations, anchor preservation, score threshold
 */
export function generateTrimPlans(
  segments:   TranscriptSegment[],
  highlights?: HighlightResult,
  analysis?:  TranscriptAnalysis,
  options:    GenerateTrimOptions = {}
): TrimResult {
  const targets       = options.targets       ?? DEFAULT_TARGETS;
  const preserveHook  = options.preserveHook  ?? DEFAULT_PRESERVE_HOOK;
  const preserveCta   = options.preserveCta   ?? DEFAULT_PRESERVE_CTA;
  const minScore      = options.minScore      ?? DEFAULT_MIN_SCORE;

  // Score all segments — returns sorted by totalScore desc
  const scoredRanked    = scoreSegments(segments, highlights, analysis);

  // Keep a timeline-order copy for anchor detection and final output order
  const scoredByTime = [...scoredRanked].sort((a, b) => a.startMs - b.startMs);

  // Generate one plan per target
  const plans: TrimPlan[] = targets.map(target =>
    selectForTarget(
      scoredRanked,
      scoredByTime,
      target,
      preserveHook,
      preserveCta,
      minScore
    )
  );

  // Compute total transcript duration from original segments
  const totalDurationMs =
    segments.length > 0
      ? segments[segments.length - 1].endMs - segments[0].startMs
      : 0;

  const metadata: TrimMetadata = {
    generatedAt:      new Date().toISOString(),
    schemaVersion:    "1.0",
    totalSegments:    segments.length,
    totalDurationSec: Math.round(totalDurationMs / 1000),
    targetsRequested: targets.map(t => t.durationSec),
    highlightsUsed:   !!highlights,
    analysisUsed:     !!analysis,
  };

  return {
    scoredSegments: scoredRanked,
    plans,
    metadata,
  };
}

/**
 * Convenience: get the trim plan for a single specific target duration.
 * Generates all default plans and returns the one matching `durationSec`.
 * If no exact match, returns the plan whose target is closest.
 */
export function getTrimPlanFor(
  durationSec: number,
  segments:    TranscriptSegment[],
  highlights?: HighlightResult,
  analysis?:   TranscriptAnalysis,
  options?:    GenerateTrimOptions
): TrimPlan {
  const targets: TrimTarget[] = [{ durationSec, mode: "relaxed" }];
  const result = generateTrimPlans(segments, highlights, analysis, {
    ...options,
    targets,
  });
  return result.plans[0];
}
