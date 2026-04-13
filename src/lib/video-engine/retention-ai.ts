/**
 * PixelFrameAI — Retention AI Engine
 *
 * Analyzes the entire video timeline for engagement optimization.
 * Identifies low-engagement zones and applies targeted interventions
 * (B-roll, zoom, pacing adjustments) to maintain viewer retention.
 *
 * Models retention curves across video zones:
 *  - Hook zone (0 to hookEndSec): expect high retention
 *  - Body zone: retention naturally decays
 *  - CTA zone (last 15%): recovery from anticipation
 */

import type { TranscriptSegment } from "./broll-analysis";

/* ═══════════════════════════════════════════════════════════════════════════
   Types
   ═══════════════════════════════════════════════════════════════════════════ */

export type RetentionLevel = "off" | "light" | "balanced" | "aggressive";

export interface RetentionSegment {
  segmentId: string;
  startSec: number;
  endSec: number;
  engagement: "high" | "medium" | "low";
  engagementScore: number; // 0-100
  riskFactors: string[]; // e.g. "long-pause", "filler-heavy", "repetitive"
  actions: RetentionAction[];
}

export interface RetentionAction {
  type: "shorten" | "add-broll" | "add-zoom" | "tighten-pace" | "cut" | "enhance-subtitle" | "keep";
  intensity: number; // 0-1
  description: string;
  descriptionHe: string;
}

export interface RetentionPlan {
  segments: RetentionSegment[];
  level: RetentionLevel;
  curve: RetentionCurvePoint[];
  stats: {
    avgEngagement: number;
    lowEngagementPercent: number;
    actionsApplied: number;
    estimatedRetentionLift: number;
  };
}

export interface RetentionCurvePoint {
  timeSec: number;
  retention: number; // 0-100 predicted retention
  zone: "hook" | "body" | "cta" | "ending";
}

/* ═══════════════════════════════════════════════════════════════════════════
   Hebrew Filler Words
   ═══════════════════════════════════════════════════════════════════════════ */

const HEBREW_FILLERS = [
  "אממ",
  "אהה",
  "כאילו",
  "נו",
  "טוב",
  "סוג של",
  "בעצם",
  "בדיוק",
  "כן בן",
];
const ENGLISH_FILLERS = [
  "um",
  "uh",
  "like",
  "you know",
  "so",
  "basically",
  "literally",
  "kind of",
  "sort of",
  "actually",
];

/* ═══════════════════════════════════════════════════════════════════════════
   Main API
   ═══════════════════════════════════════════════════════════════════════════ */

export function analyzeRetention(
  segments: TranscriptSegment[],
  options: {
    level: RetentionLevel;
    durationSec: number;
    hasHook: boolean;
    hookEndSec: number;
  }
): RetentionPlan {
  if (options.level === "off") {
    return {
      segments: [],
      level: "off",
      curve: [],
      stats: {
        avgEngagement: 100,
        lowEngagementPercent: 0,
        actionsApplied: 0,
        estimatedRetentionLift: 0,
      },
    };
  }

  // Analyze each segment for engagement
  const retentionSegments: RetentionSegment[] = segments.map((seg, idx) => {
    const score = calculateEngagementScore(seg, segments, idx);
    const engagement =
      score > 70 ? "high" : score >= 40 ? "medium" : "low";
    const riskFactors = identifyRiskFactors(seg, segments, idx);
    const actions = generateActions(
      seg,
      score,
      riskFactors,
      options.level
    );

    return {
      segmentId: seg.id,
      startSec: seg.startSec,
      endSec: seg.endSec,
      engagement,
      engagementScore: score,
      riskFactors,
      actions,
    };
  });

  // Generate retention curve
  const curve = simulateRetentionCurve(segments, options.durationSec, options.hookEndSec);

  // Calculate stats
  const lowEngagementSegments = retentionSegments.filter((s) => s.engagement === "low");
  const actionsApplied = retentionSegments.reduce((sum, s) => sum + s.actions.length, 0);
  const avgEngagement =
    retentionSegments.reduce((sum, s) => sum + s.engagementScore, 0) /
    retentionSegments.length;

  // Estimate retention lift based on actions and level
  const retentionLift = estimateRetentionLift(
    options.level,
    actionsApplied,
    avgEngagement
  );

  return {
    segments: retentionSegments,
    level: options.level,
    curve,
    stats: {
      avgEngagement: Math.round(avgEngagement),
      lowEngagementPercent: Math.round(
        (lowEngagementSegments.length / retentionSegments.length) * 100
      ),
      actionsApplied,
      estimatedRetentionLift: retentionLift,
    },
  };
}

