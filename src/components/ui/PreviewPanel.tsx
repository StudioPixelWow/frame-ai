"use client";

import { useRef, useState, useMemo, useCallback, useEffect } from "react";
import { Player, type PlayerRef } from "@remotion/player";
import { PixelManageEdit } from "@/remotion/PixelManageEdit";
import { FPS, FORMAT_DIMENSIONS } from "@/remotion/types";
import type { CompositionProps } from "@/remotion/types";
import {
  buildFinalCompositionData,
  type WizardSnapshot,
} from "@/lib/video-engine/composition-data";
import { compositionToProps } from "@/lib/video-engine/composition-to-props";
import { FormatFrame } from "@/components/ui/FormatFrame";

/* ═══════════════════════════════════════════════════════════════════════════
   PreviewPanel — Persistent Video Preview for PixelManageAI
   Displays a Remotion composition preview with timeline scrub markers,
   active layers indicator, and optional debug overlay.
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Minimal WizardData interface — compatible with the wizard state
 * Only includes fields needed to build WizardSnapshot
 */
export interface PreviewWizardData {
  projectId: string;
  title: string;
  clientId: string;
  clientName: string;
  creativePrompt: string;

  // Source
  videoUrl: string;
  uploadedVideoUrl: string;
  videoFileName?: string;
  videoDurationSec: number;
  trimMode: "full" | "clip";
  trimStart: number;
  trimEnd: number;
  format: "9:16" | "16:9" | "1:1" | "4:5";

  // Subtitles
  subtitleMode: "auto" | "manual";
  language: string;
  segments: Array<{
    id: string;
    startSec: number;
    endSec: number;
    text: string;
    edited: boolean;
    highlightWord: string;
    highlightStyle: string;
    confidence?: number;
  }>;
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

  // B-roll
  brollEnabled: boolean;
  brollStyle: "stock" | "ai" | "none";
  brollPlacements: Array<{
    id: string;
    startSec: number;
    endSec: number;
    keyword: string;
    source: "stock" | "ai";
  }>;

  // Transitions
  transitionStyle:
    | "cut"
    | "fade"
    | "zoom"
    | "motionBlur"
    | "premiumSlide"
    | "punchyCut"
    | "cinematicDissolve";

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
  cleanupRemovedSegments: Array<{
    id: string;
    startSec: number;
    endSec: number;
    type: "filler" | "silence";
    label: string;
    removed: boolean;
  }>;

  // AI & Presets
  preset: string;
  exportQuality: "standard" | "premium" | "max";
  aiEditMode: string;
  aiDirectionNotes: string;

  // Premium
  premiumMode: boolean;
  premiumLevel: "standard" | "premium" | "cinematic";
}

export interface PreviewPanelProps {
  /** Wizard state containing all composition parameters */
  data: PreviewWizardData;
  /** Whether the panel should be visible */
  visible: boolean;
  /** Smaller mode for steps that have their own preview */
  compact?: boolean;
  /** Show timeline scrub bar with markers */
  showTimeline?: boolean;
  /** Show debug overlay with edit state info */
  showDebug?: boolean;
  /** Max width override (default: format-dependent) */
  maxWidth?: number;
}

/**
 * Hash-based edit state version
 * Quick fingerprint of composition data for debug display
 */
function getEditStateVersion(data: PreviewWizardData): string {
  const key = `${data.projectId}|${data.segments.length}|${data.brollPlacements.length}|${data.cleanupRemovedSegments.filter(s => s.removed).length}`;
  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    const char = key.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return `v${Math.abs(hash).toString(16).substring(0, 6)}`;
}

/**
 * Count active layers in the composition
 */
function countActiveLayers(data: PreviewWizardData): number {
  let count = 0;
  if (data.segments.length > 0) count++; // subtitles
  if (data.brollEnabled && data.brollPlacements.length > 0) count++; // B-roll
  if (data.transitionStyle !== "cut") count++; // transitions
  if (data.musicEnabled) count++; // music
  if (data.premiumMode) count++; // premium effects
  return count;
}

/**
 * Convert PreviewWizardData to WizardSnapshot for composition builder
 */
