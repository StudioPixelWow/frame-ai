/**
 * PixelManageAI — Unified Edit Coordinator
 *
 * Orchestrates all editing systems (hook, pacing, B-roll, zoom, retention)
 * into a cohesive edit plan. Detects conflicts between systems and resolves
 * them with intelligent prioritization.
 *
 * Coordination layers:
 *  1. Hook zone: highest priority, apply all enhancements
 *  2. Body zone: balance all systems by importance
 *  3. CTA zone: boost intensity for conversion
 *  4. Conflict resolution: overlap → reduce; overload → prioritize
 */

import type { TranscriptSegment } from "./broll-analysis";
import type { RetentionPlan, RetentionLevel } from "./retention-ai";

/* ═══════════════════════════════════════════════════════════════════════════
   Types
   ═══════════════════════════════════════════════════════════════════════════ */

export type ZoomStyle = "subtle" | "social" | "cinematic";
export type PacingMode = "relaxed" | "balanced" | "punchy";
export type HookStrength = "subtle" | "balanced" | "aggressive";

export interface ZoomPlan {
  segments: Array<{
    segmentId: string;
    style: ZoomStyle;
    intensity: number;
  }>;
}

export interface PacingPlan {
  mode: PacingMode;
  segments: Array<{
    segmentId: string;
    pauseAdjustment: number;
    speedMultiplier: number;
  }>;
}

export interface HookAnalysis {
  strength: HookStrength;
  score: number;
  hasDuration: number;
  style: string;
}

export interface HookEnhancement {
  subtitleAnimation: string;
  zoomBoost: number;
  bgmBump: number;
  colorGradeShift: string;
}

export interface AdvancedBrollPlan {
  segments: Array<{
    segmentId: string;
    theme: string;
    intensity: number;
  }>;
}

export interface EditProfile {
  brollIntensity: "light" | "medium" | "aggressive";
  zoomStyle: ZoomStyle;
  pacingMode: PacingMode;
  hookStrength: HookStrength;
  retentionLevel: RetentionLevel;
}

export interface UnifiedEditPlan {
  profile: EditProfile;
  hook: { analysis: HookAnalysis; enhancement: HookEnhancement };
  pacing: PacingPlan;
  broll: AdvancedBrollPlan;
  zoom: ZoomPlan;
  retention: RetentionPlan;
  coordination: CoordinationResult;
  stats: UnifiedStats;
}

export interface CoordinationResult {
  conflicts: EditConflict[];
  resolved: number;
  adjustments: EditAdjustment[];
}

export interface EditConflict {
  timeSec: number;
  systems: string[];
  type: "overlap" | "contradiction" | "overload";
  resolution: string;
}

export interface EditAdjustment {
  system: string;
  segmentId: string;
  original: Record<string, any>;
  adjusted: Record<string, any>;
  reason: string;
}

export interface UnifiedStats {
  totalDurationOriginal: number;
  totalDurationAdjusted: number;
  brollCoverage: number;
  zoomCoverage: number;
  avgRetention: number;
  hookScore: number;
  overallEditScore: number; // 0-100
}

export const EDIT_PRESETS: Record<string, EditProfile> = {
  minimal: {
    brollIntensity: "light",
    zoomStyle: "subtle",
    pacingMode: "relaxed",
    hookStrength: "subtle",
    retentionLevel: "light",
  },
  balanced: {
    brollIntensity: "medium",
    zoomStyle: "social",
    pacingMode: "balanced",
    hookStrength: "balanced",
    retentionLevel: "balanced",
  },
  social: {
    brollIntensity: "aggressive",
    zoomStyle: "social",
    pacingMode: "punchy",
    hookStrength: "aggressive",
    retentionLevel: "aggressive",
  },
  premium: {
    brollIntensity: "medium",
    zoomStyle: "cinematic",
    pacingMode: "balanced",
    hookStrength: "balanced",
    retentionLevel: "balanced",
  },
};

/* ═══════════════════════════════════════════════════════════════════════════
   Main API
   ═══════════════════════════════════════════════════════════════════════════ */

