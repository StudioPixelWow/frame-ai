/**
 * PixelManageAI — Render Payload Builder
 * Converts wizard state into a strongly-typed RenderPayload for Remotion.
 */

import type {
  RenderPayload, SourceVideo, ClipSelection, SubtitleConfig,
  SubtitleStyle, BrandConfig, BrollConfig, CleanupConfig,
  MusicConfig, SoundDesignConfig, JumpCutConfig, ZoomBehavior,
  SmartFramingConfig, ColorGradingConfig, ExportQuality,
  SmartPreset, OutputFormat, SubtitleSegment, TransitionConfig, TransitionStyle,
  PremiumOutputConfig,
} from "./types";
import { QUALITY_PRESETS, SMART_PRESETS, TRANSITION_STYLES } from "./types";
import { parseCreativeInstructions } from "./creative-interpreter";

interface WizardState {
  title: string;
  clientId: string;
  clientName: string;
  creativePrompt: string;
  subtitleFont: string;
  subtitleFontWeight: number;
  subtitleFontSize: number;
  subtitleColor: string;
  subtitleHighlightColor: string;
  subtitleOutlineEnabled: boolean;
  subtitleOutlineColor: string;
  subtitleOutlineThickness: number;
  subtitleShadow: boolean;
  subtitleBg: boolean;
  subtitleBgColor: string;
  subtitleBgOpacity: number;
  subtitleAlign: "left" | "center" | "right";
  subtitlePosition: "top" | "center" | "bottom" | "manual";
  subtitleAnimation: string;
  subtitleLineBreak: "auto" | "balanced";
  highlightMode?: "sequential" | "ai";
  highlightIntensity?: "subtle" | "strong";
  videoFileName: string;
  videoDurationSec: number;
  trimMode: "full" | "clip";
  trimStart: number;
  trimEnd: number;
  format: OutputFormat;
  subtitleMode: "auto" | "manual";
  language: string;
  segments: SubtitleSegment[];
  brollEnabled: boolean;
  brollStyle: "stock" | "ai" | "none";
  brollPlacements: { id: string; startSec: number; endSec: number; keyword: string; source: string; stockProvider?: string; stockClipId?: string; stockPreviewUrl?: string; stockDownloadUrl?: string; mediaStatus?: string }[];
  musicEnabled: boolean;
  musicTrackId: string;
  musicVolume: number;
  musicDucking: boolean;
  musicDuckingLevel: number;
  soundDesignEnabled: boolean;
  sfxOnCuts: boolean;
  sfxStyle: "subtle" | "standard" | "dramatic";
  cleanupFillers: boolean;
  cleanupSilence: boolean;
  cleanupIntensity: "light" | "medium" | "aggressive";
  cleanupRemovedSegments: { id: string; startSec: number; endSec: number; type: "filler" | "silence"; label: string; removed: boolean }[];
  preset: string;
  exportQuality?: ExportQuality;
  transitionStyle: string;
  premiumMode: boolean;
  premiumLevel: "standard" | "premium" | "cinematic";
}

