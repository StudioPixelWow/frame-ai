"use client";

import { useState, useCallback, useRef, MouseEvent, ReactNode } from "react";
import { sound } from "@/lib/sound-feedback";

/* ═══════════════════════════════════════════════════════════════════════════
   LivingButton — button with ripple, loading shimmer, success/error morph
   ═══════════════════════════════════════════════════════════════════════════ */

type ButtonState = "idle" | "loading" | "success" | "error";

interface LivingButtonProps {
  children: ReactNode;
  onClick?: (e: MouseEvent<HTMLButtonElement>) => void | Promise<void>;
  variant?: "primary" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
  disabled?: boolean;
  className?: string;
  style?: React.CSSProperties;
  /** If true, onClick return promise auto-triggers loading → success/error */
  autoState?: boolean;
  successText?: string;
  errorText?: string;
}

const SIZE_MAP = {
  sm: { padding: "0.4rem 0.85rem", fontSize: "0.78rem" },
  md: { padding: "0.6rem 1.25rem", fontSize: "0.88rem" },
  lg: { padding: "0.75rem 1.75rem", fontSize: "0.95rem" },
};

export function LivingButton({
  children,
  onClick,
  variant = "primary",
  size = "md",
  disabled = false,
  className = "",
  style,
  autoState = false,
  successText = "בוצע!",
  errorText = "שגיאה",
}: LivingButtonProps) {
  const [state, setState] = useState<ButtonState>("idle");
  const btnRef = useRef<HTMLButtonElement>(null);

  const createRipple = useCallback((e: MouseEvent<HTMLButtonElement>) => {
    const btn = btnRef.current;
    if (!btn) return;

    const rect = btn.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const ripple = document.createElement("span");
    ripple.className = "living-btn-ripple-dot";
    ripple.style.left = `${x}px`;
    ripple.style.top = `${y}px`;
    btn.appendChild(ripple);
    setTimeout(() => ripple.remove(), 600);
  }, []);

  const handleClick = useCallback(
    async (e: MouseEvent<HTMLButtonElement>) => {
      if (disabled || state === "loading") return;

      createRipple(e);
      sound.click();

      if (!autoState || !onClick) {
        onClick?.(e);
        return;
      }

      setState("loading");
      try {
        await onClick(e);
        setState("success");
        sound.success();
        setTimeout(() => setState("idle"), 1800);
      } catch {
        setState("error");
        sound.error();
        setTimeout(() => setState("idle"), 1800);
      }
    },
    [onClick, disabled, state, autoState, createRipple]
  );

  const variantClass =
    variant === "primary"
      ? "mod-btn-primary"
      : variant === "danger"
      ? "mod-btn-danger"
      : "mod-btn-ghost";

  const stateClass =
    state === "loading"
      ? "living-btn-loading"
      : state === "success"
      ? "living-btn-success"
      : state === "error"
      ? "living-btn-error"
      : "";

  const sizeStyles = SIZE_MAP[size];

  return (
    <button
      ref={btnRef}
      className={`living-btn ux-btn ${variantClass} ${stateClass} ${className}`.trim()}
      onClick={handleClick}
      disabled={disabled || state === "loading"}
      style={{
        ...sizeStyles,
        fontWeight: 700,
        borderRadius: "0.5rem",
        cursor: disabled ? "not-allowed" : "pointer",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: "0.5rem",
        position: "relative",
        overflow: "hidden",
        transition: "all 200ms ease",
        opacity: disabled ? 0.5 : 1,
        ...style,
      }}
    >
      {state === "loading" && (
        <span
          style={{
            display: "inline-block",
            width: "14px",
            height: "14px",
            border: "2px solid rgba(255,255,255,0.3)",
            borderTopColor: "#fff",
            borderRadius: "50%",
            animation: "spin 0.6s linear infinite",
          }}
        />
      )}
      {state === "success" ? (
        <span style={{ display: "inline-flex", alignItems: "center", gap: "0.35rem" }}>
          <span style={{ fontSize: "1rem" }}>✓</span> {successText}
        </span>
      ) : state === "error" ? (
        <span style={{ display: "inline-flex", alignItems: "center", gap: "0.35rem" }}>
          <span style={{ fontSize: "1rem" }}>✕</span> {errorText}
        </span>
      ) : state === "loading" ? (
        <span style={{ opacity: 0.7 }}>מעבד...</span>
      ) : (
        children
      )}
    </button>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   useLivingButton — hook for adding living behavior to existing buttons
   ═══════════════════════════════════════════════════════════════════════════ */

export function useLivingButton() {
  const [state, setState] = useState<ButtonState>("idle");

  const trigger = useCallback(async (action: () => Promise<void>) => {
    setState("loading");
    try {
      await action();
      setState("success");
      sound.success();
      setTimeout(() => setState("idle"), 1800);
    } catch {
      setState("error");
      sound.error();
      setTimeout(() => setState("idle"), 1800);
    }
  }, []);

  const createRipple = useCallback((e: MouseEvent<HTMLElement>) => {
    const el = e.currentTarget;
    const rect = el.getBoundingClientRect();
    const ripple = document.createElement("span");
    ripple.className = "living-btn-ripple-dot";
    ripple.style.left = `${e.clientX - rect.left}px`;
    ripple.style.top = `${e.clientY - rect.top}px`;
    el.appendChild(ripple);
    setTimeout(() => ripple.remove(), 600);
    sound.click();
  }, []);

  return { state, trigger, createRipple };
}
