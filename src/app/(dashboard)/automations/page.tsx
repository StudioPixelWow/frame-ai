'use client';

export const dynamic = "force-dynamic";

import { useState, useMemo } from 'react';
import Link from 'next/link';
import type { AutomationRule, AutomationTrigger, AutomationAction, SystemEvent } from '@/lib/db/schema';
import { useAutomationRules, useSystemEvents } from '@/lib/api/use-entity';

type StatusFilter = 'all' | 'active' | 'paused' | 'draft';
type TypeFilter = 'all' | 'leads' | 'tasks' | 'payments' | 'campaigns' | 'content';

const TRIGGER_LABELS: Record<AutomationTrigger, string> = {
  task_created: 'משימה נוצרה',
  task_status_changed: 'סטטוס משימה השתנה',
  file_uploaded_to_task: 'קובץ הועלה',
  gantt_created: 'גאנט נוצר',
  gantt_approved: 'גאנט אושר',
  gantt_sent_to_client: 'גאנט נשלח',
  payment_due: 'תשלום מתקרב',
  payment_overdue: 'תשלום באיחור',
  lead_status_changed: 'סטטוס ליד',
  proposal_sent: 'הצעה נשלחה',
  project_created: 'פרויקט נוצר',
  project_status_changed: 'סטטוס פרויקט',
  podcast_session_booked: 'פודקאסט נקבע',
  podcast_session_completed: 'פודקאסט הושלם',
  client_missing_monthly_gantt: 'חסר גאנט חודשי',
  client_less_than_2_weekly_posts: 'פחות מ-2 פוסטים',
  weekly_client_email_day: 'יום מיילים',
  employee_task_due_today: 'משימת עובד היום',
};

const ACTION_LABELS: Record<AutomationAction, string> = {
  send_email: 'שלח מייל',
  send_whatsapp: 'שלח וואטסאפ',
  create_task: 'צור משימה',
  update_status: 'עדכן סטטוס',
  create_notification: 'צור התראה',
  assign_employee: 'שייך עובד',
  generate_pdf: 'הפק PDF',
  add_to_calendar: 'הוסף ליומן',
  push_to_approval_center: 'שלח לאישור',
};

const TRIGGER_TO_TYPE: Record<AutomationTrigger, TypeFilter> = {
  task_created: 'tasks',
  task_status_changed: 'tasks',
  file_uploaded_to_task: 'tasks',
  gantt_created: 'content',
  gantt_approved: 'content',
  gantt_sent_to_client: 'content',
  payment_due: 'payments',
  payment_overdue: 'payments',
  lead_status_changed: 'leads',
  proposal_sent: 'leads',
  project_created: 'tasks',
  project_status_changed: 'tasks',
  podcast_session_booked: 'campaigns',
  podcast_session_completed: 'campaigns',
  client_missing_monthly_gantt: 'content',
  client_less_than_2_weekly_posts: 'content',
  weekly_client_email_day: 'tasks',
  employee_task_due_today: 'tasks',
};

const TYPE_LABELS: Record<TypeFilter, string> = {
  all: 'הכל',
  leads: 'לידים',
  tasks: 'משימות',
  payments: 'תשלומים',
  campaigns: 'קמפיינים',
  content: 'תוכן',
};

const APPROVAL_MODES = {
  auto_safe: { label: 'אוטומטי', color: '#10b981' },
  requires_approval: { label: 'דורש אישור', color: '#f59e0b' },
  recommendation_only: { label: 'המלצה בלבד', color: '#3b82f6' },
};

