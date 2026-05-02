'use client';

import React, { useEffect, useState } from 'react';
import { ChartWrapper, ChartState } from './ChartWrapper';
import { BRAND, STATUS_COLORS, formatPercent, clampPct, CHART_KEYFRAMES } from './chartTheme';

let kfInjected = false;
function injectKF() { if (kfInjected || typeof document === 'undefined') return; const s = document.createElement('style'); s.textContent = CHART_KEYFRAMES; document.head.appendChild(s); kfInjected = true; }

export interface PremiumRadialMetricProps {
  title?: string;
  value: number;  // 0-100
  label?: string;
  sublabel?: string;
  size?: number;
  strokeWidth?: number;
  color?: string;
  autoColor?: boolean;  // green/yellow/red based on value
  variant?: 'light' | 'dark' | 'elevated';
  state?: ChartState;
  icon?: string;
}

export function PremiumRadialMetric({
  title, value, label, sublabel, size = 120, strokeWidth = 10,
  color, autoColor = false, variant = 'light', state = 'ready', icon,
}: PremiumRadialMetricProps) {
  useEffect(() => { injectKF(); }, []);

  const pct = clampPct(value);
  const isDark = variant === 'dark';

  const effectiveColor = autoColor
    ? (pct >= 80 ? STATUS_COLORS.excellent : pct >= 60 ? STATUS_COLORS.good : pct >= 40 ? STATUS_COLORS.average : STATUS_COLORS.critical)
    : (color || BRAND.cyan);

  const r = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * r;
  const offset = circumference - (pct / 100) * circumference;
  const cx = size / 2;
  const cy = size / 2;

  return (
    <ChartWrapper state={state} variant={variant} padding="16px">
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
        {title && (
          <div style={{ fontSize: 13, fontWeight: 600, color: isDark ? '#CBD5E1' : '#334155', textAlign: 'center' }}>
            {title}
          </div>
        )}

        <div style={{ position: 'relative', width: size, height: size }}>
          <svg viewBox={`0 0 ${size} ${size}`} style={{ width: size, height: size, transform: 'rotate(-90deg)' }}>
            {/* Track */}
            <circle cx={cx} cy={cy} r={r} fill="none"
              stroke={isDark ? 'rgba(2,175,254,0.08)' : 'rgba(2,175,254,0.06)'}
              strokeWidth={strokeWidth} />

            {/* Glow */}
            <circle cx={cx} cy={cy} r={r} fill="none"
              stroke={effectiveColor} strokeWidth={strokeWidth + 4} opacity={0.1}
              strokeDasharray={`${(pct / 100) * circumference} ${circumference}`}
              strokeDashoffset={0} strokeLinecap="round"
              style={{
                ['--pg-ring-circumference' as any]: circumference,
                ['--pg-ring-offset' as any]: offset,
                animation: 'pgRingDraw 1s ease forwards',
              }}
            />

            {/* Progress arc */}
            <circle cx={cx} cy={cy} r={r} fill="none"
              stroke={effectiveColor} strokeWidth={strokeWidth}
              strokeDasharray={`${(pct / 100) * circumference} ${circumference}`}
              strokeDashoffset={0} strokeLinecap="round"
              style={{
                ['--pg-ring-circumference' as any]: circumference,
                ['--pg-ring-offset' as any]: offset,
                animation: 'pgRingDraw 1s ease forwards',
                filter: `drop-shadow(0 0 6px ${effectiveColor}50)`,
              }}
            />
          </svg>

          {/* Center */}
          <div style={{
            position: 'absolute', top: '50%', left: '50%',
            transform: 'translate(-50%, -50%)', textAlign: 'center',
          }}>
            {icon && <div style={{ fontSize: 18, marginBottom: 2 }}>{icon}</div>}
            <div style={{
              fontSize: size > 100 ? 22 : 18,
              fontWeight: 800,
              color: isDark ? '#F8FAFC' : '#0F172A',
              letterSpacing: '-0.02em',
              animation: 'pgCountUp 0.5s ease both',
            }}>
              {formatPercent(pct, 0)}
            </div>
          </div>
        </div>

        {label && (
          <div style={{ fontSize: 12, fontWeight: 500, color: isDark ? '#94A3B8' : '#64748B', textAlign: 'center' }}>
            {label}
          </div>
        )}
        {sublabel && (
          <div style={{ fontSize: 11, color: isDark ? '#64748B' : '#94A3B8', textAlign: 'center' }}>
            {sublabel}
          </div>
        )}
      </div>
    </ChartWrapper>
  );
}

export default PremiumRadialMetric;
