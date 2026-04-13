/**
 * PixelFrameAI — Speech-based Pacing Engine
 *
 * Analyzes transcript timing to optimize edit rhythm based on speech patterns,
 * silence detection, and content energy levels. Supports multiple pacing modes
 * tailored for different audiences and platforms (YouTube, TikTok, etc).
 *
 * Features:
 *  - Silence gap detection and trimming
 *  - Energy classification (low/medium/high)
 *  - Hebrew filler word detection
 *  - Mode-based optimization (relaxed, balanced, punchy, viral)
 *  - Dynamic speed adjustment without cutting mid-sentence
 */

/* ═══════════════════════════════════════════════════════════════════════════
   Types
   ═══════════════════════════════════════════════════════════════════════════ */

export type PacingMode = "relaxed" | "balanced" | "punchy" | "viral";

export interface TranscriptSegment {
  id: string;
  startSec: number;
  endSec: number;
  text: string;
  highlightWord?: string;
}

export interface PacingSegment {
  segmentId: string;
  startSec: number;
  endSec: number;
  originalDuration: number;
  adjustedDuration: number;
  speedFactor: number;
  energy: "low" | "medium" | "high";
  action: "keep" | "tighten" | "cut" | "emphasize";
  silenceBefore: number;
  silenceAfter: number;
  trimSilenceBefore: number;
  trimSilenceAfter: number;
}

export interface PacingPlan {
  segments: PacingSegment[];
  mode: PacingMode;
  stats: {
    originalDuration: number;
    adjustedDuration: number;
    savedTime: number;
    savedPercent: number;
    segmentsTightened: number;
    segmentsCut: number;
    avgEnergy: number;
  };
}

interface PacingModeConfig {
  silenceThreshold: number;
  speedUpFactor: number;
  cutFillers: boolean;
  preserveBreathing: boolean;
}

/* ═══════════════════════════════════════════════════════════════════════════
   Constants
   ═══════════════════════════════════════════════════════════════════════════ */

const HEBREW_FILLERS = ["אממ", "אהה", "כאילו", "אז", "נו", "כן", "יודע", "יודעת"];
const ENGLISH_FILLERS = ["um", "uh", "like", "you know", "actually", "basically"];
const ALL_FILLERS = [...HEBREW_FILLERS, ...ENGLISH_FILLERS];

const PACING_CONFIGS: Record<PacingMode, PacingModeConfig> = {
  relaxed: {
    silenceThreshold: 1.5,
    speedUpFactor: 0.0,
    cutFillers: false,
    preserveBreathing: true,
  },
  balanced: {
    silenceThreshold: 0.8,
    speedUpFactor: 0.1,
    cutFillers: false,
    preserveBreathing: true,
  },
  punchy: {
    silenceThreshold: 0.4,
    speedUpFactor: 0.1,
    cutFillers: true,
    preserveBreathing: false,
  },
  viral: {
    silenceThreshold: 0.2,
    speedUpFactor: 0.2,
    cutFillers: true,
    preserveBreathing: false,
  },
};

/* ═══════════════════════════════════════════════════════════════════════════
   Core Functions
   ═══════════════════════════════════════════════════════════════════════════ */

