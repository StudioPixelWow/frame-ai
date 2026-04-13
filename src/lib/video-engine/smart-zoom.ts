/**
 * Smart Zoom System for Video Editing
 *
 * Analyzes transcript segments to intelligently generate zoom keyframes.
 * Supports multiple zoom styles (subtle, social, cinematic) with trigger-based
 * zoom patterns (emphasis, hooks, CTAs, transitions, breathing).
 *
 * Generates deterministic, style-aware keyframes optimized for different formats.
 */

/* ═══════════════════════════════════════════════════════════════════════════
   Types
   ═══════════════════════════════════════════════════════════════════════════ */

export type ZoomStyle = "off" | "subtle" | "social" | "cinematic";

export interface ZoomKeyframe {
  timeSec: number;
  scale: number;          // 1.0 = no zoom, 1.15 = 15% zoom in
  translateX: number;     // -1 to 1 normalized pan
  translateY: number;     // -1 to 1 normalized pan
  easing: "linear" | "ease-in" | "ease-out" | "ease-in-out";
  trigger: "emphasis" | "hook" | "cta" | "transition" | "breathing" | "reset";
  durationSec: number;    // how long this zoom holds
}

export interface ZoomPlan {
  keyframes: ZoomKeyframe[];
  style: ZoomStyle;
  stats: { totalZooms: number; avgScale: number; maxScale: number; coveragePercent: number };
}

export interface SmartZoomOptions {
  style: ZoomStyle;
  segments: { id: string; startSec: number; endSec: number; text: string; highlightWord?: string }[];
  durationSec: number;
  format: "9:16" | "16:9" | "1:1" | "4:5";
  hookStrength?: "subtle" | "balanced" | "aggressive";
}

/* ═══════════════════════════════════════════════════════════════════════════
   Constants
   ═══════════════════════════════════════════════════════════════════════════ */

const EMPHASIS_WORDS = {
  en: ["important", "exactly", "but", "because", "most", "never", "always", "must", "critical"],
  he: ["חשוב", "בדיוק", "אבל", "כי", "הכי", "אף", "תמיד", "חייב", "קריטי"],
};

const CTA_KEYWORDS = {
  en: ["now", "click", "sign up", "subscribe", "register", "join", "buy", "get", "link"],
  he: ["עכשיו", "לחץ", "הרשמו", "שבצו", "הצטרפו", "קנו", "קח", "קישור", "לפה"],
};

/* ═══════════════════════════════════════════════════════════════════════════
   Seeded Random Generator (deterministic)
   ═══════════════════════════════════════════════════════════════════════════ */

function seededRand(seed: number): number {
  const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453123;
  return x - Math.floor(x);
}

/* ═══════════════════════════════════════════════════════════════════════════
   Analysis Functions
   ═══════════════════════════════════════════════════════════════════════════ */

function detectEmphasis(text: string): boolean {
  const lower = text.toLowerCase();
  const words = [...EMPHASIS_WORDS.en, ...EMPHASIS_WORDS.he];
  return words.some((word) => lower.includes(word));
}

function detectCTA(text: string): boolean {
  const lower = text.toLowerCase();
  const words = [...CTA_KEYWORDS.en, ...CTA_KEYWORDS.he];
  return words.some((word) => lower.includes(word));
}

function detectEmotionalPeak(text: string): boolean {
  // Multiple exclamation marks or all caps segments suggest emotional intensity
  const exclamationCount = (text.match(/!/g) || []).length;
  const questionCount = (text.match(/\?/g) || []).length;
  const allCaps = text.length > 0 && text === text.toUpperCase();
  return exclamationCount > 1 || (exclamationCount > 0 && questionCount > 0) || allCaps;
}

function isVerticalFormat(format: "9:16" | "16:9" | "1:1" | "4:5"): boolean {
  return format === "9:16" || format === "4:5";
}

function getDefaultTranslate(format: "9:16" | "16:9" | "1:1" | "4:5", seed: number): [number, number] {
  if (isVerticalFormat(format)) {
    // Vertical: center on face (upper 40% of frame)
    const xPan = (seededRand(seed * 2) - 0.5) * 0.3;  // -0.15 to 0.15
    return [xPan, -0.2];  // Slight upward bias for face
  }
  // Horizontal: slight random pan
  const xPan = (seededRand(seed * 2) - 0.5) * 0.4;
  const yPan = (seededRand(seed * 3) - 0.5) * 0.3;
  return [xPan, yPan];
}

/* ═══════════════════════════════════════════════════════════════════════════
   Main Generation Function
   ═══════════════════════════════════════════════════════════════════════════ */

