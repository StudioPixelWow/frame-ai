import React, {
  useRef,
  useState,
  useCallback,
  useMemo,
  CSSProperties,
} from 'react';

interface TimelineEditorProps {
  /** Total duration in seconds */
  durationSec: number;
  /** Current playback time in seconds (controlled) */
  currentTime: number;
  /** Callback when user seeks */
  onSeek: (timeSec: number) => void;
  /** Format for display */
  format: string;
  /** Subtitle segments */
  segments: Array<{
    id: string;
    startSec: number;
    endSec: number;
    text: string;
  }>;
  /** B-roll placements */
  brollPlacements: Array<{
    id: string;
    startSec: number;
    endSec: number;
    keyword: string;
    source: string;
  }>;
  /** Music config */
  musicEnabled: boolean;
  musicTrackId: string;
  musicVolume: number;
  /** Cleanup cuts */
  cleanupSegments: Array<{
    id: string;
    startSec: number;
    endSec: number;
    type: string;
    removed: boolean;
  }>;
  /** Transition style */
  transitionStyle: string;
  /** Premium mode */
  premiumMode: boolean;
  premiumLevel: string;
  /** Callbacks for editing */
  onRemoveBroll?: (id: string) => void;
  onMoveBroll?: (id: string, newStartSec: number, newEndSec: number) => void;
  onSelectSegment?: (id: string) => void;
  onToggleCleanup?: (id: string) => void;
  /** Selected item for highlight */
  selectedItemId?: string | null;
  /** Whether editor is in interactive mode */
  interactive?: boolean;
}

/**
 * Format seconds to M:SS format
 */
