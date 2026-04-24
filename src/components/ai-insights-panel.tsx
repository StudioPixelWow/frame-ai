'use client';

import { useMemo } from 'react';
import Link from 'next/link';

export interface AIInsight {
  id: string;
  icon: string;
  title: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
  category: 'hot' | 'action' | 'warning' | 'opportunity';
  actionText?: string;
  actionHref?: string;
}

interface InsightPanelProps {
  insights: AIInsight[];
  compact?: boolean;
}

const CATEGORY_LABELS: Record<string, string> = {
  hot: 'מה חם השבוע',
  action: 'המלצות פעולה',
  warning: 'אזהרות',
  opportunity: 'הזדמנויות',
};

const CATEGORY_COLORS: Record<string, string> = {
  hot: '#ef4444',
  action: '#00B5FE',
  warning: '#f59e0b',
  opportunity: '#22c55e',
};

/** Generate smart, contextual insights from raw data — named clients, specific numbers, clear actions */
export function generateInsights(data: {
  tasks: Array<{ id: string; status?: string; title?: string; clientId?: string; clientName?: string; dueDate?: string; assigneeIds?: string[]; priority?: string }>;
  clients: Array<{ id: string; name: string; status?: string; clientType?: string; monthlyGanttStatus?: string; assignedManagerId?: string }>;
  approvals: Array<{ id: string; status: string; clientName?: string; title?: string; updatedAt: string }>;
  payments: Array<{ id: string; status: string; amount: number; dueDate?: string; clientName?: string; paidAt?: string }>;
  campaigns: Array<{ id: string; status: string; clientId?: string; campaignName?: string }>;
  socialPosts: Array<{ id: string; clientId?: string; createdAt?: string }>;
}): AIInsight[] {
  const insights: AIInsight[] = [];
  const now = new Date();
  const today = now.toISOString().split('T')[0];
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const safeTasks = data.tasks ?? [];
  const safeClients = data.clients ?? [];
  const safeApprovals = data.approvals ?? [];
  const safePayments = data.payments ?? [];
  const safeCampaigns = data.campaigns ?? [];
  const safeSocialPosts = data.socialPosts ?? [];

  const activeClients = safeClients.filter(c => c.status === 'active');
  const clientMap = new Map(safeClients.map(c => [c.id, c.name]));

  // ── HOT: Tasks overdue — with specific client names ──
  const overdueTasks = safeTasks.filter(t =>
    t.dueDate && t.dueDate < today && t.status !== 'completed' && t.status !== 'approved'
  );
  if (overdueTasks.length > 0) {
    const overdueByDays = overdueTasks.map(t => {
      const days = Math.floor((now.getTime() - new Date(t.dueDate!).getTime()) / 86400000);
      return { ...t, daysOverdue: days };
    }).sort((a, b) => b.daysOverdue - a.daysOverdue);

    const worst = overdueByDays[0];
    const worstClient = worst.clientName || clientMap.get(worst.clientId || '') || '';
    const criticalCount = overdueByDays.filter(t => t.daysOverdue > 7).length;

    insights.push({
      id: 'overdue-tasks',
      icon: '🔴',
      title: `${overdueTasks.length} משימות בפיגור${criticalCount > 0 ? ` (${criticalCount} קריטיות)` : ''}`,
      description: worstClient
        ? `המשימה הכי מאוחרת: "${worst.title || 'ללא שם'}" של ${worstClient} — ${worst.daysOverdue} ימים באיחור. תעדף וחלק מחדש.`
        : `${overdueByDays[0].daysOverdue} ימים באיחור הכי ארוך. תעדף ועדכן דדליינים.`,
      priority: criticalCount > 0 ? 'high' : 'medium',
      category: 'hot',
      actionText: 'טפל במשימות',
      actionHref: '/tasks',
    });
  }

  // ── HOT: Tasks stuck in review — name the specific tasks ──
  const stuckInReview = safeTasks.filter(t => t.status === 'under_review');
  if (stuckInReview.length > 0) {
    const names = stuckInReview.slice(0, 2).map(t => t.title || 'משימה').join(', ');
    insights.push({
      id: 'stuck-review',
      icon: '⏸️',
      title: `${stuckInReview.length} משימות ממתינות לביקורת`,
      description: `"${names}"${stuckInReview.length > 2 ? ` ועוד ${stuckInReview.length - 2}` : ''} — כל יום עיכוב באישור מעכב את הפרויקט כולו.`,
      priority: 'high',
      category: 'hot',
      actionText: 'אשר עכשיו',
      actionHref: '/tasks',
    });
  }

  // ── WARNING: Overdue payments — name the clients ──
  const overduePayments = safePayments.filter(p =>
    (p.status === 'overdue') ||
    (p.status === 'pending' && p.dueDate && p.dueDate < today)
  );
  if (overduePayments.length > 0) {
    const total = overduePayments.reduce((s, p) => s + (p.amount || 0), 0);
    const topDebtors = overduePayments
      .filter(p => p.clientName)
      .sort((a, b) => (b.amount || 0) - (a.amount || 0))
      .slice(0, 2)
      .map(p => p.clientName);
    const debtorText = topDebtors.length > 0 ? ` הלקוחות: ${topDebtors.join(', ')}.` : '';

    insights.push({
      id: 'overdue-payments',
      icon: '💰',
      title: `₪${total.toLocaleString()} בפיגור גביה`,
      description: `${overduePayments.length} תשלומים פתוחים.${debtorText} כל יום עיכוב פוגע בתזרים.`,
      priority: 'high',
      category: 'warning',
      actionText: 'שלח תזכורת גביה',
      actionHref: '/accounting',
    });
  }

  // ── ACTION: Pending approvals — with urgency context ──
  const pendingApprovals = safeApprovals.filter(a => a.status === 'pending_approval');
  if (pendingApprovals.length > 0) {
    const oldestApproval = pendingApprovals.sort((a, b) => new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime())[0];
    const daysPending = Math.floor((now.getTime() - new Date(oldestApproval.updatedAt).getTime()) / 86400000);
    const clientNames = [...new Set(pendingApprovals.map(a => a.clientName).filter(Boolean))].slice(0, 2);

    insights.push({
      id: 'pending-approvals',
      icon: '✋',
      title: `${pendingApprovals.length} אישורים ממתינים${daysPending > 3 ? ` (${daysPending} ימים!)` : ''}`,
      description: clientNames.length > 0
        ? `ללקוחות: ${clientNames.join(', ')}. עיכוב באישורים גורם לפיגור בפרסום ועצירת עבודה.`
        : `הישן ביותר ממתין ${daysPending} ימים. אשר או דחה כדי לשמור על קצב.`,
      priority: daysPending > 5 ? 'high' : 'medium',
      category: 'action',
      actionText: 'טפל באישורים',
      actionHref: '/approvals',
    });
  }

  // ── WARNING: Clients without content plan — name them ──
  const missingGantt = activeClients.filter(c =>
    (!c.monthlyGanttStatus || c.monthlyGanttStatus === 'none' || c.monthlyGanttStatus === 'draft')
  );
  if (missingGantt.length > 0) {
    const pct = Math.round((missingGantt.length / activeClients.length) * 100);
    insights.push({
      id: 'missing-gantt',
      icon: '📅',
      title: `${missingGantt.length} לקוחות ללא תוכנית חודשית (${pct}%)`,
      description: `${missingGantt.slice(0, 3).map(c => c.name).join(', ')}${missingGantt.length > 3 ? ` ועוד ${missingGantt.length - 3}` : ''} — בלי תוכנית אין שליטה על הפרסום.`,
      priority: pct > 50 ? 'high' : 'medium',
      category: 'warning',
      actionText: 'צור תוכניות',
      actionHref: '/clients',
    });
  }

  // ── OPPORTUNITY: Gantt-to-publish gap ──
  const monthlyPosts = safeSocialPosts.filter(p => p.createdAt && new Date(p.createdAt) >= monthStart);
  const clientsWithGantt = activeClients.filter(c => c.monthlyGanttStatus === 'approved' || c.monthlyGanttStatus === 'client_approved');
  if (clientsWithGantt.length > 0) {
    const lowPublish = clientsWithGantt.filter(c => {
      const posts = monthlyPosts.filter(p => p.clientId === c.id);
      return posts.length < 2;
    });
    if (lowPublish.length > 0) {
      insights.push({
        id: 'gantt-publish-gap',
        icon: '📊',
        title: `פער בין תכנון לפרסום בפועל`,
        description: `${lowPublish.length} לקוחות עם תוכנית מאושרת אך מעט פרסומים בפועל: ${lowPublish.slice(0, 2).map(c => c.name).join(', ')}. ודא שהתוכן יוצא לפועל.`,
        priority: 'medium',
        category: 'action',
        actionText: 'בדוק סטטוס',
        actionHref: '/clients',
      });
    }
  }

  // ── OPPORTUNITY: Low social activity — specific numbers ──
  const lowActivity = activeClients
    .filter(c => c.clientType !== 'podcast' && c.clientType !== 'hosting')
    .map(c => ({ ...c, postCount: monthlyPosts.filter(p => p.clientId === c.id).length }))
    .filter(c => c.postCount < 2);
  if (lowActivity.length > 0 && lowActivity.length !== missingGantt.length) {
    const bestClient = activeClients
      .map(c => ({ ...c, postCount: monthlyPosts.filter(p => p.clientId === c.id).length }))
      .sort((a, b) => b.postCount - a.postCount)[0];
    insights.push({
      id: 'low-social',
      icon: '📱',
      title: `${lowActivity.length} לקוחות עם פחות מ-2 פוסטים החודש`,
      description: bestClient && bestClient.postCount > 3
        ? `לעומת ${bestClient.name} עם ${bestClient.postCount} פוסטים. הזדמנות להגביר פעילות ללקוחות השקטים.`
        : `הגביר תוכן ללקוחות: ${lowActivity.slice(0, 3).map(c => c.name).join(', ')}.`,
      priority: 'low',
      category: 'opportunity',
      actionText: 'תכנן תוכן',
      actionHref: '/clients',
    });
  }

  // ── OPPORTUNITY: Campaign needs attention ──
  const activeCampaigns = safeCampaigns.filter(c => c.status === 'active');
  if (activeCampaigns.length >= 3) {
    insights.push({
      id: 'campaign-review',
      icon: '🎯',
      title: `${activeCampaigns.length} קמפיינים פעילים — זמן לאופטימיזציה`,
      description: `בדוק ביצועים של כל קמפיין, העבר תקציב למודעות שעובדות, ועצור מה שלא מביא תוצאות.`,
      priority: 'medium',
      category: 'opportunity',
      actionText: 'נתח קמפיינים',
      actionHref: '/campaigns',
    });
  } else if (activeCampaigns.length > 0 && activeCampaigns.length < 3) {
    insights.push({
      id: 'campaign-status',
      icon: '📣',
      title: `${activeCampaigns.length} קמפיין${activeCampaigns.length > 1 ? 'ים' : ''} פעיל${activeCampaigns.length > 1 ? 'ים' : ''}`,
      description: `ודא שהקמפיינים מניבים תוצאות ושקול להרחיב את הפעילות ללקוחות נוספים.`,
      priority: 'low',
      category: 'opportunity',
      actionText: 'צפה בקמפיינים',
      actionHref: '/campaigns',
    });
  }

  // ── OPPORTUNITY: Revenue momentum ──
  const thisMonthPaid = safePayments.filter(p => p.status === 'paid' && p.paidAt && new Date(p.paidAt) >= monthStart);
  if (thisMonthPaid.length > 0) {
    const thisMonthRevenue = thisMonthPaid.reduce((s, p) => s + (p.amount || 0), 0);
    const dayOfMonth = now.getDate();
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const projectedRevenue = Math.round(thisMonthRevenue * (daysInMonth / dayOfMonth));

    if (projectedRevenue > thisMonthRevenue * 1.2) {
      insights.push({
        id: 'revenue-projection',
        icon: '📈',
        title: `צפי הכנסה חודשית: ₪${projectedRevenue.toLocaleString()}`,
        description: `עד כה ₪${thisMonthRevenue.toLocaleString()} מ-${thisMonthPaid.length} תשלומים. קצב טוב — המשך לגבות כדי לעמוד ביעד.`,
        priority: 'low',
        category: 'opportunity',
        actionText: 'צפה בתשלומים',
        actionHref: '/accounting',
      });
    }
  }

  return insights.sort((a, b) => {
    const prio = { high: 0, medium: 1, low: 2 };
    return (prio[a.priority] ?? 9) - (prio[b.priority] ?? 9);
  });
}

