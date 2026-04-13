"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  useClients,
  useTasks,
  usePayments,
  useLeads,
  useEmployees,
  useCampaigns,
  useApprovals,
  usePodcastSessions,
} from "@/lib/api/use-entity";
import { useOperationalAlerts } from "@/lib/alerts/use-alerts";

/* ── Module definitions — mirrors preview renderAgencyDashboard() ── */
const modules = [
  { icon: "👤", title: "לקוחות", desc: "ניהול לקוחות, חוזים ויצירות קשר", route: "/clients", color: "#38bdf8", bg: "rgba(56,189,248,0.13)" },
  { icon: "📣", title: "קמפיינים", desc: "תכנון, אישור ותזמון קמפיינים לכל פלטפורמה", route: "/campaigns", color: "#a78bfa", bg: "rgba(167,139,250,0.13)" },
  { icon: "✨", title: "PixelFrameAI", desc: "יצירת תוכן ויזואלי מבוסס AI — תמונות, רילסים", route: "/projects/new", color: "#818cf8", bg: "rgba(129,140,248,0.13)" },
  { icon: "🎯", title: "לידים", desc: "עקוב אחר לידים, צינור מכירות וסגירת עסקאות", route: "/leads", color: "#34d399", bg: "rgba(52,211,153,0.13)" },
  { icon: "💳", title: "תשלומים", desc: "חשבוניות, גבייה ומעקב הכנסות", route: "/payments", color: "#fbbf24", bg: "rgba(251,191,36,0.13)" },
  { icon: "🧑‍💻", title: "צוות", desc: "ניהול עובדים, תפקידים ועומס עבודה", route: "/employees", color: "#f472b6", bg: "rgba(244,114,182,0.13)" },
  { icon: "📅", title: "משימות", desc: "לוח זמנים, משימות, עדיפויות ותזכורות", route: "/tasks", color: "#2dd4bf", bg: "rgba(45,212,191,0.13)" },
  { icon: "📊", title: "סטטיסטיקות", desc: "דוחות ביצועים, סטטיסטיקות ותובנות", route: "/stats", color: "#fb923c", bg: "rgba(251,146,60,0.13)" },
  { icon: "🎙️", title: "פודקאסט", desc: "ניהול הקלטות, לקוחות וסטטוס תוכן", route: "/accounting/podcast", color: "#E8F401", bg: "rgba(232,244,1,0.13)" },
  { icon: "📋", title: "פרויקטים", desc: "פרויקטי מיתוג, אתרים והוסטינג", route: "/business-projects", color: "#f97316", bg: "rgba(249,115,22,0.13)" },
  { icon: "💰", title: "הנהלת חשבונות", desc: "תשלומים, גביות ומסמכי רואה חשבון", route: "/accounting", color: "#10b981", bg: "rgba(16,185,129,0.13)" },
  { icon: "✅", title: "אישורים", desc: "מרכז אישורים לתוכן, וידאו ופרויקטים", route: "/approvals", color: "#ef4444", bg: "rgba(239,68,68,0.13)" },
  { icon: "🌐", title: "פורטל לקוח", desc: "גישת לקוחות לצפייה ואישור תוכן", route: "/client-portal", color: "#8b5cf6", bg: "rgba(139,92,246,0.13)" },
  { icon: "📈", title: "דשבורד מנהלים", desc: "מרכז שליטה, התראות ותובנות AI", route: "/exec-dashboard", color: "#ec4899", bg: "rgba(236,72,153,0.13)" },
];

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 5) return "לילה טוב";
  if (hour < 12) return "בוקר טוב";
  if (hour < 17) return "צהריים טובים";
  return "ערב טוב";
}

