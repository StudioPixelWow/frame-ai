/**
 * FrameAI — Variation generation types.
 *
 * A "variation" is a complete, self-contained edit strategy derived from
 * the transcript intelligence stack (highlights + hooks + CTAs + trimming).
 * Three canonical variations are always produced:
 *
 *   standard         — 30s balanced cut for broad platform distribution
 *   shorter-punchier — 15s social-first cut for high-attention environments
 *   premium-slower   — 45s considered cut for premium digital placements
 *
 * Each variation bundles: a trim plan, selected hook, selected CTA, per-segment
 * edit hints, phase-ordered directives, and a human-readable edit brief.
 */

import type { SegmentRole } from "@/lib/trimmer/types";
import type { Hook }        from "@/lib/hooks/types";
import type { Cta }         from "@/lib/cta/types";

// ─── Variation strategy ───────────────────────────────────────────────────────

/**
 * The high-level edit strategy identifier.
 * Determines target duration, pacing, B-roll density, music tone, and
 * which hook / CTA styles are preferred.
 */
export type VariationStrategy =
  | "standard"
  | "shorter-punchier"
  | "premium-slower";

// ─── Edit parameters ──────────────────────────────────────────────────────────

/** How aggressively the edit is paced. */
export type PacingStyle = "fast" | "standard" | "slow";

/**
 * Dominant transition style for this variation.
 *
 * jump-cut   — Hard consecutive cuts with no handles
 * clean-cut  — Standard editorial cuts with minimal breathing room
 * dissolve   — Cross-dissolve (12–18 frames) between main segments
 */
export type TransitionStyle = "jump-cut" | "clean-cut" | "dissolve";

/**
 * How much B-roll coverage to target.
 *
 * minimal  — 15–20 % of cut duration
 * moderate — 35–45 % of cut duration
 * generous — 50–60 % of cut duration
 */
export type BrollDensity = "minimal" | "moderate" | "generous";

/**
 * Desired music mood — passed to the music selector in the edit plan.
 *
 * energetic  — Uptempo, driving energy
 * neutral    — Unobtrusive, professional underscore
 * ambient    — Atmospheric, spacious
 * cinematic  — Orchestral or textured, emotionally resonant
 */
export type MusicTone = "energetic" | "neutral" | "ambient" | "cinematic";

/**
 * The phase of the edit workflow this directive applies to.
 *
 * assembly — Timeline / rough-cut decisions
 * colour   — Grade / look decisions
 * audio    — Mix / music decisions
 * review   — QC / delivery checks
 */
export type EditPhase = "assembly" | "colour" | "audio" | "review";

// ─── Directive ────────────────────────────────────────────────────────────────

/**
 * A single actionable instruction for the editor, ordered by phase.
 * Consumed by the edit plan generator and surfaced in the Studio UI.
 */
export interface VariationDirective {
  /** Execution order within the variation (1-indexed). */
  order: number;
  /** Which stage of the edit workflow this belongs to. */
  phase: EditPhase;
  /**
   * The concrete instruction for the editor.
   * Written in imperative mood, specific enough to act on immediately.
   */
  instruction: string;
  /**
   * Why this instruction exists.
   * Helps editors understand intent when they deviate from the plan.
   */
  rationale: string;
}

// ─── Variation segment ────────────────────────────────────────────────────────

/**
 * A selected transcript segment enriched with variation-specific edit hints.
 * Segments are ordered by timeline position (startMs ascending).
 */
export interface VariationSegment {
  segmentId:   string;
  startMs:     number;
  endMs:       number;
  durationMs:  number;
  text:        string;
  speaker:     string | undefined;
  role:        SegmentRole;
  /** Trimmer aggregate score (0–1). */
  score:       number;
  /** Role-based hint from the trimmer (e.g. "close on this segment"). */
  baseEditHint: string;
  /**
   * Strategy-specific overlay hint.
   * Supplements baseEditHint with variation-aware guidance
   * (e.g. "smash cut immediately after delivery — no hold").
   */
  variationHint: string;
}

// ─── Variation ────────────────────────────────────────────────────────────────

/**
 * A complete, self-contained edit variation.
 * All fields needed to brief an editor or feed the edit plan generator are present.
 */
export interface Variation {
  /**
   * Stable identifier — same as `strategy`.
   * Kept as a separate field for downstream consumers that iterate over a list.
   */
  id: VariationStrategy;

  strategy: VariationStrategy;

  /** Human-readable variation name (e.g. "Shorter / Punchier"). */
  label: string;

  /**
   * One-sentence description of what this variation is designed for.
   * Shown in the Studio UI variation picker.
   */
  description: string;

  /** Requested cut duration in seconds. */
  targetDurationSec: number;

  /**
   * Actual duration of the selected segments in seconds.
   * May differ from target if the trimmer could not perfectly fill the budget.
   */
  actualDurationSec: number;

  /**
   * Fraction of target filled: actualDuration / targetDuration.
   * Capped at 1.0.  Typical range: 0.85–1.00.
   */
  fillRatio: number;

  pacing:          PacingStyle;
  transitionStyle: TransitionStyle;
  brollDensity:    BrollDensity;
  musicTone:       MusicTone;

  /**
   * The hook chosen for this variation.
   * Selected by matching the strategy's hookStylePriority against the
   * generated hook options.  Null if no hook result was provided.
   */
  selectedHook: Hook | null;

  /**
   * The CTA chosen for this variation.
   * Selected by matching the strategy's ctaGoalPriority.
   * For "shorter-punchier": the shortest matching CTA is preferred.
   * Null if no CTA result was provided.
   */
  selectedCta: Cta | null;

  /**
   * Transcript segments selected for this variation, in timeline order.
   * Derived from the matching TrimPlan, enriched with variationHint.
   */
  segments: VariationSegment[];

  /**
   * Phase-ordered edit directives.
   * Deterministic — same inputs always produce the same directive list.
   */
  directives: VariationDirective[];

  /**
   * One-paragraph human-readable edit brief.
   * Summarises what this variation contains and how it should be assembled.
   * Suitable for briefing an editor or embedding in an AI edit plan prompt.
   */
  editBrief: string;
}

// ─── Result ───────────────────────────────────────────────────────────────────

export interface VariationResult {
  /** Always 3 variations (one per strategy), ordered: standard → punchier → premium. */
  variations: Variation[];
  metadata:   VariationMetadata;
}

export interface VariationMetadata {
  /** ISO 8601 generation timestamp. */
  generatedAt:          string;
  schemaVersion:        "1.0";
  totalVariations:      number;
  /** Duration of the full source transcript in seconds. */
  sourceDurationSec:    number;
  /** Which strategies were generated (in order). */
  strategiesGenerated:  VariationStrategy[];
  /** Whether highlight detection data was used. */
  highlightsUsed:       boolean;
  /** Whether hook generation data was used. */
  hooksUsed:            boolean;
  /** Whether CTA generation data was used. */
  ctasUsed:             boolean;
  /** Whether smart trimming data was used. */
  trimmingUsed:         boolean;
}

export interface StoredVariationResult extends VariationResult {
  projectId: string;
}

// ─── Options ─────────────────────────────────────────────────────────────────

export interface GenerateVariationOptions {
  /**
   * Subset of strategies to generate.
   * Defaults to all three: ["standard", "shorter-punchier", "premium-slower"].
   */
  strategies?: VariationStrategy[];
}