function toWizardSnapshot(data: PreviewWizardData): WizardSnapshot {
  return {
    projectId: data.projectId,
    title: data.title,
    clientId: data.clientId,
    clientName: data.clientName,
    creativePrompt: data.creativePrompt,

    videoUrl: data.uploadedVideoUrl || data.videoUrl,
    videoFileName: data.videoFileName || "video.mp4",
    videoDurationSec: data.videoDurationSec,
    trimMode: data.trimMode,
    trimStart: data.trimStart,
    trimEnd: data.trimEnd,
    format: data.format,

    subtitleMode: data.subtitleMode,
    language: data.language,
    segments: data.segments,
    subtitleFont: data.subtitleFont,
    subtitleFontWeight: data.subtitleFontWeight,
    subtitleFontSize: data.subtitleFontSize,
    subtitleColor: data.subtitleColor,
    subtitleHighlightColor: data.subtitleHighlightColor,
    subtitleOutlineEnabled: data.subtitleOutlineEnabled,
    subtitleOutlineColor: data.subtitleOutlineColor,
    subtitleOutlineThickness: data.subtitleOutlineThickness,
    subtitleShadow: data.subtitleShadow,
    subtitleBg: data.subtitleBg,
    subtitleBgColor: data.subtitleBgColor,
    subtitleBgOpacity: data.subtitleBgOpacity,
    subtitleAlign: data.subtitleAlign,
    subtitlePosition: data.subtitlePosition,
    subtitleManualY: data.subtitleManualY,
    subtitleAnimation: data.subtitleAnimation,
    subtitleLineBreak: data.subtitleLineBreak,

    brollEnabled: data.brollEnabled,
    brollStyle: data.brollStyle,
    brollPlacements: data.brollPlacements,

    transitionStyle: data.transitionStyle,

    musicEnabled: data.musicEnabled,
    musicTrackId: data.musicTrackId,
    musicTrackTitle: data.musicTrackTitle,
    musicTrackUrl: data.musicTrackUrl,
    musicVolume: data.musicVolume,
    musicDucking: data.musicDucking,
    musicDuckingLevel: data.musicDuckingLevel,

    soundDesignEnabled: data.soundDesignEnabled,
    sfxOnCuts: data.sfxOnCuts,
    sfxStyle: data.sfxStyle,

    cleanupFillers: data.cleanupFillers,
    cleanupSilence: data.cleanupSilence,
    cleanupIntensity: data.cleanupIntensity,
    cleanupRemovedSegments: data.cleanupRemovedSegments,

    preset: data.preset,
    exportQuality: data.exportQuality,
    aiEditMode: data.aiEditMode,
    aiDirectionNotes: data.aiDirectionNotes,

    premiumMode: data.premiumMode,
    premiumLevel: data.premiumLevel,
  };
}

/**
 * PreviewPanel Component
 */
