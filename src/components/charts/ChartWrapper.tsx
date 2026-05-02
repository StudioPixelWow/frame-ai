'use client';

import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import {
  CARD_STYLES,
  SKELETON_STYLE,
  CHART_KEYFRAMES,
  TOOLTIP_STYLES,
} from './chartTheme';

// ── Inject keyframes once ──
let keyframesInjected = false;
function injectKeyframes() {
  if (keyframesInjected || typeof document === 'undefined') return;
  const style = document.createElement('style');
  style.textContent = CHART_KEYFRAMES;
  document.head.appendChild(style);
  keyframesInjected = true;
}

// ── Chart State ──

export type ChartState = 'loading' | 'empty' | 'error' | 'ready';

export interface ChartWrapperProps {
  title?: string;
  subtitle?: string;
  state?: ChartState;
  variant?: 'light' | 'dark' | 'elevated';
  height?: number | string;
  children: React.ReactNode;
  headerRight?: React.ReactNode;
  padding?: string;
  className?: string;
}

/**
 * Shared chart card wrapper with loading/empty/error states.
 * All premium chart components use this as their outer shell.
 */
export function ChartWrapper({
  title,
  subtitle,
  state = 'ready',
  variant = 'light',
  height,
  children,
  headerRight,
  padding = '20px',
  className,
}: ChartWrapperProps) {
  useEffect(() => { injectKeyframes(); }, []);

  const cardStyle = CARD_STYLES[variant];

  return (
    <div
      dir="rtl"
      className={className}
      style={{
        ...cardStyle,
        padding,
        height: height || 'auto',
        animation: 'pgChartFadeIn 0.4s ease both',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      {(title || headerRight) && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
          <div>
            {title && (
              <h3 style={{
                fontSize: 15,
                fontWeight: 700,
                margin: 0,
                color: variant === 'dark' ? '#E2E8F0' : '#0F172A',
                letterSpacing: '-0.01em',
              }}>
                {title}
              </h3>
            )}
            {subtitle && (
              <p style={{
                fontSize: 12,
                color: variant === 'dark' ? 'rgba(148,163,184,0.8)' : '#94A3B8',
                margin: '4px 0 0',
              }}>
                {subtitle}
              </p>
            )}
          </div>
          {headerRight && <div>{headerRight}</div>}
        </div>
      )}

      {/* States */}
      {state === 'loading' && <ChartSkeleton height={height} variant={variant} />}
      {state === 'empty' && <ChartEmpty variant={variant} />}
      {state === 'error' && <ChartError variant={variant} />}
      {state === 'ready' && children}
    </div>
  );
}

// ── Loading Skeleton ──

function ChartSkeleton({ height, variant }: { height?: number | string; variant: string }) {
  const bg = variant === 'dark'
    ? 'linear-gradient(90deg, rgba(2,175,254,0.04) 25%, rgba(2,175,254,0.1) 50%, rgba(2,175,254,0.04) 75%)'
    : SKELETON_STYLE.background;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, minHeight: typeof height === 'number' ? height - 80 : 120 }}>
      <div style={{ ...SKELETON_STYLE, background: bg, height: 20, width: '60%' }} />
      <div style={{ ...SKELETON_STYLE, background: bg, height: 14, width: '40%' }} />
      <div style={{ ...SKELETON_STYLE, background: bg, flex: 1, minHeight: 60, borderRadius: 12 }} />
    </div>
  );
}

// ── Empty State ──

function ChartEmpty({ variant }: { variant: string }) {
  const isDark = variant === 'dark';
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '32px 16px',
      textAlign: 'center',
    }}>
      <div style={{ fontSize: 36, marginBottom: 12, opacity: 0.5 }}>📊</div>
      <div style={{ fontSize: 14, fontWeight: 500, color: isDark ? '#94A3B8' : '#64748B' }}>
        אין עדיין מספיק נתונים להצגת גרף
      </div>
    </div>
  );
}

// ── Error State ──

function ChartError({ variant }: { variant: string }) {
  const isDark = variant === 'dark';
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '32px 16px',
      textAlign: 'center',
    }}>
      <div style={{ fontSize: 36, marginBottom: 12, opacity: 0.5 }}>⚠️</div>
      <div style={{ fontSize: 14, fontWeight: 500, color: isDark ? '#F87171' : '#EF4444' }}>
        לא ניתן לטעון נתוני גרף
      </div>
    </div>
  );
}

// ── Tooltip Component ──

export interface TooltipData {
  label: string;
  value: string;
  color?: string;
  subLabel?: string;
}

export function ChartTooltip({
  data,
  visible,
  x,
  y,
  variant = 'light',
}: {
  data: TooltipData | null;
  visible: boolean;
  x: number;
  y: number;
  variant?: 'light' | 'dark';
}) {
  if (!visible || !data) return null;
  const style = variant === 'dark' ? TOOLTIP_STYLES.dark : TOOLTIP_STYLES.light;

  return (
    <div style={{
      ...style,
      position: 'absolute',
      left: x,
      top: y,
      transform: 'translate(-50%, -110%)',
      pointerEvents: 'none',
      zIndex: 50,
      whiteSpace: 'nowrap',
      transition: 'opacity 0.15s ease',
    }}>
      {data.color && (
        <span style={{
          display: 'inline-block',
          width: 8,
          height: 8,
          borderRadius: '50%',
          background: data.color,
          marginLeft: 6,
          boxShadow: `0 0 6px ${data.color}60`,
        }} />
      )}
      <span style={{ fontWeight: 600 }}>{data.value}</span>
      <span style={{ marginRight: 8, opacity: 0.7 }}>{data.label}</span>
      {data.subLabel && (
        <div style={{ fontSize: 11, opacity: 0.6, marginTop: 2 }}>{data.subLabel}</div>
      )}
    </div>
  );
}
