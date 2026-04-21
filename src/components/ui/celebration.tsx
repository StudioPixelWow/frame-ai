"use client";

import { useState, useEffect } from "react";

interface CelebrationPopupProps {
  show: boolean;
  title: string;
  subtitle?: string;
  icon?: string;
  onDone?: () => void;
}

export function CelebrationPopup({
  show,
  title,
  subtitle,
  icon = "✓",
  onDone,
}: CelebrationPopupProps) {
  const [isVisible, setIsVisible] = useState(show);

  useEffect(() => {
    if (!show) {
      setIsVisible(false);
      return;
    }

    setIsVisible(true);
    const timer = setTimeout(() => {
      setIsVisible(false);
      onDone?.();
    }, 2500);

    return () => clearTimeout(timer);
  }, [show, onDone]);

  if (!isVisible) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 2000,
        pointerEvents: "none",
      }}
    >
      <div
        style={{
          backgroundColor: "var(--surface-raised)",
          borderRadius: "1rem",
          border: "1px solid var(--border)",
          boxShadow:
            "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 0 40px rgba(34, 197, 94, 0.2)",
          padding: "2rem",
          maxWidth: "28rem",
          width: "90%",
          textAlign: "center",
          animation: "ux-success-wave 0.6s cubic-bezier(0.34, 1.56, 0.64, 1)",
        }}
      >
        {/* Icon with glow */}
        <div
          style={{
            fontSize: "3rem",
            marginBottom: "1rem",
            animation: "ux-pop 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)",
            color: "#22c55e",
            textShadow: "0 0 20px rgba(34, 197, 94, 0.6)",
          }}
        >
          {icon}
        </div>

        {/* Title with staged reveal */}
        <h2
          style={{
            margin: "0 0 0.5rem 0",
            fontSize: "1.5rem",
            fontWeight: 700,
            color: "var(--foreground)",
            animation:
              "ux-slide-up 0.5s ease-out 0.1s both, ux-fade-in 0.4s ease-out 0.1s both",
          }}
        >
          {title}
        </h2>

        {/* Subtitle with staged reveal */}
        {subtitle && (
          <p
            style={{
              margin: 0,
              fontSize: "0.95rem",
              color: "var(--foreground-muted)",
              animation:
                "ux-slide-up 0.5s ease-out 0.2s both, ux-fade-in 0.4s ease-out 0.2s both",
            }}
          >
            {subtitle}
          </p>
        )}
      </div>
    </div>
  );
}

interface SuccessWaveProps {
  active: boolean;
  onDone?: () => void;
}

export function SuccessWave({ active, onDone }: SuccessWaveProps) {
  const [isActive, setIsActive] = useState(active);

  useEffect(() => {
    if (!active) {
      setIsActive(false);
      return;
    }

    setIsActive(true);
    const timer = setTimeout(() => {
      setIsActive(false);
      onDone?.();
    }, 1200);

    return () => clearTimeout(timer);
  }, [active, onDone]);

  if (!isActive) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        pointerEvents: "none",
        animation: "ux-success-wave 1s ease-out forwards",
        background:
          "radial-gradient(circle, rgba(34, 197, 94, 0.3) 0%, transparent 70%)",
      }}
    />
  );
}

interface InlineSuccessProps {
  text: string;
  visible: boolean;
}

export function InlineSuccess({ text, visible }: InlineSuccessProps) {
  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "0.5rem",
        color: "#22c55e",
        fontSize: "0.875rem",
        fontWeight: 500,
        animation: visible
          ? "ux-fade-in 0.3s ease-out forwards"
          : "ux-fade-out 0.3s ease-out forwards",
        opacity: visible ? 1 : 0,
      }}
    >
      <span
        style={{
          display: "inline-block",
          width: "1.25rem",
          height: "1.25rem",
          borderRadius: "50%",
          backgroundColor: "#22c55e",
          color: "white",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: "0.75rem",
          fontWeight: 700,
        }}
      >
        ✓
      </span>
      {text}
    </div>
  );
}
