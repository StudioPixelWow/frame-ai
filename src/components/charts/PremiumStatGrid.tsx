'use client';

import React from 'react';
import { PremiumKpiCard, KpiCardProps } from './PremiumKpiCard';
import { BRAND, CHART_COLORS } from './chartTheme';

export interface StatGridItem extends Omit<KpiCardProps, 'variant'> {}

export interface PremiumStatGridProps {
  items: StatGridItem[];
  columns?: number;
  variant?: 'light' | 'dark' | 'elevated';
  gap?: number;
}

/**
 * Grid of PremiumKpiCards with consistent sizing and responsive layout.
 */
export function PremiumStatGrid({
  items,
  columns = 4,
  variant = 'elevated',
  gap = 16,
}: PremiumStatGridProps) {
  if (items.length === 0) return null;

  const effectiveCols = Math.min(columns, items.length);

  return (
    <div
      dir="rtl"
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${effectiveCols}, 1fr)`,
        gap,
      }}
    >
      {items.map((item, i) => (
        <PremiumKpiCard
          key={i}
          {...item}
          variant={variant}
          color={item.color || CHART_COLORS[i % CHART_COLORS.length]}
        />
      ))}
    </div>
  );
}

export default PremiumStatGrid;