export function PreviewPanel({
  data,
  visible,
  compact = false,
  showTimeline = true,
  showDebug = false,
  maxWidth,
}: PreviewPanelProps) {
  const playerRef = useRef<PlayerRef>(null);
  const [playheadPosition, setPlayheadPosition] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [lastChangeTime] = useState(new Date());

  // Build composition data
  const snapshot = useMemo(() => toWizardSnapshot(data), [data]);
  const compositionData = useMemo(
    () => buildFinalCompositionData(snapshot),
    [snapshot]
  );
  const remotionProps = useMemo(
    () => compositionToProps(compositionData),
    [compositionData]
  );

  // Duration & dimensions
  const durationSec = compositionData.timeline.durationSec;
  const dims = FORMAT_DIMENSIONS[data.format] || FORMAT_DIMENSIONS["9:16"];

  // Derived data for display
  const editVersion = useMemo(() => getEditStateVersion(data), [data]);
  const activeLayers = useMemo(() => countActiveLayers(data), [data]);
  const subtitleSegments = compositionData.timeline.tracks.find(
    t => t.type === "subtitle"
  )?.items || [];
  const brollSegments = compositionData.timeline.tracks.find(
    t => t.type === "broll"
  )?.items || [];
  const musicSegments = compositionData.timeline.tracks.find(
    t => t.type === "audio"
  )?.items || [];
  const cleanupSegments = data.cleanupRemovedSegments.filter(s => s.removed);

  // Handle playhead update
  const handlePlayheadChange = useCallback((frame: number) => {
    const position = frame / FPS;
    setPlayheadPosition(position);
  }, []);

  if (!visible) return null;

  const containerClass = compact
    ? "preview-panel-compact"
    : "preview-panel-full";

  return (
    <div className={`preview-panel ${containerClass}`}>
      {/* Main preview container — plain <video> for stability */}
      <div className="preview-panel-content">
        <FormatFrame
          format={data.format}
          videoSrc={data.uploadedVideoUrl || data.videoUrl || ""}
          mode="simple"
          controls
          muted
          loop
          maxWidth={maxWidth}
          showFormatBadge={true}
        />
      </div>

      {/* Timeline scrub bar with markers */}
      {showTimeline && (
        <div className="preview-panel-timeline">
          <div className="timeline-scrub-bar">
            {/* Subtitle markers (blue) */}
            {subtitleSegments.map((segment: any) => (
              <div
                key={`sub-marker-${segment.id}`}
                className="timeline-marker timeline-marker-subtitle"
                style={{
                  left: `${(segment.startSec / durationSec) * 100}%`,
                  width: `${((segment.endSec - segment.startSec) / durationSec) * 100}%`,
                }}
                title={`כתוביות: ${segment.metadata?.text || ""}`}
              />
            ))}

            {/* B-roll markers (green) */}
            {brollSegments.map((segment: any) => (
              <div
                key={`broll-marker-${segment.id}`}
                className="timeline-marker timeline-marker-broll"
                style={{
                  left: `${(segment.startSec / durationSec) * 100}%`,
                  width: `${((segment.endSec - segment.startSec) / durationSec) * 100}%`,
                }}
                title={`B-Roll: ${segment.metadata?.keyword || ""}`}
              />
            ))}

            {/* Cleanup cut markers (red) */}
            {cleanupSegments.map((segment) => (
              <div
                key={`cleanup-marker-${segment.id}`}
                className="timeline-marker timeline-marker-cleanup"
                style={{
                  left: `${(segment.startSec / durationSec) * 100}%`,
                  width: `${((segment.endSec - segment.startSec) / durationSec) * 100}%`,
                }}
                title={`ניקוי: ${segment.label}`}
              />
            ))}

            {/* Music track bar (purple) */}
            {musicSegments.length > 0 &&
              musicSegments.map((segment: any) => (
                <div
                  key={`music-marker-${segment.id}`}
                  className="timeline-marker timeline-marker-music"
                  style={{
                    left: `${(segment.startSec / durationSec) * 100}%`,
                    width: `${((segment.endSec - segment.startSec) / durationSec) * 100}%`,
                  }}
                  title={`מוזיקה: ${segment.metadata?.trackTitle || ""}`}
                />
              ))}

            {/* Playhead position indicator */}
            <div
              className="timeline-playhead"
              style={{
                left: `${(playheadPosition / durationSec) * 100}%`,
              }}
            />
          </div>

          {/* Timeline labels */}
          <div className="timeline-labels">
            <span className="timeline-label-item timeline-label-subtitle">
              ● כתוביות
            </span>
            <span className="timeline-label-item timeline-label-broll">
              ● B-Roll
            </span>
            <span className="timeline-label-item timeline-label-cleanup">
              ● ניקוי
            </span>
            <span className="timeline-label-item timeline-label-music">
              ● מוזיקה
            </span>
          </div>
        </div>
      )}

      {/* Active layers pill bar */}
      <div className="preview-panel-layers">
        <div className="layers-label">שכבות פעילות:</div>
        <div className="layers-pills">
          {data.segments.length > 0 && (
            <span className="layer-pill layer-pill-subtitle">כתוביות</span>
          )}
          {data.brollEnabled && data.brollPlacements.length > 0 && (
            <span className="layer-pill layer-pill-broll">B-Roll</span>
          )}
          {data.transitionStyle !== "cut" && (
            <span className="layer-pill layer-pill-transition">מעברים</span>
          )}
          {data.musicEnabled && (
            <span className="layer-pill layer-pill-music">מוזיקה</span>
          )}
          {data.premiumMode && (
            <span className="layer-pill layer-pill-premium">פרימיום</span>
          )}
        </div>
      </div>

      {/* Debug overlay */}
      {showDebug && (
        <div className="preview-panel-debug">
          <div className="debug-header">מידע ניפוי</div>
          <div className="debug-content">
            <div className="debug-row">
              <span className="debug-label">שלב:</span>
              <span className="debug-value">{data.title}</span>
            </div>
            <div className="debug-row">
              <span className="debug-label">גרסת עריכה:</span>
              <span className="debug-value">{editVersion}</span>
            </div>
            <div className="debug-row">
              <span className="debug-label">שכבות פעילות:</span>
              <span className="debug-value">{activeLayers}</span>
            </div>
            <div className="debug-row">
              <span className="debug-label">שינוי אחרון:</span>
              <span className="debug-value">
                {lastChangeTime.toLocaleTimeString("he-IL")}
              </span>
            </div>
            <div className="debug-row">
              <span className="debug-label">משך:</span>
              <span className="debug-value">
                {durationSec.toFixed(2)}s @ {FPS}fps
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Styles scoped to PreviewPanel */}
      <style jsx>{`
        .preview-panel {
          display: flex;
          flex-direction: column;
          gap: 1rem;
          padding: 1rem;
          background: var(--bg-secondary, #1a1a2e);
          border-radius: 12px;
          border: 1px solid var(--border);
          direction: rtl;
          font-family: "Assistant", -apple-system, BlinkMacSystemFont, "Segoe UI",
            sans-serif;
        }

        .preview-panel.preview-panel-compact {
          max-width: 320px;
        }

        .preview-panel.preview-panel-full {
          max-width: 100%;
        }

        .preview-panel-content {
          display: flex;
          justify-content: center;
          align-items: center;
          min-height: 300px;
          background: #000;
          border-radius: 8px;
          overflow: hidden;
        }

        /* Timeline styles */
        .preview-panel-timeline {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }

        .timeline-scrub-bar {
          position: relative;
          height: 40px;
          background: #0f0f1e;
          border-radius: 6px;
          border: 1px solid var(--border);
          overflow: hidden;
        }

        .timeline-marker {
          position: absolute;
          top: 0;
          height: 100%;
          opacity: 0.7;
          border-right: 1px solid rgba(255, 255, 255, 0.2);
        }

        .timeline-marker-subtitle {
          background: rgba(59, 130, 246, 0.3);
        }

        .timeline-marker-broll {
          background: rgba(34, 197, 94, 0.3);
        }

        .timeline-marker-cleanup {
          background: rgba(239, 68, 68, 0.3);
        }

        .timeline-marker-music {
          background: rgba(168, 85, 247, 0.3);
        }

        .timeline-playhead {
          position: absolute;
          top: 0;
          width: 2px;
          height: 100%;
          background: #00d9ff;
          box-shadow: 0 0 8px rgba(0, 217, 255, 0.6);
          z-index: 10;
        }

        .timeline-labels {
          display: flex;
          gap: 1.5rem;
          font-size: 0.75rem;
          color: rgba(255, 255, 255, 0.7);
          flex-wrap: wrap;
        }

        .timeline-label-item {
          display: inline-flex;
          align-items: center;
          gap: 0.5rem;
        }

        .timeline-label-subtitle {
          color: #3b82f6;
        }

        .timeline-label-broll {
          color: #22c55e;
        }

        .timeline-label-cleanup {
          color: #ef4444;
        }

        .timeline-label-music {
          color: #a855f7;
        }

        /* Layers pill bar */
        .preview-panel-layers {
          display: flex;
          align-items: center;
          gap: 1rem;
          padding: 0.75rem;
          background: rgba(0, 217, 255, 0.05);
          border-radius: 8px;
          border: 1px solid rgba(0, 217, 255, 0.2);
          flex-wrap: wrap;
        }

        .layers-label {
          font-size: 0.85rem;
          color: rgba(255, 255, 255, 0.7);
          font-weight: 600;
        }

        .layers-pills {
          display: flex;
          gap: 0.5rem;
          flex-wrap: wrap;
        }

        .layer-pill {
          display: inline-block;
          padding: 0.35rem 0.75rem;
          border-radius: 16px;
          font-size: 0.75rem;
          font-weight: 600;
          color: #fff;
          background: rgba(255, 255, 255, 0.1);
        }

        .layer-pill-subtitle {
          background: rgba(59, 130, 246, 0.4);
          border: 1px solid rgba(59, 130, 246, 0.6);
        }

        .layer-pill-broll {
          background: rgba(34, 197, 94, 0.4);
          border: 1px solid rgba(34, 197, 94, 0.6);
        }

        .layer-pill-transition {
          background: rgba(245, 158, 11, 0.4);
          border: 1px solid rgba(245, 158, 11, 0.6);
        }

        .layer-pill-music {
          background: rgba(168, 85, 247, 0.4);
          border: 1px solid rgba(168, 85, 247, 0.6);
        }

        .layer-pill-premium {
          background: rgba(0, 217, 255, 0.4);
          border: 1px solid rgba(0, 217, 255, 0.6);
        }

        /* Debug overlay */
        .preview-panel-debug {
          padding: 1rem;
          background: rgba(0, 0, 0, 0.4);
          border-radius: 8px;
          border: 1px solid rgba(255, 165, 0, 0.3);
          font-family: "Courier New", monospace;
          font-size: 0.75rem;
        }

        .debug-header {
          font-weight: 700;
          color: #ffa500;
          margin-bottom: 0.75rem;
        }

        .debug-content {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }

        .debug-row {
          display: flex;
          justify-content: space-between;
          gap: 1rem;
          color: rgba(255, 255, 255, 0.8);
        }

        .debug-label {
          color: rgba(255, 255, 255, 0.6);
          min-width: 120px;
        }

        .debug-value {
          color: #00d9ff;
          font-weight: 600;
          text-align: left;
        }
      `}</style>
    </div>
  );
}