const DEFAULT_AUTOMATIONS: AutomationRule[] = [
  {
    id: '1',
    name: 'שלח מייל כשקובץ הועלה',
    description: 'שלח מייל ללקוח כאשר קובץ חדש הועלה למשימה',
    trigger: 'file_uploaded_to_task',
    action: 'send_email',
    isActive: true,
    targetEmail: 'client@example.com',
    targetWhatsApp: '',
    templateId: null,
    conditions: '',
    lastTriggeredAt: '2026-04-10T14:23:00Z',
    triggerCount: 12,
    createdAt: '2026-03-15T10:00:00Z',
    updatedAt: '2026-04-10T14:23:00Z',
    approvalMode: 'auto_safe',
  },
  {
    id: '2',
    name: 'התראה על תשלום באיחור',
    description: 'הודע לעובד כשתשלום לא בוצע בזמן',
    trigger: 'payment_overdue',
    action: 'send_email',
    isActive: true,
    targetEmail: 'accounting@example.com',
    targetWhatsApp: '',
    templateId: null,
    conditions: '',
    lastTriggeredAt: '2026-04-09T09:15:00Z',
    triggerCount: 5,
    createdAt: '2026-03-20T10:00:00Z',
    updatedAt: '2026-04-09T09:15:00Z',
    approvalMode: 'requires_approval',
  },
  {
    id: '3',
    name: 'שלח גאנט ללקוח',
    description: 'שלח גאנט ללקוח לאחר אישור פנימי',
    trigger: 'gantt_approved',
    action: 'send_email',
    isActive: true,
    targetEmail: 'client@example.com',
    targetWhatsApp: '',
    templateId: null,
    conditions: '',
    lastTriggeredAt: '2026-04-08T11:45:00Z',
    triggerCount: 8,
    createdAt: '2026-03-18T10:00:00Z',
    updatedAt: '2026-04-08T11:45:00Z',
    approvalMode: 'auto_safe',
  },
  {
    id: '4',
    name: 'תזכורת משימה יומית',
    description: 'הודע לעובד על משימות שיש להשלים היום',
    trigger: 'employee_task_due_today',
    action: 'create_notification',
    isActive: true,
    targetEmail: '',
    targetWhatsApp: '',
    templateId: null,
    conditions: '',
    lastTriggeredAt: '2026-04-11T08:00:00Z',
    triggerCount: 45,
    createdAt: '2026-03-10T10:00:00Z',
    updatedAt: '2026-04-11T08:00:00Z',
    approvalMode: 'auto_safe',
  },
  {
    id: '5',
    name: 'פולואפ אחרי הצעה',
    description: 'שלח מייל עקוב 3 ימים אחרי שליחת הצעה',
    trigger: 'proposal_sent',
    action: 'send_email',
    isActive: false,
    targetEmail: 'sales@example.com',
    targetWhatsApp: '',
    templateId: null,
    conditions: '',
    lastTriggeredAt: '2026-04-06T16:30:00Z',
    triggerCount: 3,
    createdAt: '2026-03-25T10:00:00Z',
    updatedAt: '2026-04-06T16:30:00Z',
    approvalMode: 'recommendation_only',
  },
  {
    id: '6',
    name: 'התראה על לקוח בלי גאנט',
    description: 'הודע כשלקוח לא קיבל גאנט חודשי',
    trigger: 'client_missing_monthly_gantt',
    action: 'create_notification',
    isActive: false,
    targetEmail: '',
    targetWhatsApp: '',
    templateId: null,
    conditions: '',
    lastTriggeredAt: null,
    triggerCount: 0,
    createdAt: '2026-03-22T10:00:00Z',
    updatedAt: '2026-03-22T10:00:00Z',
    approvalMode: 'auto_safe',
  },
];

