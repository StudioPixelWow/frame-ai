'use client';

import React, { useEffect, useRef, useCallback } from 'react';

interface PlayheadScrubberProps {
  position: number;
  totalDuration: number;
  pixelsPerSecond: number;
  onScrub: (newPosition: number) => void;
}

const PlayheadScrubber = React.memo(function PlayheadScrubber({
  position,
  totalDuration,
  pixelsPerSecond,
  onScrub,
}: PlayheadScrubberProps) {
  const headRef = useRef<HTMLDivElement>(null);
  const isDraggingRef = useRef(false);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      isDraggingRef.current = true;
      document.body.style.cursor = 'col-resize';

      const handleMouseMove = (moveEvent: MouseEvent) => {
        if (!isDraggingRef.current) return;

        const target = moveEvent.currentTarget as Document;
        const rect = headRef.current?.getBoundingClientRect();

        if (rect) {
          const timelineElement = (e.currentTarget as HTMLElement).closest('.ved-timeline');
          if (timelineElement) {
            const timelineRect = timelineElement.getBoundingClientRect();
            const clientX = moveEvent.clientX - timelineRect.left;
            const scrollOffset = timelineElement.scrollLeft;

            // Calculate new position in seconds
            const newPosition = Math.max(
              0,
              Math.min(totalDuration, (clientX + scrollOffset) / pixelsPerSecond)
            );

            onScrub(newPosition);
          }
        }
      };

      const handleMouseUp = () => {
        isDraggingRef.current = false;
        document.body.style.cursor = 'default';
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };

      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    },
    [totalDuration, pixelsPerSecond, onScrub]
  );

  const leftPixels = position * pixelsPerSecond;

  return (
    <div
      className="ved-playhead"
      style={{
        left: `${leftPixels}px`,
      }}
    >
      <div
        ref={headRef}
        className="ved-playhead-head"
        onMouseDown={handleMouseDown}
        role="slider"
        tabIndex={0}
        aria-label="Playhead scrubber"
        aria-valuenow={Math.round(position * 100) / 100}
        aria-valuemin={0}
        aria-valuemax={Math.round(totalDuration * 100) / 100}
      />
    </div>
  );
});

export default PlayheadScrubber;
