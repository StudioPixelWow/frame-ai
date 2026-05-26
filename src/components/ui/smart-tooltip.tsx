"use client";

import { useState, useRef, useEffect, ReactNode, CSSProperties } from "react";

/* ═══════════════════════════════════════════════════════════════════════════
   SmartTooltip — Premium hover tooltip with explanation + trend indicators

   Features:
   - Shows explanation text on hover
   - Optional trend arrow (up/down/neutral) with color coding
   - Optional delta value (e.g. "+12%" or "-5")
   - Optional sparkline mini-chart
   - Auto-positions to avoid viewport edges
   - Smooth enter/exit animations
   - RTL-aware
   ═══════════════════════════════════════════════════════════════════════════ */

export type TrendDirection = "up" | "down" | "neutral" | "none";

interface SmartTooltipProps {
  children: ReactNode;
  /** Main explanation text shown in tooltip */
  content: string;
  /** Optional secondary detail line */
  detail?: string;
  /** Trend direction — shows colored arrow */
  trend?: TrendDirection;
  /** Delta value to show next to trend arrow (e.g. "+12%", "-3") */
  delta?: string;
  /** Whether this trend direction is positive (green) or negative (red). Defaults based on direction. */
  trendPositive?: boolean;
  /** Optional recommendation / action text */
  recommendation?: string;
  /** Tooltip placement preference */
  placement?: "top" | "bottom" | "left" | "right";
  /** Delay before showing (ms) */
  delay?: number;
  /** Max width of tooltip */
  maxWidth?: number;
  /** Additional className for wrapper */
  className?: string;
  /** Additional style for wrapper */
  style?: CSSProperties;
  /** Disable tooltip */
  disabled?: boolean;
}

const TREND_ARROWS: Record<TrendDirection, string> = {
  up: "↑",
  down: "↓",
  neutral: "→",
  none: "",
};

function getTrendColor(direction: TrendDirection, isPositive?: boolean): string {
  if (direction === "neutral" || direction === "none") return "var(--foreground-muted)";
  // If explicitly set, use that. Otherwise up=green, down=red
  const positive = isPositive ?? (direction === "up");
  return positive ? "var(--success)" : "var(--error)";
}

