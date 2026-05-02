"use client";

import { useState, useEffect, useCallback } from "react";
import { sound } from "@/lib/sound-feedback";

/* ═══════════════════════════════════════════════════════════════════════════
   AISuggestionPopup — contextual glass card for AI suggestions
   Appears near trigger element, glass morphism + purple gradient border
   ═══════════════════════════════════════════════════════════════════════════ */

interface AISuggestionPopupProps {
  show: boolean;
  title?: string;
  suggestion: string;
  onApply?: () => void;
  onDismiss: () => void;
  position?: { top: number; right: number };
  applyLabel?: string;
}

export function AISuggestionPopup({
  show,
  title = "הצעת AI",
  suggestion,
  onApply,
  onDismiss,
  position,
  applyLabel = "החל",
}: AISuggestionPopupProps) {
  const [exiting, setExiting] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (show) {
      setVisible(true);
      setExiting(false);
      sound.aiSparkle();
    } else if (visible) {
      setExiting(true);
      const t = setTimeout(() => setVisible(false), 250);
      return () => clearTimeout(t);
    }
  }, [show, visible]);

  const handleDismiss = useCallback(() => {
    setExiting(true);
    setTimeout(() => {
      setVisible(false);
      onDismiss();
    }, 250);
  }, [onDismiss]);

  const handleApply = useCallback(() => {
    sound.success();
    onApply?.();
    handleDismiss();
  }, [onApply, handleDismiss]);

  if (!visible) return null;

  return (
    <div
      className={`living-ai-popup ${exiting ? "living-ai-popup-exit" : ""}`}
      style={{
        position: position ? "absolute" : "fixed",
        top: position?.top ?? "50%",
        right: position?.right,
        ...(position ? {} : { left: "50%", transform: "translateX(-50%) translateY(-50%)" }),
        zIndex: 1500,
        direction: "rtl",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: "0.75rem",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
          <span style={{ fontSize: "1rem" }}>🧠</span>
          <span
            style={{
              fontSize: "0.8rem",
              fontWeight: 700,
              background: "linear-gradient(135deg, #00B5FE, #00B5FE)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              letterSpacing: "-0.01em",
            }}
          >
            {title}
          </span>
          <span
            className="ux-ai-label"
            style={{ fontSize: "0.55rem" }}
          >
            AI
          </span>
        </div>
        <button
          onClick={handleDismiss}
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            color: "var(--foreground-muted)",
            fontSize: "1.1rem",
            padding: "0.15rem",
            lineHeight: 1,
            borderRadius: "50%",
            transition: "color 150ms ease",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.color = "var(--foreground)")}
          onMouseLeave={(e) => (e.currentTarget.style.color = "var(--foreground-muted)")}
        >
          ×
        </button>
      </div>

      {/* Suggestion text */}
      <p
        style={{
          fontSize: "0.82rem",
          color: "var(--foreground)",
          lineHeight: 1.6,
          margin: "0 0 1rem 0",
          opacity: 0.9,
        }}
      >
        {suggestion}
      </p>

      {/* Actions */}
      <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-start" }}>
        {onApply && (
          <button
            onClick={handleApply}
            className="mod-btn-primary ux-btn"
            style={{
              padding: "0.4rem 1rem",
              fontSize: "0.78rem",
              fontWeight: 700,
              borderRadius: "0.375rem",
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: "0.35rem",
            }}
          >
            <span>✨</span>
            {applyLabel}
          </button>
        )}
        <button
          onClick={handleDismiss}
          className="mod-btn-ghost ux-btn"
          style={{
            padding: "0.4rem 0.85rem",
            fontSize: "0.78rem",
            fontWeight: 600,
            borderRadius: "0.375rem",
            cursor: "pointer",
          }}
        >
          לא עכשיו
        </button>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   useAISuggestion — hook for managing suggestion popup state
   ═══════════════════════════════════════════════════════════════════════════ */

interface SuggestionConfig {
  title?: string;
  suggestion: string;
  applyLabel?: string;
  onApply?: () => void;
}

export function useAISuggestion() {
  const [config, setConfig] = useState<SuggestionConfig | null>(null);

  const showSuggestion = useCallback((cfg: SuggestionConfig) => {
    setConfig(cfg);
  }, []);

  const hideSuggestion = useCallback(() => {
    setConfig(null);
  }, []);

  return {
    isOpen: !!config,
    config,
    showSuggestion,
    hideSuggestion,
  };
}
