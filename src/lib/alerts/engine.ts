/**
 * Management Alerts Engine
 * Computes real-time operational alerts from all data sources.
 * Used by: Executive Dashboard, Notification Center, Employee Dashboard
 */

import type {
  Client,
  Lead,
  Employee,
  EmployeeTask,
  Payment,
  ClientGanttItem,
  Approval,
  ProjectPayment,
} from '@/lib/db/schema';

// ═══════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════

export type AlertSeverity = 'critical' | 'warning' | 'info';
export type AlertCategory =
  | 'lead_followup'
  | 'missing_gantt'
  | 'low_posting'
  | 'overdue_payment'
  | 'task_review_stale'
  | 'employee_overload'
  | 'no_manager'
  | 'lead_stale'
  | 'pending_approval';

export interface OperationalAlert {
  id: string;
  category: AlertCategory;
  severity: AlertSeverity;
  title: string;
  description: string;
  entityId: string | null;
  entityType: 'client' | 'lead' | 'employee' | 'task' | 'payment' | 'approval' | null;
  linkHref: string | null;
  linkLabel: string | null;
  createdAt: string;
}

export interface AlertsInput {
  clients: Client[];
  leads: Lead[];
  employees: Employee[];
  employeeTasks: EmployeeTask[];
  payments: Payment[];
  ganttItems: ClientGanttItem[];
  approvals: Approval[];
  projectPayments: ProjectPayment[];
}

// ═══════════════════════════════════════════════════════════════════════
// ENGINE
// ═══════════════════════════════════════════════════════════════════════