export function SmartTooltip({
  children,
  content,
  detail,
  trend = "none",
  delta,
  trendPositive,
  recommendation,
  placement = "top",
  delay = 300,
  maxWidth = 280,
  className = "",
  style,
  disabled = false,
}: SmartTooltipProps) {
  const [visible, setVisible] = useState(false);
  const [position, setPosition] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  const [actualPlacement, setActualPlacement] = useState(placement);
  const triggerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [exiting, setExiting] = useState(false);

  const showTooltip = () => {
    if (disabled) return;
    timerRef.current = setTimeout(() => {
      setVisible(true);
      setExiting(false);
    }, delay);
  };

  const hideTooltip = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setExiting(true);
    setTimeout(() => {
      setVisible(false);
      setExiting(false);
    }, 150);
  };

  useEffect(() => {
    if (!visible || !triggerRef.current || !tooltipRef.current) return;

    const triggerRect = triggerRef.current.getBoundingClientRect();
    const tooltipRect = tooltipRef.current.getBoundingClientRect();
    const gap = 8;

    let top = 0;
    let left = 0;
    let finalPlacement = placement;

    // Calculate position based on placement
    switch (placement) {
      case "top":
        top = triggerRect.top - tooltipRect.height - gap;
        left = triggerRect.left + triggerRect.width / 2 - tooltipRect.width / 2;
        if (top < 8) { finalPlacement = "bottom"; top = triggerRect.bottom + gap; }
        break;
      case "bottom":
        top = triggerRect.bottom + gap;
        left = triggerRect.left + triggerRect.width / 2 - tooltipRect.width / 2;
        if (top + tooltipRect.height > window.innerHeight - 8) { finalPlacement = "top"; top = triggerRect.top - tooltipRect.height - gap; }
        break;
      case "left":
        top = triggerRect.top + triggerRect.height / 2 - tooltipRect.height / 2;
        left = triggerRect.left - tooltipRect.width - gap;
        if (left < 8) { finalPlacement = "right"; left = triggerRect.right + gap; }
        break;
      case "right":
        top = triggerRect.top + triggerRect.height / 2 - tooltipRect.height / 2;
        left = triggerRect.right + gap;
        if (left + tooltipRect.width > window.innerWidth - 8) { finalPlacement = "left"; left = triggerRect.left - tooltipRect.width - gap; }
        break;
    }

    // Keep within viewport
    left = Math.max(8, Math.min(left, window.innerWidth - tooltipRect.width - 8));
    top = Math.max(8, Math.min(top, window.innerHeight - tooltipRect.height - 8));

    setPosition({ top, left });
    setActualPlacement(finalPlacement);
  }, [visible, placement]);

  // Cleanup timer on unmount
  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  const trendColor = getTrendColor(trend, trendPositive);

  return (
    <div
      ref={triggerRef}
      className={`smart-tooltip-trigger ${className}`}
      style={{ display: "inline-flex", position: "relative", cursor: "default", ...style }}
      onMouseEnter={showTooltip}
      onMouseLeave={hideTooltip}
      onFocus={showTooltip}
      onBlur={hideTooltip}
    >
      {children}

      {visible && (
        <div
          ref={tooltipRef}
          className={`smart-tooltip smart-tooltip-${actualPlacement} ${exiting ? "smart-tooltip-exit" : ""}`}
          style={{
            position: "fixed",
            top: position.top,
            left: position.left,
            maxWidth,
            zIndex: 99999,
          }}
          role="tooltip"
        >
          {/* Main content */}
          <div className="smart-tooltip-content">{content}</div>

          {/* Detail line */}
          {detail && (
            <div className="smart-tooltip-detail">{detail}</div>
          )}

          {/* Trend indicator */}
          {(trend !== "none" || delta) && (
            <div className="smart-tooltip-trend" style={{ color: trendColor }}>
              {trend !== "none" && (
                <span className="smart-tooltip-arrow" style={{ color: trendColor }}>
                  {TREND_ARROWS[trend]}
                </span>
              )}
              {delta && <span className="smart-tooltip-delta">{delta}</span>}
            </div>
          )}

          {/* Recommendation */}
          {recommendation && (
            <div className="smart-tooltip-recommendation">
              <span style={{ opacity: 0.7 }}>💡</span> {recommendation}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ── Convenience wrappers ─────────────────────────────────────────────── */

/** KPI tooltip — wraps a number/card with explanation + trend */
export function KPITooltip({
  children,
  label,
  explanation,
  currentValue,
  previousValue,
  format = "number",
  recommendation,
  ...rest
}: {
  children: ReactNode;
  label: string;
  explanation: string;
  currentValue?: number;
  previousValue?: number;
  format?: "number" | "currency" | "percent";
  recommendation?: string;
} & Omit<SmartTooltipProps, "content" | "trend" | "delta" | "recommendation">) {
  let trend: TrendDirection = "none";
  let delta = "";

  if (currentValue !== undefined && previousValue !== undefined && previousValue !== 0) {
    const diff = currentValue - previousValue;
    const pctChange = ((diff / Math.abs(previousValue)) * 100).toFixed(1);
    trend = diff > 0 ? "up" : diff < 0 ? "down" : "neutral";

    if (format === "currency") {
      delta = `${diff > 0 ? "+" : ""}₪${Math.abs(diff).toLocaleString()} (${diff > 0 ? "+" : ""}${pctChange}%)`;
    } else if (format === "percent") {
      delta = `${diff > 0 ? "+" : ""}${pctChange}%`;
    } else {
      delta = `${diff > 0 ? "+" : ""}${diff} (${diff > 0 ? "+" : ""}${pctChange}%)`;
    }
  }

  return (
    <SmartTooltip
      content={explanation}
      detail={label}
      trend={trend}
      delta={delta}
      recommendation={recommendation}
      {...rest}
    >
      {children}
    </SmartTooltip>
  );
}