export default function AutomationsPage() {
  const { data: apiAutomations, loading, error, update, refetch } = useAutomationRules();
  const { data: systemEvents } = useSystemEvents();

  const automations = useMemo(() => {
    return (apiAutomations && apiAutomations.length > 0) ? apiAutomations : DEFAULT_AUTOMATIONS;
  }, [apiAutomations]);

  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [dismissedSuggestion, setDismissedSuggestion] = useState(false);

  const filteredAutomations = useMemo(() => {
    let filtered = automations;

    if (statusFilter === 'active') {
      filtered = filtered.filter((a) => a.isActive);
    } else if (statusFilter === 'paused') {
      filtered = filtered.filter((a) => !a.isActive && a.createdAt);
    }

    if (typeFilter !== 'all') {
      filtered = filtered.filter((a) => TRIGGER_TO_TYPE[a.trigger] === typeFilter);
    }

    if (searchTerm) {
      const lower = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (a) =>
          a.name.toLowerCase().includes(lower) ||
          a.description.toLowerCase().includes(lower)
      );
    }

    return filtered;
  }, [automations, statusFilter, typeFilter, searchTerm]);

  const stats = useMemo(() => {
    const active = automations.filter((a) => a.isActive).length;
    const paused = automations.filter((a) => !a.isActive).length;
    const today = new Date().toISOString().split('T')[0];
    const triggeredToday = automations.reduce((sum, a) => {
      if (a.lastTriggeredAt && a.lastTriggeredAt.startsWith(today)) {
        return sum + a.triggerCount;
      }
      return sum;
    }, 0);
    const pendingApproval = automations.filter(
      (a) => a.approvalMode && a.approvalMode !== 'auto_safe' && a.triggerCount > 0
    ).length;

    return { active, paused, triggeredToday, pendingApproval, total: automations.length };
  }, [automations]);

  const handleToggle = async (id: string) => {
    const automation = automations.find((a) => a.id === id);
    if (automation) {
      try {
        await update(id, { isActive: !automation.isActive });
        await refetch();
      } catch (error) {
        console.error('Failed to toggle automation:', error);
      }
    }
  };

  const handleEmptyState = stats.total === 0;
  const showAISuggestion = !dismissedSuggestion && stats.total < 3;

  return (
    <div dir="rtl" className="min-h-screen" style={{ backgroundColor: 'var(--background)' }}>
      <div className="p-8">
        {/* Header */}
        <div className="mb-8 flex items-start justify-between">
          <div>
            <h1
              className="text-5xl font-bold mb-2 ux-stagger"
              style={{ color: 'var(--foreground)' }}
            >
              מרכז אוטומציות
            </h1>
            <p className="text-lg ux-stagger" style={{ color: 'var(--foreground-muted)' }}>
              צור ונהל אוטומציות חכמות שחוסכות לך שעות של עבודה ידנית
            </p>
          </div>
          <div className="flex gap-3">
            <Link
              href="/automations/templates"
              className="px-6 py-3 rounded-lg font-medium transition-all ux-stagger"
              style={{
                backgroundColor: 'var(--surface)',
                color: 'var(--accent)',
                border: '2px solid var(--accent)',
              }}
            >
              בחר תבנית
            </Link>
            <Link
              href="/automations/new"
              className="px-6 py-3 rounded-lg font-medium text-white transition-all ux-stagger"
              style={{ backgroundColor: 'var(--accent)' }}
            >
              צור אוטומציה
            </Link>
          </div>
        </div>

        {/* KPI Strip */}
        {!handleEmptyState && (
          <div className="mb-8 auto-kpi-strip">
            <div className="grid grid-cols-5 gap-4">
              <KPICard
                label="פעילות"
                value={stats.active.toString()}
                accent="var(--accent)"
                icon="▶️"
              />
              <KPICard
                label="מושהות"
                value={stats.paused.toString()}
                accent="#f59e0b"
                icon="⏸️"
              />
              <KPICard
                label="פעולות היום"
                value={stats.triggeredToday.toString()}
                accent="#3b82f6"
                icon="📊"
              />
              <KPICard
                label="ממתין לאישור"
                value={stats.pendingApproval.toString()}
                accent="#f59e0b"
                icon="✋"
              />
              <KPICard
                label="נכשלו"
                value="0"
                accent="#ef4444"
                icon="❌"
              />
            </div>
          </div>
        )}

        {/* AI Suggestion Banner */}
        {showAISuggestion && !handleEmptyState && (
          <div className="mb-6 ai-suggestion-banner">
            <div
              className="rounded-lg p-4 flex items-start justify-between"
              style={{
                backgroundColor: 'rgba(59, 130, 246, 0.1)',
                border: '1px solid rgba(59, 130, 246, 0.3)',
              }}
            >
              <div>
                <p className="font-semibold" style={{ color: '#3b82f6' }}>
                  💡 עצה חכמה
                </p>
                <p style={{ color: 'var(--foreground-muted)' }} className="text-sm mt-1">
                  אתה משתמש רק ב-{stats.total} אוטומציות. שקול להוסיף עוד לחסוך זמן בתהליכים חוזרים.
                </p>
              </div>
              <button
                onClick={() => setDismissedSuggestion(true)}
                className="text-xs mt-1 hover:opacity-70"
                style={{ color: '#3b82f6' }}
              >
                ✕
              </button>
            </div>
          </div>
        )}

        {/* Filter Bar */}
        {!handleEmptyState && (
          <div className="mb-6 space-y-4">
            <div className="flex flex-wrap gap-2">
              {(['all', 'active', 'paused', 'draft'] as StatusFilter[]).map((status) => (
                <button
                  key={status}
                  onClick={() => setStatusFilter(status)}
                  className={`px-4 py-2 rounded-lg font-medium transition-all ${
                    statusFilter === status ? 'text-white' : ''
                  }`}
                  style={{
                    backgroundColor:
                      statusFilter === status
                        ? 'var(--accent)'
                        : 'var(--surface)',
                    color:
                      statusFilter === status
                        ? 'white'
                        : 'var(--foreground)',
                    border: `1px solid var(--border)`,
                  }}
                >
                  {status === 'all' && 'הכל'}
                  {status === 'active' && 'פעיל'}
                  {status === 'paused' && 'מושהה'}
                  {status === 'draft' && 'טיוטה'}
                </button>
              ))}
            </div>

            <div className="flex gap-4 flex-wrap">
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value as TypeFilter)}
                className="px-4 py-2 rounded-lg font-medium border"
                style={{
                  backgroundColor: 'var(--surface)',
                  borderColor: 'var(--border)',
                  color: 'var(--foreground)',
                }}
              >
                {(Object.keys(TYPE_LABELS) as TypeFilter[]).map((type) => (
                  <option key={type} value={type}>
                    {TYPE_LABELS[type]}
                  </option>
                ))}
              </select>

              <input
                type="text"
                placeholder="חיפוש אוטומציות..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="flex-1 px-4 py-2 rounded-lg border"
                style={{
                  backgroundColor: 'var(--surface)',
                  borderColor: 'var(--border)',
                  color: 'var(--foreground)',
                  minWidth: '300px',
                }}
              />
            </div>
          </div>
        )}

        {/* Automations List */}
        {handleEmptyState ? (
          <EmptyState />
        ) : filteredAutomations.length === 0 ? (
          <div
            className="rounded-lg p-12 text-center premium-card"
            style={{
              backgroundColor: 'var(--surface)',
            }}
          >
            <p style={{ color: 'var(--foreground-muted)' }} className="text-lg">
              לא נמצאו אוטומציות התואמות את הסינון שלך
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredAutomations.map((automation, idx) => (
              <div
                key={automation.id}
                style={{
                  animation: `auto-card-enter 0.3s ease-out ${idx * 50}ms both`,
                }}
              >
                <AutomationCard
                  automation={automation}
                  onToggle={() => handleToggle(automation.id)}
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

interface KPICardProps {
  label: string;
  value: string;
  accent: string;
  icon: string;
}

function KPICard({ label, value, accent, icon }: KPICardProps) {
  return (
    <div
      className="premium-card rounded-lg p-4"
      style={{
        backgroundColor: 'var(--surface)',
        border: `2px solid ${accent}20`,
      }}
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-medium mb-1" style={{ color: 'var(--foreground-muted)' }}>
            {label}
          </p>
          <p className="text-3xl font-bold" style={{ color: accent }}>
            {value}
          </p>
        </div>
        <span className="text-2xl">{icon}</span>
      </div>
    </div>
  );
}

interface AutomationCardProps {
  automation: AutomationRule;
  onToggle: () => void;
}

function AutomationCard({ automation, onToggle }: AutomationCardProps) {
  const statusBadgeClass = automation.isActive ? 'auto-badge-active' : 'auto-badge-paused';
  const approvalMode = automation.approvalMode || 'auto_safe';
  const approvalModeConfig = APPROVAL_MODES[approvalMode as keyof typeof APPROVAL_MODES];

  return (
    <div
      className="premium-card auto-card rounded-lg p-5 border transition-all hover:shadow-lg"
      style={{
        backgroundColor: 'var(--surface)',
        borderColor: 'var(--border)',
      }}
    >
      {/* Header with name, badge, and toggle */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            <h3
              className="text-lg font-bold"
              style={{ color: 'var(--foreground)' }}
            >
              {automation.name}
            </h3>
            <span className={`text-xs font-semibold px-2 py-1 rounded-full ${statusBadgeClass}`}>
              {automation.isActive ? 'פעיל' : 'מושהה'}
            </span>
          </div>
          <p
            className="text-sm"
            style={{ color: 'var(--foreground-muted)' }}
          >
            {automation.description}
          </p>
        </div>
        <button
          onClick={onToggle}
          className="ms-4 relative inline-flex h-8 w-14 items-center rounded-full transition-colors flex-shrink-0"
          style={{
            backgroundColor: automation.isActive
              ? 'var(--accent)'
              : 'var(--border)',
          }}
        >
          <span
            className="inline-block h-6 w-6 transform rounded-full bg-white transition-transform"
            style={{
              transform: automation.isActive ? 'translateX(-1.5rem)' : 'translateX(0.25rem)',
            }}
          />
        </button>
      </div>

      {/* Flow: Trigger → Action */}
      <div className="mb-4 flex items-center gap-3 pb-4 border-b" style={{ borderColor: 'var(--border)' }}>
        <Badge label={TRIGGER_LABELS[automation.trigger]} variant="trigger" />
        <div className="auto-flow-arrow">→</div>
        <Badge label={ACTION_LABELS[automation.action]} variant="action" />
        <div className="ms-auto">
          <span
            className="text-xs font-semibold px-2 py-1 rounded-full"
            style={{
              backgroundColor: `${approvalModeConfig.color}20`,
              color: approvalModeConfig.color,
            }}
          >
            {approvalModeConfig.label}
          </span>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-3 mb-4 pb-4 border-b" style={{ borderColor: 'var(--border)' }}>
        <div>
          <p className="text-xs font-medium mb-1" style={{ color: 'var(--foreground-muted)' }}>
            הפעלה אחרונה
          </p>
          <p className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>
            {formatDateDisplay(automation.lastTriggeredAt)}
          </p>
        </div>
        <div>
          <p className="text-xs font-medium mb-1" style={{ color: 'var(--foreground-muted)' }}>
            סה״כ הפעלות
          </p>
          <p className="text-sm font-medium" style={{ color: 'var(--accent)' }}>
            {automation.triggerCount}
          </p>
        </div>
        <div>
          <p className="text-xs font-medium mb-1" style={{ color: 'var(--foreground-muted)' }}>
            טווח
          </p>
          <p className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>
            כל הלקוחות
          </p>
        </div>
        <div>
          <p className="text-xs font-medium mb-1" style={{ color: 'var(--foreground-muted)' }}>
            סטטוס בריאות
          </p>
          <p className="text-sm font-medium" style={{ color: '#10b981' }}>
            ✓ טוב
          </p>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        <Link
          href={`/automations/edit/${automation.id}`}
          className="flex-1 px-4 py-2 rounded-lg font-medium transition-all text-sm text-center"
          style={{
            backgroundColor: 'var(--surface-variant)',
            color: 'var(--accent)',
            border: '1px solid var(--border)',
          }}
        >
          עריכה
        </Link>
        <button
          className="flex-1 px-4 py-2 rounded-lg font-medium transition-all text-sm"
          style={{
            backgroundColor: 'var(--surface-variant)',
            color: 'var(--foreground)',
            border: '1px solid var(--border)',
          }}
        >
          עוד
        </button>
      </div>
    </div>
  );
}

interface BadgeProps {
  label: string;
  variant: 'trigger' | 'action';
}

function Badge({ label, variant }: BadgeProps) {
  const colors = {
    trigger: {
      bg: 'rgba(59, 130, 246, 0.1)',
      text: '#3b82f6',
    },
    action: {
      bg: 'rgba(34, 197, 94, 0.1)',
      text: '#22c55e',
    },
  };

  return (
    <span
      className="px-3 py-1 rounded-full text-sm font-medium"
      style={{
        backgroundColor: colors[variant].bg,
        color: colors[variant].text,
      }}
    >
      {label}
    </span>
  );
}

function formatDateDisplay(dateString: string | null): string {
  if (!dateString) return 'לא הופעל';
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffMins = Math.floor(diffMs / (1000 * 60));

  if (diffDays > 0) return `לפני ${diffDays}d`;
  if (diffHours > 0) return `לפני ${diffHours}h`;
  if (diffMins > 0) return `לפני ${diffMins}m`;
  return 'עכשיו';
}

function EmptyState() {
  return (
    <div
      className="rounded-lg p-16 text-center"
      style={{
        backgroundColor: 'var(--surface)',
        border: '2px dashed var(--border)',
      }}
    >
      <div className="mb-4 text-5xl">⚡</div>
      <h3
        className="text-2xl font-bold mb-2"
        style={{ color: 'var(--foreground)' }}
      >
        אתה עדיין לא הגדרת אוטומציות
      </h3>
      <p
        className="text-lg mb-6"
        style={{ color: 'var(--foreground-muted)' }}
      >
        התחל עכשיו וחוסוך שעות של עבודה ידנית עם אוטומציות חכמות
      </p>
      <div className="flex gap-3 justify-center">
        <Link
          href="/automations/templates"
          className="px-6 py-3 rounded-lg font-medium transition-all"
          style={{
            backgroundColor: 'var(--background)',
            color: 'var(--accent)',
            border: '2px solid var(--accent)',
          }}
        >
          בחר מתבנית
        </Link>
        <Link
          href="/automations/new"
          className="px-6 py-3 rounded-lg font-medium text-white transition-all"
          style={{ backgroundColor: 'var(--accent)' }}
        >
          צור חדשה
        </Link>
      </div>
    </div>
  );
}