export function generateZoomPlan(options: SmartZoomOptions): ZoomPlan {
  const keyframes: ZoomKeyframe[] = [];

  if (options.style === "off") {
    return {
      keyframes: [],
      style: "off",
      stats: { totalZooms: 0, avgScale: 1, maxScale: 1, coveragePercent: 0 },
    };
  }

  const { segments, durationSec, format, hookStrength = "balanced" } = options;
  const lastSegmentEnd = segments.length > 0 ? Math.max(...segments.map((s) => s.endSec)) : durationSec;

  // Style-specific parameters
  const styleParams = {
    subtle: { minScale: 1.02, maxScale: 1.08, frequency: 10, easing: "ease-out" as const, durationFactor: 1.5 },
    social: { minScale: 1.05, maxScale: 1.15, frequency: 5, easing: "ease-in-out" as const, durationFactor: 1.0 },
    cinematic: { minScale: 1.03, maxScale: 1.1, frequency: 8, easing: "ease-out" as const, durationFactor: 1.2 },
  };

  const params = styleParams[options.style];
  let totalZoomDuration = 0;

  // Detect zones in the video
  const hookEnd = Math.min(5, durationSec * 0.1);
  const ctaStart = Math.max(lastSegmentEnd * 0.9, durationSec - 10);

  // Process each segment
  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    const midpoint = (seg.startSec + seg.endSec) / 2;
    const isHook = seg.startSec < hookEnd;
    const isCTA = seg.startSec >= ctaStart;
    const hasEmphasis = detectEmphasis(seg.text);
    const hasEmotional = detectEmotionalPeak(seg.text);
    const hasCTA = detectCTA(seg.text);

    // Determine trigger and scale
    let trigger: ZoomKeyframe["trigger"] = "breathing";
    let scaleMultiplier = 1;

    if (hasCTA || isCTA) {
      trigger = "cta";
      scaleMultiplier = 1.2;
    } else if (hasEmotional) {
      trigger = "emphasis";
      scaleMultiplier = 1.25;
    } else if (hasEmphasis) {
      trigger = "emphasis";
      scaleMultiplier = 1.1;
    } else if (isHook) {
      trigger = "hook";
      scaleMultiplier = hookStrength === "aggressive" ? 1.3 : hookStrength === "subtle" ? 1.15 : 1.25;
    }

    // Generate zoom keyframe only if criteria met
    const shouldZoom =
      trigger !== "breathing" ||
      (options.style === "social") ||
      seededRand(i * 13 + 7) > 0.5;

    if (shouldZoom && trigger !== "breathing") {
      const baseScale = Math.min(params.maxScale, params.minScale + (params.maxScale - params.minScale) * 0.6);
      const scale = Math.min(params.maxScale, baseScale * scaleMultiplier);
      const duration = Math.min(seg.endSec - seg.startSec, 2);
      const [translateX, translateY] = getDefaultTranslate(format, i);

      keyframes.push({
        timeSec: midpoint,
        scale,
        translateX,
        translateY,
        easing: params.easing,
        trigger,
        durationSec: duration * params.durationFactor,
      });

      totalZoomDuration += duration * params.durationFactor;

      // Add reset keyframe after zoom
      keyframes.push({
        timeSec: midpoint + duration * params.durationFactor,
        scale: 1.0,
        translateX: 0,
        translateY: 0,
        easing: "ease-out",
        trigger: "reset",
        durationSec: 0.3,
      });
    }
  }

  // Add breathing keyframes between zooms (only for social style or if sparse)
  if (options.style === "social" || keyframes.length < durationSec / 4) {
    for (let i = 1; i * params.frequency < durationSec; i++) {
      const timeSec = i * params.frequency;
      const seed = i * 31 + 17;

      // Skip if too close to existing keyframes
      const tooClose = keyframes.some((kf) => Math.abs(kf.timeSec - timeSec) < 0.5);
      if (tooClose) continue;

      const [translateX, translateY] = getDefaultTranslate(format, seed);
      keyframes.push({
        timeSec,
        scale: 1.01 + seededRand(seed) * 0.01,  // 1.01-1.02
        translateX,
        translateY,
        easing: "linear",
        trigger: "breathing",
        durationSec: 0.5,
      });
    }
  }

  // Sort by time
  keyframes.sort((a, b) => a.timeSec - b.timeSec);

  // Calculate stats
  const scales = keyframes.map((kf) => kf.scale);
  const nonResetZooms = keyframes.filter((kf) => kf.trigger !== "reset" && kf.scale > 1);
  const avgScale = scales.length > 0 ? scales.reduce((a, b) => a + b) / scales.length : 1;
  const maxScale = Math.max(...scales, 1);
  const coveragePercent = Math.round((totalZoomDuration / durationSec) * 100);

  return {
    keyframes,
    style: options.style,
    stats: {
      totalZooms: nonResetZooms.length,
      avgScale: Math.round(avgScale * 100) / 100,
      maxScale: Math.round(maxScale * 100) / 100,
      coveragePercent,
    },
  };
}

/* ═══════════════════════════════════════════════════════════════════════════
   UI Metadata
   ═══════════════════════════════════════════════════════════════════════════ */

export function getZoomStyles(): { id: ZoomStyle; label: string; labelHe: string; description: string }[] {
  return [
    {
      id: "off",
      label: "No Zoom",
      labelHe: "ללא הגדלה",
      description: "Disabled. No automatic zoom keyframes generated.",
    },
    {
      id: "subtle",
      label: "Subtle",
      labelHe: "עדין",
      description: "Light zoom effect (2-8% scale). Sparse, every 8-12 sec. Professional, understated.",
    },
    {
      id: "social",
      label: "Social",
      labelHe: "סוציאלי",
      description: "Punchy zoom (5-15% scale). Frequent, every 4-6 sec. Great for shorts, reels, TikTok.",
    },
    {
      id: "cinematic",
      label: "Cinematic",
      labelHe: "קינמטי",
      description: "Smooth zoom (3-10% scale). Measured, every 6-10 sec. Dramatic, professional feel.",
    },
  ];
}