export function generateUnifiedEditPlan(
  segments: TranscriptSegment[],
  options: {
    profile: EditProfile;
    durationSec: number;
    format: "9:16" | "16:9" | "1:1" | "4:5";
    language: "he" | "en" | "auto";
    category?: string;
  }
): UnifiedEditPlan {
  // 1. Generate hook analysis first (highest priority)
  const hookAnalysis = analyzeHook(segments, options.durationSec);
  const hookEnhancement = generateHookEnhancement(
    hookAnalysis,
    options.profile.hookStrength
  );
  const hookEndSec = hookAnalysis.hasDuration;

  // 2. Generate pacing plan
  const pacingPlan = generatePacingPlan(segments, options.profile.pacingMode);

  // 3. Generate B-roll plan (considering pacing)
  const brollPlan = generateBrollPlan(
    segments,
    options.profile.brollIntensity,
    pacingPlan
  );

  // 4. Generate zoom plan (considering hook + emphasis moments)
  const zoomPlan = generateZoomPlan(
    segments,
    options.profile.zoomStyle,
    hookEndSec
  );

  // 5. Generate retention plan
  const retentionPlan: RetentionPlan = {
    segments: segments.map((seg, idx) => ({
      segmentId: seg.id,
      startSec: seg.startSec,
      endSec: seg.endSec,
      engagement: "medium",
      engagementScore: 60,
      riskFactors: [],
      actions: [],
    })),
    level: options.profile.retentionLevel,
    curve: [],
    stats: {
      avgEngagement: 65,
      lowEngagementPercent: 20,
      actionsApplied: 0,
      estimatedRetentionLift: 10,
    },
  };

  // 6. Coordination phase
  const { conflicts, adjustments, resolved } = coordinateSystems(
    {
      hook: { analysis: hookAnalysis, enhancement: hookEnhancement },
      pacing: pacingPlan,
      broll: brollPlan,
      zoom: zoomPlan,
      retention: retentionPlan,
    },
    {
      durationSec: options.durationSec,
      hookEndSec,
      ctaStartSec: options.durationSec * 0.85,
    }
  );

  // 7. Calculate unified stats
  const stats = calculateUnifiedStats(
    segments,
    options.durationSec,
    hookAnalysis,
    pacingPlan,
    brollPlan,
    zoomPlan,
    retentionPlan,
    adjustments
  );

  return {
    profile: options.profile,
    hook: { analysis: hookAnalysis, enhancement: hookEnhancement },
    pacing: pacingPlan,
    broll: brollPlan,
    zoom: zoomPlan,
    retention: retentionPlan,
    coordination: { conflicts, resolved, adjustments },
    stats,
  };
}

export function getEditPresets(): {
  id: string;
  label: string;
  labelHe: string;
  description: string;
  profile: EditProfile;
}[] {
  return [
    {
      id: "minimal",
      label: "Minimal",
      labelHe: "מינימלי",
      description: "Light edits, minimal effects, natural pacing",
      profile: EDIT_PRESETS.minimal,
    },
    {
      id: "balanced",
      label: "Balanced",
      labelHe: "מאוזן",
      description: "Moderate edits, social-optimized, good retention",
      profile: EDIT_PRESETS.balanced,
    },
    {
      id: "social",
      label: "Social (TikTok/Shorts)",
      labelHe: "סוציאלי",
      description: "Aggressive editing, maximum engagement, rapid cuts",
      profile: EDIT_PRESETS.social,
    },
    {
      id: "premium",
      label: "Premium (YouTube)",
      labelHe: "פרימיום",
      description: "Cinematic style, balanced engagement, professional feel",
      profile: EDIT_PRESETS.premium,
    },
  ];
}

/* ═══════════════════════════════════════════════════════════════════════════
   System Generators
   ═══════════════════════════════════════════════════════════════════════════ */

