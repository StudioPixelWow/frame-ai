"use client";

import React, { Component, ReactNode } from "react";

/* ═══════════════════════════════════════════════════════════════════════════
   Reusable Data State Components — Loading, Empty, Error
   Production-safe, premium styling, Hebrew text
═════════════════════════════════════════════════════════════════════════════ */

/** Premium empty state */
export function EmptyState({
  icon = "📭",
  title = "אין נתונים להצגה כרגע",
  subtitle,
  action,
}: {
  icon?: string;
  title?: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <div
      className="premium-card"
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "3rem 2rem",
        textAlign: "center",
        direction: "rtl",
      }}
    >
      <span style={{ fontSize: "2.5rem", marginBottom: "1rem", opacity: 0.5 }}>
        {icon}
      </span>
      <p
        style={{
          fontSize: "1.1rem",
          fontWeight: 600,
          color: "var(--foreground)",
          marginBottom: "0.5rem",
        }}
      >
        {title}
      </p>
      {subtitle && (
        <p
          style={{
            fontSize: "0.85rem",
            color: "var(--foreground-muted)",
            maxWidth: "360px",
            lineHeight: 1.6,
          }}
        >
          {subtitle}
        </p>
      )}
      {action && <div style={{ marginTop: "1rem" }}>{action}</div>}
    </div>
  );
}

/** Premium error state */
export function ErrorState({
  title = "אירעה שגיאה בטעינת הנתונים",
  subtitle = "נסה לרענן את הדף או לבדוק את החיבור",
  onRetry,
}: {
  title?: string;
  subtitle?: string;
  onRetry?: () => void;
}) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "3rem 2rem",
        textAlign: "center",
        direction: "rtl",
        background: "rgba(239,68,68,0.04)",
        border: "1px solid rgba(239,68,68,0.12)",
        borderRadius: "0.75rem",
      }}
    >
      <span style={{ fontSize: "2.5rem", marginBottom: "1rem", opacity: 0.6 }}>
        ⚠️
      </span>
      <p
        style={{
          fontSize: "1.1rem",
          fontWeight: 600,
          color: "var(--foreground)",
          marginBottom: "0.5rem",
        }}
      >
        {title}
      </p>
      <p
        style={{
          fontSize: "0.85rem",
          color: "var(--foreground-muted)",
          maxWidth: "360px",
          lineHeight: 1.6,
          marginBottom: onRetry ? "1rem" : "0",
        }}
      >
        {subtitle}
      </p>
      {onRetry && (
        <button
          onClick={onRetry}
          style={{
            padding: "0.5rem 1.25rem",
            fontSize: "0.82rem",
            fontWeight: 600,
            border: "1px solid var(--border)",
            borderRadius: "0.5rem",
            background: "var(--surface)",
            color: "var(--foreground)",
            cursor: "pointer",
            transition: "all 150ms ease",
          }}
        >
          נסה שוב
        </button>
      )}
    </div>
  );
}

/** Premium loading skeleton */
export function LoadingState({
  message = "טוען נתונים...",
  rows = 3,
}: {
  message?: string;
  rows?: number;
}) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "1rem",
        padding: "2rem",
        direction: "rtl",
      }}
    >
      <p
        style={{
          fontSize: "0.85rem",
          color: "var(--foreground-muted)",
          textAlign: "center",
          marginBottom: "0.5rem",
        }}
      >
        {message}
      </p>
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="skeleton-shimmer"
          style={{
            height: "3.5rem",
            borderRadius: "0.625rem",
            opacity: 1 - i * 0.15,
          }}
        />
      ))}
    </div>
  );
}

/** Error Boundary — catches render crashes and shows ErrorState instead of white screen */
interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class DataErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("[DataErrorBoundary]", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <div style={{ padding: "2rem" }}>
          <ErrorState
            title="אירעה שגיאה בלתי צפויה"
            subtitle="נסה לרענן את הדף. אם הבעיה נמשכת, פנה לתמיכה."
            onRetry={() => {
              this.setState({ hasError: false, error: null });
              window.location.reload();
            }}
          />
        </div>
      );
    }
    return this.props.children;
  }
}
