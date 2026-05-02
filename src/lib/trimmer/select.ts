/**
 * FrameAI — Budget-aware segment selection.
 *
 * Given a ranked list of ScoredSegments and a target duration budget,
 * selects the best-scoring segments that fit within the budget.
 *
 * Algorithm (deterministic, greedy with structural constraints):
 *
 *  Phase 1 — Reserve structural anchors
 *    a. Best "hook" segment (from opening 20%) → always included if it fits
 *    b. Best "cta"  segment (from closing 12%) → always included if it fits
 *
 *  Phase 2 — Fill remaining budget from highest-scoring non-anchor segments
 *    Iterate ranked list (excluding already-selected), add if fits in budget.
 *
 *  Phase 3 — Timeline sort
 *    Return selected segments in original startMs order.
 *
 *  Strict mode:  never exceed budget — skip any segment that would overflow.
 *  Relaxed mode: allow one overflow segment if it brings fill ratio above 80%.
 */

import type {
  ScoredSegment,
  SegmentRole,
  TrimmedSegment,
  TrimPlan,
  TrimTarget,
} from "./types";

// ─── Edit hint table (for edit plan generator) ────────────────────────────────

const ROLE_EDIT_HINTS: Record<SegmentRole, string> = {
  "hook":        "open with this segment — minimal cuts, direct to camera",
  "key-claim":   "feature as main argument — consider title card overlay",
  "proof-point": "support with B-roll or on-screen stat graphic",
  "cta":         "close on this segment — add CTA overlay and end card",
  "bridge":      "transition cut — keep pacing tight",
  "filler":      "cut candidate — drop if budget is tight",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toTrimmedSegment(s: ScoredSegment): TrimmedSegment {
  return {
    segmentId:  s.id,
    startMs:    s.startMs,
    endMs:      s.endMs,
    durationMs: s.durationMs,
    text:       s.text,
    speaker:    s.speaker,
    score:      parseFloat(s.totalScore.toFixed(3)),
    role:       s.role,
    editHint:   ROLE_EDIT_HINTS[s.role],
  };
}

function msToSec(ms: number): number {
  return Math.round(ms / 100) / 10; // round to 1dp
}

function buildPlanSummary(selected: TrimmedSegment[], targetSec: number): string {
  const roles = selected.map(s => s.role);
  const hasHook = roles.includes("hook");
  const hasCta  = roles.includes("cta") || roles.includes("key-claim");
  const claimCount = roles.filter(r => r === "key-claim" || r === "proof-point").length;

  const parts: string[] = [];
  if (hasHook)       parts.push("opening hook");
  if (claimCount > 0) parts.push(`${claimCount} key claim${claimCount > 1 ? "s" : ""}`);
  if (hasCta)        parts.push("closing CTA");

  const kept = selected.length;
  const base = `${kept} segment${kept !== 1 ? "s" : ""} selected for ${targetSec}s cut`;
  return parts.length > 0 ? `${base} — includes ${parts.join(", ")}` : base;
}

// ─── Main selection function ──────────────────────────────────────────────────

/**
 * Select segments for a single target duration.
 *
 * @param ranked        Segments sorted by totalScore descending
 * @param originalOrder Segments in timeline order (for anchor lookup)
 * @param target        Duration target with optional mode
 * @param preserveHook  Reserve slot for best hook segment
 * @param preserveCta   Reserve slot for best CTA segment
 * @param minScore      Skip segments below this threshold
 */
export function selectForTarget(
  ranked:        ScoredSegment[],
  originalOrder: ScoredSegment[],
  target:        TrimTarget,
  preserveHook:  boolean,
  preserveCta:   boolean,
  minScore:      number
): TrimPlan {
  const budgetMs  = target.durationSec * 1_000;
  const strict    = target.mode === "strict";
  const selected  = new Set<string>();
  let usedMs      = 0;

  // Filter out below-threshold segments
  const eligible = ranked.filter(s => s.totalScore >= minScore);

  // ── Phase 1a: Hook anchor ──────────────────────────────────────────────────
  if (preserveHook) {
    const hookCandidates = originalOrder.filter(
      s => s.role === "hook" && s.totalScore >= minScore
    );
    // Pick highest-scoring hook that fits
    const bestHook = hookCandidates
      .slice() // preserve order
      .sort((a, b) => b.totalScore - a.totalScore)
      .find(s => s.durationMs <= budgetMs);

    if (bestHook) {
      selected.add(bestHook.id);
      usedMs += bestHook.durationMs;
    }
  }

  // ── Phase 1b: CTA anchor ───────────────────────────────────────────────────
  if (preserveCta) {
    const ctaCandidates = originalOrder.filter(
      s => s.role === "cta" && s.totalScore >= minScore && !selected.has(s.id)
    );
    const bestCta = ctaCandidates
      .slice()
      .sort((a, b) => b.totalScore - a.totalScore)
      .find(s => usedMs + s.durationMs <= budgetMs);

    if (bestCta) {
      selected.add(bestCta.id);
      usedMs += bestCta.durationMs;
    }
  }

  // ── Phase 2: Fill from ranked list ────────────────────────────────────────
  for (const seg of eligible) {
    if (selected.has(seg.id)) continue;           // already anchored
    if (seg.role === "filler") continue;          // never fill with filler

    const remaining = budgetMs - usedMs;

    if (seg.durationMs <= remaining) {
      selected.add(seg.id);
      usedMs += seg.durationMs;
    } else if (!strict) {
      // Relaxed: allow one overflow if it pushes fill ratio above 80%
      const fillIfAdded = (usedMs + seg.durationMs) / budgetMs;
      const currentFill = usedMs / budgetMs;
      if (currentFill < 0.80 && fillIfAdded <= 1.20) {
        selected.add(seg.id);
        usedMs += seg.durationMs;
        break; // one overflow maximum
      }
    }

    if (usedMs >= budgetMs) break;
  }

  // ── Phase 3: Timeline sort ────────────────────────────────────────────────
  const selectedSegments: TrimmedSegment[] = originalOrder
    .filter(s => selected.has(s.id))
    .map(toTrimmedSegment);

  const actualDurationSec = msToSec(usedMs);
  const fillRatio         = parseFloat(Math.min(1, usedMs / budgetMs).toFixed(3));
  const speakersIncluded  = [...new Set(selectedSegments.map(s => s.speaker))];
  const droppedCount      = originalOrder.length - selectedSegments.length;

  return {
    targetDurationSec:  target.durationSec,
    actualDurationSec,
    fillRatio,
    droppedCount,
    selectedSegments,
    speakersIncluded,
    summary: buildPlanSummary(selectedSegments, target.durationSec),
  };
}