export function buildRenderPayload(projectId: string, ws: WizardState): RenderPayload {
  const presetConfig = SMART_PRESETS.find(p => p.id === ws.preset as any) || null;
  const quality = QUALITY_PRESETS[ws.exportQuality || "premium"];

  const subtitleStyle: SubtitleStyle = {
    font: ws.subtitleFont,
    fontWeight: ws.subtitleFontWeight,
    fontSize: ws.subtitleFontSize,
    color: ws.subtitleColor,
    highlightColor: ws.subtitleHighlightColor,
    outlineEnabled: ws.subtitleOutlineEnabled,
    outlineColor: ws.subtitleOutlineColor,
    outlineThickness: ws.subtitleOutlineThickness,
    shadow: ws.subtitleShadow,
    bgEnabled: ws.subtitleBg,
    bgColor: ws.subtitleBgColor,
    bgOpacity: ws.subtitleBgOpacity,
    align: ws.subtitleAlign,
    position: ws.subtitlePosition,
    manualY: (ws as any).subtitleManualY,
    animation: ws.subtitleAnimation as SubtitleStyle["animation"],
    lineBreak: ws.subtitleLineBreak,
    highlightMode: ws.highlightMode,
    highlightIntensity: ws.highlightIntensity,
  };

  const effectiveDuration = ws.trimMode === "clip"
    ? ws.trimEnd - ws.trimStart
    : ws.videoDurationSec;

  const jumpCutAggression = presetConfig?.jumpCutAggression ?? 30;

  const payload: RenderPayload = {
    version: "1.0",
    projectId,
    createdAt: new Date().toISOString(),

    source: {
      video: {
        fileKey: ws.videoFileName,
        fileName: ws.videoFileName,
        durationSec: ws.videoDurationSec,
        width: 1080, height: 1920, fps: 30, codec: "h264",
      },
      clip: {
        mode: ws.trimMode,
        startSec: ws.trimStart,
        endSec: ws.trimEnd,
        effectiveDurationSec: effectiveDuration,
      },
    },

    output: { format: ws.format, quality },

    subtitles: {
      mode: ws.subtitleMode,
      language: ws.language,
      segments: ws.segments,
      style: subtitleStyle,
      maxWordsPerLine: 2,
      maxLines: 2,
    },

    brand: {
      clientId: ws.clientId,
      clientName: ws.clientName,
      primaryColor: "#00B5FE",
    },

    creative: parseCreativeInstructions(ws.creativePrompt),

    edit: {
      preset: presetConfig,
      jumpCuts: {
        enabled: ws.cleanupFillers || ws.cleanupSilence,
        removeSilence: ws.cleanupSilence,
        removeFillers: ws.cleanupFillers,
        minSilenceDurationMs: ws.cleanupIntensity === "light" ? 1500 : ws.cleanupIntensity === "medium" ? 800 : 400,
        aggression: jumpCutAggression,
        keepEnergyPace: true,
      },
      zoom: presetConfig?.zoomBehavior ?? { enabled: false, onSpeech: 1.0, onTransition: 1.0, speed: "slow" },
      framing: { enabled: true, faceDetection: true, keepSubjectCentered: true, cropForVertical: ws.format === "9:16" },
      colorGrading: quality.colorGrading,
      scenePlan: [],
      cleanup: {
        fillersEnabled: ws.cleanupFillers,
        silenceEnabled: ws.cleanupSilence,
        intensity: ws.cleanupIntensity,
        removedSegments: ws.cleanupRemovedSegments.filter(s => s.removed),
      },
      transition: {
        style: (ws.transitionStyle || "fade") as TransitionStyle,
        durationMs: TRANSITION_STYLES.find(t => t.id === ws.transitionStyle)?.durationMs ?? 500,
        applyToSceneChanges: true,
        applyToBroll: ws.brollEnabled,
      },
    },

    audio: {
      music: {
        enabled: ws.musicEnabled,
        trackId: ws.musicTrackId,
        volume: ws.musicVolume,
        ducking: ws.musicDucking,
        duckingLevel: ws.musicDuckingLevel,
      },
      soundDesign: {
        enabled: ws.soundDesignEnabled,
        sfxOnCuts: ws.sfxOnCuts,
        sfxStyle: ws.sfxStyle,
        duckingEnabled: ws.musicDucking,
        duckingLevel: ws.musicDuckingLevel,
      },
    },

    broll: {
      enabled: ws.brollEnabled,
      style: ws.brollStyle,
      placements: ws.brollPlacements,
    },

    premiumOutput: {
      enabled: ws.premiumMode !== false,
      level: ws.premiumLevel || "premium",
      smartPacing: true,
      audioLayering: ws.musicEnabled,
      visualStructure: true,
      brollEnhancement: ws.brollEnabled,
      subtitleEnhancement: true,
      motionEffects: true,
      colorCorrection: true,
      autoFill: ws.premiumMode !== false,
    },

    metadata: {
      clientId: ws.clientId,
      clientName: ws.clientName,
      projectName: ws.title,
      language: ws.language,
      estimatedDurationSec: Math.round(effectiveDuration),
      segmentCount: ws.segments.length,
      brollPlacementCount: ws.brollPlacements.length,
      cleanupRemovedCount: ws.cleanupRemovedSegments.filter(s => s.removed).length,
    },
  };

  return payload;
}
