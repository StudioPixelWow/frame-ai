/**
 * Premium Chart Design System — Theme
 *
 * PixelManageAI brand colors + futuristic analytics aesthetic.
 * Supports light mode app with optional dark chart cards.
 * All charts share this single source of truth.
 */

// ── Brand Colors ──

export const BRAND = {
  cyan: '#02AFFE',
  cyanLight: '#05E2FF',
  cyanSoft: '#7DD3FC',
  yellow: '#F0FF02',
  yellowSoft: '#FAFFA6',
  navy: '#0B1628',
  navyMid: '#132040',
  navyLight: '#1B2D52',
  blue: '#2563EB',
  blueLight: '#3B82F6',
  purple: '#7C3AED',
  purpleLight: '#A78BFA',
} as const;

// ── Chart Color Palette (ordered for multi-series) ──

export const CHART_COLORS = [
  '#02AFFE',  // primary cyan
  '#05E2FF',  // secondary cyan
  '#7C3AED',  // purple
  '#F0FF02',  // action yellow
  '#3B82F6',  // blue
  '#10B981',  // emerald
  '#F59E0B',  // amber
  '#EF4444',  // red
  '#EC4899',  // pink
  '#6366F1',  // indigo
] as const;

// ── Verdict / Status Colors ──

export const STATUS_COLORS = {
  excellent: '#10B981',
  good: '#22C55E',
  average: '#F59E0B',
  poor: '#F97316',
  critical: '#EF4444',
  healthy: '#10B981',
  warning: '#F59E0B',
  neutral: '#94A3B8',
} as const;

// ── Gradient Definitions (CSS strings) ──

export const GRADIENTS = {
  cyan: 'linear-gradient(135deg, #02AFFE 0%, #05E2FF 100%)',
  cyanDark: 'linear-gradient(135deg, #0B1628 0%, #132040 100%)',
  cyanGlow: 'linear-gradient(135deg, rgba(2,175,254,0.15) 0%, rgba(5,226,255,0.05) 100%)',
  purple: 'linear-gradient(135deg, #7C3AED 0%, #A78BFA 100%)',
  purpleCyan: 'linear-gradient(135deg, #7C3AED 0%, #02AFFE 100%)',
  blue: 'linear-gradient(135deg, #2563EB 0%, #3B82F6 100%)',
  yellowAccent: 'linear-gradient(135deg, #F0FF02 0%, #FAFFA6 100%)',
  glassLight: 'linear-gradient(135deg, rgba(255,255,255,0.95) 0%, rgba(255,255,255,0.85) 100%)',
  glassDark: 'linear-gradient(135deg, rgba(11,22,40,0.97) 0%, rgba(19,32,64,0.95) 100%)',
  areaFill: 'linear-gradient(180deg, rgba(2,175,254,0.25) 0%, rgba(2,175,254,0.02) 100%)',
  areaFillPurple: 'linear-gradient(180deg, rgba(124,58,237,0.2) 0%, rgba(124,58,237,0.02) 100%)',
} as const;

// ── SVG Gradient Defs (for inline SVG charts) ──

export const SVG_GRADIENT_DEFS = `
  <defs>
    <linearGradient id="pg-cyan" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#02AFFE" stop-opacity="0.35"/>
      <stop offset="100%" stop-color="#02AFFE" stop-opacity="0.03"/>
    </linearGradient>
    <linearGradient id="pg-purple" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#7C3AED" stop-opacity="0.25"/>
      <stop offset="100%" stop-color="#7C3AED" stop-opacity="0.03"/>
    </linearGradient>
    <linearGradient id="pg-yellow" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#F0FF02" stop-opacity="0.3"/>
      <stop offset="100%" stop-color="#F0FF02" stop-opacity="0.03"/>
    </linearGradient>
    <linearGradient id="pg-line-cyan" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#02AFFE"/>
      <stop offset="100%" stop-color="#05E2FF"/>
    </linearGradient>
    <linearGradient id="pg-line-purple" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#7C3AED"/>
      <stop offset="100%" stop-color="#A78BFA"/>
    </linearGradient>
    <filter id="pg-glow-cyan" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur in="SourceGraphic" stdDeviation="3"/>
      <feColorMatrix type="matrix" values="0 0 0 0 0.008  0 0 0 0 0.686  0 0 0 0 0.996  0 0 0 0.6 0"/>
    </filter>
    <filter id="pg-glow-yellow" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur in="SourceGraphic" stdDeviation="2.5"/>
      <feColorMatrix type="matrix" values="0 0 0 0 0.94  0 0 0 0 1  0 0 0 0 0.008  0 0 0 0.5 0"/>
    </filter>
  </defs>
`;

// ── Card Styles ──

