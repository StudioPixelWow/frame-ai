/**
 * FrameAI — Transcript Intelligence Types
 *
 * All data shapes for transcript input, analysis output, and storage.
 * Keep this file as the single source of truth; import from here everywhere.
 */

// ── Input ─────────────────────────────────────────────────────────────────────

/** One speaker turn from a transcription engine. */
export interface TranscriptSegment {
  /** Unique segment identifier (e.g. "seg_001"). */
  id: string;
  /** Start time in milliseconds relative to video start. */
  startMs: number;
  /** End time in milliseconds relative to video start. */
  endMs: number;
  /** Speaker label (e.g. "SPEAKER_01", "Host", "Guest"). */
  speaker: string;
  /** Verbatim spoken text for this segment. */
  text: string;
}

// ── Analysis output ───────────────────────────────────────────────────────────

/** Detected emotional / stylistic tone of the transcript. */
export interface TranscriptTone {
  /** Single primary tone label. */
  primary:
    | "professional"
    | "casual"
    | "energetic"
    | "educational"
    | "persuasive"
    | "inspirational"
    | "neutral";
  /** Confidence in the primary label, 0–1. */
  confidence: number;
  /** Additional tone descriptors (up to 4). */
  descriptors: string[];
}

/** A moment in the transcript worth flagging for editorial attention. */
export interface ImportantMoment {
  /** Segment start time (ms). */
  startMs: number;
  /** Segment end time (ms). */
  endMs: number;
  /** Verbatim or paraphrased text of the moment. */
  text: string;
  /** Short human-readable explanation of why this moment matters. */
  reason: string;
  /** Structural role of this moment in the edit. */
  type: "hook" | "cta" | "key-claim" | "proof-point" | "transition" | "emotional-peak";
  /** Importance score, 0–1 (higher = more important). */
  score: number;
}

/** Full structured analysis result for a transcript. */
export interface TranscriptAnalysis {
  /** One-paragraph plain-English summary of the transcript content. */
  summary: string;
  /** 3–6 thematic topics covered (nouns / short noun phrases). */
  keyTopics: string[];
  /** 8–12 significant keywords by relevance. */
  keywords: string[];
  /** Detected tone. */
  tone: TranscriptTone;
  /** Ranked list of editorially important moments. */
  importantMoments: ImportantMoment[];
  /** Processing metadata. */
  metadata: AnalysisMetadata;
}

export interface AnalysisMetadata {
  /** ISO timestamp of when analysis was produced. */
  analyzedAt: string;
  /** Which provider produced this analysis. */
  provider: "anthropic" | "fallback";
  /** Total word count across all segments. */
  wordCount: number;
  /** Number of unique speakers. */
  speakerCount: number;
  /** Total transcript duration in milliseconds. */
  durationMs: number;
  /** Version of the analysis schema (bump when types change). */
  schemaVersion: "1.0";
}

// ── Options ───────────────────────────────────────────────────────────────────

export interface AnalyzeOptions {
  /**
   * Project ID used as the storage key.
   * If omitted, analysis is returned but not persisted.
   */
  projectId?: string;
  /**
   * Force a specific provider.
   * Useful for testing fallback logic or bypassing AI quota.
   */
  forceProvider?: "anthropic" | "fallback";
  /**
   * Anthropic model to use (defaults to claude-haiku-4-5-20251001 for speed/cost).
   * Override with a more capable model for production.
   */
  model?: string;
}

// ── Storage ───────────────────────────────────────────────────────────────────

export interface StoredAnalysis {
  projectId: string;
  analysis: TranscriptAnalysis;
  /** ISO timestamp of last write. */
  savedAt: string;
}
