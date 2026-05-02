'use client';

import React, { useState, useMemo } from 'react';
import { ChartWrapper, ChartState } from './ChartWrapper';
import { BRAND, CHART_COLORS, formatNumber, formatPercent, getColorForIndex } from './chartTheme';

export interface DonutSegment {
  label: string;
  value: number;
  color?: string;
}

export interface PremiumDonutChartProps {
  title?: string;
  subtitle?: string;
  data: DonutSegment[];
  state?: ChartState;
  variant?: 'light' | 'dark' | 'elevated';
  size?: number;
  strokeWidth?: number;
  centerLabel?: string;
  centerValue?: string;
  showLegend?: boolean;
  headerRight?: React.ReactNode;
}

export function PremiumDonutChart({
  title, subtitle, data, state = 'ready', variant = 'light',
  size = 180, strokeWidth = 24, centerLabel, centerValue,
  showLegend = true, headerRight,
}: PremiumDonutChartProps) {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const isDark = variant === 'dark';

  const total = useMemo(() => data.reduce((s, d) => s + d.value, 0), [data]);
  const effectiveState: ChartState = (data.length === 0 || total === 0) && state === 'ready' ? 'empty' : state;

  const r = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * r;
  const cx = size / 2;
  const cy = size / 2;

  // Build segments
  const segments = useMemo(() => {
    let cumulative = 0;
    return data.map((d, i) => {
      const pct = total > 0 ? d.value / total : 0;
      const offset = cumulative;
      cumulative += pct;
      return {
        ...d,
        pct,
        offset,
        color: d.color || getColorForIndex(i),
        dasharray: `${pct * circumference} ${circumference}`,
        dashoffset: -offset * circumference,
      };
    });
  }, [data, total, circumference]);

  return (
    <ChartWrapper title={title} subtitle={subtitle} state={effectiveState} variant={variant} headerRight={headerRight}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 24, flexWrap: 'wrap', justifyContent: 'center' }}>
        {/* Donut SVG */}
        <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
          <svg viewBox={`0 0 ${size} ${size}`} style={{ width: size, height: size, transform: 'rotate(-90deg)' }}>
            {/* Background ring */}
            <circle cx={cx} cy={cy} r={r} fill="none" stroke={isDark ? 'rgba(2,175,254,0.08)' : 'rgba(2,175,254,0.06)'} strokeWidth={strokeWidth} />

            {/* Segments */}
            {segments.map((seg, i) => (
              <circle
                key={i}
                cx={cx}
                cy={cy}
                r={r}
                fill="none"
                stroke={seg.color}
                strokeWidth={hoverIdx === i ? strokeWidth + 4 : strokeWidth}
                strokeDasharray={seg.dasharray}
                strokeDashoffset={seg.dashoffset}
                strokeLinecap="round"
                style={{
                  transition: 'stroke-width 0.2s ease, filter 0.2s ease',
                  filter: hoverIdx === i ? `drop-shadow(0 0 8px ${seg.color}60)` : 'none',
                  cursor: 'pointer',
                }}
                onMouseEnter={() => setHoverIdx(i)}
                onMouseLeave={() => setHoverIdx(null)}
              />
            ))}
          </svg>

          {/* Center text */}
          <div style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            textAlign: 'center',
          }}>
            <div style={{
              fontSize: centerValue ? 22 : 18,
              fontWeight: 800,
              color: isDark ? '#F8FAFC' : '#0F172A',
              letterSpacing: '-0.02em',
            }}>
              {hoverIdx !== null
                ? formatPercent(segments[hoverIdx].pct * 100, 0)
                : (centerValue || formatNumber(total))
              }
            </div>
            <div style={{ fontSize: 11, color: isDark ? '#94A3B8' : '#64748B', marginTop: 2 }}>
              {hoverIdx !== null ? segments[hoverIdx].label : (centerLabel || 'סה"כ')}
            </div>
          </div>
        </div>

        {/* Legend */}
        {showLegend && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 120 }}>
            {segments.map((seg, i) => (
              <div
                key={i}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer',
                  opacity: hoverIdx !== null && hoverIdx !== i ? 0.5 : 1,
                  transition: 'opacity 0.2s',
                }}
                onMouseEnter={() => setHoverIdx(i)}
                onMouseLeave={() => setHoverIdx(null)}
              >
                <span style={{
                  width: 10, height: 10, borderRadius: '50%', flexShrink: 0,
                  background: seg.color,
                  boxShadow: `0 0 6px ${seg.color}40`,
                }} />
                <span style={{ fontSize: 13, color: isDark ? '#CBD5E1' : '#334155', flex: 1 }}>{seg.label}</span>
                <span style={{ fontSize: 13, fontWeight: 600, color: isDark ? '#F1F5F9' : '#0F172A' }}>
                  {formatNumber(seg.value)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </ChartWrapper>
  );
}

export default PremiumDonutChart;
