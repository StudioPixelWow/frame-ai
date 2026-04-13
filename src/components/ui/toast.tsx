"use client";

import { createContext, useContext, useState, useCallback, ReactNode } from 'react';

type ToastType = 'success' | 'error' | 'info' | 'warning';

interface Toast {
  id: string;
  message: string;
  type: ToastType;
}

interface ToastContextType {
  toast: (message: string, type: ToastType) => void;
  toasts: Toast[];
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const toast = useCallback((message: string, type: ToastType) => {
    const id = Math.random().toString(36).slice(2);
    setToasts(prev => [...prev, { id, message, type }]);

    // Auto-dismiss after 3 seconds
    const timer = setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 3000);

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

interface ToastContainerProps {
  toasts: Toast[];
  onRemove: (id: string) => void;
}

function ToastContainer({ toasts, onRemove }: ToastContainerProps) {
  const getIconAndColor = (type: ToastType) => {
    switch (type) {
      case 'success':
        return { icon: '✓', bgColor: 'rgba(34, 197, 94, 0.15)', borderColor: '#22c55e' };
      case 'error':
        return { icon: '✕', bgColor: 'rgba(239, 68, 68, 0.15)', borderColor: '#ef4444' };
      case 'warning':
        return { icon: '!', bgColor: 'rgba(245, 158, 11, 0.15)', borderColor: '#f59e0b' };
      case 'info':
      default:
        return { icon: 'ℹ', bgColor: 'rgba(0, 181, 254, 0.15)', borderColor: '#00B5FE' };
    }
  };

  const getTextColor = (type: ToastType) => {
    switch (type) {
      case 'success':
        return '#22c55e';
      case 'error':
        return '#ef4444';
      case 'warning':
        return '#f59e0b';
      case 'info':
      default:
        return '#00B5FE';
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: '1rem',
        insetInlineEnd: '1rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.75rem',
        zIndex: 2000,
        pointerEvents: 'none',
      }}
    >
      {toasts.map(t => {
        const { icon, bgColor, borderColor } = getIconAndColor(t.type);
        const textColor = getTextColor(t.type);

        return (
          <div
            key={t.id}
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: '0.75rem',
              padding: '1rem',
              backgroundColor: bgColor,
              borderRadius: '0.5rem',
              border: `1px solid ${borderColor}`,
              backdropFilter: 'blur(10px)',
              boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.3)',
              minWidth: '280px',
              maxWidth: '400px',
              pointerEvents: 'auto',
              animation: 'slideIn 200ms ease',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '1.5rem',
                height: '1.5rem',
                borderRadius: '50%',
                backgroundColor: 'rgba(0, 0, 0, 0.1)',
                color: textColor,
                fontSize: '0.875rem',
                fontWeight: 600,
                flexShrink: 0,
              }}
            >
              {icon}
            </div>
            <div
              style={{
                flex: 1,
                color: 'var(--foreground)',
                fontSize: '0.875rem',
                wordBreak: 'break-word',
              }}
            >
              {t.message}
            </div>
            <button
              onClick={() => onRemove(t.id)}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: 'var(--foreground-muted)',
                fontSize: '1rem',
                padding: '0.25rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'color 150ms ease',
                flexShrink: 0,
              }}
              onMouseEnter={(e) => {
                (e.target as HTMLElement).style.color = textColor;
              }}
              onMouseLeave={(e) => {
                (e.target as HTMLElement).style.color = 'var(--foreground-muted)';
              }}
              aria-label="Dismiss notification"
            >
              ×
            </button>
          </div>
        );
      })}

      <style>{`
        @keyframes slideIn {
          from {
            opacity: 0;
            transform: translateX(1rem);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }
      `}</style>
    </div>
  );
}
