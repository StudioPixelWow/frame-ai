'use client';

import React, { useState, useMemo } from 'react';
import { ChartWrapper, ChartState, ChartTooltip, TooltipData } from './ChartWrapper';
import { BRAND, CHART_COLORS, GRADIENTS, formatNumber, formatCurrency, getColorForIndex } from './chartTheme';

export interface BarChartData {
  label: string;
  value: number;
  color?: string;
  secondaryValue?: number;
}

export interface PremiumBarChartProps {
  title?: string;
  subtitle?: string;
  data: BarChartData[];
  state?: ChartState;
  variant?: 'light' | 'dark' | 'elevated';
  orientation?: 'vertical' | 'horizontal';
  format?: 'number' | 'currency' | 'percent';
  height?: number;
  showValues?: boolean;
  highlightMax?: boolean;
  barRadius?: number;
  maxBars?: number;
  headerRight?: React.ReactNode;
}

export function PremiumBarChart({
  title,
  subtitle,
  data,
  state = 'ready',
  variant = 'light',
  orientation = 'vertical',
  format = 'number',
  height = 260,
  showValues = true,
  highlightMax = true,
  barRadius = 6,
  maxBars = 12,
  headerRight,
}: PremiumBarChartProps) {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });

  const displayData = useMemo(() => data.slice(0, maxBars), [data, maxBars]);
  const maxVal = useMemo(() => Math.max(...displayData.map(d => d.value), 1), [displayData]);
  const maxIdx = useMemo(() => {
    if (!highlightMax) return -1;
    let mi = 0;
    displayData.forEach((d, i) => { if (d.value > displayData[mi].value) mi = i; });
    return mi;
  }, [displayData, highlightMax]);

  const isDark = variant === 'dark';
  const textColor = isDark ? '#CBD5E1' : '#64748B';
  const valueColor = isDark ? '#F1F5F9' : '#0F172A';

  const fmt = (v: number) => {
    if (format === 'currency') return formatCurrency(v);
    if (format === 'percent') return `${v.toFixed(1)}%`;
    return formatNumber(v);
  };

  const effectiveState: ChartState = displayData.length === 0 && state === 'ready' ? 'empty' : state;

  const tooltipData: TooltipData | null = hoverIdx !== null && displayData[hoverIdx] ? {
    label: displayData[hoverIdx].label,
    value: fmt(displayData[hoverIdx].value),
    color: displayData[hoverIdx].color || getColorForIndex(hoverIdx),
  } : null;

  return (
    <ChartWrapper title={title} subtitle={subtitle} state={effectiveState} variant={variant} headerRight={headerRight}>
      <div style={{ position: 'relative' }}>
        <ChartTooltip data={tooltipData} visible={hoverIdx !== null} x={tooltipPos.x} y={tooltipPos.y} variant={isDark ? 'dark' : 'light'} />

        {orientation === 'vertical' ? (
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: displayData.length > 8 ? 4 : 8, height, paddingTop: 24 }}>
            {displayData.map((d, i) => {
              const pct = (d.value / maxVal) * 100;
              const color = d.color || getColorForIndex(i);
              const isMax = i === maxIdx;
              const isHover = i === hoverIdx;

              return (
                <div
                  key={i}
                  style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, cursor: 'pointer' }}
                  onMouseEnter={e => { setHoverIdx(i); const r = (e.currentTarget as HTMLElement).getBoundingClientRect(); const p = (e.currentTarget.parentElement?.parentElement as HTMLElement)?.getBoundingClientRect(); setTooltipPos({ x: r.left - (p?.left || 0) + r.width / 2, y: r.top - (p?.top || 0) }); }}
                  onMouseLeave={() => setHoverIdx(null)}
                >
                  {/* Value label */}
                  {showValues && (
                    <span style={{
                      fontSize: 11,
                      fontWeight: 600,
                      color: isMax ? BRAND.yellow : valueColor,
                      opacity: isHover ? 1 : 0.8,
                      transition: 'opacity 0.2s',
                    }}>
                      {fmt(d.value)}
                    </span>
                  )}

                  {/* Bar */}
                  <div style={{
                    width: '100%',
                    maxWidth: 48,
                    height: `${Math.max(pct, 3)}%`,
                    background: isMax
                      ? `linear-gradient(180deg, ${BRAND.yellow} 0%, ${color} 100%)`
                      : `linear-gradient(180deg, ${color} 0%, ${color}99 100%)`,
                    borderRadius: `${barRadius}px ${barRadius}px 2px 2px`,
                    transition: 'height 0.5s cubic-bezier(0.34, 1.56, 0.64, 1), transform 0.2s ease, box-shadow 0.2s ease',
                    transform: isHover ? 'scaleY(1.03)' : 'scaleY(1)',
                    transformOrigin: 'bottom',
                    boxShadow: isHover
                      ? `0 0 16px ${color}40, 0 -4px 12px ${color}20`
                      : isMax ? `0 0 12px ${BRAND.yellow}30` : 'none',
                    animation: 'pgBarGrow 0.6s ease both',
                    animationDelay: `${i * 0.04}s`,
                  }} />

                  {/* Label */}
                  <span style={{
                    fontSize: 10,
                    color: textColor,
                    textAlign: 'center',
                    maxWidth: 56,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    fontWeight: isMax ? 600 : 400,
                  }}>
                    {d.label}
                  </span>
                </div>
              );
            })}
          </div>
        ) : (
          /* Horizontal bars */
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {displayData.map((d, i) => {
              const pct = (d.value / maxVal) * 100;
              const color = d.color || getColorForIndex(i);
              const isMax = i === maxIdx;

              return (
                <div
                  key={i}
                  style={{ cursor: 'pointer' }}
                  onMouseEnter={e => { setHoverIdx(i); }}
                  onMouseLeave={() => setHoverIdx(null)}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: 12 }}>
                    <span style={{ color: textColor, fontWeight: isMax ? 600 : 400 }}>{d.label}</span>
                    <span style={{ fontWeight: 600, color: isMax ? BRAND.cyan : valueColor }}>{fmt(d.value)}</span>
                  </div>
                  <div style={{
                    height: 8,
                    borderRadius: 4,
                    background: isDark ? 'rgba(2,175,254,0.08)' : 'rgba(2,175,254,0.06)',
                    overflow: 'hidden',
                  }}>
                    <div style={{
                      height: '100%',
                      width: `${Math.max(pct, 2)}%`,
                      borderRadius: 4,
                      background: isMax
                        ? `linear-gradient(90deg, ${color}, ${BRAND.yellow})`
                        : `linear-gradient(90deg, ${color}, ${color}BB)`,
                      boxShadow: isMax ? `0 0 10px ${BRAND.yellow}30` : `0 0 8px ${color}20`,
                      transition: 'width 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)',
                      animation: 'pgBarGrow 0.5s ease both',
                      animationDelay: `${i * 0.05}s`,
                      transformOrigin: 'right',
                    }} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </ChartWrapper>
  );
}

export default PremiumBarChart;
