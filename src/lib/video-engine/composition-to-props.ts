/**
 * PixelFrameAI — Composition Data to Remotion Props Converter
 * Transforms the finalCompositionData into the props shape expected by
 * the Remotion PixelFrameEdit composition.
 */

import type { FinalCompositionData } from "./composition-data";

/** Shape expected by the Remotion composition */
export interface RemotionInputProps {
  videoUrl: string;
  trimStart: number;
  trimEnd: number;
  format: string;
  segments: {
    id: string;
    startSec: number;
    endSec: number;
    text: string;
    highlightWord: string;
    highlightStyle: string;
  }[];
  subtitleStyle: {
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
    align: string;
    position: string;
    manualY?: number;
    animation: string;
    lineBreak: string;
  };
  brollPlacements: {
    id: string;
    startSec: number;
    endSec: number;
    keyword: string;
    source: string;
    mediaUrl: string;
  }[];
  transition: {
    style: string;
    durationMs: number;
  };
  music: {
    enabled: boolean;
    trackUrl: string;
    volume: number;
    ducking: boolean;
    duckingLevel: number;
    fadeInSec: number;
    fadeOutSec: number;
  };
  cleanupCuts: {
    startSec: number;
    endSec: number;
    type: string;
  }[];
  visual: {
    colorGrading: string;
    zoomEnabled: boolean;
    zoomOnSpeech: number;
    zoomOnTransition: number;
    cropForVertical: boolean;
  };
  premium: {
    enabled: boolean;
    level: string;
    motionEffects: boolean;
    colorCorrection: boolean;
  };
  durationSec: number;
  presetId: string;

  // Advanced editing engine data
  zoomKeyframes: {
    timeSec: number;
    scale: number;
    translateX: number;
    translateY: number;
    easing: string;
    trigger: string;
    durationSec: number;
  }[];
  hookBoost: {
    active: boolean;
    hookEndSec: number;
    zoomMultiplier: number;
    subtitleFontMultiplier: number;
  };
}

/**
 * Convert FinalCompositionData → Remotion CompositionProps
 */
export function compositionToProps(data: FinalCompositionData): RemotionInputProps {
  // Validate required structure exists
  if (!data?.source || !data?.timeline || !data?.subtitles || !data?.audio || !data?.visual || !data?.premium) {
    const missing = [
      !data?.source && "source",
      !data?.timeline && "timeline",
      !data?.subtitles && "subtitles",
      !data?.audio && "audio",
      !data?.visual && "visual",
      !data?.premium && "premium",
    ].filter(Boolean).join(", ");
    throw new Error(`compositionToProps: FinalCompositionData is missing required sections: ${missing}. Got keys: ${data ? Object.keys(data).join(", ") : "(null)"}`);
  }

  console.log("[compositionToProps] videoUrl:", data.source.videoUrl?.substring(0, 80) || "(empty)",
    "| tracks:", data.timeline.tracks?.map(t => t.type).join(",") || "(none)",
    "| duration:", data.timeline.durationSec);
  // Extract subtitle segments from timeline
  const subtitleTrack = data.timeline.tracks.find(t => t.type === "subtitle");
  const segments = subtitleTrack
    ? subtitleTrack.items.map((item: any) => ({
        id: item.id,
        startSec: item.startSec,
        endSec: item.endSec,
        text: item.metadata?.text || "",
        highlightWord: item.metadata?.highlightWord || "",
        highlightStyle: item.metadata?.highlightStyle || "color",
      }))
    : [];

  // Extract B-roll placements from timeline
  const brollTrack = data.timeline.tracks.find(t => t.type === "broll");
  const brollPlacements = brollTrack
    ? brollTrack.items.map((item: any) => ({
        id: item.id,
        startSec: item.startSec,
        endSec: item.endSec,
        keyword: item.metadata?.keyword || "",
        source: item.metadata?.source || "stock",
        mediaUrl: item.metadata?.mediaUrl || "",
      }))
    : [];

  // Extract cleanup cuts from timeline (removed main video segments)
  const mainTrack = data.timeline.tracks.find(t => t.type === "main");
  const cleanupCuts: { startSec: number; endSec: number; type: string }[] = [];
  // The cleanup is already applied to the timeline, but we pass the original cuts
  // so the Remotion composition can handle them

  return {
    videoUrl: data.source.videoUrl,
    trimStart: data.source.trimStart,
    trimEnd: data.source.trimEnd,
    format: data.output.format,

    segments,

    subtitleStyle: {
      font: data.subtitles.style.font,
      fontWeight: data.subtitles.style.fontWeight,
      fontSize: data.subtitles.style.fontSize,
      color: data.subtitles.style.color,
      highlightColor: data.subtitles.style.highlightColor,
      outlineEnabled: data.subtitles.style.outlineEnabled,
      outlineColor: data.subtitles.style.outlineColor,
      outlineThickness: data.subtitles.style.outlineThickness,
      shadow: data.subtitles.style.shadow,
      bgEnabled: data.subtitles.style.bgEnabled,
      bgColor: data.subtitles.style.bgColor,
      bgOpacity: data.subtitles.style.bgOpacity,
      align: data.subtitles.style.align,
      position: data.subtitles.style.position,
      manualY: (data.subtitles.style as any).manualY,
      animation: data.subtitles.style.animation,
      lineBreak: data.subtitles.style.lineBreak,
    },

    brollPlacements,

    transition: {
      style: data.transition.style,
      durationMs: data.transition.durationMs,
    },

    music: {
      enabled: data.audio.music.enabled,
      trackUrl: data.audio.music.trackUrl,
      volume: data.audio.music.volume,
      ducking: data.audio.music.ducking,
      duckingLevel: data.audio.music.duckingLevel,
      fadeInSec: data.audio.music.fadeInSec,
      fadeOutSec: data.audio.music.fadeOutSec,
    },

    cleanupCuts,

    visual: {
      colorGrading: data.visual.colorGrading,
      zoomEnabled: data.visual.zoomEnabled,
      zoomOnSpeech: data.visual.zoomOnSpeech,
      zoomOnTransition: data.visual.zoomOnTransition,
      cropForVertical: data.visual.cropForVertical,
    },

    premium: {
      enabled: data.premium.enabled,
      level: data.premium.level,
      motionEffects: data.premium.motionEffects,
      colorCorrection: data.premium.colorCorrection,
    },

    durationSec: data.timeline.durationSec,
    presetId: data.visual.preset?.id || "viral",

    // Advanced editing engine
    zoomKeyframes: data.editEngine?.zoomKeyframes || [],
    hookBoost: data.editEngine?.hook
      ? {
          active: true,
          hookEndSec: data.editEngine.hook.hookEndSec,
          zoomMultiplier: data.editEngine.hook.zoomBoost,
          subtitleFontMultiplier: data.editEngine.hook.subtitleFontSizeMultiplier,
        }
      : { active: false, hookEndSec: 0, zoomMultiplier: 1, subtitleFontMultiplier: 1 },
  };
}
