'use client';

/**
 * AdPreviewCard — Apple-style ad variation preview
 *
 * Shows generated ad variation with:
 * - Platform preview (Meta / TikTok style)
 * - Primary text, headline, CTA
 * - Angle badge + AI explanation
 * - Approve / Reject / Edit actions
 */

import { useState } from 'react';

interface AdPreviewProps {
  variation: {
    tempId: string;
    angle: string;
    angleLabel: string;
    primaryText: string;
    headline: string;
    description: string;
    cta: string;
    hook: string;
    platformFit: string[];
    aiExplanation: string;
    sourceType: string;
    sourceTitle: string;
  };
  onApprove?: (tempId: string) => void;
  onReject?: (tempId: string) => void;
  onEdit?: (tempId: string) => void;
  saving?: boolean;
}

const ANGLE_COLORS: Record<string, string> = {
  emotional: '#ec4899',
  direct: '#3b82f6',
  curiosity: '#f59e0b',
  authority: '#8b5cf6',
};

const ANGLE_ICONS: Record<string, string> = {
  emotional: '❤️',
  direct: '🎯',
  curiosity: '🔍',
  authority: '🏆',
};

const PLATFORM_ICONS: Record<string, string> = {
  meta: '📘',
  tiktok: '🎵',
  instagram: '📸',
  linkedin: '💼',
  general: '🌐',
};

export default function AdPreviewCard({ variation: v, onApprove, onReject, onEdit, saving }: AdPreviewProps) {
  const [expanded, setExpanded] = useState(false);
  const accentColor = ANGLE_COLORS[v.angle] || '#6b7280';

  return (
    <div style={{
      background: 'var(--surface)',
      border: '1px solid rgba(0,0,0,0.06)',
      borderRadius: '1rem',
      overflow: 'hidden',
      transition: 'transform 0.25s ease, box-shadow 0.25s ease',
    }}
    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)'; (e.currentTarget as HTMLElement).style.boxShadow = '0 8px 25px rgba(0,0,0,0.06)'; }}
    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = 'none'; (e.currentTarget as HTMLElement).style.boxShadow = 'none'; }}
    >
      {/* ── Header strip ── */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0.75rem 1.15rem', borderBottom: '1px solid rgba(0,0,0,0.04)',
        background: `${accentColor}04`,
      }}>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <span style={{
            fontSize: '0.65rem', fontWeight: 700, padding: '0.2rem 0.55rem', borderRadius: '999px',
            background: `${accentColor}10`, color: accentColor,
          }}>
            {ANGLE_ICONS[v.angle] || '💡'} {v.angleLabel}
          </span>
          {v.platformFit.map(p => (
            <span key={p} style={{ fontSize: '0.85rem' }} title={p}>
              {PLATFORM_ICONS[p] || '🌐'}
            </span>
          ))}
        </div>
        <span style={{ fontSize: '0.62rem', color: 'var(--foreground-subtle)' }}>
          {v.sourceTitle.slice(0, 25)}
        </span>
      </div>

      {/* ── Mock ad preview ── */}
      <div style={{ padding: '1.25rem 1.15rem' }}>
        {/* Meta-style preview frame */}
        <div style={{
          background: 'rgba(0,0,0,0.02)', borderRadius: '0.75rem', padding: '1rem',
          border: '1px solid rgba(0,0,0,0.04)',
        }}>
          {/* Ad text */}
          <div style={{
            fontSize: '0.85rem', lineHeight: 1.6, color: 'var(--foreground)',
            marginBottom: '0.75rem', whiteSpace: 'pre-line',
            maxHeight: expanded ? 'none' : '4.5rem', overflow: 'hidden',
          }}>
            {v.primaryText}
          </div>
          {v.primaryText.length > 120 && (
            <button onClick={() => setExpanded(!expanded)} style={{
              background: 'none', border: 'none', color: 'var(--foreground-muted)',
              fontSize: '0.75rem', cursor: 'pointer', padding: 0, marginBottom: '0.75rem',
              fontWeight: 600,
            }}>
              {expanded ? 'הצג פחות' : 'קרא עוד...'}
            </button>
          )}

          {/* Headline + CTA row */}
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            background: 'rgba(0,0,0,0.03)', borderRadius: '0.5rem', padding: '0.65rem 0.85rem',
          }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: '0.85rem', lineHeight: 1.3 }}>{v.headline}</div>
              {v.description && (
                <div style={{ fontSize: '0.72rem', color: 'var(--foreground-muted)', marginTop: '0.1rem' }}>
                  {v.description.slice(0, 60)}
                </div>
              )}
            </div>
            <span style={{
              fontSize: '0.72rem', fontWeight: 700, padding: '0.35rem 0.75rem',
              borderRadius: '0.4rem', background: accentColor, color: '#fff',
              whiteSpace: 'nowrap', flexShrink: 0,
            }}>
              {v.cta}
            </span>
          </div>
        </div>

        {/* Hook preview */}
        {v.hook && (
          <div style={{
            marginTop: '0.75rem', padding: '0.6rem 0.85rem',
            background: 'rgba(245,158,11,0.04)', borderRadius: '0.5rem',
            border: '1px solid rgba(245,158,11,0.1)',
          }}>
            <div style={{ fontSize: '0.65rem', fontWeight: 600, color: '#f59e0b', marginBottom: '0.2rem' }}>
              ⏱️ הוק — 3 שניות ראשונות
            </div>
            <div style={{ fontSize: '0.78rem', color: 'var(--foreground)', fontStyle: 'italic', lineHeight: 1.4 }}>
              "{v.hook}"
            </div>
          </div>
        )}

        {/* AI explanation */}
        <div style={{
          marginTop: '0.75rem', display: 'flex', gap: '0.4rem', alignItems: 'flex-start',
        }}>
          <span style={{ fontSize: '0.75rem', flexShrink: 0 }}>🤖</span>
          <span style={{ fontSize: '0.72rem', color: 'var(--foreground-muted)', lineHeight: 1.5 }}>
            {v.aiExplanation}
          </span>
        </div>
      </div>

      {/* ── Actions ── */}
      {(onApprove || onReject) && (
        <div style={{
          display: 'flex', gap: '0.5rem', padding: '0 1.15rem 1.15rem',
        }}>
          {onApprove && (
            <button onClick={() => onApprove(v.tempId)} disabled={saving} style={{
              flex: 1, padding: '0.65rem', border: 'none', borderRadius: '0.6rem',
              background: '#22c55e', color: '#fff', fontSize: '0.82rem', fontWeight: 700,
              cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.6 : 1,
              transition: 'all 0.2s ease',
            }}>
              ✓ אשר ושמור
            </button>
          )}
          {onEdit && (
            <button onClick={() => onEdit(v.tempId)} style={{
              padding: '0.65rem 1rem', border: '1px solid rgba(0,0,0,0.08)', borderRadius: '0.6rem',
              background: 'var(--surface)', color: 'var(--foreground)', fontSize: '0.82rem', fontWeight: 600,
              cursor: 'pointer', transition: 'all 0.2s ease',
            }}>
              ✏️ ערוך
            </button>
          )}
          {onReject && (
            <button onClick={() => onReject(v.tempId)} style={{
              padding: '0.65rem 1rem', border: '1px solid rgba(0,0,0,0.08)', borderRadius: '0.6rem',
              background: 'var(--surface)', color: 'var(--foreground-muted)', fontSize: '0.82rem', fontWeight: 600,
              cursor: 'pointer', transition: 'all 0.2s ease',
            }}>
              ✕ דחה
            </button>
          )}
        </div>
      )}
    </div>
  );
}
