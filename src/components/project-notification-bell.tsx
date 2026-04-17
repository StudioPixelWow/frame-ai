'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useProjectNotifications } from '@/lib/api/use-entity';
import type { ProjectNotification } from '@/lib/db/schema';

const SEVERITY_STYLES: Record<string, { icon: string; bg: string; color: string; border: string }> = {
  critical: { icon: '🔴', bg: 'rgba(239,68,68,0.1)', color: '#f87171', border: 'rgba(239,68,68,0.25)' },
  warning:  { icon: '🟡', bg: 'rgba(245,158,11,0.1)', color: '#fbbf24', border: 'rgba(245,158,11,0.25)' },
  info:     { icon: '🔵', bg: 'rgba(59,130,246,0.08)', color: '#60a5fa', border: 'rgba(59,130,246,0.2)' },
};

const TYPE_LABELS: Record<string, string> = {
  milestone_overdue: 'איחור באבן דרך',
  no_assignee: 'חוסר שיוך',
  inactivity: 'חוסר פעילות',
  payment_overdue: 'איחור בתשלום',
  status_change: 'שינוי סטטוס',
};

interface Props {
  /** Optional: filter notifications to a specific project */
  projectId?: string;
}

export function ProjectNotificationBell({ projectId }: Props) {
  const router = useRouter();
  const { data: allNotifications, update: updateNotification, refetch } = useProjectNotifications();
  const [isOpen, setIsOpen] = useState(false);
  const [generatingLoading, setGeneratingLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Filter by project if needed
  const notifications = projectId
    ? allNotifications.filter((n: ProjectNotification) => n.projectId === projectId)
    : allNotifications;

  // Sort: unread first, then by createdAt desc
  const sorted = [...notifications].sort((a, b) => {
    if (a.isRead !== b.isRead) return a.isRead ? 1 : -1;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  const unreadCount = notifications.filter((n: ProjectNotification) => !n.isRead).length;
  const criticalUnread = notifications.filter((n: ProjectNotification) => !n.isRead && n.severity === 'critical').length;

  // Close dropdown on outside click
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

  // Auto-generate notifications on mount (fire and forget)
  const hasGenerated = useRef(false);
  useEffect(() => {
    if (hasGenerated.current) return;
    hasGenerated.current = true;
    fetch('/api/data/project-notifications/generate', { method: 'POST' })
      .then(() => refetch())
      .catch(() => {});
  }, [refetch]);

  const handleGenerate = useCallback(async () => {
    setGeneratingLoading(true);
    try {
      await fetch('/api/data/project-notifications/generate', { method: 'POST' });
      await refetch();
    } catch { /* ignore */ }
    setGeneratingLoading(false);
  }, [refetch]);

  const handleMarkRead = useCallback(async (notification: ProjectNotification) => {
    if (!notification.isRead) {
      await updateNotification(notification.id, { isRead: true } as any);
    }
    setIsOpen(false);
    if (notification.linkHref) {
      router.push(notification.linkHref);
    }
  }, [updateNotification, router]);

  const handleMarkAllRead = useCallback(async () => {
    const unread = notifications.filter((n: ProjectNotification) => !n.isRead);
    for (const n of unread) {
      await updateNotification(n.id, { isRead: true } as any);
    }
    await refetch();
  }, [notifications, updateNotification, refetch]);

  const badgeColor = criticalUnread > 0 ? '#ef4444' : unreadCount > 0 ? '#f59e0b' : '#6366f1';

  const formatTimeAgo = (dateStr: string) => {
    try {
      const diff = Date.now() - new Date(dateStr).getTime();
      const mins = Math.floor(diff / 60000);
      if (mins < 1) return 'עכשיו';
      if (mins < 60) return `לפני ${mins} דק׳`;
      const hrs = Math.floor(mins / 60);
      if (hrs < 24) return `לפני ${hrs} שע׳`;
      const days = Math.floor(hrs / 24);
      return `לפני ${days} ימים`;
    } catch {
      return '';
    }
  };

  return (
    <div style={{ position: 'relative', direction: 'rtl' }}>
      <style>{`
        @keyframes pno-fade-in {
          from { opacity: 0; transform: translateY(-6px) scale(0.97); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes pno-badge-pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.15); }
        }
        @keyframes pno-item-in {
          from { opacity: 0; transform: translateX(8px); }
          to { opacity: 1; transform: translateX(0); }
        }
        .pno-item {
          transition: background 0.2s ease, border-color 0.2s ease;
        }
        .pno-item:hover {
          background: rgba(99,102,241,0.06) !important;
        }
      `}</style>

      {/* Bell Button */}
      <button
        ref={buttonRef}
        onClick={() => setIsOpen(!isOpen)}
        title="התראות פרויקט"
        style={{
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '38px',
          height: '38px',
          borderRadius: '10px',
          border: '1px solid rgba(255,255,255,0.08)',
          backgroundColor: isOpen ? 'rgba(99,102,241,0.1)' : 'rgba(255,255,255,0.04)',
          color: isOpen ? '#818cf8' : '#94a3b8',
          cursor: 'pointer',
          transition: 'all 0.2s ease',
        }}
        onMouseEnter={(e) => {
          if (!isOpen) {
            e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.08)';
            e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)';
          }
        }}
        onMouseLeave={(e) => {
          if (!isOpen) {
            e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.04)';
            e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)';
          }
        }}
      >
        <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0018 9.75V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
        </svg>

        {/* Badge */}
        {unreadCount > 0 && (
          <div style={{
            position: 'absolute',
            top: '-4px',
            left: '-4px',
            minWidth: '18px',
            height: '18px',
            borderRadius: '9px',
            backgroundColor: badgeColor,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '10px',
            fontWeight: '700',
            color: '#fff',
            padding: '0 4px',
            boxShadow: `0 0 0 2px #1a1a2e`,
            animation: criticalUnread > 0 ? 'pno-badge-pulse 2s ease-in-out infinite' : 'none',
          }}>
            {unreadCount > 99 ? '99+' : unreadCount}
          </div>
        )}
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div
          ref={dropdownRef}
          style={{
            position: 'absolute',
            top: 'calc(100% + 8px)',
            right: 0,
            width: '380px',
            maxHeight: '520px',
            backgroundColor: '#1a1a2e',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '14px',
            boxShadow: '0 20px 40px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.03)',
            zIndex: 100,
            animation: 'pno-fade-in 0.2s cubic-bezier(0.4,0,0.2,1)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          {/* Header */}
          <div style={{
            padding: '14px 18px',
            borderBottom: '1px solid rgba(255,255,255,0.06)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h3 style={{ fontSize: '14px', fontWeight: '700', color: '#e2e8f0', margin: 0 }}>
                התראות פרויקט
              </h3>
              {unreadCount > 0 && (
                <span style={{
                  fontSize: '11px',
                  fontWeight: '600',
                  padding: '2px 8px',
                  borderRadius: '10px',
                  background: 'rgba(99,102,241,0.12)',
                  color: '#818cf8',
                }}>
                  {unreadCount} חדשות
                </span>
              )}
            </div>
            <div style={{ display: 'flex', gap: '6px' }}>
              {unreadCount > 0 && (
                <button
                  onClick={handleMarkAllRead}
                  style={{
                    fontSize: '11px',
                    color: '#818cf8',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    fontWeight: '600',
                    padding: '4px 8px',
                    borderRadius: '6px',
                    transition: 'background 0.15s',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(99,102,241,0.1)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'none'; }}
                >
                  סמן הכל כנקרא
                </button>
              )}
              <button
                onClick={handleGenerate}
                disabled={generatingLoading}
                style={{
                  fontSize: '11px',
                  color: '#64748b',
                  background: 'none',
                  border: 'none',
                  cursor: generatingLoading ? 'wait' : 'pointer',
                  fontWeight: '500',
                  padding: '4px 8px',
                  borderRadius: '6px',
                  transition: 'background 0.15s',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'none'; }}
                title="רענן התראות"
              >
                {generatingLoading ? '...' : '↻'}
              </button>
            </div>
          </div>

          {/* Notification List */}
          <div style={{
            flex: 1,
            overflowY: 'auto',
            maxHeight: '420px',
          }}>
            {sorted.length === 0 ? (
              <div style={{
                padding: '40px 20px',
                textAlign: 'center',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '10px',
              }}>
                <div style={{ fontSize: '28px', opacity: 0.4 }}>✓</div>
                <div style={{ color: '#64748b', fontSize: '13px' }}>
                  אין התראות פעילות
                </div>
              </div>
            ) : (
              sorted.map((notification, idx) => {
                const sev = SEVERITY_STYLES[notification.severity] || SEVERITY_STYLES.info;
                const isUnread = !notification.isRead;

                return (
                  <div
                    key={notification.id}
                    className="pno-item"
                    onClick={() => handleMarkRead(notification)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') handleMarkRead(notification);
                    }}
                    style={{
                      padding: '12px 18px',
                      borderBottom: '1px solid rgba(255,255,255,0.04)',
                      display: 'flex',
                      gap: '12px',
                      alignItems: 'flex-start',
                      cursor: 'pointer',
                      background: isUnread ? 'rgba(99,102,241,0.04)' : 'transparent',
                      borderRight: isUnread ? `3px solid ${sev.color}` : '3px solid transparent',
                      animation: `pno-item-in 0.25s cubic-bezier(0.4,0,0.2,1) ${idx * 0.03}s both`,
                    }}
                  >
                    {/* Severity dot */}
                    <div style={{
                      width: '8px',
                      height: '8px',
                      borderRadius: '50%',
                      background: sev.color,
                      flexShrink: 0,
                      marginTop: '6px',
                      opacity: isUnread ? 1 : 0.4,
                      transition: 'opacity 0.3s',
                    }} />

                    {/* Content */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginBottom: '4px',
                      }}>
                        <span style={{
                          fontSize: '10px',
                          fontWeight: '600',
                          padding: '2px 8px',
                          borderRadius: '6px',
                          background: sev.bg,
                          color: sev.color,
                          border: `1px solid ${sev.border}`,
                          letterSpacing: '0.2px',
                        }}>
                          {TYPE_LABELS[notification.type] || notification.type}
                        </span>
                        <span style={{
                          fontSize: '10px',
                          color: '#475569',
                          flexShrink: 0,
                          marginRight: '8px',
                        }}>
                          {formatTimeAgo(notification.createdAt)}
                        </span>
                      </div>
                      <p style={{
                        fontSize: '12.5px',
                        color: isUnread ? '#e2e8f0' : '#94a3b8',
                        margin: '0',
                        lineHeight: '1.5',
                        fontWeight: isUnread ? '500' : '400',
                        transition: 'color 0.3s',
                      }}>
                        {notification.message}
                      </p>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Footer */}
          {sorted.length > 0 && (
            <div style={{
              padding: '10px 18px',
              borderTop: '1px solid rgba(255,255,255,0.06)',
              textAlign: 'center',
            }}>
              <span style={{
                fontSize: '11px',
                color: '#475569',
              }}>
                {sorted.length} התראות סה״כ
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
