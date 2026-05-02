'use client';
export const dynamic = "force-dynamic";

import { useState, useMemo, useCallback } from 'react';
import { useApprovalQueue } from '@/lib/api/use-entity';
import type { ApprovalQueueItem } from '@/lib/db/schema';

type FilterType = 'all' | 'pending' | 'approved' | 'rejected';

const ENTITY_ICONS: Record<string, string> = {
  lead: '👤', message: '💬', task: '📝', campaign: '📊', client: '🏢', payment: '💰',
  automation: '⚡', system: '🔧', approval: '📋',
};

const ACTION_LABELS: Record<string, string> = {
  create_task: 'יצירת משימה',
  assign_employee: 'הקצאת נציג',
  send_email: 'שליחת אימייל',
  send_whatsapp: 'שליחת WhatsApp',
  create_notification: 'יצירת התראה',
  push_to_approval_center: 'שליחה למרכז אישורים',
  update_status: 'עדכון סטטוס',
  generate_pdf: 'הפקת PDF',
  add_to_calendar: 'הוספה ליומן',
};

function formatTimeAgo(dateStr: string): string {
  const date = new Date(dateStr);
  const hours = Math.floor((Date.now() - date.getTime()) / (60 * 60 * 1000));
  if (hours < 1) return 'לפני דקות';
  if (hours === 1) return 'לפני שעה';
  if (hours < 24) return `לפני ${hours} שעות`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'אתמול';
  return `לפני ${days} ימים`;
}

const FILTER_LABELS: Record<FilterType, string> = {
  all: 'הכל', pending: 'ממתין', approved: 'מאושר', rejected: 'נדחה',
};

