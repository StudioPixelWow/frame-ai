'use client';

import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import type { VideoEditProject, Transition } from '@/lib/video-editor/types';
import ClipBlock from './ClipBlock';
import PlayheadScrubber from './PlayheadScrubber';
import BeatMarkerLayer from './BeatMarkerLayer';

interface SmartVideoTimelineProps {
  project: VideoEditProject;
  onClipSelect: (id: string) => void;
  onClipMove: (id: string, newStart: number) => void;
  onClipTrim: (id: string, trimStart: number, trimEnd: number) => void;
  onTransitionClick: (fromId: string, toId: string) => void;
  onPlayheadChange: (time: number) => void;
}

interface DragState {
  isDragging: boolean;
  clipId: string | null;
  startX: number;
  currentX: number;
  originalStart: number;
}

interface TrimState {
  isTrimming: boolean;
  clipId: string | null;
  handle: 'start' | 'end' | null;
  startX: number;
  currentX: number;
}

const ZOOM_MIN = 20;
const ZOOM_MAX = 200;
const ZOOM_DEFAULT = 60;

const SmartVideoTimeline = React.memo(function SmartVideoTimeline({
  project,
  onClipSelect,
  onClipMove,
  onClipTrim,
  onTransitionClick,
  onPlayheadChange,
}: SmartVideoTimelineProps) {
  const timelineRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  const [selectedClipId, setSelectedClipId] = useState<string | null>(null);
  const [hoveredClipId, setHoveredClipId] = useState<string | null>(null);
  const [dragState, setDragState] = useState<DragState>({
    isDragging: false,
    clipId: null,
    startX: 0,
    currentX: 0,
    originalStart: 0,
  });
  const [trimState, setTrimState] = useState<TrimState>({
    isTrimming: false,
    clipId: null,
    handle: null,
    startX: 0,
    currentX: 0,
  });
  const [zoomLevel, setZoomLevel] = useState(project.zoomLevel || ZOOM_DEFAULT);

  const pixelsPerSecond = zoomLevel;
  const totalDuration = project.totalDuration || 0;
  const timelineWidth = totalDuration * pixelsPerSecond;

  // Format time display (MM:SS)
  const formatTime = useCallback((seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }, []);

  // Generate ruler markers
  const rulerMarkers = useMemo(() => {
    const markers = [];
    for (let i = 0; i <= totalDuration; i += 1) {
      markers.push({
        time: i,
        showLabel: i % 5 === 0,
      });
    }
    return markers;
  }, [totalDuration]);

  // Get transition between clips
  const getTransitionBefore = useCallback(
    (clipId: string): Transition | null => {
      return (
        project.transitions.find((t) => t.toClipId === clipId) || null
      );
    },
    [project.transitions]
  );

  // Get motion effect for clip
  const getMotionEffect = useCallback(
    (clipId: string) => {
      return project.motions.find((m) => m.clipId === clipId) || null;
    },
    [project.motions]
  );

  // Handle clip drag start
  const handleDragStart = useCallback(
    (clipId: string, e: React.MouseEvent) => {
      if (dragState.isDragging || trimState.isTrimming) return;

      const clip = project.clips.find((c) => c.id === clipId);
      if (!clip) return;

      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      setDragState({
        isDragging: true,
        clipId,
        startX: e.clientX,
        currentX: e.clientX,
        originalStart: clip.start,
      });
    },
    [dragState.isDragging, trimState.isTrimming, project.clips]
  );

  // Handle trim start
  const handleTrimStart = useCallback(
    (clipId: string, handle: 'start' | 'end', e: React.MouseEvent) => {
      if (dragState.isDragging || trimState.isTrimming) return;

      e.stopPropagation();
      setTrimState({
        isTrimming: true,
        clipId,
        handle,
        startX: e.clientX,
        currentX: e.clientX,
      });
    },
    [dragState.isDragging, trimState.isTrimming]
  );

  // Handle clip selection
  const handleSelectClip = useCallback(
    (clipId: string) => {
      setSelectedClipId(clipId);
      onClipSelect(clipId);
    },
    [onClipSelect]
  );

  // Handle clip click
  const handleClipClick = useCallback((clipId: string) => {
    // This can be used for additional actions if needed
  }, []);

  // Handle zoom
  const handleZoom = useCallback((direction: 'in' | 'out') => {
    setZoomLevel((prev) => {
      const newZoom =
        direction === 'in'
          ? Math.min(prev + 10, ZOOM_MAX)
          : Math.max(prev - 10, ZOOM_MIN);
      return newZoom;
    });
  }, []);

  // Keyboard controls
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (selectedClipId && !dragState.isDragging && !trimState.isTrimming) {
        if (e.key === 'ArrowLeft') {
          e.preventDefault();
          onPlayheadChange(Math.max(0, project.playheadPosition - 0.1));
        } else if (e.key === 'ArrowRight') {
          e.preventDefault();
          onPlayheadChange(Math.min(totalDuration, project.playheadPosition + 0.1));
        } else if (e.key === 'Delete') {
          e.preventDefault();
          // Noop - just prevent default
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedClipId, dragState.isDragging, trimState.isTrimming, onPlayheadChange, project.playheadPosition, totalDuration]);

  // Handle drag move and commit
  useEffect(() => {
    if (!dragState.isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      setDragState((prev) => ({
        ...prev,
        currentX: e.clientX,
      }));
    };

    const handleMouseUp = () => {
      if (dragState.clipId) {
        const deltaPixels = dragState.currentX - dragState.startX;
        const deltaSeconds = deltaPixels / pixelsPerSecond;
        const newStart = Math.max(0, dragState.originalStart + deltaSeconds);

        onClipMove(dragState.clipId, newStart);
      }

      setDragState({
        isDragging: false,
        clipId: null,
        startX: 0,
        currentX: 0,
        originalStart: 0,
      });
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [dragState, pixelsPerSecond, onClipMove]);

  // Handle trim move and commit
  useEffect(() => {
    if (!trimState.isTrimming) return;

    const clip = project.clips.find((c) => c.id === trimState.clipId);
    if (!clip) return;

    const handleMouseMove = (e: MouseEvent) => {
      setTrimState((prev) => ({
        ...prev,
        currentX: e.clientX,
      }));
    };

    const handleMouseUp = () => {
      if (trimState.clipId && trimState.handle) {
        const deltaPixels = trimState.currentX - trimState.startX;
        const deltaSeconds = deltaPixels / pixelsPerSecond;

        let newTrimStart = clip.trimStart;
        let newTrimEnd = clip.trimEnd;

        if (trimState.handle === 'start') {
          newTrimStart = Math.max(0, clip.trimStart + deltaSeconds);
          newTrimStart = Math.min(newTrimStart, clip.duration - 0.1);
        } else {
          newTrimEnd = Math.min(clip.duration, clip.trimEnd + deltaSeconds);
          newTrimEnd = Math.max(newTrimEnd, clip.trimStart + 0.1);
        }

        onClipTrim(trimState.clipId, newTrimStart, newTrimEnd);
      }

      setTrimState({
        isTrimming: false,
        clipId: null,
        handle: null,
        startX: 0,
        currentX: 0,
      });
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [trimState, pixelsPerSecond, onClipTrim, project.clips]);

  // Sort clips by start time
  const sortedClips = useMemo(() => {
    return [...project.clips].sort((a, b) => a.start - b.start);
  }, [project.clips]);

  return (
    <div
      className="ved-timeline-wrap"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
      }}
    >
      {/* Zoom controls */}
      <div
        style={{
          display: 'flex',
          gap: '8px',
          alignItems: 'center',
          padding: '0 8px',
        }}
      >
        <button
          onClick={() => handleZoom('out')}
          disabled={zoomLevel <= ZOOM_MIN}
          style={{
            padding: '4px 8px',
            borderRadius: '4px',
            border: '1px solid var(--border)',
            backgroundColor: 'var(--surface-raised)',
            cursor: zoomLevel <= ZOOM_MIN ? 'not-allowed' : 'pointer',
            opacity: zoomLevel <= ZOOM_MIN ? 0.5 : 1,
          }}
          aria-label="Zoom out"
        >
          −
        </button>
        <span
          style={{
            fontSize: '0.8rem',
            color: 'var(--foreground-muted)',
            minWidth: '60px',
            textAlign: 'center',
          }}
        >
          {zoomLevel}px/s
        </span>
        <button
          onClick={() => handleZoom('in')}
          disabled={zoomLevel >= ZOOM_MAX}
          style={{
            padding: '4px 8px',
            borderRadius: '4px',
            border: '1px solid var(--border)',
            backgroundColor: 'var(--surface-raised)',
            cursor: zoomLevel >= ZOOM_MAX ? 'not-allowed' : 'pointer',
            opacity: zoomLevel >= ZOOM_MAX ? 0.5 : 1,
          }}
          aria-label="Zoom in"
        >
          +
        </button>
        <span
          style={{
            fontSize: '0.8rem',
            color: 'var(--foreground-muted)',
            marginLeft: '16px',
          }}
        >
          Duration: {formatTime(totalDuration)}
        </span>
      </div>

      {/* Timeline container */}
      <div
        ref={timelineRef}
        className="ved-timeline"
        style={{
          direction: 'rtl',
        }}
      >
        <div className="ved-timeline-track" style={{ width: `${timelineWidth}px` }}>
          {/* Ruler */}
          <div
            className="ved-timeline-ruler"
            style={{
              direction: 'rtl',
              paddingLeft: '8px',
              paddingRight: '8px',
            }}
          >
            {rulerMarkers.map((marker) => (
              <div
                key={`marker-${marker.time}`}
                className="ved-timeline-ruler-marker"
                style={{
                  width: `${pixelsPerSecond}px`,
                  justifyContent: marker.showLabel ? 'flex-start' : 'center',
                }}
              >
                <div className="ved-timeline-ruler-tick" />
                {marker.showLabel && (
                  <div className="ved-timeline-ruler-label">
                    {formatTime(marker.time)}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Timeline content */}
          <div
            ref={contentRef}
            className="ved-timeline-content"
            style={{
              position: 'relative',
              height: '80px',
            }}
          >
            {/* Beat markers */}
            {project.beatSync && (
              <BeatMarkerLayer
                markers={project.beatSync.markers}
                pixelsPerSecond={pixelsPerSecond}
                visible={true}
              />
            )}

            {/* Clips */}
            {sortedClips.map((clip) => (
              <ClipBlock
                key={clip.id}
                clip={clip}
                isSelected={selectedClipId === clip.id}
                isHovered={hoveredClipId === clip.id}
                isDragging={dragState.isDragging && dragState.clipId === clip.id}
                isTrimming={trimState.isTrimming && trimState.clipId === clip.id}
                transitionBefore={getTransitionBefore(clip.id)}
                motionEffect={getMotionEffect(clip.id)}
                pixelsPerSecond={pixelsPerSecond}
                onSelect={handleSelectClip}
                onDragStart={handleDragStart}
                onTrimStart={handleTrimStart}
                onClick={handleClipClick}
              />
            ))}

            {/* Transitions (diamonds between clips) */}
            {sortedClips.map((clip, index) => {
              if (index === sortedClips.length - 1) return null;

              const nextClip = sortedClips[index + 1];
              const transition = project.transitions.find(
                (t) => t.fromClipId === clip.id && t.toClipId === nextClip.id
              );

              if (!transition) return null;

              const transitionX = clip.end * pixelsPerSecond;

              return (
                <div
                  key={`transition-${clip.id}-${nextClip.id}`}
                  style={{
                    position: 'absolute',
                    left: `${transitionX}px`,
                    top: '50%',
                    transform: 'translate(-50%, -50%)',
                    width: '20px',
                    height: '20px',
                    backgroundColor: 'var(--accent)',
                    borderRadius: '50%',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '10px',
                    color: 'white',
                    zIndex: 5,
                    transition: 'all 200ms ease',
                  }}
                  onClick={() => onTransitionClick(clip.id, nextClip.id)}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLElement).style.transform =
                      'translate(-50%, -50%) scale(1.2)';
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLElement).style.transform =
                      'translate(-50%, -50%)';
                  }}
                  role="button"
                  tabIndex={0}
                  aria-label={`Transition from ${clip.label} to ${nextClip.label}`}
                >
                  ⟳
                </div>
              );
            })}

            {/* Playhead */}
            <PlayheadScrubber
              position={project.playheadPosition}
              totalDuration={totalDuration}
              pixelsPerSecond={pixelsPerSecond}
              onScrub={onPlayheadChange}
            />
          </div>
        </div>
      </div>
    </div>
  );
});

export default SmartVideoTimeline;
