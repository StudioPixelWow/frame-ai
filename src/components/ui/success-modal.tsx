"use client";

import { useState, useEffect, useCallback, ReactNode } from "react";
import { sound } from "@/lib/sound-feedback";
import { fireConfetti } from "@/lib/confetti";

/* ═══════════════════════════════════════════════════════════════════════════
   SuccessModal — premium glassmorphic success dialog
   Animated gradient border, icon bounce, confetti, next actions
   ═══════════════════════════════════════════════════════════════════════════ */

interface SuccessAction {
  label: string;
  icon?: string;
  onClick: () => void;
  variant?: "primary" | "ghost";
}

interface SuccessModalProps {
  show: boolean;
  icon?: string;
  title: string;
  subtitle?: string;
  actions?: SuccessAction[];
  onClose: () => void;
  confetti?: boolean;
  autoClose?: number; // ms, 0 = no auto close
}

export function SuccessModal({
  show,
  icon = "✓",
  title,
  subtitle,
  actions = [],
  onClose,
  confetti: showConfetti = true,
  autoClose = 0,
}: SuccessModalProps) {
  const [visible, setVisible] = useState(false);
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    if (show) {
      setVisible(true);
      setExiting(false);
      sound.success();
      if (showConfetti) {
        setTimeout(() => fireConfetti(50, 3500), 200);
      }
    }
  }, [show, showConfetti]);

  useEffect(() => {
    if (show && autoClose > 0) {
      const t = setTimeout(() => handleClose(), autoClose);
      return () => clearTimeout(t);
    }
  }, [show, autoClose]);

  const handleClose = useCallback(() => {
    setExiting(true);
    setTimeout(() => {
      setVisible(false);
      onClose();
    }, 300);
  }, [onClose]);

  if (!visible) return null;

  return (
    <div
      className={`living-success-overlay ${exiting ? "living-success-overlay-exit" : ""}`}
      onClick={handleClose}
      style={{ direction: "rtl" }}
    >
      <div
        className={`living-success-card ${exiting ? "living-success-card-exit" : ""}`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Animated icon */}
        <div
          style={{
            fontSize: "3rem",
            marginBottom: "1rem",
            animation: "living-icon-bounce 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) 0.15s both",
          }}
        >
          {icon}
        </div>

        {/* Title */}
        <h2
          style={{
            margin: "0 0 0.5rem 0",
            fontSize: "1.4rem",
            fontWeight: 800,
            color: "var(--foreground)",
            letterSpacing: "-0.01em",
            animation: "ux-slide-up 0.4s ease-out 0.2s both",
          }}
        >
          {title}
        </h2>

        {/* Subtitle */}
        {subtitle && (
          <p
            style={{
              margin: "0 0 1.5rem 0",
              fontSize: "0.88rem",
              color: "var(--foreground-muted)",
              lineHeight: 1.6,
              animation: "ux-slide-up 0.4s ease-out 0.3s both",
            }}
          >
            {subtitle}
          </p>
        )}

        {/* Action buttons */}
        {actions.length > 0 && (
          <div
            style={{
              display: "flex",
              gap: "0.6rem",
              justifyContent: "center",
              flexWrap: "wrap",
              animation: "ux-fade-in 0.4s ease-out 0.4s both",
            }}
          >
            {actions.map((action, i) => (
              <button
                key={i}
                onClick={() => {
                  sound.click();
                  action.onClick();
                }}
                className={`ux-btn ${action.variant === "ghost" ? "mod-btn-ghost" : "mod-btn-primary ux-btn-glow"}`}
                style={{
                  padding: "0.6rem 1.25rem",
                  fontSize: "0.85rem",
                  fontWeight: 700,
                  borderRadius: "0.5rem",
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "0.4rem",
                }}
              >
                {action.icon && <span>{action.icon}</span>}
                {action.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   useSuccessModal — hook for triggering success modals
   ═══════════════════════════════════════════════════════════════════════════ */

interface SuccessConfig {
  icon?: string;
  title: string;
  subtitle?: string;
  actions?: SuccessAction[];
  confetti?: boolean;
  autoClose?: number;
}

export function useSuccessModal() {
  const [config, setConfig] = useState<SuccessConfig | null>(null);

  const showSuccess = useCallback((cfg: SuccessConfig) => {
    setConfig(cfg);
  }, []);

  const hideSuccess = useCallback(() => {
    setConfig(null);
  }, []);

  return {
    isOpen: !!config,
    config,
    showSuccess,
    hideSuccess,
  };
}
