"use client";

/**
 * SaaS Design-System Kit — the shared, approved premium-SaaS primitives.
 *
 * This is the SOURCE OF TRUTH for the platform's visual language. Pages should
 * adopt these instead of re-styling headers/cards/badges by hand, so the whole
 * system stays consistent. Brand-consistent: light theme, turquoise/blue, RTL,
 * rounded cards, soft shadows. Pure CSS variables — no extra deps.
 *
 *   <PageHeader title subtitle primaryAction secondaryActions search />
 *   <KpiRow><KpiCard .../></KpiRow>
 *   <AICard title subtitle insights actions />
 *   <SectionCard title action>…</SectionCard>
 *   <StatusBadge label color />
 *   <EmptyState icon title hint action />
 *   <LoadingState />
 *   <Sparkline values />
 */
import React from "react";
import Link from "next/link";

export const BRAND = "#00B5FE";
const cardBase: React.CSSProperties = { background: "var(--surface-raised)", border: "1px solid var(--border)", borderRadius: 16, boxShadow: "0 1px 2px rgba(0,0,0,0.04)" };

/* ── Sparkline ─────────────────────────────────────────────── */
export function Sparkline({ values, color = BRAND, w = 104, h = 30 }: { values: number[]; color?: string; w?: number; h?: number }) {
  const v = values.length ? values : [0, 0];
  const max = Math.max(...v, 1), min = Math.min(...v, 0), span = max - min || 1;
  const pts = v.map((n, i) => `${(i / (v.length - 1 || 1)) * w},${h - ((n - min) / span) * (h - 4) - 2}`).join(" ");
  return <svg width={w} height={h} style={{ display: "block" }} aria-hidden><polyline points={pts} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

/* ── PageHeader ────────────────────────────────────────────── */
export interface HeaderAction { label: string; href?: string; onClick?: () => void; variant?: "primary" | "secondary" | "danger"; }
export function PageHeader({ title, subtitle, primaryAction, secondaryActions = [], search }: {
  title: string; subtitle?: string; primaryAction?: HeaderAction; secondaryActions?: HeaderAction[];
  search?: { value: string; onChange: (v: string) => void; placeholder?: string };
}) {
  const btn = (a: HeaderAction, key: number) => {
    const styles: Record<string, React.CSSProperties> = {
      primary: { background: "var(--accent)", color: "#fff", border: "none" },
      secondary: { background: "transparent", color: "var(--foreground-muted)", border: "1px solid var(--border)" },
      danger: { background: "#fef2f2", color: "#dc2626", border: "1px solid #fecaca" },
    };
    const s: React.CSSProperties = { ...styles[a.variant || "secondary"], padding: "0.55rem 1.1rem", borderRadius: 10, fontSize: "0.85rem", fontWeight: 700, cursor: "pointer", textDecoration: "none", whiteSpace: "nowrap", display: "inline-flex", alignItems: "center", gap: 6 };
    return a.href ? <Link key={key} href={a.href} style={s}>{a.label}</Link> : <button key={key} onClick={a.onClick} style={s}>{a.label}</button>;
  };
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, flexWrap: "wrap", marginBottom: "1.5rem", direction: "rtl" }}>
      <div style={{ minWidth: 200 }}>
        <h1 style={{ fontSize: "1.75rem", fontWeight: 800, color: "var(--foreground)", margin: 0, lineHeight: 1.15 }}>{title}</h1>
        {subtitle && <p style={{ fontSize: "0.92rem", color: "var(--foreground-muted)", margin: "0.35rem 0 0" }}>{subtitle}</p>}
      </div>
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        {search && (
          <input value={search.value} onChange={(e) => search.onChange(e.target.value)} placeholder={search.placeholder || "חיפוש…"}
            style={{ padding: "0.55rem 0.9rem", borderRadius: 10, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--foreground)", fontSize: "0.85rem", minWidth: 200 }} />
        )}
        {secondaryActions.map((a, i) => btn({ ...a, variant: a.variant || "secondary" }, i))}
        {primaryAction && btn({ ...primaryAction, variant: primaryAction.variant || "primary" }, 999)}
      </div>
    </div>
  );
}

/* ── KPI ───────────────────────────────────────────────────── */
export function KpiRow({ children, min = 200 }: { children: React.ReactNode; min?: number }) {
  return <div style={{ display: "grid", gridTemplateColumns: `repeat(auto-fit, minmax(${min}px,1fr))`, gap: "1rem", marginBottom: "1.5rem", direction: "rtl" }}>{children}</div>;
}
export function KpiCard({ label, value, icon, trend, series, color = BRAND, href, onClick }: {
  label: string; value: React.ReactNode; icon?: React.ReactNode; trend?: number; series?: number[]; color?: string; href?: string; onClick?: () => void;
}) {
  const inner = (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        {icon && <span style={{ fontSize: "1.4rem" }}>{icon}</span>}
        {typeof trend === "number" && trend !== 0 && <span style={{ fontSize: "0.72rem", fontWeight: 700, color: trend > 0 ? "#10b981" : "#ef4444" }}>{trend > 0 ? "▲" : "▼"} {Math.abs(trend)}%</span>}
      </div>
      <div style={{ fontSize: "1.9rem", fontWeight: 800, color: "var(--foreground)", lineHeight: 1 }}>{value}</div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
        <span style={{ fontSize: "0.82rem", color: "var(--foreground-muted)" }}>{label}</span>
        {series && series.length > 0 && <Sparkline values={series} color={color} />}
      </div>
    </>
  );
  const s: React.CSSProperties = { ...cardBase, padding: "1.25rem", display: "flex", flexDirection: "column", gap: 8, textDecoration: "none", cursor: href || onClick ? "pointer" : "default" };
  return href ? <Link href={href} style={s}>{inner}</Link> : <div style={s} onClick={onClick}>{inner}</div>;
}

