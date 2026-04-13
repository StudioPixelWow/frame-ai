/**
 * FrameAI — Variation strategy configurations.
 *
 * Each StrategyConfig drives one complete variation:
 *   - Which trim plan to use (by target duration)
 *   - Hook style priority order (first match from generated hooks wins)
 *   - CTA goal priority order
 *   - Pacing / transition / B-roll / music parameters
 *   - Per-role segment hints (overlay on top of trimmer base hints)
 *   - Phase-ordered edit directives
 *   - Edit brief template (filled at generation time)
 *
 * All values are deterministic — no runtime randomness.
 */

import type { HookStyle }          from "@/lib/hooks/types";
import type { CtaGoal }            from "@/lib/cta/types";
import type { SegmentRole }        from "@/lib/trimmer/types";
import type {
  VariationStrategy,
  PacingStyle,
  TransitionStyle,
  BrollDensity,
  MusicTone,
  VariationDirective,
} from "./types";

// ─── Strategy config shape ────────────────────────────────────────────────────

export interface StrategyConfig {
  id:                VariationStrategy;
  label:             string;
  description:       string;

  /** Which TrimPlan to pull from TrimResult.plans (matched by durationSec). */
  targetDurationSec: 15 | 30 | 45;

  pacing:            PacingStyle;
  transitionStyle:   TransitionStyle;
  brollDensity:      BrollDensity;
  musicTone:         MusicTone;

  /**
   * Preferred hook styles in priority order.
   * The first generated hook whose style matches is selected.
   * If no match is found, falls back to hooks[0].
   */
  hookStylePriority: HookStyle[];

  /**
   * Preferred CTA goals in priority order.
   * For "fast" pacing: the shortest matching CTA is chosen within the goal.
   * Otherwise: the first match in goal order.
   */
  ctaGoalPriority: CtaGoal[];

  /**
   * Variation-specific edit hint per segment role.
   * Replaces (or supplements) the trimmer's role-based hint in the variation output.
   */
  segmentHintByRole: Record<SegmentRole, string>;

  /** Phase-ordered directives for the editor. */
  directives: VariationDirective[];

  /**
   * Edit brief template.
   * Tokens: {{count}}, {{actual}}, {{plural}}
   */
  editBriefTemplate: string;
}

// ─── Canonical strategy configurations ───────────────────────────────────────