export function computeAlerts(input: AlertsInput): OperationalAlert[] {
  const alerts: OperationalAlert[] = [];
  const now = new Date();
  const today = now.toISOString().split('T')[0];
  let idCounter = 0;
  const makeId = () => `alert_${++idCounter}`;

  // ── 1. Lead follow-up due ────────────────────────────────────────
  input.leads.forEach((lead) => {
    if (
      lead.status !== 'won' &&
      lead.status !== 'not_relevant' &&
      lead.followUpAt
    ) {
      const followDate = new Date(lead.followUpAt);
      if (followDate <= now) {
        alerts.push({
          id: makeId(),
          category: 'lead_followup',
          severity: 'warning',
          title: `פולואפ ליד: ${lead.fullName || lead.name}`,
          description: `תזכורת פולואפ${lead.proposalSent ? ' על הצעת מחיר' : ''} – ${lead.phone}`,
          entityId: lead.id,
          entityType: 'lead',
          linkHref: `/leads/${lead.id}`,
          linkLabel: 'צפה בליד',
          createdAt: now.toISOString(),
        });
      }
    }
    // Stale leads (new for > 3 days, no contact)
    if (lead.status === 'new') {
      const created = new Date(lead.createdAt);
      const daysSince = (now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24);
      if (daysSince > 3) {
        alerts.push({
          id: makeId(),
          category: 'lead_stale',
          severity: 'info',
          title: `ליד ממתין: ${lead.fullName || lead.name}`,
          description: `ליד חדש כבר ${Math.floor(daysSince)} ימים ללא טיפול`,
          entityId: lead.id,
          entityType: 'lead',
          linkHref: `/leads/${lead.id}`,
          linkLabel: 'טפל בליד',
          createdAt: now.toISOString(),
        });
      }
    }
    // Proposal sent but no follow-up
    if (lead.status === 'proposal_sent' && !lead.followupDone) {
      alerts.push({
        id: makeId(),
        category: 'lead_followup',
        severity: 'warning',
        title: `חסר פולואפ: ${lead.fullName || lead.name}`,
        description: `הצעת מחיר נשלחה (₪${lead.proposalAmount?.toLocaleString()}) – טרם בוצע פולואפ`,
        entityId: lead.id,
        entityType: 'lead',
        linkHref: `/leads/${lead.id}`,
        linkLabel: 'בצע פולואפ',
        createdAt: now.toISOString(),
      });
    }
  });

  // ── 2. Missing monthly gantt ─────────────────────────────────────
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();
  input.clients
    .filter((c) => c.status === 'active' && c.clientType === 'marketing')
    .forEach((client) => {
      const hasGantt = input.ganttItems.some(
        (g) =>
          g.clientId === client.id &&
          g.ganttType === 'monthly' &&
          g.month === currentMonth &&
          g.year === currentYear
      );
      if (!hasGantt || client.monthlyGanttStatus === 'none' || client.monthlyGanttStatus === 'draft') {
        alerts.push({
          id: makeId(),
          category: 'missing_gantt',
          severity: 'warning',
          title: `חסר גאנט חודשי: ${client.name}`,
          description: `ללקוח אין לוח תוכן מאושר לחודש ${currentMonth}/${currentYear}`,
          entityId: client.id,
          entityType: 'client',
          linkHref: `/clients/${client.id}`,
          linkLabel: 'צור גאנט',
          createdAt: now.toISOString(),
        });
      }
    });

  // ── 3. Less than 2 posts this week ───────────────────────────────
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - now.getDay());
  weekStart.setHours(0, 0, 0, 0);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 7);

  input.clients
    .filter((c) => c.status === 'active' && c.clientType === 'marketing')
    .forEach((client) => {
      const weekPosts = input.ganttItems.filter(
        (g) =>
          g.clientId === client.id &&
          g.status === 'published' &&
          new Date(g.date) >= weekStart &&
          new Date(g.date) < weekEnd
      ).length;
      // Also count scheduled posts this week
      const scheduledThisWeek = input.ganttItems.filter(
        (g) =>
          g.clientId === client.id &&
          (g.status === 'scheduled' || g.status === 'approved') &&
          new Date(g.date) >= weekStart &&
          new Date(g.date) < weekEnd
      ).length;
      if (weekPosts + scheduledThisWeek < 2) {
        alerts.push({
          id: makeId(),
          category: 'low_posting',
          severity: 'info',
          title: `מעט תוכן השבוע: ${client.name}`,
          description: `רק ${weekPosts + scheduledThisWeek} פוסטים מתוכננים/פורסמו השבוע (מומלץ: 2+)`,
          entityId: client.id,
          entityType: 'client',
          linkHref: `/clients/${client.id}`,
          linkLabel: 'צפה בגאנט',
          createdAt: now.toISOString(),
        });
      }
    });

  // ── 4. Overdue payments ──────────────────────────────────────────
  input.payments
    .filter((p) => p.status === 'overdue' || (p.status === 'pending' && new Date(p.dueDate) < now))
    .forEach((payment) => {
      alerts.push({
        id: makeId(),
        category: 'overdue_payment',
        severity: 'critical',
        title: `תשלום באיחור: ${payment.clientName}`,
        description: `₪${payment.amount.toLocaleString()} – ${payment.description || payment.invoiceNo}`,
        entityId: payment.id,
        entityType: 'payment',
        linkHref: '/accounting/payments',
        linkLabel: 'צפה בתשלומים',
        createdAt: now.toISOString(),
      });
    });

  input.projectPayments
    .filter((p) => p.status === 'pending' && new Date(p.dueDate) < now)
    .forEach((pp) => {
      alerts.push({
        id: makeId(),
        category: 'overdue_payment',
        severity: 'critical',
        title: `תשלום פרויקט באיחור`,
        description: `₪${pp.amount.toLocaleString()} – ${pp.description}`,
        entityId: pp.id,
        entityType: 'payment',
        linkHref: '/accounting/payments',
        linkLabel: 'צפה',
        createdAt: now.toISOString(),
      });
    });

  // ── 5. Task under review too long (> 2 days) ────────────────────
  input.employeeTasks
    .filter((t) => t.status === 'under_review')
    .forEach((task) => {
      const updated = new Date(task.updatedAt);
      const daysSinceUpdate = (now.getTime() - updated.getTime()) / (1000 * 60 * 60 * 24);
      if (daysSinceUpdate > 2) {
        alerts.push({
          id: makeId(),
          category: 'task_review_stale',
          severity: 'warning',
          title: `משימה ממתינה לבדיקה: ${task.title}`,
          description: `${Math.floor(daysSinceUpdate)} ימים בסטטוס "בבדיקה"${task.clientName ? ` – ${task.clientName}` : ''}`,
          entityId: task.id,
          entityType: 'task',
          linkHref: task.assignedEmployeeId ? `/employees/${task.assignedEmployeeId}` : '/employees',
          linkLabel: 'צפה',
          createdAt: now.toISOString(),
        });
      }
    });

  // ── 6. Employee overload (> 8 open tasks or > 90% workload) ─────
  input.employees.forEach((emp) => {
    const openTasks = input.employeeTasks.filter(
      (t) => t.assignedEmployeeId === emp.id && t.status !== 'completed' && t.status !== 'approved'
    ).length;
    const overdueTasks = input.employeeTasks.filter(
      (t) =>
        t.assignedEmployeeId === emp.id &&
        t.status !== 'completed' &&
        t.status !== 'approved' &&
        t.dueDate &&
        new Date(t.dueDate) < now
    ).length;

    if (openTasks > 8 || emp.workload > 90) {
      alerts.push({
        id: makeId(),
        category: 'employee_overload',
        severity: openTasks > 10 ? 'critical' : 'warning',
        title: `עומס יתר: ${emp.name}`,
        description: `${openTasks} משימות פתוחות${overdueTasks > 0 ? `, ${overdueTasks} באיחור` : ''}`,
        entityId: emp.id,
        entityType: 'employee',
        linkHref: `/employees/${emp.id}`,
        linkLabel: 'צפה בעובד',
        createdAt: now.toISOString(),
      });
    }
  });

  // ── 7. No assigned manager on active client ──────────────────────
  input.clients
    .filter((c) => c.status === 'active' && !c.assignedManagerId)
    .forEach((client) => {
      alerts.push({
        id: makeId(),
        category: 'no_manager',
        severity: 'info',
        title: `ללא מנהל: ${client.name}`,
        description: 'לקוח פעיל ללא מנהל לקוח מוקצה',
        entityId: client.id,
        entityType: 'client',
        linkHref: `/clients/${client.id}`,
        linkLabel: 'הקצה מנהל',
        createdAt: now.toISOString(),
      });
    });

  // ── 8. Pending approvals ─────────────────────────────────────────
  const pendingApprovals = input.approvals.filter((a) => a.status === 'pending_approval');
  if (pendingApprovals.length > 0) {
    alerts.push({
      id: makeId(),
      category: 'pending_approval',
      severity: 'info',
      title: `${pendingApprovals.length} אישורים ממתינים`,
      description: pendingApprovals.slice(0, 3).map((a) => a.title).join(', '),
      entityId: null,
      entityType: 'approval',
      linkHref: '/approvals',
      linkLabel: 'צפה באישורים',
      createdAt: now.toISOString(),
    });
  }

  // Sort by severity (critical first, then warning, then info)
  const severityOrder: Record<AlertSeverity, number> = { critical: 0, warning: 1, info: 2 };
  alerts.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

  return alerts;
}

