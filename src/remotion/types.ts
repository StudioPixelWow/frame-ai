/**
 * PixelManageAI — Remotion Type Definitions
 * Types shared between all Remotion components.
 */

export const FPS = 30;

export type Format = "9:16" | "1:1" | "16:9" | "4:5";

export const FORMAT_DIMENSIONS: Record<string, { width: number; height: number }> = {
  "9:16": { width: 1080, height: 1920 },
  "1:1": { width: 1080, height: 1080 },
  "16:9": { width: 1920, height: 1080 },
  "4:5": { width: 1080, height: 1350 },
};

export interface SubtitleStyleProps {
  font: string;
  fontWeight: number;
  fontSize: number;
  color: string;
  highlightColor: string;
  outlineEnabled: boolean;
  outlineColor: string;
  outlineThickness: number;
  shadow: boolean;
  bgEnabled: boolean;
  bgColor: string;
  bgOpacity: number;
  align: "left" | "center" | "right";
  position: "top" | "center" | "bottom" | "manual";
  manualY?: number; // 0-100 percentage from top (used when position === "manual")
  animation: string;
  lineBreak: "auto" | "balanced";
  highlightMode?: "sequential" | "ai";
  highlightIntensity?: "subtle" | "strong";
}

export interface SubtitleSegmentProps {
  id: string;
  startSec: number;
  endSec: number;
  text: string;
  highlightWord: string;
  highlightStyle: string;
  emphasisWords?: string[];
}

export interface BrollPlacementProps {
  id: string;
  startSec: number;
  endSec: number;
  keyword: string;
  source: "stock" | "ai";
  mediaUrl: string;
}

export interface MusicProps {
  enabled: boolean;
  trackUrl: string;
  volume: number;
  ducking: boolean;
  duckingLevel: number;
  fadeInSec: number;
  fadeOutSec: number;
}

export interface TransitionProps {
  style: string;
  durationMs: number;
}

export interface CleanupCut {
  startSec: number;
  endSec: number;
  type: "filler" | "silence";
}

export interface VisualProps {
  colorGrading: string;
  zoomEnabled: boolean;
  zoomOnSpeech: number;
  zoomOnTransition: number;
  cropForVertical: boolean;
}

export interface PremiumProps {
  enabled: boolean;
  level: "standard" | "premium" | "cinematic";
  motionEffects: boolean;
  colorCorrection: boolean;
}

/** The composition props — the single input to the main composition */
export interface CompositionProps {
  // Source
  videoUrl: string;
  trimStart: number;
  trimEnd: number;
  format: Format | string;

  // Subtitles
  segments: SubtitleSegmentProps[];
  subtitleStyle: SubtitleStyleProps;

  // B-Roll
  brollPlacements: BrollPlacementProps[];

  // Transitions
  transition: TransitionProps;

  // Music
  music: MusicProps;

  // Cleanup
  cleanupCuts: CleanupCut[];

  // Visual
  visual: VisualProps;

  // Premium
  premium: PremiumProps;

  // Metadata
  durationSec: number;
  presetId: string;

  // Advanced editing engine
  zoomKeyframes?: {
    timeSec: number;
    scale: number;
    translateX: number;
    translateY: number;
    easing: string;
    trigger: string;
    durationSec: number;
  }[];
  hookBoost?: {
    active: boolean;
    hookEndSec: number;
    zoomMultiplier: number;
    subtitleFontMultiplier: number;
  };
}
