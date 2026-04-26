'use client';

import React from 'react';
import type { MotionEffectType, EffectIntensity } from '@/lib/video-editor/types';
import { MOTION_PRESETS } from '@/lib/video-editor/motion';

interface MotionEffectPickerProps {
  selectedMotion: MotionEffectType | null;
  selectedIntensity: EffectIntensity;
  recommendedMotion: MotionEffectType | null;
  onSelect: (type: MotionEffectType, intensity: EffectIntensity) => void;
  onClose: () => void;
}

/**
 * MotionEffectPicker Component
 * Displays motion effect presets with intensity selector
 */
const MotionEffectPicker = React.memo(function MotionEffectPicker({
  selectedMotion,
  selectedIntensity,
  recommendedMotion,
  onSelect,
  onClose,
}: MotionEffectPickerProps) {
  const motionTypes = Object.values(MOTION_PRESETS);

  return (
    <div className="ved-motion-picker">
      <div className="ved-motion-picker-header">
        <h3>תנועה ואפקטים</h3>
        <button className="ved-close-btn" onClick={onClose} aria-label="סגור">
          ✕
        </button>
      </div>

      <div className="ved-motion-picker-content">
        {motionTypes.map((preset) => {
          const isSelected = selectedMotion === preset.id;
          const isRecommended = recommendedMotion === preset.id;

          return (
            <div
              key={preset.id}
              className={`ved-motion-card ${isSelected ? 'ved-selected' : ''} ${
                isRecommended ? 'ved-recommended' : ''
              }`}
            >
              <div className="ved-motion-card-header">
                <div className="ved-motion-icon">{preset.icon}</div>
                <div className="ved-motion-info">
                  <div className="ved-motion-name">{preset.nameHe}</div>
                  <div className="ved-motion-desc">{preset.description}</div>
                </div>
                {isRecommended && <div className="ved-badge">מומלץ</div>}
              </div>

              <div className="ved-intensity-selector">
                <span className="ved-intensity-label">עוצמה:</span>
                <button
                  className={`ved-intensity-dot ${selectedIntensity === 'subtle' && isSelected ? 'ved-active' : ''}`}
                  onClick={() => onSelect(preset.id, 'subtle')}
                  title="עדין"
                  aria-label="עדין"
                >
                  ●
                </button>
                <button
                  className={`ved-intensity-dot ${selectedIntensity === 'medium' && isSelected ? 'ved-active' : ''}`}
                  onClick={() => onSelect(preset.id, 'medium')}
                  title="בינוני"
                  aria-label="בינוני"
                >
                  ●
                </button>
                <button
                  className={`ved-intensity-dot ${selectedIntensity === 'strong' && isSelected ? 'ved-active' : ''}`}
                  onClick={() => onSelect(preset.id, 'strong')}
                  title="חזק"
                  aria-label="חזק"
                >
                  ●
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
});

export default MotionEffectPicker;
