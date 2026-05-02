'use client';

import React, { useState, useMemo, useRef } from 'react';
import { ChartWrapper, ChartState, ChartTooltip, TooltipData } from './ChartWrapper';
import { BRAND, CHART_COLORS, SVG_GRADIENT_DEFS, formatNumber, formatCurrency, getColorForIndex } from './chartTheme';

export interface AreaChartSeries {
  label: string;
  data: number[];
  color?: string;
}

export interface PremiumAreaChartProps {
  title?: string;
  subtitle?: string;
  labels: string[];
  series: AreaChartSeries[];
  state?: ChartState;
  variant?: 'light' | 'dark' | 'elevated';
  format?: 'number' | 'currency' | 'percent';
  height?: number;
  stacked?: boolean;
  headerRight?: React.ReactNode;
}

export function PremiumAreaChart({
  title, subtitle, labels, series, state = 'ready', variant = 'light',
  format = 'number', height = 220, stacked = false, headerRight,
}: PremiumAreaChartProps) {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const isDark = variant === 'dark';
  const textColor = isDark ? '#94A3B8' : '#94A3B8';
  const gridColor = isDark ? 'rgba(2,175,254,0.1)' : 'rgba(2,175,254,0.06)';

  const svgW = 600, svgH = height;
  const padTop = 12, padBottom = 26;

  const allValues = useMemo(() => series.flatMap(s => s.data), [series]);
  const maxVal = useMemo(() => Math.max(...allValues, 1), [allValues]);
  const range = maxVal;

  const fmt = (v: number) => format === 'currency' ? formatCurrency(v) : format === 'percent' ? `${v.toFixed(1)}%` : formatNumber(v);
  const effectiveState: ChartState = (series.length === 0 || labels.length === 0) && state === 'ready' ? 'empty' : state;

  function getY(v: number) { return padTop + (1 - v / range) * (svgH - padTop - padBottom); }

  function buildSmooth(data: number[]): string {
    const pts = data.map((v, i) => ({ x: labels.length > 1 ? (i / (labels.length - 1)) * svgW : svgW / 2, y: getY(v) }));
    if (pts.length < 2) return '';
    let d = `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`;
    for (let i = 1; i < pts.length; i++) {
      const cpx = (pts[i - 1].x + pts[i].x) / 2;
      d += ` C ${cpx.toFixed(1)} ${pts[i - 1].y.toFixed(1)}, ${cpx.toFixed(1)} ${pts[i].y.toFixed(1)}, ${pts[i].x.toFixed(1)} ${pts[i].y.toFixed(1)}`;
    }
    return d;
  }

  function buildArea(data: number[]): string {
    const line = buildSmooth(data);
    if (!line) return '';
    const lastX = labels.length > 1 ? svgW : svgW / 2;
    return `${line} L ${lastX} ${svgH - padBottom} L 0 ${svgH - padBottom} Z`;
  }

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!svgRef.current || labels.length === 0) return;
    const rect = svgRef.current.getBoundingClientRect();
    const relX = ((e.clientX - rect.left) / rect.width) * svgW;
    const idx = Math.round((relX / svgW) * (labels.length - 1));
    setHoverIdx(Math.max(0, Math.min(labels.length - 1, idx)));
  };

  const tooltipData: TooltipData | null = hoverIdx !== null && series[0] ? {
    label: labels[hoverIdx] || '',
    value: series.map(s => `${s.label}: ${fmt(s.data[hoverIdx] || 0)}`).join(' | '),
    color: series[0].color || CHART_COLORS[0],
  } : null;

  return (
    <ChartWrapper title={title} subtitle={subtitle} state={effectiveState} variant={variant} headerRight={headerRight}>
      <div style={{ position: 'relative' }}>
        <svg ref={svgRef} viewBox={`0 0 ${svgW} ${svgH}`} style={{ width: '100%', height: 'auto', display: 'block' }}
          onMouseMove={handleMouseMove} onMouseLeave={() => setHoverIdx(null)}>
          <defs dangerouslySetInnerHTML={{ __html: SVG_GRADIENT_DEFS.replace('<defs>', '').replace('</defs>', '') }} />

          {/* Grid */}
          {[0, 0.25, 0.5, 0.75, 1].map((pct, i) => {
            const y = padTop + pct * (svgH - padTop - padBottom);
            return <line key={i} x1={0} y1={y} x2={svgW} y2={y} stroke={gridColor} strokeDasharray="4 4" />;
          })}

          {/* Series (reverse for stacking visual) */}
          {[...series].reverse().map((s, ri) => {
            const si = series.length - 1 - ri;
            const color = s.color || getColorForIndex(si);
            return (
              <g key={si}>
                <path d={buildArea(s.data)} fill={`${color}18`} />
                <path d={buildSmooth(s.data)} fill="none" stroke={color} strokeWidth={2.5} strokeLinecap="round" />
                <path d={buildSmooth(s.data)} fill="none" stroke={color} strokeWidth={6} opacity={0.1} strokeLinecap="round" />
              </g>
            );
          })}

          {/* Hover line */}
          {hoverIdx !== null && (
            <line x1={(hoverIdx / Math.max(labels.length - 1, 1)) * svgW} y1={padTop} x2={(hoverIdx / Math.max(labels.length - 1, 1)) * svgW} y2={svgH - padBottom} stroke={BRAND.cyan} strokeWidth={1} strokeDasharray="3 3" opacity={0.5} />
          )}

          {/* X labels */}
          {labels.map((l, i) => {
            const skip = Math.max(1, Math.floor(labels.length / 8));
            if (i % skip !== 0 && i !== labels.length - 1) return null;
            const x = labels.length > 1 ? (i / (labels.length - 1)) * svgW : svgW / 2;
            return <text key={i} x={x} y={svgH - 6} textAnchor="middle" fontSize={10} fill={textColor}>{l}</text>;
          })}
        </svg>

        {/* Legend */}
        {series.length > 1 && (
          <div style={{ display: 'flex', gap: 16, justifyContent: 'center', marginTop: 8, fontSize: 12 }}>
            {series.map((s, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <span style={{ width: 10, height: 10, borderRadius: '50%', background: s.color || getColorForIndex(i), boxShadow: `0 0 6px ${(s.color || getColorForIndex(i))}50` }} />
                <span style={{ color: isDark ? '#CBD5E1' : '#64748B' }}>{s.label}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </ChartWrapper>
  );
}

export default PremiumAreaChart;
