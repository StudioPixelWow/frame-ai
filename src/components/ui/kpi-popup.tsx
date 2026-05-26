"use client";

import { useState, useRef, useEffect, ReactNode } from "react";

/* ═══════════════════════════════════════════════════════════════════════════
   KPI Info Popup — Click on a KPI to see detailed explanation,
   trend graph, and recommendation
   ═══════════════════════════════════════════════════════════════════════════ */

interface KPIPopupProps {
  children: ReactNode;
  /** Title of the KPI */
  title: string;
  /** Current value */
  value: string | number;
  /** Explanation of what this KPI means */
  explanation: string;
  /** Historical data points for mini trend chart (last N periods) */
  history?: number[];
  /** Labels for history points (e.g. ["ינואר", "פברואר", ...]) */
  historyLabels?: string[];
  /** Trend direction */
  trend?: "up" | "down" | "neutral";
  /** Delta text (e.g. "+15%") */
  delta?: string;
  /** AI recommendation */
  recommendation?: string;
  /** Benchmark / target value */
  benchmark?: string;
  /** Disable popup */
  disabled?: boolean;
}

export function KPIPopup({
  children,
  title,
  value,
  explanation,
  history,
  historyLabels,
  trend,
  delta,
  recommendation,
  benchmark,
  disabled = false,
}: KPIPopupProps) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  const triggerRef = useRef<HTMLDivElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);

  const toggle = () => {
    if (disabled) return;
    setOpen(!open);
  };

  // Position popup when opened
  useEffect(() => {
    if (!open || !triggerRef.current) return;

    const rect = triggerRef.current.getBoundingClientRect();
    const popupWidth = 340;
    const popupHeight = 320;

    let top = rect.bottom + 8;
    let left = rect.left + rect.width / 2 - popupWidth / 2;

    // Keep in viewport
    if (top + popupHeight > window.innerHeight - 16) {
      top = rect.top - popupHeight - 8;
    }
    left = Math.max(16, Math.min(left, window.innerWidth - popupWidth - 16));

    setPosition({ top, left });
  }, [open]);

  // Close on click outside
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (
        popupRef.current && !popupRef.current.contains(e.target as Node) &&
        triggerRef.current && !triggerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open]);

  const trendColor = trend === "up" ? "var(--success)" : trend === "down" ? "var(--error)" : "var(--foreground-muted)";
  const trendArrow = trend === "up" ? "↑" : trend === "down" ? "↓" : "→";

  return (
    <>
      <div
        ref={triggerRef}
        onClick={toggle}
        style={{ cursor: disabled ? "default" : "pointer", display: "inline-block" }}
        role="button"
        tabIndex={disabled ? -1 : 0}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") toggle(); }}
      >
        {children}
      </div>

      {open && (
        <>
          {/* Backdrop */}
          <div
            style={{
              position: "fixed", inset: 0, zIndex: 99998,
              background: "rgba(0,0,0,0.2)",
              animation: "smart-tooltip-enter 150ms ease forwards",
            }}
            onClick={() => setOpen(false)}
          />

          {/* Popup */}
          <div
            ref={popupRef}
            className="kpi-popup"
            style={{
              position: "fixed",
              top: position.top,
              left: position.left,
              width: 340,
              zIndex: 99999,
              background: "var(--surface-raised)",
              border: "1px solid var(--border)",
              borderRadius: "1rem",
              padding: "1.25rem",
              boxShadow: "0 16px 48px rgba(0,0,0,0.3), 0 4px 16px rgba(0,0,0,0.15)",
              animation: "smart-tooltip-enter 250ms cubic-bezier(0.22, 1, 0.36, 1) forwards",
              direction: "rtl",
            }}
          >
            {/* Header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", marginBottom: "0.75rem" }}>
              <div>
                <div style={{ fontSize: "0.75rem", color: "var(--foreground-muted)", marginBottom: "0.25rem" }}>{title}</div>
                <div style={{ fontSize: "1.5rem", fontWeight: 800, color: "var(--foreground)" }}>{value}</div>
              </div>
              {(trend || delta) && (
                <div style={{
                  display: "flex", alignItems: "center", gap: "0.25rem",
                  padding: "0.25rem 0.5rem", borderRadius: "0.5rem",
                  background: trend === "up" ? "rgba(34,197,94,0.1)" : trend === "down" ? "rgba(239,68,68,0.1)" : "rgba(161,161,170,0.1)",
                  color: trendColor, fontSize: "0.8125rem", fontWeight: 700,
                }}>
                  <span>{trendArrow}</span>
                  {delta && <span>{delta}</span>}
                </div>
              )}
            </div>

            {/* Explanation */}
            <div style={{
              fontSize: "0.8125rem", color: "var(--foreground-muted)", lineHeight: 1.6,
              marginBottom: "0.75rem",
            }}>
              {explanation}
            </div>

            {/* Mini trend chart */}
            {history && history.length > 1 && (
              <div style={{
                marginBottom: "0.75rem",
                padding: "0.75rem",
                background: "var(--surface)",
                borderRadius: "0.75rem",
                border: "1px solid var(--border)",
              }}>
                <div style={{ fontSize: "0.7rem", color: "var(--foreground-subtle)", marginBottom: "0.5rem" }}>
                  מגמה אחרונה
                </div>
                <MiniTrendChart data={history} labels={historyLabels} color={trendColor} />
              </div>
            )}

            {/* Benchmark */}
            {benchmark && (
              <div style={{
                display: "flex", justifyContent: "space-between", alignItems: "center",
                padding: "0.5rem 0.75rem", borderRadius: "0.5rem",
                background: "var(--accent-muted)", marginBottom: "0.5rem",
                fontSize: "0.8rem",
              }}>
                <span style={{ color: "var(--foreground-muted)" }}>יעד</span>
                <span style={{ color: "var(--accent-text)", fontWeight: 700 }}>{benchmark}</span>
              </div>
            )}

            {/* Recommendation */}
            {recommendation && (
              <div style={{
                padding: "0.6rem 0.75rem", borderRadius: "0.5rem",
                background: "rgba(240, 255, 2, 0.06)",
                border: "1px solid rgba(240, 255, 2, 0.15)",
                fontSize: "0.8rem", color: "var(--foreground)",
                lineHeight: 1.5,
              }}>
                <span style={{ marginLeft: "0.25rem" }}>💡</span>
                {recommendation}
              </div>
            )}

            {/* Close button */}
            <button
              onClick={() => setOpen(false)}
              style={{
                position: "absolute", top: "0.75rem", left: "0.75rem",
                background: "none", border: "none",
                color: "var(--foreground-subtle)", cursor: "pointer",
                fontSize: "1.1rem", padding: "0.25rem",
                borderRadius: "0.375rem",
                transition: "color 150ms",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = "var(--foreground)")}
              onMouseLeave={(e) => (e.currentTarget.style.color = "var(--foreground-subtle)")}
            >
              ✕
            </button>
          </div>
        </>
      )}
    </>
  );
}

