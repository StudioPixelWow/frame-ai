/**
 * FrameAI — B-roll suggestion types.
 *
 * B-roll suggestions are generated per transcript segment.
 * The output is deliberately provider-agnostic — no stock API calls here —
 * so the same data can drive manual asset matching, stock search, or
 * AI-generated imagery in the future.
 */

import type { HighlightPriority } from "@/lib/transcript/highlights/types";

// ─── Keyword categories ───────────────────────────────────────────────────────

/**
 * Structured keyword bundle for a single segment.
 *
 * visual   — concrete, camera-able nouns & settings
 *            e.g. "laptop", "whiteboard", "office", "city street"
 *
 * action   — visible activities or movements
 *            e.g. "typing", "presenting", "handshake", "running"
 *
 * mood     — atmosphere, lighting, emotional register
 *            e.g. "confident", "dynamic", "minimal", "warm"
 */
export interface BrollKeywords {
  visual: string[];
  action: string[];
  mood:   string[];
}

// ─── Composed search term ─────────────────────────────────────────────────────

/**
 * A single ready-to-use search query for a stock library or asset search.
 *
 * composed  — multi-word phrase e.g. "business professional shaking hands office"
 * score     — relevance score 0–1 (deterministic, based on keyword weights)
 * source    — which category drove this term
 */
export interface BrollSearchTerm {
  composed: string;
  score:    number;
  source:   "visual" | "action" | "mood" | "combined";
}

// ─── Per-segment suggestion ───────────────────────────────────────────────────

export interface BrollSegmentSuggestion {
  /** Originating transcript segment id. */
  segmentId: string;

  startMs: number;
  endMs:   number;

  /** Verbatim segment text (for manual review). */
  text: string;

  speaker: string;

  /**
   * Priority from the highlight detection pass.
   * "high" / "medium" segments get richer keyword sets.
   * null when no highlight data was provided.
   */
  highlightPriority: HighlightPriority | null;

  /** Structured keyword bundles. */
  keywords: BrollKeywords;

  /**
   * Ranked search terms — ordered by score descending.
   * Ready to pass to any stock API (Pexels, Unsplash, Shutterstock, etc.)
   * or used for manual asset matching.
   */
  searchTerms: BrollSearchTerm[];

  /**
   * Estimated B-roll duration needed in seconds.
   * Derived from (endMs - startMs) rounded up to nearest second.
   */
  durationNeededSec: number;
}

// ─── Result ───────────────────────────────────────────────────────────────────

export interface BrollGenerationMetadata {
  generatedAt:      string;      // ISO 8601
  schemaVersion:    "1.0";
  segmentsAnalyzed: number;
  /** Segments where B-roll was actually suggested (score > 0). */
  segmentsWithSuggestions: number;
  /** Total unique search terms generated across all segments. */
  totalSearchTerms: number;
  /** Whether highlight priority data was used to enrich suggestions. */
  highlightsUsed: boolean;
}

export interface BrollResult {
  /** One entry per input segment, in original order. */
  suggestions: BrollSegmentSuggestion[];
  metadata:    BrollGenerationMetadata;
}

export interface StoredBrollResult extends BrollResult {
  projectId: string;
}

// ─── Options ─────────────────────────────────────────────────────────────────

export interface GenerateBrollOptions {
  /**
   * Skip segments whose highlight priority is below this threshold.
   * Useful when you only want B-roll for the most important moments.
   * Default: include all segments.
   */
  minPriority?: HighlightPriority;

  /**
   * Max number of search terms per segment.
   * Default: 5.
   */
  maxSearchTerms?: number;

  /**
   * Max keywords per category (visual / action / mood).
   * Default: 6.
   */
  maxKeywordsPerCategory?: number;

  /**
   * Tone context — used to bias mood keyword selection.
   * If omitted, mood keywords are derived from segment text only.
   */
  tone?: string;
}