export function getRetentionLevels(): {
  id: RetentionLevel;
  label: string;
  labelHe: string;
  description: string;
}[] {
  return [
    {
      id: "off",
      label: "Off",
      labelHe: "כבוי",
      description: "No retention optimizations applied",
    },
    {
      id: "light",
      label: "Light",
      labelHe: "קל",
      description: "Minimal B-roll and subtle zoom adjustments",
    },
    {
      id: "balanced",
      label: "Balanced",
      labelHe: "מאוזן",
      description: "B-roll, zoom, and pacing adjustments for sustained engagement",
    },
    {
      id: "aggressive",
      label: "Aggressive",
      labelHe: "אגרסיבי",
      description: "Heavy editing with cuts, pace acceleration, and dense visuals",
    },
  ];
}

export function simulateRetentionCurve(
  segments: TranscriptSegment[],
  durationSec: number,
  hookEndSec: number = durationSec * 0.15
): RetentionCurvePoint[] {
  const points: RetentionCurvePoint[] = [];
  const ctaStartSec = durationSec * 0.85;

  // Sample every segment and interpolate
  let currentRetention = 100;

  for (const seg of segments) {
    const midpoint = (seg.startSec + seg.endSec) / 2;

    // Determine zone
    let zone: "hook" | "body" | "cta" | "ending" = "body";
    if (midpoint < hookEndSec) zone = "hook";
    else if (midpoint >= ctaStartSec) zone = "cta";
    else if (midpoint >= durationSec * 0.95) zone = "ending";

    // Calculate retention change
    const score = calculateEngagementScore(seg, segments, segments.indexOf(seg));
    let retentionChange = 0;

    if (zone === "hook") {
      // Hook zone: maintain high retention
      retentionChange = 0.5;
    } else if (zone === "body") {
      // Body: decay based on engagement
      retentionChange = ((score - 50) / 50) * 3 - 2.5; // -2.5 to +0.5
    } else if (zone === "cta") {
      // CTA: anticipation recovery
      retentionChange = 1.5;
    } else {
      // Ending: slight boost
      retentionChange = 1;
    }

    currentRetention = Math.max(15, Math.min(100, currentRetention + retentionChange));

    points.push({
      timeSec: midpoint,
      retention: Math.round(currentRetention),
      zone,
    });
  }

  // Add end point
  points.push({
    timeSec: durationSec,
    retention: Math.max(15, Math.round(currentRetention - 2)),
    zone: "ending",
  });

  return points;
}

/* ═══════════════════════════════════════════════════════════════════════════
   Helper Functions
   ═══════════════════════════════════════════════════════════════════════════ */

function calculateEngagementScore(
  segment: TranscriptSegment,
  allSegments: TranscriptSegment[],
  index: number
): number {
  let score = 50; // baseline

  const text = segment.text || "";
  const words = text.split(/\s+/).filter((w) => w.length > 0);
  const duration = segment.endSec - segment.startSec;

  // 1. Speech energy (words per second)
  if (duration > 0) {
    const wps = words.length / duration;
    if (wps > 5) score += 15;
    else if (wps > 3) score += 5;
    else if (wps < 1) score -= 10;
  }

  // 2. Content density (unique words ratio)
  const uniqueWords = new Set(words.map((w) => w.toLowerCase())).size;
  const density = uniqueWords / Math.max(words.length, 1);
  if (density > 0.8) score += 10;
  else if (density < 0.4) score -= 10;

  // 3. Filler presence
  const fillerCount = countFillers(text);
  const fillerRatio = fillerCount / Math.max(words.length, 1);
  if (fillerRatio > 0.3) score -= 15;
  else if (fillerRatio > 0.15) score -= 8;

  // 4. Repetition (similarity to previous segment)
  if (index > 0) {
    const prevText = allSegments[index - 1].text || "";
    const similarity = calculateTextSimilarity(text, prevText);
    if (similarity > 0.7) score -= 12;
    else if (similarity > 0.4) score -= 5;
  }

  // 5. Pause before/after
  if (index > 0) {
    const pauseBefore = segment.startSec - allSegments[index - 1].endSec;
    if (pauseBefore > 1.5) score -= 8;
  }

  if (index < allSegments.length - 1) {
    const pauseAfter = allSegments[index + 1].startSec - segment.endSec;
    if (pauseAfter > 1.5) score -= 8;
  }

  return Math.max(0, Math.min(100, score));
}

function countFillers(text: string): number {
  const lowerText = text.toLowerCase();
  let count = 0;

  const allFillers = [...HEBREW_FILLERS, ...ENGLISH_FILLERS];
  for (const filler of allFillers) {
    const regex = new RegExp(`\\b${filler}\\b`, "g");
    count += (lowerText.match(regex) || []).length;
  }

  return count;
}

