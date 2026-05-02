'use client';

import React, { useState } from 'react';
import { ChartWrapper, ChartState } from './ChartWrapper';
import { BRAND, CHART_COLORS, formatNumber, formatCurrency, formatPercent, getColorForIndex } from './chartTheme';

export interface PlatformData {
  platform: string;
  icon?: string;
  color?: string;
  metrics: {
    label: string;
    value: number;
    format?: 'number' | 'currency' | 'percent';
  }[];
}

export interface PremiumPlatformChartProps {
  title?: string;
  subtitle?: string;
  platforms: PlatformData[];
  state?: ChartState;
  variant?: 'light' | 'dark' | 'elevated';
  headerRight?: React.ReactNode;
}

const PLATFORM_DEFAULTS: Record<string, { icon: string; color: string }> = {
  meta: { icon: '📘', color: '#1877F2' },
  facebook: { icon: '📘', color: '#1877F2' },
  instagram: { icon: '📸', color: '#E4405F' },
  tiktok: { icon: '🎵', color: '#000000' },
  google: { icon: '🔍', color: '#4285F4' },
  youtube: { icon: '📺', color: '#FF0000' },
  linkedin: { icon: '💼', color: '#0A66C2' },
};

export function PremiumPlatformChart({
  title, subtitle, platforms, state = 'ready', variant = 'light', headerRight,
}: PremiumPlatformChartProps) {
  const [selectedPlatform, setSelectedPlatform] = useState<number | null>(null);
  const isDark = variant === 'dark';
  const textColor = isDark ? '#CBD5E1' : '#334155';
  const mutedColor = isDark ? '#64748B' : '#94A3B8';

  const effectiveState: ChartState = platforms.length === 0 && state === 'ready' ? 'empty' : state;

  const fmt = (v: number, f?: string) => {
    if (f === 'currency') return formatCurrency(v);
    if (f === 'percent') return formatPercent(v);
    return formatNumber(v);
  };

  return (
    <ChartWrapper title={title} subtitle={subtitle} state={effectiveState} variant={variant} headerRight={headerRight}>
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(platforms.length, 4)}, 1fr)`, gap: 12 }}>
        {platforms.map((p, i) => {
          const defaults = PLATFORM_DEFAULTS[p.platform.toLowerCase()] || { icon: '📊', color: getColorForIndex(i) };
          const icon = p.icon || defaults.icon;
          const color = p.color || defaults.color;
          const isSelected = selectedPlatform === i;

          return (
            <div
              key={i}
              onClick={() => setSelectedPlatform(isSelected ? null : i)}
              style={{
                padding: 16,
                borderRadius: 12,
                border: `1px solid ${isSelected ? color : isDark ? 'rgba(2,175,254,0.1)' : 'rgba(2,175,254,0.08)'}`,
                background: isSelected
                  ? `${color}08`
                  : isDark ? 'rgba(2,175,254,0.03)' : 'rgba(255,255,255,0.6)',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                boxShadow: isSelected ? `0 0 16px ${color}15` : 'none',
              }}
            >
              {/* Platform header */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <span style={{ fontSize: 20 }}>{icon}</span>
                <span style={{ fontSize: 14, fontWeight: 600, color: textColor, textTransform: 'capitalize' }}>
                  {p.platform}
                </span>
              </div>

              {/* Metrics */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {p.metrics.map((m, mi) => (
                  <div key={mi} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 12, color: mutedColor }}>{m.label}</span>
                    <span style={{
                      fontSize: 14, fontWeight: 700,
                      color: isSelected ? color : (isDark ? '#F1F5F9' : '#0F172A'),
                    }}>
                      {fmt(m.value, m.format)}
                    </span>
                  </div>
                ))}
              </div>

              {/* Active indicator */}
              {isSelected && (
                <div style={{
                  marginTop: 10, height: 3, borderRadius: 2,
                  background: `linear-gradient(90deg, ${color}, ${color}60)`,
                }} />
              )}
            </div>
          );
        })}
      </div>
    </ChartWrapper>
  );
}

export default PremiumPlatformChart;
