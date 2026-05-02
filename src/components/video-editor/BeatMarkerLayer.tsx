'use client';

import React from 'react';
import type { BeatMarker } from '@/lib/video-editor/types';

interface BeatMarkerLayerProps {
  markers: BeatMarker[];
  pixelsPerSecond: number;
  visible: boolean;
}

const BeatMarkerLayer = React.memo(function BeatMarkerLayer({
  markers,
  pixelsPerSecond,
  visible,
}: BeatMarkerLayerProps) {
  if (!visible || markers.length === 0) {
    return null;
  }

  return (
    <div
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
      }}
    >
      {markers.map((marker, index) => (
        <div
          key={`${marker.time}-${index}`}
          className={`ved-beat-marker ${marker.isDownbeat ? 'downbeat' : ''}`}
          style={{
            left: `${marker.time * pixelsPerSecond}px`,
            opacity: marker.strength,
          }}
          role="presentation"
        />
      ))}
    </div>
  );
});

export default BeatMarkerLayer;
