'use client';

import React from 'react';
import type { StylePackId } from '@/lib/video-editor/types';
import { STYLE_PACKS } from '@/lib/video-editor/ai-director';

interface StylePackSelectorProps {
  selectedPack: StylePackId | null;
  recommendedPack: StylePackId | null;
  onSelect: (id: StylePackId) => void;
}

/**
 * StylePackSelector Component
 * Grid display of available style packs with selection
 */
const StylePackSelector = React.memo(function StylePackSelector({
  selectedPack,
  recommendedPack,
  onSelect,
}: StylePackSelectorProps) {
  const packs = Object.values(STYLE_PACKS);

  const getPacingLabel = (pacing: string): string => {
    const labels: Record<string, string> = {
      slow_premium: 'איטי וחלק',
      medium_commercial: 'בינוני וקצב',
      fast_social: 'מהיר וחיוני',
      aggressive_viral: 'אגרסיבי ווירלי',
    };
    return labels[pacing] || pacing;
  };

  return (
    <div className="ved-style-pack-selector">
      <h3 className="ved-selector-title">בחר ערכת סגנון</h3>

      <div className="ved-style-pack-grid">
        {packs.map((pack) => {
          const isSelected = selectedPack === pack.id;
          const isRecommended = recommendedPack === pack.id;

          return (
            <button
              key={pack.id}
              className={`ved-style-pack-card ${isSelected ? 'ved-selected' : ''} ${
                isRecommended ? 'ved-recommended' : ''
              }`}
              onClick={() => onSelect(pack.id)}
              title={pack.descriptionHe}
            >
              <div className="ved-pack-icon">{pack.icon}</div>

              <div className="ved-pack-content">
                <h4 className="ved-pack-name">{pack.nameHe}</h4>
                <p className="ved-pack-desc">{pack.descriptionHe}</p>

                <div className="ved-pack-meta">
                  <div className="ved-pack-pacing">{getPacingLabel(pack.pacing)}</div>
                </div>

                <div className="ved-pack-platforms">
                  {pack.recommendedPlatforms.slice(0, 2).map((platform) => (
                    <span key={platform} className="ved-platform-badge">
                      {platform}
                    </span>
                  ))}
                </div>
              </div>

              {isRecommended && <div className="ved-badge ved-badge-corner">מומלץ</div>}
            </button>
          );
        })}
      </div>
    </div>
  );
});

export default StylePackSelector;
