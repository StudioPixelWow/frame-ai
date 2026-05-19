'use client';

import React from 'react';

/* ═══════════════════════════════════════════════════════════════════════════
   Types
   ═══════════════════════════════════════════════════════════════════════════ */

export type ProcessingStageStatus = 'pending' | 'running' | 'done' | 'error';

export interface ProcessingStageItem {
  key: string;
  label: string;
  status: ProcessingStageStatus;
  progress: number;
}

interface ProcessingStageProps {
  processingStages: ProcessingStageItem[];
  episodeTitle?: string;
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

/* ═══════════════════════════════════════════════════════════════════════════
   Helpers
   ═══════════════════════════════════════════════════════════════════════════ */

function statusIcon(status: ProcessingStageStatus): string {
  switch (status) {
    case 'pending':
      return '⏳';
    case 'running':
      return '⚡';
    case 'done':
      return '✅';
    case 'error':
      return '❌';
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
   Component
   ═══════════════════════════════════════════════════════════════════════════ */

export default function ProcessingStage({
  processingStages,
  episodeTitle,
}: ProcessingStageProps) {
  return (
    <div style={{ maxWidth: 600, margin: '0 auto', direction: 'rtl' }}>
      <div style={cardStyle}>
        <h3
          style={{
            fontSize: 20,
            fontWeight: 700,
            color: COLORS.text,
            margin: '0 0 24px',
            textAlign: 'center',
          }}
        >
          {episodeTitle ? `מעבד: ${episodeTitle}` : 'מעבד את הפרק...'}
        </h3>
        <div style={{ display: 'grid', gap: 20 }}>
          {processingStages.map((stage) => (
            <div key={stage.key}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: 6,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 18 }}>{statusIcon(stage.status)}</span>
                  <span
                    style={{
                      fontSize: 15,
                      fontWeight: stage.status === 'running' ? 700 : 500,
                      color: stage.status === 'running' ? COLORS.primary : COLORS.text,
                    }}
                  >
                    {stage.label}
                  </span>
                </div>
                {stage.status === 'running' && (
                  <span style={{ fontSize: 13, color: COLORS.primary, fontWeight: 600 }}>
                    {Math.round(stage.progress)}%
                  </span>
                )}
              </div>
              {stage.status === 'running' && (
                <div style={{ height: 6, borderRadius: 3, background: COLORS.border }}>
                  <div
                    style={{
                      height: '100%',
                      borderRadius: 3,
                      background: COLORS.primary,
                      width: `${stage.progress}%`,
                      transition: 'width 0.3s',
                    }}
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
