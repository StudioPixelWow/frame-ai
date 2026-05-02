/**
 * FrameAI — Segment scoring for smart trimming.
 *
 * Produces a ScoredSegment for every transcript segment by combining:
 *   1. Highlight score from highlight detection
 *   2. Position bonus (hook region / CTA region)
 *   3. Important-moment bonus from transcript analysis
 *   4. Duration-fit penalty (too long or too sparse)
 *
 * All arithmetic — fully deterministic.
 */

import type { ScoredSegment, SegmentRole } from "./types";
import type { TranscriptSegment }           from "@/lib/transcript/types";
import type { TranscriptAnalysis }          from "@/lib/transcript/types";
import type { HighlightResult }             from "@/lib/transcript/highlights/types";

// ─── Weighting constants ──────────────────────────────────────────────────────

const W_HIGHLIGHT        = 0.50;  // highlight score contribution
const W_POSITION         = 1.00;  // position bonus multiplier
const W_IMPORTANT_MOMENT = 1.00;  // important-moment bonus multiplier
const W_DURATION         = 1.00;  // duration-fit penalty multiplier

// Position thresholds (fraction of total transcript duration)
const HOOK_REGION_END    = 0.20;  // first 20% = hook zone
const CTA_REGION_START   = 0.88;  // last 12% = CTA zone

// Duration fit: segments shorter or longer than these bounds get a penalty
const MIN_GOOD_DURATION_MS = 2_000;   // < 2s = too short
const MAX_GOOD_DURATION_MS = 12_000;  // > 12s = too long for tight budgets

// ─── Important-moment bonus table ────────────────────────────────────────────

const MOMENT_TYPE_BONUS: Record<string, number> = {
  "hook":        0.20,
  "cta":         0.20,
  "key-claim":   0.15,
  "proof-point": 0.15,
  "transition":  0.05,
};

// ─── Role derivation ──────────────────────────────────────────────────────────

/**
 * Derive a structural role from position and important-moment data.
 * Used by the edit plan generator to assign edit directives.
 */
function deriveRole(
  positionFraction: number,
  importantMomentType: string | null,
  highlightScore: number
): SegmentRole {
  if (positionFraction < HOOK_REGION_END && highlightScore > 0.25) return "hook";
  if (positionFraction > CTA_REGION_START)                          return "cta";
  if (importantMomentType === "key-claim")                          return "key-claim";
  if (importantMomentType === "proof-point")                        return "proof-point";
  if (highlightScore < 0.10)                                        return "filler";
  return "bridge";
}

// ─── Main scoring function ────────────────────────────────────────────────────

/**
 * Score all segments and return them sorted by totalScore descending.
 *
 * @param segments   Full transcript segments in timeline order
 * @param highlights Optional — provides per-segment highlight scores
 * @param analysis   Optional — provides important-moment bonus signals
 */
export function scoreSegments(
  segments: TranscriptSegment[],
  highlights?: HighlightResult,
  analysis?: TranscriptAnalysis
): ScoredSegment[] {
  if (segments.length === 0) return [];

  // Precompute total transcript span for relative-position arithmetic
  const firstStart  = segments[0].startMs;
  const lastEnd     = segments[segments.length - 1].endMs;
  const totalSpanMs = Math.max(1, lastEnd - firstStart);

  // Index highlight scores by segment id
  const highlightMap = new Map<string, number>();
  const priorityMap  = new Map<string, import("@/lib/transcript/highlights/types").HighlightPriority>();
  if (highlights) {
    for (const h of highlights.highlights) {
      highlightMap.set(h.segmentId, h.score);
      priorityMap.set(h.segmentId,  h.priority);
    }
  }

  // Index important-moment types by approximate segment overlap.
  // A moment "belongs to" the segment whose time range contains it.
  const momentTypeMap = new Map<string, string>(); // segmentId → moment type
  if (analysis?.importantMoments) {
    for (const moment of analysis.importantMoments) {
      // Find the segment whose range best contains this moment's midpoint
      const midMs = (moment.startMs + moment.endMs) / 2;
      let best: TranscriptSegment | null = null;
      let bestDist = Infinity;
      for (const seg of segments) {
        if (midMs >= seg.startMs && midMs <= seg.endMs) {
          best = seg;
          break;
        }
        // Nearest segment if no exact match
        const dist = Math.min(
          Math.abs(midMs - seg.startMs),
          Math.abs(midMs - seg.endMs)
        );
        if (dist < bestDist) { bestDist = dist; best = seg; }
      }
      if (best && !momentTypeMap.has(best.id)) {
        momentTypeMap.set(best.id, moment.type);
      }
    }
  }

  const scored: ScoredSegment[] = segments.map(seg => {
    const durationMs = Math.max(0, seg.endMs - seg.startMs);

    // 1. Highlight score
    const highlightScore = highlightMap.get(seg.id) ?? 0;
    const highlightPriority = priorityMap.get(seg.id) ?? null;

    // 2. Position bonus
    const segMidMs        = (seg.startMs + seg.endMs) / 2;
    const positionFrac    = (segMidMs - firstStart) / totalSpanMs;
    let positionBonus     = 0;
    if (positionFrac < HOOK_REGION_END)    positionBonus = 0.20;
    else if (positionFrac > CTA_REGION_START) positionBonus = 0.15;

    // 3. Important-moment bonus
    const momentType           = momentTypeMap.get(seg.id) ?? null;
    const importantMomentBonus = momentType ? (MOMENT_TYPE_BONUS[momentType] ?? 0) : 0;

    // 4. Duration-fit penalty
    let durationFitPenalty = 0;
    if (durationMs < MIN_GOOD_DURATION_MS) {
      // Too short: linear penalty scaling from 0 at limit down to -0.10
      durationFitPenalty = -0.10 * (1 - durationMs / MIN_GOOD_DURATION_MS);
    } else if (durationMs > MAX_GOOD_DURATION_MS) {
      // Too long: mild penalty — we don't want to exclude valid long segments
      const excess = durationMs - MAX_GOOD_DURATION_MS;
      durationFitPenalty = -Math.min(0.08, excess / 30_000);
    }

    // 5. Aggregate
    const totalScore = Math.min(1, Math.max(0,
      highlightScore * W_HIGHLIGHT +
      positionBonus  * W_POSITION  +
      importantMomentBonus * W_IMPORTANT_MOMENT +
      durationFitPenalty   * W_DURATION
    ));

    // 6. Role
    const role = deriveRole(positionFrac, momentType, highlightScore);

    return {
      id:                   seg.id,
      startMs:              seg.startMs,
      endMs:                seg.endMs,
      text:                 seg.text,
      speaker:              seg.speaker,
      durationMs,
      highlightScore,
      highlightPriority,
      positionBonus,
      importantMomentBonus,
      durationFitPenalty,
      totalScore,
      role,
    };
  });

  // Return sorted by totalScore desc (original order preserved for selection pass)
  return scored.sort((a, b) => b.totalScore - a.totalScore);
}