export const CARD_STYLES = {
  /** Light glass card — default for light mode app */
  light: {
    background: 'rgba(255,255,255,0.92)',
    backdropFilter: 'blur(16px)',
    border: '1px solid rgba(2,175,254,0.12)',
    borderRadius: '16px',
    boxShadow: '0 2px 12px rgba(2,175,254,0.06), 0 1px 3px rgba(0,0,0,0.04)',
  } as React.CSSProperties,

  /** Dark navy card — for chart areas needing contrast */
  dark: {
    background: 'linear-gradient(135deg, rgba(11,22,40,0.97) 0%, rgba(19,32,64,0.95) 100%)',
    backdropFilter: 'blur(16px)',
    border: '1px solid rgba(2,175,254,0.15)',
    borderRadius: '16px',
    boxShadow: '0 4px 24px rgba(0,0,0,0.15), 0 0 40px rgba(2,175,254,0.05)',
    color: '#E2E8F0',
  } as React.CSSProperties,

  /** Elevated light card with cyan accent */
  elevated: {
    background: 'rgba(255,255,255,0.96)',
    backdropFilter: 'blur(20px)',
    border: '1px solid rgba(2,175,254,0.18)',
    borderRadius: '16px',
    boxShadow: '0 4px 20px rgba(2,175,254,0.08), 0 2px 6px rgba(0,0,0,0.03)',
  } as React.CSSProperties,
} as const;

// ── Grid / Axis Styles ──

export const GRID_STYLES = {
  /** Light mode grid lines */
  light: {
    stroke: 'rgba(2,175,254,0.08)',
    strokeDasharray: '4 4',
  },
  /** Dark card grid lines */
  dark: {
    stroke: 'rgba(2,175,254,0.12)',
    strokeDasharray: '4 4',
  },
} as const;

// ── Tooltip Styles ──

export const TOOLTIP_STYLES = {
  light: {
    background: 'rgba(255,255,255,0.96)',
    backdropFilter: 'blur(12px)',
    border: '1px solid rgba(2,175,254,0.2)',
    borderRadius: '10px',
    padding: '8px 14px',
    boxShadow: '0 4px 16px rgba(2,175,254,0.1), 0 2px 6px rgba(0,0,0,0.06)',
    fontSize: '13px',
    color: '#0F172A',
    direction: 'rtl' as const,
    textAlign: 'right' as const,
  } as React.CSSProperties,
  dark: {
    background: 'rgba(11,22,40,0.95)',
    backdropFilter: 'blur(12px)',
    border: '1px solid rgba(2,175,254,0.25)',
    borderRadius: '10px',
    padding: '8px 14px',
    boxShadow: '0 4px 16px rgba(0,0,0,0.25), 0 0 20px rgba(2,175,254,0.08)',
    fontSize: '13px',
    color: '#E2E8F0',
    direction: 'rtl' as const,
    textAlign: 'right' as const,
  } as React.CSSProperties,
} as const;

// ── Number Formatting ──

export function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString('he-IL');
}

export function formatCurrency(n: number, symbol = '₪'): string {
  if (n >= 1_000_000) return `${symbol}${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${symbol}${(n / 1_000).toFixed(1)}K`;
  return `${symbol}${n.toLocaleString('he-IL')}`;
}

export function formatPercent(n: number, decimals = 1): string {
  return `${n.toFixed(decimals)}%`;
}

export function formatTrend(current: number, previous: number): { value: string; direction: 'up' | 'down' | 'flat'; color: string } {
  if (previous === 0) return { value: '—', direction: 'flat', color: STATUS_COLORS.neutral };
  const pct = ((current - previous) / previous) * 100;
  if (Math.abs(pct) < 0.5) return { value: '0%', direction: 'flat', color: STATUS_COLORS.neutral };
  return {
    value: `${pct > 0 ? '+' : ''}${pct.toFixed(1)}%`,
    direction: pct > 0 ? 'up' : 'down',
    color: pct > 0 ? STATUS_COLORS.good : STATUS_COLORS.critical,
  };
}

// ── Animation Keyframes (inject once) ──

export const CHART_KEYFRAMES = `
@keyframes pgChartFadeIn {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}
@keyframes pgCountUp {
  from { opacity: 0; transform: scale(0.8); }
  to { opacity: 1; transform: scale(1); }
}
@keyframes pgPulseGlow {
  0%, 100% { box-shadow: 0 0 8px rgba(2,175,254,0.15); }
  50% { box-shadow: 0 0 20px rgba(2,175,254,0.3); }
}
@keyframes pgBarGrow {
  from { transform: scaleX(0); }
  to { transform: scaleX(1); }
}
@keyframes pgRingDraw {
  from { stroke-dashoffset: var(--pg-ring-circumference, 283); }
  to { stroke-dashoffset: var(--pg-ring-offset, 0); }
}
@keyframes pgSparkDraw {
  from { stroke-dashoffset: var(--pg-spark-length, 200); }
  to { stroke-dashoffset: 0; }
}
@keyframes pgDotPulse {
  0%, 100% { r: 3; opacity: 0.8; }
  50% { r: 5; opacity: 1; }
}
@keyframes pgSkeletonShimmer {
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}
`;

// ── Skeleton / Loading ──

export const SKELETON_STYLE: React.CSSProperties = {
  background: 'linear-gradient(90deg, rgba(2,175,254,0.06) 25%, rgba(2,175,254,0.12) 50%, rgba(2,175,254,0.06) 75%)',
  backgroundSize: '200% 100%',
  animation: 'pgSkeletonShimmer 1.8s ease infinite',
  borderRadius: '8px',
};

// ── Shared Component Helpers ──

export function getColorForIndex(i: number): string {
  return CHART_COLORS[i % CHART_COLORS.length];
}

/** Clamp value between 0-100 for safe percentage use */
export function clampPct(v: number): number {
  return Math.max(0, Math.min(100, v));
}

/** Safe divide — returns 0 if divisor is 0 */
export function safeDivide(a: number, b: number): number {
  return b === 0 ? 0 : a / b;
}
