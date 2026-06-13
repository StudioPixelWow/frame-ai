"use client";

/**
 * ContentWorkspaceShell — the ONE universal content/work-item workspace.
 *
 * Architecture: a single content item exists once. Only the entry point changes
 * (Content List, Monthly Calendar, Tasks, Approval Center, AI Recommendations).
 * Every entry point renders THIS shell — the overlay, slide-in panel, source
 * indicator, header, AI manager, production progress and sticky action footer
 * are identical everywhere. Type-specific detail (content sections vs. task
 * fields) is passed in via the `children` body slot, so sections that don't
 * apply to a given item simply aren't rendered — never a divergent modal.
 */

import type { ReactNode } from "react";
import Avatar from "@/components/ui/avatar";

export type WorkspaceSource =
  | "list"
  | "calendar"
  | "annual"
  | "queue"
  | "tasks"
  | "approval"
  | "ai";

const SOURCE_LABEL: Record<WorkspaceSource, string> = {
  list: "📋 רשימת תוכן",
  calendar: "📅 לוח חודשי",
  annual: "🗓️ לוח שנתי",
  queue: "📥 תור תוכן",
  tasks: "✅ משימות",
  approval: "👍 מרכז אישורים",
  ai: "🤖 המלצת AI",
};

export interface WorkspaceBadge {
  label: string;
  bg: string;
  color: string;
}

export interface WorkspaceAction {
  label: string;
  onClick: () => void;
  kind?: "primary" | "success" | "warn" | "ghost" | "danger";
  /** push this action (and following) to the far edge of the footer */
  alignEnd?: boolean;
}

export interface ContentWorkspaceShellProps {
  source: WorkspaceSource;
  emoji?: string;
  title: string;
  badges?: WorkspaceBadge[];
  /** rendered at the start-edge of the header row (e.g. a date input) */
  headerExtra?: ReactNode;
  owner?: { name?: string | null; avatarUrl?: string | null } | null;
  /** AI manager insight lines (first line highlighted as the priority) */
  aiInsights?: string[];
  aiTitle?: string;
  /** production progress stepper */
  stages?: string[];
  stageIdx?: number;
  percent?: number;
  accentColor?: string;
  actions?: WorkspaceAction[];
  onClose: () => void;
  children?: ReactNode;
}

function actionStyle(kind: WorkspaceAction["kind"]): React.CSSProperties {
  const base: React.CSSProperties = {
    border: "none",
    borderRadius: 10,
    padding: "0.5rem 1rem",
    fontWeight: 700,
    fontSize: "0.8rem",
    cursor: "pointer",
  };
  switch (kind) {
    case "success":
      return { ...base, background: "#22c55e", color: "#fff" };
    case "warn":
      return { ...base, background: "#fff7ed", color: "#c2410c", border: "1px solid #fed7aa" };
    case "danger":
      return { ...base, background: "#fef2f2", color: "#dc2626", border: "1px solid #fecaca" };
    case "ghost":
      return { ...base, background: "transparent", color: "var(--foreground-muted)", border: "1px solid var(--border)" };
    case "primary":
    default:
      return { ...base, background: "var(--accent)", color: "#fff" };
  }
}