// Default mock data — used when no real approval queue items exist
const DEFAULT_APPROVALS: Partial<ApprovalQueueItem>[] = [
  {
    id: 'demo-app-1', automationRunId: 'run-1', ruleId: 'rule-1', ruleName: 'הקצאה אוטומטית של לידים',
    action: 'assign_employee', eventType: 'lead_created',
    eventPayload: { leadName: 'דוד כהן', company: 'ABC בע"מ' },
    clientId: null, clientName: '', entityType: 'lead', entityId: 'lead-001',
    aiRecommendation: 'auto_execute', aiConfidence: 87,
    status: 'pending', decidedBy: null, decidedAt: null, decisionNotes: null,
    createdAt: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'demo-app-2', automationRunId: 'run-2', ruleId: 'rule-2', ruleName: 'הודעות WhatsApp אוטומטיות',
    action: 'send_whatsapp', eventType: 'lead_no_response_timeout',
    eventPayload: { leadName: 'שרה לוי', hours: 48 },
    clientId: null, clientName: '', entityType: 'lead', entityId: 'lead-002',
    aiRecommendation: 'review_recommended', aiConfidence: 65,
    status: 'pending', decidedBy: null, decidedAt: null, decisionNotes: null,
    createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'demo-app-3', automationRunId: 'run-3', ruleId: 'rule-3', ruleName: 'יצירת משימות אוטומטיות',
    action: 'create_task', eventType: 'task_completed',
    eventPayload: { taskName: 'בדיקת איכות', projectName: 'פרויקט פיתוח' },
    clientId: null, clientName: 'סטודיו יצירה', entityType: 'task', entityId: 'task-001',
    aiRecommendation: 'auto_execute', aiConfidence: 92,
    status: 'pending', decidedBy: null, decidedAt: null, decisionNotes: null,
    createdAt: new Date(Date.now() - 28 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

export default function ApprovalsPage() {
  const { data: realApprovals, loading, refetch } = useApprovalQueue();
  const [localOverrides, setLocalOverrides] = useState<Record<string, { status: string; animating?: boolean }>>({});
  const [filter, setFilter] = useState<FilterType>('pending');
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Use real data if available, otherwise fall back to defaults
  const approvals: ApprovalQueueItem[] = useMemo(() => {
    const items = (realApprovals && realApprovals.length > 0)
      ? realApprovals
      : DEFAULT_APPROVALS as ApprovalQueueItem[];
    // Apply local overrides
    return items.map(item => {
      const override = localOverrides[item.id];
      if (override) {
        return { ...item, status: override.status as any };
      }
      return item;
    });
  }, [realApprovals, localOverrides]);

  const isDemo = !realApprovals || realApprovals.length === 0;

  const stats = useMemo(() => {
    const pending = approvals.filter(a => a.status === 'pending').length;
    const approved = approvals.filter(a => a.status === 'approved').length;
    const rejected = approvals.filter(a => a.status === 'rejected').length;
    return { pending, approved, rejected };
  }, [approvals]);

  const filtered = useMemo(() => {
    if (filter === 'all') return approvals;
    return approvals.filter(a => a.status === filter);
  }, [approvals, filter]);

  const handleApprove = useCallback(async (item: ApprovalQueueItem) => {
    setActionLoading(item.id);

    if (isDemo) {
      // Demo mode — just animate locally
      setLocalOverrides(prev => ({ ...prev, [item.id]: { status: 'approved' } }));
      setActionLoading(null);
      return;
    }

    try {
      const res = await fetch(`/api/data/approval-queue/${item.id}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'approve', decidedBy: 'admin' }),
      });
      if (res.ok) {
        setLocalOverrides(prev => ({ ...prev, [item.id]: { status: 'approved' } }));
        refetch();
      }
    } catch (e) {
      console.error('Approve failed:', e);
    } finally {
      setActionLoading(null);
    }
  }, [isDemo, refetch]);

  const handleReject = useCallback(async (item: ApprovalQueueItem) => {
    setActionLoading(item.id);

    if (isDemo) {
      setLocalOverrides(prev => ({ ...prev, [item.id]: { status: 'rejected' } }));
      setActionLoading(null);
      return;
    }

    try {
      const res = await fetch(`/api/data/approval-queue/${item.id}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reject', decidedBy: 'admin' }),
      });
      if (res.ok) {
        setLocalOverrides(prev => ({ ...prev, [item.id]: { status: 'rejected' } }));
        refetch();
      }
    } catch (e) {
      console.error('Reject failed:', e);
    } finally {
      setActionLoading(null);
    }
  }, [isDemo, refetch]);

  const hasNoPending = stats.pending === 0 && filter === 'pending';

  return (
    <div dir="rtl" style={{ padding: '2rem', minHeight: '100vh', background: 'var(--background)' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2rem' }}>
        <div>
          <h1 style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--foreground)', margin: 0 }}>
            מרכז אישורים
          </h1>
          <p style={{ color: 'var(--foreground-muted)', marginTop: '0.5rem', fontSize: '0.95rem' }}>
            אישור או דחייה של פעולות אוטומטיות
            {isDemo && (
              <span style={{ marginRight: '0.5rem', fontSize: '0.8rem', color: 'var(--accent)', fontWeight: 500 }}>
                (נתוני דמו)
              </span>
            )}
          </p>
        </div>
        {stats.pending > 0 && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: '0.5rem',
            background: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b',
            padding: '0.5rem 1rem', borderRadius: '2rem', fontSize: '0.875rem', fontWeight: 600,
          }}>
            <span>&#9888;</span>
            <span>{stats.pending} ממתינים</span>
          </div>
        )}
      </div>

      {/* Stats Bar */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', marginBottom: '1.5rem',
      }}>
        {[
          { label: 'ממתין', value: stats.pending, color: '#f59e0b', icon: '&#9201;' },
          { label: 'אושרו', value: stats.approved, color: '#22c55e', icon: '&#10004;' },
          { label: 'נדחו', value: stats.rejected, color: '#ef4444', icon: '&#10006;' },
        ].map((s) => (
          <div key={s.label} className="premium-card" style={{ padding: '1rem 1.25rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <span style={{ fontSize: '1.25rem', color: s.color }} dangerouslySetInnerHTML={{ __html: s.icon }} />
            <div>
              <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--foreground)' }}>{s.value}</div>
              <div style={{ fontSize: '0.8rem', color: 'var(--foreground-muted)' }}>{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Filter Tabs */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem' }}>
        {(Object.keys(FILTER_LABELS) as FilterType[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setFilter(tab)}
            style={{
              padding: '0.5rem 1.25rem', borderRadius: '0.5rem', fontSize: '0.875rem', fontWeight: 500,
              border: '1px solid var(--border)', cursor: 'pointer',
              background: filter === tab ? 'var(--accent)' : 'var(--surface)',
              color: filter === tab ? '#fff' : 'var(--foreground)',
              transition: 'all 200ms ease',
            }}
          >
            {FILTER_LABELS[tab]}
          </button>
        ))}
      </div>

      {/* Loading */}
      {loading && (
        <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--foreground-muted)' }}>
          טוען...
        </div>
      )}

      {/* Empty State */}
      {!loading && hasNoPending ? (
        <div className="premium-card" style={{
          padding: '4rem 2rem', textAlign: 'center', display: 'flex', flexDirection: 'column',
          alignItems: 'center', gap: '1rem',
        }}>
          <div style={{ fontSize: '3rem', opacity: 0.5 }}>&#10003;</div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--foreground)', margin: 0 }}>
            אין פעולות ממתינות לאישור
          </h2>
          <p style={{ color: 'var(--foreground-muted)', fontSize: '0.9rem', margin: 0 }}>
            המערכת פועלת בצורה חלקה
          </p>
        </div>
      ) : (
        <div className="ux-stagger" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {filtered.map((item) => (
            <div
              key={item.id}
              className="auto-approval-card"
              style={{
                borderLeftColor: (item.aiConfidence ?? 0) >= 80 ? '#22c55e' : '#f59e0b',
              }}
            >
              {/* Card Header */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <span style={{ fontSize: '1.5rem' }}>{ENTITY_ICONS[item.entityType] || '⚡'}</span>
                  <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--foreground)', margin: 0 }}>
                    {item.ruleName}
                  </h3>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  {item.aiConfidence != null && (
                    <span style={{
                      fontSize: '0.7rem', fontWeight: 600, padding: '0.2rem 0.6rem', borderRadius: '1rem',
                      background: item.aiConfidence >= 80 ? 'rgba(34, 197, 94, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                      color: item.aiConfidence >= 80 ? '#22c55e' : '#f59e0b',
                    }}>
                      AI {item.aiConfidence}%
                    </span>
                  )}
                  <span style={{
                    fontSize: '0.8rem', color: 'var(--foreground-muted)',
                    background: 'var(--surface-variant)', padding: '0.25rem 0.75rem', borderRadius: '1rem',
                  }}>
                    {formatTimeAgo(item.createdAt)}
                  </span>
                </div>
              </div>

              {/* Card Body */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', marginBottom: '1.25rem' }}>
                {[
                  { label: 'אירוע', value: item.eventType.replace(/_/g, ' ') },
                  { label: 'פעולה', value: ACTION_LABELS[item.action] || item.action },
                  ...(item.aiRecommendation ? [{ label: 'המלצת AI', value: item.aiRecommendation === 'auto_execute' ? 'ביצוע אוטומטי' : 'נדרשת בדיקה' }] : []),
                  ...(item.clientName ? [{ label: 'לקוח', value: item.clientName }] : []),
                ].map((row) => (
                  <div key={row.label} style={{ display: 'flex', gap: '0.5rem', fontSize: '0.9rem' }}>
                    <span style={{ fontWeight: 600, color: 'var(--foreground-muted)', minWidth: '5.5rem', flexShrink: 0 }}>
                      {row.label}:
                    </span>
                    <span style={{ color: 'var(--foreground)' }}>{row.value}</span>
                  </div>
                ))}
              </div>

              {/* Footer */}
              {item.status === 'pending' ? (
                <div style={{ display: 'flex', gap: '0.75rem', borderTop: '1px solid var(--border)', paddingTop: '1rem' }}>
                  <button
                    onClick={() => handleApprove(item)}
                    disabled={actionLoading === item.id}
                    style={{
                      flex: 1, padding: '0.6rem 1rem', borderRadius: '0.5rem', border: 'none', cursor: 'pointer',
                      background: '#22c55e', color: '#fff', fontWeight: 600, fontSize: '0.875rem',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem',
                      transition: 'opacity 200ms',
                      opacity: actionLoading === item.id ? 0.6 : 1,
                    }}
                  >
                    {actionLoading === item.id ? '...' : '✓ אשר'}
                  </button>
                  <button
                    onClick={() => handleReject(item)}
                    disabled={actionLoading === item.id}
                    style={{
                      flex: 1, padding: '0.6rem 1rem', borderRadius: '0.5rem', border: 'none', cursor: 'pointer',
                      background: '#ef4444', color: '#fff', fontWeight: 600, fontSize: '0.875rem',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem',
                      transition: 'opacity 200ms',
                      opacity: actionLoading === item.id ? 0.6 : 1,
                    }}
                  >
                    {actionLoading === item.id ? '...' : '✕ דחה'}
                  </button>
                </div>
              ) : (
                <div style={{
                  borderTop: '1px solid var(--border)', paddingTop: '0.75rem', textAlign: 'center',
                }}>
                  <span style={{
                    padding: '0.3rem 1rem', borderRadius: '1rem', fontSize: '0.8rem', fontWeight: 600,
                    background: item.status === 'approved' ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                    color: item.status === 'approved' ? '#22c55e' : '#ef4444',
                  }}>
                    {item.status === 'approved' ? '✓ מאושר' : '✕ נדחה'}
                  </span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
