'use client';

import React, { useMemo, useRef, useCallback, useEffect } from 'react';
import { Player, type PlayerRef } from '@remotion/player';
import { PixelManageEdit } from '@/remotion/PixelManageEdit';
import { FPS, FORMAT_DIMENSIONS } from '@/remotion/types';
import type { VideoEditProject } from '@/lib/video-editor/types';

interface RenderPreviewPanelProps {
  project: VideoEditProject;
  currentTime: number;
  /** Optional format override (defaults to 9:16) */
  format?: '9:16' | '16:9' | '1:1' | '4:5';
  /** Called when Player playhead position changes */
  onTimeUpdate?: (seconds: number) => void;
}

/**
 * RenderPreviewPanel Component
 * Live Remotion Player preview of the current video edit project.
 * Replaces static thumbnail with real-time rendered composition.
 */
const RenderPreviewPanel = React.memo(function RenderPreviewPanel({
  project,
  currentTime,
  format = '9:16',
  onTimeUpdate,
}: RenderPreviewPanelProps) {
  const playerRef = useRef<PlayerRef>(null);

  // Build Remotion composition props from VideoEditProject
  const compositionProps = useMemo(() => {
    if (project.clips.length === 0) return null;

    // Map clips to segments for the composition
    const segments = project.clips.map((clip) => ({
      id: clip.id,
      startSec: clip.start,
      endSec: clip.end,
      text: '',
      highlightWord: '',
      highlightStyle: 'color' as const,
    }));

    // Map captions to subtitle segments
    const subtitleSegments = project.captions.map((cap) => {
      // Extract first emphasis word from indices
      const words = cap.text.split(' ');
      const highlightWord = cap.emphasisWords.length > 0
        ? words[cap.emphasisWords[0]] || ''
        : '';
      return {
        id: cap.id || `cap-${cap.startTime}`,
        startSec: cap.startTime,
        endSec: cap.endTime,
        text: cap.text,
        highlightWord,
        highlightStyle: 'color' as const,
      };
    });

    return {
      videoUrl: project.clips[0]?.sourceUrl || '',
      trimStart: project.clips[0]?.trimStart || 0,
      trimEnd: project.clips[0]?.trimEnd || project.totalDuration,
      format,
      segments: subtitleSegments.length > 0 ? subtitleSegments : segments,
      subtitleStyle: {
        font: 'Heebo',
        fontWeight: 700,
        fontSize: 44,
        color: '#FFFFFF',
        highlightColor: '#39E508',
        outlineEnabled: true,
        outlineColor: '#000000',
        outlineThickness: 2,
        shadow: false,
        bgEnabled: false,
        bgColor: '#000000',
        bgOpacity: 0.7,
        align: 'center' as const,
        position: 'bottom' as const,
        animation: 'fade',
        lineBreak: 'auto' as const,
      },
      brollPlacements: [],
      transition: { style: 'fade', durationMs: 500 },
      music: {
        enabled: false,
        trackUrl: '',
        volume: 0.3,
        ducking: false,
        duckingLevel: 0.2,
        fadeInSec: 1,
        fadeOutSec: 1,
      },
      cleanupCuts: [],
      visual: {
        colorGrading: 'none',
        zoomEnabled: false,
        zoomOnSpeech: 1.0,
        zoomOnTransition: 1.0,
        cropForVertical: false,
      },
      premium: {
        enabled: false,
        level: 'standard' as const,
        motionEffects: false,
        colorCorrection: false,
      },
      durationSec: project.totalDuration,
      presetId: 'modern',
    };
  }, [project.clips, project.captions, format]);

  // Calculate duration in frames
  const durationInFrames = useMemo(() => {
    return Math.max(Math.ceil(project.totalDuration * FPS), 1);
  }, [project.totalDuration]);

  // Get dimensions from format
  const dimensions = FORMAT_DIMENSIONS[format] || FORMAT_DIMENSIONS['9:16'];

  // Sync external currentTime to Player
  useEffect(() => {
    if (playerRef.current && currentTime >= 0) {
      const frame = Math.round(currentTime * FPS);
      playerRef.current.seekTo(frame);
    }
  }, [currentTime]);

  // Handle Player time updates
  const handleTimeUpdate = useCallback(
    (e: { detail: { frame: number } }) => {
      if (onTimeUpdate) {
        onTimeUpdate(e.detail.frame / FPS);
      }
    },
    [onTimeUpdate]
  );

  // Get applied effects for current clip
  const currentClip = useMemo(() => {
    return project.clips.find((clip) => currentTime >= clip.start && currentTime < clip.end);
  }, [project.clips, currentTime]);

  const appliedEffects = useMemo(() => {
    if (!currentClip) return [];
    const effects: { type: string; name: string }[] = [];

    const transition = project.transitions.find((t) => t.fromClipId === currentClip.id);
    if (transition) effects.push({ type: 'transition', name: transition.type });

    const motion = project.motions.find((m) => m.clipId === currentClip.id);
    if (motion) effects.push({ type: 'motion', name: motion.type });

    const captions = project.captions.filter(
      (c) => c.startTime >= currentClip.start && c.endTime <= currentClip.end
    );
    if (captions.length > 0) effects.push({ type: 'captions', name: `${captions.length} כתוביות` });

    return effects;
  }, [currentClip, project.transitions, project.motions, project.captions]);

  // Format time display
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="ved-editor-preview" style={{ direction: 'rtl' }}>
      {compositionProps ? (
        <>
          {/* Live Remotion Player */}
          <div
            className="ved-preview-thumbnail"
            style={{ position: 'relative', overflow: 'hidden', borderRadius: 8 }}
          >
            <Player
              ref={playerRef}
              component={PixelManageEdit}
              inputProps={compositionProps}
              durationInFrames={durationInFrames}
              compositionWidth={dimensions.width}
              compositionHeight={dimensions.height}
              fps={FPS}
              style={{
                width: '100%',
                aspectRatio: `${dimensions.width} / ${dimensions.height}`,
              }}
              controls
              showVolumeControls
              clickToPlay
            />

            {/* Applied Effects Badges */}
            {appliedEffects.length > 0 && (
              <div
                className="ved-effects-badges"
                style={{
                  position: 'absolute',
                  top: 8,
                  right: 8,
                  display: 'flex',
                  gap: 4,
                  flexWrap: 'wrap',
                }}
              >
                {appliedEffects.map((effect, idx) => (
                  <span key={idx} className="ved-effect-badge">
                    {effect.name}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Time Info */}
          <div className="ved-preview-time">
            <span>{formatTime(currentTime)}</span>
            <span className="ved-separator">/</span>
            <span>{formatTime(project.totalDuration)}</span>
          </div>
        </>
      ) : (
        /* Empty State */
        <div className="ved-preview-empty">
          <div className="ved-empty-icon">📹</div>
          <div className="ved-empty-text">הוסף קליפים לתצוגה מקדימה</div>
        </div>
      )}
    </div>
  );
});

export default RenderPreviewPanel;