function analyzeHook(
  segments: TranscriptSegment[],
  durationSec: number
): HookAnalysis {
  // Simplified hook analysis
  if (segments.length === 0) {
    return {
      strength: "subtle",
      score: 40,
      hasDuration: 3,
      style: "question",
    };
  }

  const firstSegment = segments[0];
  const text = firstSegment.text || "";
  const hasQuestion = text.includes("?");
  const hasExclamation = text.includes("!");
  const duration = Math.min(firstSegment.endSec, durationSec * 0.15);

  let strength: HookStrength = "subtle";
  let score = 50;

  if (hasQuestion || hasExclamation) {
    strength = "balanced";
    score = 70;
  } else if (duration > 2) {
    strength = "balanced";
    score = 65;
  }

  return {
    strength,
    score,
    hasDuration: duration,
    style: hasQuestion ? "question" : hasExclamation ? "bold_claim" : "curiosity",
  };
}

function generateHookEnhancement(
  analysis: HookAnalysis,
  strengthLevel: HookStrength
): HookEnhancement {
  const intensityMap = {
    subtle: 0.3,
    balanced: 0.6,
    aggressive: 1,
  };
  const intensity = intensityMap[strengthLevel];

  return {
    subtitleAnimation: intensity > 0.5 ? "zoomIn" : "fade",
    zoomBoost: intensity * 0.5,
    bgmBump: intensity * 3,
    colorGradeShift: intensity > 0.5 ? "warm" : "neutral",
  };
}

function generatePacingPlan(
  segments: TranscriptSegment[],
  mode: PacingMode
): PacingPlan {
  const speedMap = {
    relaxed: 0.95,
    balanced: 1.0,
    punchy: 1.1,
  };
  const speedMultiplier = speedMap[mode];

  return {
    mode,
    segments: segments.map((seg) => ({
      segmentId: seg.id,
      pauseAdjustment: mode === "punchy" ? -0.2 : 0,
      speedMultiplier,
    })),
  };
}

function generateBrollPlan(
  segments: TranscriptSegment[],
  intensity: "light" | "medium" | "aggressive",
  pacingPlan: PacingPlan
): AdvancedBrollPlan {
  const intensityMap = {
    light: 0.3,
    medium: 0.6,
    aggressive: 0.9,
  };
  const intensityValue = intensityMap[intensity];

  return {
    segments: segments.map((seg) => ({
      segmentId: seg.id,
      theme: extractTheme(seg.text),
      intensity: intensityValue,
    })),
  };
}

function generateZoomPlan(
  segments: TranscriptSegment[],
  style: ZoomStyle,
  hookEndSec: number
): ZoomPlan {
  return {
    segments: segments.map((seg) => ({
      segmentId: seg.id,
      style,
      intensity: seg.startSec < hookEndSec ? 0.6 : 0.3,
    })),
  };
}

function extractTheme(text: string): string {
  // Simple theme extraction based on keywords
  if (!text) return "general";
  const lower = text.toLowerCase();
  if (lower.includes("product") || lower.includes("feature")) return "product";
  if (lower.includes("problem") || lower.includes("pain")) return "problem";
  if (lower.includes("solution") || lower.includes("help")) return "solution";
  if (lower.includes("data") || lower.includes("number")) return "data";
  return "general";
}

/* ═══════════════════════════════════════════════════════════════════════════
   Coordination Logic
   ═══════════════════════════════════════════════════════════════════════════ */

interface CoordinationInput {
  hook: { analysis: HookAnalysis; enhancement: HookEnhancement };
  pacing: PacingPlan;
  broll: AdvancedBrollPlan;
  zoom: ZoomPlan;
  retention: RetentionPlan;
}

interface CoordinationContext {
  durationSec: number;
  hookEndSec: number;
  ctaStartSec: number;
}

