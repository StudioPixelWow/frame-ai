'use client';

import React from 'react';

/* ═══════════════════════════════════════════════════════════════════════════
   Types
   ═══════════════════════════════════════════════════════════════════════════ */

export interface BatchClip {
  id: string;
  title: string;
  format: '16:9' | '9:16' | '1:1' | '4:5';
  preset: string;
  subtitles: boolean;
}

export interface BatchUpdatePayload {
  field: 'format' | 'preset' | 'subtitles';
  value: string | boolean;
}

interface BatchActionsProps {
  selectedClips: BatchClip[];
  onBatchUpdate: (payload: BatchUpdatePayload) => void;
  onMerge: () => void;
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
  success: '#10B981',
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

const inputStyle: React.CSSProperties = {
  padding: '8px 12px',
  borderRadius: 10,
  border: `1px solid ${COLORS.border}`,
  fontSize: 13,
  direction: 'rtl',
  outline: 'none',
  cursor: 'pointer',
  background: COLORS.card,
  minWidth: 140,
};

/* ═══════════════════════════════════════════════════════════════════════════
   Component
   ═══════════════════════════════════════════════════════════════════════════ */

export default function BatchActions({
  selectedClips,
  onBatchUpdate,
  onMerge,
}: BatchActionsProps) {
  const allSubtitlesEnabled = selectedClips.every((c) => c.subtitles);
  const count = selectedClips.length;

  return (
    <div
      style={{
        direction: 'rtl',
        background: COLORS.card,
        borderRadius: 14,
        padding: '14px 20px',
        border: `1px solid ${COLORS.border}`,
        boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
        display: 'flex',
        alignItems: 'center',
        gap: 16,
        flexWrap: 'wrap',
      }}
    >
      {/* Selection count */}
      <span
        style={{
          fontSize: 13,
          fontWeight: 700,
          color: COLORS.primary,
          background: 'rgba(0,181,254,0.1)',
          padding: '4px 12px',
          borderRadius: 20,
          whiteSpace: 'nowrap',
        }}
      >
        {count} קליפים נבחרו
      </span>

      {/* Apply format to all */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <label style={{ fontSize: 13, fontWeight: 600, color: COLORS.text, whiteSpace: 'nowrap' }}>
          פורמט לכולם:
        </label>
        <select
          style={inputStyle}
          defaultValue=""
          onChange={(e) => {
            if (e.target.value) {
              onBatchUpdate({ field: 'format', value: e.target.value });
              e.target.value = '';
            }
          }}
        >
          <option value="" disabled>
            בחר פורמט
          </option>
          {FORMAT_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {/* Apply preset to all */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <label style={{ fontSize: 13, fontWeight: 600, color: COLORS.text, whiteSpace: 'nowrap' }}>
          תבנית לכולם:
        </label>
        <select
          style={inputStyle}
          defaultValue=""
          onChange={(e) => {
            if (e.target.value) {
              onBatchUpdate({ field: 'preset', value: e.target.value });
              e.target.value = '';
            }
          }}
        >
          <option value="" disabled>
            בחר תבנית
          </option>
          {PRESET_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {/* Merge selected clips */}
      <button
        onClick={onMerge}
        disabled={count < 2}
        style={{
          background: count >= 2 ? COLORS.warning : COLORS.border,
          color: count >= 2 ? '#fff' : COLORS.textSecondary,
          border: 'none',
          borderRadius: 10,
          padding: '8px 18px',
          fontSize: 13,
          fontWeight: 600,
          cursor: count >= 2 ? 'pointer' : 'not-allowed',
          whiteSpace: 'nowrap',
          transition: 'opacity 0.2s',
        }}
      >
        מזג קליפים
      </button>

      {/* Enable subtitles for all toggle */}
      <label
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          cursor: 'pointer',
          fontSize: 13,
          fontWeight: 600,
          color: COLORS.text,
          whiteSpace: 'nowrap',
          marginRight: 'auto',
        }}
      >
        <input
          type="checkbox"
          checked={allSubtitlesEnabled}
          onChange={(e) => onBatchUpdate({ field: 'subtitles', value: e.target.checked })}
          style={{ width: 18, height: 18, accentColor: COLORS.primary }}
        />
        כתוביות לכולם
      </label>
    </div>
  );
}
