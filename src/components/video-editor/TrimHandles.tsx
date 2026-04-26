'use client';

import React from 'react';

interface TrimHandlesProps {
  clipId: string;
  side: 'start' | 'end';
  onTrimStart: (clipId: string, side: 'start' | 'end', e: React.MouseEvent) => void;
  isActive: boolean;
}

const TrimHandles = React.memo(function TrimHandles({
  clipId,
  side,
  onTrimStart,
  isActive,
}: TrimHandlesProps) {
  const handleMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation();
    onTrimStart(clipId, side, e);
  };

  const sideClass = side === 'start' ? 'ved-trim-handle-start' : 'ved-trim-handle-end';

  return (
    <div
      className={`ved-trim-handle ${sideClass} ${isActive ? 'active' : ''}`}
      onMouseDown={handleMouseDown}
      role="button"
      tabIndex={-1}
      aria-label={`Trim ${side}`}
    />
  );
});

export default TrimHandles;
