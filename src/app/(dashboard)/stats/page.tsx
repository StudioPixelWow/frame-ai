'use client';

import { useState, useMemo, useEffect } from 'react';
import Link from 'next/link';
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

interface BarChartItem {
  label: string;
  value: string | number;
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

// Modern KPI Card with neon glow
function ModernKPICard({
  icon,
  label,
  value,
  subtitle,
  color,
  trend,
}: {
  icon: string;
  label: string;
  value: string | number;
  subtitle?: string;
  color: string;
  trend?: { direction: 'up' | 'down' | 'neutral'; pct: number };
}) {
  return (
    <div
      className="premium-card ux-stagger-item"
      style={{
        background: 'var(--surface)',
        border: `2px solid ${color}30`,
        borderRadius: '1rem',
        padding: '1.75rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '1rem',
        transition: 'all 300ms ease',
        cursor: 'default',
        boxShadow: `0 0 20px ${color}15, inset 0 0 20px ${color}05`,
        position: 'relative',
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLElement).style.borderColor = `${color}60`;
        (e.currentTarget as HTMLElement).style.boxShadow =
          `0 0 30px ${color}30, 0 8px 20px rgba(0, 0, 0, 0.2), inset 0 0 20px ${color}10`;
        (e.currentTarget as HTMLElement).style.transform = 'translateY(-4px)';
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.borderColor = `${color}30`;
        (e.currentTarget as HTMLElement).style.boxShadow =
          `0 0 20px ${color}15, inset 0 0 20px ${color}05`;
        (e.currentTarget as HTMLElement).style.transform = 'translateY(0)';
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div style={{ fontSize: '2rem' }}>{icon}</div>
        {trend && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.35rem',
              fontSize: '0.75rem',
              fontWeight: 700,
              padding: '0.4rem 0.8rem',
              borderRadius: '0.5rem',
              background:
                trend.direction === 'up'
                  ? '#22C55E20'
                  : trend.direction === 'down'
                    ? '#EF444420'
                    : 'var(--surface-raised)',
              color:
                trend.direction === 'up'
                  ? '#22C55E'
                  : trend.direction === 'down'
                    ? '#EF4444'
                    : 'var(--foreground-muted)',
            }}
          >
            {trend.direction === 'up' ? '↑' : trend.direction === 'down' ? '↓' : '→'}
            <span>{trend.pct}%</span>
          </div>
        )}
      </div>
      <div>
        <div
          style={{
            fontSize: '2.5rem',
            fontWeight: 800,
            color: color,
            lineHeight: 1,
            marginBottom: '0.4rem',
            textShadow: `0 0 20px ${color}30`,
          }}
        >
          {value}
        </div>
        <div
          style={{
            fontSize: '0.875rem',
            color: 'var(--foreground-muted)',
            fontWeight: 500,
          }}
        >
          {label}
        </div>
        {subtitle && (
          <div
            style={{
              fontSize: '0.75rem',
              color: 'var(--foreground-muted)',
              marginTop: '0.35rem',
              opacity: 0.7,
            }}
          >
            {subtitle}
          </div>
        )}
      </div>
    </div>
  );
}

