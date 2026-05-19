'use client';

import React from 'react';

/* ═══════════════════════════════════════════════════════════════════════════
   Types
   ═══════════════════════════════════════════════════════════════════════════ */

export interface ConfigurableClip {
  id: string;
  title: string;
  duration: number;
  format: '16:9' | '9:16' | '1:1' | '4:5';
  preset: string;
  subtitles: boolean;
  broll: boolean;
}

interface ClipConfigProps {
  clips: ConfigurableClip[];
  onUpdateConfig: (clipId: string, field: keyof ConfigurableClip, value: unknown) => void;
  onStartRender: () => void;
  onBack: () => void;
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

const FORMAT_OPTIONS = [
  { value: '16:9', label: '16:9 (רוחבי)' },
  { value: '9:16', label: '9:16 (אנכי)' },
  { value: '1:1', label: '1:1 (ריבוע)' },
  { value: '4:5', label: '4:5 (פורטרט)' },
] as const;

const PRESET_OPTIONS = [
  { value: 'youtube-short', label: 'YouTube Short' },
  { value: 'instagram-reel', label: 'Instagram Reel' },
  { value: 'tiktok', label: 'TikTok' },
  { value: 'linkedin', label: 'LinkedIn' },
  { value: 'full-highlight', label: 'Full Highlight' },
];

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

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '10px 14px',
  borderRadius: 10,
  border: `1px solid ${COLORS.border}`,
  fontSize: 15,
  direction: 'rtl',
  outline: 'none',
  boxSizing: 'border-box',
};

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 14,
  fontWeight: 600,
  color: COLORS.text,
  marginBottom: 6,
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
   Component
   ═══════════════════════════════════════════════════════════════════════════ */

export default function ClipConfig({
  clips,
  onUpdateConfig,
  onStartRender,
  onBack,
}: ClipConfigProps) {
  return (
    <div style={{ maxWidth: 800, margin: '0 auto', direction: 'rtl' }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 24,
        }}
      >
        <h3 style={{ fontSize: 20, fontWeight: 700, color: COLORS.text, margin: 0 }}>
          הגדרות — {clips.length} קליפים
        </h3>
        <button style={buttonPrimary} onClick={onStartRender}>
          התחל רנדור
        </button>
      </div>

      <div style={{ display: 'grid', gap: 16 }}>
        {clips.map((clip) => (
          <div key={clip.id} style={cardStyle}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                marginBottom: 16,
              }}
            >
              <div>
                <h4 style={{ fontSize: 16, fontWeight: 600, color: COLORS.text, margin: 0 }}>
                  {clip.title}
                </h4>
                <span style={{ fontSize: 13, color: COLORS.textSecondary }}>
                  {formatDuration(clip.duration)}
                </span>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              {/* Format */}
              <div>
                <label style={labelStyle}>פורמט</label>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {FORMAT_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => onUpdateConfig(clip.id, 'format', opt.value)}
                      style={{
                        padding: '6px 14px',
                        borderRadius: 8,
                        fontSize: 13,
                        fontWeight: 600,
                        border: `1.5px solid ${clip.format === opt.value ? COLORS.primary : COLORS.border}`,
                        background:
                          clip.format === opt.value ? 'rgba(0,181,254,0.08)' : 'transparent',
                        color: clip.format === opt.value ? COLORS.primary : COLORS.text,
                        cursor: 'pointer',
                      }}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Preset */}
              <div>
                <label style={labelStyle}>תבנית</label>
                <select
                  style={{ ...inputStyle, cursor: 'pointer' }}
                  value={clip.preset}
                  onChange={(e) => onUpdateConfig(clip.id, 'preset', e.target.value)}
                >
                  {PRESET_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Toggles */}
            <div style={{ display: 'flex', gap: 24, marginTop: 16 }}>
              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  cursor: 'pointer',
                  fontSize: 14,
                }}
              >
                <input
                  type="checkbox"
                  checked={clip.subtitles}
                  onChange={(e) => onUpdateConfig(clip.id, 'subtitles', e.target.checked)}
                  style={{ width: 18, height: 18, accentColor: COLORS.primary }}
                />
                כתוביות
              </label>
              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  cursor: 'pointer',
                  fontSize: 14,
                }}
              >
                <input
                  type="checkbox"
                  checked={clip.broll}
                  onChange={(e) => onUpdateConfig(clip.id, 'broll', e.target.checked)}
                  style={{ width: 18, height: 18, accentColor: COLORS.primary }}
                />
                B-Roll
              </label>
            </div>
          </div>
        ))}
      </div>

      <div style={{ marginTop: 24, display: 'flex', gap: 12 }}>
        <button style={buttonSecondary} onClick={onBack}>
          חזרה לסקירה
        </button>
      </div>
    </div>
  );
}
