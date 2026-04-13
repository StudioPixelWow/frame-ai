/**
 * PixelFrameAI — Composition Data Builder
 * Converts wizard state into finalCompositionData — the single source of truth
 * for both preview (Remotion Player) and render (Remotion SSR).
 */

import type {
  Timeline, TimelineTrack, VideoClipItem, BrollClipItem,
  SubtitleItem, MusicItem, TransitionEventItem,
} from "./timeline";
import type {
  TransitionStyle, TransitionConfig, PremiumOutputConfig,
  SmartPreset, ExportQuality, OutputFormat, SubtitleStyle,
} from "./types";
import { SMART_PRESETS, QUALITY_PRESETS } from "./types";

/* ── Input from wizard ── */
export interface WizardSnapshot {
  projectId: string;
  title: string;
  clientId: string;
  clientName: string;
  creativePrompt: string;

  // Source
  videoUrl: string;
  videoFileName: string;
  videoDurationSec: number;
  trimMode: "full" | "clip";
  trimStart: number;
  trimEnd: number;
  format: OutputFormat;

  // Subtitles
  subtitleMode: "auto" | "manual";
  language: string;
  segments: {
    id: string;
    startSec: number;
    endSec: number;
    text: string;
    edited: boolean;
    highlightWord: string;
    highlightStyle: string;
    confidence?: number;
    emphasisWords?: string[];
  }[];
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
  subtitleManualY?: number;
  subtitleAnimation: string;
  subtitleLineBreak: "auto" | "balanced";
  highlightMode?: "sequential" | "ai";
  highlightIntensity?: "subtle" | "strong";

  // B-roll
  brollEnabled: boolean;
  brollStyle: "stock" | "ai" | "none";
  brollPlacements: {
    id: string;
    startSec: number;
    endSec: number;
    keyword: string;
    source: string;
    stockProvider?: string;
    stockClipId?: string;
    stockPreviewUrl?: string;
    stockDownloadUrl?: string;
    mediaStatus?: string;
  }[];

  // Transitions
  transitionStyle: TransitionStyle;

  // Music
  musicEnabled: boolean;
  musicTrackId: string;
  musicTrackTitle?: string;
  musicTrackUrl?: string;
  musicVolume: number;
  musicDucking: boolean;
  musicDuckingLevel: number;

  // Sound design
  soundDesignEnabled: boolean;
  sfxOnCuts: boolean;
  sfxStyle: "subtle" | "standard" | "dramatic";

  // Cleanup
  cleanupFillers: boolean;
  cleanupSilence: boolean;
  cleanupIntensity: "light" | "medium" | "aggressive";
  cleanupRemovedSegments: {
    id: string;
    startSec: number;
    endSec: number;
    type: "filler" | "silence";
    label: string;
    removed: boolean;
  }[];

  // AI & Presets
  preset: string;
  exportQuality: ExportQuality;
  aiEditMode: string;
  aiDirectionNotes: string;

  // Premium
  premiumMode: boolean;
  premiumLevel: "standard" | "premium" | "cinematic";
}

/* ── The single source of truth ── */
export interface FinalCompositionData {
  version: string;
  projectId: string;
  title: string;
  createdAt: string;

  // Timeline
  timeline: Timeline;

  // Source
  source: {
    videoUrl: string;
    fileName: string;
    originalDurationSec: number;
    trimMode: "full" | "clip";
    trimStart: number;
    trimEnd: number;
    effectiveDurationSec: number;
  };

  // Output
  output: {
    format: OutputFormat;
    width: number;
    height: number;
    fps: number;
    quality: ExportQuality;
    codec: string;
  };

  // Subtitle config
  subtitles: {
    mode: "auto" | "manual";
    language: string;
    style: SubtitleStyle;
    maxWordsPerLine: number;
    maxLines: number;
  };

  // Transition config
  transition: TransitionConfig;

  // Audio
  audio: {
    sourceAudioEnabled: boolean;
    music: {
      enabled: boolean;
      trackId: string;
      trackTitle: string;
      trackUrl: string;
      volume: number;
      ducking: boolean;
      duckingLevel: number;
      fadeInSec: number;
      fadeOutSec: number;
    };
    soundDesign: {
      enabled: boolean;
      sfxOnCuts: boolean;
      sfxStyle: string;
    };
  };

  // Visual
  visual: {
    preset: SmartPreset | null;
    colorGrading: string;
    zoomEnabled: boolean;
    zoomOnSpeech: number;
    zoomOnTransition: number;
    framingEnabled: boolean;
    cropForVertical: boolean;
  };

  // Premium
  premium: PremiumOutputConfig;