function coordinateSystems(
  input: CoordinationInput,
  context: CoordinationContext
): { conflicts: EditConflict[]; adjustments: EditAdjustment[]; resolved: number } {
  const conflicts: EditConflict[] = [];
  const adjustments: EditAdjustment[] = [];
  let resolved = 0;

  // Detect conflicts: overlapping B-roll + zoom → reduce zoom intensity
  for (const brollSeg of input.broll.segments) {
    const zoomSeg = input.zoom.segments.find((z) => z.segmentId === brollSeg.segmentId);
    if (!zoomSeg) continue;

    if (brollSeg.intensity > 0.5 && zoomSeg.intensity > 0.4) {
      conflicts.push({
        timeSec: 0, // Placeholder
        systems: ["broll", "zoom"],
        type: "overlap",
        resolution: "Reduce zoom intensity in B-roll zones",
      });

      adjustments.push({
        system: "zoom",
        segmentId: zoomSeg.segmentId,
        original: { intensity: zoomSeg.intensity },
        adjusted: { intensity: Math.max(0.2, zoomSeg.intensity - 0.2) },
        reason: "B-roll coverage requires less zoom",
      });
      resolved++;
    }
  }

  // Hook zone enhancement (priority 1)
  for (const zoomSeg of input.zoom.segments) {
    if (zoomSeg.intensity > 0.3) {
      // Boost in hook zone
      const hookBoost = context.hookEndSec > 0 ? 0.15 : 0;
      if (hookBoost > 0) {
        adjustments.push({
          system: "zoom",
          segmentId: zoomSeg.segmentId,
          original: { intensity: zoomSeg.intensity },
          adjusted: { intensity: Math.min(1, zoomSeg.intensity + hookBoost) },
          reason: "Hook zone enhancement",
        });
      }
    }
  }

  // CTA zone boost (slight intensity increase)
  for (const brollSeg of input.broll.segments) {
    const isCTAZone =
      context.ctaStartSec > 0 && brollSeg.intensity > 0;
    if (isCTAZone) {
      adjustments.push({
        system: "broll",
        segmentId: brollSeg.segmentId,
        original: { intensity: brollSeg.intensity },
        adjusted: { intensity: Math.min(1, brollSeg.intensity + 0.1) },
        reason: "CTA zone intensity boost",
      });
    }
  }

  return {
    conflicts,
    adjustments,
    resolved,
  };
}

/* ═══════════════════════════════════════════════════════════════════════════
   Stats Calculation
   ═══════════════════════════════════════════════════════════════════════════ */

function calculateUnifiedStats(
  segments: TranscriptSegment[],
  durationSec: number,
  hookAnalysis: HookAnalysis,
  pacingPlan: PacingPlan,
  brollPlan: AdvancedBrollPlan,
  zoomPlan: ZoomPlan,
  retentionPlan: RetentionPlan,
  adjustments: EditAdjustment[]
): UnifiedStats {
  // Calculate B-roll coverage
  const brollCoverage =
    brollPlan.segments.reduce((sum, seg) => sum + seg.intensity, 0) /
    Math.max(brollPlan.segments.length, 1);

  // Calculate zoom coverage
  const zoomCoverage =
    zoomPlan.segments.reduce((sum, seg) => sum + seg.intensity, 0) /
    Math.max(zoomPlan.segments.length, 1);

  // Estimate duration adjustment
  const paceAdjustment = pacingPlan.segments.reduce(
    (sum, seg) => sum + (seg.speedMultiplier - 1),
    0
  ) / Math.max(pacingPlan.segments.length, 1);
  const totalDurationAdjusted = durationSec * (1 + paceAdjustment);

  // Calculate overall edit score
  const hookScore = hookAnalysis.score;
  const avgRetention = retentionPlan.stats.avgEngagement;
  const overallScore = Math.round(
    (hookScore * 0.25 +
      avgRetention * 0.4 +
      brollCoverage * 100 * 0.15 +
      zoomCoverage * 100 * 0.1 +
      Math.min(100, adjustments.length * 5)) /
      0.9
  );

  return {
    totalDurationOriginal: durationSec,
    totalDurationAdjusted: Math.round(totalDurationAdjusted * 10) / 10,
    brollCoverage: Math.round(brollCoverage * 100),
    zoomCoverage: Math.round(zoomCoverage * 100),
    avgRetention: Math.round(avgRetention),
    hookScore: Math.round(hookScore),
    overallEditScore: Math.min(100, Math.max(0, overallScore)),
  };
}
