/**
 * FrameAI — Highlight detection types.
 *
 * A "highlight" is a transcript segment that has been scored as noteworthy
 * by one or more classifiers.  Downstream consumers (edit plan generator,
 * UI) should rely on `priority` and `editHint` — not on raw scores.
 */

// ─── Priority ────────────────────────────────────────────────────────────────

/** Relative importance of a detected highlight. */
export type HighlightPriority = "high" | "medium" | "low";

// ─── Type ────────────────────────────────────────────────────────────────────

/**
 * Which classifier produced the highest contribution for this highlight.
 * A segment can match multiple classifiers; `dominantType` reflects the
 * one with the highest weighted score.
 */
export type HighlightType =
  | "strong-statement"   // Superlatives, certainty language, numeric precision
  | "emotional-peak"     // High-affect language, tension, personal story markers
  | "benefit-driven"     // Outcome words, comparisons, ease/value markers
  | "action-driving";    // Imperatives, CTA language, urgency signals

// ─── Per-classifier score ─────────────────────────────────────────────────────

/** Score breakdown from a single classifier run. */
export interface ClassifierScore {
  /** Classifier name (matches HighlightType). */
  type: HighlightType;
  /** Normalised 0–1 score. */
  score: number;
  /** Signal words/phrases that contributed to the score. */
  matched: string[];
}

// ─── Core highlight ───────────────────────────────────────────────────────────

export interface Highlight {
  /** Originating segment id. */
  segmentId: string;

  /** Verbatim text of the segment. */
  text: string;

  /** Speaker label from the source segment. */
  speaker: string;

  startMs: number;
  endMs: number;

  /** Aggregate score across all classifiers (0–1). */
  score: number;

  /** Rounded, human-readable score string e.g. "0.72". */
  scoreLabel: string;

  priority: HighlightPriority;

  /** Dominant classifier type. */
  dominantType: HighlightType;

  /** All classifier scores so callers can reason about multi-type segments. */
  classifierScores: ClassifierScore[];

  /**
   * A short directive for the edit plan generator.
   * e.g. "use as hook", "use as closing CTA", "feature as key proof-point"
   */
  editHint: string;
}

// ─── Detection result ─────────────────────────────────────────────────────────

export interface HighlightStats {
  total: number;
  high: number;
  medium: number;
  low: number;
  /** Type distribution counts. */
  byType: Record<HighlightType, number>;
}

export interface HighlightMetadata {
  detectedAt: string;          // ISO 8601
  schemaVersion: "1.0";
  segmentsAnalyzed: number;
  thresholds: {
    high: number;
    medium: number;
  };
}

export interface HighlightResult {
  highlights: Highlight[];
  stats: HighlightStats;
  metadata: HighlightMetadata;
}

// ─── Storage ──────────────────────────────────────────────────────────────────

export interface StoredHighlightResult extends HighlightResult {
  projectId: string;
}

// ─── Options ─────────────────────────────────────────────────────────────────

export interface DetectOptions {
  /** Only return highlights at or above this priority. Default: include all. */
  minPriority?: HighlightPriority;
  /**
   * Custom score thresholds.  Defaults: high ≥ 0.60, medium ≥ 0.38.
   * Segments below medium threshold are still returned with priority "low".
   */
  thresholds?: {
    high?: number;
    medium?: number;
  };
}
