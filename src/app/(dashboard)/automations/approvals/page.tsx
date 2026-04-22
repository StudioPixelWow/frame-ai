'use client';
export const dynamic = "force-dynamic";

import { useState, useMemo } from 'react';

type ApprovalStatus = 'pending' | 'approved' | 'rejected';
type FilterType = 'all' | 'pending' | 'approved' | 'rejected';
type Urgency = 'normal' | 'urgent';
type EntityType = 'lead' | 'message' | 'task' | 'campaign' | 'client' | 'payment';

interface ApprovalItem {
  id: string;
  automationName: string;
  automationId: string;
  triggerEvent: string;
  proposedAction: string;
  reason: string;
  entityType: EntityType;
  entityName: string;
  entityId: string;
  status: ApprovalStatus;
  urgency: Urgency;
  createdAt: Date;
  approvedBy?: string;
  approvedAt?: Date;
  isAnimatingOut?: boolean;
}

const ENTITY_ICONS: Record<EntityType, string> = {
  lead: '👤', message: '💬', task: '📝', campaign: '📊', client: '🏢', payment: '💰',
};

const MOCK_APPROVALS: ApprovalItem[] = [
  {
    id: 'app-1',
    automationName: 'הקצאה אוטומטית של לידים',
    automationId: 'auto-lead-assign',
    triggerEvent: 'ליד חדש — דוד כהן מחברת ABC',
    proposedAction: 'שייך לאיש מכירות נועם בוברין',
    reason: 'ציון ליד גבוה (87), מתאים לפרופיל העובד',
    entityType: 'lead',
    entityName: 'דוד כהן',
    entityId: 'lead-001',
    status: 'pending',
    urgency: 'normal',
    createdAt: new Date(Date.now() - 3 * 60 * 60 * 1000),
  },
  {
    id: 'app-2',
    automationName: 'הודעות WhatsApp אוטומטיות',
    automationId: 'auto-whatsapp',
    triggerEvent: 'ליד לא הגיב למשך 48 שעות',
    proposedAction: 'שלח הודעת עקיבה דרך WhatsApp',
    reason: 'פרוטוקול עקיבה סטנדרטי — זמן הגיע להתקשר',
    entityType: 'message',
    entityName: 'שרה לוי',
    entityId: 'lead-002',
    status: 'pending',
    urgency: 'normal',
    createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
  },
  {
    id: 'app-3',
    automationName: 'יצירת משימות אוטומטיות',
    automationId: 'auto-task-create',
    triggerEvent: 'משימה קודמת הסתיימה — נדרשת בדיקת איכות',
    proposedAction: 'צור משימה חדשה לאימות הנתונים',
    reason: 'בדיקת איכות מומלצת — משימה קודמת הושלמה מהר',
    entityType: 'task',
    entityName: 'פרויקט פיתוח',
    entityId: 'task-001',
    status: 'pending',
    urgency: 'urgent',
    createdAt: new Date(Date.now() - 28 * 60 * 60 * 1000),
  },
  {
    id: 'app-4',
    automationName: 'התראות ביצועים',
    automationId: 'auto-performance-alert',
    triggerEvent: 'ביצועי קמפיין ירדו ב-25%',
    proposedAction: 'שלח התראה למנהל הקמפיין',
    reason: 'ירידה משמעותית בקליקים והמרות',
    entityType: 'campaign',
    entityName: 'קמפיין אביב 2026',
    entityId: 'camp-001',
    status: 'pending',
    urgency: 'urgent',
    createdAt: new Date(Date.now() - 26 * 60 * 60 * 1000),
  },
  {
    id: 'app-5',
    automationName: 'גאנט חודשי אוטומטי',
    automationId: 'auto-gantt-monthly',
    triggerEvent: 'תאריך יום ה-1 בחודש חדש',
    proposedAction: 'שלח דוח גאנט חודשי ללקוח',
    reason: 'דוח שגרתי חודשי — נדרש אישור לפני שליחה',
    entityType: 'client',
    entityName: 'סטודיו יצירה בע״מ',
    entityId: 'client-001',
    status: 'pending',
    urgency: 'normal',
    createdAt: new Date(Date.now() - 6 * 60 * 60 * 1000),
  },
  {
    id: 'app-6',
    automationName: 'התראת תשלום חריג',
    automationId: 'auto-payment-alert',
    triggerEvent: 'חשבונית שלא שולמה לאחר 45 יום',
    proposedAction: 'שלח התראה לחשבונאי וצור משימת מעקב',
    reason: 'תשלום באיחור משמעותי — נדרש מעקב',
    entityType: 'payment',
    entityName: 'חשבונית #2452',
    entityId: 'inv-2452',
    status: 'pending',
    urgency: 'urgent',
    createdAt: new Date(Date.now() - 36 * 60 * 60 * 1000),
  },
];