/* ── AI assistant card ─────────────────────────────────────── */
export function AICard({ title = "✨ Pixel AI", subtitle, insights = [], actions = [] }: {
  title?: string; subtitle?: string; insights?: string[]; actions?: HeaderAction[];
}) {
  return (
    <div style={{ borderRadius: 18, padding: "1.4rem", background: "linear-gradient(135deg,#eef2ff 0%,#f5f3ff 45%,#ecfeff 100%)", border: "1px solid #c7d2fe", direction: "rtl", marginBottom: "1.5rem" }}>
      <div style={{ fontSize: "1.15rem", fontWeight: 900, background: "linear-gradient(90deg,#6366f1,#06b6d4)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>{title}</div>
      {subtitle && <div style={{ fontSize: "0.82rem", color: "#64748b", marginBottom: 10 }}>{subtitle}</div>}
      {insights.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: actions.length ? 12 : 0 }}>
          {insights.map((t, i) => <div key={i} style={{ fontSize: "0.83rem", color: "#334155", background: "rgba(255,255,255,0.65)", borderRadius: 8, padding: "0.45rem 0.7rem" }}>💡 {t}</div>)}
        </div>
      )}
      {actions.length > 0 && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {actions.map((a, i) => a.href
            ? <Link key={i} href={a.href} style={{ padding: "0.5rem 0.9rem", borderRadius: 10, border: "1px solid #c7d2fe", background: "rgba(255,255,255,0.7)", fontSize: "0.82rem", fontWeight: 700, color: "#4f46e5", textDecoration: "none" }}>{a.label}</Link>
            : <button key={i} onClick={a.onClick} style={{ padding: "0.5rem 0.9rem", borderRadius: 10, border: "1px solid #c7d2fe", background: "rgba(255,255,255,0.7)", fontSize: "0.82rem", fontWeight: 700, color: "#4f46e5", cursor: "pointer" }}>{a.label}</button>)}
        </div>
      )}
    </div>
  );
}

/* ── SectionCard ───────────────────────────────────────────── */
export function SectionCard({ title, action, children, style }: { title?: string; action?: React.ReactNode; children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{ ...cardBase, padding: "1.25rem", direction: "rtl", ...style }}>
      {(title || action) && (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
          {title && <div style={{ fontWeight: 800, fontSize: "1rem", color: "var(--foreground)" }}>{title}</div>}
          {action}
        </div>
      )}
      {children}
    </div>
  );
}

/* ── StatusBadge ───────────────────────────────────────────── */
export function StatusBadge({ label, color = BRAND }: { label: string; color?: string }) {
  return <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: "0.72rem", fontWeight: 700, color, background: `${color}1a`, borderRadius: 999, padding: "3px 11px", whiteSpace: "nowrap" }}>● {label}</span>;
}

/* ── EmptyState / LoadingState ─────────────────────────────── */
export function EmptyState({ icon = "📭", title, hint, action }: { icon?: string; title: string; hint?: string; action?: HeaderAction }) {
  return (
    <div style={{ ...cardBase, padding: "3rem 2rem", textAlign: "center", direction: "rtl" }}>
      <div style={{ fontSize: "2.5rem", marginBottom: 12 }}>{icon}</div>
      <div style={{ fontSize: "1.05rem", fontWeight: 700, color: "var(--foreground)", marginBottom: 6 }}>{title}</div>
      {hint && <div style={{ fontSize: "0.85rem", color: "var(--foreground-muted)", marginBottom: action ? 16 : 0 }}>{hint}</div>}
      {action && (action.href
        ? <Link href={action.href} style={{ display: "inline-block", padding: "0.6rem 1.3rem", borderRadius: 10, background: "var(--accent)", color: "#fff", fontWeight: 700, fontSize: "0.85rem", textDecoration: "none" }}>{action.label}</Link>
        : <button onClick={action.onClick} style={{ padding: "0.6rem 1.3rem", borderRadius: 10, background: "var(--accent)", color: "#fff", fontWeight: 700, fontSize: "0.85rem", border: "none", cursor: "pointer" }}>{action.label}</button>)}
    </div>
  );
}
export function LoadingState({ label = "טוען…" }: { label?: string }) {
  return (
    <div style={{ ...cardBase, padding: "3rem 2rem", textAlign: "center", color: "var(--foreground-muted)", direction: "rtl" }}>
      <div style={{ fontSize: "1.5rem", marginBottom: 8 }}>⏳</div>
      <div style={{ fontSize: "0.9rem" }}>{label}</div>
    </div>
  );
}
