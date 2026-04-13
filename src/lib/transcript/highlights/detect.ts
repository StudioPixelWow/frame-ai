/**
 * FrameAI — Highlight detection orchestrator.
 *
 * Takes transcript segments, runs all four classifiers against each segment,
 * combines scores, assigns priority, and attaches an editHint for the edit
 * plan generator.
 *
 * Fully deterministic — no randomness, no I/O.
 */

import { runAllClassifiers } from "./classifiers";
import type {
  ClassifierScore,
  DetectOptions,
  Highlight,
  HighlightMetadata,
  HighlightPriority,
  HighlightResult,
  HighlightStats,
  HighlightType,
} from "./types";
import type { TranscriptSegment } from "../types";

// ─── Constants ────────────────────────────────────────────────────────────────

const DEFAULT_THRESHOLD_HIGH   = 0.60;
const DEFAULT_THRESHOLD_MEDIUM = 0.38;

/** Weights applied to each classifier when computing the aggregate score. */
const CLASSIFIER_WEIGHTS: Record<HighlightType, number> = {
  "strong-statement": 1.0,
  "emotional-peak":   0.9,
  "benefit-driven":   1.0,
  "action-driving":   0.95,
};

/**
 * Map from dominant type to a human-readable edit hint.
 * Designed to be consumed verbatim by the edit plan generator.
 */
const EDIT_HINTS: Record<HighlightType, Record<HighlightPriority, string>> = {
  "strong-statement": {
    high:   "feature as a bold on-screen claim or pull-quote",
    medium: "reinforce with lower-third text overlay",
    low:    "keep as supporting statement",
  },
  "emotional-peak": {
    high:   "use as emotional anchor — minimal cuts, close-up if available",
    medium: "pair with subtle music swell",
    low:    "retain for narrative continuity",
  },
  "benefit-driven": {
    high:   "use as key proof-point — add supporting B-roll or graphic",
    medium: "feature with benefit callout overlay",
    low:    "use as supporting context",
  },
  "action-driving": {
    high:   "use as closing CTA — maximise screen time, add CTA graphic",
    medium: "reinforce with on-screen call-to-action text",
    low:    "include near end of edit",
  },
};

// ─── Internal helpers ─────────────────────────────────────────────────────────

/**
 * Combines classifier scores into a single aggregate score.
 *
 * Strategy:
 *  1. Take the weighted average only over classifiers that actually fired
 *     (score > 0).  This prevents unfired classifiers from diluting a
 *     strong single-type signal.
 *  2. Apply a mild multi-signal bonus (+8% per additional firing classifier)
 *     to reward segments where multiple types converge.
 *
 * If no classifier fired, returns 0.
 */
function aggregateScore(classifierScores: ClassifierScore[]): number {
  const fired = classifierScores.filter(cs => cs.score > 0);
  if (fired.length === 0) return 0;

  let weightedSum = 0;
  let totalWeight = 0;

  for (const cs of fired) {
    const w = CLASSIFIER_WEIGHTS[cs.type];
    weightedSum += cs.score * w;
    totalWeight += w;
  }

  const base = weightedSum / totalWeight;
  // +8% per additional classifier that fired beyond the first
  const multiFactor = 1 + (fired.length - 1) * 0.08;

  return Math.min(1, base * multiFactor);
}

function assignPriority(
  score: number,
  thresholdHigh: number,
  thresholdMedium: number
): HighlightPriority {
  if (score >= thresholdHigh)   return "high";
  if (score >= thresholdMedium) return "medium";
  return "low";
}

function dominantClassifier(classifierScores: ClassifierScore[]): HighlightType {
  let best = classifierScores[0];
  for (const cs of classifierScores) {
    if (cs.score > best.score) best = cs;
  }
  return best.type;
}

function buildStats(highlights: Highlight[]): HighlightStats {
  const byType: Record<HighlightType, number> = {
    "strong-statement": 0,
    "emotional-peak":   0,
    "benefit-driven":   0,
    "action-driving":   0,
  };
  let high = 0, medium = 0, low = 0;

  for (const h of highlights) {
    if (h.priority === "high")   high++;
    if (h.priority === "medium") medium++;
    if (h.priority === "low")    low++;
    byType[h.dominantType]++;
  }

  return { total: highlights.length, high, medium, low, byType };
}

function buildMetadata(
  segmentsAnalyzed: number,
  thresholdHigh: number,
  thresholdMedium: number
): HighlightMetadata {
  return {
    detectedAt: new Date().toISOString(),
    schemaVersion: "1.0",
    segmentsAnalyzed,
    thresholds: { high: thresholdHigh, medium: thresholdMedium },
  };
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Detect highlights in a list of transcript segments.
 *
 * Returns ALL segments as highlights (including low priority) so callers
 * can filter by `minPriority` in `options` if desired.
 */
export function detectHighlights(
  segments: TranscriptSegment[],
  options: DetectOptions = {}
): HighlightResult {
  const thresholdHigh   = options.thresholds?.high   ?? DEFAULT_THRESHOLD_HIGH;
  const thresholdMedium = options.thresholds?.medium  ?? DEFAULT_THRESHOLD_MEDIUM;

  const allHighlights: Highlight[] = segments.map(seg => {
    const classifierScores = runAllClassifiers(seg.text);
    const score            = aggregateScore(classifierScores);
    const priority         = assignPriority(score, thresholdHigh, thresholdMedium);
    const dominant         = dominantClassifier(classifierScores);
    const editHint         = EDIT_HINTS[dominant][priority];

    return {
      segmentId:        seg.id,
      text:             seg.text,
      speaker:          seg.speaker,
      startMs:          seg.startMs,
      endMs:            seg.endMs,
      score,
      scoreLabel:       score.toFixed(2),
      priority,
      dominantType:     dominant,
      classifierScores,
      editHint,
    };
  });

  // Apply minPriority filter if requested
  const PRIORITY_RANK: Record<HighlightPriority, number> = { high: 2, medium: 1, low: 0 };
  const minRank = options.minPriority ? PRIORITY_RANK[options.minPriority] : -1;
  const highlights = allHighlights.filter(h => PRIORITY_RANK[h.priority] >= minRank);

  // Sort: high first, then medium, then low; within same priority sort by score desc
  highlights.sort((a, b) => {
    const rankDiff = PRIORITY_RANK[b.priority] - PRIORITY_RANK[a.priority];
    if (rankDiff !== 0) return rankDiff;
    return b.score - a.score;
  });

  return {
    highlights,
    stats:    buildStats(highlights),
    metadata: buildMetadata(segments.length, thresholdHigh, thresholdMedium),
  };
}

/**
 * Convenience: return only high and medium priority highlights, sorted by
 * start time (for use as an ordered edit list).
 */
export function getTopHighlights(
  segments: TranscriptSegment[],
  options: DetectOptions = {}
): Highlight[] {
  const result = detectHighlights(segments, {
    ...options,
    minPriority: options.minPriority ?? "medium",
  });

  // Re-sort by start time for timeline consumption
  return [...result.highlights].sort((a, b) => a.startMs - b.startMs);
}