  // Brand
  brand: {
    clientId: string;
    clientName: string;
    primaryColor: string;
  };

  // AI
  ai: {
    editMode: string;
    directionNotes: string;
    creativePrompt: string;
  };

  // Metadata
  metadata: {
    segmentCount: number;
    brollPlacementCount: number;
    cleanupRemovedCount: number;
    estimatedRenderDurationSec: number;
    language: string;
  };

  // ─── Advanced Editing Engine (optional — populated when unified edit is active) ───
  editEngine?: {
    /** Smart zoom keyframes for dynamic camera motion */
    zoomKeyframes: {
      timeSec: number;
      scale: number;
      translateX: number;
      translateY: number;
      easing: string;
      trigger: string;
      durationSec: number;
    }[];
    /** Pacing adjustments per segment */
    pacingSegments: {
      segmentId: string;
      speedFactor: number;
      trimSilenceBefore: number;
      trimSilenceAfter: number;
      action: string;
      energy: string;
    }[];
    /** Hook enhancement settings */
    hook: {
      hookType: string;
      hookScore: number;
      hookEndSec: number;
      zoomBoost: number;
      pacingBoost: number;
      brollIntensity: number;
      subtitleFontSizeMultiplier: number;
      skipIntroToSec: number;
    } | null;
    /** Retention curve for visualization */
    retentionCurve: {
      timeSec: number;
      retention: number;
      zone: string;
    }[];
    /** Active edit profile */
    profile: {
      brollIntensity: string;
      zoomStyle: string;
      pacingMode: string;
      hookStrength: string;
      retentionLevel: string;
    } | null;
    /** Overall edit quality score */
    overallEditScore: number;
  };
}

/* ── Format dimensions lookup ── */
const FORMAT_DIMENSIONS: Record<string, { width: number; height: number }> = {
  "9:16": { width: 1080, height: 1920 },
  "16:9": { width: 1920, height: 1080 },
  "1:1": { width: 1080, height: 1080 },
  "4:5": { width: 1080, height: 1350 },
};

const FPS = 30;

/* ── Media URL resolvers ── */

/**
 * Resolve B-roll media URL.
 * In production: hits stock API or AI image generation.
 * Currently: uses the source video itself as B-roll (different section).
 * The BrollLayer component will apply styling to distinguish it visually.
 */
function resolveBrollMediaUrl(keyword: string, source: string, videoUrl: string): string {
  // Use the source video as B-roll media — the composition will handle
  // the visual treatment (gradient overlay, keyword badge) to differentiate it.
  // This ensures real media is always available for rendering.
  if (videoUrl) return videoUrl;
  // Fallback: empty string triggers gradient placeholder in BrollLayer
  return "";
}

/**
 * Resolve music track URL via the procedural audio API.
 * The /api/media/audio endpoint generates real WAV files.
 */
function resolveMusicUrl(trackId: string): string {
  if (!trackId) return "";
  // Use the API endpoint — works in browser preview via relative URL.
  // For server-side rendering, the render API pre-generates the audio file.
  return `/api/media/audio?trackId=${encodeURIComponent(trackId)}&duration=60`;
}

/**
 * Resolve music URL for render context where API routes aren't available.
 * Returns a static file path pointing to pre-generated WAV.
 */
export function resolveMusicUrlForRender(trackId: string): string {
  if (!trackId) return "";
  // Check for pre-generated v2 file first, then v1
  return `/media/audio/${trackId}_v2.wav`;
}