function calculateTextSimilarity(text1: string, text2: string): number {
  const words1 = new Set(text1.toLowerCase().split(/\s+/));
  const words2 = new Set(text2.toLowerCase().split(/\s+/));

  const intersection = new Set([...words1].filter((w) => words2.has(w)));
  const union = new Set([...words1, ...words2]);

  return union.size === 0 ? 0 : intersection.size / union.size;
}

function identifyRiskFactors(
  segment: TranscriptSegment,
  allSegments: TranscriptSegment[],
  index: number
): string[] {
  const factors: string[] = [];
  const text = segment.text || "";
  const words = text.split(/\s+/).filter((w) => w.length > 0);
  const duration = segment.endSec - segment.startSec;

  // Long pause before
  if (index > 0) {
    const pauseBefore = segment.startSec - allSegments[index - 1].endSec;
    if (pauseBefore > 1.5) factors.push("long-pause");
  }

  // Filler heavy
  const fillerCount = countFillers(text);
  const fillerRatio = fillerCount / Math.max(words.length, 1);
  if (fillerRatio > 0.3) factors.push("filler-heavy");

  // Low energy
  if (duration > 0) {
    const wps = words.length / duration;
    if (wps < 3) factors.push("low-energy");
  }

  // Repetitive
  if (index > 0) {
    const prevText = allSegments[index - 1].text || "";
    const similarity = calculateTextSimilarity(text, prevText);
    if (similarity > 0.7) factors.push("repetitive");
  }

  return factors;
}

function generateActions(
  segment: TranscriptSegment,
  score: number,
  riskFactors: string[],
  level: RetentionLevel
): RetentionAction[] {
  const actions: RetentionAction[] = [];

  if (score > 70) {
    // High engagement, keep as is
    actions.push({
      type: "keep",
      intensity: 0,
      description: "High engagement segment - maintain current pacing",
      descriptionHe: "מקטע עם מעורבות גבוהה - שמור על הקצב הנוכחי",
    });
    return actions;
  }

  if (level === "light") {
    if (score < 70) {
      actions.push({
        type: "add-broll",
        intensity: 0.3,
        description: "Add subtle B-roll for visual variety",
        descriptionHe: "הוסף B-roll עדין לגוון ויזואלי",
      });
    }
    if (riskFactors.length > 0) {
      actions.push({
        type: "add-zoom",
        intensity: 0.2,
        description: "Light zoom effect to maintain attention",
        descriptionHe: "אפקט זום קל לשמירה על תשומת הלב",
      });
    }
  } else if (level === "balanced") {
    if (score < 70) {
      actions.push({
        type: "add-broll",
        intensity: 0.5,
        description: "Add contextual B-roll",
        descriptionHe: "הוסף B-roll הקשור",
      });
    }
    if (riskFactors.includes("low-energy") || score < 50) {
      actions.push({
        type: "add-zoom",
        intensity: 0.4,
        description: "Add zoom for emphasis",
        descriptionHe: "הוסף זום להדגשה",
      });
    }
    if (riskFactors.includes("long-pause")) {
      actions.push({
        type: "tighten-pace",
        intensity: 0.3,
        description: "Tighten pauses to improve flow",
        descriptionHe: "הדק הפסקות לשיפור הזרימה",
      });
    }
  } else if (level === "aggressive") {
    if (riskFactors.includes("filler-heavy")) {
      actions.push({
        type: "cut",
        intensity: 0.6,
        description: "Remove filler words and silence",
        descriptionHe: "הסר מילים מילא ושתיקה",
      });
    }
    actions.push({
      type: "add-broll",
      intensity: 0.8,
      description: "Add heavy B-roll coverage",
      descriptionHe: "הוסף כיסוי B-roll כבד",
    });
    if (score < 60) {
      actions.push({
        type: "add-zoom",
        intensity: 0.7,
        description: "Aggressive zoom for dynamic feel",
        descriptionHe: "זום אגרסיבי להרגשה דינאמית",
      });
    }
    if (riskFactors.includes("low-energy")) {
      actions.push({
        type: "tighten-pace",
        intensity: 0.6,
        description: "Accelerate segment pacing",
        descriptionHe: "האיץ את קצב המקטע",
      });
    }
  }

  return actions;
}

function estimateRetentionLift(
  level: RetentionLevel,
  actionsApplied: number,
  avgEngagement: number
): number {
  if (level === "off") return 0;

  const actionBoost = Math.min(20, actionsApplied * 1.5);
  const engagementFactor = 100 - avgEngagement; // More room to improve = higher potential

  let baseLift = 0;
  if (level === "light") baseLift = 5;
  else if (level === "balanced") baseLift = 12;
  else if (level === "aggressive") baseLift = 20;

  return Math.round(baseLift + actionBoost * (engagementFactor / 100));
}