/* ── Mini SVG Trend Chart ───────────────────────────────────────────────── */
function MiniTrendChart({ data, labels, color }: { data: number[]; labels?: string[]; color: string }) {
  const width = 280;
  const height = 48;
  const padding = { top: 4, right: 4, bottom: 16, left: 4 };
  const chartW = width - padding.left - padding.right;
  const chartH = height - padding.top - padding.bottom;

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;

  const points = data.map((v, i) => ({
    x: padding.left + (i / (data.length - 1)) * chartW,
    y: padding.top + chartH - ((v - min) / range) * chartH,
  }));

  const pathD = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
  const areaD = `${pathD} L ${points[points.length - 1].x} ${height - padding.bottom} L ${points[0].x} ${height - padding.bottom} Z`;

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ display: "block" }}>
      {/* Gradient fill */}
      <defs>
        <linearGradient id="trendGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.2} />
          <stop offset="100%" stopColor={color} stopOpacity={0} />
        </linearGradient>
      </defs>
      <path d={areaD} fill="url(#trendGrad)" />
      <path d={pathD} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />

      {/* Current value dot */}
      <circle cx={points[points.length - 1].x} cy={points[points.length - 1].y} r={3} fill={color} />

      {/* Labels */}
      {labels && labels.map((label, i) => (
        <text
          key={i}
          x={points[i]?.x || 0}
          y={height - 2}
          textAnchor="middle"
          fontSize={8}
          fill="var(--foreground-subtle)"
        >
          {label}
        </text>
      ))}
    </svg>
  );
}