export default function ContentWorkspaceShell({
  source,
  emoji,
  title,
  badges = [],
  headerExtra,
  owner,
  aiInsights = [],
  aiTitle = "מנהל תוכן AI",
  stages,
  stageIdx = 0,
  percent,
  accentColor = "var(--accent)",
  actions = [],
  onClose,
  children,
}: ContentWorkspaceShellProps) {
  const hasFooter = actions.length > 0;
  let endStarted = false;
  return (
    <div
      style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.45)", zIndex: 60 }}
      onClick={onClose}
    >
      <div
        className="cid-drawer"
        onClick={(e) => e.stopPropagation()}
        style={{
          position: "fixed",
          top: 0,
          bottom: 0,
          insetInlineStart: 0,
          direction: "rtl",
          width: "min(640px, 54vw)",
          maxWidth: "96vw",
          overflowY: "auto",
          paddingBottom: hasFooter ? "5rem" : 0,
          boxShadow: "8px 0 40px rgba(0,0,0,0.25)",
          animation: "cid-slide 0.28s ease",
          background: "var(--surface)",
        }}
      >
        <style>{`@keyframes cid-slide{from{transform:translateX(-100%)}to{transform:translateX(0)}}@media(max-width:760px){.cid-drawer{width:100vw !important}}`}</style>

        <div style={{ padding: "1.25rem 1.5rem" }}>
          {/* Header */}
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "0.75rem", marginBottom: "0.85rem" }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: "0.66rem", color: "var(--foreground-subtle)", marginBottom: 4 }}>
                נפתח מ: {SOURCE_LABEL[source]}
              </div>
              <h4 style={{ fontSize: "1rem", fontWeight: 700, color: "var(--foreground)", margin: "0 0 0.5rem 0" }}>
                {emoji ? `${emoji} ` : ""}{title || "ללא כותרת"}
              </h4>
              <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap", alignItems: "center" }}>
                {badges.map((b, i) => (
                  <span key={i} style={{ fontSize: "0.68rem", padding: "0.15rem 0.55rem", borderRadius: "1rem", background: b.bg, color: b.color, fontWeight: 600 }}>
                    {b.label}
                  </span>
                ))}
                {headerExtra}
              </div>
            </div>
            <button
              onClick={onClose}
              aria-label="סגור"
              style={{ flexShrink: 0, width: 30, height: 30, borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface-raised)", color: "var(--foreground-muted)", cursor: "pointer", fontSize: "0.9rem", lineHeight: 1 }}
            >
              ✕
            </button>
          </div>

          {/* AI Content Manager */}
          {aiInsights.length > 0 && (
            <div style={{ borderRadius: 12, padding: "0.85rem 1rem", background: "linear-gradient(135deg,#eef2ff,#ecfeff)", border: "1px solid #c7d2fe", marginBottom: "0.85rem" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                <span style={{ fontSize: "0.85rem", fontWeight: 900, background: "linear-gradient(90deg,#6366f1,#06b6d4)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>✨ {aiTitle}</span>
                {owner?.name && (
                  <span style={{ marginInlineStart: "auto", display: "inline-flex", alignItems: "center", gap: 5, fontSize: "0.7rem", color: "#475569" }}>
                    <Avatar src={owner.avatarUrl || undefined} name={owner.name} size={20} ring={false} />
                    {owner.name}
                  </span>
                )}
              </div>
              {aiInsights.map((t, i) => (
                <div key={i} style={{ display: "flex", gap: 7, alignItems: "flex-start", fontSize: "0.78rem", color: "#334155", marginBottom: 3 }}>
                  <span style={{ width: 6, height: 6, borderRadius: "50%", background: i === 0 ? "#f59e0b" : "#22c55e", marginTop: 6, flexShrink: 0 }} />
                  {t}
                </div>
              ))}
            </div>
          )}

          {/* Production progress */}
          {stages && stages.length > 0 && (
            <div style={{ border: "1px solid var(--border)", borderRadius: 12, padding: "0.85rem 1rem", marginBottom: "0.85rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.74rem", color: "var(--foreground-muted)", marginBottom: 8 }}>
                <span>התקדמות הפקה</span>
                {typeof percent === "number" && <span style={{ fontWeight: 800, color: accentColor }}>{percent}%</span>}
              </div>
              <div style={{ display: "flex", alignItems: "center" }}>
                {stages.map((s, i) => (
                  <div key={s} style={{ flex: 1, textAlign: "center", position: "relative" }}>
                    {i > 0 && <div style={{ position: "absolute", top: 11, insetInlineEnd: "50%", width: "100%", height: 2, background: i <= stageIdx ? "#22c55e" : "var(--border)" }} />}
                    <div style={{ position: "relative", zIndex: 1, width: 24, height: 24, borderRadius: "50%", margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.66rem", color: "#fff", background: i < stageIdx ? "#22c55e" : i === stageIdx ? accentColor : "var(--border)" }}>
                      {i < stageIdx ? "✓" : i + 1}
                    </div>
                    <div style={{ fontSize: "0.62rem", color: i <= stageIdx ? "var(--foreground)" : "var(--foreground-subtle)", marginTop: 4 }}>{s}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Type-specific body */}
          {children}
        </div>

        {/* Sticky action footer */}
        {hasFooter && (
          <div
            className="cid-drawer"
            style={{ position: "fixed", bottom: 0, insetInlineStart: 0, width: "min(640px, 54vw)", maxWidth: "96vw", background: "var(--surface-raised)", borderTop: "1px solid var(--border)", padding: "0.7rem 1.5rem", display: "flex", gap: 8, flexWrap: "wrap", zIndex: 2, direction: "rtl" }}
          >
            {actions.map((a, i) => {
              const mie = a.alignEnd && !endStarted ? ((endStarted = true), "auto") : undefined;
              return (
                <button key={i} onClick={a.onClick} style={{ ...actionStyle(a.kind), ...(mie ? { marginInlineStart: mie } : {}) }}>
                  {a.label}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
