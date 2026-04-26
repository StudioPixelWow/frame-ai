'use client';

import React from 'react';
import type { Clip, Transition, MotionEffect } from '@/lib/video-editor/types';

interface ClipBlockProps {
  clip: Clip;
  isSelected: boolean;
  isHovered: boolean;
  isDragging: boolean;
  isTrimming: boolean;
  transitionBefore: Transition | null;
  motionEffect: MotionEffect | null;
  pixelsPerSecond: number;
  onSelect: (clipId: string) => void;
  onDragStart: (clipId: string, e: React.MouseEvent) => void;
  onTrimStart: (clipId: string, handle: 'start' | 'end', e: React.MouseEvent) => void;
  onClick: (clipId: string) => void;
}

const ClipBlock = React.memo(function ClipBlock({
  clip,
  isSelected,
  isHovered,
  isDragging,
  isTrimming,
  transitionBefore,
  motionEffect,
  pixelsPerSecond,
  onSelect,
  onDragStart,
  onTrimStart,
  onClick,
}: ClipBlockProps) {
  const width = (clip.end - clip.start) * pixelsPerSecond;
  const duration = clip.end - clip.start;
  const durationText = `${duration.toFixed(1)}s`;

  const handleMouseDown = (e: React.MouseEvent) => {
    // Avoid drag if clicking on trim handle
    if ((e.target as HTMLElement).closest('.ved-trim-handle')) {
      return;
    }
    onDragStart(clip.id, e);
  };

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onClick(clip.id);
    onSelect(clip.id);
  };

  const handleTrimStart = (handle: 'start' | 'end', e: React.MouseEvent) => {
    e.stopPropagation();
    onTrimStart(clip.id, handle, e);
  };

  return (
    <div
      className={`ved-clip ${isSelected ? 'selected' : ''} ${isDragging ? 'dragging' : ''}`}
      style={{
        left: `${clip.start * pixelsPerSecond}px`,
        width: `${width}px`,
      }}
      onMouseDown={handleMouseDown}
      onClick={handleClick}
      role="button"
      tabIndex={0}
      aria-selected={isSelected}
      data-clip-id={clip.id}
    >
      {/* Thumbnail */}
      <div className="ved-clip-thumb">
        {clip.thumbnailUrl ? (
          <img src={clip.thumbnailUrl} alt={clip.label} />
        ) : (
          <span>No thumbnail</span>
        )}
      </div>

      {/* Info section */}
      <div className="ved-clip-info">
        <div className="ved-clip-label">{clip.label}</div>
        <div className="ved-clip-duration">{durationText}</div>

        {/* Badges */}
        <div className="ved-clip-badges">
          {transitionBefore && (
            <div className="ved-clip-badge transition" title="Has transition">
              ⟳
            </div>
          )}
          {motionEffect && (
            <div className="ved-clip-badge motion" title="Has motion effect">
              ⤳
            </div>
          )}
          {clip.captions.length > 0 && (
            <div className="ved-clip-badge text" title={`${clip.captions.length} caption(s)`}>
              ℂ
            </div>
          )}
        </div>
      </div>

      {/* Trim handles */}
      <div
        className="ved-trim-handle ved-trim-handle-start"
        onMouseDown={(e) => handleTrimStart('start', e)}
        role="button"
        tabIndex={-1}
        aria-label="Trim start"
      />
      <div
        className="ved-trim-handle ved-trim-handle-end"
        onMouseDown={(e) => handleTrimStart('end', e)}
        role="button"
        tabIndex={-1}
        aria-label="Trim end"
      />
    </div>
  );
});

export default ClipBlock;