export function analyzeSpeechPacing(
  segments: TranscriptSegment[],
  options: { mode: PacingMode; durationSec: number }
): PacingPlan {
  const config = PACING_CONFIGS[options.mode];

  // Calculate silence gaps between segments
  const silenceGaps = calculateSilenceGaps(segments);

  // Classify energy for each segment
  const energyLevels = segments.map((seg) => classifyEnergy(seg.text));

  // Build pacing segments with silence analysis
  const pacingSegments: PacingSegment[] = segments.map((seg, idx) => {
    const energy = energyLevels[idx];
    const isFiller = isFillerSegment(seg.text);
    const silenceBefore = silenceGaps[idx]?.before || 0;
    const silenceAfter = silenceGaps[idx]?.after || 0;

    // Determine action based on mode and content
    let action: "keep" | "tighten" | "cut" | "emphasize" = "keep";
    if (isFiller && config.cutFillers) {
      action = "cut";
    } else if (energy === "low" && config.speedUpFactor > 0) {
      action = "tighten";
    } else if (energy === "high" || seg.highlightWord) {
      action = "emphasize";
    }

    // Calculate silence trimming
    const trimSilenceBefore =
      silenceBefore > config.silenceThreshold
        ? Math.max(0.1, silenceBefore - config.silenceThreshold)
        : 0;
    const trimSilenceAfter =
      silenceAfter > config.silenceThreshold
        ? Math.max(0.1, silenceAfter - config.silenceThreshold)
        : 0;

    // Calculate speed factor
    let speedFactor = 1.0;
    if (action === "tighten" && energy === "low") {
      speedFactor = 1.0 + config.speedUpFactor;
    } else if (action === "emphasize") {
      speedFactor = Math.max(0.8, 1.0 - config.speedUpFactor * 0.5);
    }

    const originalDuration = seg.endSec - seg.startSec;
    const adjustedDuration =
      (originalDuration - trimSilenceBefore - trimSilenceAfter) / speedFactor;

    return {
      segmentId: seg.id,
      startSec: seg.startSec,
      endSec: seg.endSec,
      originalDuration,
      adjustedDuration: Math.max(0.2, adjustedDuration),
      speedFactor,
      energy,
      action,
      silenceBefore,
      silenceAfter,
      trimSilenceBefore,
      trimSilenceAfter,
    };
  });

  // Calculate statistics
  const originalDuration = options.durationSec;
  const adjustedDuration = pacingSegments.reduce((sum, seg) => sum + seg.adjustedDuration, 0);
  const savedTime = Math.max(0, originalDuration - adjustedDuration);
  const savedPercent = originalDuration > 0 ? (savedTime / originalDuration) * 100 : 0;

  const stats = {
    originalDuration,
    adjustedDuration,
    savedTime,
    savedPercent,
    segmentsTightened: pacingSegments.filter((s) => s.action === "tighten").length,
    segmentsCut: pacingSegments.filter((s) => s.action === "cut").length,
    avgEnergy: calculateAverageEnergy(pacingSegments),
  };

  return {
    segments: pacingSegments,
    mode: options.mode,
    stats,
  };
}

export function getPacingModes(): Array<{
  id: PacingMode;
  label: string;
  labelHe: string;
  description: string;
}> {
  return [
    {
      id: "relaxed",
      label: "Relaxed",
      labelHe: "רגוע",
      description:
        "Preserve natural breathing room. Only remove long silences (>1.5s). Best for educational or thoughtful content.",
    },
    {
      id: "balanced",
      label: "Balanced",
      labelHe: "מאוזן",
      description:
        "Moderate pacing optimization. Remove medium silences (>0.8s) and speed up low-energy segments 10%. Good for most content.",
    },
    {
      id: "punchy",
      labelHe: "תוקפני",
      label: "Punchy",
      description:
        "Aggressive editing for tight pacing. Remove >0.4s silences, speed up low-energy 10%, remove filler words. Best for entertainment.",
    },
    {
      id: "viral",
      label: "Viral",
      labelHe: "וירלי",
      description:
        "Maximum engagement. Remove >0.2s silences, speed up low-energy 20%, cut all fillers, tighten everything. For short-form content.",
    },
  ];
}

/* ═══════════════════════════════════════════════════════════════════════════
   Helper Functions
   ═══════════════════════════════════════════════════════════════════════════ */

function calculateSilenceGaps(
  segments: TranscriptSegment[]
): Array<{ before: number; after: number }> {
  return segments.map((seg, idx) => {
    const before = idx > 0 ? Math.max(0, seg.startSec - segments[idx - 1].endSec) : 0;
    const after =
      idx < segments.length - 1
        ? Math.max(0, segments[idx + 1].startSec - seg.endSec)
        : 0;

    return { before, after };
  });
}

function classifyEnergy(text: string): "low" | "medium" | "high" {
  const wordCount = text.split(/\s+/).length;
  const duration = text.length;
  const hasExclamation = text.includes("!");
  const hasQuestion = text.includes("?");

  // High energy: short, fast delivery with punctuation
  if (wordCount < 5 && hasExclamation) return "high";
  if (wordCount < 8 && duration < 20 && (hasExclamation || hasQuestion))
    return "high";

  // Low energy: very short segments or long, slow delivery
  if (wordCount < 3 && duration > 10) return "low";
  if (wordCount > 30) return "low";

  // Medium: everything else
  return "medium";
}

function isFillerSegment(text: string): boolean {
  const lowerText = text.toLowerCase().trim();

  // Check if entire segment is a filler
  for (const filler of ALL_FILLERS) {
    if (lowerText === filler || lowerText.startsWith(filler + " ")) {
      return true;
    }
  }

  // Check for Hebrew fillers at start
  for (const hebrewFiller of HEBREW_FILLERS) {
    if (lowerText.startsWith(hebrewFiller + " ")) {
      return true;
    }
  }

  return false;
}

function calculateAverageEnergy(segments: PacingSegment[]): number {
  const energyValues: Record<string, number> = {
    low: 1,
    medium: 2,
    high: 3,
  };

  if (segments.length === 0) return 0;

  const sum = segments.reduce((acc, seg) => acc + energyValues[seg.energy], 0);
  return sum / segments.length;
}
