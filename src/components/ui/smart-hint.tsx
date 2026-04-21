"use client";

import { useState } from "react";

/* ═══════════════════════════════════════════════════════════════════════════
   SmartHint — contextual hints that appear dynamically, disappear when fixed
   InlineAISuggestion — AI Insight cards with glowing border
   EmptyStateAI — premium empty state with AI suggestion + CTA
   AIThinkingDots — animated loading indicator for AI operations
   ═══════════════════════════════════════════════════════════════════════════ */

interface SmartHintProps {
  icon?: string;
  text: string;
  type?: "info" | "warning" | "success" | "ai";
  dismissible?: boolean;
  onDismiss?: () => void;
}

export function SmartHint({ icon, text, type = "ai", dismissible = true, onDismiss }: SmartHintProps) {
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) return null;

  return (
    <div className={`ux-hint ux-hint-${type}`}>
      {icon && <span style={{ flexShrink: 0 }}>{icon}</span>}
      {type === "ai" && <span className="ux-ai-label">AI</span>}
      <span style={{ flex: 1 }}>{text}</span>
      {dismissible && (
        <button
          onClick={() => {
            setDismissed(true);
            onDismiss?.();
          }}
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            color: "var(--foreground-muted)",
            fontSize: "0.9rem",
            padding: "0.15rem",
            lineHeight: 1,
            transition: "color 150ms ease",
            flexShrink: 0,
          }}
          aria-label="סגור"
        >
          ×
        </button>
      )}
    </div>
  );
}

/* ── Inline AI Suggestion ────────────────────────────────────────────────── */

interface InlineAISuggestionProps {
  title?: string;
  text: string;
  icon?: string;
  action?: { label: string; onClick: () => void };
}

export function InlineAISuggestion({ title, text, icon = "💡", action }: InlineAISuggestionProps) {
  return (
    <div className="ux-ai-insight" style={{ direction: "rtl" }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: "0.5rem" }}>
        <span style={{ fontSize: "1rem", flexShrink: 0, marginTop: "0.1rem" }}>{icon}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.35rem", marginBottom: "0.3rem" }}>
            <span className="ux-ai-label">AI Insight</span>
            {title && (
              <span style={{ fontSize: "0.78rem", fontWeight: 700, color: "var(--foreground)" }}>
                {title}
              </span>
            )}
          </div>
          <div
            style={{
              fontSize: "0.8rem",
              color: "var(--foreground)",
              lineHeight: 1.6,
              fontWeight: 500,
            }}
          >
            {text}
          </div>
          {action && (
            <button
              onClick={action.onClick}
              className="ux-ai-tone-btn"
              style={{ marginTop: "0.5rem" }}
            >
              {action.label}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Empty State with AI Suggestion ──────────────────────────────────────── */

interface EmptyStateAIProps {
  icon?: string;
  title: string;
  subtitle?: string;
  aiSuggestion?: string;
  ctaLabel?: string;
  onCta?: () => void;
}

export function EmptyStateAI({ icon = "🤖", title, subtitle, aiSuggestion, ctaLabel, onCta }: EmptyStateAIProps) {
  return (
    <div className="ux-empty-state">
      <div className="ux-empty-icon">{icon}</div>
      <div className="ux-empty-title">{title}</div>
      {subtitle && <div className="ux-empty-text">{subtitle}</div>}
      {aiSuggestion && (
        <div
          className="ux-ai-insight"
          style={{
            maxWidth: "380px",
            textAlign: "start",
            direction: "rtl",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
            <span className="ux-ai-label">AI</span>
            <span style={{ fontSize: "0.8rem", fontWeight: 500, color: "var(--foreground)", lineHeight: 1.5 }}>
              {aiSuggestion}
            </span>
          </div>
        </div>
      )}
      {ctaLabel && onCta && (
        <button className="ux-empty-cta" onClick={onCta}>
          {ctaLabel}
        </button>
      )}
    </div>
  );
}

/* ── AI Thinking Dots ────────────────────────────────────────────────────── */

interface AIThinkingProps {
  text?: string;
}

export function AIThinkingDots({ text = "AI חושב..." }: AIThinkingProps) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "0.5rem",
        padding: "0.6rem 0.85rem",
        borderRadius: "0.5rem",
        background: "linear-gradient(135deg, rgba(0,181,254,0.04), rgba(139,92,246,0.04))",
        border: "1px solid rgba(0,181,254,0.12)",
        direction: "rtl",
      }}
    >
      <div className="ux-ai-thinking-dots" style={{ display: "flex", gap: "3px" }}>
        <span />
        <span />
        <span />
      </div>
      <span style={{ fontSize: "0.78rem", fontWeight: 600, color: "var(--accent)" }}>{text}</span>
    </div>
  );
}

/* ── AI Tone Buttons Row ─────────────────────────────────────────────────── */

interface AIToneButtonsProps {
  onTone: (tone: string) => void;
  loading?: boolean;
  disabled?: boolean;
}

export function AIToneButtons({ onTone, loading = false, disabled = false }: AIToneButtonsProps) {
  const tones = [
    { key: "improve", label: "שפר", icon: "✨" },
    { key: "shorten", label: "קצר", icon: "✂️" },
    { key: "aggressive", label: "יותר אגרסיבי", icon: "🔥" },
    { key: "emotional", label: "יותר רגשי", icon: "💛" },
  ];

  return (
    <div style={{ display: "flex", gap: "0.35rem", flexWrap: "wrap", direction: "rtl" }}>
      {tones.map((t) => (
        <button
          key={t.key}
          className="ux-ai-tone-btn"
          onClick={() => onTone(t.key)}
          disabled={disabled || loading}
          style={{
            opacity: disabled || loading ? 0.5 : 1,
            cursor: disabled || loading ? "not-allowed" : "pointer",
          }}
        >
          <span>{t.icon}</span>
          <span>{t.label}</span>
        </button>
      ))}
    </div>
  );
}
