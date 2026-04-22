'use client';
export const dynamic = "force-dynamic";

import { useState, useMemo } from 'react';
import { CheckCircle2, Clock, AlertCircle, TrendingDown, MessageSquare, CheckSquare, AlertTriangle, Send } from 'lucide-react';
import styles from './approvals.module.css';

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
    reason: 'פרוטוקול עקיבה סטנדרטי - זמן הגיע להתקשר',
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
    triggerEvent: 'משימה אחרונה הסתיימה בחצי זמן',
    proposedAction: 'צור משימה חדשה לאימות הנתונים',
    reason: 'בדיקת איכות מומלצת - משימה קודמת הוסתמה',
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
    proposedAction: 'שלח התראה לנהל הקמפיין',
    reason: 'ירידה משמעותית בקליקים וההמרות',
    entityType: 'campaign',
    entityName: 'קמפיין אביב 2026',
    entityId: 'camp-001',
    status: 'pending',
    urgency: 'urgent',
    createdAt: new Date(Date.now() - 26 * 60 * 60 * 1000),
  },
  {
    id: 'app-5',
    automationName: 'גנט חודשי אוטומטי',
    automationId: 'auto-gantt-monthly',
    triggerEvent: 'תאריך יום ה-1 בחודש חדש',
    proposedAction: 'שלח דוח גנט חודשי ללקוח',
    reason: 'דוח שגרתי חודשי - נדרש אישור משפחתי',
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
    proposedAction: 'שלח התראה לאיש החשבונות וליצור משימת כדי',
    reason: 'תשלום באיחור משמעותי - נדרש מעקב חזק',
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

export default function ApprovalsPage() {
  const [approvals, setApprovals] = useState<ApprovalItem[]>(MOCK_APPROVALS);
  const [filter, setFilter] = useState<FilterType>('pending');

  const stats = useMemo(() => {
    const all = approvals;
    const pending = all.filter(a => a.status === 'pending').length;
    const approved = all.filter(a => a.status === 'approved' &&
      a.approvedAt && new Date(a.approvedAt).toDateString() === new Date().toDateString()).length;
    const rejected = all.filter(a => a.status === 'rejected').length;
    return { pending, approved, rejected };
  }, [approvals]);

  const filtered = useMemo(() => {
    if (filter === 'all') return approvals;
    return approvals.filter(a => a.status === filter);
  }, [approvals, filter]);

  const handleApprove = (id: string) => {
    setApprovals(prev => prev.map(a =>
      a.id === id
        ? { ...a, isAnimatingOut: true }
        : a
    ));
    setTimeout(() => {
      setApprovals(prev => prev.map(a =>
        a.id === id
          ? { ...a, status: 'approved', approvedAt: new Date(), isAnimatingOut: false }
          : a
      ));
    }, 300);
  };

  const handleReject = (id: string) => {
    setApprovals(prev => prev.map(a =>
      a.id === id
        ? { ...a, isAnimatingOut: true }
        : a
    ));
    setTimeout(() => {
      setApprovals(prev => prev.map(a =>
        a.id === id
          ? { ...a, status: 'rejected', isAnimatingOut: false }
          : a
      ));
    }, 300);
  };

  const hasNoPending = stats.pending === 0 && filter === 'pending';

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>מרכז אישורים</h1>
          <p className={styles.subtitle}>אישור או דחייה של פעולות אוטומטיות</p>
        </div>
        <div className={styles.pendingBadge}>
          {stats.pending > 0 && (
            <>
              <AlertCircle size={16} />
              <span>{stats.pending}</span>
            </>
          )}
        </div>
      </div>

      {/* Stats Bar */}
      <div className={styles.statsBar}>
        <div className={styles.stat}>
          <Clock size={16} style={{ color: 'var(--accent)' }} />
          <span>ממתין</span>
          <strong>{stats.pending}</strong>
        </div>
        <div className={styles.stat}>
          <CheckCircle2 size={16} style={{ color: '#22c55e' }} />
          <span>אושרו היום</span>
          <strong>{stats.approved}</strong>
        </div>
        <div className={styles.stat}>
          <AlertTriangle size={16} style={{ color: '#ef4444' }} />
          <span>נדחו</span>
          <strong>{stats.rejected}</strong>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className={styles.filterTabs}>
        {(['all', 'pending', 'approved', 'rejected'] as const).map((tab) => {
          const labels = { all: 'הכל', pending: 'ממתין', approved: 'מאושר', rejected: 'נדחה' };
          return (
            <button
              key={tab}
              className={`${styles.tab} ${filter === tab ? styles.tabActive : ''}`}
              onClick={() => setFilter(tab)}
            >
              {labels[tab]}
            </button>
          );
        })}
      </div>

      {/* Approvals List or Empty State */}
      {hasNoPending ? (
        <div className={styles.emptyState}>
          <CheckCircle2 size={48} />
          <h2>אין פעולות ממתינות לאישור</h2>
          <p>המערכת פועלת בצורה חלקה</p>
        </div>
      ) : (
        <div className={styles.cardsList}>
          {filtered.map((approval) => (
            <div
              key={approval.id}
              className={`
                ${styles.approvalCard}
                ${approval.status === 'pending' ? styles.cardPending : ''}
                ${approval.status === 'approved' ? styles.cardApproved : ''}
                ${approval.status === 'rejected' ? styles.cardRejected : ''}
                ${approval.urgency === 'urgent' ? styles.cardUrgent : ''}
                ${approval.isAnimatingOut ? styles.cardExit : styles.cardEnter}
              `}
            >
              {/* Header */}
              <div className={styles.cardHeader}>
                <h3 className={styles.automationName}>{approval.automationName}</h3>
                <span className={styles.timeBadge}>{formatTimeAgo(approval.createdAt)}</span>
              </div>

              {/* Content */}
              <div className={styles.cardContent}>
                <div className={styles.row}>
                  <span className={styles.label}>טריגר:</span>
                  <span>{approval.triggerEvent}</span>
                </div>
                <div className={styles.row}>
                  <span className={styles.label}>פעולה מוצעת:</span>
                  <span>{approval.proposedAction}</span>
                </div>
                <div className={styles.row}>
                  <span className={styles.label}>סיבה:</span>
                  <span>{approval.reason}</span>
                </div>
                <div className={styles.row}>
                  <span className={styles.label}>ישות:</span>
                  <a href={`#entity-${approval.entityId}`} className={styles.entityLink}>
                    {approval.entityName}
                  </a>
                </div>
              </div>

              {/* Footer - Buttons (only show for pending) */}
              {approval.status === 'pending' && (
                <div className={styles.cardFooter}>
                  <button
                    className={`${styles.btn} ${styles.btnApprove}`}
                    onClick={() => handleApprove(approval.id)}
                  >
                    <CheckCircle2 size={14} />
                    אשר
                  </button>
                  <button
                    className={`${styles.btn} ${styles.btnReject}`}
                    onClick={() => handleReject(approval.id)}
                  >
                    <AlertTriangle size={14} />
                    דחה
                  </button>
                  <button className={`${styles.btn} ${styles.btnEdit}`}>
                    ערוך
                  </button>
                </div>
              )}

              {/* Status badge for non-pending */}
              {approval.status !== 'pending' && (
                <div className={`${styles.statusBadge} ${styles[`status${approval.status}`]}`}>
                  {approval.status === 'approved' ? 'מאושר' : 'נדחה'}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