function getDateLabel(): string {
  return new Date().toLocaleDateString("he-IL", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("he-IL", {
    style: "currency",
    currency: "ILS",
  }).format(amount);
}

export default function DashboardPage() {
  const greeting = getGreeting();
  const dateLabel = getDateLabel();

  // Fetch data from hooks
  const { data: clients, loading: clientsLoading } = useClients();
  const { data: tasks, loading: tasksLoading } = useTasks();
  const { data: payments, loading: paymentsLoading } = usePayments();
  const { data: leads, loading: leadsLoading } = useLeads();
  const { data: employees, loading: employeesLoading } = useEmployees();
  const { data: campaigns, loading: campaignsLoading } = useCampaigns();
  const { data: approvals, loading: approvalsLoading } = useApprovals();
  const { data: podcastSessions, loading: podcastLoading } = usePodcastSessions();
  const { alerts, insights, criticalCount, warningCount } = useOperationalAlerts();

  // State for computed values
  const [stats, setStats] = useState({
    activeClients: 0,
    openTasks: 0,
    pendingPaymentsAmount: 0,
    pendingApprovalsCount: 0,
  });

  const [kpis, setKpis] = useState({
    activeClients: 0,
    leadsThisMonth: 0,
    monthlyRevenue: 0,
    overduePayments: 0,
    openTasks: 0,
    pendingApprovals: 0,
    activeCampaigns: 0,
    podcastSessionsThisMonth: 0,
  });

  const [urgentData, setUrgentData] = useState({
    overduePaymentsCount: 0,
    overduePaymentsTotal: 0,
    overdueTasksCount: 0,
    dueTodayFollowUpsCount: 0,
    clientsMissingGantt: 0,
  });

  const [financialSummary, setFinancialSummary] = useState({
    revenueThisMonth: 0,
    overdueTotal: 0,
    upcomingCollections: 0,
  });

  const [clientHealth, setClientHealth] = useState({
    missingGanttCount: 0,
    noManagerCount: 0,
  });

  const [leadsOverview, setLeadsOverview] = useState({
    activeLeads: 0,
    proposalsSent: 0,
    wonThisMonth: 0,
  });

  const [taskTeamOverview, setTaskTeamOverview] = useState({
    open: 0,
    overdue: 0,
    underReview: 0,
    busiestEmployee: { name: "", taskCount: 0 },
  });

  // Trends widget state
  const [trends, setTrends] = useState<Array<{
    id: string;
    name: string;
    relevanceScore: number;
    urgency: "high" | "medium" | "low";
    contentIdea: string;
  }>>([]);
  const [trendsLoading, setTrendsLoading] = useState(false);
  const [trendsError, setTrendsError] = useState(false);

  // Fetch trends from AI trend engine
  useEffect(() => {
    const fetchTrends = async () => {
      setTrendsLoading(true);
      setTrendsError(false);
      try {
        const response = await fetch("/api/ai/trend-engine", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            niche: "marketing",
            platforms: ["instagram", "tiktok", "facebook"],
            language: "he",
          }),
        });
        if (!response.ok) throw new Error("Failed to fetch trends");
        const data = await response.json();
        setTrends(data.trends || []);
      } catch (err) {
        console.error("Trend fetch error:", err);
        setTrendsError(true);
      } finally {
        setTrendsLoading(false);
      }
    };
    fetchTrends();
  }, []);

  // Compute all stats and KPIs
  useEffect(() => {
    // Header stats
    const activeClients = clients.filter((c) => c.status === "active").length;
    const openTasksCount = tasks.filter(
      (t) => t.status !== "completed" && t.status !== "approved"
    ).length;
    const pendingPaymentAmount = payments
      .filter((p) => p.status === "pending" || p.status === "overdue")
      .reduce((sum, p) => sum + p.amount, 0);
    const pendingApprovalsCount = approvals.filter(
      (a) => a.status === "pending_approval"
    ).length;

    setStats({
      activeClients,
      openTasks: openTasksCount,
      pendingPaymentsAmount: pendingPaymentAmount,
      pendingApprovalsCount,
    });

    // KPI Row
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    const leadsThisMonth = leads.filter((l) => {
      const created = new Date(l.createdAt);
      return created >= monthStart && created <= monthEnd;
    }).length;

    const revenueThisMonth = payments
      .filter((p) => {
        const paidDate = p.paidAt ? new Date(p.paidAt) : null;
        return p.status === "paid" && paidDate && paidDate >= monthStart && paidDate <= monthEnd;
      })
      .reduce((sum, p) => sum + p.amount, 0);

    const overduePaymentCount = payments.filter((p) => p.status === "overdue").length;
    const overdueTotal = payments
      .filter((p) => p.status === "overdue")
      .reduce((sum, p) => sum + p.amount, 0);

    const activeCampaignsCount = campaigns.filter((c) => c.status === "active").length;

    const podcastThisMonth = podcastSessions.filter((s) => {
      const d = new Date(s.sessionDate);
      return d >= monthStart && d <= monthEnd;
    }).length;

    setKpis({
      activeClients,
      leadsThisMonth,
      monthlyRevenue: revenueThisMonth,
      overduePayments: overduePaymentCount,
      openTasks: openTasksCount,
      pendingApprovals: pendingApprovalsCount,
      activeCampaigns: activeCampaignsCount,
      podcastSessionsThisMonth: podcastThisMonth,
    });

    // Urgent actions data
    const upcomingCollections = payments
      .filter((p) => p.status === "pending")
      .reduce((sum, p) => sum + p.amount, 0);

    const today = new Date().toDateString();
    const dueTodayFollowUps = leads.filter((l) => {
      if (!l.followUpAt) return false;
      return new Date(l.followUpAt).toDateString() === today;
    }).length;

    const clientsMissingGantt = clients.filter(
      (c) => !c.monthlyGanttStatus || c.monthlyGanttStatus === "none" || c.monthlyGanttStatus === "draft"
    ).length;

    setUrgentData({
      overduePaymentsCount: overduePaymentCount,
      overduePaymentsTotal: overdueTotal,
      overdueTasksCount: tasks.filter(
        (t) => t.dueDate && new Date(t.dueDate) < now && t.status !== "completed"
      ).length,
      dueTodayFollowUpsCount: dueTodayFollowUps,
      clientsMissingGantt,
    });

    // Financial summary
    const upcomingPayments = payments
      .filter((p) => {
        if (!p.dueDate) return false;
        const dueDate = new Date(p.dueDate);
        return dueDate > now && dueDate <= new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
      })
      .reduce((sum, p) => sum + p.amount, 0);

    setFinancialSummary({
      revenueThisMonth,
      overdueTotal,
      upcomingCollections: upcomingPayments,
    });

    // Client health
    const noManagerCount = clients.filter((c) => !c.assignedManagerId).length;

    setClientHealth({
      missingGanttCount: clientsMissingGantt,
      noManagerCount,
    });

    // Leads overview
    const activeLeadsCount = leads.filter((l) => l.status === "new" || l.status === "contacted" || l.status === "proposal_sent" || l.status === "negotiation").length;
    const proposalsSentCount = leads.filter((l) => l.proposalSent).length;
    const wonLeads = leads.filter((l) => {
      const created = new Date(l.createdAt);
      return l.status === "won" && created >= monthStart && created <= monthEnd;
    }).length;

    setLeadsOverview({
      activeLeads: activeLeadsCount,
      proposalsSent: proposalsSentCount,
      wonThisMonth: wonLeads,
    });

    // Task and team overview
    const openCount = tasks.filter(
      (t) => t.status === "new" || t.status === "in_progress"
    ).length;
    const overdueCount = tasks.filter(
      (t) => t.dueDate && new Date(t.dueDate) < now && t.status !== "completed"
    ).length;
    const underReviewCount = tasks.filter((t) => t.status === "under_review").length;

    // Find busiest employee
    const employeeTaskCounts: { [key: string]: number } = {};
    tasks.forEach((task) => {
      if (task.assigneeIds) {
        task.assigneeIds.forEach((id: string) => {
          employeeTaskCounts[id] = (employeeTaskCounts[id] || 0) + 1;
        });
      }
    });

    let busiestEmployee = { name: "—", taskCount: 0 };
    const maxTasksEmployeeId = Object.keys(employeeTaskCounts).sort(
      (a, b) => employeeTaskCounts[b] - employeeTaskCounts[a]
    )[0];
    if (maxTasksEmployeeId) {
      const emp = employees.find((e) => e.id === maxTasksEmployeeId);
      if (emp) {
        busiestEmployee = { name: emp.name, taskCount: employeeTaskCounts[maxTasksEmployeeId] };
      }
    }

    setTaskTeamOverview({
      open: openCount,
      overdue: overdueCount,
      underReview: underReviewCount,
      busiestEmployee,
    });
  }, [clients, tasks, payments, leads, employees, campaigns, approvals, podcastSessions]);

  return (
    <div className="mhd-root">
      {/* Background orbs */}
      <div className="mhd-orb mhd-orb-1" />
      <div className="mhd-orb mhd-orb-2" />
      <div className="mhd-orb mhd-orb-3" />

      <div className="mhd-content">
        {/* ── Enhanced Header with CEO Stats ── */}
        <div className="mhd-header">
          <div>
            <div className="mhd-greeting">
              {greeting}, <span className="mhd-greeting-name">טל</span> 👋
            </div>
            <div className="mhd-greeting-sub">
              מרכז פיקוד Studio Pixel — סקירת ביצועים בזמן אמת
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "0.75rem" }}>
            <div className="mhd-date-badge">📅 {dateLabel}</div>
            <div className="mhd-stats-row">
              <Link href="/clients" className="mhd-stat" style={{ textDecoration: "none" }}>
                <div className="mhd-stat-icon">👥</div>
                <div>
                  <div className="mhd-stat-val" style={{ color: "#38bdf8" }}>
                    {clientsLoading ? "..." : stats.activeClients}
                  </div>
                  <div className="mhd-stat-label">לקוחות פעילים</div>
                </div>
              </Link>
              <Link href="/tasks" className="mhd-stat" style={{ textDecoration: "none" }}>
                <div className="mhd-stat-icon">✅</div>
                <div>
                  <div className="mhd-stat-val" style={{ color: "#34d399" }}>
                    {tasksLoading ? "..." : stats.openTasks}
                  </div>
                  <div className="mhd-stat-label">משימות פתוחות</div>
                </div>
              </Link>
              <Link href="/payments" className="mhd-stat" style={{ textDecoration: "none" }}>
                <div className="mhd-stat-icon">💳</div>
                <div>
                  <div className="mhd-stat-val" style={{ color: "#fbbf24" }}>
                    {paymentsLoading ? "..." : formatCurrency(stats.pendingPaymentsAmount)}
                  </div>
                  <div className="mhd-stat-label">תשלומים ממתינים</div>
                </div>
              </Link>
              <Link href="/approvals" className="mhd-stat" style={{ textDecoration: "none" }}>
                <div className="mhd-stat-icon">📋</div>
                <div>
                  <div className="mhd-stat-val" style={{ color: "#ef4444" }}>
                    {approvalsLoading ? "..." : stats.pendingApprovalsCount}
                  </div>
                  <div className="mhd-stat-label">אישורים ממתינים</div>
                </div>
              </Link>
            </div>
          </div>
        </div>

        {/* ── URGENT ACTIONS STRIP ── */}
        <div
          style={{
            background: "rgba(239,68,68,0.06)",
            border: "1px solid rgba(239,68,68,0.15)",
            borderRadius: "0.75rem",
            padding: "1.25rem",
            marginBottom: "1.75rem",
            direction: "rtl",
          }}
        >
          <div style={{ fontSize: "0.875rem", fontWeight: 600, marginBottom: "0.75rem", color: "#ef4444" }}>
            🚨 צריך טיפול עכשיו
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
              gap: "1rem",
            }}
          >
            {/* Overdue Payments */}
            <Link
              href="/accounting"
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.75rem",
                padding: "0.75rem",
                background: "var(--surface)",
                border: "1px solid var(--border)",
                borderRadius: "0.5rem",
                textDecoration: "none",
                color: "inherit",
                transition: "all 0.2s",
              }}
              onMouseEnter={(e) => {
                const el = e.currentTarget as HTMLElement;
                el.style.borderColor = "#ef4444";
                el.style.background = "rgba(239,68,68,0.05)";
              }}
              onMouseLeave={(e) => {
                const el = e.currentTarget as HTMLElement;
                el.style.borderColor = "var(--border)";
                el.style.background = "var(--surface)";
              }}
            >
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: "0.75rem", color: "var(--foreground-muted)" }}>תשלומים בפיגור</div>
                <div style={{ fontSize: "1.25rem", fontWeight: 700, color: "#ef4444" }}>
                  {urgentData.overduePaymentsCount}
                </div>
                <div style={{ fontSize: "0.7rem", color: "var(--foreground-muted)" }}>
                  {formatCurrency(urgentData.overduePaymentsTotal)}
                </div>
              </div>
            </Link>

            {/* Overdue Tasks */}
            <Link
              href="/tasks"
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.75rem",
                padding: "0.75rem",
                background: "var(--surface)",
                border: "1px solid var(--border)",
                borderRadius: "0.5rem",
                textDecoration: "none",
                color: "inherit",
                transition: "all 0.2s",
              }}
              onMouseEnter={(e) => {
                const el = e.currentTarget as HTMLElement;
                el.style.borderColor = "#ef4444";
                el.style.background = "rgba(239,68,68,0.05)";
              }}
              onMouseLeave={(e) => {
                const el = e.currentTarget as HTMLElement;
                el.style.borderColor = "var(--border)";
                el.style.background = "var(--surface)";
              }}
            >
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: "0.75rem", color: "var(--foreground-muted)" }}>משימות בפיגור</div>
                <div style={{ fontSize: "1.25rem", fontWeight: 700, color: "#f97316" }}>
                  {urgentData.overdueTasksCount}
                </div>
              </div>
            </Link>

            {/* Pending Approvals */}
            <Link
              href="/approvals"
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.75rem",
                padding: "0.75rem",
                background: "var(--surface)",
                border: "1px solid var(--border)",
                borderRadius: "0.5rem",
                textDecoration: "none",
                color: "inherit",
                transition: "all 0.2s",
              }}
              onMouseEnter={(e) => {
                const el = e.currentTarget as HTMLElement;
                el.style.borderColor = "#ef4444";
                el.style.background = "rgba(239,68,68,0.05)";
              }}
              onMouseLeave={(e) => {
                const el = e.currentTarget as HTMLElement;
                el.style.borderColor = "var(--border)";
                el.style.background = "var(--surface)";
              }}
            >
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: "0.75rem", color: "var(--foreground-muted)" }}>אישורים ממתינים</div>
                <div style={{ fontSize: "1.25rem", fontWeight: 700, color: "#ef4444" }}>
                  {stats.pendingApprovalsCount}
                </div>
              </div>
            </Link>

            {/* Follow-ups Today */}
            <Link
              href="/leads"
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.75rem",
                padding: "0.75rem",
                background: "var(--surface)",
                border: "1px solid var(--border)",
                borderRadius: "0.5rem",
                textDecoration: "none",
                color: "inherit",
                transition: "all 0.2s",
              }}
              onMouseEnter={(e) => {
                const el = e.currentTarget as HTMLElement;
                el.style.borderColor = "#f97316";
                el.style.background = "rgba(249,115,22,0.05)";
              }}
              onMouseLeave={(e) => {
                const el = e.currentTarget as HTMLElement;
                el.style.borderColor = "var(--border)";
                el.style.background = "var(--surface)";
              }}
            >
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: "0.75rem", color: "var(--foreground-muted)" }}>פולואפים היום</div>
                <div style={{ fontSize: "1.25rem", fontWeight: 700, color: "#f97316" }}>
                  {urgentData.dueTodayFollowUpsCount}
                </div>
              </div>
            </Link>

            {/* Clients Missing Gantt */}
            <Link
              href="/clients"
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.75rem",
                padding: "0.75rem",
                background: "var(--surface)",
                border: "1px solid var(--border)",
                borderRadius: "0.5rem",
                textDecoration: "none",
                color: "inherit",
                transition: "all 0.2s",
              }}
              onMouseEnter={(e) => {
                const el = e.currentTarget as HTMLElement;
                el.style.borderColor = "#f59e0b";
                el.style.background = "rgba(245,158,11,0.05)";
              }}
              onMouseLeave={(e) => {
                const el = e.currentTarget as HTMLElement;
                el.style.borderColor = "var(--border)";
                el.style.background = "var(--surface)";
              }}
            >
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: "0.75rem", color: "var(--foreground-muted)" }}>לקוחות ללא תוכנית</div>
                <div style={{ fontSize: "1.25rem", fontWeight: 700, color: "#f59e0b" }}>
                  {urgentData.clientsMissingGantt}
                </div>
              </div>
            </Link>
          </div>
        </div>

        {/* ── KPI ROW ── */}
        <div style={{ marginBottom: "1.75rem" }}>
          <div className="mhd-section-label">מדדי ביצוע עיקריים</div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
              gap: "1rem",
            }}
          >
            {/* Active Clients */}
            <div
              style={{
                background: "var(--surface)",
                border: "1px solid var(--border)",
                borderRadius: "0.75rem",
                padding: "1.25rem",
                textAlign: "center",
              }}
            >
              <div style={{ fontSize: "2.5rem", fontWeight: 800, color: "#38bdf8", marginBottom: "0.25rem" }}>
                {kpis.activeClients}
              </div>
              <div style={{ fontSize: "0.75rem", color: "var(--foreground-muted)", fontWeight: 500 }}>
                לקוחות פעילים
              </div>
            </div>

            {/* Leads This Month */}
            <div
              style={{
                background: "var(--surface)",
                border: "1px solid var(--border)",
                borderRadius: "0.75rem",
                padding: "1.25rem",
                textAlign: "center",
              }}
            >
              <div style={{ fontSize: "2.5rem", fontWeight: 800, color: "#34d399", marginBottom: "0.25rem" }}>
                {kpis.leadsThisMonth}
              </div>
              <div style={{ fontSize: "0.75rem", color: "var(--foreground-muted)", fontWeight: 500 }}>
                לידים החודש
              </div>
            </div>

            {/* Monthly Revenue */}
            <div
              style={{
                background: "var(--surface)",
                border: "1px solid var(--border)",
                borderRadius: "0.75rem",
                padding: "1.25rem",
                textAlign: "center",
              }}
            >
              <div style={{ fontSize: "1.5rem", fontWeight: 800, color: "#10b981", marginBottom: "0.25rem" }}>
                {formatCurrency(kpis.monthlyRevenue)}
              </div>
              <div style={{ fontSize: "0.75rem", color: "var(--foreground-muted)", fontWeight: 500 }}>
                הכנסה החודש
              </div>
            </div>

            {/* Overdue Payments */}
            <div
              style={{
                background: "var(--surface)",
                border: "1px solid var(--border)",
                borderRadius: "0.75rem",
                padding: "1.25rem",
                textAlign: "center",
              }}
            >
              <div style={{ fontSize: "2.5rem", fontWeight: 800, color: "#ef4444", marginBottom: "0.25rem" }}>
                {kpis.overduePayments}
              </div>
              <div style={{ fontSize: "0.75rem", color: "var(--foreground-muted)", fontWeight: 500 }}>
                תשלומים בפיגור
              </div>
            </div>

            {/* Open Tasks */}
            <div
              style={{
                background: "var(--surface)",
                border: "1px solid var(--border)",
                borderRadius: "0.75rem",
                padding: "1.25rem",
                textAlign: "center",
              }}
            >
              <div style={{ fontSize: "2.5rem", fontWeight: 800, color: "#2dd4bf", marginBottom: "0.25rem" }}>
                {kpis.openTasks}
              </div>
              <div style={{ fontSize: "0.75rem", color: "var(--foreground-muted)", fontWeight: 500 }}>
                משימות פתוחות
              </div>
            </div>

            {/* Pending Approvals */}
            <div
              style={{
                background: "var(--surface)",
                border: "1px solid var(--border)",
                borderRadius: "0.75rem",
                padding: "1.25rem",
                textAlign: "center",
              }}
            >
              <div style={{ fontSize: "2.5rem", fontWeight: 800, color: "#f59e0b", marginBottom: "0.25rem" }}>
                {kpis.pendingApprovals}
              </div>
              <div style={{ fontSize: "0.75rem", color: "var(--foreground-muted)", fontWeight: 500 }}>
                אישורים ממתינים
              </div>
            </div>

            {/* Active Campaigns */}
            <div
              style={{
                background: "var(--surface)",
                border: "1px solid var(--border)",
                borderRadius: "0.75rem",
                padding: "1.25rem",
                textAlign: "center",
              }}
            >
              <div style={{ fontSize: "2.5rem", fontWeight: 800, color: "#a78bfa", marginBottom: "0.25rem" }}>
                {kpis.activeCampaigns}
              </div>
              <div style={{ fontSize: "0.75rem", color: "var(--foreground-muted)", fontWeight: 500 }}>
                קמפיינים פעילים
              </div>
            </div>

            {/* Podcast Sessions This Month */}
            <div
              style={{
                background: "var(--surface)",
                border: "1px solid var(--border)",
                borderRadius: "0.75rem",
                padding: "1.25rem",
                textAlign: "center",
              }}
            >
              <div style={{ fontSize: "2.5rem", fontWeight: 800, color: "#E8F401", marginBottom: "0.25rem" }}>
                {kpis.podcastSessionsThisMonth}
              </div>
              <div style={{ fontSize: "0.75rem", color: "var(--foreground-muted)", fontWeight: 500 }}>
                פודקאסטים החודש
              </div>
            </div>
          </div>
        </div>

        {/* ── QUICK SECTIONS (2-Column Grid) ── */}
        <div style={{ marginBottom: "1.75rem" }}>
          <div className="mhd-section-label">סקירה מהירה</div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
              gap: "1rem",
            }}
          >
            {/* Financial Summary */}
            <div
              style={{
                background: "var(--surface)",
                border: "1px solid var(--border)",
                borderRadius: "0.75rem",
                padding: "1.25rem",
              }}
            >
              <div style={{ fontSize: "0.875rem", fontWeight: 600, marginBottom: "1rem", color: "#10b981" }}>
                💰 סיכום כלכלי
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: "0.75rem", color: "var(--foreground-muted)" }}>הכנסה החודש</span>
                  <span style={{ fontSize: "1rem", fontWeight: 700, color: "#10b981" }}>
                    {formatCurrency(financialSummary.revenueThisMonth)}
                  </span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: "0.75rem", color: "var(--foreground-muted)" }}>בפיגור</span>
                  <span style={{ fontSize: "1rem", fontWeight: 700, color: "#ef4444" }}>
                    {formatCurrency(financialSummary.overdueTotal)}
                  </span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: "0.75rem", color: "var(--foreground-muted)" }}>הוצאות קרובות</span>
                  <span style={{ fontSize: "1rem", fontWeight: 700, color: "#38bdf8" }}>
                    {formatCurrency(financialSummary.upcomingCollections)}
                  </span>
                </div>
              </div>
              <Link
                href="/accounting"
                style={{
                  display: "inline-block",
                  marginTop: "0.75rem",
                  fontSize: "0.75rem",
                  color: "#10b981",
                  textDecoration: "none",
                  fontWeight: 500,
                }}
              >
                צפה בפרטים ←
              </Link>
            </div>

            {/* Client Health */}
            <div
              style={{
                background: "var(--surface)",
                border: "1px solid var(--border)",
                borderRadius: "0.75rem",
                padding: "1.25rem",
              }}
            >
              <div style={{ fontSize: "0.875rem", fontWeight: 600, marginBottom: "1rem", color: "#38bdf8" }}>
                👥 בריאות לקוחות
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: "0.75rem", color: "var(--foreground-muted)" }}>ללא תוכנית</span>
                  <span style={{ fontSize: "1rem", fontWeight: 700, color: "#f59e0b" }}>
                    {clientHealth.missingGanttCount}
                  </span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: "0.75rem", color: "var(--foreground-muted)" }}>ללא מנהל</span>
                  <span style={{ fontSize: "1rem", fontWeight: 700, color: "#a78bfa" }}>
                    {clientHealth.noManagerCount}
                  </span>
                </div>
              </div>
              <Link
                href="/clients"
                style={{
                  display: "inline-block",
                  marginTop: "0.75rem",
                  fontSize: "0.75rem",
                  color: "#38bdf8",
                  textDecoration: "none",
                  fontWeight: 500,
                }}
              >
                צפה בלקוחות ←
              </Link>
            </div>

            {/* Leads Overview */}
            <div
              style={{
                background: "var(--surface)",
                border: "1px solid var(--border)",
                borderRadius: "0.75rem",
                padding: "1.25rem",
              }}
            >
              <div style={{ fontSize: "0.875rem", fontWeight: 600, marginBottom: "1rem", color: "#34d399" }}>
                🎯 סקירת לידים
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: "0.75rem", color: "var(--foreground-muted)" }}>לידים פעילים</span>
                  <span style={{ fontSize: "1rem", fontWeight: 700, color: "#34d399" }}>
                    {leadsOverview.activeLeads}
                  </span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: "0.75rem", color: "var(--foreground-muted)" }}>הצעות שנשלחו</span>
                  <span style={{ fontSize: "1rem", fontWeight: 700, color: "#2dd4bf" }}>
                    {leadsOverview.proposalsSent}
                  </span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: "0.75rem", color: "var(--foreground-muted)" }}>זכו החודש</span>
                  <span style={{ fontSize: "1rem", fontWeight: 700, color: "#10b981" }}>
                    {leadsOverview.wonThisMonth}
                  </span>
                </div>
              </div>
              <Link
                href="/leads"
                style={{
                  display: "inline-block",
                  marginTop: "0.75rem",
                  fontSize: "0.75rem",
                  color: "#34d399",
                  textDecoration: "none",
                  fontWeight: 500,
                }}
              >
                צפה בלידים ←
              </Link>
            </div>

            {/* Tasks & Team Overview */}
            <div
              style={{
                background: "var(--surface)",
                border: "1px solid var(--border)",
                borderRadius: "0.75rem",
                padding: "1.25rem",
              }}
            >
              <div style={{ fontSize: "0.875rem", fontWeight: 600, marginBottom: "1rem", color: "#2dd4bf" }}>
                👨‍💼 משימות וצוות
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: "0.75rem", color: "var(--foreground-muted)" }}>פתוחות</span>
                  <span style={{ fontSize: "1rem", fontWeight: 700, color: "#34d399" }}>
                    {taskTeamOverview.open}
                  </span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: "0.75rem", color: "var(--foreground-muted)" }}>בפיגור</span>
                  <span style={{ fontSize: "1rem", fontWeight: 700, color: "#ef4444" }}>
                    {taskTeamOverview.overdue}
                  </span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: "0.75rem", color: "var(--foreground-muted)" }}>בביקורת</span>
                  <span style={{ fontSize: "1rem", fontWeight: 700, color: "#f59e0b" }}>
                    {taskTeamOverview.underReview}
                  </span>
                </div>
                <div
                  style={{
                    paddingTop: "0.75rem",
                    borderTop: "1px solid var(--border)",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <span style={{ fontSize: "0.75rem", color: "var(--foreground-muted)" }}>עובד עסוק ביותר</span>
                  <span style={{ fontSize: "0.875rem", fontWeight: 700 }}>
                    {taskTeamOverview.busiestEmployee.name} ({taskTeamOverview.busiestEmployee.taskCount})
                  </span>
                </div>
              </div>
              <Link
                href="/tasks"
                style={{
                  display: "inline-block",
                  marginTop: "0.75rem",
                  fontSize: "0.75rem",
                  color: "#2dd4bf",
                  textDecoration: "none",
                  fontWeight: 500,
                }}
              >
                צפה בלוח ←
              </Link>
            </div>
          </div>
        </div>

        {/* ── Trends Widget ── */}
        <div style={{ marginBottom: "1.75rem" }}>
          <div style={{ marginBottom: "0.75rem" }}>
            <div className="mhd-section-label">🔥 מה חם השבוע</div>
            <div style={{ fontSize: "0.875rem", color: "var(--foreground-muted)" }}>
              טרנדים ורעיונות תוכן מבוסס AI
            </div>
          </div>
          <div style={{
            background: "linear-gradient(135deg, rgba(239, 68, 68, 0.05) 0%, rgba(249, 115, 22, 0.05) 100%)",
            border: "1px solid rgba(239, 68, 68, 0.1)",
            borderRadius: "0.75rem",
            padding: "1.25rem",
            direction: "rtl",
          }}>
            {trendsLoading ? (
              <div style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
                gap: "1rem",
              }}>
                {[1, 2, 3].map((i) => (
                  <div
                    key={i}
                    style={{
                      background: "var(--surface-raised)",
                      border: "1px solid var(--border)",
                      borderRadius: "0.5rem",
                      padding: "1rem",
                      animation: "pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite",
                      height: "150px",
                    }}
                  />
                ))}
              </div>
            ) : trendsError || trends.length === 0 ? (
              <div style={{
                textAlign: "center",
                padding: "2rem 1rem",
                color: "var(--foreground-muted)",
                fontSize: "0.875rem",
              }}>
                אין טרנדים זמינים כרגע
              </div>
            ) : (
              <div style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
                gap: "1rem",
              }}>
                {trends.slice(0, 4).map((trend) => (
                  <div
                    key={trend.id}
                    style={{
                      background: "var(--surface-raised)",
                      border: "1px solid var(--border)",
                      borderRadius: "0.5rem",
                      padding: "1rem",
                      cursor: "pointer",
                      transition: "all 0.2s ease",
                    }}
                    onMouseEnter={(e) => {
                      const el = e.currentTarget as HTMLElement;
                      el.style.borderColor = "#ef4444";
                      el.style.background = "rgba(239, 68, 68, 0.05)";
                    }}
                    onMouseLeave={(e) => {
                      const el = e.currentTarget as HTMLElement;
                      el.style.borderColor = "var(--border)";
                      el.style.background = "var(--surface-raised)";
                    }}
                  >
                    <div style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "flex-start",
                      marginBottom: "0.75rem",
                    }}>
                      <div style={{
                        fontSize: "0.875rem",
                        fontWeight: 600,
                        color: "var(--foreground)",
                        flex: 1,
                      }}>
                        {trend.name}
                      </div>
                      <div style={{
                        display: "inline-block",
                        fontSize: "0.625rem",
                        fontWeight: 700,
                        padding: "0.25rem 0.5rem",
                        borderRadius: "0.25rem",
                        background: trend.urgency === "high"
                          ? "rgba(239, 68, 68, 0.15)"
                          : trend.urgency === "medium"
                          ? "rgba(249, 115, 22, 0.15)"
                          : "rgba(34, 197, 94, 0.15)",
                        color: trend.urgency === "high"
                          ? "#ef4444"
                          : trend.urgency === "medium"
                          ? "#f97316"
                          : "#22c55e",
                        whiteSpace: "nowrap",
                        marginRight: "0.5rem",
                      }}>
                        {trend.urgency === "high" ? "דחוף" : trend.urgency === "medium" ? "בינוני" : "רגיל"}
                      </div>
                    </div>
                    <div style={{
                      fontSize: "0.75rem",
                      color: "var(--foreground-muted)",
                      marginBottom: "0.75rem",
                      lineHeight: 1.5,
                    }}>
                      {trend.contentIdea}
                    </div>
                    <div style={{
                      fontSize: "0.7rem",
                      color: "var(--foreground-muted)",
                      display: "flex",
                      alignItems: "center",
                      gap: "0.5rem",
                    }}>
                      <div style={{
                        flex: 1,
                        height: "0.375rem",
                        background: "var(--border)",
                        borderRadius: "0.125rem",
                        overflow: "hidden",
                      }}>
                        <div style={{
                          height: "100%",
                          width: `${Math.max(20, trend.relevanceScore)}%`,
                          background: trend.relevanceScore >= 75
                            ? "#22c55e"
                            : trend.relevanceScore >= 50
                            ? "#f59e0b"
                            : "#ef4444",
                          transition: "width 0.3s ease",
                        }} />
                      </div>
                      <span>{Math.round(trend.relevanceScore)}%</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── Module grid (KEEP AS IS) ── */}
        <div style={{ marginBottom: "1.75rem" }}>
          <div className="mhd-section-label">מודולי המערכת</div>
          <div className="mhd-grid">
            {modules.map((m) => (
              <Link
                key={m.title}
                href={m.route}
                className="mhd-card"
                style={{ "--mc": m.color, textDecoration: "none" } as React.CSSProperties}
              >
                <div
                  className="mhd-card-icon"
                  style={{ background: m.bg, boxShadow: `0 0 0 1px ${m.color}28` }}
                >
                  <span style={{ filter: `drop-shadow(0 2px 10px ${m.color}90)` }}>
                    {m.icon}
                  </span>
                </div>
                <div className="mhd-card-title">{m.title}</div>
                <div className="mhd-card-desc">{m.desc}</div>
                <div className="mhd-card-footer">
                  <span className="mhd-card-arrow" style={{ color: m.color }}>
                    ←
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* ── AI INSIGHTS ── */}
        {insights.length > 0 && (
          <div style={{ marginBottom: "1.75rem" }}>
            <div className="mhd-section-label">✨ תובנות AI</div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
                gap: "1rem",
              }}
            >
              {insights.slice(0, 3).map((insight, idx) => (
                <div
                  key={idx}
                  style={{
                    background: "var(--surface)",
                    border: "1px solid var(--border)",
                    borderRadius: "0.75rem",
                    padding: "1.25rem",
                  }}
                >
                  <div style={{ fontSize: "1.5rem", marginBottom: "0.5rem" }}>
                    {insight.icon}
                  </div>
                  <div style={{ fontSize: "0.875rem", fontWeight: 600, marginBottom: "0.5rem" }}>
                    {insight.title}
                  </div>
                  <div style={{ fontSize: "0.75rem", color: "var(--foreground-muted)", lineHeight: 1.5 }}>
                    {insight.description}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── System Alerts ── */}
        {alerts.length > 0 && (
          <div>
            <div className="mhd-section-label">🔔 התראות המערכת</div>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              {alerts.slice(0, 5).map((alert, idx) => (
                <div
                  key={idx}
                  style={{
                    background: "var(--surface)",
                    border: "1px solid var(--border)",
                    borderRadius: "0.5rem",
                    padding: "0.75rem",
                    fontSize: "0.875rem",
                    display: "flex",
                    gap: "0.75rem",
                    alignItems: "flex-start",
                  }}
                >
                  <div
                    style={{
                      display: "inline-block",
                      width: "0.5rem",
                      height: "0.5rem",
                      borderRadius: "50%",
                      background: alert.severity === "critical" ? "#ef4444" : "#f59e0b",
                      marginTop: "0.35rem",
                      flexShrink: 0,
                    }}
                  />
                  <div>
                    <div style={{ fontWeight: 600 }}>{alert.title}</div>
                    <div style={{ fontSize: "0.75rem", color: "var(--foreground-muted)" }}>
                      {alert.description}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