function fmtTimeShort(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

const TimelineEditor: React.FC<TimelineEditorProps> = ({
  durationSec,
  currentTime,
  onSeek,
  format,
  segments,
  brollPlacements,
  musicEnabled,
  musicTrackId,
  musicVolume,
  cleanupSegments,
  transitionStyle,
  premiumMode,
  premiumLevel,
  onRemoveBroll,
  onMoveBroll,
  onSelectSegment,
  onToggleCleanup,
  selectedItemId,
  interactive = true,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const timelineRef = useRef<HTMLDivElement>(null);
  const [draggedBrollId, setDraggedBrollId] = useState<string | null>(null);
  const [dragStartX, setDragStartX] = useState(0);
  const [dragStartTime, setDragStartTime] = useState(0);
  const [hoveredCleanupId, setHoveredCleanupId] = useState<string | null>(null);

  // Constants
  const PIXELS_PER_SECOND = 60;
  const TRACK_HEIGHT = 28;
  const HEADER_HEIGHT = 40;
  const LABEL_WIDTH = 90;
  const TOTAL_HEIGHT = HEADER_HEIGHT + TRACK_HEIGHT * 5 + 4;

  // Calculate total timeline width
  const timelineWidth = Math.max(800, durationSec * PIXELS_PER_SECOND);

  /**
   * Convert pixel position to time
   */
  const pixelToTime = useCallback((px: number): number => {
    if (!timelineRef.current) return 0;
    const rect = timelineRef.current.getBoundingClientRect();
    const relativeX = px - rect.left + (timelineRef.current.parentElement?.scrollLeft || 0);
    return Math.max(0, Math.min(durationSec, relativeX / PIXELS_PER_SECOND));
  }, [durationSec]);

  /**
   * Convert time to pixel position
   */
  const timeToPixel = useCallback((timeSec: number): number => {
    return timeSec * PIXELS_PER_SECOND;
  }, []);

  /**
   * Generate time markers for ruler
   */
  const timeMarkers = useMemo(() => {
    const markers: Array<{ time: number; label: string; isMajor: boolean }> = [];
    const step = durationSec > 120 ? 10 : durationSec > 60 ? 5 : 1;

    for (let i = 0; i <= durationSec; i += step) {
      markers.push({
        time: i,
        label: fmtTimeShort(i),
        isMajor: i % (step * 5) === 0,
      });
    }
    return markers;
  }, [durationSec]);

  // Event Handlers
  const handleTimelineClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!interactive) return;
    const time = pixelToTime(e.clientX);
    onSeek(time);
  }, [pixelToTime, onSeek, interactive]);

  const handleSegmentClick = useCallback((e: React.MouseEvent<HTMLDivElement>, segmentId: string) => {
    e.stopPropagation();
    if (interactive && onSelectSegment) {
      onSelectSegment(segmentId);
    }
  }, [interactive, onSelectSegment]);

  const handleBrollMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>, brollId: string) => {
    if (!interactive || !onMoveBroll) return;
    e.stopPropagation();
    setDraggedBrollId(brollId);
    setDragStartX(e.clientX);
    const placement = brollPlacements.find(b => b.id === brollId);
    if (placement) {
      setDragStartTime(placement.startSec);
    }
  }, [interactive, onMoveBroll, brollPlacements]);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!draggedBrollId || !onMoveBroll) return;
    const placement = brollPlacements.find(b => b.id === draggedBrollId);
    if (!placement) return;

    const deltaX = e.clientX - dragStartX;
    const deltaTime = deltaX / PIXELS_PER_SECOND;
    const newStartTime = Math.max(0, Math.min(durationSec - (placement.endSec - placement.startSec), dragStartTime + deltaTime));
    const newEndTime = newStartTime + (placement.endSec - placement.startSec);

    onMoveBroll(draggedBrollId, newStartTime, newEndTime);
  }, [draggedBrollId, dragStartX, dragStartTime, brollPlacements, onMoveBroll, durationSec, PIXELS_PER_SECOND]);

  const handleMouseUp = useCallback(() => {
    setDraggedBrollId(null);
  }, []);

  // Inline Styles
  const containerStyle: CSSProperties = {
    direction: 'ltr',
    display: 'flex',
    flexDirection: 'column',
    backgroundColor: '#0f0f1a',
    borderRadius: '8px',
    overflow: 'hidden',
    height: TOTAL_HEIGHT,
    fontFamily: 'system-ui, -apple-system, sans-serif',
    fontSize: '12px',
    color: '#fff',
  };

  const headerContainerStyle: CSSProperties = {
    display: 'flex',
    height: HEADER_HEIGHT,
    backgroundColor: '#0f0f1a',
    borderBottom: '1px solid #333',
  };

  const labelPlaceholderStyle: CSSProperties = {
    width: LABEL_WIDTH,
    flexShrink: 0,
    backgroundColor: '#0f0f1a',
  };

  const rulerStyle: CSSProperties = {
    flex: 1,
    overflow: 'hidden',
    position: 'relative',
  };

  const rulerInnerStyle: CSSProperties = {
    display: 'flex',
    height: '100%',
    position: 'relative',
    width: timelineWidth,
  };

  const markerStyle = (isMajor: boolean): CSSProperties => ({
    position: 'absolute',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'flex-end',
    height: '100%',
    paddingBottom: '4px',
  });

  const markerLineStyle = (isMajor: boolean): CSSProperties => ({
    width: '1px',
    height: isMajor ? '8px' : '4px',
    backgroundColor: isMajor ? '#666' : '#444',
    marginBottom: '2px',
  });

  const markerLabelStyle: CSSProperties = {
    fontSize: '10px',
    color: '#999',
  };

  const tracksContainerStyle: CSSProperties = {
    flex: 1,
    display: 'flex',
    overflow: 'auto',
    position: 'relative',
    backgroundColor: '#0f0f1a',
  };

  const tracksWrapperStyle: CSSProperties = {
    display: 'flex',
    width: '100%',
  };

  const labelsStyle: CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    width: LABEL_WIDTH,
    flexShrink: 0,
    backgroundColor: '#0f0f1a',
    borderRight: '1px solid #333',
  };

  const labelItemStyle: CSSProperties = {
    height: TRACK_HEIGHT,
    display: 'flex',
    alignItems: 'center',
    paddingRight: '8px',
    paddingLeft: '8px',
    fontSize: '11px',
    color: '#aaa',
    textAlign: 'right',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    borderBottom: '1px solid #222',
  };

  const timelineContainerStyle: CSSProperties = {
    flex: 1,
    position: 'relative',
    overflow: 'hidden',
    cursor: interactive ? 'pointer' : 'default',
  };

  const trackStyle: CSSProperties = {
    height: TRACK_HEIGHT,
    backgroundColor: '#1a1a2e',
    position: 'relative',
    borderBottom: '1px solid #222',
    overflow: 'hidden',
  };

  const mainVideoTrackStyle: CSSProperties = {
    ...trackStyle,
    display: 'flex',
    alignItems: 'center',
    paddingLeft: '4px',
  };

  const mainVideoBarStyle: CSSProperties = {
    height: '18px',
    backgroundColor: '#1e3a8a',
    borderRadius: '3px',
    width: `${(durationSec * PIXELS_PER_SECOND)}px`,
    opacity: 0.8,
    position: 'relative',
  };

  const segmentBlockStyle = (segment: typeof segments[0], isSelected: boolean): CSSProperties => ({
    position: 'absolute',
    height: TRACK_HEIGHT - 4,
    top: '2px',
    left: `${timeToPixel(segment.startSec)}px`,
    width: `${timeToPixel(segment.endSec - segment.startSec)}px`,
    backgroundColor: isSelected ? '#3b82f6' : '#1e40af',
    borderRadius: '4px',
    cursor: interactive ? 'pointer' : 'default',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    fontSize: '10px',
    color: 'rgba(255,255,255,0.8)',
    border: isSelected ? '2px solid #60a5fa' : 'none',
    opacity: 0.85,
    minWidth: '30px',
    userSelect: 'none',
  });

  const brollBlockStyle = (placement: typeof brollPlacements[0], isSelected: boolean, isDragging: boolean): CSSProperties => ({
    position: 'absolute',
    height: TRACK_HEIGHT - 4,
    top: '2px',
    left: `${timeToPixel(placement.startSec)}px`,
    width: `${timeToPixel(placement.endSec - placement.startSec)}px`,
    backgroundColor: isSelected ? '#10b981' : '#059669',
    borderRadius: '4px',
    cursor: interactive ? (isDragging ? 'grabbing' : 'grab') : 'default',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    fontSize: '9px',
    color: 'rgba(255,255,255,0.9)',
    border: isSelected ? '2px solid #34d399' : 'none',
    opacity: isDragging ? 0.7 : 0.85,
    minWidth: '30px',
    userSelect: 'none',
    padding: '0 4px',
  });

  const musicBarStyle: CSSProperties = {
    ...trackStyle,
    display: 'flex',
    alignItems: 'center',
    paddingLeft: '4px',
  };

  const musicBlockStyle: CSSProperties = {
    height: TRACK_HEIGHT - 4,
    top: '2px',
    left: '0px',
    width: `${timeToPixel(durationSec)}px`,
    backgroundColor: '#0073a8',
    borderRadius: '4px',
    display: 'flex',
    alignItems: 'center',
    paddingLeft: '6px',
    fontSize: '10px',
    color: 'rgba(255,255,255,0.8)',
    opacity: 0.8,
  };

  const cleanupMarkerStyle = (segment: typeof cleanupSegments[0], isHovered: boolean): CSSProperties => ({
    position: 'absolute',
    height: TRACK_HEIGHT - 4,
    top: '2px',
    left: `${timeToPixel(segment.startSec)}px`,
    width: `${Math.max(2, timeToPixel(segment.endSec - segment.startSec))}px`,
    backgroundColor: segment.removed ? '#dc2626' : '#fbbf24',
    borderRadius: '2px',
    cursor: interactive ? 'pointer' : 'default',
    opacity: isHovered ? 1 : 0.7,
    border: isHovered ? '1px solid #fff' : 'none',
    minWidth: '4px',
  });

  const playheadStyle: CSSProperties = {
    position: 'absolute',
    top: 0,
    left: `${timeToPixel(currentTime)}px`,
    width: '2px',
    height: `${TRACK_HEIGHT * 5}px`,
    backgroundColor: '#ff4444',
    zIndex: 10,
    pointerEvents: 'none',
  };

  const playheadCapStyle: CSSProperties = {
    position: 'absolute',
    top: '-6px',
    left: '-5px',
    width: '12px',
    height: '12px',
    backgroundColor: '#ff4444',
    borderRadius: '50%',
  };

  const brollRemoveButtonStyle: CSSProperties = {
    position: 'absolute',
    top: '-20px',
    right: '4px',
    backgroundColor: '#dc2626',
    color: '#fff',
    border: 'none',
    borderRadius: '3px',
    padding: '2px 6px',
    fontSize: '10px',
    cursor: 'pointer',
    zIndex: 20,
  };

  const cleanupToggleButtonStyle: CSSProperties = {
    position: 'absolute',
    top: '-20px',
    right: '4px',
    backgroundColor: '#0073a8',
    color: '#fff',
    border: 'none',
    borderRadius: '3px',
    padding: '2px 6px',
    fontSize: '10px',
    cursor: 'pointer',
    zIndex: 20,
  };

  return (
    <div
      ref={containerRef}
      style={containerStyle}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      {/* Header with time ruler */}
      <div style={headerContainerStyle}>
        <div style={labelPlaceholderStyle} />
        <div style={rulerStyle}>
          <div style={rulerInnerStyle}>
            {timeMarkers.map((marker) => (
              <div
                key={marker.time}
                style={{
                  ...markerStyle(marker.isMajor),
                  left: `${timeToPixel(marker.time)}px`,
                }}
              >
                <div style={markerLineStyle(marker.isMajor)} />
                {marker.isMajor && <div style={markerLabelStyle}>{marker.label}</div>}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Tracks container */}
      <div style={tracksContainerStyle}>
        <div style={tracksWrapperStyle}>
          {/* Labels */}
          <div style={labelsStyle}>
            <div style={labelItemStyle}>וידאו</div>
            <div style={labelItemStyle}>כתוביות</div>
            <div style={labelItemStyle}>B-Roll</div>
            {musicEnabled && <div style={labelItemStyle}>מוזיקה</div>}
            <div style={labelItemStyle}>ניקוי</div>
          </div>

          {/* Timeline */}
          <div
            ref={timelineRef}
            style={timelineContainerStyle}
            onClick={handleTimelineClick}
          >
            <div style={{ position: 'relative', width: timelineWidth, height: TRACK_HEIGHT * 5 }}>
              {/* Track 1: Main Video */}
              <div style={mainVideoTrackStyle}>
                <div style={mainVideoBarStyle} />
              </div>

              {/* Track 2: Subtitles */}
              <div style={trackStyle}>
                {segments.map((segment) => (
                  <div
                    key={segment.id}
                    style={segmentBlockStyle(segment, selectedItemId === segment.id)}
                    onClick={(e) => handleSegmentClick(e, segment.id)}
                    title={segment.text}
                  >
                    {segment.text.length > 0 && (
                      <span
                        style={{
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          fontSize: '9px',
                        }}
                      >
                        {segment.text}
                      </span>
                    )}
                  </div>
                ))}
              </div>

              {/* Track 3: B-Roll */}
              <div style={trackStyle}>
                {brollPlacements.map((placement) => (
                  <div
                    key={placement.id}
                    style={brollBlockStyle(placement, selectedItemId === placement.id, draggedBrollId === placement.id)}
                    onMouseDown={(e) => handleBrollMouseDown(e, placement.id)}
                    title={`${placement.keyword} - ${placement.source}`}
                  >
                    {draggedBrollId === placement.id && (
                      <button
                        style={brollRemoveButtonStyle}
                        onClick={(e) => {
                          e.stopPropagation();
                          onRemoveBroll?.(placement.id);
                        }}
                      >
                        הסר
                      </button>
                    )}
                    <span
                      style={{
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        fontSize: '8px',
                      }}
                    >
                      {placement.keyword}
                    </span>
                  </div>
                ))}
              </div>

              {/* Track 4: Music (if enabled) */}
              {musicEnabled && (
                <div style={musicBarStyle}>
                  <div style={musicBlockStyle}>
                    ♪ {musicTrackId ? `Vol: ${Math.round(musicVolume * 100)}%` : 'מוזיקה'}
                  </div>
                </div>
              )}

              {/* Track 5: Cleanup */}
              <div style={trackStyle}>
                {cleanupSegments.map((segment) => (
                  <div
                    key={segment.id}
                    style={{
                      ...cleanupMarkerStyle(segment, hoveredCleanupId === segment.id),
                      position: 'relative',
                    }}
                    onMouseEnter={() => setHoveredCleanupId(segment.id)}
                    onMouseLeave={() => setHoveredCleanupId(null)}
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleCleanup?.(segment.id);
                    }}
                    title={`${segment.type} - ${segment.removed ? 'הוסר' : 'פעיל'}`}
                  >
                    {hoveredCleanupId === segment.id && (
                      <button
                        style={cleanupToggleButtonStyle}
                        onClick={(e) => {
                          e.stopPropagation();
                          onToggleCleanup?.(segment.id);
                        }}
                      >
                        {segment.removed ? 'שחזר' : 'הסר'}
                      </button>
                    )}
                  </div>
                ))}
              </div>

              {/* Playhead */}
              <div style={playheadStyle}>
                <div style={playheadCapStyle} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TimelineEditor;
