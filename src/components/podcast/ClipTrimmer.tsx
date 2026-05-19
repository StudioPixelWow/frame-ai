'use client';

import React, { useCallback, useRef, useState, useEffect } from 'react';

/* ═══════════════════════════════════════════════════════════════════════════
   Types
   ═══════════════════════════════════════════════════════════════════════════ */

interface ClipTrimmerProps {
  startTime: number;
  endTime: number;
  maxDuration: number;
  onChange: (startTime: number, endTime: number) => void;
}

/* ═══════════════════════════════════════════════════════════════════════════
   Constants
   ═══════════════════════════════════════════════════════════════════════════ */

const COLORS = {
  primary: '#00B5FE',
  accent: '#E8F401',
  card: '#FFFFFF',
  text: '#1A1A2E',
  textSecondary: '#6B7280',
  border: '#E5E7EB',
};

/* ═══════════════════════════════════════════════════════════════════════════
   Helpers
   ═══════════════════════════════════════════════════════════════════════════ */

function formatTimecode(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 100);
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
}

/* ═══════════════════════════════════════════════════════════════════════════
   Component
   ═══════════════════════════════════════════════════════════════════════════ */

export default function ClipTrimmer({
  startTime,
  endTime,
  maxDuration,
  onChange,
}: ClipTrimmerProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState<'start' | 'end' | null>(null);

  const getPositionFromEvent = useCallback(
    (clientX: number): number => {
      if (!trackRef.current) return 0;
      const rect = trackRef.current.getBoundingClientRect();
      // RTL: right edge = 0, left edge = maxDuration
      const ratio = 1 - (clientX - rect.left) / rect.width;
      return Math.max(0, Math.min(maxDuration, ratio * maxDuration));
    },
    [maxDuration],
  );

  const handleMouseDown = useCallback(
    (handle: 'start' | 'end') => (e: React.MouseEvent) => {
      e.preventDefault();
      setDragging(handle);
    },
    [],
  );

  useEffect(() => {
    if (!dragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      const time = getPositionFromEvent(e.clientX);
      if (dragging === 'start') {
        onChange(Math.min(time, endTime - 0.5), endTime);
      } else {
        onChange(startTime, Math.max(time, startTime + 0.5));
      }
    };

    const handleMouseUp = () => {
      setDragging(null);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [dragging, startTime, endTime, onChange, getPositionFromEvent]);

  const startPercent = (startTime / maxDuration) * 100;
  const endPercent = (endTime / maxDuration) * 100;
  const clipDuration = endTime - startTime;

  const handleStyle = (isActive: boolean): React.CSSProperties => ({
    position: 'absolute',
    top: -4,
    width: 16,
    height: 40,
    background: isActive ? COLORS.accent : COLORS.primary,
    borderRadius: 4,
    cursor: 'ew-resize',
    border: `2px solid ${COLORS.card}`,
    boxShadow: '0 2px 6px rgba(0,0,0,0.2)',
    zIndex: 3,
    transform: 'translateX(50%)',
  });

  return (
    <div
      style={{
        direction: 'rtl',
        background: COLORS.card,
        borderRadius: 16,
        padding: 24,
        border: `1px solid ${COLORS.border}`,
        boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
      }}
    >
      {/* Time display */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          marginBottom: 16,
          fontSize: 14,
        }}
      >
        <div>
          <span style={{ color: COLORS.textSecondary, marginLeft: 6 }}>התחלה:</span>
          <span style={{ fontWeight: 700, color: COLORS.text, fontVariantNumeric: 'tabular-nums' }}>
            {formatTimecode(startTime)}
          </span>
        </div>
        <div
          style={{
            background: 'rgba(0,181,254,0.1)',
            color: COLORS.primary,
            fontWeight: 700,
            padding: '2px 12px',
            borderRadius: 12,
            fontSize: 13,
          }}
        >
          {formatTimecode(clipDuration)}
        </div>
        <div>
          <span style={{ color: COLORS.textSecondary, marginLeft: 6 }}>סיום:</span>
          <span style={{ fontWeight: 700, color: COLORS.text, fontVariantNumeric: 'tabular-nums' }}>
            {formatTimecode(endTime)}
          </span>
        </div>
      </div>

      {/* Timeline track */}
      <div
        ref={trackRef}
        style={{
          position: 'relative',
          height: 32,
          background: COLORS.border,
          borderRadius: 8,
          overflow: 'visible',
          userSelect: 'none',
        }}
      >
        {/* Selected region (RTL: right = start) */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            right: `${startPercent}%`,
            width: `${endPercent - startPercent}%`,
            height: '100%',
            background: `linear-gradient(90deg, rgba(0,181,254,0.3), rgba(0,181,254,0.15))`,
            borderRadius: 4,
            zIndex: 1,
          }}
        />

        {/* Start handle */}
        <div
          onMouseDown={handleMouseDown('start')}
          style={{
            ...handleStyle(dragging === 'start'),
            right: `${startPercent}%`,
          }}
        />

        {/* End handle */}
        <div
          onMouseDown={handleMouseDown('end')}
          style={{
            ...handleStyle(dragging === 'end'),
            right: `${endPercent}%`,
          }}
        />

        {/* Tick marks */}
        {Array.from({ length: 11 }, (_, i) => (
          <div
            key={i}
            style={{
              position: 'absolute',
              right: `${i * 10}%`,
              bottom: 0,
              width: 1,
              height: i % 5 === 0 ? 12 : 6,
              background: 'rgba(0,0,0,0.15)',
              zIndex: 0,
            }}
          />
        ))}
      </div>

      {/* Duration labels */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          marginTop: 6,
          fontSize: 11,
          color: COLORS.textSecondary,
        }}
      >
        <span>{formatTimecode(0)}</span>
        <span>{formatTimecode(maxDuration)}</span>
      </div>
    </div>
  );
}
