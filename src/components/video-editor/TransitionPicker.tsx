'use client';

import React, { useRef, useEffect } from 'react';
import type { TransitionType } from '@/lib/video-editor/types';
import {
  TRANSITION_PRESETS,
  TRANSITION_CATEGORY_LABELS,
  getTransitionsByCategory,
} from '@/lib/video-editor/transitions';

interface TransitionPickerProps {
  selectedType: TransitionType | null;
  recommendedTypes: TransitionType[];
  onSelect: (type: TransitionType) => void;
  onClose: () => void;
}

/**
 * TransitionPicker Component
 * Displays transitions organized by category with recommendations
 */
const TransitionPicker = React.memo(function TransitionPicker({
  selectedType,
  recommendedTypes,
  onSelect,
  onClose,
}: TransitionPickerProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  // Handle click outside to close
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(event.target as Node)) {
        onClose();
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  const categories = Object.keys(TRANSITION_CATEGORY_LABELS) as Array<keyof typeof TRANSITION_CATEGORY_LABELS>;

  return (
    <div className="ved-transition-picker" ref={panelRef}>
      <div className="ved-transition-picker-header">
        <h3>בחר מעבר</h3>
        <button className="ved-close-btn" onClick={onClose} aria-label="סגור">
          ✕
        </button>
      </div>

      <div className="ved-transition-picker-content">
        {categories.map((category) => {
          const transitions = getTransitionsByCategory(category);
          const label = TRANSITION_CATEGORY_LABELS[category];

          return (
            <div key={category} className="ved-transition-category">
              <h4 className="ved-category-title">{label.nameHe}</h4>

              <div className="ved-transition-list">
                {transitions.map((preset) => {
                  const isSelected = selectedType === preset.id;
                  const isRecommended = recommendedTypes.includes(preset.id);

                  return (
                    <button
                      key={preset.id}
                      className={`ved-transition-item ${isSelected ? 'ved-selected' : ''} ${
                        isRecommended ? 'ved-recommended' : ''
                      }`}
                      onClick={() => {
                        onSelect(preset.id);
                        onClose();
                      }}
                      title={preset.recommendedUseCaseHe}
                    >
                      <div className="ved-transition-item-icon">{preset.icon}</div>
                      <div className="ved-transition-item-content">
                        <div className="ved-transition-item-name">{preset.nameHe}</div>
                        <div className="ved-transition-item-desc">{preset.recommendedUseCaseHe}</div>
                      </div>
                      {isRecommended && <div className="ved-badge">מומלץ</div>}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
});

export default TransitionPicker;
