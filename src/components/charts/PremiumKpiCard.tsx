'use client';

import React, { useEffect, useState, useRef } from 'react';
import { BRAND, GRADIENTS, CARD_STYLES, formatNumber, formatCurrency, formatPercent, formatTrend, CHART_KEYFRAMES } from './chartTheme';

let kfInjected = false;
function injectKF() {
  if (kfInjected || typeof document === 'undefined') return;
  const s = document.createElement('style'); s.textContent = CHART_KEYFRAMES; document.head.appendChild(s); kfInjected = true;
}

export interface KpiCardProps {
  label: string;
  value: number;
  previousValue?: number;
  format?: 'number' | 'currency' | 'percent';
  icon?: string;
  color?: string;
  sparklineData?: number[];
  description?: string;
  loading?: boolean;
  variant?: 'light' | 'dark' | 'elevated';
  accentGlow?: boolean;
  onClick?: () => void;
}

export function PremiumKpiCard({
  label,
  value,
  previousValue,
  format = 'number',
  icon,
  color = BRAND.cyan,
  sparklineData,
  description,
  loading = false,
  variant = 'elevated',
  accentGlow = false,
  onClick,
}: KpiCardProps) {
  useEffect(() => { injectKF(); }, []);
  const [displayValue, setDisplayValue] = useState(0);
  const mounted = useRef(false);

  // Animated counter
  useEffect(() => {
    if (loading) return;
    if (!mounted.current) { mounted.current = true; }
    const duration = 600;
    const start = performance.now();
    const from = 0;
    const to = value;
    function tick(now: number) {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3); // easeOutCubic
      setDisplayValue(from + (to - from) * eased);
      if (progress < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }, [value, loading]);

  const trend = previousValue !== undefined ? formatTrend(value, previousValue) : null;

  const formattedValue = (() => {
    const v = Math.round(displayValue);
    if (format === 'currency') return formatCurrency(v);
    if (format === 'percent') return formatPercent(displayValue);
    return formatNumber(v);
  })();

  const cardStyle = CARD_STYLES[variant];

  if (loading) {
    return (
      <div style={{
        ...cardStyle,
        padding: '18px 20px',
        minHeight: 110,
        animation: 'pgChartFadeIn 0.3s ease both',
      }}>
        <div style={{ height: 14, width: '50%', borderRadius: 6, background: 'rgba(2,175,254,0.08)', marginBottom: 12 }} />
        <div style={{ height: 28, width: '70%', borderRadius: 8, background: 'rgba(2,175,254,0.06)' }} />
      </div>
    );
  }

  return (
    <div
      dir="rtl"
      onClick={onClick}
      style={{
        ...cardStyle,
        padding: '18px 20px',
        animation: 'pgChartFadeIn 0.35s ease both',
        cursor: onClick ? 'pointer' : 'default',
        transition: 'transform 0.2s ease, box-shadow 0.2s ease',
        position: 'relative',
        overflow: 'hidden',
        ...(accentGlow ? { animation: 'pgChartFadeIn 0.35s ease both, pgPulseGlow 3s ease infinite' } : {}),
      }}
      onMouseEnter={e => { if (onClick) (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)'; }}
      onMouseLeave={e => { if (onClick) (e.currentTarget as HTMLElement).style.transform = 'translateY(0)'; }}
    >
      {/* Accent line top */}
      <div style={{
        position: 'absolute',
        top: 0,
        right: 0,
        left: 0,
        height: 3,
        background: `linear-gradient(90deg, ${color}, ${color}40)`,
        borderRadius: '16px 16px 0 0',
      }} />

      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {icon && <span style={{ fontSize: 16 }}>{icon}</span>}
          <span style={{
            fontSize: 12,
            fontWeight: 500,
            color: variant === 'dark' ? '#94A3B8' : '#64748B',
            letterSpacing: '0.01em',
          }}>
            {label}
          </span>
        </div>
        {trend && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 3,
            fontSize: 12,
            fontWeight: 600,
            color: trend.color,
            background: `${trend.color}12`,
            padding: '2px 8px',
            borderRadius: 12,
          }}>
            <span>{trend.direction === 'up' ? '↑' : trend.direction === 'down' ? '↓' : '→'}</span>
            <span>{trend.value}</span>
          </div>
        )}
      </div>

      {/* Value */}
      <div style={{
        fontSize: 28,
        fontWeight: 800,
        color: variant === 'dark' ? '#F8FAFC' : '#0F172A',
        letterSpacing: '-0.02em',
        lineHeight: 1.1,
        animation: 'pgCountUp 0.4s ease both',
      }}>
        {formattedValue}
      </div>

      {/* Sparkline */}
      {sparklineData && sparklineData.length > 2 && (
        <div style={{ marginTop: 10 }}>
          <MiniSparkline data={sparklineData} color={color} width={120} height={24} />
        </div>
      )}

      {/* Description */}
      {description && (
        <div style={{
          fontSize: 11,
          color: variant === 'dark' ? '#64748B' : '#94A3B8',
          marginTop: sparklineData ? 4 : 8,
        }}>
          {description}
        </div>
      )}
    </div>
  );
}

// ── Mini Sparkline (inside KPI card) ──

function MiniSparkline({ data, color, width, height }: { data: number[]; color: string; width: number; height: number }) {
  if (data.length < 2) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const padY = 2;

  const points = data.map((v, i) => ({
    x: (i / (data.length - 1)) * width,
    y: padY + (1 - (v - min) / range) * (height - padY * 2),
  }));

  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
  const areaPath = `${linePath} L ${width} ${height} L 0 ${height} Z`;
  const pathLength = points.reduce((acc, p, i) => {
    if (i === 0) return 0;
    const dx = p.x - points[i - 1].x;
    const dy = p.y - points[i - 1].y;
    return acc + Math.sqrt(dx * dx + dy * dy);
  }, 0);

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ display: 'block' }}>
      <defs>
        <linearGradient id={`sp-${color.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.2} />
          <stop offset="100%" stopColor={color} stopOpacity={0.02} />
        </linearGradient>
      </defs>
      <path d={areaPath} fill={`url(#sp-${color.replace('#', '')})`} />
      <path
        d={linePath}
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{
          strokeDasharray: pathLength,
          strokeDashoffset: pathLength,
          animation: `pgSparkDraw 0.8s 0.2s ease forwards`,
          ['--pg-spark-length' as any]: pathLength,
        }}
      />
      {/* Last point glow */}
      <circle
        cx={points[points.length - 1].x}
        cy={points[points.length - 1].y}
        r={3}
        fill={color}
        style={{ filter: `drop-shadow(0 0 4px ${color}80)` }}
      />
    </svg>
  );
}

export default PremiumKpiCard;
