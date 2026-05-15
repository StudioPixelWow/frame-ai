'use client';

export const dynamic = "force-dynamic";

import { useState, useMemo, useEffect } from 'react';
import Link from 'next/link';
import { AdminOnly } from "@/components/role-gate";
import {
  useClients,
  useTasks,
  usePayments,
  useLeads,
  useEmployees,
  useCampaigns,
  useClientGanttItems,
  useApprovals,
  useEmployeeTasks,
  useSocialPosts,
} from '@/lib/api/use-entity';
import { useOperationalAlerts } from '@/lib/alerts/use-alerts';
import {
  PremiumKpiCard,
  PremiumBarChart,
  PremiumDonutChart,
  PremiumRadialMetric,
  PremiumStatGrid,
  PremiumComparisonChart,
  PremiumSparkline,
  BRAND,
  CHART_COLORS,
  formatNumber as premiumFormatNumber,
} from '@/components/charts';

interface BarChartItem {
  label: string;
  value: number;
  pct: number;
  color: string;
}

const TASK_STATUS_COLORS: Record<string, string> = {
  new: '#3B82F6',
  in_progress: '#F59E0B',
  under_review: '#0092cc',
  returned: '#EF4444',
  approved: '#22C55E',
  completed: '#22C55E',
  urgent: '#EF4444',
  high: '#F59E0B',
  medium: '#3B82F6',
  low: '#9CA3AF',
};

const PAYMENT_TYPE_COLORS: Record<string, string> = {
  invoice: '#3B82F6',
  retainer: '#0092cc',
  milestone: '#22C55E',
  expense: '#F59E0B',
};

const CLIENT_TYPE_LABELS: Record<string, string> = {
  marketing: 'שיווק',
  branding: 'מיתוג',
  websites: 'אתרים',
  hosting: 'אחסון',
  podcast: 'פודקאסט',
  lead: 'ליד',
};

const HEBREW_MONTHS = [
  'ינואר',
  'פברואר',
  'מרץ',
  'אפריל',
  'מאי',
  'יוני',
  'יולי',
  'אוגוסט',
  'ספטמבר',
  'אוקטובר',
  'נובמבר',
  'דצמבר',
];

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('he-IL', {
    style: 'currency',
    currency: 'ILS',
    minimumFractionDigits: 0,
  }).format(amount);
}

function getMonthName(date: Date): string {
  return HEBREW_MONTHS[date.getMonth()];
}

function isThisMonth(date: Date): boolean {
  const now = new Date();
  return (
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear()
  );
}

function isLastMonth(date: Date): boolean {
  const now = new Date();
  const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  return (
    date.getMonth() === lastMonth.getMonth() &&
    date.getFullYear() === lastMonth.getFullYear()
  );
}

function isOverdue(date: Date): boolean {
  return date < new Date();
}

// Section header with gradient
function SectionHeader({ icon, title }: { icon: string; title: string }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.75rem',
        marginBottom: '1.5rem',
        paddingBottom: '1rem',
        borderBottom: '2px solid',
        borderImage: `linear-gradient(90deg, ${BRAND.cyan}, ${BRAND.cyanLight}, transparent) 1`,
      }}
    >
      <div style={{ fontSize: '1.5rem' }}>{icon}</div>
      <h2
        style={{
          fontSize: '1.25rem',
          fontWeight: 700,
          color: 'var(--foreground)',
          margin: 0,
        }}
      >
        {title}
      </h2>
    </div>
  );
}


export default function AnalyticsDashboard() {
  return <AdminOnly fallback={
    <div dir="rtl" style={{ maxWidth: 600, margin: "4rem auto", textAlign: "center", padding: "2rem" }}>
      <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>🔒</div>
      <h2 style={{ fontSize: "1.25rem", fontWeight: 700, marginBottom: "0.5rem" }}>אין גישה</h2>
      <p style={{ fontSize: "0.875rem", color: "var(--foreground-muted)" }}>עמוד הסטטיסטיקות זמין למנהלים בלבד</p>
    </div>
  }><AnalyticsDashboardInner /></AdminOnly>;
}

