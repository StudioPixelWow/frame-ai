/**
 * FrameAI — Variation generation logic.
 *
 * Orchestrates the transcript intelligence stack into three distinct edit
 * strategies.  All selection logic is deterministic (no Math.random()).
 *
 * Inputs (all optional — module degrades gracefully when absent):
 *   segments   → source of truth for duration and segment identities
 *   highlights → enriches context; not directly consumed but signals data provenance
 *   hookResult → provides the hook pool to select from per strategy
 *   ctaResult  → provides the CTA pool to select from per strategy
 *   trimResult → provides one TrimPlan per target duration
 *
 * Output:
 *   VariationResult — three variations with segments, directives, hook, CTA, brief
 */

import type { TranscriptSegment }   from "@/lib/transcript/types";
import type { HighlightResult }     from "@/lib/transcript/highlights/types";
import type { HookResult, Hook, HookStyle } from "@/lib/hooks/types";
import type { CtaResult, Cta, CtaGoal }     from "@/lib/cta/types";
import type { TrimResult, TrimPlan }        from "@/lib/trimmer/types";

import type {
  Variation,
  VariationResult,
  VariationSegment,
  VariationMetadata,
  VariationStrategy,
  GenerateVariationOptions,
} from "./types";

import { STRATEGY_CONFIGS, ALL_STRATEGIES, type StrategyConfig } from "./strategies";

// ─── Hook selection ───────────────────────────────────────────────────────────

/**
 * Select the best hook from the generated pool for a given strategy.
 *
 * Algorithm:
 *   1. Iterate hookStylePriority — return the first hook whose style matches.
 *   2. If no style matches (shouldn't happen with 4 styles × 3 hooks), return hooks[0].
 *   3. Return null if the pool is empty.
 */
function selectHook(
  hooks: Hook[],
  hookStylePriority: HookStyle[]
): Hook | null {
  if (!hooks.length) return null;

  for (const style of hookStylePriority) {
    const match = hooks.find(h => h.style === style);
    if (match) return match;
  }

  return hooks[0]; // deterministic fallback
}

// ─── CTA selection ────────────────────────────────────────────────────────────

/**
 * Select the best CTA from the generated pool for a given strategy.
 *
 * Algorithm:
 *   fast pacing ("shorter-punchier"):
 *     — Among CTAs whose goal matches the top priority, pick the shortest one.
 *     — If no goal match, pick the globally shortest CTA (fewest chars wins).
 *   standard / slow pacing:
 *     — Iterate ctaGoalPriority — return the first CTA whose goal matches.
 *     — Fallback to ctas[0] if no goal matches.
 */
function selectCta(
  ctas: Cta[],
  ctaGoalPriority: CtaGoal[],
  isPunchier: boolean
): Cta | null {
  if (!ctas.length) return null;

  if (isPunchier) {
    // Prefer shortest CTA within the highest-priority matching goal
    for (const goal of ctaGoalPriority) {
      const candidates = ctas.filter(c => c.goal === goal);
      if (candidates.length) {
        return candidates.reduce((a, b) => a.charCount <= b.charCount ? a : b);
      }
    }
    // No goal match — return globally shortest
    return ctas.reduce((a, b) => a.charCount <= b.charCount ? a : b);
  }

  // Standard / slow: first goal match in priority order
  for (const goal of ctaGoalPriority) {
    const match = ctas.find(c => c.goal === goal);
    if (match) return match;
  }

  return ctas[0]; // deterministic fallback
}

// ─── Segment building ─────────────────────────────────────────────────────────

/**
 * Convert a TrimPlan's selectedSegments into VariationSegments.
 * Overlays the strategy-specific variation hint on top of the trimmer base hint.
 */
function buildVariationSegments(
  plan: TrimPlan,
  segmentHintByRole: Record<string, string>
): VariationSegment[] {
  return plan.selectedSegments.map(seg => ({
    segmentId:     seg.segmentId,
    startMs:       seg.startMs,
    endMs:         seg.endMs,
    durationMs:    seg.durationMs,
    text:          seg.text,
    speaker:       seg.speaker,
    role:          seg.role,
    score:         seg.score,
    baseEditHint:  seg.editHint,
    variationHint: segmentHintByRole[seg.role] ?? seg.editHint,
  }));
}

