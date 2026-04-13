/**
 * FrameAI — Hook generation types.
 *
 * A "hook" is a short, social-ready opening line designed to stop the scroll
 * and pull a viewer into the content.  Three distinct options are always
 * generated so editors can choose the best fit for their platform and mood.
 */

import type { TranscriptTone } from "@/lib/transcript/types";

// ─── Style ────────────────────────────────────────────────────────────────────

/**
 * The rhetorical approach of the hook.
 *
 * question       — Engages through direct curiosity ("What if you could…?")
 * bold-statement — Declarative, high-confidence claim ("This changed everything.")
 * curiosity      — Teases hidden information ("Most people don't know this…")
 * benefit-driven — Leads with the viewer's gain ("In 30 days, you'll…")
 */
export type HookStyle =
  | "question"
  | "bold-statement"
  | "curiosity"
  | "benefit-driven";

// ─── Preset names (mirrors Brand Preset system) ───────────────────────────────

export type PresetName =
  | "pixel-premium"
  | "pixel-performance"
  | "pixel-social"
  | string;   // allow custom preset IDs without breaking callers

// ─── Core hook ────────────────────────────────────────────────────────────────

export interface Hook {
  /** Stable identifier: `<style>-<index>` e.g. "question-0". */
  id: string;

  /** The hook text — ready to display as a caption or lower-third. */
  text: string;

  style: HookStyle;

  /**
   * Why this hook was selected / what makes it work.
   * Shown in the UI tooltip and useful for the edit plan generator.
   */
  rationale: string;

  /**
   * Approximate character count (for platform-aware truncation).
   * Hooks should stay under 120 characters for social readiness.
   */
  charCount: number;

  /**
   * Hint for the edit plan generator.
   * e.g. "place in first 3 seconds", "overlay on opening shot"
   */
  editHint: string;
}

// ─── Result ───────────────────────────────────────────────────────────────────

export interface HookGenerationMetadata {
  generatedAt: string;        // ISO 8601
  schemaVersion: "1.0";
  preset: PresetName | null;
  tone: TranscriptTone;
  /** Styles used for the three hooks (in order). */
  stylesUsed: HookStyle[];
  /** Keyword signals extracted from the transcript analysis. */
  extractedSignals: ExtractedSignals;
}

export interface HookResult {
  /** Always exactly 3 hooks, one per selected style. */
  hooks: [Hook, Hook, Hook];
  metadata: HookGenerationMetadata;
}

export interface StoredHookResult extends HookResult {
  projectId: string;
}

// ─── Extracted signals ────────────────────────────────────────────────────────

/**
 * Structured signals distilled from TranscriptAnalysis + HighlightResult.
 * Used by all style generators as their raw material.
 */
export interface ExtractedSignals {
  /** Primary topic phrase (1–4 words). */
  primaryTopic: string;
  /** Top benefit or outcome phrase from the transcript. */
  topBenefit: string;
  /** Top pain-point or tension phrase. */
  topPain: string;
  /** A surprising or counter-intuitive claim fragment. */
  curiosityHook: string;
  /** A short "proof" phrase (stat, result, timeframe). */
  proofPoint: string;
  /** Dominant keyword (highest-frequency content word). */
  topKeyword: string;
  /** Second-highest keyword (for variation). */
  secondKeyword: string;
}

// ─── Generation options ───────────────────────────────────────────────────────

export interface GenerateHooksOptions {
  /**
   * Brand preset name — biases style selection and vocabulary.
   * If omitted, style selection falls back to tone alone.
   */
  preset?: PresetName;
  /**
   * Force specific styles instead of using the preset/tone bias.
   * Must provide exactly 3 unique styles.
   */
  forceStyles?: [HookStyle, HookStyle, HookStyle];
  /**
   * Max characters per hook.  Defaults to 110.
   * If a generated hook exceeds this, it is truncated at the last word
   * before the limit and "…" is appended.
   */
  maxChars?: number;
}
