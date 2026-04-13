/**
 * FrameAI — Smart trimming types.
 *
 * The trimmer takes a full transcript + highlight scores and produces
 * one TrimPlan per target duration (15s / 30s / 45s / custom).
 * Each plan is a ranked, ordered selection of segments that fits within
 * the budget and is ready for the edit plan generator.
 */

import type { HighlightPriority } from "@/lib/transcript/highlights/types";

// ─── Target duration presets ─────────────────────────────────────────────────

export type TargetDurationPreset = 15 | 30 | 45;

export interface TrimTarget {
  /**
   * Target duration in seconds.  Can be a preset (15/30/45) or custom.
   */
  durationSec: number;

  /**
   * How strictly to enforce the budget.
   *
   * strict  — never exceed target; may under-fill if no segment fits
   * relaxed — may exceed by up to one segment's duration to maximise coverage
   *
   * Default: "relaxed"
   */
  mode?: "strict" | "relaxed";
}

// ─── Scored segment ───────────────────────────────────────────────────────────

/**
 * A transcript segment enriched with trimmer scoring data.
 * All scores are 0–1.
 */
export interface ScoredSegment {
  /** Original segment id. */
  id:      string;
  startMs: number;
  endMs:   number;
  text:    string;
  speaker: string;
  durationMs: number;

  /** From highlight detection (0 if no highlight data provided). */
  highlightScore: number;

  /** Highlight priority label (null if no highlight data). */
  highlightPriority: HighlightPriority | null;

  /**
   * Position bonus based on where the segment sits in the full transcript.
   * Opening 20%  → hook bonus  (0.20)
   * Closing 12%  → CTA bonus   (0.15)
   * Middle        → 0.0
   */
  positionBonus: number;

  /**
   * Bonus for matching an important moment type from transcript analysis.
   * hook / cta → 0.20, key-claim / proof-point → 0.15, transition → 0.05
   */
  importantMomentBonus: number;

  /**
   * Penalty for segments that are either too long (hard to fit in tight budgets)
   * or too short (low information density).
   * Range: −0.10 to 0.0
   */
  durationFitPenalty: number;

  /**
   * Aggregate score used for ranking.
   * = highlightScore × 0.50
   * + positionBonus × 1.0
   * + importantMomentBonus × 1.0
   * + durationFitPenalty × 1.0
   * Clamped to [0, 1].
   */
  totalScore: number;

  /**
   * Structural role derived from scores — consumed by edit plan generator.
   * "hook"        → strong opening candidate
   * "proof-point" → evidence / credibility moment
   * "key-claim"   → main argument
   * "cta"         → closing call-to-action
   * "filler"      → low signal, drop first when budget is tight
   */
  role: SegmentRole;
}

export type SegmentRole =
  | "hook"
  | "proof-point"
  | "key-claim"
  | "cta"
  | "bridge"
  | "filler";

// ─── Selected segment (output of selection pass) ──────────────────────────────

export interface TrimmedSegment {
  segmentId: string;
  startMs:   number;
  endMs:     number;
  durationMs: number;
  text:      string;
  speaker:   string;
  score:     number;
  role:      SegmentRole;

  /**
   * Edit hint for the edit plan generator.
   * Inherited from highlight detection or derived from role.
   */
  editHint: string;
}

// ─── Plan for a single target duration ───────────────────────────────────────

export interface TrimPlan {
  targetDurationSec:  number;
  actualDurationSec:  number;
  /** Fraction of target filled: actualDuration / targetDuration. 1.0 = perfect. */
  fillRatio:          number;
  /** Segments dropped (total − selected). */
  droppedCount:       number;
  /** Segments kept, in original timeline order. */
  selectedSegments:   TrimmedSegment[];
  /** Unique speakers present in the selection. */
  speakersIncluded:   string[];
  /** Brief description of what was kept (for UI/edit plan). */
  summary:            string;
}

// ─── Full result ─────────────────────────────────────────────────────────────

export interface TrimResult {
  /** All scored segments (full transcript, ranked). */
  scoredSegments: ScoredSegment[];
  /** One plan per requested target duration. */
  plans:          TrimPlan[];
  metadata:       TrimMetadata;
}

export interface TrimMetadata {
  generatedAt:          string;   // ISO 8601
  schemaVersion:        "1.0";
  totalSegments:        number;
  totalDurationSec:     number;
  targetsRequested:     number[];
  highlightsUsed:       boolean;
  analysisUsed:         boolean;
}

export interface StoredTrimResult extends TrimResult {
  projectId: string;
}

// ─── Options ─────────────────────────────────────────────────────────────────

export interface GenerateTrimOptions {
  /**
   * Target durations to plan for.
   * Defaults to all three presets: [15, 30, 45].
   */
  targets?: TrimTarget[];

  /**
   * When true, always include the best hook segment in every plan,
   * even if a higher-scoring non-hook segment would have been preferred.
   * Default: true.
   */
  preserveHook?: boolean;

  /**
   * When true, always include the best CTA segment in every plan.
   * Default: true.
   */
  preserveCta?: boolean;

  /**
   * Minimum score threshold — segments below this are never selected.
   * Range 0–1.  Default: 0.05 (only absolute filler is excluded).
   */
  minScore?: number;
}
