/**
 * FrameAI — CTA generation types.
 *
 * A CTA (call-to-action) is the one line at the end of a video or overlay
 * that tells the viewer exactly what to do next.  2–3 options are generated
 * per project so editors can match platform, tone, and campaign goal.
 */

import type { TranscriptTone } from "@/lib/transcript/types";
import type { PresetName }     from "@/lib/hooks/types";

// ─── Goal ────────────────────────────────────────────────────────────────────

/**
 * The business outcome the CTA is designed to drive.
 *
 * lead-generation  — Capture contact details or a download
 * awareness        — Drive brand/content discovery with no commitment
 * inquiry          — Prompt a question, consultation, or conversation starter
 * booking          — Get a calendar slot or appointment confirmed
 * contact          — Direct reach-out (email, phone, form)
 */
export type CtaGoal =
  | "lead-generation"
  | "awareness"
  | "inquiry"
  | "booking"
  | "contact";

// ─── Business type ────────────────────────────────────────────────────────────

/**
 * The creator's or client's business category.
 * Influences action-verb vocabulary and qualifier language.
 */
export type BusinessType =
  | "agency"
  | "saas"
  | "ecommerce"
  | "consultant"
  | "creator"
  | "brand"
  | "startup"
  | "enterprise"
  | string;   // open-ended for custom types

// ─── Individual CTA ───────────────────────────────────────────────────────────

export interface Cta {
  /**
   * Stable identifier: `<goal>-<index>` e.g. "booking-0".
   */
  id: string;

  /**
   * The CTA text — ready to use as a button label, lower-third overlay,
   * or end-card caption.  Always ≤ 60 characters.
   */
  text: string;

  goal: CtaGoal;

  /**
   * Character count.  CTAs should stay ≤ 60 characters for legibility
   * at small sizes.
   */
  charCount: number;

  /**
   * The rhetorical strategy behind this CTA.
   * Shown in UI tooltips and consumed by the edit plan generator.
   */
  rationale: string;

  /**
   * Hint for placement / presentation.
   * e.g. "end-card overlay", "lower-third at 80% playtime"
   */
  editHint: string;

  /**
   * The qualifier applied (reflects preset DNA):
   * Pixel Premium → "complimentary" / "exclusive"
   * Pixel Performance → "free" / "instant"
   * Pixel Social → "quick" / "no-strings"
   * none → empty string
   */
  qualifierUsed: string;
}

// ─── Result ───────────────────────────────────────────────────────────────────

export interface CtaGenerationMetadata {
  generatedAt: string;      // ISO 8601
  schemaVersion: "1.0";
  goal: CtaGoal;
  businessType: BusinessType | null;
  preset: PresetName | null;
  tone: TranscriptTone | null;
  count: number;            // 2 or 3
  /** Signals extracted and used during generation. */
  signals: CtaSignals;
}

export interface CtaResult {
  /** 2 or 3 CTAs, ordered from most recommended to least. */
  ctas: Cta[];
  metadata: CtaGenerationMetadata;
}

export interface StoredCtaResult extends CtaResult {
  projectId: string;
}

// ─── Internal signals ─────────────────────────────────────────────────────────

/**
 * Distilled from the project context (transcript analysis, preset, etc.)
 * and used to fill template slots.
 */
export interface CtaSignals {
  /** Primary topic phrase (1–3 words). */
  topic: string;
  /** Top keyword. */
  keyword: string;
  /** Benefit/outcome phrase (short). */
  benefit: string;
  /**
   * Qualifier word: "complimentary" | "exclusive" | "free" | "instant" |
   * "quick" | "no-strings" | "" depending on preset.
   */
  qualifier: string;
  /**
   * Urgency suffix.  e.g. "today" | "this week" | "now" | ""
   * Populated for performance/social presets; empty for premium.
   */
  urgency: string;
  /**
   * The primary action verb cluster for this business type.
   * e.g. "Book" | "Start" | "Request" | "Download"
   */
  actionVerb: string;
}

// ─── Options ─────────────────────────────────────────────────────────────────

export interface GenerateCtaOptions {
  /**
   * Business category — shapes vocabulary.
   * Defaults to a generic "brand" style when omitted.
   */
  businessType?: BusinessType;

  /**
   * Brand preset — controls tone register and qualifier language.
   */
  preset?: PresetName;

  /**
   * Project tone — secondary vocabulary modifier.
   */
  tone?: TranscriptTone;

  /**
   * Primary topic override.  If omitted, extracted from transcript analysis
   * keywords (when analysis is passed).
   */
  topic?: string;

  /**
   * Top benefit override.  If omitted, derived from analysis.
   */
  benefit?: string;

  /**
   * Number of CTA options to return.  2 or 3.  Defaults to 3.
   */
  count?: 2 | 3;

  /**
   * Max characters per CTA.  Defaults to 60.
   */
  maxChars?: number;
}