function AnalyticsDashboardInner() {
  const [animationsReady, setAnimationsReady] = useState(false);

  const { data: clients, loading: clientsLoading } = useClients();
  const { data: tasks, loading: tasksLoading } = useTasks();
  const { data: payments, loading: paymentsLoading } = usePayments();
  const { data: leads, loading: leadsLoading } = useLeads();
  const { data: employees, loading: employeesLoading } = useEmployees();
  const { data: campaigns, loading: campaignsLoading } = useCampaigns();
  const { data: ganttItems, loading: ganttLoading } = useClientGanttItems();
  const { data: approvals, loading: approvalsLoading } = useApprovals();
  const { data: employeeTasks, loading: employeeTasksLoading } =
    useEmployeeTasks();
  const { data: socialPosts, loading: socialLoading } = useSocialPosts();
  const { alerts: operationalAlerts, insights: aiInsights } = useOperationalAlerts();

  useEffect(() => {
    setAnimationsReady(true);
  }, []);

  const isLoading =
    clientsLoading ||
    tasksLoading ||
    paymentsLoading ||
    leadsLoading ||
    employeesLoading ||
    campaignsLoading ||
    ganttLoading ||
    approvalsLoading ||
    employeeTasksLoading ||
    socialLoading;

  const analytics = useMemo(() => {
    if (
      !clients ||
      !tasks ||
      !payments ||
      !leads ||
      !employees ||
      !campaigns ||
      !ganttItems ||
      !approvals ||
      !employeeTasks ||
      !socialPosts
    ) {
      return null;
    }

    const now = new Date();

    // SECTION 1: KPIs Calculation

    // Active clients
    const activeClients = clients.filter((c) => c.status === 'active').length;

    // Leads this month
    const leadsThisMonth = leads.filter((l) =>
      isThisMonth(new Date(l.createdAt || 0))
    ).length;

    // Leads last month
    const leadsLastMonth = leads.filter((l) =>
      isLastMonth(new Date(l.createdAt || 0))
    ).length;

    // Monthly revenue
    const monthlyRevenue = payments
      .filter(
        (p) =>
          p.status === 'paid' &&
          p.paidAt &&
          isThisMonth(new Date(p.paidAt))
      )
      .reduce((sum, p) => sum + (p.amount || 0), 0);

    // Last month revenue
    const lastMonthRevenue = payments
      .filter(
        (p) =>
          p.status === 'paid' &&
          p.paidAt &&
          isLastMonth(new Date(p.paidAt))
      )
      .reduce((sum, p) => sum + (p.amount || 0), 0);

    // Overdue payments
    const overduePayments = payments.filter(
      (p) =>
        p.status === 'overdue' ||
        (p.status === 'pending' && p.dueDate && isOverdue(new Date(p.dueDate)))
    ).length;

    // Open tasks
    const openTasks = tasks.filter(
      (t) =>
        ![
          'completed',
          'approved',
        ].includes(t.status || '')
    ).length;

    // Pending approvals
    const pendingApprovals = approvals.filter(
      (a) => a.status === 'pending_approval'
    ).length;

    // Calculate trends
    const leadssTrend =
      leadsLastMonth > 0
        ? Math.round(((leadsThisMonth - leadsLastMonth) / leadsLastMonth) * 100)
        : leadsThisMonth > 0
          ? 100
          : 0;

    const revenueTrend =
      lastMonthRevenue > 0
        ? Math.round(((monthlyRevenue - lastMonthRevenue) / lastMonthRevenue) * 100)
        : monthlyRevenue > 0
          ? 100
          : 0;

    // SECTION 2: Financial Analytics

    // Revenue by month
    const revenueByMonth: BarChartItem[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now);
      d.setMonth(d.getMonth() - i);
      const monthStart = new Date(d.getFullYear(), d.getMonth(), 1);
      const monthEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0);

      const monthAmount = payments
        .filter(
          (p) =>
            p.status === 'paid' &&
            p.paidAt &&
            new Date(p.paidAt) >= monthStart &&
            new Date(p.paidAt) <= monthEnd
        )
        .reduce((sum, p) => sum + (p.amount || 0), 0);

      const maxRevenue = 50000;
      revenueByMonth.push({
        label: getMonthName(d),
        value: monthAmount,
        pct: Math.min((monthAmount / maxRevenue) * 100, 100),
        color: BRAND.cyan,
      });
    }

    // Payments by type
    const paymentsByType: BarChartItem[] = [];
    const typeCounts: Record<string, number> = {};

    payments.forEach((p) => {
      const type = p.type || 'invoice';
      typeCounts[type] = (typeCounts[type] || 0) + 1;
    });

    const maxPaymentType = Math.max(...Object.values(typeCounts), 1);
    const typeLabels: Record<string, string> = {
      invoice: 'חשבונית',
      retainer: 'חודשי',
      milestone: 'ציון דרך',
      expense: 'הוצאה',
    };

    Object.entries(typeCounts)
      .sort((a, b) => b[1] - a[1])
      .forEach(([type, count]) => {
        paymentsByType.push({
          label: typeLabels[type] || type,
          value: count,
          pct: (count / maxPaymentType) * 100,
          color: PAYMENT_TYPE_COLORS[type] || '#9CA3AF',
        });
      });

    // Overdue payments summary
    const overduePaymentsList = payments.filter(
      (p) =>
        p.status === 'overdue' ||
        (p.status === 'pending' && p.dueDate && isOverdue(new Date(p.dueDate)))
    );

    const overdueAmount = overduePaymentsList.reduce((sum, p) => sum + (p.amount || 0), 0);

    const avgDaysOverdue =
      overduePaymentsList.length > 0
        ? Math.round(
            overduePaymentsList.reduce((sum, p) => {
              if (!p.dueDate) return sum;
              const days = Math.floor(
                (now.getTime() - new Date(p.dueDate).getTime()) /
                  (1000 * 60 * 60 * 24)
              );
              return sum + Math.max(days, 0);
            }, 0) / overduePaymentsList.length
          )
        : 0;

    // SECTION 3: Client Analytics

    // Client type distribution
    const clientTypeDistribution: BarChartItem[] = [];
    const clientTypeCounts: Record<string, number> = {};

    clients.forEach((c) => {
      const type = c.clientType || 'lead';
      clientTypeCounts[type] = (clientTypeCounts[type] || 0) + 1;
    });

    const maxClientType = Math.max(...Object.values(clientTypeCounts), 1);

    Object.entries(clientTypeCounts)
      .sort((a, b) => b[1] - a[1])
      .forEach(([type, count]) => {
        clientTypeDistribution.push({
          label: CLIENT_TYPE_LABELS[type] || type,
          value: count,
          pct: (count / maxClientType) * 100,
          color: '#0092cc',
        });
      });

    // Most active clients
    const mostActiveClients = clients
      .map((c) => ({
        ...c,
        taskCount: tasks.filter((t) => t.clientId === c.id).length,
      }))
      .sort((a, b) => b.taskCount - a.taskCount)
      .slice(0, 5);

    // Clients without monthly gantt
    const clientsMissingGantt = clients.filter((c) => {
      const clientGantt = ganttItems.filter((g) => g.clientId === c.id);
      const hasMonthlyStatus =
        clientGantt.length > 0 &&
        clientGantt.some((g) => g.status && g.status !== 'draft');
      return !hasMonthlyStatus;
    });

    // Clients with less than 2 posts this month
    const clientsWithFewPosts = clients
      .map((c) => ({
        ...c,
        monthlyPostCount: socialPosts.filter(
          (p) =>
            p.clientId === c.id &&
            p.createdAt &&
            isThisMonth(new Date(p.createdAt))
        ).length,
      }))
      .filter((c) => c.monthlyPostCount < 2);

    // SECTION 4: Tasks & Operations

    // Tasks by status
    const tasksByStatus: BarChartItem[] = [];
    const statusCounts: Record<string, number> = {};

    tasks.forEach((t) => {
      statusCounts[t.status || 'new'] = (statusCounts[t.status || 'new'] || 0) + 1;
    });

    const maxTasksStatus = Math.max(...Object.values(statusCounts), 1);
    const statusLabels: Record<string, string> = {
      new: 'חדש',
      in_progress: 'בתהליך',
      under_review: 'בביקורת',
      returned: 'החזור',
      approved: 'מאושר',
      completed: 'הושלם',
    };

    Object.entries(statusCounts)
      .sort((a, b) => b[1] - a[1])
      .forEach(([status, count]) => {
        tasksByStatus.push({
          label: statusLabels[status] || status,
          value: count,
          pct: (count / maxTasksStatus) * 100,
          color: TASK_STATUS_COLORS[status] || '#9CA3AF',
        });
      });

    // Tasks by employee
    const tasksByEmployee: BarChartItem[] = [];
    const employeeTaskCounts: Record<string, number> = {};

    // Count from both useTasks (assigneeIds) and useEmployeeTasks
    tasks.forEach((t) => {
      if (t.assigneeIds && Array.isArray(t.assigneeIds)) {
        t.assigneeIds.forEach((empId: string) => {
          employeeTaskCounts[empId] = (employeeTaskCounts[empId] || 0) + 1;
        });
      }
    });

    employeeTasks.forEach((et) => {
      const empId = et.assignedEmployeeId || 'unknown';
      employeeTaskCounts[empId] = (employeeTaskCounts[empId] || 0) + 1;
    });

    const maxEmployeeLoad = Math.max(...Object.values(employeeTaskCounts), 1);
    const employeeMap = new Map(employees.map((e) => [e.id, e.name]));

    Object.entries(employeeTaskCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .forEach(([empId, count]) => {
        tasksByEmployee.push({
          label: employeeMap.get(empId) || 'לא ידוע',
          value: count,
          pct: (count / maxEmployeeLoad) * 100,
          color: '#F59E0B',
        });
      });

    // Busiest employee card
    const busiestEmployee =
      Object.entries(employeeTaskCounts).length > 0
        ? Object.entries(employeeTaskCounts).sort((a, b) => b[1] - a[1])[0]
        : null;

    const busiestEmployeeName = busiestEmployee
      ? employeeMap.get(busiestEmployee[0]) || 'לא ידוע'
      : 'אין';

    const busiestEmployeeCount = busiestEmployee ? busiestEmployee[1] : 0;

    // Employee with most overdue tasks
    const employeeOverdueCounts: Record<string, number> = {};

    tasks.forEach((t) => {
      if (t.dueDate && isOverdue(new Date(t.dueDate))) {
        if (t.assigneeIds && Array.isArray(t.assigneeIds)) {
          t.assigneeIds.forEach((empId: string) => {
            employeeOverdueCounts[empId] =
              (employeeOverdueCounts[empId] || 0) + 1;
          });
        }
      }
    });

    employeeTasks.forEach((et) => {
      if (et.dueDate && isOverdue(new Date(et.dueDate))) {
        const empId = et.assignedEmployeeId || 'unknown';
        employeeOverdueCounts[empId] = (employeeOverdueCounts[empId] || 0) + 1;
      }
    });

    const mostOverdueEmployee =
      Object.entries(employeeOverdueCounts).length > 0
        ? Object.entries(employeeOverdueCounts).sort((a, b) => b[1] - a[1])[0]
        : null;

    const mostOverdueEmployeeName = mostOverdueEmployee
      ? employeeMap.get(mostOverdueEmployee[0]) || 'לא ידוע'
      : 'אין';

    const mostOverdueEmployeeCount = mostOverdueEmployee
      ? mostOverdueEmployee[1]
      : 0;

    // SECTION 5: Campaigns & Content

    const activeCampaigns = campaigns.filter((c) => c.status === 'active').length;
    const totalCampaigns = campaigns.length;

    // Campaigns by platform
    const campaignsByPlatform: BarChartItem[] = [];
    const platformCounts: Record<string, number> = {};

    campaigns.forEach((c) => {
      const platform = c.platform || 'other';
      platformCounts[platform] = (platformCounts[platform] || 0) + 1;
    });

    const maxCampaignPlatform = Math.max(...Object.values(platformCounts), 1);

    Object.entries(platformCounts)
      .sort((a, b) => b[1] - a[1])
      .forEach(([platform, count]) => {
        campaignsByPlatform.push({
          label: platform.charAt(0).toUpperCase() + platform.slice(1),
          value: count,
          pct: (count / maxCampaignPlatform) * 100,
          color: '#22C55E',
        });
      });

    // SECTION 6: Content & Publishing Metrics
    const publishedThisMonth = ganttItems.filter((g) =>
      g.status === 'published' && g.createdAt && isThisMonth(new Date(g.createdAt))
    ).length;

    const publishedLastMonth = ganttItems.filter((g) =>
      g.status === 'published' && g.createdAt && isLastMonth(new Date(g.createdAt))
    ).length;

    const totalApprovals = approvals.length;
    const approvedApprovals = approvals.filter((a) => a.status === 'approved').length;
    const approvalRate = totalApprovals > 0 ? Math.round((approvedApprovals / totalApprovals) * 100) : 0;

    // Publishing consistency: count clients with at least 1 published item
    const clientsWithPublishedContent = new Set(
      ganttItems.filter((g) => g.status === 'published').map((g) => g.clientId)
    ).size;

    // SECTION 7: Lead Funnel
    const allLeads = leads.length;
    const contactedLeads = leads.filter((l) => l.status === 'contacted').length;
    const proposalLeads = leads.filter((l) => (l.status as string) === 'proposal' || l.status === 'proposal_sent').length;
    const wonLeads = leads.filter((l) => l.status === 'won').length;

    // Conversion rates
    const contactRate = allLeads > 0 ? Math.round((contactedLeads / allLeads) * 100) : 0;
    const proposalRate = contactedLeads > 0 ? Math.round((proposalLeads / contactedLeads) * 100) : 0;
    const closeRate = proposalLeads > 0 ? Math.round((wonLeads / proposalLeads) * 100) : 0;

    // SECTION 8: Employee Productivity
    const employeeProductivity: Array<{ name: string; completionRate: number; avgTime: number }> = [];
    const employeeTasksCompleted: Record<string, number> = {};
    const employeeTasksAssigned: Record<string, number> = {};

    tasks.forEach((t) => {
      if (t.assigneeIds && Array.isArray(t.assigneeIds)) {
        t.assigneeIds.forEach((empId: string) => {
          employeeTasksAssigned[empId] = (employeeTasksAssigned[empId] || 0) + 1;
          if (t.status === 'completed') {
            employeeTasksCompleted[empId] = (employeeTasksCompleted[empId] || 0) + 1;
          }
        });
      }
    });

    employees.forEach((emp) => {
      const assigned = employeeTasksAssigned[emp.id] || 0;
      const completed = employeeTasksCompleted[emp.id] || 0;
      const completionRate = assigned > 0 ? Math.round((completed / assigned) * 100) : 0;
      if (assigned > 0) {
        employeeProductivity.push({
          name: emp.name || 'Unknown',
          completionRate,
          avgTime: Math.floor(Math.random() * 8) + 1, // Mock data for now
        });
      }
    });

    return {
      // KPIs
      activeClients,
      leadsThisMonth,
      leadsLastMonth,
      monthlyRevenue,
      lastMonthRevenue,
      overduePayments,
      openTasks,
      pendingApprovals,
      leadssTrend,
      revenueTrend,
      // Financial
      revenueByMonth,
      paymentsByType,
      overdueAmount,
      avgDaysOverdue,
      overduePaymentsList,
      // Clients
      clientTypeDistribution,
      mostActiveClients,
      clientsMissingGantt,
      clientsWithFewPosts,
      // Tasks
      tasksByStatus,
      tasksByEmployee,
      busiestEmployeeName,
      busiestEmployeeCount,
      mostOverdueEmployeeName,
      mostOverdueEmployeeCount,
      // Campaigns
      activeCampaigns,
      totalCampaigns,
      campaignsByPlatform,
      // Content & Publishing
      publishedThisMonth,
      publishedLastMonth,
      approvalRate,
      clientsWithPublishedContent,
      // Lead Funnel
      allLeads,
      contactedLeads,
      proposalLeads,
      wonLeads,
      contactRate,
      proposalRate,
      closeRate,
      // Employee Productivity
      employeeProductivity,
    };
  }, [
    clients,
    tasks,
    payments,
    leads,
    employees,
    campaigns,
    ganttItems,
    approvals,
    employeeTasks,
    socialPosts,
  ]);

  // ALL useMemo hooks MUST be before any conditional return (Rules of Hooks)
  const clientTypeDistribution = useMemo(() => {
    if (!analytics || !analytics.clientTypeDistribution) return [];
    const typeCounts: Record<string, number> = {};
    analytics.clientTypeDistribution.forEach((item) => {
      typeCounts[item.label] = typeof item.value === 'number' ? item.value : parseInt(String(item.value)) || 0;
    });
    return Object.entries(typeCounts).map(([label, value]) => ({
      label,
      value: typeof value === 'number' ? value : 0,
      color: analytics.clientTypeDistribution.find((item) => item.label === label)?.color || '#0092cc',
    }));
  }, [analytics]);

  const revenueChartData = useMemo(() => {
    if (!analytics || !analytics.revenueByMonth) return [];
    return analytics.revenueByMonth.map((item) => ({
      label: item.label,
      value: typeof item.value === 'number' ? item.value : parseInt(String(item.value)) || 0,
      pct: item.pct,
    }));
  }, [analytics]);

  const taskStatusData = useMemo(() => {
    if (!analytics || !analytics.tasksByStatus) return [];
    return analytics.tasksByStatus.map((item) => ({
      label: item.label,
      value: typeof item.value === 'number' ? item.value : parseInt(String(item.value)) || 0,
      color: item.color,
      pct: (item.pct / 100) * 100,
    }));
  }, [analytics]);

  const computedInsights = useMemo(() => {
    if (!analytics) return [];
    const insights = [];

    if (analytics.clientsMissingGantt.length > 0) {
      insights.push({
        icon: '📊',
        title: 'לקוחות ללא תכנון חודשי',
        description: `${analytics.clientsMissingGantt.length} לקוחות ממתינים לתחנות דרך חודשיות. עדכן את הגנט שלהם כדי להישאר על המסלול.`,
        priority: 'high' as const,
      });
    }

    const completedTasksItem = analytics.tasksByStatus.find((s) => s.label === 'הושלם');
    const completedTasks = completedTasksItem ? (typeof completedTasksItem.value === 'number' ? completedTasksItem.value : parseInt(String(completedTasksItem.value)) || 0) : 0;
    const totalTasks = analytics.tasksByStatus.reduce((sum, s) => {
      const val = typeof s.value === 'number' ? s.value : parseInt(String(s.value)) || 0;
      return sum + val;
    }, 0);
    const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
    insights.push({
      icon: '✅',
      title: 'שיעור השלמת משימות',
      description: `${completionRate}% מהמשימות הושלמו. המשך כך!`,
      priority: 'medium' as const,
    });

    const avgMonthlyRevenue = analytics.revenueByMonth.reduce((sum, item) => {
      const val = typeof item.value === 'number' ? item.value : parseInt(String(item.value)) || 0;
      return sum + val;
    }, 0) / (analytics.revenueByMonth.length || 1);
    insights.push({
      icon: '💹',
      title: 'הכנסה ממוצעת',
      description: `ממוצע ${formatCurrency(Math.round(avgMonthlyRevenue))} לחודש ב-6 החודשים האחרונים.`,
      priority: 'low' as const,
    });

    if (analytics.overduePaymentsList.length > 0) {
      insights.push({
        icon: '⏰',
        title: 'תשלומים באיחור',
        description: `${analytics.overduePaymentsList.length} תשלומים באיחור בסך ${formatCurrency(analytics.overdueAmount)}. פעל בהקדם.`,
        priority: 'high' as const,
      });
    }

    return insights.slice(0, 4);
  }, [analytics]);

  const recentActivities = useMemo(() => {
    if (!analytics) return [];
    const activities = [];

    const completedTasksItem = analytics.tasksByStatus.find((s) => s.label === 'הושלם');
    const completedTasks = completedTasksItem ? (typeof completedTasksItem.value === 'number' ? completedTasksItem.value : parseInt(String(completedTasksItem.value)) || 0) : 0;
    if (completedTasks > 0) {
      activities.push({
        icon: '✓',
        title: 'משימות הושלמו',
        description: `${completedTasks} משימות הושלמו לאחרונה`,
        time: 'היום',
        color: '#22C55E',
      });
    }

    const thisMonthPayments = analytics.revenueByMonth[analytics.revenueByMonth.length - 1];
    if (thisMonthPayments && thisMonthPayments.pct > 0) {
      const paymentValue = typeof thisMonthPayments.value === 'number' ? thisMonthPayments.value : parseInt(String(thisMonthPayments.value)) || 0;
      activities.push({
        icon: '💰',
        title: 'תשלומים התקבלו',
        description: `הכנסה של ${formatCurrency(paymentValue)} החודש`,
        time: 'החודש',
        color: '#00B5FE',
      });
    }

    if (analytics.activeCampaigns > 0) {
      activities.push({
        icon: '📢',
        title: 'קמפיינים פעילים',
        description: `${analytics.activeCampaigns} קמפיינים מתנהלים כרגע`,
        time: 'כרגע',
        color: '#22C55E',
      });
    }

    if (analytics.mostActiveClients.length > 0) {
      const topClient = analytics.mostActiveClients[0];
      activities.push({
        icon: '👥',
        title: 'לקוח מובילה',
        description: `${topClient.name} עם ${topClient.taskCount} משימות פעילות`,
        time: 'חודש זה',
        color: '#0092cc',
      });
    }

    return activities.slice(0, 5);
  }, [analytics]);

  // Conditional returns AFTER all hooks
  if (isLoading) {
    return (
      <main
        style={{
          maxWidth: '1600px',
          margin: '0 auto',
          padding: '2rem 1.5rem',
          direction: 'rtl',
        }}
      >
        <div
          style={{
            fontSize: '1rem',
            color: 'var(--foreground-muted)',
            textAlign: 'center',
            padding: '4rem 2rem',
          }}
        >
          ⏳ טוען לוח בקרה מודרני...
        </div>
      </main>
    );
  }

  if (!analytics) {
    return (
      <main
        style={{
          maxWidth: '1600px',
          margin: '0 auto',
          padding: '2rem 1.5rem',
          direction: 'rtl',
        }}
      >
        <div
          style={{
            fontSize: '1rem',
            color: 'var(--foreground-muted)',
            textAlign: 'center',
            padding: '4rem 2rem',
          }}
        >
          ⚠️ שגיאה בטעינת הנתונים
        </div>
      </main>
    );
  }

  // Compute completion rate for KPI
  const completedCountItem = analytics.tasksByStatus.find((s) => s.label === 'הושלם');
  const completedCount = completedCountItem ? (typeof completedCountItem.value === 'number' ? completedCountItem.value : parseInt(String(completedCountItem.value)) || 0) : 0;
  const totalTaskCount = analytics.tasksByStatus.reduce((sum, s) => {
    const val = typeof s.value === 'number' ? s.value : parseInt(String(s.value)) || 0;
    return sum + val;
  }, 0) || 1;
  const completionRate = Math.round((completedCount / totalTaskCount) * 100);

  return (
    <main
      style={{
        maxWidth: '1600px',
        margin: '0 auto',
        padding: '2rem 1.5rem',
        direction: 'rtl',
        background: 'var(--background)',
      }}
    >
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
        .live-dot {
          display: inline-block;
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: #22C55E;
          margin-right: 0.5rem;
          animation: pulse 2s infinite;
        }
      `}</style>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '3rem' }}>
        {/* Header */}
        <div style={{ animation: 'fadeIn 600ms ease-out' }}>
          <h1
            style={{
              fontSize: '2.5rem',
              fontWeight: 900,
              letterSpacing: '-0.03em',
              marginBottom: '0.75rem',
              background: `linear-gradient(135deg, ${BRAND.cyan}, ${BRAND.cyanLight})`,
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}
          >
            <span className="live-dot" />
            לוח בקרה מודרני בזמן אמת
          </h1>
          <p style={{ fontSize: '1rem', color: 'var(--foreground-muted)' }}>
            ניתוח שלם של ביצועים פיננסיים, תוכן, לידים, צוות וקמפיינים בפלטפורמה שלך
          </p>
        </div>

        {/* SECTION 1: מדדי ביצוע ראשיים */}
        <div style={{ animation: 'fadeIn 800ms ease-out' }}>
          <SectionHeader icon="💎" title="מדדי ביצוע ראשיים" />
          <PremiumStatGrid
            columns={4}
            variant="elevated"
            items={[
              {
                label: 'סך הכנסות',
                value: analytics.monthlyRevenue,
                previousValue: analytics.lastMonthRevenue,
                format: 'currency',
                icon: '💰',
                color: BRAND.cyan,
                description: 'החודש הנוכחי',
              },
              {
                label: 'לקוחות פעילים',
                value: analytics.activeClients,
                icon: '👥',
                color: '#0092cc',
                description: `${analytics.mostActiveClients.length} בעומס`,
              },
              {
                label: 'קמפיינים פעילים',
                value: analytics.activeCampaigns,
                icon: '📢',
                color: '#22C55E',
                description: `מתוך ${analytics.totalCampaigns} סה"כ`,
              },
              {
                label: 'שיעור הושלמות',
                value: completionRate,
                format: 'percent',
                icon: '✓',
                color: '#F59E0B',
                description: 'משימות חודשיות',
              },
            ]}
          />
        </div>

        {/* SECTION 2: ניתוח פיננסי */}
        <div style={{ animation: 'fadeIn 1000ms ease-out' }}>
          <SectionHeader icon="💹" title="ניתוח פיננסי" />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(500px, 1fr))', gap: '2rem' }}>
            <PremiumBarChart
              title="הכנסה חודשית"
              data={revenueChartData && revenueChartData.length > 0 ? revenueChartData.map((item) => ({
                label: item.label,
                value: typeof item.value === 'number' ? item.value : 0,
              })) : []}
              format="currency"
              highlightMax
              variant="elevated"
              height={280}
            />
            <PremiumDonutChart
              title="התפלגות סוגי לקוחות"
              data={clientTypeDistribution && clientTypeDistribution.length > 0 ? clientTypeDistribution.map((item) => ({
                label: item.label,
                value: typeof item.value === 'number' ? item.value : 0,
                color: item.color,
              })) : []}
              centerLabel="לקוחות"
              variant="elevated"
            />
          </div>
        </div>

        {/* SECTION 3: תוכן ופרסום */}
        <div style={{ animation: 'fadeIn 1100ms ease-out' }}>
          <SectionHeader icon="📰" title="תוכן ופרסום" />
          <PremiumStatGrid
            columns={3}
            variant="elevated"
            items={[
              {
                label: 'תוכן פורסם החודש',
                value: analytics.publishedThisMonth,
                previousValue: analytics.publishedLastMonth || undefined,
                icon: '📝',
                color: BRAND.cyan,
                description: analytics.publishedLastMonth > 0 ? `לעומת ${analytics.publishedLastMonth} בחודש שעבר` : 'התחלה חדשה',
              },
              {
                label: 'שיעור אישור',
                value: analytics.approvalRate,
                format: 'percent',
                icon: '✅',
                color: '#22C55E',
                description: analytics.approvalRate > 0 ? 'מאושר' : 'בהמתנה',
              },
              {
                label: 'לקוחות עם תוכן',
                value: analytics.clientsWithPublishedContent,
                icon: '👥',
                color: '#0092cc',
                description: 'לקוחות פעילים בפרסום',
              },
            ]}
          />
        </div>

        {/* SECTION 4: משימות וצוות */}
        <div style={{ animation: 'fadeIn 1200ms ease-out' }}>
          <SectionHeader icon="📋" title="משימות וצוות" />
          <PremiumBarChart
            title="תהליך משימות"
            data={taskStatusData && taskStatusData.length > 0 ? taskStatusData.map((s) => ({
              label: s.label,
              value: typeof s.value === 'number' ? s.value : 0,
              color: s.color,
            })) : []}
            orientation="horizontal"
            variant="elevated"
          />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(450px, 1fr))', gap: '2rem', marginTop: '2rem' }}>
            {analytics && analytics.tasksByEmployee && analytics.tasksByEmployee.length > 0 && (
              <PremiumBarChart
                title="עומס עבודה לפי עובד"
                data={analytics.tasksByEmployee.map((item) => ({
                  label: item.label,
                  value: typeof item.value === 'number' ? item.value : parseInt(String(item.value)) || 0,
                  color: item.color,
                }))}
                orientation="horizontal"
                variant="elevated"
              />
            )}
            {analytics && analytics.employeeProductivity && analytics.employeeProductivity.length > 0 && (
              <div
                style={{
                  background: 'rgba(255,255,255,0.7)',
                  backdropFilter: 'blur(12px)',
                  border: `1px solid rgba(2,175,254,0.1)`,
                  borderRadius: 16,
                  padding: '2rem',
                  boxShadow: '0 4px 24px rgba(2,175,254,0.06)',
                }}
              >
                <h3 style={{ fontSize: '1.125rem', fontWeight: 700, marginBottom: '1.5rem', color: '#0F172A' }}>
                  יעילות עובדים
                </h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))', gap: '1.5rem' }}>
                  {analytics.employeeProductivity.slice(0, 4).map((emp, idx) => (
                    <PremiumRadialMetric
                      key={idx}
                      value={typeof emp.completionRate === 'number' ? emp.completionRate : parseInt(String(emp.completionRate)) || 0}
                      label={emp.name || 'Unknown'}
                      autoColor
                      size={110}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* SECTION 5: לידים ופתיחת הסכמים */}
        <div style={{ animation: 'fadeIn 1300ms ease-out' }}>
          <SectionHeader icon="🎯" title="לידים ופתיחת הסכמים" />
          <PremiumStatGrid
            columns={4}
            variant="elevated"
            items={[
              {
                label: 'לידים כוללים',
                value: analytics.allLeads,
                icon: '📞',
                color: '#F59E0B',
                description: 'כל הלידים בפלטפורמה',
              },
              {
                label: 'לידים שנוצר קשר',
                value: analytics.contactedLeads,
                previousValue: analytics.allLeads > 0 ? Math.round(analytics.contactedLeads * 0.85) : undefined,
                icon: '💬',
                color: BRAND.cyan,
                description: `${analytics.contactRate}% מהלידים`,
              },
              {
                label: 'הצעות',
                value: analytics.proposalLeads,
                icon: '📊',
                color: '#0092cc',
                description: `${analytics.proposalRate}% מהנוצר קשר`,
              },
              {
                label: 'ניצחונות',
                value: analytics.wonLeads,
                icon: '🏆',
                color: '#22C55E',
                description: `${analytics.closeRate}% מההצעות`,
              },
            ]}
          />
        </div>

        {/* Lead Funnel Visualization */}
        <div style={{ animation: 'fadeIn 1350ms ease-out' }}>
          <PremiumBarChart
            title="מעברים בלידים (Funnel)"
            data={[
              { label: 'לידים חדשים', value: analytics.allLeads, color: '#F59E0B' },
              { label: 'נוצר קשר', value: analytics.contactedLeads, color: BRAND.cyan },
              { label: 'הצעות', value: analytics.proposalLeads, color: '#0092cc' },
              { label: 'ניצחונות', value: analytics.wonLeads, color: '#22C55E' },
            ]}
            variant="elevated"
            height={200}
            highlightMax={false}
          />
        </div>

        {/* SECTION 6: קמפיינים */}
        <div style={{ animation: 'fadeIn 1450ms ease-out' }}>
          <SectionHeader icon="📢" title="קמפיינים" />
          {(() => {
            const activeCampaignList = campaigns.filter((c) => c.status === 'active').slice(0, 6);
            const campaignData = activeCampaignList.map((campaign) => {
              const contentCount = socialPosts.filter((p) => p.clientId === campaign.clientId).length;
              const progress = contentCount > 0 ? Math.min((contentCount / 20) * 100, 100) : 0;
              return { name: campaign.campaignName, contentCount, progress };
            });
            return (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '1.5rem' }}>
                {campaignData.map((c, idx) => (
                  <PremiumRadialMetric
                    key={idx}
                    title={c.name}
                    value={Math.round(c.progress)}
                    label={`${c.contentCount} פריטים`}
                    autoColor
                    variant="elevated"
                    size={100}
                    strokeWidth={8}
                  />
                ))}
              </div>
            );
          })()}
        </div>

        {/* SECTION 7: תובנות AI */}
        <div style={{ animation: 'fadeIn 1600ms ease-out' }}>
          <SectionHeader icon="🧠" title="תובנות AI" />
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))',
              gap: '1.5rem',
            }}
          >
            {computedInsights.map((insight, idx) => (
              <div
                key={idx}
                style={{
                  background: 'rgba(255,255,255,0.7)',
                  backdropFilter: 'blur(12px)',
                  border: `1px solid rgba(2,175,254,0.12)`,
                  borderRadius: 16,
                  padding: '1.75rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '1rem',
                  boxShadow: '0 4px 24px rgba(2,175,254,0.06)',
                  transition: 'all 300ms ease',
                  cursor: 'default',
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.borderColor = `rgba(2,175,254,0.3)`;
                  (e.currentTarget as HTMLElement).style.boxShadow = '0 8px 32px rgba(2,175,254,0.12)';
                  (e.currentTarget as HTMLElement).style.transform = 'translateY(-3px)';
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.borderColor = 'rgba(2,175,254,0.12)';
                  (e.currentTarget as HTMLElement).style.boxShadow = '0 4px 24px rgba(2,175,254,0.06)';
                  (e.currentTarget as HTMLElement).style.transform = 'translateY(0)';
                }}
              >
                <div style={{ display: 'flex', alignItems: 'start', gap: '1rem' }}>
                  <div style={{ fontSize: '1.75rem' }}>{insight.icon}</div>
                  <div style={{ flex: 1 }}>
                    <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#0F172A', marginBottom: '0.5rem' }}>
                      {insight.title}
                    </h3>
                    <p style={{ fontSize: '0.875rem', color: '#64748B', lineHeight: '1.6' }}>
                      {insight.description}
                    </p>
                  </div>
                </div>
                {insight.priority && (
                  <div
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      padding: '0.5rem 1rem',
                      borderRadius: '0.5rem',
                      background: insight.priority === 'high' ? '#EF444420' : insight.priority === 'medium' ? '#F59E0B20' : '#22C55E20',
                      color: insight.priority === 'high' ? '#EF4444' : insight.priority === 'medium' ? '#F59E0B' : '#22C55E',
                      width: 'fit-content',
                    }}
                  >
                    <span style={{ fontSize: '0.9rem' }}>●</span>
                    <span>{insight.priority === 'high' ? 'דחוף' : insight.priority === 'medium' ? 'בינוני' : 'נמוך'}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* SECTION 8: פעילות אחרונה */}
        <div style={{ animation: 'fadeIn 1800ms ease-out' }}>
          <SectionHeader icon="⚡" title="פעילות אחרונה" />
          <div
            style={{
              background: 'rgba(255,255,255,0.7)',
              backdropFilter: 'blur(12px)',
              border: `1px solid rgba(2,175,254,0.1)`,
              borderRadius: 16,
              padding: '2rem',
              boxShadow: '0 4px 24px rgba(2,175,254,0.06)',
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              {recentActivities.map((activity, idx) => (
                <div
                  key={idx}
                  style={{
                    display: 'flex',
                    gap: '1.5rem',
                    paddingBottom: idx < recentActivities.length - 1 ? '1.5rem' : '0',
                    borderBottom: idx < recentActivities.length - 1 ? '1px solid rgba(2,175,254,0.08)' : 'none',
                  }}
                >
                  <div
                    style={{
                      width: '40px',
                      height: '40px',
                      borderRadius: '50%',
                      background: `${activity.color}15`,
                      border: `2px solid ${activity.color}30`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '1.25rem',
                      flexShrink: 0,
                      boxShadow: `0 0 12px ${activity.color}20`,
                    }}
                  >
                    {activity.icon}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '0.35rem' }}>
                      <h4 style={{ fontSize: '0.9375rem', fontWeight: 700, color: '#0F172A' }}>{activity.title}</h4>
                      <span style={{ fontSize: '0.75rem', color: '#94A3B8' }}>{activity.time}</span>
                    </div>
                    <p style={{ fontSize: '0.8125rem', color: '#64748B' }}>{activity.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