/** Render grouped insight cards */
export function AIInsightsPanel({ insights, compact }: InsightPanelProps) {
  const grouped = useMemo(() => {
    const groups: Record<string, AIInsight[]> = {};
    insights.forEach(i => {
      if (!groups[i.category]) groups[i.category] = [];
      groups[i.category].push(i);
    });
    return groups;
  }, [insights]);

  if (insights.length === 0) return null;

  if (compact) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        {insights.slice(0, 4).map(insight => (
          <div key={insight.id} className="insight-card" data-priority={insight.priority}>
            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
              <span style={{ fontSize: '1.25rem', lineHeight: 1 }}>{insight.icon}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--foreground)', marginBottom: '0.25rem' }}>
                  {insight.title}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--foreground-muted)', lineHeight: 1.5 }}>
                  {insight.description}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {(['hot', 'action', 'warning', 'opportunity'] as const).map(cat => {
        const items = grouped[cat];
        if (!items || items.length === 0) return null;
        return (
          <div key={cat}>
            <div style={{
              fontSize: '0.8125rem',
              fontWeight: 700,
              color: CATEGORY_COLORS[cat],
              marginBottom: '0.75rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
            }}>
              <div style={{
                width: 8, height: 8, borderRadius: '50%',
                background: CATEGORY_COLORS[cat],
                boxShadow: `0 0 8px ${CATEGORY_COLORS[cat]}60`,
              }} />
              {CATEGORY_LABELS[cat]}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '0.75rem' }}>
              {items.map(insight => (
                <div key={insight.id} className="insight-card" data-priority={insight.priority} style={{ display: 'flex', flexDirection: 'column' }}>
                  <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start', flex: 1 }}>
                    <span style={{ fontSize: '1.5rem', lineHeight: 1 }}>{insight.icon}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--foreground)', marginBottom: '0.35rem' }}>
                        {insight.title}
                      </div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--foreground-muted)', lineHeight: 1.6 }}>
                        {insight.description}
                      </div>
                    </div>
                  </div>
                  {insight.actionText && insight.actionHref && (
                    <Link href={insight.actionHref} style={{ display: 'inline-block', marginTop: '0.75rem', fontSize: '0.75rem', fontWeight: 700, color: CATEGORY_COLORS[insight.category] || 'var(--accent)', textDecoration: 'none' }}>
                      {insight.actionText} ←
                    </Link>
                  )}
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
