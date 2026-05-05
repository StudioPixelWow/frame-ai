"use client";

import { useState } from 'react';

interface Evidence {
  source: string;
  url?: string;
  snippet: string;
  confidence: number;
  dataPoint?: string;
}

interface EvidenceDrawerProps {
  evidence: Evidence | Evidence[];
  label?: string;
  compact?: boolean;
}

const C = {
  primary: '#00B5FE',
  success: '#10B981',
  warning: '#F59E0B',
  danger: '#EF4444',
  text: '#1A1A2E',
  textMuted: '#9A9AB0',
  bg: '#F7F9FC',
  card: '#FFFFFF',
  border: '#E8EAF0',
};

function getConfidenceColor(confidence: number): string {
  if (confidence >= 80) return C.success;
  if (confidence >= 50) return C.warning;
  return C.danger;
}

function getConfidenceLabel(confidence: number): string {
  if (confidence >= 80) return 'גבוהה';
  if (confidence >= 50) return 'בינונית';
  return 'נמוכה';
}

export function EvidenceDrawer({ evidence, label = 'צפה בראיות', compact = false }: EvidenceDrawerProps) {
  const [open, setOpen] = useState(false);
  const items = Array.isArray(evidence) ? evidence : [evidence];

  if (items.length === 0) return null;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 4,
          padding: compact ? '2px 8px' : '4px 12px',
          fontSize: compact ? 10 : 11,
          fontWeight: 600,
          color: C.primary,
          background: `${C.primary}08`,
          border: `1px solid ${C.primary}25`,
          borderRadius: 6,
          cursor: 'pointer',
          transition: 'all 0.15s',
        }}
      >
        <span style={{ fontSize: compact ? 10 : 12 }}>🔍</span>
        {label}
      </button>

      {open && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 9999,
          display: 'flex', justifyContent: 'flex-start',
          direction: 'rtl',
        }}>
          {/* Backdrop */}
          <div
            onClick={() => setOpen(false)}
            style={{
              flex: 1, background: 'rgba(0,0,0,0.3)',
              backdropFilter: 'blur(4px)',
            }}
          />
          {/* Drawer */}
          <div style={{
            width: 420, maxWidth: '90vw',
            background: C.card,
            borderLeft: `1px solid ${C.border}`,
            boxShadow: '-8px 0 32px rgba(0,0,0,0.1)',
            overflowY: 'auto',
            padding: 28,
            display: 'flex', flexDirection: 'column', gap: 20,
          }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: 18, fontWeight: 700, color: C.text, margin: 0 }}>
                ראיות ומקורות
              </h3>
              <button
                onClick={() => setOpen(false)}
                style={{
                  width: 32, height: 32, borderRadius: 8,
                  border: `1px solid ${C.border}`,
                  background: 'transparent', cursor: 'pointer',
                  fontSize: 16, color: C.textMuted,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >×</button>
            </div>

            {/* Evidence items */}
            {items.map((item, i) => (
              <div key={i} style={{
                padding: 16, borderRadius: 12,
                background: C.bg,
                border: `1px solid ${C.border}`,
              }}>
                {/* Source + Confidence */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <span style={{
                    fontSize: 11, fontWeight: 600,
                    padding: '2px 8px', borderRadius: 4,
                    background: `${C.primary}10`, color: C.primary,
                  }}>
                    {item.source}
                  </span>
                  <span style={{
                    fontSize: 10, fontWeight: 600,
                    padding: '2px 8px', borderRadius: 4,
                    background: `${getConfidenceColor(item.confidence)}15`,
                    color: getConfidenceColor(item.confidence),
                  }}>
                    אמינות: {getConfidenceLabel(item.confidence)} ({item.confidence}%)
                  </span>
                </div>

                {/* URL */}
                {item.url && (
                  <div style={{ marginBottom: 8 }}>
                    <span style={{ fontSize: 10, color: C.textMuted }}>מקור: </span>
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ fontSize: 11, color: C.primary, textDecoration: 'none' }}
                    >
                      {item.url.length > 60 ? item.url.slice(0, 60) + '...' : item.url}
                    </a>
                  </div>
                )}

                {/* Data point */}
                {item.dataPoint && (
                  <div style={{
                    fontSize: 12, color: C.text, fontWeight: 600,
                    padding: '8px 12px', borderRadius: 8,
                    background: C.card, marginBottom: 8,
                    border: `1px solid ${C.border}`,
                  }}>
                    📊 {item.dataPoint}
                  </div>
                )}

                {/* Snippet */}
                <div style={{
                  fontSize: 12, color: C.text, lineHeight: 1.7,
                  padding: '10px 12px', borderRadius: 8,
                  background: C.card,
                  borderRight: `3px solid ${C.primary}`,
                }}>
                  &ldquo;{item.snippet}&rdquo;
                </div>
              </div>
            ))}

            {/* Footer note */}
            <p style={{ fontSize: 10, color: C.textMuted, textAlign: 'center', margin: 0 }}>
              כל תובנה מבוססת על נתונים אמיתיים בלבד — ללא השערות
            </p>
          </div>
        </div>
      )}
    </>
  );
}

/**
 * Inline evidence badge — shows confidence + hover preview
 */
export function EvidenceBadge({ confidence, source }: { confidence: number; source: string }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 3,
      fontSize: 9, fontWeight: 600,
      padding: '1px 6px', borderRadius: 4,
      background: `${getConfidenceColor(confidence)}10`,
      color: getConfidenceColor(confidence),
    }}>
      {confidence}% • {source}
    </span>
  );
}
