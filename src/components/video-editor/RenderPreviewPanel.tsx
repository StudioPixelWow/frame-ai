'use client';

import React, { useMemo } from 'react';
import type { VideoEditProject } from '@/lib/video-editor/types';

interface RenderPreviewPanelProps {
  project: VideoEditProject;
  currentTime: number;
}

/**
 * RenderPreviewPanel Component
 * Visual preview of current clip and applied effects
 */
const RenderPreviewPanel = React.memo(function RenderPreviewPanel({
  project,
  currentTime,
}: RenderPreviewPanelProps) {
  // Find current clip based on time
  const currentClip = useMemo(() => {
    return project.clips.find((clip) => currentTime >= clip.start && currentTime < clip.end);
  }, [project.clips, currentTime]);

  // Get applied effects for current clip
  const appliedEffects = useMemo(() => {
    if (!currentClip) return [];

    const effects = [];

    // Check for transitions
    const transition = project.transitions.find((t) => t.fromClipId === currentClip.id);
    if (transition) {
      effects.push({ type: 'transition', name: transition.type });
    }

    // Check for motion effects
    const motion = project.motions.find((m) => m.clipId === currentClip.id);
    if (motion) {
      effects.push({ type: 'motion', name: motion.type });
    }

    // Check for captions
    const captions = project.captions.filter(
      (c) => c.startTime >= currentClip.start && c.endTime <= currentClip.end
    );
    if (captions.length > 0) {
      effects.push({ type: 'captions', name: `${captions.length} כתוביות` });
    }

    return effects;
  }, [currentClip, project.transitions, project.motions, project.captions]);

  // Calculate progress
  const progressPercent = project.totalDuration > 0 ? (currentTime / project.totalDuration) * 100 : 0;

  // Format time display
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="ved-editor-preview">
      {currentClip ? (
        <>
          {/* Thumbnail Area */}
          <div className="ved-preview-thumbnail">
            <img
              src={currentClip.thumbnailUrl}
              alt={currentClip.label}
              className="ved-thumbnail-image"
            />

            {/* Overlay Info */}
            <div className="ved-preview-overlay">
              <div className="ved-clip-label">{currentClip.label}</div>

              {/* Applied Effects Badges */}
              {appliedEffects.length > 0 && (
                <div className="ved-effects-badges">
                  {appliedEffects.map((effect, idx) => (
                    <span key={idx} className="ved-effect-badge">
                      {effect.name}
                    </span>
                  ))}
                </div>
              )}
            </div>
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

      {/* Progress Bar */}
      <div className="ved-preview-progress">
        <div
          className="ved-progress-bar"
          style={{ width: `${progressPercent}%` }}
          role="progressbar"
          aria-valuenow={Math.round(progressPercent)}
          aria-valuemin={0}
          aria-valuemax={100}
        ></div>
      </div>
    </div>
  );
});

export default RenderPreviewPanel;
