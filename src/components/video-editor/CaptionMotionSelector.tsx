'use client';

import React from 'react';
import type { CaptionAnimationType, SubtitleStyleId } from '@/lib/video-editor/types';
import { CAPTION_ANIMATIONS, SUBTITLE_STYLES } from '@/lib/video-editor/captions';

interface CaptionMotionSelectorProps {
  selectedAnimation: CaptionAnimationType | null;
  selectedStyle: SubtitleStyleId | null;
  onAnimationSelect: (id: CaptionAnimationType) => void;
  onStyleSelect: (id: SubtitleStyleId) => void;
}

/**
 * CaptionMotionSelector Component
 * Dual selector for caption animations and subtitle styles
 */
const CaptionMotionSelector = React.memo(function CaptionMotionSelector({
  selectedAnimation,
  selectedStyle,
  onAnimationSelect,
  onStyleSelect,
}: CaptionMotionSelectorProps) {
  const animations = Object.values(CAPTION_ANIMATIONS);
  const styles = Object.values(SUBTITLE_STYLES);

  return (
    <div className="ved-caption-motion-selector">
      {/* Animation Section */}
      <section className="ved-animation-section">
        <h3>אנימציית טקסט</h3>
        <div className="ved-animation-list">
          {animations.map((anim) => {
            const isSelected = selectedAnimation === anim.id;

            return (
              <button
                key={anim.id}
                className={`ved-animation-item ${isSelected ? 'ved-selected' : ''}`}
                onClick={() => onAnimationSelect(anim.id)}
                title={anim.description}
              >
                <span className="ved-animation-icon">{anim.icon}</span>
                <span className="ved-animation-name">{anim.nameHe}</span>
              </button>
            );
          })}
        </div>
      </section>

      {/* Style Section */}
      <section className="ved-style-section">
        <h3>סגנון כתוביות</h3>
        <div className="ved-style-list">
          {styles.map((style) => {
            const isSelected = selectedStyle === style.id;

            return (
              <button
                key={style.id}
                className={`ved-style-item ${isSelected ? 'ved-selected' : ''}`}
                onClick={() => onStyleSelect(style.id)}
              >
                <div className="ved-style-preview">
                  <div
                    className="ved-preview-text"
                    style={{
                      fontFamily: style.fontFamily,
                      fontSize: `${Math.max(style.fontSize * 0.6, 12)}px`,
                      fontWeight: style.fontWeight,
                      color: style.color,
                      backgroundColor: style.backgroundColor,
                      borderRadius: `${style.borderRadius}px`,
                      padding: style.padding,
                      textTransform: style.textTransform as any,
                      maxWidth: '120px',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    טקסט לדוגמה
                  </div>
                </div>
                <span className="ved-style-name">{style.nameHe}</span>
              </button>
            );
          })}
        </div>
      </section>
    </div>
  );
});

export default CaptionMotionSelector;