// CSS-based revenue bar chart
function RevenueChart({ months }: { months: Array<{ label: string; value: number; pct: number }> }) {
  return (
    <div
      className="premium-card"
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: '1rem',
        padding: '2rem',
        boxShadow: '0 0 20px rgba(0, 181, 254, 0.1)',
      }}
    >
      <h3
        style={{
          fontSize: '1.125rem',
          fontWeight: 700,
          marginBottom: '2rem',
          color: 'var(--foreground)',
        }}
      >
        הכנסה חודשית
      </h3>
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'space-around',
          gap: '1rem',
          height: '280px',
        }}
      >
        {months.map((month, idx) => (
          <div
            key={month.label}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '0.75rem',
              flex: 1,
            }}
          >
            <div
              style={{
                width: '100%',
                height: `${Math.max(month.pct, 10)}%`,
                background: `linear-gradient(to top, #00B5FE, #00D9FF)`,
                borderRadius: '0.5rem 0.5rem 0 0',
                boxShadow: `0 0 20px rgba(0, 181, 254, 0.4), 0 0 10px rgba(0, 217, 255, 0.2)`,
                transition: 'all 600ms cubic-bezier(0.34, 1.56, 0.64, 1)',
                position: 'relative',
                animation: `slideUp 800ms ease-out ${idx * 100}ms forwards`,
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.boxShadow =
                  `0 0 30px rgba(0, 181, 254, 0.6), 0 0 15px rgba(0, 217, 255, 0.3)`;
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.boxShadow =
                  `0 0 20px rgba(0, 181, 254, 0.4), 0 0 10px rgba(0, 217, 255, 0.2)`;
              }}
            />
            <div style={{ fontSize: '0.75rem', color: 'var(--foreground-muted)' }}>
              {month.label}
            </div>
          </div>
        ))}
      </div>
      <style>{`
        @keyframes slideUp {
          from {
            height: 0 !important;
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
}

// CSS-based donut chart for client distribution
function ClientDonutChart({ data }: { data: Array<{ label: string; value: number; color: string }> }) {
  const total = data.reduce((sum, d) => sum + d.value, 0);
  let cumulativePct = 0;
  const segments = data.map((item) => {
    const pct = (item.value / total) * 100;
    const start = cumulativePct;
    cumulativePct += pct;
    return { ...item, startPct: start, pct };
  });

  return (
    <div
      className="premium-card"
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: '1rem',
        padding: '2rem',
        boxShadow: '0 0 20px rgba(0, 181, 254, 0.1)',
        display: 'flex',
        flexDirection: 'column',
        gap: '1.5rem',
      }}
    >
      <h3
        style={{
          fontSize: '1.125rem',
          fontWeight: 700,
          color: 'var(--foreground)',
        }}
      >
        התפלגות סוגי לקוחות
      </h3>
      <div style={{ display: 'flex', gap: '2rem', alignItems: 'center' }}>
        <div style={{ position: 'relative', width: '140px', height: '140px' }}>
          <svg
            viewBox="0 0 140 140"
            style={{
              width: '100%',
              height: '100%',
              transform: 'rotate(-90deg)',
            }}
          >
            {segments.map((seg, idx) => {
              const radius = 50;
              const circumference = 2 * Math.PI * radius;
              const strokeDashoffset = circumference - (seg.pct / 100) * circumference;
              return (
                <circle
                  key={idx}
                  cx="70"
                  cy="70"
                  r={radius}
                  fill="none"
                  stroke={seg.color}
                  strokeWidth="20"
                  strokeDasharray={circumference}
                  strokeDashoffset={circumference - (seg.pct / 100) * circumference}
                  style={{
                    filter: `drop-shadow(0 0 8px ${seg.color}40)`,
                    transformOrigin: '70px 70px',
                    transform: `rotate(${(seg.startPct / 100) * 360}deg)`,
                    transition: 'all 600ms ease',
                  }}
                />
              );
            })}
          </svg>
          <div
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              textAlign: 'center',
            }}
          >
            <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--foreground)' }}>
              {total}
            </div>
            <div style={{ fontSize: '0.65rem', color: 'var(--foreground-muted)' }}>
              לקוחות
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', flex: 1 }}>
          {data.map((item) => (
            <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <div
                style={{
                  width: '12px',
                  height: '12px',
                  borderRadius: '2px',
                  background: item.color,
                  boxShadow: `0 0 8px ${item.color}60`,
                }}
              />
              <span style={{ fontSize: '0.8125rem', color: 'var(--foreground-muted)', flex: 1 }}>
                {item.label}
              </span>
              <span style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--foreground)' }}>
                {item.value}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// Task status animated bar
function TaskStatusBar({
  statuses,
}: {
  statuses: Array<{ label: string; value: number; color: string; pct: number }>;
}) {
  const [animated, setAnimated] = useState(false);

  useEffect(() => {
    setAnimated(true);
  }, []);

  return (
    <div
      className="premium-card"
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: '1rem',
        padding: '2rem',
        boxShadow: '0 0 20px rgba(0, 181, 254, 0.1)',
      }}
    >
      <h3
        style={{
          fontSize: '1.125rem',
          fontWeight: 700,
          marginBottom: '1.5rem',
          color: 'var(--foreground)',
        }}
      >
        תהליך משימות
      </h3>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: '1.5rem' }}>
        <div style={{ flex: 1 }}>
          <div
            style={{
              display: 'flex',
              height: '40px',
              borderRadius: '0.5rem',
              overflow: 'hidden',
              gap: '2px',
              background: 'var(--surface-raised)',
              padding: '2px',
            }}
          >
            {statuses.map((status, idx) => (
              <div
                key={status.label}
                style={{
                  flex: animated ? status.pct : 0,
                  background: status.color,
                  borderRadius: '0.4rem',
                  boxShadow: `0 0 12px ${status.color}40`,
                  transition: 'flex 1000ms cubic-bezier(0.34, 1.56, 0.64, 1)',
                  position: 'relative',
                }}
              />
            ))}
          </div>
          <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem', flexWrap: 'wrap' }}>
            {statuses.map((status) => (
              <div key={status.label} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <div
                  style={{
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    background: status.color,
                    boxShadow: `0 0 8px ${status.color}60`,
                  }}
                />
                <span style={{ fontSize: '0.75rem', color: 'var(--foreground-muted)' }}>
                  {status.label} ({status.value})
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// Horizontal bar chart for employee workload / payment breakdown
function HorizontalBarChart({
  title,
  data,
}: {
  title: string;
  data: Array<{ label: string; value: number; pct: number; color: string }>;
}) {
  const [animated, setAnimated] = useState(false);
  useEffect(() => { setAnimated(true); }, []);

  return (
    <div
      className="premium-card"
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: '1rem',
        padding: '2rem',
        boxShadow: '0 0 20px rgba(0, 181, 254, 0.1)',
      }}
    >
      <h3 style={{ fontSize: '1.125rem', fontWeight: 700, marginBottom: '1.5rem', color: 'var(--foreground)' }}>
        {title}
      </h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {data.map((item) => (
          <div key={item.label}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
              <span style={{ fontSize: '0.8125rem', color: 'var(--foreground-muted)' }}>{item.label}</span>
              <span style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--foreground)' }}>{item.value}</span>
            </div>
            <div style={{ height: '8px', background: 'var(--surface-raised)', borderRadius: '4px', overflow: 'hidden' }}>
              <div
                style={{
                  height: '100%',
                  width: animated ? `${Math.max(item.pct, 4)}%` : '0%',
                  background: `linear-gradient(90deg, ${item.color}, ${item.color}cc)`,
                  borderRadius: '4px',
                  boxShadow: `0 0 8px ${item.color}40`,
                  transition: 'width 800ms cubic-bezier(0.34, 1.56, 0.64, 1)',
                }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Mini sparkline for KPI cards
function MiniSparkline({ values, color }: { values: number[]; color: string }) {
  if (values.length < 2) return null;
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const range = max - min || 1;
  const w = 80;
  const h = 28;
  const points = values.map((v, i) => {
    const x = (i / (values.length - 1)) * w;
    const y = h - ((v - min) / range) * (h - 4) - 2;
    return `${x},${y}`;
  });
  const areaPoints = [...points, `${w},${h}`, `0,${h}`];

  return (
    <svg width={w} height={h} style={{ display: 'block', marginTop: '0.5rem', opacity: 0.7 }}>
      <defs>
        <linearGradient id={`spark-${color.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={areaPoints.join(' ')} fill={`url(#spark-${color.replace('#', '')})`} />
      <polyline points={points.join(' ')} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// Campaign performance card
function CampaignCard({
  name,
  contentCount,
  status,
  progress,
}: {
  name: string;
  contentCount: number;
  status: string;
  progress: number;
}) {
  return (
    <div
      className="premium-card ux-stagger-item"
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: '0.875rem',
        padding: '1.5rem',
        boxShadow: '0 0 15px rgba(0, 181, 254, 0.08)',
        transition: 'all 300ms ease',
        cursor: 'default',
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLElement).style.borderColor = 'var(--accent)';
        (e.currentTarget as HTMLElement).style.boxShadow =
          '0 0 25px rgba(0, 181, 254, 0.2)';
        (e.currentTarget as HTMLElement).style.transform = 'translateY(-3px)';
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)';
        (e.currentTarget as HTMLElement).style.boxShadow =
          '0 0 15px rgba(0, 181, 254, 0.08)';
        (e.currentTarget as HTMLElement).style.transform = 'translateY(0)';
      }}
    >
      <div style={{ marginBottom: '1rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '0.75rem' }}>
          <h4 style={{ fontSize: '0.9375rem', fontWeight: 700, color: 'var(--foreground)' }}>
            {name}
          </h4>
          <span
            style={{
              fontSize: '0.7rem',
              fontWeight: 600,
              padding: '0.3rem 0.75rem',
              borderRadius: '0.4rem',
              background: status === 'active' ? '#22C55E20' : '#9CA3AF20',
              color: status === 'active' ? '#22C55E' : '#9CA3AF',
            }}
          >
            {status === 'active' ? 'פעיל' : 'לא פעיל'}
          </span>
        </div>
        <div style={{ fontSize: '0.8rem', color: 'var(--foreground-muted)' }}>
          {contentCount} פריטים
        </div>
      </div>
      <div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '0.5rem',
          }}
        >
          <span style={{ fontSize: '0.75rem', color: 'var(--foreground-muted)' }}>
            התקדמות
          </span>
          <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--accent)' }}>
            {progress}%
          </span>
        </div>
        <div
          style={{
            height: '6px',
            background: 'var(--surface-raised)',
            borderRadius: '3px',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              height: '100%',
              width: `${progress}%`,
              background: `linear-gradient(90deg, #00B5FE, #00D9FF)`,
              borderRadius: '3px',
              boxShadow: '0 0 10px rgba(0, 181, 254, 0.5)',
              transition: 'width 600ms ease',
            }}
          />
        </div>
      </div>
    </div>
  );
}

