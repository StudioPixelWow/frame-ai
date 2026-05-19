'use client';

import React from 'react';

/* ═══════════════════════════════════════════════════════════════════════════
   Types
   ═══════════════════════════════════════════════════════════════════════════ */

export interface Clip {
  id: string;
  title: string;
  duration: number;
  topicTags: string[];
  viralScore: number;
  engagementScore: number;
  hookScore: number;
  selected: boolean;
  format: '16:9' | '9:16' | '1:1' | '4:5';
  preset: string;
  subtitles: boolean;
  broll: boolean;
}

interface ClipReviewProps {
  clips: Clip[];
  onToggle: (clipId: string) => void;
  onSelectTop5: () => void;
  onSelectAbove80: () => void;
  onContinue: () => void;
}

/* ═══════════════════════════════════════════════════════════════════════════
   Constants
   ═══════════════════════════════════════════════════════════════════════════ */

const COLORS = {
  primary: '#00B5FE',
  accent: '#E8F401',
  bg: '#F7F9FC',
  card: '#FFFFFF',
  text: '#1A1A2E',
  textSecondary: '#6B7280',
  border: '#E5E7EB',
  success: '#10B981',
  error: '#EF4444',
  warning: '#F59E0B',
};

const cardStyle: React.CSSProperties = {
  background: COLORS.card,
  borderRadius: 16,
  padding: 24,
  boxShadow: '0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)',
  border: `1px solid ${COLORS.border}`,
};

const buttonPrimary: React.CSSProperties = {
  background: COLORS.primary,
  color: '#fff',
  border: 'none',
  borderRadius: 12,
  padding: '12px 32px',
  fontSize: 16,
  fontWeight: 600,
  cursor: 'pointer',
  transition: 'opacity 0.2s',
};

const buttonSecondary: React.CSSProperties = {
  background: 'transparent',
  color: COLORS.primary,
  border: `2px solid ${COLORS.primary}`,
  borderRadius: 12,
  padding: '10px 24px',
  fontSize: 14,
  fontWeight: 600,
  cursor: 'pointer',
};

/* ═══════════════════════════════════════════════════════════════════════════
   Helpers
   ═══════════════════════════════════════════════════════════════════════════ */

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

/* ═══════════════════════════════════════════════════════════════════════════
   Sub-components
   ═══════════════════════════════════════════════════════════════════════════ */

function ScoreBar({ value, color }: { value: number; color: string }) {
  return (
    <div style={{ height: 6, borderRadius: 3, background: COLORS.border, flex: 1 }}>
      <div
        style={{
          height: '100%',
          borderRadius: 3,
          background: color,
          width: `${value}%`,
          transition: 'width 0.3s',
        }}
      />
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   Component
   ═══════════════════════════════════════════════════════════════════════════ */

export default function ClipReview({
  clips,
  onToggle,
  onSelectTop5,
  onSelectAbove80,
  onContinue,
}: ClipReviewProps) {
  const selectedCount = clips.filter((c) => c.selected).length;
  const hasSelected = selectedCount > 0;

  return (
    <div style={{ maxWidth: 960, margin: '0 auto', direction: 'rtl' }}>
      {/* Bulk actions */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 24, flexWrap: 'wrap' }}>
        <button style={buttonSecondary} onClick={onSelectTop5}>
          בחר Top 5
        </button>
        <button style={buttonSecondary} onClick={onSelectAbove80}>
          בחר מעל 80
        </button>
        <span
          style={{
            fontSize: 14,
            color: COLORS.textSecondary,
            display: 'flex',
            alignItems: 'center',
          }}
        >
          {selectedCount} קליפים נבחרו מתוך {clips.length}
        </span>
        <div style={{ flex: 1 }} />
        <button
          style={{
            ...buttonPrimary,
            opacity: hasSelected ? 1 : 0.5,
            pointerEvents: hasSelected ? 'auto' : 'none',
          }}
          onClick={onContinue}
        >
          המשך להגדרות
        </button>
      </div>

      {/* Clip grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
          gap: 16,
        }}
      >
        {clips.map((clip) => (
          <div
            key={clip.id}
            onClick={() => onToggle(clip.id)}
            style={{
              ...cardStyle,
              cursor: 'pointer',
              borderColor: clip.selected ? COLORS.primary : COLORS.border,
              borderWidth: clip.selected ? 2 : 1,
              position: 'relative',
              transition: 'all 0.2s',
            }}
          >
            {/* Selection badge */}
            <div
              style={{
                position: 'absolute',
                top: 12,
                left: 12,
                width: 24,
                height: 24,
                borderRadius: 6,
                border: `2px solid ${clip.selected ? COLORS.primary : COLORS.border}`,
                background: clip.selected ? COLORS.primary : 'transparent',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff',
                fontSize: 14,
                fontWeight: 700,
              }}
            >
              {clip.selected && '✓'}
            </div>

            <h4
              style={{
                fontSize: 15,
                fontWeight: 600,
                color: COLORS.text,
                margin: '0 0 8px',
                paddingLeft: 32,
              }}
            >
              {clip.title}
            </h4>

            <span style={{ fontSize: 13, color: COLORS.textSecondary }}>
              {formatDuration(clip.duration)}
            </span>

            {/* Tags */}
            <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
              {clip.topicTags.map((tag) => (
                <span
                  key={tag}
                  style={{
                    background: 'rgba(0,181,254,0.1)',
                    color: COLORS.primary,
                    fontSize: 12,
                    fontWeight: 600,
                    padding: '3px 10px',
                    borderRadius: 20,
                  }}
                >
                  {tag}
                </span>
              ))}
            </div>

            {/* Scores */}
            <div style={{ marginTop: 14, display: 'grid', gap: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 12, color: COLORS.textSecondary, minWidth: 55 }}>
                  ויראלי
                </span>
                <ScoreBar value={clip.viralScore} color="#EF4444" />
                <span style={{ fontSize: 12, fontWeight: 600, minWidth: 28, textAlign: 'left' }}>
                  {clip.viralScore}
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 12, color: COLORS.textSecondary, minWidth: 55 }}>
                  מעורבות
                </span>
                <ScoreBar value={clip.engagementScore} color={COLORS.primary} />
                <span style={{ fontSize: 12, fontWeight: 600, minWidth: 28, textAlign: 'left' }}>
                  {clip.engagementScore}
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 12, color: COLORS.textSecondary, minWidth: 55 }}>
                  הוק
                </span>
                <ScoreBar value={clip.hookScore} color={COLORS.accent} />
                <span style={{ fontSize: 12, fontWeight: 600, minWidth: 28, textAlign: 'left' }}>
                  {clip.hookScore}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