/* ── Build timeline from wizard state ── */
function buildTimeline(ws: WizardSnapshot): Timeline {
  const effectiveStart = ws.trimMode === "clip" ? ws.trimStart : 0;
  const effectiveEnd = ws.trimMode === "clip" ? ws.trimEnd : ws.videoDurationSec;
  const effectiveDuration = effectiveEnd - effectiveStart;

  const tracks: TimelineTrack[] = [];

  // ─── Main Video Track ───
  const mainItems: VideoClipItem[] = [];
  const removedSet = new Set(
    ws.cleanupRemovedSegments.filter(s => s.removed).map(s => `${s.startSec}-${s.endSec}`)
  );

  // Build main video clips (splitting around removed segments)
  const removedSegments = ws.cleanupRemovedSegments
    .filter(s => s.removed)
    .sort((a, b) => a.startSec - b.startSec);

  if (removedSegments.length === 0) {
    // No cleanup — single main clip
    mainItems.push({
      id: "main-0",
      type: "video-clip",
      trackType: "main",
      startSec: 0,
      endSec: effectiveDuration,
      durationSec: effectiveDuration,
      metadata: {
        sourceStartSec: effectiveStart,
        sourceEndSec: effectiveEnd,
        removed: false,
        zoomLevel: 1.0,
        panX: 0,
        panY: 0,
      },
    });
  } else {
    // Split main video around removed segments
    let cursor = effectiveStart;
    let outputCursor = 0;
    let clipIdx = 0;

    for (const removed of removedSegments) {
      if (removed.startSec > cursor) {
        const dur = removed.startSec - cursor;
        mainItems.push({
          id: `main-${clipIdx}`,
          type: "video-clip",
          trackType: "main",
          startSec: outputCursor,
          endSec: outputCursor + dur,
          durationSec: dur,
          metadata: {
            sourceStartSec: cursor,
            sourceEndSec: removed.startSec,
            removed: false,
            zoomLevel: 1.0,
            panX: 0,
            panY: 0,
          },
        });
        outputCursor += dur;
        clipIdx++;
      }
      // Skip the removed segment
      cursor = removed.endSec;
    }

    // Remaining after last removed segment
    if (cursor < effectiveEnd) {
      const dur = effectiveEnd - cursor;
      mainItems.push({
        id: `main-${clipIdx}`,
        type: "video-clip",
        trackType: "main",
        startSec: outputCursor,
        endSec: outputCursor + dur,
        durationSec: dur,
        metadata: {
          sourceStartSec: cursor,
          sourceEndSec: effectiveEnd,
          removed: false,
          zoomLevel: 1.0,
          panX: 0,
          panY: 0,
        },
      });
    }
  }

  // Apply zoom from preset
  const presetConfig = SMART_PRESETS.find(p => p.id === ws.preset);
  if (presetConfig?.zoomBehavior?.enabled) {
    for (const item of mainItems) {
      item.metadata.zoomLevel = presetConfig.zoomBehavior.onSpeech;
    }
  }

  tracks.push({
    id: "track-main",
    type: "main",
    label: "Main Video",
    items: mainItems,
    muted: false,
    visible: true,
  });

  // ─── B-Roll Track ───
  const brollItems: BrollClipItem[] = [];
  if (ws.brollEnabled && ws.brollPlacements.length > 0) {
    for (const placement of ws.brollPlacements) {
      // Adjust timing relative to output timeline (account for removed segments)
      const adjustedStart = adjustTimeForRemovals(placement.startSec - effectiveStart, removedSegments, effectiveStart);
      const adjustedEnd = adjustTimeForRemovals(placement.endSec - effectiveStart, removedSegments, effectiveStart);

      brollItems.push({
        id: placement.id,
        type: "broll-clip",
        trackType: "broll",
        startSec: adjustedStart,
        endSec: adjustedEnd,
        durationSec: adjustedEnd - adjustedStart,
        metadata: {
          keyword: placement.keyword,
          source: placement.source,
          mediaUrl: resolveBrollMediaUrl(placement.keyword, placement.source, ws.videoUrl),
          transitionIn: ws.transitionStyle,
          transitionOut: ws.transitionStyle,
          transitionDurationMs: getTransitionDuration(ws.transitionStyle),
          opacity: 1.0,
        },
      });
    }
  }

  tracks.push({
    id: "track-broll",
    type: "broll",
    label: "B-Roll",
    items: brollItems,
    muted: false,
    visible: ws.brollEnabled,
  });

  // ─── Subtitle Track ───
  const subtitleItems: SubtitleItem[] = ws.segments.map((seg, i) => {
    const adjustedStart = adjustTimeForRemovals(seg.startSec - effectiveStart, removedSegments, effectiveStart);
    const adjustedEnd = adjustTimeForRemovals(seg.endSec - effectiveStart, removedSegments, effectiveStart);

    return {
      id: `sub-${seg.id}`,
      type: "subtitle" as const,
      trackType: "subtitle" as const,
      startSec: Math.max(0, adjustedStart),
      endSec: adjustedEnd,
      durationSec: adjustedEnd - adjustedStart,
      metadata: {
        text: seg.text,
        highlightWord: seg.highlightWord || "",
        highlightStyle: seg.highlightStyle || "color",
        segmentIndex: i,
        isEdited: seg.edited,
        confidence: seg.confidence || 0.9,
      },
    };
  }).filter(s => s.durationSec > 0);

  tracks.push({
    id: "track-subtitles",
    type: "subtitle",
    label: "Subtitles",
    items: subtitleItems,
    muted: false,
    visible: true,
  });

  // ─── Audio Track ───
  const audioItems: MusicItem[] = [];
  const finalDuration = mainItems.reduce((sum, item) => {
    const clip = item as VideoClipItem;
    return clip.metadata.removed ? sum : sum + clip.durationSec;
  }, 0);

  if (ws.musicEnabled && ws.musicTrackId) {
    audioItems.push({
      id: "music-bg",
      type: "music",
      trackType: "audio",
      startSec: 0,
      endSec: finalDuration,
      durationSec: finalDuration,
      metadata: {
        trackId: ws.musicTrackId,
        trackTitle: ws.musicTrackTitle || "",
        trackUrl: ws.musicTrackUrl || resolveMusicUrl(ws.musicTrackId),
        volume: ws.musicVolume,
        duckingEnabled: ws.musicDucking,
        duckingLevel: ws.musicDuckingLevel,
        fadeInSec: 1.5,
        fadeOutSec: 2.0,
      },
    });
  }

  tracks.push({
    id: "track-audio",
    type: "audio",
    label: "Music & Audio",
    items: audioItems,
    muted: !ws.musicEnabled,
    visible: ws.musicEnabled,
  });

  // ─── Transition Track ───
  const transitionItems: TransitionEventItem[] = [];

  // Add transitions between main clips
  for (let i = 0; i < mainItems.length - 1; i++) {
    const fromClip = mainItems[i];
    const toClip = mainItems[i + 1];
    const transDurMs = getTransitionDuration(ws.transitionStyle);
    const transDurSec = transDurMs / 1000;

    transitionItems.push({
      id: `trans-main-${i}`,
      type: "transition-event",
      trackType: "transition",
      startSec: fromClip.endSec - transDurSec / 2,
      endSec: toClip.startSec + transDurSec / 2,
      durationSec: transDurSec,
      metadata: {
        style: ws.transitionStyle,
        durationMs: transDurMs,
        fromClipId: fromClip.id,
        toClipId: toClip.id,
      },
    });
  }

  // Add transitions around B-roll clips
  for (const broll of brollItems) {
    const transDurMs = getTransitionDuration(ws.transitionStyle);
    const transDurSec = transDurMs / 1000;

    transitionItems.push({
      id: `trans-broll-in-${broll.id}`,
      type: "transition-event",
      trackType: "transition",
      startSec: broll.startSec,
      endSec: broll.startSec + transDurSec,
      durationSec: transDurSec,
      metadata: {
        style: ws.transitionStyle,
        durationMs: transDurMs,
        fromClipId: "main",
        toClipId: broll.id,
      },
    });

    transitionItems.push({
      id: `trans-broll-out-${broll.id}`,
      type: "transition-event",
      trackType: "transition",
      startSec: broll.endSec - transDurSec,
      endSec: broll.endSec,
      durationSec: transDurSec,
      metadata: {
        style: ws.transitionStyle,
        durationMs: transDurMs,
        fromClipId: broll.id,
        toClipId: "main",
      },
    });
  }

  tracks.push({
    id: "track-transitions",
    type: "transition",
    label: "Transitions",
    items: transitionItems,
    muted: false,
    visible: true,
  });

  return {
    id: `timeline-${ws.projectId}`,
    projectId: ws.projectId,
    durationSec: finalDuration,
    fps: FPS,
    tracks,
    createdAt: new Date().toISOString(),
    version: "2.0",
  };
}

