'use client';

import React, { useMemo } from 'react';
import { BRAND, CHART_COLORS, CHART_KEYFRAMES } from './chartTheme';

export interface PremiumSparklineProps {
  data: number[];
  width?: number;
  height?: number;
  color?: string;
  showArea?: boolean;
  showDot?: boolean;
  strokeWidth?: number;
  animate?: boolean;
}

/**
 * Standalone sparkline — no card wrapper.
 * Use inside KPI cards, table cells, list items.
 */
export function PremiumSparkline({
  data,
  width = 100,
  height = 28,
  color = BRAND.cyan,
  showArea = true,
  showDot = true,
  strokeWidth = 1.5,
  animate = true,
}: PremiumSparklineProps) {
  if (data.length < 2) return null;

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const padY = 3;

  const points = useMemo(() => data.map((v, i) => ({
    x: (i / (data.length - 1)) * width,
    y: padY + (1 - (v - min) / range) * (height - padY * 2),
  })), [data, width, height, min, range]);

  // Smooth curve
  let linePath = `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`;
  for (let i = 1; i < points.length; i++) {
    const cpx = (points[i - 1].x + points[i].x) / 2;
    linePath += ` C ${cpx.toFixed(1)} ${points[i - 1].y.toFixed(1)}, ${cpx.toFixed(1)} ${points[i].y.toFixed(1)}, ${points[i].x.toFixed(1)} ${points[i].y.toFixed(1)}`;
  }

  const areaPath = `${linePath} L ${width} ${height} L 0 ${height} Z`;

  const pathLength = points.reduce((acc, p, i) => {
    if (i === 0) return 0;
    const dx = p.x - points[i - 1].x;
    const dy = p.y - points[i - 1].y;
    return acc + Math.sqrt(dx * dx + dy * dy);
  }, 0);

  const gradId = `spark-${color.replace('#', '')}`;

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ display: 'block', overflow: 'visible' }}>
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.2} />
          <stop offset="100%" stopColor={color} stopOpacity={0.02} />
        </linearGradient>
      </defs>

      {showArea && <path d={areaPath} fill={`url(#${gradId})`} />}

      {/* Glow line */}
      <path d={linePath} fill="none" stroke={color} strokeWidth={strokeWidth + 3} opacity={0.1} strokeLinecap="round" strokeLinejoin="round" />

      {/* Main line */}
      <path
        d={linePath}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        style={animate ? {
          strokeDasharray: pathLength,
          strokeDashoffset: pathLength,
          animation: 'pgSparkDraw 0.8s 0.1s ease forwards',
          ['--pg-spark-length' as any]: pathLength,
        } : undefined}
      />

      {/* End dot */}
      {showDot && (
        <circle
          cx={points[points.length - 1].x}
          cy={points[points.length - 1].y}
          r={3}
          fill={color}
          style={{ filter: `drop-shadow(0 0 4px ${color}80)` }}
        />
      )}
    </svg>
  );
}

export default PremiumSparkline;
