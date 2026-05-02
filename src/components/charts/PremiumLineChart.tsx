'use client';

import React, { useState, useMemo, useRef } from 'react';
import { ChartWrapper, ChartState, ChartTooltip, TooltipData } from './ChartWrapper';
import { BRAND, CHART_COLORS, SVG_GRADIENT_DEFS, formatNumber, formatCurrency, getColorForIndex } from './chartTheme';

export interface LineChartSeries {
  label: string;
  data: number[];
  color?: string;
}

export interface PremiumLineChartProps {
  title?: string;
  subtitle?: string;
  labels: string[];
  series: LineChartSeries[];
  state?: ChartState;
  variant?: 'light' | 'dark' | 'elevated';
  format?: 'number' | 'currency' | 'percent';
  height?: number;
  showArea?: boolean;
  showDots?: boolean;
  showGrid?: boolean;
  smooth?: boolean;
  headerRight?: React.ReactNode;
}

export function PremiumLineChart({
  title,
  subtitle,
  labels,
  series,
  state = 'ready',
  variant = 'light',
  format = 'number',
  height = 240,
  showArea = true,
  showDots = true,
  showGrid = true,
  smooth = true,
  headerRight,
}: PremiumLineChartProps) {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
  const svgRef = useRef<SVGSVGElement>(null);

  const isDark = variant === 'dark';
  const textColor = isDark ? '#94A3B8' : '#94A3B8';
  const gridColor = isDark ? 'rgba(2,175,254,0.1)' : 'rgba(2,175,254,0.06)';

  const padLeft = 0;
  const padRight = 0;
  const padTop = 16;
  const padBottom = 28;
  const svgW = 600;
  const svgH = height;
  const chartW = svgW - padLeft - padRight;
  const chartH = svgH - padTop - padBottom;

  const allValues = useMemo(() => series.flatMap(s => s.data), [series]);
  const minVal = useMemo(() => Math.min(...allValues, 0), [allValues]);
  const maxVal = useMemo(() => Math.max(...allValues, 1), [allValues]);
  const range = maxVal - minVal || 1;

  const fmt = (v: number) => {
    if (format === 'currency') return formatCurrency(v);
    if (format === 'percent') return `${v.toFixed(1)}%`;
    return formatNumber(v);
  };

  const effectiveState: ChartState = (series.length === 0 || labels.length === 0) && state === 'ready' ? 'empty' : state;

  function getPoints(data: number[]) {
    return data.map((v, i) => ({
      x: padLeft + (labels.length > 1 ? (i / (labels.length - 1)) * chartW : chartW / 2),
      y: padTop + (1 - (v - minVal) / range) * chartH,
    }));
  }

  function buildPath(points: { x: number; y: number }[]): string {
    if (points.length < 2) return '';
    if (!smooth) {
      return points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
    }
    let d = `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`;
    for (let i = 1; i < points.length; i++) {
      const prev = points[i - 1];
      const curr = points[i];
      const cpx = (prev.x + curr.x) / 2;
      d += ` C ${cpx.toFixed(1)} ${prev.y.toFixed(1)}, ${cpx.toFixed(1)} ${curr.y.toFixed(1)}, ${curr.x.toFixed(1)} ${curr.y.toFixed(1)}`;
    }
    return d;
  }

  function buildAreaPath(points: { x: number; y: number }[]): string {
    const linePath = buildPath(points);
    if (!linePath) return '';
    return `${linePath} L ${points[points.length - 1].x.toFixed(1)} ${svgH - padBottom} L ${points[0].x.toFixed(1)} ${svgH - padBottom} Z`;
  }

  // Grid lines (horizontal)
  const gridLines = useMemo(() => {
    const count = 4;
    return Array.from({ length: count + 1 }, (_, i) => {
      const y = padTop + (i / count) * chartH;
      const val = maxVal - (i / count) * range;
      return { y, label: fmt(val) };
    });
  }, [maxVal, range, chartH]);

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!svgRef.current || labels.length === 0) return;
    const rect = svgRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const relX = (mouseX / rect.width) * svgW;
    const idx = Math.round(((relX - padLeft) / chartW) * (labels.length - 1));
    const clamped = Math.max(0, Math.min(labels.length - 1, idx));
    setHoverIdx(clamped);
    setTooltipPos({ x: mouseX, y: e.clientY - rect.top });
  };

  const tooltipData: TooltipData | null = hoverIdx !== null && series[0] ? {
    label: labels[hoverIdx] || '',
    value: series.map(s => `${s.label}: ${fmt(s.data[hoverIdx] || 0)}`).join(' | '),
    color: series[0].color || CHART_COLORS[0],
  } : null;

  return (
    <ChartWrapper title={title} subtitle={subtitle} state={effectiveState} variant={variant} headerRight={headerRight}>
      <div style={{ position: 'relative' }}>
        <ChartTooltip data={tooltipData} visible={hoverIdx !== null} x={tooltipPos.x} y={tooltipPos.y} variant={isDark ? 'dark' : 'light'} />

        <svg
          ref={svgRef}
          viewBox={`0 0 ${svgW} ${svgH}`}
          style={{ width: '100%', height: 'auto', display: 'block' }}
          onMouseMove={handleMouseMove}
          onMouseLeave={() => setHoverIdx(null)}
        >
          <defs dangerouslySetInnerHTML={{ __html: SVG_GRADIENT_DEFS.replace('<defs>', '').replace('</defs>', '') }} />

          {/* Grid */}
          {showGrid && gridLines.map((gl, i) => (
            <g key={i}>
              <line x1={padLeft} y1={gl.y} x2={svgW - padRight} y2={gl.y} stroke={gridColor} strokeDasharray="4 4" />
              <text x={svgW - 4} y={gl.y - 4} textAnchor="end" fontSize={10} fill={textColor}>{gl.label}</text>
            </g>
          ))}

          {/* Hover vertical line */}
          {hoverIdx !== null && labels.length > 1 && (
            <line
              x1={padLeft + (hoverIdx / (labels.length - 1)) * chartW}
              y1={padTop}
              x2={padLeft + (hoverIdx / (labels.length - 1)) * chartW}
              y2={svgH - padBottom}
              stroke={BRAND.cyan}
              strokeWidth={1}
              strokeDasharray="3 3"
              opacity={0.4}
            />
          )}

          {/* Series */}
          {series.map((s, si) => {
            const color = s.color || getColorForIndex(si);
            const points = getPoints(s.data);
            const linePath = buildPath(points);
            const areaPath = buildAreaPath(points);
            const gradId = si === 0 ? 'pg-cyan' : si === 1 ? 'pg-purple' : `pg-area-${si}`;

            return (
              <g key={si}>
                {/* Area fill */}
                {showArea && <path d={areaPath} fill={si < 2 ? `url(#${gradId})` : `${color}15`} />}

                {/* Glow line (behind) */}
                <path d={linePath} fill="none" stroke={color} strokeWidth={6} opacity={0.12} strokeLinecap="round" strokeLinejoin="round" />

                {/* Main line */}
                <path d={linePath} fill="none" stroke={color} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />

                {/* Dots */}
                {showDots && points.map((p, pi) => (
                  <circle
                    key={pi}
                    cx={p.x}
                    cy={p.y}
                    r={pi === hoverIdx ? 5 : 3}
                    fill={pi === hoverIdx ? color : '#fff'}
                    stroke={color}
                    strokeWidth={2}
                    style={{
                      transition: 'r 0.15s ease',
                      filter: pi === hoverIdx ? `drop-shadow(0 0 6px ${color}80)` : 'none',
                    }}
                  />
                ))}
              </g>
            );
          })}

          {/* X-axis labels */}
          {labels.map((l, i) => {
            const x = padLeft + (labels.length > 1 ? (i / (labels.length - 1)) * chartW : chartW / 2);
            // Show every Nth label to avoid overlap
            const skip = Math.max(1, Math.floor(labels.length / 8));
            if (i % skip !== 0 && i !== labels.length - 1) return null;
            return (
              <text key={i} x={x} y={svgH - 6} textAnchor="middle" fontSize={10} fill={textColor}>
                {l}
              </text>
            );
          })}
        </svg>

        {/* Legend */}
        {series.length > 1 && (
          <div style={{ display: 'flex', gap: 16, justifyContent: 'center', marginTop: 8, fontSize: 12 }}>
            {series.map((s, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <span style={{
                  width: 10, height: 10, borderRadius: '50%',
                  background: s.color || getColorForIndex(i),
                  boxShadow: `0 0 6px ${(s.color || getColorForIndex(i))}50`,
                }} />
                <span style={{ color: isDark ? '#CBD5E1' : '#64748B' }}>{s.label}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </ChartWrapper>
  );
}

export default PremiumLineChart;
