/**
 * AI Management Insights Engine
 * Computes intelligent operational recommendations from system data.
 *
 * This module generates insights WITHOUT calling external AI APIs —
 * it uses rule-based intelligence on live data for instant results.
 * Can be enhanced later with OpenAI calls for richer natural language.
 */

import type {
  Client,
  Lead,
  Employee,
  EmployeeTask,
  Payment,
  ClientGanttItem,
  ProjectPayment,
} from '@/lib/db/schema';

// ═══════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════

export type InsightType = 'attention' | 'planning' | 'workload' | 'payment' | 'recommendation';
export type InsightPriority = 'high' | 'medium' | 'low';

export interface ManagementInsight {
  id: string;
  type: InsightType;
  priority: InsightPriority;
  icon: string;
  title: string;
  description: string;
  metric?: string;
  actionLabel?: string;
  actionHref?: string;
}

export interface InsightsInput {
  clients: Client[];
  leads: Lead[];
  employees: Employee[];
  employeeTasks: EmployeeTask[];
  payments: Payment[];
  ganttItems: ClientGanttItem[];
  projectPayments: ProjectPayment[];
}

// ═══════════════════════════════════════════════════════════════════════
// ENGINE
// ═══════════════════════════════════════════════════════════════════════

export function computeInsights(input: InsightsInput): ManagementInsight[] {
  const insights: ManagementInsight[] = [];
  const now = new Date();
  let idCounter = 0;
  const makeId = () => `insight_${++idCounter}`;

  const activeClients = input.clients.filter((c) => c.status === 'active');
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();

  // ── 1. Clients needing attention ─────────────────────────────────
  const clientsWithoutGantt = activeClients.filter((c) => {
    const hasGantt = input.ganttItems.some(
      (g) => g.clientId === c.id && g.ganttType === 'monthly' && g.month === currentMonth && g.year === currentYear
    );
    return !hasGantt && c.clientType === 'marketing';
  });

  if (clientsWithoutGantt.length > 0) {
    insights.push({
      id: makeId(),
      type: 'attention',
      priority: 'high',
      icon: '📋',
      title: `${clientsWithoutGantt.length} לקוחות ללא גאנט חודשי`,
      description: clientsWithoutGantt.slice(0, 3).map((c) => c.name).join(', ') +
        (clientsWithoutGantt.length > 3 ? ` ועוד ${clientsWithoutGantt.length - 3}` : ''),
      metric: `${clientsWithoutGantt.length}/${activeClients.filter(c => c.clientType === 'marketing').length}`,
      actionLabel: 'צפה בלקוחות',
      actionHref: '/clients',
    });
  }

  // ── 2. Weak planning coverage ────────────────────────────────────
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - now.getDay());
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 7);

  const clientsLowPosting = activeClients.filter((c) => {
    if (c.clientType !== 'marketing') return false;
    const weekItems = input.ganttItems.filter(
      (g) =>
        g.clientId === c.id &&
        new Date(g.date) >= weekStart &&
        new Date(g.date) < weekEnd
    ).length;
    return weekItems < 2;
  });

  if (clientsLowPosting.length > 0) {
    insights.push({
      id: makeId(),
      type: 'planning',
      priority: clientsLowPosting.length > 2 ? 'high' : 'medium',
      icon: '📉',
      title: `${clientsLowPosting.length} לקוחות עם פחות מ-2 פוסטים השבוע`,
      description: 'כיסוי תוכן חלש – מומלץ לתכנן פוסטים נוספים',
      metric: `${clientsLowPosting.length} לקוחות`,
      actionLabel: 'תכנן תוכן',
      actionHref: '/clients',
    });
  }

  // ── 3. Employee overload detection ───────────────────────────────
  const employeeWorkloads = input.employees.map((emp) => {
    const tasks = input.employeeTasks.filter(
      (t) => t.assignedEmployeeId === emp.id && t.status !== 'completed' && t.status !== 'approved'
    );
    const overdue = tasks.filter((t) => t.dueDate && new Date(t.dueDate) < now);
    return { employee: emp, openTasks: tasks.length, overdueTasks: overdue.length };
  });

  const overloaded = employeeWorkloads.filter((e) => e.openTasks > 6);
  if (overloaded.length > 0) {
    const worst = overloaded.sort((a, b) => b.openTasks - a.openTasks)[0];
    insights.push({
      id: makeId(),
      type: 'workload',
      priority: 'high',
      icon: '⚡',
      title: `${worst.employee.name} עמוס/ה השבוע`,
      description: `${worst.openTasks} משימות פתוחות${worst.overdueTasks > 0 ? `, ${worst.overdueTasks} באיחור` : ''} — שקלו לחלק מחדש`,
      metric: `${worst.openTasks} משימות`,
      actionLabel: 'צפה במשימות',
      actionHref: `/employees/${worst.employee.id}`,
    });
  }

  const underutilized = employeeWorkloads.filter((e) => e.openTasks <= 2 && e.employee.role !== 'admin');
  if (underutilized.length > 0 && overloaded.length > 0) {
    insights.push({
      id: makeId(),
      type: 'recommendation',
      priority: 'medium',
      icon: '🔄',
      title: `אפשר לאזן עומסים`,
      description: `${underutilized.map(e => e.employee.name).join(', ')} עם עומס נמוך — אפשר להעביר משימות מ${overloaded[0].employee.name}`,
      actionLabel: 'נהל צוות',
      actionHref: '/employees',
    });
  }

  // ── 4. Payment risk detection ────────────────────────────────────
  const overduePayments = input.payments.filter(
    (p) => p.status === 'overdue' || (p.status === 'pending' && new Date(p.dueDate) < now)
  );
  const overdueProjectPayments = input.projectPayments.filter(
    (p) => p.status === 'pending' && new Date(p.dueDate) < now
  );
  const totalOverdue = overduePayments.length + overdueProjectPayments.length;
  const totalOverdueAmount =
    overduePayments.reduce((sum, p) => sum + p.amount, 0) +
    overdueProjectPayments.reduce((sum, p) => sum + p.amount, 0);

  if (totalOverdue > 0) {
    insights.push({
      id: makeId(),
      type: 'payment',
      priority: totalOverdueAmount > 10000 ? 'high' : 'medium',
      icon: '💰',
      title: `${totalOverdue} תשלומים באיחור דורשים טיפול`,
      description: `סה"כ ₪${totalOverdueAmount.toLocaleString()} בפיגור — מומלץ לבצע גבייה`,
      metric: `₪${totalOverdueAmount.toLocaleString()}`,
      actionLabel: 'צפה בתשלומים',
      actionHref: '/accounting/payments',
    });
  }

  // ── 5. New leads needing attention ───────────────────────────────
  const newLeads = input.leads.filter((l) => l.status === 'new');
  const proposalLeads = input.leads.filter((l) => l.status === 'proposal_sent' && !l.followupDone);

  if (newLeads.length > 0) {
    insights.push({
      id: makeId(),
      type: 'attention',
      priority: newLeads.length > 3 ? 'high' : 'medium',
      icon: '🎯',
      title: `${newLeads.length} לידים חדשים ממתינים לטיפול`,
      description: newLeads.slice(0, 3).map((l) => l.fullName || l.name).join(', '),
      metric: `${newLeads.length} לידים`,
      actionLabel: 'טפל בלידים',
      actionHref: '/leads',
    });
  }

  if (proposalLeads.length > 0) {
    const totalValue = proposalLeads.reduce((sum, l) => sum + (l.proposalAmount || 0), 0);
    insights.push({
      id: makeId(),
      type: 'recommendation',
      priority: 'high',
      icon: '📞',
      title: `${proposalLeads.length} הצעות מחיר ללא פולואפ`,
      description: `₪${totalValue.toLocaleString()} בהצעות פתוחות — בצעו פולואפ היום`,
      metric: `₪${totalValue.toLocaleString()}`,
      actionLabel: 'צפה בלידים',
      actionHref: '/leads',
    });
  }

  // ── 6. Clients without manager ───────────────────────────────────
  const noManager = activeClients.filter((c) => !c.assignedManagerId);
  if (noManager.length > 0) {
    insights.push({
      id: makeId(),
      type: 'attention',
      priority: 'medium',
      icon: '👤',
      title: `${noManager.length} לקוחות ללא מנהל מוקצה`,
      description: noManager.slice(0, 3).map((c) => c.name).join(', '),
      actionLabel: 'הקצה מנהלים',
      actionHref: '/clients',
    });
  }

  // ── 7. Recommended next actions ──────────────────────────────────
  // Priority-based recommended actions
  const actions: string[] = [];

  if (proposalLeads.length > 0) actions.push('בצעו פולואפ על הצעות מחיר פתוחות');
  if (clientsWithoutGantt.length > 0) actions.push('צרו גאנט חודשי ללקוחות חסרים');
  if (totalOverdue > 0) actions.push('טפלו בגביית תשלומים באיחור');
  if (overloaded.length > 0) actions.push('אזנו עומסי עבודה בצוות');
  if (newLeads.length > 0) actions.push('צרו קשר עם לידים חדשים');

  if (actions.length > 0) {
    insights.push({
      id: makeId(),
      type: 'recommendation',
      priority: 'low',
      icon: '✅',
      title: 'פעולות מומלצות להיום',
      description: actions.slice(0, 3).join(' • '),
    });
  }

  // Sort by priority
  const priorityOrder: Record<InsightPriority, number> = { high: 0, medium: 1, low: 2 };
  insights.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

  return insights;
}

// ═══════════════════════════════════════════════════════════════════════
// DISPLAY HELPERS
// ═══════════════════════════════════════════════════════════════════════

export const INSIGHT_TYPE_CONFIG: Record<InsightType, { color: string; bg: string; label: string }> = {
  attention: { color: '#ef4444', bg: 'rgba(239, 68, 68, 0.08)', label: 'דורש תשומת לב' },
  planning: { color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.08)', label: 'תכנון' },
  workload: { color: '#8b5cf6', bg: 'rgba(139, 92, 246, 0.08)', label: 'עומסים' },
  payment: { color: '#10b981', bg: 'rgba(16, 185, 129, 0.08)', label: 'כספים' },
  recommendation: { color: '#00B5FE', bg: 'rgba(0, 181, 254, 0.08)', label: 'המלצה' },
};
