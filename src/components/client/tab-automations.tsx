'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import { useAutomationRules, useAutomationRuns } from '@/lib/api/use-entity';

interface Props {
  clientId: string;
  clientName: string;
}

const ACTION_LABELS: Record<string, string> = {
  create_task: 'יצירת משימה',
  assign_employee: 'הקצאת נציג',
  send_email: 'שליחת אימייל',
  send_whatsapp: 'שליחת WhatsApp',
  create_notification: 'יצירת התראה',
  push_to_approval_center: 'שליחה לאישור',
  update_status: 'עדכון סטטוס',
};

const TRIGGER_LABELS: Record<string, string> = {
  lead_status_changed: 'שינוי סטטוס ליד',
  task_created: 'משימה נוצרה',
  task_status_changed: 'שינוי סטטוס משימה',
  payment_overdue: 'תשלום באיחור',
  project_created: 'פרויקט נוצר',
  proposal_sent: 'הצעה נשלחה',
  payment_due: 'תשלום מגיע',
  gantt_created: 'גאנט נוצר',
  gantt_approved: 'גאנט אושר',
};

// Default mock automations for when no client-scoped rules exist
const DEFAULT_AUTOMATIONS = [
  { id: 'demo-1', name: 'מעקב אחרי ליד חדש', trigger: 'lead_status_changed', action: 'send_email', status: 'פעיל', lastRun: 'לפני 3 שעות' },
  { id: 'demo-2', name: 'התראת תשלום', trigger: 'payment_overdue', action: 'create_notification', status: 'פעיל', lastRun: 'לפני 5 שעות' },
  { id: 'demo-3', name: 'יצירת משימה', trigger: 'task_created', action: 'create_task', status: 'לא פעיל', lastRun: 'לפני יום' },
];

