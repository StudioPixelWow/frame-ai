'use client';

import React from 'react';
import type { AIEditDraft, SafetyReport } from '@/lib/video-editor/types';

interface AIEditDraftPanelProps {
  draft: AIEditDraft;
  onAccept: () => void;
  onRevert: () => void;
  safetyReport: SafetyReport | null;
}

/**
 * AIEditDraftPanel Component
 * Displays AI-generated edit draft with reasoning and safety warnings
 */
const AIEditDraftPanel = React.memo(function AIEditDraftPanel({
  draft,
  onAccept,
  onRevert,
  safetyReport,
}: AIEditDraftPanelProps) {
  const confidencePercent = Math.round(draft.confidence * 100);

  const getSeverityColor = (severity: 'info' | 'warning' | 'error'): string => {
    const colors: Record<string, string> = {
      info: 'ved-severity-info',
      warning: 'ved-severity-warning',
      error: 'ved-severity-error',
    };
    return colors[severity] || '';
  };

  return (
    <div className="ved-ai-draft-panel">
      {/* Header */}
      <div className="ved-draft-header">
        <h2>טיוטת AI</h2>
        <div className="ved-confidence-badge">{confidencePercent}% ביטחון</div>
      </div>

      {/* Reasoning */}
      <div className="ved-reasoning-block">
        <blockquote className="ved-reasoning-text">
          "{draft.reasoningHe}"
        </blockquote>
      </div>

      {/* Stats */}
      <div className="ved-draft-stats">
        <div className="ved-stat">
          <span className="ved-stat-label">קליפים:</span>
          <span className="ved-stat-value">{draft.clips.length}</span>
        </div>
        <div className="ved-stat">
          <span className="ved-stat-label">מעברים:</span>
          <span className="ved-stat-value">{draft.transitions.length}</span>
        </div>
        <div className="ved-stat">
          <span className="ved-stat-label">אפקטי תנועה:</span>
          <span className="ved-stat-value">{draft.motions.length}</span>
        </div>
        <div className="ved-stat">
          <span className="ved-stat-label">כתוביות:</span>
          <span className="ved-stat-value">{draft.captions.length}</span>
        </div>
      </div>

      {/* Safety Warnings */}
      {safetyReport && safetyReport.warnings.length > 0 && (
        <div className="ved-safety-section">
          <h3>אזהרות בטיחות</h3>
          <div className="ved-warnings-list">
            {safetyReport.warnings.map((warning, idx) => (
              <div
                key={idx}
                className={`ved-warning-badge ${getSeverityColor(warning.severity)}`}
                title={warning.messageHe}
              >
                <span className="ved-warning-icon">
                  {warning.severity === 'error' ? '⚠️' : warning.severity === 'warning' ? '⚡' : 'ℹ️'}
                </span>
                <span className="ved-warning-text">{warning.messageHe}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Timestamp */}
      <div className="ved-draft-timestamp">
        {new Date(draft.createdAt).toLocaleString('he-IL')}
      </div>

      {/* Actions */}
      <div className="ved-draft-actions">
        <button className="ved-btn ved-btn-primary" onClick={onAccept}>
          אשר טיוטה
        </button>
        <button className="ved-btn ved-btn-outline" onClick={onRevert}>
          בטל
        </button>
      </div>
    </div>
  );
});

export default AIEditDraftPanel;