/* ── Helper: adjust time accounting for removed segments ── */
function adjustTimeForRemovals(
  originalTime: number,
  removedSegments: { startSec: number; endSec: number; removed: boolean }[],
  offset: number
): number {
  let adjustment = 0;
  for (const seg of removedSegments) {
    const segStart = seg.startSec - offset;
    const segEnd = seg.endSec - offset;
    if (segStart < originalTime) {
      const overlap = Math.min(segEnd, originalTime) - segStart;
      adjustment += Math.max(0, overlap);
    }
  }
  return Math.max(0, originalTime - adjustment);
}

/* ── Helper: get transition duration from style ── */
function getTransitionDuration(style: string): number {
  const durations: Record<string, number> = {
    cut: 0,
    fade: 500,
    zoom: 400,
    motionBlur: 300,
    premiumSlide: 600,
    punchyCut: 150,
    cinematicDissolve: 800,
  };
  return durations[style] ?? 500;
}

/* ── Build finalCompositionData from wizard snapshot ── */
export function buildFinalCompositionData(ws: WizardSnapshot): FinalCompositionData {
  const timeline = buildTimeline(ws);
  const presetConfig = SMART_PRESETS.find(p => p.id === ws.preset) || null;
  const dims = FORMAT_DIMENSIONS[ws.format] || FORMAT_DIMENSIONS["9:16"];
  const qualityPreset = QUALITY_PRESETS[ws.exportQuality || "premium"];

  const effectiveDuration = ws.trimMode === "clip"
    ? ws.trimEnd - ws.trimStart
    : ws.videoDurationSec;

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
    manualY: ws.subtitleManualY,
    animation: ws.subtitleAnimation as SubtitleStyle["animation"],
    lineBreak: ws.subtitleLineBreak,
    highlightMode: ws.highlightMode,
    highlightIntensity: ws.highlightIntensity,
  };

  return {
    version: "2.0",
    projectId: ws.projectId,
    title: ws.title,
    createdAt: new Date().toISOString(),

    timeline,

    source: {
      videoUrl: ws.videoUrl,
      fileName: ws.videoFileName,
      originalDurationSec: ws.videoDurationSec,
      trimMode: ws.trimMode,
      trimStart: ws.trimStart,
      trimEnd: ws.trimEnd,
      effectiveDurationSec: effectiveDuration,
    },

    output: {
      format: ws.format,
      width: dims.width,
      height: dims.height,
      fps: FPS,
      quality: ws.exportQuality || "premium",
      codec: "h264",
    },

    subtitles: {
      mode: ws.subtitleMode,
      language: ws.language,
      style: subtitleStyle,
      maxWordsPerLine: 2,
      maxLines: 2,
    },

    transition: {
      style: ws.transitionStyle || "fade",
      durationMs: getTransitionDuration(ws.transitionStyle || "fade"),
      applyToSceneChanges: true,
      applyToBroll: ws.brollEnabled,
    },

    audio: {
      sourceAudioEnabled: true,
      music: {
        enabled: ws.musicEnabled,
        trackId: ws.musicTrackId,
        trackTitle: ws.musicTrackTitle || "",
        trackUrl: ws.musicTrackUrl || resolveMusicUrl(ws.musicTrackId),
        volume: ws.musicVolume,
        ducking: ws.musicDucking,
        duckingLevel: ws.musicDuckingLevel,
        fadeInSec: 1.5,
        fadeOutSec: 2.0,
      },
      soundDesign: {
        enabled: ws.soundDesignEnabled,
        sfxOnCuts: ws.sfxOnCuts,
        sfxStyle: ws.sfxStyle,
      },
    },

    visual: {
      preset: presetConfig,
      colorGrading: presetConfig?.colorGrading || (ws.premiumMode ? "warm" : "neutral"),
      // Enable zoom when premium is on even without a preset — gives default subtle zoom
      zoomEnabled: presetConfig?.zoomBehavior?.enabled ?? (ws.premiumMode && ws.premiumLevel !== "standard"),
      zoomOnSpeech: presetConfig?.zoomBehavior?.onSpeech ?? (ws.premiumMode ? (ws.premiumLevel === "cinematic" ? 1.12 : 1.06) : 1.0),
      zoomOnTransition: presetConfig?.zoomBehavior?.onTransition ?? (ws.premiumMode ? (ws.premiumLevel === "cinematic" ? 1.15 : 1.08) : 1.0),
      framingEnabled: true,
      cropForVertical: ws.format === "9:16",
    },

    premium: {
      enabled: ws.premiumMode !== false,
      level: ws.premiumLevel || "premium",
      smartPacing: true,
      audioLayering: ws.musicEnabled,
      visualStructure: true,
      brollEnhancement: ws.brollEnabled,
      subtitleEnhancement: true,
      // Motion effects: Ken Burns drift + clip transition pulse + breathing
      motionEffects: ws.premiumMode !== false && ws.premiumLevel !== "standard",
      // Color correction: grading + vignette + film grain
      colorCorrection: ws.premiumMode !== false,
      autoFill: ws.premiumMode !== false,
    },

    brand: {
      clientId: ws.clientId,
      clientName: ws.clientName,
      primaryColor: "#00B5FE",
    },

    ai: {
      editMode: ws.aiEditMode,
      directionNotes: ws.aiDirectionNotes,
      creativePrompt: ws.creativePrompt,
    },

    metadata: {
      segmentCount: ws.segments.length,
      brollPlacementCount: ws.brollPlacements.length,
      cleanupRemovedCount: ws.cleanupRemovedSegments.filter(s => s.removed).length,
      estimatedRenderDurationSec: timeline.durationSec,
      language: ws.language,
    },

    // Edit engine — defaults (populated by unified coordinator when active)
    editEngine: {
      zoomKeyframes: [],
      pacingSegments: [],
      hook: null,
      retentionCurve: [],
      profile: null,
      overallEditScore: 0,
    },
  };
}