export function TabAutomations({ clientId, clientName }: Props) {
  const { data: allRules = [] } = useAutomationRules();
  const { data: allRuns = [] } = useAutomationRuns();

  // Filter rules scoped to this client (or global rules)
  const clientRules = useMemo(() => {
    const rules = allRules.filter(r => r.clientId === clientId || !r.clientId);
    return rules.length > 0 ? rules : null;
  }, [allRules, clientId]);

  // Get recent runs for this client
  const clientRuns = useMemo(() => {
    return allRuns
      .filter(r => r.clientId === clientId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 5);
  }, [allRuns, clientId]);

  const automations = clientRules
    ? clientRules.map(r => ({
        id: r.id,
        name: r.name,
        trigger: r.trigger,
        action: r.action,
        status: r.isActive ? 'פעיל' : 'לא פעיל',
        lastRun: r.lastTriggeredAt
          ? `לפני ${Math.floor((Date.now() - new Date(r.lastTriggeredAt).getTime()) / 3600000)} שעות`
          : 'טרם הופעל',
      }))
    : DEFAULT_AUTOMATIONS;

  const recentActivities = clientRuns.length > 0
    ? clientRuns.map(run => ({
        id: run.id,
        action: `${run.ruleName}: ${ACTION_LABELS[run.action] || run.action}`,
        timestamp: `לפני ${Math.max(1, Math.floor((Date.now() - new Date(run.createdAt).getTime()) / 3600000))} שעות`,
        status: run.status === 'success' || run.status === 'approved' ? 'הצלחה' : run.status === 'failed' ? 'כשל' : 'ממתין',
      }))
    : [
        { id: 'd-1', action: `שלח מייל מעקב ללקוח ${clientName}`, timestamp: 'לפני 2 שעות', status: 'הצלחה' },
        { id: 'd-2', action: 'אוטומציה: קבלת תשלום הופעלה', timestamp: 'לפני 4 שעות', status: 'הצלחה' },
        { id: 'd-3', action: `עדכון נתונים ללקוח ${clientName}`, timestamp: 'לפני 6 שעות', status: 'הצלחה' },
      ];

  const suggestions = [
    {
      id: 1,
      title: `ללקוח ${clientName} כדאי ליצור אוטומציית מעקב לידים`,
      description: 'מעקב אוטומטי אחרי לידים חדשים עם הנעה מותאמת',
      icon: '🎯',
    },
    {
      id: 2,
      title: 'יש קמפיינים פעילים ללא התראה על ירידה בביצועים',
      description: 'הגדר התראות אוטומטיות כאשר ביצועים צונחים מתחת לסף',
      icon: '📉',
    },
    {
      id: 3,
      title: 'לא הוגדרה התראה על תשלום באיחור',
      description: `שלח התראות אוטומטיות ל-${clientName} בעת איחור בתשלום`,
      icon: '⏰',
    },
  ];

  const templates = [
    { id: 1, name: 'מעקב ליד חדש', description: 'שלח מייל מעקב בעת יצירת ליד חדש' },
    { id: 2, name: 'התראת תשלום באיחור', description: 'שלח הזכרון כאשר תשלום באיחור' },
  ];

  const statusColors: Record<string, string> = {
    'הצלחה': '#22c55e',
    'כשל': '#ef4444',
    'ממתין': '#f59e0b',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      {/* Active Automations Section */}
      <section style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <h2 style={{ fontSize: '1.125rem', fontWeight: 600, color: 'var(--foreground)', margin: 0 }}>
          אוטומציות פעילות
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem' }}>
          {automations.map((auto) => (
            <div
              key={auto.id}
              className="auto-card"
              style={{
                background: 'var(--surface-raised)',
                border: '1px solid var(--border)',
                borderRadius: '0.75rem',
                padding: '1.25rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.75rem',
                transition: 'all 150ms',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem' }}>
                <h3 style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--foreground)', margin: 0 }}>
                  {auto.name}
                </h3>
                <span
                  style={{
                    fontSize: '0.7rem',
                    fontWeight: 600,
                    padding: '0.35rem 0.6rem',
                    borderRadius: '0.375rem',
                    background: auto.status === 'פעיל' ? '#22c55e20' : '#9ca3af20',
                    color: auto.status === 'פעיל' ? '#22c55e' : '#9ca3af',
                    border: auto.status === 'פעיל' ? '1px solid #22c55e30' : '1px solid #9ca3af30',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {auto.status}
                </span>
              </div>

              <div style={{ fontSize: '0.85rem', color: 'var(--foreground-muted)', margin: '0.25rem 0' }}>
                <span style={{ display: 'inline-block' }}>📤 {TRIGGER_LABELS[auto.trigger] || auto.trigger}</span>
                <span style={{ display: 'block', margin: '0.25rem 0' }}>→</span>
                <span style={{ display: 'inline-block' }}>📥 {ACTION_LABELS[auto.action] || auto.action}</span>
              </div>

              <div style={{ fontSize: '0.8rem', color: 'var(--foreground-muted)', marginTop: '0.5rem' }}>
                הריצה האחרונה: {auto.lastRun}
              </div>
            </div>
          ))}
        </div>

        <Link
          href="/automations/new"
          style={{
            alignSelf: 'flex-start',
            fontSize: '0.9rem',
            color: 'var(--accent)',
            textDecoration: 'none',
            fontWeight: 500,
            padding: '0.5rem 0.75rem',
            marginTop: '0.5rem',
            transition: 'color 150ms',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--accent-hover)')}
          onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--accent)')}
        >
          + צור אוטומציה ללקוח
        </Link>
      </section>

      {/* Recent Activity Timeline */}
      <section style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <h2 style={{ fontSize: '1.125rem', fontWeight: 600, color: 'var(--foreground)', margin: 0 }}>
          פעילות אחרונה
        </h2>
        <div className="auto-timeline" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {recentActivities.map((activity, idx) => (
            <div
              key={activity.id}
              style={{
                display: 'flex',
                gap: '1rem',
                padding: '0.75rem',
                background: idx % 2 === 0 ? 'var(--surface-raised)' : 'transparent',
                borderRadius: '0.5rem',
                alignItems: 'flex-start',
              }}
            >
              <div
                style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  background: statusColors[activity.status] || '#9ca3af',
                  marginTop: '0.375rem',
                  flexShrink: 0,
                }}
              />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '0.9rem', color: 'var(--foreground)', marginBottom: '0.25rem' }}>
                  {activity.action}
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--foreground-muted)' }}>
                  {activity.timestamp} — <span style={{ color: statusColors[activity.status] }}>
                    {activity.status}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* AI Suggestions */}
      <section style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <h2 style={{ fontSize: '1.125rem', fontWeight: 600, color: 'var(--foreground)', margin: 0 }}>
          הצעות AI
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1rem' }}>
          {suggestions.map((suggestion) => (
            <div
              key={suggestion.id}
              style={{
                background: 'var(--surface-raised)',
                border: '1px solid var(--border)',
                borderLeft: '3px solid var(--accent)',
                borderRadius: '0.75rem',
                padding: '1.25rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.75rem',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
                <span style={{ fontSize: '1.5rem' }}>{suggestion.icon}</span>
                <h3 style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--foreground)', margin: 0 }}>
                  {suggestion.title}
                </h3>
              </div>
              <p style={{ fontSize: '0.85rem', color: 'var(--foreground-muted)', margin: '0.5rem 0 0 0' }}>
                {suggestion.description}
              </p>
              <Link
                href="/automations/new"
                style={{
                  alignSelf: 'flex-start',
                  fontSize: '0.85rem',
                  color: 'var(--accent)',
                  textDecoration: 'none',
                  fontWeight: 500,
                  padding: '0.4rem 0.6rem',
                  marginTop: '0.25rem',
                  transition: 'color 150ms',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--accent-hover)')}
                onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--accent)')}
              >
                הגדר עכשיו →
              </Link>
            </div>
          ))}
        </div>
      </section>

      {/* Suggested Templates */}
      <section style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <h2 style={{ fontSize: '1.125rem', fontWeight: 600, color: 'var(--foreground)', margin: 0 }}>
          תבניות מוצעות
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem' }}>
          {templates.map((template) => (
            <div
              key={template.id}
              className="auto-template-card"
              style={{
                background: 'var(--surface-raised)',
                border: '1px solid var(--border)',
                borderRadius: '0.75rem',
                padding: '1.25rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.75rem',
              }}
            >
              <h3 style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--foreground)', margin: 0 }}>
                {template.name}
              </h3>
              <p style={{ fontSize: '0.85rem', color: 'var(--foreground-muted)', margin: '0.5rem 0 0 0' }}>
                {template.description}
              </p>
              <button
                style={{
                  alignSelf: 'flex-start',
                  fontSize: '0.85rem',
                  fontWeight: 500,
                  padding: '0.5rem 1rem',
                  borderRadius: '0.375rem',
                  border: '1px solid var(--accent)',
                  background: 'var(--accent)',
                  color: 'white',
                  cursor: 'pointer',
                  transition: 'all 150ms',
                  marginTop: '0.5rem',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'var(--accent-hover)';
                  e.currentTarget.style.borderColor = 'var(--accent-hover)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'var(--accent)';
                  e.currentTarget.style.borderColor = 'var(--accent)';
                }}
                onClick={() => {
                  window.location.href = `/automations/new?template=${template.name}`;
                }}
              >
                השתמש בתבנית
              </button>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
