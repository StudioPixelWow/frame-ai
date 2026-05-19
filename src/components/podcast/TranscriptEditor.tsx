'use client';

import React, { useCallback } from 'react';

/* ═══════════════════════════════════════════════════════════════════════════
   Types
   ═══════════════════════════════════════════════════════════════════════════ */

export interface TranscriptSegment {
  id: string;
  startTime: number;
  endTime: number;
  speaker?: string;
  text: string;
}

interface TranscriptEditorProps {
  segments: TranscriptSegment[];
  onUpdate: (segmentId: string, newText: string) => void;
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

function formatTimestamp(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

/* ═══════════════════════════════════════════════════════════════════════════
   Component
   ═══════════════════════════════════════════════════════════════════════════ */

export default function TranscriptEditor({ segments, onUpdate }: TranscriptEditorProps) {
  const handleTextChange = useCallback(
    (segmentId: string, value: string) => {
      onUpdate(segmentId, value);
    },
    [onUpdate],
  );

  return (
    <div
      style={{
        direction: 'rtl',
        background: COLORS.card,
        borderRadius: 16,
        border: `1px solid ${COLORS.border}`,
        boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '16px 24px',
          borderBottom: `1px solid ${COLORS.border}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <h3 style={{ fontSize: 16, fontWeight: 700, color: COLORS.text, margin: 0 }}>
          עריכת תמלול
        </h3>
        <span style={{ fontSize: 13, color: COLORS.textSecondary }}>
          {segments.length} קטעים
        </span>
      </div>

      {/* Scrollable transcript */}
      <div
        style={{
          maxHeight: 480,
          overflowY: 'auto',
          padding: '8px 0',
        }}
      >
        {segments.map((segment, index) => (
          <div
            key={segment.id}
            style={{
              display: 'flex',
              gap: 12,
              padding: '12px 24px',
              borderBottom:
                index < segments.length - 1 ? `1px solid ${COLORS.border}` : 'none',
              alignItems: 'flex-start',
              transition: 'background 0.15s',
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLDivElement).style.background = 'rgba(0,181,254,0.03)';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLDivElement).style.background = 'transparent';
            }}
          >
            {/* Timestamp column */}
            <div
              style={{
                minWidth: 80,
                paddingTop: 8,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-start',
                gap: 4,
              }}
            >
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: COLORS.primary,
                  fontVariantNumeric: 'tabular-nums',
                  background: 'rgba(0,181,254,0.08)',
                  padding: '2px 8px',
                  borderRadius: 6,
                }}
              >
                {formatTimestamp(segment.startTime)}
              </span>
              <span
                style={{
                  fontSize: 11,
                  color: COLORS.textSecondary,
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                → {formatTimestamp(segment.endTime)}
              </span>
              {segment.speaker && (
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    color: COLORS.textSecondary,
                    marginTop: 2,
                  }}
                >
                  {segment.speaker}
                </span>
              )}
            </div>

            {/* Editable text */}
            <textarea
              value={segment.text}
              onChange={(e) => handleTextChange(segment.id, e.target.value)}
              style={{
                flex: 1,
                border: `1px solid transparent`,
                borderRadius: 8,
                padding: '8px 12px',
                fontSize: 14,
                lineHeight: 1.7,
                color: COLORS.text,
                background: 'transparent',
                resize: 'vertical',
                minHeight: 44,
                direction: 'rtl',
                outline: 'none',
                fontFamily: 'inherit',
                transition: 'border-color 0.15s, background 0.15s',
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = COLORS.primary;
                e.currentTarget.style.background = COLORS.card;
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = 'transparent';
                e.currentTarget.style.background = 'transparent';
              }}
              rows={Math.max(1, Math.ceil(segment.text.length / 60))}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
