'use client';

import { useMemo } from 'react';

export interface AIInsight {
  id: string;
  icon: string;
  title: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
  category: 'hot' | 'action' | 'warning' | 'opportunity';
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

/** Generate smart insights from raw data */
export function generateInsights(data: {
  tasks: Array<{ id: string; status?: string; title?: string; clientId?: string; dueDate?: string; assigneeIds?: string[] }>;
  clients: Array<{ id: string; name: string; status?: string; clientType?: string; monthlyGanttStatus?: string }>;
  approvals: Array<{ id: string; status: string; clientName?: string; title?: string; updatedAt: string }>;
  payments: Array<{ id: string; status: string; amount: number; dueDate?: string; clientName?: string }>;
  campaigns: Array<{ id: string; status: string; clientId?: string; campaignName?: string }>;
  socialPosts: Array<{ id: string; clientId?: string; createdAt?: string }>;
}): AIInsight[] {
  const insights: AIInsight[] = [];
  const now = new Date();

  // Safe fallbacks — never let undefined reach .filter/.map/.reduce
  const safeTasks = data.tasks ?? [];
  const safeClients = data.clients ?? [];
  const safeApprovals = data.approvals ?? [];
  const safePayments = data.payments ?? [];
  const safeCampaigns = data.campaigns ?? [];
  const safeSocialPosts = data.socialPosts ?? [];

  // ── HOT: Tasks stuck in review > 3 days ──
  const stuckInReview = safeTasks.filter(t => {
    return t.status === 'under_review';
  });
  if (stuckInReview.length > 0) {
    insights.push({
      id: 'stuck-review',
      icon: '🔴',
      title: `${stuckInReview.length} משימות תקועות בביקורת`,
      description: 'משימות שממתינות לאישור. שחרר אותן כדי לשמור על הזרימה.',
      priority: 'high',
      category: 'hot',
    });
  }

  // ── WARNING: Overdue payments ──
  const overduePayments = safePayments.filter(p =>
    (p.status === 'overdue') ||
    (p.status === 'pending' && p.dueDate && new Date(p.dueDate) < now)
  );
  if (overduePayments.length > 0) {
    const total = overduePayments.reduce((s, p) => s + (p.amount || 0), 0);
    insights.push({
      id: 'overdue-payments',
      icon: '⚠️',
      title: `${overduePayments.length} תשלומים בפיגור`,
      description: `סה"כ ₪${total.toLocaleString()} בפיגור. צור קשר עם הלקוחות לגבייה.`,
      priority: 'high',
      category: 'warning',
    });
  }

  // ── ACTION: Pending approvals ──
  const pendingApprovals = safeApprovals.filter(a => a.status === 'pending_approval');
  if (pendingApprovals.length > 0) {
    insights.push({
      id: 'pending-approvals',
      icon: '📋',
      title: `${pendingApprovals.length} אישורים ממתינים`,
      description: 'אשר או דחה כדי לא לעכב פרויקטים.',
      priority: 'medium',
      category: 'action',
    });
  }

  // ── WARNING: Clients without gantt plan ──
  const missingGantt = safeClients.filter(c =>
    c.status === 'active' &&
    (!c.monthlyGanttStatus || c.monthlyGanttStatus === 'none' || c.monthlyGanttStatus === 'draft')
  );
  if (missingGantt.length > 0) {
    insights.push({
      id: 'missing-gantt',
      icon: '📊',
      title: `${missingGantt.length} לקוחות ללא תוכנית חודשית`,
      description: `${missingGantt.slice(0, 3).map(c => c.name).join(', ')}${missingGantt.length > 3 ? ' ועוד' : ''} — עדכן את הגנט.`,
      priority: 'medium',
      category: 'warning',
    });
  }

  // ── OPPORTUNITY: Clients with low social activity ──
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const lowActivity = safeClients
    .filter(c => c.status === 'active' && c.clientType !== 'podcast' && c.clientType !== 'hosting')
    .map(c => ({
      ...c,
      postCount: safeSocialPosts.filter(p => p.clientId === c.id && p.createdAt && new Date(p.createdAt) >= monthStart).length,
    }))
    .filter(c => c.postCount < 2);
  if (lowActivity.length > 0) {
    insights.push({
      id: 'low-social',
      icon: '📱',
      title: `${lowActivity.length} לקוחות עם פעילות חברתית נמוכה`,
      description: 'פחות מ-2 פוסטים החודש — הזדמנות להציע תוכן נוסף.',
      priority: 'low',
      category: 'opportunity',
    });
  }

  // ── OPPORTUNITY: Active campaigns ──
  const activeCampaigns = safeCampaigns.filter(c => c.status === 'active');
  if (activeCampaigns.length > 0) {
    insights.push({
      id: 'active-campaigns',
      icon: '🚀',
      title: `${activeCampaigns.length} קמפיינים פעילים`,
      description: 'בדוק ביצועים ואופטימיזציה.',
      priority: 'low',
      category: 'opportunity',
    });
  }

  // ── HOT: Overdue tasks ──
  const overdueTasks = safeTasks.filter(t =>
    t.dueDate && new Date(t.dueDate) < now && t.status !== 'completed' && t.status !== 'approved'
  );
  if (overdueTasks.length > 0) {
    insights.push({
      id: 'overdue-tasks',
      icon: '⏰',
      title: `${overdueTasks.length} משימות בפיגור`,
      description: 'עדכן עדיפויות או חלק מחדש כדי לעמוד בלוח הזמנים.',
      priority: 'high',
      category: 'hot',
    });
  }

  return insights.sort((a, b) => {
    const prio = { high: 0, medium: 1, low: 2 };
    return prio[a.priority] - prio[b.priority];
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
                <div key={insight.id} className="insight-card" data-priority={insight.priority}>
                  <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
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
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
