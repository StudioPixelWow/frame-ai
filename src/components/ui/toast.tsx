"use client";

import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';

type ToastType = 'success' | 'error' | 'info' | 'warning' | 'ai';

interface Toast {
  id: string;
  message: string;
  type: ToastType;
  duration: number;
  createdAt: number;
}

interface ToastContextType {
  toast: (message: string, type?: ToastType, duration?: number) => void;
  toasts: Toast[];
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const toast = useCallback((message: string, type: ToastType = 'info', duration: number = 3500) => {
    const id = Math.random().toString(36).slice(2);
    const createdAt = Date.now();
    setToasts(prev => [...prev, { id, message, type, duration, createdAt }]);

    const timer = setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, duration);

    return () => clearTimeout(timer);
  }, []);

  const removeToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  return (
    <ToastContext.Provider value={{ toast, toasts }}>
      {children}
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within ToastProvider');
  }
  return context.toast;
}

/* ── Toast visual config ─────────────────────────────────────────────────── */

const TOAST_CONFIG: Record<ToastType, {
  icon: string;
  bg: string;
  border: string;
  glow: string;
  accent: string;
}> = {
  success: {
    icon: '✓',
    bg: 'rgba(34,197,94,0.1)',
    border: 'rgba(34,197,94,0.3)',
    glow: 'rgba(34,197,94,0.15)',
    accent: '#22c55e',
  },
  error: {
    icon: '✕',
    bg: 'rgba(239,68,68,0.1)',
    border: 'rgba(239,68,68,0.3)',
    glow: 'rgba(239,68,68,0.15)',
    accent: '#ef4444',
  },
  warning: {
    icon: '⚠',
    bg: 'rgba(245,158,11,0.1)',
    border: 'rgba(245,158,11,0.3)',
    glow: 'rgba(245,158,11,0.15)',
    accent: '#f59e0b',
  },
  info: {
    icon: 'ℹ',
    bg: 'rgba(0,181,254,0.08)',
    border: 'rgba(0,181,254,0.25)',
    glow: 'rgba(0,181,254,0.12)',
    accent: '#00B5FE',
  },
  ai: {
    icon: '🧠',
    bg: 'linear-gradient(135deg, rgba(0,181,254,0.08), rgba(139,92,246,0.08))',
    border: 'rgba(0,181,254,0.25)',
    glow: 'rgba(139,92,246,0.15)',
    accent: '#8b5cf6',
  },
};

/* ── Single toast item ───────────────────────────────────────────────────── */

function ToastItem({ t, onRemove }: { t: Toast; onRemove: (id: string) => void }) {
  const [exiting, setExiting] = useState(false);
  const cfg = TOAST_CONFIG[t.type];

  useEffect(() => {
    const timeLeft = t.duration - (Date.now() - t.createdAt) - 300;
    if (timeLeft <= 0) return;
    const timer = setTimeout(() => setExiting(true), timeLeft);
    return () => clearTimeout(timer);
  }, [t.duration, t.createdAt]);

  const isGradientBg = cfg.bg.startsWith('linear');

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: '0.75rem',
        padding: '0.85rem 1rem',
        ...(isGradientBg
          ? { backgroundImage: cfg.bg }
          : { backgroundColor: cfg.bg }),
        borderRadius: '0.625rem',
        border: `1px solid ${cfg.border}`,
        backdropFilter: 'blur(16px) saturate(1.3)',
        WebkitBackdropFilter: 'blur(16px) saturate(1.3)',
        boxShadow: `0 10px 30px rgba(0,0,0,0.25), 0 0 16px ${cfg.glow}`,
        minWidth: '300px',
        maxWidth: '420px',
        pointerEvents: 'auto',
        animation: exiting
          ? 'ux-toast-out 250ms ease forwards'
          : 'ux-toast-in 350ms cubic-bezier(0.34, 1.56, 0.64, 1) forwards',
        position: 'relative',
        overflow: 'hidden',
        direction: 'rtl',
      }}
    >
      {/* Progress bar */}
      <div style={{
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: '2px',
        background: cfg.accent,
        transformOrigin: 'right',
        animation: `ux-toast-progress ${t.duration}ms linear forwards`,
        opacity: 0.5,
      }} />

      {/* Icon */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '1.6rem',
        height: '1.6rem',
        borderRadius: '50%',
        background: `${cfg.accent}18`,
        color: cfg.accent,
        fontSize: t.type === 'ai' ? '0.85rem' : '0.8rem',
        fontWeight: 700,
        flexShrink: 0,
      }}>
        {cfg.icon}
      </div>

      {/* Message */}
      <div style={{
        flex: 1,
        color: 'var(--foreground)',
        fontSize: '0.84rem',
        fontWeight: 500,
        lineHeight: 1.5,
        wordBreak: 'break-word',
      }}>
        {t.type === 'ai' && (
          <span style={{
            display: 'inline-block',
            fontSize: '0.6rem',
            fontWeight: 700,
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
            padding: '0.1rem 0.35rem',
            borderRadius: '0.2rem',
            background: 'linear-gradient(135deg, rgba(0,181,254,0.15), rgba(139,92,246,0.15))',
            color: '#8b5cf6',
            marginBottom: '0.25rem',
            marginInlineEnd: '0.4rem',
          }}>
            AI
          </span>
        )}
        {t.message}
      </div>

      {/* Close */}
      <button
        onClick={() => onRemove(t.id)}
        style={{
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          color: 'var(--foreground-muted)',
          fontSize: '1.1rem',
          padding: '0.15rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'color 150ms ease, transform 150ms ease',
          flexShrink: 0,
          lineHeight: 1,
          borderRadius: '50%',
        }}
        onMouseEnter={(e) => {
          const el = e.currentTarget;
          el.style.color = cfg.accent;
          el.style.transform = 'scale(1.15)';
        }}
        onMouseLeave={(e) => {
          const el = e.currentTarget;
          el.style.color = 'var(--foreground-muted)';
          el.style.transform = 'scale(1)';
        }}
        aria-label="סגור התראה"
      >
        ×
      </button>
    </div>
  );
}

/* ── Container ───────────────────────────────────────────────────────────── */

function ToastContainer({ toasts, onRemove }: { toasts: Toast[]; onRemove: (id: string) => void }) {
  return (
    <div
      style={{
        position: 'fixed',
        top: '1.25rem',
        insetInlineEnd: '1.25rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.6rem',
        zIndex: 2000,
        pointerEvents: 'none',
      }}
    >
      {toasts.map(t => (
        <ToastItem key={t.id} t={t} onRemove={onRemove} />
      ))}
    </div>
  );
}