// ─── Edit brief ───────────────────────────────────────────────────────────────

/**
 * Fill the strategy's edit brief template.
 * Tokens: {{count}}, {{actual}}, {{plural}}
 */
function fillBrief(
  template: string,
  segmentCount: number,
  actualDurationSec: number
): string {
  return template
    .replace(/\{\{count\}\}/g,  String(segmentCount))
    .replace(/\{\{actual\}\}/g, String(actualDurationSec))
    .replace(/\{\{plural\}\}/g, segmentCount !== 1 ? "s" : "");
}

// ─── Single variation ─────────────────────────────────────────────────────────

function buildVariation(
  config:     StrategyConfig,
  hooks:      Hook[],
  ctas:       Cta[],
  trimResult: TrimResult | undefined
): Variation {
  // 1. Find matching TrimPlan
  const plan = trimResult?.plans.find(
    p => p.targetDurationSec === config.targetDurationSec
  ) ?? null;

  // 2. Select hook and CTA
  const selectedHook = selectHook(hooks, config.hookStylePriority);
  const selectedCta  = selectCta(ctas, config.ctaGoalPriority, config.pacing === "fast");

  // 3. Build segments from plan
  const segments: VariationSegment[] = plan
    ? buildVariationSegments(plan, config.segmentHintByRole)
    : [];

  const actualDurationSec = plan?.actualDurationSec ?? 0;
  const fillRatio         = plan?.fillRatio         ?? 0;

  // 4. Edit brief
  const editBrief = fillBrief(config.editBriefTemplate, segments.length, actualDurationSec);

  return {
    id:                config.id,
    strategy:          config.id,
    label:             config.label,
    description:       config.description,
    targetDurationSec: config.targetDurationSec,
    actualDurationSec,
    fillRatio,
    pacing:            config.pacing,
    transitionStyle:   config.transitionStyle,
    brollDensity:      config.brollDensity,
    musicTone:         config.musicTone,
    selectedHook,
    selectedCta,
    segments,
    directives:        config.directives,
    editBrief,
  };
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Generate all requested variation strategies.
 *
 * @param segments    Full transcript segment list (used for duration metadata).
 * @param highlights  Highlight detection result (signals data provenance in metadata).
 * @param hookResult  Generated hook options — pool is selected from per strategy.
 * @param ctaResult   Generated CTA options — pool is selected from per strategy.
 * @param trimResult  Smart trim result — one TrimPlan per target duration is used.
 * @param options     Optional overrides.
 */
export function generateVariations(
  segments:    TranscriptSegment[],
  highlights?: HighlightResult,
  hookResult?: HookResult,
  ctaResult?:  CtaResult,
  trimResult?: TrimResult,
  options:     GenerateVariationOptions = {}
): VariationResult {
  const strategies: VariationStrategy[] = options.strategies ?? [...ALL_STRATEGIES];

  const hooks: Hook[] = hookResult ? [...hookResult.hooks] : [];
  const ctas:  Cta[]  = ctaResult  ? [...ctaResult.ctas]  : [];

  const variations: Variation[] = strategies.map(strategyId => {
    const config = STRATEGY_CONFIGS[strategyId];
    return buildVariation(config, hooks, ctas, trimResult);
  });

  // ── Metadata ────────────────────────────────────────────────────────────────
  const sourceDurationSec = segments.length
    ? Math.round((segments[segments.length - 1].endMs - segments[0].startMs) / 1000)
    : 0;

  const metadata: VariationMetadata = {
    generatedAt:         new Date().toISOString(),
    schemaVersion:       "1.0",
    totalVariations:     variations.length,
    sourceDurationSec,
    strategiesGenerated: strategies,
    highlightsUsed:      !!highlights,
    hooksUsed:           !!hookResult,
    ctasUsed:            !!ctaResult,
    trimmingUsed:        !!trimResult,
  };

  return { variations, metadata };
}
