'use client';

import React, { useState } from 'react';
import type { VideoEditProject, AIEditDraft, SafetyReport } from '@/lib/video-editor/types';
import { generateAutoEdit } from '@/lib/video-editor/auto-edit';
import { validateEditSafety } from '@/lib/video-editor/safety';
import { getStylePack } from '@/lib/video-editor/ai-director';

interface AutoEditButtonProps {
  project: VideoEditProject;
  onDraftGenerated: (draft: AIEditDraft) => void;
  disabled?: boolean;
}

/**
 * AutoEditButton Component
 * Generates AI-powered edit drafts with safety validation
 */
const AutoEditButton = React.memo(function AutoEditButton({
  project,
  onDraftGenerated,
  disabled = false,
}: AutoEditButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAutoEdit = async () => {
    if (isLoading || disabled || project.clips.length === 0) return;

    setIsLoading(true);
    setError(null);

    try {
      // Get recommended style pack or use existing one
      let stylePack = project.stylePack;
      if (!stylePack) {
        // Default to premium_real_estate as fallback
        stylePack = 'premium_real_estate';
      }

      const stylePackConfig = getStylePack(stylePack);

      // Generate AI edit draft
      const draft = generateAutoEdit(project, stylePackConfig, project.beatSync);

      // Validate safety
      const safetyReport: SafetyReport = validateEditSafety(project);

      // Log warnings but proceed
      if (safetyReport.warnings.length > 0) {
        console.warn('Safety warnings detected:', safetyReport.warnings);
      }

      // Call the callback with generated draft
      onDraftGenerated(draft);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'שגיאה בעריכה אוטומטית';
      setError(message);
      console.error('Auto-edit error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="ved-auto-edit-container">
      <button
        className={`ved-auto-edit-btn ${isLoading ? 'ved-loading' : ''} ${disabled ? 'ved-disabled' : ''}`}
        onClick={handleAutoEdit}
        disabled={isLoading || disabled || project.clips.length === 0}
        title={project.clips.length === 0 ? 'הוסף קליפים לעריכה אוטומטית' : 'ערוך לי אוטומטית'}
      >
        {isLoading ? (
          <>
            <span className="ved-shimmer"></span>
            <span className="ved-btn-text">מעבד...</span>
          </>
        ) : (
          <>
            <span className="ved-btn-icon">✨</span>
            <span className="ved-btn-text">ערוך לי אוטומטית</span>
          </>
        )}
      </button>

      {error && <div className="ved-error-message">{error}</div>}
    </div>
  );
});

export default AutoEditButton;
