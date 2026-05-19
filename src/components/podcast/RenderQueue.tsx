'use client';

import React from 'react';

/* ═══════════════════════════════════════════════════════════════════════════
   Types
   ═══════════════════════════════════════════════════════════════════════════ */

export interface RenderItem {
  clipId: string;
  title: string;
  progress: number;
  status: 'queued' | 'rendering' | 'done' | 'error';
  downloadUrl: string | null;
}

interface RenderQueueProps {
  renderItems: RenderItem[];
  onDownloadAll: () => void;
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

/* ═══════════════════════════════════════════════════════════════════════════
   Helpers
   ═══════════════════════════════════════════════════════════════════════════ */

const STATUS_MAP: Record<RenderItem['status'], { bg: string; color: string; label: string }> = {
  queued: { bg: '#F3F4F6', color: '#6B7280', label: 'בתור' },
  rendering: { bg: 'rgba(0,181,254,0.1)', color: '#00B5FE', label: 'מרנדר' },
  done: { bg: 'rgba(16,185,129,0.1)', color: '#10B981', label: 'הושלם' },
  error: { bg: 'rgba(239,68,68,0.1)', color: '#EF4444', label: 'שגיאה' },
};

/* ═══════════════════════════════════════════════════════════════════════════
   Component
   ═══════════════════════════════════════════════════════════════════════════ */

export default function RenderQueue({ renderItems, onDownloadAll }: RenderQueueProps) {
  const allDone = renderItems.length > 0 && renderItems.every((r) => r.status === 'done');

  return (
    <div style={{ maxWidth: 700, margin: '0 auto', direction: 'rtl' }}>
      <h3
        style={{
          fontSize: 20,
          fontWeight: 700,
          color: COLORS.text,
          margin: '0 0 24px',
          textAlign: 'center',
        }}
      >
        תור רנדור
      </h3>

      <div style={{ display: 'grid', gap: 12 }}>
        {renderItems.map((item) => {
          const badge = STATUS_MAP[item.status];

          return (
            <div key={item.clipId} style={cardStyle}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: 10,
                }}
              >
                <span style={{ fontSize: 15, fontWeight: 600, color: COLORS.text }}>
                  {item.title}
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span
                    style={{
                      background: badge.bg,
                      color: badge.color,
                      fontSize: 12,
                      fontWeight: 600,
                      padding: '4px 12px',
                      borderRadius: 20,
                    }}
                  >
                    {badge.label}
                  </span>
                  {item.status === 'done' && item.downloadUrl && (
                    <button
                      style={{
                        background: COLORS.success,
                        color: '#fff',
                        border: 'none',
                        borderRadius: 8,
                        padding: '6px 16px',
                        fontSize: 13,
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                      onClick={() => window.open(item.downloadUrl!, '_blank')}
                    >
                      הורד
                    </button>
                  )}
                </div>
              </div>
              {(item.status === 'rendering' || item.status === 'done') && (
                <div style={{ height: 6, borderRadius: 3, background: COLORS.border }}>
                  <div
                    style={{
                      height: '100%',
                      borderRadius: 3,
                      background: item.status === 'done' ? COLORS.success : COLORS.primary,
                      width: `${item.progress}%`,
                      transition: 'width 0.5s',
                    }}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {allDone && (
        <div style={{ marginTop: 32, textAlign: 'center' }}>
          <button
            style={{
              ...buttonPrimary,
              background: `linear-gradient(135deg, ${COLORS.primary}, ${COLORS.accent})`,
              color: COLORS.text,
              padding: '14px 40px',
              fontSize: 17,
            }}
            onClick={onDownloadAll}
          >
            הורד הכל כ-ZIP
          </button>
        </div>
      )}
    </div>
  );
}