function formatTimeAgo(date: Date): string {
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

export default function ApprovalsPage() {
  const [approvals, setApprovals] = useState<ApprovalItem[]>(MOCK_APPROVALS);
  const [filter, setFilter] = useState<FilterType>('pending');

  const stats = useMemo(() => {
    const pending = approvals.filter(a => a.status === 'pending').length;
    const approved = approvals.filter(a => a.status === 'approved' &&
      a.approvedAt && new Date(a.approvedAt).toDateString() === new Date().toDateString()).length;
    const rejected = approvals.filter(a => a.status === 'rejected').length;
    return { pending, approved, rejected };
  }, [approvals]);

  const filtered = useMemo(() => {
    if (filter === 'all') return approvals;
    return approvals.filter(a => a.status === filter);
  }, [approvals, filter]);

  const handleApprove = (id: string) => {
    setApprovals(prev => prev.map(a =>
      a.id === id ? { ...a, isAnimatingOut: true } : a
    ));
    setTimeout(() => {
      setApprovals(prev => prev.map(a =>
        a.id === id ? { ...a, status: 'approved' as const, approvedAt: new Date(), isAnimatingOut: false } : a
      ));
    }, 300);
  };

  const handleReject = (id: string) => {
    setApprovals(prev => prev.map(a =>
      a.id === id ? { ...a, isAnimatingOut: true } : a
    ));
    setTimeout(() => {
      setApprovals(prev => prev.map(a =>
        a.id === id ? { ...a, status: 'rejected' as const, isAnimatingOut: false } : a
      ));
    }, 300);
  };

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
          { label: 'אושרו היום', value: stats.approved, color: '#22c55e', icon: '&#10004;' },
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

      {/* Empty State */}
      {hasNoPending ? (
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
          {filtered.map((approval) => (
            <div
              key={approval.id}
              className="auto-approval-card"
              style={{
                opacity: approval.isAnimatingOut ? 0 : 1,
                transform: approval.isAnimatingOut ? 'translateY(-10px)' : 'translateY(0)',
                transition: 'opacity 300ms ease, transform 300ms ease',
                borderLeftColor: approval.urgency === 'urgent' ? '#ef4444' : '#f59e0b',
              }}
            >
              {/* Card Header */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <span style={{ fontSize: '1.5rem' }}>{ENTITY_ICONS[approval.entityType]}</span>
                  <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--foreground)', margin: 0 }}>
                    {approval.automationName}
                  </h3>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  {approval.urgency === 'urgent' && (
                    <span style={{
                      fontSize: '0.7rem', fontWeight: 600, padding: '0.2rem 0.6rem', borderRadius: '1rem',
                      background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444',
                    }}>
                      דחוף
                    </span>
                  )}
                  <span style={{
                    fontSize: '0.8rem', color: 'var(--foreground-muted)',
                    background: 'var(--surface-variant)', padding: '0.25rem 0.75rem', borderRadius: '1rem',
                  }}>
                    {formatTimeAgo(approval.createdAt)}
                  </span>
                </div>
              </div>

              {/* Card Body */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', marginBottom: '1.25rem' }}>
                {[
                  { label: 'טריגר', value: approval.triggerEvent },
                  { label: 'פעולה מוצעת', value: approval.proposedAction },
                  { label: 'סיבה', value: approval.reason },
                ].map((row) => (
                  <div key={row.label} style={{ display: 'flex', gap: '0.5rem', fontSize: '0.9rem' }}>
                    <span style={{ fontWeight: 600, color: 'var(--foreground-muted)', minWidth: '5.5rem', flexShrink: 0 }}>
                      {row.label}:
                    </span>
                    <span style={{ color: 'var(--foreground)' }}>{row.value}</span>
                  </div>
                ))}
                <div style={{ display: 'flex', gap: '0.5rem', fontSize: '0.9rem' }}>
                  <span style={{ fontWeight: 600, color: 'var(--foreground-muted)', minWidth: '5.5rem', flexShrink: 0 }}>ישות:</span>
                  <span style={{ color: 'var(--accent)', fontWeight: 500 }}>{approval.entityName}</span>
                </div>
              </div>

              {/* Footer */}
              {approval.status === 'pending' ? (
                <div style={{ display: 'flex', gap: '0.75rem', borderTop: '1px solid var(--border)', paddingTop: '1rem' }}>
                  <button
                    onClick={() => handleApprove(approval.id)}
                    style={{
                      flex: 1, padding: '0.6rem 1rem', borderRadius: '0.5rem', border: 'none', cursor: 'pointer',
                      background: '#22c55e', color: '#fff', fontWeight: 600, fontSize: '0.875rem',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem',
                      transition: 'opacity 200ms',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.opacity = '0.9')}
                    onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
                  >
                    &#10003; אשר
                  </button>
                  <button
                    onClick={() => handleReject(approval.id)}
                    style={{
                      flex: 1, padding: '0.6rem 1rem', borderRadius: '0.5rem', border: 'none', cursor: 'pointer',
                      background: '#ef4444', color: '#fff', fontWeight: 600, fontSize: '0.875rem',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem',
                      transition: 'opacity 200ms',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.opacity = '0.9')}
                    onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
                  >
                    &#10006; דחה
                  </button>
                  <button
                    style={{
                      padding: '0.6rem 1.25rem', borderRadius: '0.5rem', cursor: 'pointer',
                      background: 'var(--surface-variant)', color: 'var(--foreground)',
                      border: '1px solid var(--border)', fontWeight: 500, fontSize: '0.875rem',
                      transition: 'background 200ms',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--border)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'var(--surface-variant)')}
                  >
                    ערוך
                  </button>
                </div>
              ) : (
                <div style={{
                  borderTop: '1px solid var(--border)', paddingTop: '0.75rem', textAlign: 'center',
                }}>
                  <span style={{
                    padding: '0.3rem 1rem', borderRadius: '1rem', fontSize: '0.8rem', fontWeight: 600,
                    background: approval.status === 'approved' ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                    color: approval.status === 'approved' ? '#22c55e' : '#ef4444',
                  }}>
                    {approval.status === 'approved' ? '&#10003; מאושר' : '&#10006; נדחה'}
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