export default function AnalyticsDashboard() {
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
        value: formatCurrency(monthAmount),
        pct: Math.min((monthAmount / maxRevenue) * 100, 100),
        color: '#00B5FE',
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
      typeCounts[item.label] = item.value as number;
    });
    return Object.entries(typeCounts).map(([label, value]) => ({
      label,
      value,
      color: analytics.clientTypeDistribution.find((item) => item.label === label)?.color || '#0092cc',
    }));
  }, [analytics]);

  const revenueChartData = useMemo(() => {
    if (!analytics || !analytics.revenueByMonth) return [];
    return analytics.revenueByMonth.map((item) => ({
      label: item.label,
      value: Number(item.value),
      pct: item.pct,
    }));
  }, [analytics]);

  const taskStatusData = useMemo(() => {
    if (!analytics || !analytics.tasksByStatus) return [];
    return analytics.tasksByStatus.map((item) => ({
      label: item.label,
      value: item.value as number,
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

    const completedTasks = analytics.tasksByStatus.find((s) => s.label === 'הושלם')?.value || 0;
    const totalTasks = analytics.tasksByStatus.reduce((sum, s) => sum + (s.value as number), 0);
    const completionRate = totalTasks > 0 ? Math.round((parseInt(String(completedTasks)) / totalTasks) * 100) : 0;
    insights.push({
      icon: '✅',
      title: 'שיעור השלמת משימות',
      description: `${completionRate}% מהמשימות הושלמו. המשך כך!`,
      priority: 'medium' as const,
    });

    const avgMonthlyRevenue = analytics.revenueByMonth.reduce((sum, item) => {
      const value = parseInt(String(item.value).replace(/[^0-9]/g, '')) || 0;
      return sum + value;
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

    const completedTasks = analytics.tasksByStatus.find((s) => s.label === 'הושלם')?.value || 0;
    if (parseInt(String(completedTasks)) > 0) {
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
      activities.push({
        icon: '💰',
        title: 'תשלומים התקבלו',
        description: `הכנסה של ${thisMonthPayments.value} החודש`,
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
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        @keyframes glow {
          0%, 100% {
            box-shadow: 0 0 20px rgba(0, 181, 254, 0.3);
          }
          50% {
            box-shadow: 0 0 30px rgba(0, 181, 254, 0.6);
          }
        }
      `}</style>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '3rem' }}>
        {/* Header */}
        <div
          style={{
            animation: 'fadeIn 600ms ease-out',
          }}
        >
          <h1
            style={{
              fontSize: '2.5rem',
              fontWeight: 900,
              letterSpacing: '-0.03em',
              marginBottom: '0.75rem',
              background: 'linear-gradient(135deg, #00B5FE, #00D9FF)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}
          >
            🚀 לוח בקרה בזמן אמת
          </h1>
          <p
            style={{
              fontSize: '1rem',
              color: 'var(--foreground-muted)',
            }}
          >
            ניתוח מעמיק של ביצועים, הכנסות, לקוחות וקמפיינים בפלטפורמה שלך
          </p>
        </div>

        {/* SECTION 1: Modern KPI Cards (4 in a row) */}
        <div
          style={{
            animation: 'fadeIn 800ms ease-out',
          }}
        >
          <h2
            style={{
              fontSize: '1.25rem',
              fontWeight: 700,
              marginBottom: '1.5rem',
              color: 'var(--foreground)',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
            }}
          >
            💎 מדדי ביצוע עיקריים
          </h2>
          <div
            className="ux-stagger"
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
              gap: '1.5rem',
            }}
          >
            <ModernKPICard
              icon="💰"
              label="סך הכנסות"
              value={formatCurrency(analytics.monthlyRevenue)}
              subtitle="החודש הנוכחי"
              color="#00B5FE"
              trend={{
                direction:
                  analytics.revenueTrend > 0
                    ? 'up'
                    : analytics.revenueTrend < 0
                      ? 'down'
                      : 'neutral',
                pct: Math.abs(analytics.revenueTrend),
              }}
            />
            <ModernKPICard
              icon="👥"
              label="לקוחות פעילים"
              value={analytics.activeClients}
              subtitle={`${analytics.mostActiveClients.length} בעומס`}
              color="#0092cc"
            />
            <ModernKPICard
              icon="📢"
              label="קמפיינים פעילים"
              value={analytics.activeCampaigns}
              subtitle={`מתוך ${analytics.totalCampaigns} סה"כ`}
              color="#22C55E"
            />
            <ModernKPICard
              icon="✓"
              label="שיעור הושלמות"
              value={`${Math.round(((analytics.tasksByStatus.find((s) => s.label === 'הושלם')?.value as number || 0) / (analytics.tasksByStatus.reduce((sum, s) => sum + (s.value as number), 0) || 1)) * 100)}%`}
              subtitle="משימות חודשיות"
              color="#F59E0B"
            />
          </div>
        </div>

        {/* SECTION 2: Charts Grid */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(500px, 1fr))',
            gap: '2rem',
            animation: 'fadeIn 1000ms ease-out',
          }}
        >
          {/* Revenue Chart */}
          <RevenueChart months={revenueChartData} />

          {/* Client Distribution Donut */}
          <ClientDonutChart data={clientTypeDistribution} />
        </div>

        {/* SECTION 3: Task Status */}
        <div
          style={{
            animation: 'fadeIn 1200ms ease-out',
          }}
        >
          <TaskStatusBar statuses={taskStatusData} />
        </div>

        {/* SECTION 3.5: Secondary KPI Row */}
        <div style={{ animation: 'fadeIn 1100ms ease-out' }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '1.5rem', color: 'var(--foreground)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            📈 מדדים נוספים
          </h2>
          <div className="ux-stagger" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.25rem' }}>
            <ModernKPICard
              icon="🎯"
              label="לידים החודש"
              value={analytics.leadsThisMonth}
              subtitle={analytics.leadsLastMonth > 0 ? `לעומת ${analytics.leadsLastMonth} בחודש שעבר` : 'חודש ראשון'}
              color="#F59E0B"
              trend={{
                direction: analytics.leadssTrend > 0 ? 'up' : analytics.leadssTrend < 0 ? 'down' : 'neutral',
                pct: Math.abs(analytics.leadssTrend),
              }}
            />
            <ModernKPICard
              icon="⚠️"
              label="תשלומים באיחור"
              value={analytics.overduePayments}
              subtitle={analytics.overdueAmount > 0 ? `סה"כ ${formatCurrency(analytics.overdueAmount)}` : 'הכל בסדר'}
              color="#EF4444"
            />
            <ModernKPICard
              icon="⏳"
              label="ממתין לאישור"
              value={analytics.pendingApprovals}
              subtitle="אישורים פתוחים"
              color="#0092cc"
            />
            <ModernKPICard
              icon="📋"
              label="משימות פתוחות"
              value={analytics.openTasks}
              subtitle={`עומס עובד: ${analytics.busiestEmployeeName} (${analytics.busiestEmployeeCount})`}
              color="#3B82F6"
            />
          </div>
        </div>

        {/* SECTION 3.7: Employee & Payment Charts */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(450px, 1fr))', gap: '2rem', animation: 'fadeIn 1300ms ease-out' }}>
          {analytics.tasksByEmployee.length > 0 && (
            <HorizontalBarChart
              title="עומס עבודה לפי עובד"
              data={analytics.tasksByEmployee}
            />
          )}
          {analytics.paymentsByType.length > 0 && (
            <HorizontalBarChart
              title="תשלומים לפי סוג"
              data={analytics.paymentsByType}
            />
          )}
        </div>

        {/* SECTION 4: Campaign Performance */}
        <div
          style={{
            animation: 'fadeIn 1400ms ease-out',
          }}
        >
          <h2
            style={{
              fontSize: '1.25rem',
              fontWeight: 700,
              marginBottom: '1.5rem',
              color: 'var(--foreground)',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
            }}
          >
            📢 ביצועי קמפיינים
          </h2>
          <div
            className="ux-stagger"
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
              gap: '1.5rem',
            }}
          >
            {campaigns
              .filter((c) => c.status === 'active')
              .slice(0, 6)
              .map((campaign) => {
                const contentCount = socialPosts.filter((p) => p.clientId === campaign.clientId).length;
                const progress = contentCount > 0 ? Math.min((contentCount / 20) * 100, 100) : 0;
                return (
                  <CampaignCard
                    key={campaign.id}
                    name={campaign.campaignName}
                    contentCount={contentCount}
                    status={campaign.status}
                    progress={progress}
                  />
                );
              })}
          </div>
        </div>

        {/* SECTION 5: AI Insights */}
        <div
          style={{
            animation: 'fadeIn 1600ms ease-out',
          }}
        >
          <h2
            style={{
              fontSize: '1.25rem',
              fontWeight: 700,
              marginBottom: '1.5rem',
              color: 'var(--foreground)',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
            }}
          >
            🧠 תובנות AI
          </h2>
          <div
            className="ux-stagger"
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))',
              gap: '1.5rem',
            }}
          >
            {computedInsights.map((insight, idx) => (
              <div
                key={idx}
                className="premium-card ux-stagger-item"
                style={{
                  background: 'linear-gradient(135deg, #0092cc20, #0092cc20)',
                  border: '1px solid #0092cc40',
                  borderRadius: '1rem',
                  padding: '1.75rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '1rem',
                  boxShadow: '0 0 20px rgba(139, 92, 246, 0.15)',
                  transition: 'all 300ms ease',
                  cursor: 'default',
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.borderColor = '#0092cc80';
                  (e.currentTarget as HTMLElement).style.boxShadow =
                    '0 0 30px rgba(139, 92, 246, 0.25)';
                  (e.currentTarget as HTMLElement).style.transform = 'translateY(-3px)';
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.borderColor = '#0092cc40';
                  (e.currentTarget as HTMLElement).style.boxShadow =
                    '0 0 20px rgba(139, 92, 246, 0.15)';
                  (e.currentTarget as HTMLElement).style.transform = 'translateY(0)';
                }}
              >
                <div style={{ display: 'flex', alignItems: 'start', gap: '1rem' }}>
                  <div style={{ fontSize: '1.75rem' }}>{insight.icon}</div>
                  <div style={{ flex: 1 }}>
                    <h3
                      style={{
                        fontSize: '1rem',
                        fontWeight: 700,
                        color: 'var(--foreground)',
                        marginBottom: '0.5rem',
                      }}
                    >
                      {insight.title}
                    </h3>
                    <p
                      style={{
                        fontSize: '0.875rem',
                        color: 'var(--foreground-muted)',
                        lineHeight: '1.6',
                      }}
                    >
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
                      background:
                        insight.priority === 'high'
                          ? '#EF444420'
                          : insight.priority === 'medium'
                            ? '#F59E0B20'
                            : '#22C55E20',
                      color:
                        insight.priority === 'high'
                          ? '#EF4444'
                          : insight.priority === 'medium'
                            ? '#F59E0B'
                            : '#22C55E',
                      width: 'fit-content',
                    }}
                  >
                    <span style={{ fontSize: '0.9rem' }}>●</span>
                    <span>
                      {insight.priority === 'high'
                        ? 'דחוף'
                        : insight.priority === 'medium'
                          ? 'בינוני'
                          : 'נמוך'}
                    </span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* SECTION 6: Recent Activity Timeline */}
        <div
          style={{
            animation: 'fadeIn 1800ms ease-out',
          }}
        >
          <h2
            style={{
              fontSize: '1.25rem',
              fontWeight: 700,
              marginBottom: '1.5rem',
              color: 'var(--foreground)',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
            }}
          >
            ⚡ פעילות אחרונה
          </h2>
          <div
            className="premium-card"
            style={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: '1rem',
              padding: '2rem',
              boxShadow: '0 0 20px rgba(0, 181, 254, 0.08)',
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
                    borderBottom:
                      idx < recentActivities.length - 1 ? '1px solid var(--border)' : 'none',
                  }}
                >
                  <div
                    style={{
                      width: '40px',
                      height: '40px',
                      borderRadius: '50%',
                      background: `${activity.color}20`,
                      border: `2px solid ${activity.color}40`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '1.25rem',
                      flexShrink: 0,
                      boxShadow: `0 0 12px ${activity.color}30`,
                    }}
                  >
                    {activity.icon}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'start',
                        marginBottom: '0.35rem',
                      }}
                    >
                      <h4
                        style={{
                          fontSize: '0.9375rem',
                          fontWeight: 700,
                          color: 'var(--foreground)',
                        }}
                      >
                        {activity.title}
                      </h4>
                      <span style={{ fontSize: '0.75rem', color: 'var(--foreground-muted)' }}>
                        {activity.time}
                      </span>
                    </div>
                    <p
                      style={{
                        fontSize: '0.8125rem',
                        color: 'var(--foreground-muted)',
                      }}
                    >
                      {activity.description}
                    </p>
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