// ═══════════════════════════════════════════════════════════════════════
// ALERT COUNTS BY CATEGORY
// ═══════════════════════════════════════════════════════════════════════

export function countAlertsByCategory(alerts: OperationalAlert[]): Record<AlertCategory, number> {
  const counts: Record<AlertCategory, number> = {
    lead_followup: 0,
    missing_gantt: 0,
    low_posting: 0,
    overdue_payment: 0,
    task_review_stale: 0,
    employee_overload: 0,
    no_manager: 0,
    lead_stale: 0,
    pending_approval: 0,
  };
  alerts.forEach((a) => {
    counts[a.category]++;
  });
  return counts;
}

export function countAlertsBySeverity(alerts: OperationalAlert[]): Record<AlertSeverity, number> {
  const counts: Record<AlertSeverity, number> = { critical: 0, warning: 0, info: 0 };
  alerts.forEach((a) => {
    counts[a.severity]++;
  });
  return counts;
}

// ═══════════════════════════════════════════════════════════════════════
// SEVERITY DISPLAY HELPERS
// ═══════════════════════════════════════════════════════════════════════

export const SEVERITY_CONFIG: Record<AlertSeverity, { color: string; bg: string; icon: string; label: string }> = {
  critical: { color: '#ef4444', bg: 'rgba(239, 68, 68, 0.1)', icon: '🔴', label: 'קריטי' },
  warning: { color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.1)', icon: '🟡', label: 'אזהרה' },
  info: { color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.1)', icon: '🔵', label: 'מידע' },
};

export const CATEGORY_LABELS: Record<AlertCategory, string> = {
  lead_followup: 'פולואפ ליד',
  missing_gantt: 'גאנט חסר',
  low_posting: 'תוכן מועט',
  overdue_payment: 'תשלום באיחור',
  task_review_stale: 'משימה ממתינה',
  employee_overload: 'עומס עובד',
  no_manager: 'חסר מנהל',
  lead_stale: 'ליד ישן',
  pending_approval: 'אישור ממתין',
};
