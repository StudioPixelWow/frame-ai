'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useOperationalAlerts } from '@/lib/alerts/use-alerts';
import { SEVERITY_CONFIG } from '@/lib/alerts/engine';
import type { AlertSeverity } from '@/lib/alerts/engine';

export function NotificationCenter() {
  const router = useRouter();
  const { alerts, totalAlerts, criticalCount, warningCount } = useOperationalAlerts();
  const [isOpen, setIsOpen] = useState(false);
  const [severityFilter, setSeverityFilter] = useState<Set<AlertSeverity>>(
    new Set(['critical', 'warning', 'info'])
  );
  const [readAlerts, setReadAlerts] = useState<Set<string>>(new Set());
  const dropdownRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        buttonRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        !buttonRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  // Toggle severity filter
  const toggleFilter = (severity: AlertSeverity) => {
    const newFilter = new Set(severityFilter);
    if (newFilter.has(severity)) {
      newFilter.delete(severity);
    } else {
      newFilter.add(severity);
    }
    setSeverityFilter(newFilter);
  };

  // Filter alerts by selected severity
  const filteredAlerts = alerts.filter((alert) => severityFilter.has(alert.severity));

  // Calculate unread alerts
  const unreadAlerts = alerts.filter((alert) => !readAlerts.has(alert.id));
  const unreadCount = unreadAlerts.length;
  const unreadCriticalCount = unreadAlerts.filter((a) => a.severity === 'critical').length;
  const unreadWarningCount = unreadAlerts.filter((a) => a.severity === 'warning').length;

  // Determine badge color based on unread alerts
  const getBadgeColor = () => {
    if (unreadCriticalCount > 0) return '#ef4444'; // red
    if (unreadWarningCount > 0) return '#f59e0b'; // amber
    return '#3b82f6'; // blue
  };

  // Handle alert click
  const handleAlertClick = (alert: typeof alerts[0]) => {
    // Mark as read
    const newReadAlerts = new Set(readAlerts);
    newReadAlerts.add(alert.id);
    setReadAlerts(newReadAlerts);

    // Close dropdown and navigate
    setIsOpen(false);
    if (alert.linkHref) {
      router.push(alert.linkHref);
    }
  };

  const bellIcon = (
    <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0018 9.75V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
    </svg>
  );

  const severityIcons: Record<AlertSeverity, string> = {
    critical: '🔴',
    warning: '🟡',
    info: '🔵',
  };

  return (
    <div style={{ position: 'relative' }}>
      {/* Bell Button with Badge */}
      <button
        ref={buttonRef}
        onClick={() => setIsOpen(!isOpen)}
        style={{
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '40px',
          height: '40px',
          borderRadius: '6px',
          border: 'none',
          backgroundColor: 'transparent',
          color: 'var(--foreground)',
          cursor: 'pointer',
          transition: 'all 150ms ease-out',
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'var(--surface-raised)';
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent';
        }}
        title="התראות"
      >
        {bellIcon}

        {/* Badge */}
        {unreadCount > 0 && (
          <div
            style={{
              position: 'absolute',
              top: '-2px',
              right: '-2px',
              width: '20px',
              height: '20px',
              borderRadius: '50%',
              backgroundColor: getBadgeColor(),
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '12px',
              fontWeight: '600',
              color: '#ffffff',
              boxShadow: `0 0 0 2px var(--surface)`,
              animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
            }}
          >
            {unreadCount > 9 ? '9+' : unreadCount}
          </div>
        )}
      </button>

      {/* Dropdown Panel */}
      {isOpen && (
        <div
          ref={dropdownRef}
          style={{
            position: 'absolute',
            top: '100%',
            right: '0',
            marginTop: '8px',
            width: '380px',
            backgroundColor: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: '10px',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
            backdropFilter: 'blur(12px)',
            zIndex: 50,
            animation: 'fadeIn 150ms ease-out',
          }}
        >
          {/* Header */}
          <div
            style={{
              padding: '16px',
              borderBottom: '1px solid var(--border)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              direction: 'rtl',
            }}
          >
            <h2
              style={{
                fontSize: '16px',
                fontWeight: '600',
                color: 'var(--foreground)',
                margin: 0,
              }}
            >
              התראות
            </h2>
            <span
              style={{
                fontSize: '13px',
                fontWeight: '500',
                color: 'var(--foreground-muted)',
                backgroundColor: 'var(--surface-raised)',
                padding: '4px 8px',
                borderRadius: '4px',
              }}
            >
              {filteredAlerts.length}
            </span>
          </div>

          {/* Severity Filter Chips */}
          <div
            style={{
              padding: '12px 16px',
              display: 'flex',
              gap: '8px',
              borderBottom: '1px solid var(--border)',
              justifyContent: 'flex-end',
              direction: 'rtl',
            }}
          >
            {(['critical', 'warning', 'info'] as const).map((severity) => (
              <button
                key={severity}
                onClick={() => toggleFilter(severity)}
                style={{
                  padding: '6px 12px',
                  borderRadius: '6px',
                  border: severityFilter.has(severity) ? '1.5px solid var(--accent)' : '1.5px solid var(--border)',
                  backgroundColor: severityFilter.has(severity) ? `${SEVERITY_CONFIG[severity].bg}` : 'transparent',
                  color: severityFilter.has(severity) ? SEVERITY_CONFIG[severity].color : 'var(--foreground-muted)',
                  fontSize: '12px',
                  fontWeight: '500',
                  cursor: 'pointer',
                  transition: 'all 150ms ease-out',
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--accent)';
                }}
                onMouseLeave={(e) => {
                  if (!severityFilter.has(severity)) {
                    (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--border)';
                  }
                }}
              >
                {SEVERITY_CONFIG[severity].label}
              </button>
            ))}
          </div>

          {/* Scrollable Alerts List */}
          <div
            style={{
              maxHeight: '400px',
              overflowY: 'auto',
              direction: 'rtl',
            }}
          >
            {filteredAlerts.length === 0 ? (
              <div
                style={{
                  padding: '32px 16px',
                  textAlign: 'center',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '12px',
                }}
              >
                <div
                  style={{
                    fontSize: '36px',
                    opacity: 0.5,
                  }}
                >
                  ✓
                </div>
                <div
                  style={{
                    color: 'var(--foreground-muted)',
                    fontSize: '14px',
                  }}
                >
                  אין התראות חדשות
                </div>
              </div>
            ) : (
              filteredAlerts.map((alert) => {
                const isUnread = !readAlerts.has(alert.id);
                return (
                  <div
                    key={alert.id}
                    onClick={() => handleAlertClick(alert)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        handleAlertClick(alert);
                      }
                    }}
                    role="button"
                    tabIndex={0}
                    style={{
                      padding: '12px 16px',
                      borderBottom: '1px solid var(--border)',
                      borderRight: isUnread ? '3px solid var(--accent)' : '3px solid transparent',
                      display: 'flex',
                      gap: '12px',
                      alignItems: 'flex-start',
                      backgroundColor: isUnread ? 'var(--surface-raised)' : 'transparent',
                      cursor: 'pointer',
                      transition: 'all 150ms ease-out',
                    }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLDivElement).style.backgroundColor = isUnread
                        ? 'rgba(var(--accent-rgb), 0.1)'
                        : 'var(--surface-raised)';
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLDivElement).style.backgroundColor = isUnread
                        ? 'var(--surface-raised)'
                        : 'transparent';
                    }}
                  >
                  {/* Severity Icon */}
                  <div
                    style={{
                      fontSize: '18px',
                      flexShrink: 0,
                      marginTop: '2px',
                    }}
                  >
                    {severityIcons[alert.severity]}
                  </div>

                  {/* Content */}
                  <div
                    style={{
                      flex: 1,
                      minWidth: 0,
                    }}
                  >
                    <h3
                      style={{
                        fontSize: '13px',
                        fontWeight: '600',
                        color: 'var(--foreground)',
                        margin: '0 0 4px 0',
                        textAlign: 'right',
                        wordWrap: 'break-word',
                      }}
                    >
                      {alert.title}
                    </h3>
                    <p
                      style={{
                        fontSize: '12px',
                        color: 'var(--foreground-muted)',
                        margin: '0 0 6px 0',
                        lineHeight: '1.4',
                        textAlign: 'right',
                        wordWrap: 'break-word',
                      }}
                    >
                      {alert.description}
                    </p>

                    {/* Link label if exists */}
                    {alert.linkHref && (
                      <div
                        style={{
                          fontSize: '11px',
                          fontWeight: '500',
                          color: 'var(--accent)',
                          cursor: 'pointer',
                          opacity: 0.8,
                        }}
                      >
                        צפה ↗
                      </div>
                    )}
                  </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Footer */}
          <div
            style={{
              padding: '12px 16px',
              borderTop: '1px solid var(--border)',
              display: 'flex',
              justifyContent: 'center',
            }}
          >
            <Link
              href="/exec-dashboard"
              onClick={() => setIsOpen(false)}
              style={{
                fontSize: '13px',
                fontWeight: '600',
                color: 'var(--accent)',
                textDecoration: 'none',
                transition: 'opacity 150ms ease-out',
                cursor: 'pointer',
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLAnchorElement).style.opacity = '0.8';
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLAnchorElement).style.opacity = '1';
              }}
            >
              צפה בכל ההתראות
            </Link>
          </div>
        </div>
      )}

      {/* Animations */}
      <style>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(-4px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes pulse {
          0%, 100% {
            opacity: 1;
          }
          50% {
            opacity: 0.7;
          }
        }

        /* Scrollbar styling */
        div[style*="maxHeight"] {
          scrollbar-color: var(--border) transparent;
          scrollbar-width: thin;
        }

        div[style*="maxHeight"]::-webkit-scrollbar {
          width: 6px;
        }

        div[style*="maxHeight"]::-webkit-scrollbar-track {
          background: transparent;
        }

        div[style*="maxHeight"]::-webkit-scrollbar-thumb {
          background-color: var(--border);
          border-radius: 3px;
        }

        div[style*="maxHeight"]::-webkit-scrollbar-thumb:hover {
          background-color: var(--foreground-muted);
        }
      `}</style>
    </div>
  );
}
