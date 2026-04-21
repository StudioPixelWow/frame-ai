'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import {
  useClients,
  useLeads,
  useEmployees,
  useEmployeeTasks,
  usePayments,
  useBusinessProjects,
  useProjectPayments,
  useHostingRecords,
  usePodcastSessions,
  useClientGanttItems,
  useApprovals,
} from '@/lib/api/use-entity';
import { useToast } from '@/components/ui/toast';
import { useOperationalAlerts } from '@/lib/alerts/use-alerts';
import { SEVERITY_CONFIG, CATEGORY_LABELS } from '@/lib/alerts/engine';
import { INSIGHT_TYPE_CONFIG } from '@/lib/ai/insights';
import AnimatedCounter from '@/components/ui/animated-counter';

const HEBREW_MONTHS = ['ינו', 'פבר', 'מרץ', 'אפר', 'מאי', 'יוני', 'יולי', 'אוג', 'ספט', 'אוק', 'נוב', 'דצמ'];

export default function ExecDashboardPage() {
  const toast = useToast();
  const [filterSeverity, setFilterSeverity] = useState<'all' | 'critical' | 'warning' | 'info'>('all');
  const [timeOfDay, setTimeOfDay] = useState('');

  // Data hooks
  const { data: clients } = useClients();
  const { data: leads } = useLeads();
  const { data: employees } = useEmployees();
  const { data: employeeTasks } = useEmployeeTasks();
  const { data: payments } = usePayments();
  const { data: businessProjects } = useBusinessProjects();
  const { data: projectPayments } = useProjectPayments();
  const { data: ganttItems } = useClientGanttItems();
  const { data: approvals } = useApprovals();
  const { data: podcastSessions } = usePodcastSessions();
  const { alerts, insights, loading: alertsLoading } = useOperationalAlerts();

  // Time-based greeting
  useEffect(() => {
    const hour = new Date().getHours();
    if (hour < 12) setTimeOfDay('בוקר טוב');
    else if (hour < 18) setTimeOfDay('צהריים טובים');
    else setTimeOfDay('ערב טוב');
  }, []);

  // ═══════════════════════════════════════════════════════════════════════════
  // KPI CALCULATIONS
  // ═══════════════════════════════════════════════════════════════════════════

  const kpis = useMemo(() => {
    const now = new Date();
    const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    const activeClientsCount = clients.filter(c => c.status === 'active').length;
    const openLeadsCount = leads.filter(l => l.status !== 'won' && l.status !== 'not_relevant').length;
    const openTasksCount = employeeTasks.filter(t => t.status !== 'completed').length;
    const overdueTasks = employeeTasks.filter(t => {
      if (t.status === 'completed') return false;
      if (!t.dueDate) return false;
      const dueDate = new Date(t.dueDate);
      return dueDate < now;
    });
    const overdueTasksCount = overdueTasks.length;
    const monthlyRevenue = clients
      .filter(c => c.status === 'active')
      .reduce((sum, c) => sum + (c.retainerAmount || 0), 0);
    const overduePaymentsCount = payments.filter(p => p.status === 'overdue').length;
    const overdueProjectPaymentsCount = projectPayments.filter(p => {
      if (p.status !== 'pending') return false;
      const dueDate = new Date(p.dueDate);
      return dueDate < now;
    }).length;
    const totalOverduePayments = overduePaymentsCount + overdueProjectPaymentsCount;
    const upcomingPayments = payments.filter(p => {
      if (p.status === 'paid' || p.status === 'draft') return false;
      if (!p.dueDate) return false;
      const dueDate = new Date(p.dueDate);
      return dueDate >= now && dueDate <= sevenDaysFromNow;
    });
    const upcomingPaymentsCount = upcomingPayments.length;

    return { activeClientsCount, openLeadsCount, openTasksCount, overdueTasksCount, monthlyRevenue, totalOverduePayments, upcomingPaymentsCount };
  }, [clients, leads, employeeTasks, payments, projectPayments]);

  // ═══════════════════════════════════════════════════════════════════════════
  // CHART DATA CALCULATIONS
  // ═══════════════════════════════════════════════════════════════════════════

  const chartData = useMemo(() => {
    const tasksByStatus = {
      new: employeeTasks.filter(t => t.status === 'new').length,
      in_progress: employeeTasks.filter(t => t.status === 'in_progress').length,
      under_review: employeeTasks.filter(t => t.status === 'under_review').length,
      completed: employeeTasks.filter(t => t.status === 'completed').length,
    };

    const employeeWorkload = employees.map(emp => ({
      id: emp.id,
      name: emp.name,
      workload: emp.workload || 0,
      taskCount: employeeTasks.filter(t => t.assignedEmployeeId === emp.id && t.status !== 'completed').length,
    }));

    const leadsByStatus = {
      new: leads.filter(l => l.status === 'new').length,
      contacted: leads.filter(l => l.status === 'contacted').length,
      proposal_sent: leads.filter(l => l.status === 'proposal_sent').length,
      negotiation: leads.filter(l => l.status === 'negotiation').length,
      won: leads.filter(l => l.status === 'won').length,
      not_relevant: leads.filter(l => l.status === 'not_relevant').length,
    };

    const clientTypeDistribution = {
      marketing: clients.filter(c => c.clientType === 'marketing').length,
      branding: clients.filter(c => c.clientType === 'branding').length,
      websites: clients.filter(c => c.clientType === 'websites').length,
      hosting: clients.filter(c => c.clientType === 'hosting').length,
      podcast: clients.filter(c => c.clientType === 'podcast').length,
    };

    return { tasksByStatus, employeeWorkload, leadsByStatus, clientTypeDistribution };
  }, [clients, employees, employeeTasks, leads]);

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER FUNCTIONS
  // ═══════════════════════════════════════════════════════════════════════════

  const formatCurrency = (num: number) => `₪${(num / 1000).toFixed(0)}K`;
  const formatCount = (num: number) => num.toLocaleString('he-IL');
  const getTodayHebrew = () => {
    const date = new Date();
    return date.toLocaleDateString('he-IL', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // SECTION 1: PREMIUM HEADER
  // ═══════════════════════════════════════════════════════════════════════════

  const headerStyle = {
    direction: 'rtl' as const,
    paddingTop: '32px',
    paddingBottom: '32px',
    paddingLeft: '32px',
    paddingRight: '32px',
    borderBottom: `1px solid var(--border)`,
  };

  const titleStyle = {
    fontSize: '2.5rem',
    fontWeight: '800',
    color: 'var(--foreground)',
    margin: '0 0 8px 0',
  };

  const subtitleStyle = {
    fontSize: '0.95rem',
    color: 'var(--foreground-muted)',
    margin: '0 0 20px 0',
  };

  const summaryBadgeStyle = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '16px',
    fontSize: '0.875rem',
    fontWeight: '600',
  };

  const badgeItemStyle = {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    paddingLeft: '12px',
    paddingRight: '12px',
    paddingTop: '8px',
    paddingBottom: '8px',
    borderRadius: '6px',
    backgroundColor: 'var(--surface)',
    color: 'var(--foreground)',
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // SECTION 2: TOP KPIs
  // ═══════════════════════════════════════════════════════════════════════════

  const kpisGridStyle = {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
    gap: '16px',
    padding: '32px',
    paddingTop: '32px',
  };

  const kpiCardStyle = (borderColor: string) => ({
    backgroundColor: 'var(--surface-raised)',
    border: `1px solid var(--border)`,
    borderRadius: '8px',
    padding: '20px',
    borderTop: `3px solid ${borderColor}`,
    direction: 'rtl' as const,
  });

  const kpiNumberStyle = {
    fontSize: '2rem',
    fontWeight: '700',
    color: 'var(--foreground)',
    margin: '0 0 8px 0',
  };

  const kpiLabelStyle = {
    fontSize: '0.85rem',
    color: 'var(--foreground-muted)',
    margin: '0',
    fontWeight: '600',
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // SECTION 3: AI INSIGHTS
  // ═══════════════════════════════════════════════════════════════════════════

  const sectionTitleStyle = {
    fontSize: '1.3rem',
    fontWeight: '700',
    color: 'var(--foreground)',
    margin: '0 0 20px 0',
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    direction: 'rtl' as const,
  };

  const insightsGridStyle = {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
    gap: '16px',
    padding: '0 32px',
  };

  const insightCardStyle = {
    backgroundColor: 'var(--surface-raised)',
    border: `1px solid var(--border)`,
    borderRadius: '8px',
    padding: '20px',
    borderLeft: `4px solid var(--accent)`,
    position: 'relative' as const,
    direction: 'rtl' as const,
  };

  const insightTitleStyle = {
    fontSize: '0.95rem',
    fontWeight: '700',
    color: 'var(--foreground)',
    margin: '0 0 8px 0',
  };

  const insightDescStyle = {
    fontSize: '0.8rem',
    color: 'var(--foreground-muted)',
    margin: '0 0 12px 0',
    lineHeight: '1.4',
  };

  const insightMetricStyle = {
    fontSize: '0.75rem',
    fontWeight: '600',
    backgroundColor: 'var(--surface)',
    color: 'var(--accent)',
    paddingLeft: '8px',
    paddingRight: '8px',
    paddingTop: '4px',
    paddingBottom: '4px',
    borderRadius: '4px',
    display: 'inline-block',
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // SECTION 4: LIVE ALERTS
  // ═══════════════════════════════════════════════════════════════════════════

  const alertsContainerStyle = {
    padding: '32px',
  };

  const alertsHeaderStyle = {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    marginBottom: '20px',
    direction: 'rtl' as const,
  };

  const filterChipsStyle = {
    display: 'flex',
    gap: '12px',
    marginBottom: '20px',
    direction: 'rtl' as const,
  };

  const chipStyle = (active: boolean, color: string) => ({
    padding: '8px 14px',
    border: `1px solid ${active ? color : 'var(--border)'}`,
    backgroundColor: active ? color : 'transparent',
    color: active ? '#fff' : 'var(--foreground)',
    borderRadius: '6px',
    cursor: 'pointer' as const,
    fontSize: '0.85rem',
    fontWeight: '600',
    transition: 'all 0.2s ease',
  });

  const alertsGridStyle = {
    display: 'grid',
    gap: '12px',
  };

  const alertCardStyle = (severity: string) => {
    const colorMap: { [key: string]: string } = {
      critical: '#EF4444',
      warning: '#F59E0B',
      info: '#3B82F6',
    };
    return {
      backgroundColor: 'var(--surface-raised)',
      border: `1px solid var(--border)`,
      borderRadius: '8px',
      padding: '16px',
      borderLeft: `3px solid ${colorMap[severity] || '#3B82F6'}`,
      direction: 'rtl' as const,
      display: 'flex',
      alignItems: 'flex-start',
      gap: '12px',
    };
  };

  const alertContentStyle = {
    flex: 1,
  };

  const alertTitleStyle = {
    fontSize: '0.95rem',
    fontWeight: '700',
    color: 'var(--foreground)',
    margin: '0 0 4px 0',
  };

  const alertDescStyle = {
    fontSize: '0.8rem',
    color: 'var(--foreground-muted)',
    margin: '0',
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // SECTION 5: OPERATIONAL CHARTS
  // ═══════════════════════════════════════════════════════════════════════════

  const chartsContainerStyle = {
    padding: '32px',
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))',
    gap: '24px',
  };

  const chartCardStyle = {
    backgroundColor: 'var(--surface-raised)',
    border: `1px solid var(--border)`,
    borderRadius: '8px',
    padding: '24px',
    direction: 'rtl' as const,
  };

  const chartTitleStyle = {
    fontSize: '1rem',
    fontWeight: '700',
    color: 'var(--foreground)',
    margin: '0 0 20px 0',
  };

  const barChartStyle = {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '12px',
  };

  const barItemStyle = {
    display: 'grid',
    gridTemplateColumns: '80px 1fr 60px',
    gap: '12px',
    alignItems: 'center',
    direction: 'rtl' as const,
  };

  const barLabelStyle = {
    fontSize: '0.8rem',
    color: 'var(--foreground-muted)',
    fontWeight: '600',
  };

  const barContainerStyle = {
    backgroundColor: 'var(--surface)',
    borderRadius: '4px',
    height: '28px',
    position: 'relative' as const,
    overflow: 'hidden',
  };

  const barFillStyle = (color: string, percentage: number) => ({
    backgroundColor: color,
    height: '100%',
    width: `${percentage}%`,
    borderRadius: '4px',
    transition: 'width 0.3s ease',
  });

  const barValueStyle = {
    fontSize: '0.75rem',
    color: 'var(--foreground-muted)',
    fontWeight: '700',
    textAlign: 'right' as const,
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // SECTION 6: QUICK NAVIGATION
  // ═══════════════════════════════════════════════════════════════════════════

  const navGridStyle = {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
    gap: '16px',
    padding: '32px',
  };

  const navCardStyle = {
    backgroundColor: 'var(--surface-raised)',
    border: `1px solid var(--border)`,
    borderRadius: '8px',
    padding: '20px',
    textAlign: 'center' as const,
    cursor: 'pointer' as const,
    transition: 'all 0.3s ease',
    textDecoration: 'none',
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    gap: '12px',
    direction: 'rtl' as const,
  };

  const navIconStyle = {
    fontSize: '2rem',
  };

  const navTitleStyle = {
    fontSize: '0.95rem',
    fontWeight: '700',
    color: 'var(--foreground)',
    margin: '0',
  };

  const navCountStyle = {
    fontSize: '0.75rem',
    color: 'var(--accent)',
    fontWeight: '600',
    margin: '0',
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // SECTION 7: LEADS FLOW
  // ═══════════════════════════════════════════════════════════════════════════

  const leadsFlowStyle = {
    padding: '32px',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '20px',
  };

  const pipelineStyle = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '0',
    direction: 'rtl' as const,
  };

  const stageStyle = {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    gap: '8px',
    flex: 1,
  };

  const stageCircleStyle = (color: string) => ({
    width: '60px',
    height: '60px',
    borderRadius: '50%',
    backgroundColor: color,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#fff',
    fontSize: '1.2rem',
    fontWeight: '700',
  });

  const stageLabelStyle = {
    fontSize: '0.75rem',
    color: 'var(--foreground-muted)',
    fontWeight: '600',
    textAlign: 'center' as const,
    maxWidth: '70px',
  };

  const arrowStyle = {
    fontSize: '1.5rem',
    color: 'var(--foreground-muted)',
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // SECTION 8: CLIENT HEALTH GRID
  // ═══════════════════════════════════════════════════════════════════════════

  const clientTableStyle = {
    padding: '32px',
  };

  const tableStyle = {
    width: '100%',
    borderCollapse: 'collapse' as const,
    direction: 'rtl' as const,
  };

  const thStyle = {
    textAlign: 'right' as const,
    padding: '12px',
    fontSize: '0.85rem',
    fontWeight: '700',
    color: 'var(--foreground)',
    borderBottom: `1px solid var(--border)`,
    backgroundColor: 'var(--surface)',
  };

  const tdStyle = {
    padding: '12px',
    fontSize: '0.85rem',
    color: 'var(--foreground)',
    borderBottom: `1px solid var(--border)`,
  };

  const healthBadgeStyle = (health: 'good' | 'warning' | 'bad') => {
    const colorMap = {
      good: { bg: '#D1FAE5', color: '#065F46' },
      warning: { bg: '#FEF3C7', color: '#92400E' },
      bad: { bg: '#FEE2E2', color: '#7F1D1D' },
    };
    const map = colorMap[health];
    return {
      display: 'inline-block',
      backgroundColor: map.bg,
      color: map.color,
      paddingLeft: '8px',
      paddingRight: '8px',
      paddingTop: '4px',
      paddingBottom: '4px',
      borderRadius: '4px',
      fontSize: '0.75rem',
      fontWeight: '600',
    };
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER LAYOUT
  // ═══════════════════════════════════════════════════════════════════════════

  return (
    <div className="ux-ambient-energy" style={{ backgroundColor: 'var(--background)', color: 'var(--foreground)', minHeight: '100vh' }}>
      {/* HEADER */}
      <div style={headerStyle}>
        <h1 style={titleStyle}>מרכז שליטה</h1>
        <p style={subtitleStyle}>
          {timeOfDay} • {getTodayHebrew()}
        </p>
        <div style={summaryBadgeStyle}>
          <div style={badgeItemStyle}>
            <span>🔴</span>
            <span>{alerts.filter(a => a.severity === 'critical').length} התראות קריטיות</span>
          </div>
          <div style={badgeItemStyle}>
            <span>🟡</span>
            <span>{alerts.filter(a => a.severity === 'warning').length} אזהרות</span>
          </div>
        </div>
      </div>

      {/* SECTION 2: TOP KPIs */}
      <div className="ux-stagger" style={kpisGridStyle}>
        <div className="ux-stagger-item ux-card ux-light-sweep" style={kpiCardStyle('var(--accent)')}>
          <div style={kpiNumberStyle}><AnimatedCounter value={kpis.activeClientsCount} /></div>
          <p style={kpiLabelStyle}>לקוחות פעילים</p>
        </div>

        <div className="ux-stagger-item ux-card ux-light-sweep" style={kpiCardStyle('#3B82F6')}>
          <div style={kpiNumberStyle}><AnimatedCounter value={kpis.openLeadsCount} /></div>
          <p style={kpiLabelStyle}>לידים פתוחים</p>
        </div>

        <div className="ux-stagger-item ux-card ux-light-sweep" style={kpiCardStyle('#8B5CF6')}>
          <div style={kpiNumberStyle}><AnimatedCounter value={kpis.openTasksCount} /></div>
          <p style={kpiLabelStyle}>משימות פתוחות</p>
        </div>

        <div className="ux-stagger-item ux-card ux-light-sweep" style={kpiCardStyle('#EF4444')}>
          <div style={kpiNumberStyle}><AnimatedCounter value={kpis.overdueTasksCount} /></div>
          <p style={kpiLabelStyle}>משימות באיחור</p>
        </div>

        <div className="ux-stagger-item ux-card ux-light-sweep" style={kpiCardStyle('#10B981')}>
          <div style={kpiNumberStyle}>{formatCurrency(kpis.monthlyRevenue)}</div>
          <p style={kpiLabelStyle}>הכנסה חודשית</p>
        </div>

        <div className="ux-stagger-item ux-card ux-light-sweep" style={kpiCardStyle('#EF4444')}>
          <div style={kpiNumberStyle}><AnimatedCounter value={kpis.totalOverduePayments} /></div>
          <p style={kpiLabelStyle}>תשלומים בפיגור</p>
        </div>

        <div className="ux-stagger-item ux-card ux-light-sweep" style={kpiCardStyle('#F59E0B')}>
          <div style={kpiNumberStyle}><AnimatedCounter value={kpis.upcomingPaymentsCount} /></div>
          <p style={kpiLabelStyle}>גביות קרובות</p>
        </div>
      </div>

      {/* SECTION 3: AI INSIGHTS */}
      <div style={{ padding: '32px' }}>
        <h2 style={sectionTitleStyle}>
          <span>✨</span>
          <span>תובנות AI</span>
        </h2>
        {alertsLoading ? (
          <div style={{ textAlign: 'center', color: 'var(--foreground-muted)', paddingTop: '20px' }}>
            טוען תובנות...
          </div>
        ) : insights && insights.length > 0 ? (
          <div className="ux-stagger" style={insightsGridStyle}>
            {insights.slice(0, 6).map((insight, idx) => (
              <div key={idx} className="ux-stagger-item ux-card ux-light-sweep" style={insightCardStyle}>
                <h3 style={insightTitleStyle}>{insight.title}</h3>
                <p style={insightDescStyle}>{insight.description}</p>
                {insight.metric && <span style={insightMetricStyle}>{insight.metric}</span>}
              </div>
            ))}
          </div>
        ) : (
          <div style={{ textAlign: 'center', color: 'var(--foreground-muted)', paddingTop: '20px' }}>
            אין תובנות זמינות כרגע
          </div>
        )}
      </div>

      {/* SECTION 4: LIVE ALERTS */}
      <div style={alertsContainerStyle}>
        <div style={alertsHeaderStyle}>
          <h2 style={{ ...sectionTitleStyle, marginBottom: '0' }}>
            <span>⚡</span>
            <span>התראות תפעוליות</span>
            <span style={badgeItemStyle}>{alerts.length}</span>
          </h2>
        </div>

        <div style={filterChipsStyle}>
          <button
            className="ux-btn ux-btn-glow"
            onClick={() => setFilterSeverity('all')}
            style={chipStyle(filterSeverity === 'all', 'var(--accent)')}>
            הכל
          </button>
          <button
            className="ux-btn ux-btn-glow"
            onClick={() => setFilterSeverity('critical')}
            style={chipStyle(filterSeverity === 'critical', '#EF4444')}>
            🔴 קריטי
          </button>
          <button
            className="ux-btn ux-btn-glow"
            onClick={() => setFilterSeverity('warning')}
            style={chipStyle(filterSeverity === 'warning', '#F59E0B')}>
            🟡 אזהרה
          </button>
          <button
            className="ux-btn ux-btn-glow"
            onClick={() => setFilterSeverity('info')}
            style={chipStyle(filterSeverity === 'info', '#3B82F6')}>
            🔵 מידע
          </button>
        </div>

        <div style={alertsGridStyle}>
          {alerts
            .filter(a => filterSeverity === 'all' || a.severity === filterSeverity)
            .slice(0, 10)
            .map(alert => (
              <Link key={alert.id} href={alert.linkHref || '#'} style={{ textDecoration: 'none' }}>
                <div className="ux-card ux-light-sweep" style={alertCardStyle(alert.severity)}>
                  <span style={{ fontSize: '1.3rem' }}>{SEVERITY_CONFIG[alert.severity].icon}</span>
                  <div style={alertContentStyle}>
                    <p style={alertTitleStyle}>{alert.title}</p>
                    <p style={alertDescStyle}>{alert.description}</p>
                  </div>
                </div>
              </Link>
            ))}
        </div>

        {alerts.length > 10 && (
          <div style={{ marginTop: '20px', textAlign: 'center' }}>
            <Link href="/alerts" style={{ color: 'var(--accent)', textDecoration: 'none', fontSize: '0.9rem', fontWeight: '600' }}>
              צפה בכל {alerts.length} ההתראות →
            </Link>
          </div>
        )}
      </div>

      {/* SECTION 5: OPERATIONAL CHARTS */}
      <div className="ux-stagger" style={chartsContainerStyle}>
        {/* Tasks by Status */}
        <div className="ux-stagger-item ux-card ux-light-sweep" style={chartCardStyle}>
          <h3 style={chartTitleStyle}>משימות לפי סטטוס</h3>
          <div style={barChartStyle}>
            {[
              { label: 'חדש', value: chartData.tasksByStatus.new, color: '#3B82F6' },
              { label: 'בביצוע', value: chartData.tasksByStatus.in_progress, color: '#8B5CF6' },
              { label: 'בבדיקה', value: chartData.tasksByStatus.under_review, color: '#F59E0B' },
              { label: 'הושלמה', value: chartData.tasksByStatus.completed, color: '#10B981' },
            ].map(item => {
              const max = Object.values(chartData.tasksByStatus).reduce((a, b) => a + b, 0) || 1;
              const percentage = (item.value / max) * 100;
              return (
                <div key={item.label} style={barItemStyle}>
                  <span style={barLabelStyle}>{item.label}</span>
                  <div style={barContainerStyle}>
                    <div style={barFillStyle(item.color, percentage)} />
                  </div>
                  <span style={barValueStyle}>{item.value}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Employee Workload */}
        <div className="ux-stagger-item ux-card ux-light-sweep" style={chartCardStyle}>
          <h3 style={chartTitleStyle}>עומס עבודה לפי עובד</h3>
          <div style={barChartStyle}>
            {chartData.employeeWorkload.slice(0, 5).map(emp => {
              const maxTasks = Math.max(...chartData.employeeWorkload.map(e => e.taskCount), 1);
              const percentage = (emp.taskCount / maxTasks) * 100;
              return (
                <div key={emp.id} style={barItemStyle}>
                  <span style={barLabelStyle}>{emp.name}</span>
                  <div style={barContainerStyle}>
                    <div style={barFillStyle('var(--accent)', percentage)} />
                  </div>
                  <span style={barValueStyle}>{emp.taskCount}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Leads by Status */}
        <div className="ux-stagger-item ux-card ux-light-sweep" style={chartCardStyle}>
          <h3 style={chartTitleStyle}>לידים לפי שלב</h3>
          <div style={barChartStyle}>
            {[
              { label: 'חדש', value: chartData.leadsByStatus.new, color: '#3B82F6' },
              { label: 'יצור קשר', value: chartData.leadsByStatus.contacted, color: '#8B5CF6' },
              { label: 'הצעה', value: chartData.leadsByStatus.proposal_sent, color: '#F59E0B' },
              { label: 'משא ומתן', value: chartData.leadsByStatus.negotiation, color: '#EC4899' },
              { label: 'נסגר', value: chartData.leadsByStatus.won, color: '#10B981' },
            ].map(item => {
              const max = Object.values(chartData.leadsByStatus).reduce((a, b) => a + b, 0) || 1;
              const percentage = (item.value / max) * 100;
              return (
                <div key={item.label} style={barItemStyle}>
                  <span style={barLabelStyle}>{item.label}</span>
                  <div style={barContainerStyle}>
                    <div style={barFillStyle(item.color, percentage)} />
                  </div>
                  <span style={barValueStyle}>{item.value}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Client Types */}
        <div className="ux-stagger-item ux-card ux-light-sweep" style={chartCardStyle}>
          <h3 style={chartTitleStyle}>התפלגות סוגי לקוחות</h3>
          <div style={barChartStyle}>
            {[
              { label: 'שיווק', value: chartData.clientTypeDistribution.marketing, color: '#3B82F6' },
              { label: 'ברנדינג', value: chartData.clientTypeDistribution.branding, color: '#8B5CF6' },
              { label: 'אתרים', value: chartData.clientTypeDistribution.websites, color: '#10B981' },
              { label: 'הוסטינג', value: chartData.clientTypeDistribution.hosting, color: '#F59E0B' },
              { label: 'פודקאסט', value: chartData.clientTypeDistribution.podcast, color: '#EC4899' },
            ].map(item => {
              const max = Object.values(chartData.clientTypeDistribution).reduce((a, b) => a + b, 0) || 1;
              const percentage = (item.value / max) * 100;
              return (
                <div key={item.label} style={barItemStyle}>
                  <span style={barLabelStyle}>{item.label}</span>
                  <div style={barContainerStyle}>
                    <div style={barFillStyle(item.color, percentage)} />
                  </div>
                  <span style={barValueStyle}>{item.value}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* SECTION 6: QUICK NAVIGATION */}
      <div style={{ padding: '32px', backgroundColor: 'var(--surface)', marginTop: '32px' }}>
        <h2 style={sectionTitleStyle}>
          <span>🗂️</span>
          <span>ניווט מהיר</span>
        </h2>
        <div className="ux-stagger" style={navGridStyle}>
          <Link href="/clients" className="ux-stagger-item ux-card ux-light-sweep" style={navCardStyle}>
            <span style={navIconStyle}>👥</span>
            <p style={navTitleStyle}>לקוחות</p>
            <p style={navCountStyle}>{formatCount(kpis.activeClientsCount)}</p>
          </Link>
          <Link href="/leads" className="ux-stagger-item ux-card ux-light-sweep" style={navCardStyle}>
            <span style={navIconStyle}>🎯</span>
            <p style={navTitleStyle}>לידים</p>
            <p style={navCountStyle}>{formatCount(kpis.openLeadsCount)}</p>
          </Link>
          <Link href="/employees" className="ux-stagger-item ux-card ux-light-sweep" style={navCardStyle}>
            <span style={navIconStyle}>👨‍💼</span>
            <p style={navTitleStyle}>עובדים</p>
            <p style={navCountStyle}>{formatCount(employees.length)}</p>
          </Link>
          <Link href="/accounting" className="ux-stagger-item ux-card ux-light-sweep" style={navCardStyle}>
            <span style={navIconStyle}>💰</span>
            <p style={navTitleStyle}>חשבונות</p>
            <p style={navCountStyle}>{formatCount(kpis.totalOverduePayments)}</p>
          </Link>
          <Link href="/approvals" className="ux-stagger-item ux-card ux-light-sweep" style={navCardStyle}>
            <span style={navIconStyle}>✅</span>
            <p style={navTitleStyle}>אישורים</p>
            <p style={navCountStyle}>{formatCount(approvals.filter(a => a.status === 'pending_approval').length)}</p>
          </Link>
          <Link href="/accounting/podcast" className="ux-stagger-item ux-card ux-light-sweep" style={navCardStyle}>
            <span style={navIconStyle}>🎙️</span>
            <p style={navTitleStyle}>פודקאסט</p>
            <p style={navCountStyle}>{formatCount(podcastSessions?.length || 0)}</p>
          </Link>
          <Link href="/projects" className="ux-stagger-item ux-card ux-light-sweep" style={navCardStyle}>
            <span style={navIconStyle}>📊</span>
            <p style={navTitleStyle}>פרויקטים</p>
            <p style={navCountStyle}>{formatCount(businessProjects?.length || 0)}</p>
          </Link>
          <Link href="/business-projects" className="ux-stagger-item ux-card ux-light-sweep" style={navCardStyle}>
            <span style={navIconStyle}>🚀</span>
            <p style={navTitleStyle}>עסקים</p>
            <p style={navCountStyle}>{formatCount(businessProjects?.length || 0)}</p>
          </Link>
        </div>
      </div>

      {/* SECTION 7: LEADS FLOW */}
      <div style={leadsFlowStyle}>
        <h2 style={sectionTitleStyle}>
          <span>🔀</span>
          <span>זרימת לידים</span>
        </h2>
        <div style={pipelineStyle}>
          {[
            { label: 'חדש', count: chartData.leadsByStatus.new, color: '#3B82F6' },
            { label: 'יצור קשר', count: chartData.leadsByStatus.contacted, color: '#8B5CF6' },
            { label: 'הצעה', count: chartData.leadsByStatus.proposal_sent, color: '#F59E0B' },
            { label: 'משא ומתן', count: chartData.leadsByStatus.negotiation, color: '#EC4899' },
            { label: 'נסגר', count: chartData.leadsByStatus.won, color: '#10B981' },
            { label: 'לא רלוונטי', count: chartData.leadsByStatus.not_relevant, color: '#6B7280' },
          ].map((stage, idx) => (
            <React.Fragment key={idx}>
              <div style={stageStyle}>
                <div style={stageCircleStyle(stage.color)}>{stage.count}</div>
                <p style={stageLabelStyle}>{stage.label}</p>
              </div>
              {idx < 5 && <div style={arrowStyle}>←</div>}
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* SECTION 8: CLIENT HEALTH GRID */}
      <div style={clientTableStyle}>
        <h2 style={sectionTitleStyle}>
          <span>❤️</span>
          <span>בריאות לקוחות</span>
        </h2>
        <table style={tableStyle}>
          <thead>
            <tr className="ux-table-header">
              <th style={thStyle}>שם לקוח</th>
              <th style={thStyle}>סטטוס Gantt</th>
              <th style={thStyle}>פוסטים שבועיים</th>
              <th style={thStyle}>סטטוס תשלום</th>
              <th style={thStyle}>מנהל מוקצה</th>
            </tr>
          </thead>
          <tbody>
            {clients
              .filter(c => c.status === 'active')
              .slice(0, 8)
              .map(client => {
                const ganttStatus = client.monthlyGanttStatus || 'none';
                let ganttHealth: 'good' | 'warning' | 'bad' = 'good';
                if (ganttStatus === 'none' || ganttStatus === 'draft') ganttHealth = 'bad';
                else if (ganttStatus === 'sent_to_client') ganttHealth = 'warning';

                return (
                  <tr key={client.id} className="ux-table-row">
                    <td style={tdStyle}>{client.name}</td>
                    <td style={tdStyle}>
                      <span style={healthBadgeStyle(ganttHealth)}>
                        {ganttStatus === 'approved' ? '✅ אישור' : ganttStatus === 'sent_to_client' ? '⏳ ממתין' : '❌ חסר'}
                      </span>
                    </td>
                    <td style={tdStyle}>
                      {ganttItems.filter(g => g.clientId === client.id && g.month === new Date().getMonth() + 1).length}
                    </td>
                    <td style={tdStyle}>
                      <span style={healthBadgeStyle('good')}>✅ בתאריך</span>
                    </td>
                    <td style={tdStyle}>{client.assignedManagerId ? '✓' : '−'}</td>
                  </tr>
                );
              })}
          </tbody>
        </table>
      </div>

      {/* Footer spacing */}
      <div style={{ height: '40px' }} />
    </div>
  );
}