export const STRATEGY_CONFIGS: Record<VariationStrategy, StrategyConfig> = {

  // ── Standard ─────────────────────────────────────────────────────────────────

  standard: {
    id:          "standard",
    label:       "Standard Edit",
    description: "A balanced 30-second cut for broad platform distribution — professional, clear, and brand-safe.",
    targetDurationSec: 30,
    pacing:          "standard",
    transitionStyle: "clean-cut",
    brollDensity:    "moderate",
    musicTone:       "neutral",

    hookStylePriority: ["benefit-driven", "question", "bold-statement", "curiosity"],
    ctaGoalPriority:   ["lead-generation", "inquiry", "booking", "contact", "awareness"],

    segmentHintByRole: {
      "hook":        "deliver at natural pace — hold 0.5 s after last word before first cut",
      "key-claim":   "consider title-card overlay for core claim; let line land fully before cutting",
      "proof-point": "hold 0.5 s after delivery, then cut to supporting B-roll or on-screen stat",
      "cta":         "add lower-third CTA text overlay; allow 1 s silence before fade out",
      "bridge":      "standard clean cut — maintain conversational pacing between sentences",
      "filler":      "cut candidate — remove if a re-edit is needed",
    },

    directives: [
      {
        order: 1, phase: "assembly",
        instruction: "Open with the selected hook as a text overlay in the first 3 seconds of the cut.",
        rationale:   "Establishes the core value proposition before the viewer has time to scroll.",
      },
      {
        order: 2, phase: "assembly",
        instruction: "Layer B-roll at approximately 40 % of the total cut duration, prioritising proof-point segments.",
        rationale:   "Maintains visual engagement without overwhelming the spoken content.",
      },
      {
        order: 3, phase: "assembly",
        instruction: "Apply clean cuts between all segments — no dissolves or wipes.",
        rationale:   "Keeps pacing professional and editorial; avoids stylistic distraction.",
      },
      {
        order: 4, phase: "assembly",
        instruction: "Place the selected CTA as a lower-third overlay in the final 8 seconds.",
        rationale:   "Gives the viewer time to read and act before the cut ends.",
      },
      {
        order: 5, phase: "colour",
        instruction: "Apply the project's primary colour grade throughout without variation.",
        rationale:   "Consistent grade maintains brand identity across all distribution channels.",
      },
      {
        order: 6, phase: "audio",
        instruction: "Set music to −18 dB under dialogue; fade music out over the final 5 seconds.",
        rationale:   "Music should support rather than compete with the spoken message.",
      },
      {
        order: 7, phase: "review",
        instruction: "Verify hook text and CTA overlay are legible on a 375 px mobile viewport.",
        rationale:   "Primary consumption is mobile-first; text must be readable at thumbnail size.",
      },
    ],

    editBriefTemplate: "A balanced {{actual}}s cut comprising {{count}} segment{{plural}}. Opens with a benefit-driven hook, carries the central argument through supporting evidence, and closes on a direct CTA. Clean cuts, moderate B-roll (≈ 40 %), and neutral music keep the pacing professional and the message platform-agnostic.",
  },

  // ── Shorter / Punchier ────────────────────────────────────────────────────────

  "shorter-punchier": {
    id:          "shorter-punchier",
    label:       "Shorter / Punchier",
    description: "A high-impact 15-second cut built for social feeds — thumb-stopping, energetic, and immediate.",
    targetDurationSec: 15,
    pacing:          "fast",
    transitionStyle: "jump-cut",
    brollDensity:    "minimal",
    musicTone:       "energetic",

    hookStylePriority: ["bold-statement", "question", "curiosity", "benefit-driven"],
    ctaGoalPriority:   ["lead-generation", "booking", "contact", "inquiry", "awareness"],

    segmentHintByRole: {
      "hook":        "open mid-sentence or on the impact word — strip any lead-in silence",
      "key-claim":   "smash cut immediately after final word — no trailing breath",
      "proof-point": "consider 1.05× speed on delivery; cut before trailing breath",
      "cta":         "tight cut immediately after final word — overlay CTA text within the segment itself",
      "bridge":      "trim any pause > 0.5 s; consider cutting entirely if budget is tight",
      "filler":      "cut candidate — do not include under any circumstance",
    },

    directives: [
      {
        order: 1, phase: "assembly",
        instruction: "Open mid-sentence or on the impact word — strip any lead-in silence or establishing beat.",
        rationale:   "Social feeds reward immediate pattern interruption; viewers decide in < 1 s.",
      },
      {
        order: 2, phase: "assembly",
        instruction: "Apply jump cuts between all segments — trim any silence or pause longer than 0.5 s.",
        rationale:   "Rapid pacing signals confidence and energy; dead air is the enemy of retention.",
      },
      {
        order: 3, phase: "assembly",
        instruction: "Limit B-roll to 15–20 % of cut duration and use only on the single strongest proof-point moment.",
        rationale:   "With only 15 s of runtime, every frame of B-roll must justify its presence.",
      },
      {
        order: 4, phase: "assembly",
        instruction: "Consider applying 1.05× playback speed to bridge segments to recover 0.3–0.5 s of budget.",
        rationale:   "A 5 % speed-up is imperceptible to most viewers but can reclaim meaningful runtime.",
      },
      {
        order: 5, phase: "assembly",
        instruction: "Burn the CTA text directly into the final segment rather than as a separate end card.",
        rationale:   "There is no runtime for a dedicated end card; the CTA must live inside the content.",
      },
      {
        order: 6, phase: "colour",
        instruction: "Push contrast (+10–15) and saturation (+8–12) beyond the standard grade.",
        rationale:   "High-contrast frames perform measurably better in compressed social video streams.",
      },
      {
        order: 7, phase: "audio",
        instruction: "Set music to −12 dB under dialogue; use an energetic, driving track with a strong intro.",
        rationale:   "Music energy should mirror and amplify the cut's urgency from the first frame.",
      },
      {
        order: 8, phase: "review",
        instruction: "Play back the cut without sound — verify the core message is retained through captions alone.",
        rationale:   "≥ 85 % of social video is watched on mute; the cut must work silently.",
      },
    ],

    editBriefTemplate: "A punchy {{actual}}s cut optimised for social feeds. Opens hard on a bold statement, stacks the highest-impact moments with jump cuts, and drives immediate action. Minimal B-roll (≈ 15–20 %), energetic music, and relentless pacing make every second count.",
  },

  // ── Premium / Slower / Cleaner ────────────────────────────────────────────────

  "premium-slower": {
    id:          "premium-slower",
    label:       "Premium Cut",
    description: "A considered 45-second edit with deliberate pacing and breathing room — premium placements, long-form awareness.",
    targetDurationSec: 45,
    pacing:          "slow",
    transitionStyle: "dissolve",
    brollDensity:    "generous",
    musicTone:       "cinematic",

    hookStylePriority: ["curiosity", "benefit-driven", "question", "bold-statement"],
    ctaGoalPriority:   ["awareness", "inquiry", "booking", "lead-generation", "contact"],

    segmentHintByRole: {
      "hook":        "full natural delivery with a deliberate 1 s pause after — let it breathe before the first dissolve",
      "key-claim":   "hold 1 s after final word; dissolve to supporting B-roll to let the claim land visually",
      "proof-point": "hold 1–2 s after delivery; cut to on-screen stat graphic or high-quality supporting visual",
      "cta":         "dissolve to premium end card with B-roll behind CTA text; hold end card for ≥ 3 s",
      "bridge":      "warm cross-dissolve (12–18 frames) from the previous segment — preserve natural pauses",
      "filler":      "cut candidate — do not include",
    },

    directives: [
      {
        order: 1, phase: "assembly",
        instruction: "Open on the hook with full, unhurried delivery — allow a 1 s beat of silence after the final word.",
        rationale:   "Premium content commands attention; it does not need to chase it.",
      },
      {
        order: 2, phase: "assembly",
        instruction: "Layer generous B-roll (50–60 % of cut) to give each claim time to breathe and land visually.",
        rationale:   "Visuals reinforce the spoken word and signal editorial investment.",
      },
      {
        order: 3, phase: "assembly",
        instruction: "Use cross-dissolves of 12–18 frames between all main segments.",
        rationale:   "Dissolves signal a thoughtful, considered editorial register appropriate for premium placements.",
      },
      {
        order: 4, phase: "assembly",
        instruction: "Preserve natural pauses within and between segments — do not trim silence shorter than 0.8 s.",
        rationale:   "White space in pacing communicates confidence and authority.",
      },
      {
        order: 5, phase: "assembly",
        instruction: "Close on a dedicated premium end card: the selected CTA text over high-quality B-roll for ≥ 3 s.",
        rationale:   "The extended end card signals brand investment and gives the viewer time to act.",
      },
      {
        order: 6, phase: "colour",
        instruction: "Apply a warm, slightly desaturated grade with lifted shadows (raise blacks by +5–8 IRE).",
        rationale:   "A premium look reads aspirational rather than hyperactive; lifted shadows signal quality.",
      },
      {
        order: 7, phase: "audio",
        instruction: "Set music to −22 dB under dialogue; fade in over 3 s at open, fade out over 5 s at close.",
        rationale:   "Music should feel ambient and atmospheric, underscoring mood without directing pace.",
      },
      {
        order: 8, phase: "review",
        instruction: "Review at full volume on reference monitors or quality headphones — check for room-tone consistency between segments.",
        rationale:   "For premium placements, audio quality is as important as visual quality.",
      },
    ],

    editBriefTemplate: "A considered {{actual}}s premium edit comprising {{count}} segment{{plural}}. Opens with a curiosity-driven hook, builds credibility through evidence and key claims with breathing room between each, and closes on a premium CTA end card. Generous B-roll (≈ 50–60 %), cinematic music, and deliberate pacing position the content for premium digital placements.",
  },
};

// ─── Ordered strategy list ────────────────────────────────────────────────────

/** Canonical generation order: standard → punchier → premium. */
export const ALL_STRATEGIES: VariationStrategy[] = [
  "standard",
  "shorter-punchier",
  "premium-slower",
];
