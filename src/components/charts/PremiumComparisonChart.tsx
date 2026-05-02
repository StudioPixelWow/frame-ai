'use client';

import React, { useState } from 'react';
import { ChartWrapper, ChartState } from './ChartWrapper';
import { BRAND, CHART_COLORS, formatNumber, formatCurrency, getColorForIndex } from './chartTheme';

export interface ComparisonItem {
  label: string;
  valueA: number;
  valueB: number;
  icon?: string;
}

export interface PremiumComparisonChartProps {
  title?: string;
  subtitle?: string;
  data: ComparisonItem[];
  labelA: string;
  labelB: string;
  colorA?: string;
  colorB?: string;
  state?: ChartState;
  variant?: 'light' | 'dark' | 'elevated';
  format?: 'number' | 'currency' | 'percent';
  headerRight?: React.ReactNode;
}

export function PremiumComparisonChart({
  title, subtitle, data, labelA, labelB,
  colorA = BRAND.cyan, colorB = BRAND.purple,
  state = 'ready', variant = 'light', format = 'number', headerRight,
}: PremiumComparisonChartProps) {
  const isDark = variant === 'dark';
  const textColor = isDark ? '#CBD5E1' : '#334155';
  const mutedColor = isDark ? '#64748B' : '#94A3B8';

  const maxVal = Math.max(...data.map(d => Math.max(d.valueA, d.valueB)), 1);

  const fmt = (v: number) => format === 'currency' ? formatCurrency(v) : format === 'percent' ? `${v.toFixed(1)}%` : formatNumber(v);

  const effectiveState: ChartState = data.length === 0 && state === 'ready' ? 'empty' : state;

  return (
    <ChartWrapper title={title} subtitle={subtitle} state={effectiveState} variant={variant} headerRight={headerRight}>
      {/* Legend */}
      <div style={{ display: 'flex', gap: 20, marginBottom: 16, fontSize: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 12, height: 4, borderRadius: 2, background: colorA }} />
          <span style={{ color: mutedColor }}>{labelA}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 12, height: 4, borderRadius: 2, background: colorB }} />
          <span style={{ color: mutedColor }}>{labelB}</span>
        </div>
      </div>

      {/* Bars */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {data.map((d, i) => {
          const pctA = (d.valueA / maxVal) * 100;
          const pctB = (d.valueB / maxVal) * 100;
          const winner = d.valueA > d.valueB ? 'A' : d.valueB > d.valueA ? 'B' : null;

          return (
            <div key={i}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  {d.icon && <span style={{ fontSize: 14 }}>{d.icon}</span>}
                  <span style={{ fontSize: 13, fontWeight: 500, color: textColor }}>{d.label}</span>
                </div>
                <div style={{ display: 'flex', gap: 12, fontSize: 12 }}>
                  <span style={{ fontWeight: winner === 'A' ? 700 : 400, color: winner === 'A' ? colorA : mutedColor }}>
                    {fmt(d.valueA)}
                  </span>
                  <span style={{ color: mutedColor }}>vs</span>
                  <span style={{ fontWeight: winner === 'B' ? 700 : 400, color: winner === 'B' ? colorB : mutedColor }}>
                    {fmt(d.valueB)}
                  </span>
                </div>
              </div>

              {/* Dual bars */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                <div style={{ height: 6, borderRadius: 3, background: isDark ? 'rgba(2,175,254,0.06)' : 'rgba(2,175,254,0.04)', overflow: 'hidden' }}>
                  <div style={{
                    height: '100%', width: `${Math.max(pctA, 2)}%`, borderRadius: 3,
                    background: `linear-gradient(90deg, ${colorA}, ${colorA}BB)`,
                    boxShadow: winner === 'A' ? `0 0 8px ${colorA}30` : 'none',
                    transition: 'width 0.5s cubic-bezier(0.34,1.56,0.64,1)',
                    animation: 'pgBarGrow 0.5s ease both',
                    animationDelay: `${i * 0.05}s`,
                    transformOrigin: 'right',
                  }} />
                </div>
                <div style={{ height: 6, borderRadius: 3, background: isDark ? 'rgba(124,58,237,0.06)' : 'rgba(124,58,237,0.04)', overflow: 'hidden' }}>
                  <div style={{
                    height: '100%', width: `${Math.max(pctB, 2)}%`, borderRadius: 3,
                    background: `linear-gradient(90deg, ${colorB}, ${colorB}BB)`,
                    boxShadow: winner === 'B' ? `0 0 8px ${colorB}30` : 'none',
                    transition: 'width 0.5s cubic-bezier(0.34,1.56,0.64,1)',
                    animation: 'pgBarGrow 0.5s ease both',
                    animationDelay: `${i * 0.05 + 0.1}s`,
                    transformOrigin: 'right',
                  }} />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </ChartWrapper>
  );
}

export default PremiumComparisonChart;
