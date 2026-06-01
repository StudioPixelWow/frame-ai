'use client';

import { useState } from 'react';

const BRAND = '#00B5FE';

export interface DateRangeValue {
  preset: string;          // today | yesterday | last_7d | last_30d | this_month | last_month | custom
  from?: string;           // YYYY-MM-DD (custom)
  to?: string;             // YYYY-MM-DD (custom)
}

const SEGMENTS: { value: string; label: string }[] = [
  { value: 'today', label: 'היום' },
  { value: 'yesterday', label: 'אתמול' },
  { value: 'last_7d', label: '7 ימים' },
  { value: 'last_30d', label: '30 יום' },
  { value: 'this_month', label: 'החודש' },
  { value: 'last_month', label: 'חודש קודם' },
];

/**
 * Modern segmented date-range control (Linear/Stripe style) used by the Meta
 * command center and client dashboard. Includes a custom-range popover.
 */
export default function DateRangeSegment({
  value,
  onChange,
}: {
  value: DateRangeValue;
  onChange: (v: DateRangeValue) => void;
}) {
  const [showCustom, setShowCustom] = useState(false);
  const [draft, setDraft] = useState<{ from: string; to: string }>({
    from: value.from || '',
    to: value.to || '',
  });

  const pill = (active: boolean): React.CSSProperties => ({
    padding: '0.45rem 0.9rem',
    fontSize: 13,
    fontWeight: 600,
    border: 'none',
    borderRadius: 9,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    background: active ? '#fff' : 'transparent',
    color: active ? BRAND : 'var(--foreground-muted, #6b7280)',
    boxShadow: active ? '0 1px 3px rgba(0,0,0,0.12)' : 'none',
    transition: 'all 140ms ease',
  });

  return (
    <div style={{ position: 'relative', display: 'inline-flex', flexWrap: 'wrap', gap: 4 }}>
      <div
        style={{
          display: 'inline-flex',
          gap: 2,
          padding: 4,
          borderRadius: 12,
          background: 'var(--surface, #f1f5f9)',
          border: '1px solid var(--border, #e5e7eb)',
        }}
      >
        {SEGMENTS.map((s) => (
          <button key={s.value} style={pill(value.preset === s.value)} onClick={() => onChange({ preset: s.value })}>
            {s.label}
          </button>
        ))}
        <button
          style={pill(value.preset === 'custom')}
          onClick={() => setShowCustom((v) => !v)}
          title="טווח מותאם אישית"
        >
          {value.preset === 'custom' && value.from ? `${value.from} → ${value.to}` : '📅 מותאם'}
        </button>
      </div>

      {showCustom && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 8px)',
            insetInlineEnd: 0,
            zIndex: 50,
            background: 'var(--surface-raised, #fff)',
            border: '1px solid var(--border, #e5e7eb)',
            borderRadius: 12,
            padding: 14,
            boxShadow: '0 12px 32px rgba(0,0,0,0.16)',
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
            minWidth: 240,
          }}
        >
          <div style={{ display: 'flex', gap: 8 }}>
            <label style={{ fontSize: 12, color: 'var(--foreground-muted,#6b7280)', flex: 1 }}>
              מתאריך
              <input
                type="date"
                value={draft.from}
                onChange={(e) => setDraft((d) => ({ ...d, from: e.target.value }))}
                style={{ width: '100%', marginTop: 4, padding: '6px 8px', borderRadius: 8, border: '1px solid var(--border,#e5e7eb)', fontSize: 13 }}
              />
            </label>
            <label style={{ fontSize: 12, color: 'var(--foreground-muted,#6b7280)', flex: 1 }}>
              עד תאריך
              <input
                type="date"
                value={draft.to}
                onChange={(e) => setDraft((d) => ({ ...d, to: e.target.value }))}
                style={{ width: '100%', marginTop: 4, padding: '6px 8px', borderRadius: 8, border: '1px solid var(--border,#e5e7eb)', fontSize: 13 }}
              />
            </label>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <button
              onClick={() => setShowCustom(false)}
              style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid var(--border,#e5e7eb)', background: 'transparent', color: 'var(--foreground-muted,#6b7280)', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
            >
              ביטול
            </button>
            <button
              disabled={!draft.from || !draft.to}
              onClick={() => { onChange({ preset: 'custom', from: draft.from, to: draft.to }); setShowCustom(false); }}
              style={{ padding: '6px 14px', borderRadius: 8, border: 'none', background: BRAND, color: '#fff', fontSize: 12, fontWeight: 700, cursor: draft.from && draft.to ? 'pointer' : 'not-allowed', opacity: draft.from && draft.to ? 1 : 0.5 }}
            >
              החל
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
