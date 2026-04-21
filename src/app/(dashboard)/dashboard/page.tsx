"use client";

import { useState, useEffect, useMemo } from "react";
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
  useProjectPayments,
  useBusinessProjects,
  useSocialPosts,
} from "@/lib/api/use-entity";
import { useOperationalAlerts } from "@/lib/alerts/use-alerts";
import { SkeletonKPIRow, SkeletonGrid } from "@/components/ui/skeleton";
import { AIInsightsPanel, generateInsights } from "@/components/ai-insights-panel";
import SmartWeeklyCalendar from "@/components/ui/SmartWeeklyCalendar";
import { AnimatedCounter } from "@/components/ui/animated-counter";

/* ── Module definitions ── */
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

const QUICK_ACTIONS = [
  { icon: "👤", label: "לקוח חדש", route: "/clients", color: "#38bdf8" },
  { icon: "📅", label: "משימה חדשה", route: "/tasks", color: "#2dd4bf" },
  { icon: "📣", label: "קמפיין חדש", route: "/campaigns", color: "#a78bfa" },
  { icon: "📝", label: "פוסט חדש", route: "/projects/new", color: "#818cf8" },
  { icon: "🎙️", label: "הקלטה חדשה", route: "/accounting/podcast", color: "#E8F401" },
  { icon: "📋", label: "פרויקט חדש", route: "/business-projects", color: "#f97316" },
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
  return new Intl.NumberFormat("he-IL", { style: "currency", currency: "ILS", minimumFractionDigits: 0 }).format(amount);
}

/* ── KPI Card ── */
function KPICard({ value, label, color, icon, href }: {
  value: string | number; label: string; color: string; icon: string; href: string;
}) {
  return (
    <Link href={href} className="premium-card ux-card ux-light-sweep glow-hover" style={{ textDecoration: "none", textAlign: "center", padding: "1.25rem 1rem" }}>
      <div style={{ fontSize: "1.5rem", marginBottom: "0.5rem" }}>{icon}</div>
      <div style={{ fontSize: "2rem", fontWeight: 800, color, lineHeight: 1, marginBottom: "0.35rem", letterSpacing: "-0.02em" }}>
        {typeof value === "number" ? <AnimatedCounter value={value} /> : value}
      </div>
      <div style={{ fontSize: "0.72rem", color: "var(--foreground-muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" }}>
        {label}
      </div>
    </Link>
  );
}

/* ── Summary pane ── */
function SummaryPane({ title, icon, color, rows, href, linkText }: {
  title: string; icon: string; color: string;
  rows: Array<{ label: string; value: string | number; color?: string }>;
  href: string; linkText: string;
}) {
  return (
    <div className="premium-card ux-card ux-card-glow" style={{ direction: "rtl" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "1rem" }}>
        <span style={{ fontSize: "1.125rem" }}>{icon}</span>
        <span style={{ fontSize: "0.875rem", fontWeight: 700, color }}>{title}</span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
        {rows.map((r) => (
          <div key={r.label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: "0.8rem", color: "var(--foreground-muted)" }}>{r.label}</span>
            <span style={{ fontSize: "1rem", fontWeight: 700, color: r.color || "var(--foreground)" }}>{r.value}</span>
          </div>
        ))}
      </div>
      <Link href={href} style={{ display: "inline-block", marginTop: "0.75rem", fontSize: "0.75rem", color, textDecoration: "none", fontWeight: 600 }}>
        {linkText} ←
      </Link>
    </div>
  );
}

/* ── Timeline item ── */
function TimelineItem({ icon, title, subtitle, time, color }: {
  icon: string; title: string; subtitle: string; time: string; color: string;
}) {
  return (
    <div className="timeline-item ux-stagger-item">
      <div className="timeline-dot" style={{ borderColor: `${color}40`, background: `${color}15` }}>
        {icon}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", gap: "0.5rem" }}>
          <span style={{ fontSize: "0.8125rem", fontWeight: 700, color: "var(--foreground)" }}>{title}</span>
          <span style={{ fontSize: "0.7rem", color: "var(--foreground-subtle)", whiteSpace: "nowrap" }}>{time}</span>
        </div>
        <div style={{ fontSize: "0.75rem", color: "var(--foreground-muted)", marginTop: "0.15rem" }}>{subtitle}</div>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const greeting = getGreeting();
  const dateLabel = getDateLabel();

  const { data: clients, loading: cL } = useClients();
  const { data: tasks, loading: tL } = useTasks();
  const { data: payments, loading: pL } = usePayments();
  const { data: leads, loading: lL } = useLeads();
  const { data: employees, loading: eL } = useEmployees();
  const { data: campaigns, loading: caL } = useCampaigns();
  const { data: approvals, loading: aL } = useApprovals();
  const { data: podcastSessions, loading: poL } = usePodcastSessions();
  const { data: projectPayments, loading: ppL } = useProjectPayments();
  const { data: businessProjects, loading: bpL } = useBusinessProjects();
  const { data: socialPosts, loading: spL } = useSocialPosts();
  const { alerts, insights: opInsights } = useOperationalAlerts();

  const isLoading = cL || tL || pL || lL || eL || caL || aL || poL || ppL || bpL || spL;

  // Trends
  const [trends, setTrends] = useState<Array<{ id: string; name: string; relevanceScore: number; urgency: "high" | "medium" | "low"; contentIdea: string }>>([]);
  const [trendsLoading, setTrendsLoading] = useState(false);

  useEffect(() => {
    setTrendsLoading(true);
    fetch("/api/ai/trend-engine", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ niche: "marketing", platforms: ["instagram", "tiktok", "facebook"], language: "he" }),
    })
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(d => setTrends(d.trends || []))
      .catch(() => {})
      .finally(() => setTrendsLoading(false));
  }, []);

  // Computed analytics
  const analytics = useMemo(() => {
    if (isLoading) return null;
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    const today = now.toDateString();

    const activeClients = clients.filter(c => c.status === "active").length;
    const openTasks = tasks.filter(t => t.status !== "completed" && t.status !== "approved").length;
    const overdueTasks = tasks.filter(t => t.dueDate && new Date(t.dueDate) < now && t.status !== "completed").length;
    const underReview = tasks.filter(t => t.status === "under_review").length;
    const pendingApprovals = approvals.filter(a => a.status === "pending_approval").length;

    const generalPending = payments.filter(p => p.status === "pending" || p.status === "overdue").reduce((s, p) => s + p.amount, 0);
    const projectPending = (projectPayments || []).filter((p: any) => ["pending", "overdue", "collection_needed"].includes(p.status)).reduce((s: number, p: any) => s + (Number(p.amount) || 0), 0);
    const pendingPayments = generalPending + projectPending;

    const generalRevenue = payments.filter(p => p.status === "paid" && p.paidAt && new Date(p.paidAt) >= monthStart && new Date(p.paidAt) <= monthEnd).reduce((s, p) => s + p.amount, 0);
    const projectRevenue = (projectPayments || []).filter((p: any) => p.status === "paid" && p.paidAt && new Date(p.paidAt) >= monthStart && new Date(p.paidAt) <= monthEnd).reduce((s: number, p: any) => s + (Number(p.amount) || 0), 0);
    const revenue = generalRevenue + projectRevenue;

    const generalOverdue = payments.filter(p => p.status === "overdue");
    const projectOverdue = (projectPayments || []).filter((p: any) => p.status === "overdue");
    const overduePaymentsCount = generalOverdue.length + projectOverdue.length;
    const overdueTotal = generalOverdue.reduce((s, p) => s + p.amount, 0) + projectOverdue.reduce((s: number, p: any) => s + (Number(p.amount) || 0), 0);

    const leadsThisMonth = leads.filter(l => { const d = new Date(l.createdAt); return d >= monthStart && d <= monthEnd; }).length;
    const activeLeads = leads.filter(l => ["new", "contacted", "proposal_sent", "negotiation"].includes(l.status || "")).length;
    const wonLeads = leads.filter(l => l.status === "won" && new Date(l.createdAt) >= monthStart).length;

    const activeCampaigns = campaigns.filter(c => c.status === "active").length;
    const podcastThisMonth = podcastSessions.filter(s => { const d = new Date(s.sessionDate); return d >= monthStart && d <= monthEnd; }).length;

    const dueTodayFollowUps = leads.filter(l => l.followUpAt && new Date(l.followUpAt).toDateString() === today).length;
    const clientsMissingGantt = clients.filter(c => !c.monthlyGanttStatus || c.monthlyGanttStatus === "none" || c.monthlyGanttStatus === "draft").length;
    const noManagerCount = clients.filter(c => !c.assignedManagerId).length;

    const generalUpcoming = payments.filter(p => { if (!p.dueDate) return false; const d = new Date(p.dueDate); return d > now && d <= new Date(now.getTime() + 30 * 86400000); }).reduce((s, p) => s + p.amount, 0);
    const projectUpcoming = (projectPayments || []).filter((p: any) => { if (!p.dueDate) return false; const d = new Date(p.dueDate); return d > now && d <= new Date(now.getTime() + 30 * 86400000); }).reduce((s: number, p: any) => s + (Number(p.amount) || 0), 0);

    const projectsTotalValue = (businessProjects || []).filter((p: any) => p.projectStatus !== "completed").reduce((s: number, p: any) => s + (Number(p.budget) || 0), 0);

    // Busiest employee
    const empCounts: Record<string, number> = {};
    tasks.forEach(t => { if (t.assigneeIds) t.assigneeIds.forEach((id: string) => { empCounts[id] = (empCounts[id] || 0) + 1; }); });
    const busiestId = Object.keys(empCounts).sort((a, b) => empCounts[b] - empCounts[a])[0];
    const busiestEmp = busiestId ? employees.find(e => e.id === busiestId) : null;

    // Today timeline items
    const todayTasks = tasks.filter(t => t.dueDate && new Date(t.dueDate).toDateString() === today).slice(0, 5);
    const todayPodcasts = podcastSessions.filter(s => new Date(s.sessionDate).toDateString() === today).slice(0, 3);

    return {
      activeClients, openTasks, overdueTasks, underReview, pendingApprovals,
      pendingPayments, revenue, overduePaymentsCount, overdueTotal,
      leadsThisMonth, activeLeads, wonLeads, activeCampaigns, podcastThisMonth,
      dueTodayFollowUps, clientsMissingGantt, noManagerCount,
      upcomingCollections: generalUpcoming + projectUpcoming,
      projectsTotalValue,
      busiestEmployee: busiestEmp ? { name: busiestEmp.name, count: empCounts[busiestId] } : { name: "—", count: 0 },
      todayTasks, todayPodcasts,
    };
  }, [isLoading, clients, tasks, payments, leads, employees, campaigns, approvals, podcastSessions, projectPayments, businessProjects, socialPosts]);

  // AI Insights
  const aiInsights = useMemo(() => {
    if (isLoading) return [];
    return generateInsights({ tasks, clients, approvals, payments, campaigns, socialPosts });
  }, [isLoading, tasks, clients, approvals, payments, campaigns, socialPosts]);

  return (
    <div className="mhd-root">
      {/* Background orbs */}
      <div className="mhd-orb mhd-orb-1" />
      <div className="mhd-orb mhd-orb-2" />
      <div className="mhd-orb mhd-orb-3" />

      <div className="mhd-content stagger-in">
        {/* ═══ 1. HERO SECTION ═══ */}
        <div className="mhd-header">
          <div>
            <div className="mhd-greeting">
              {greeting}, <span className="mhd-greeting-name">טל</span> 👋
            </div>
            <div style={{ display: "inline-flex", alignItems: "center", gap: "0.5rem", marginTop: "0.25rem" }}>
              <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#22c55e", boxShadow: "0 0 8px #22c55e", animation: "pulse 2s infinite" }} />
              <span style={{ fontSize: "0.7rem", color: "var(--foreground-muted)", fontWeight: 600 }}>מערכת AI פעילה</span>
            </div>
            <div className="mhd-greeting-sub">
              מרכז פיקוד Studio Pixel — סקירת ביצועים בזמן אמת
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "0.75rem" }}>
            <div className="mhd-date-badge">📅 {dateLabel}</div>
            {!isLoading && analytics && (
              <div className="mhd-stats-row">
                <Link href="/clients" className="mhd-stat" style={{ textDecoration: "none" }}>
                  <div className="mhd-stat-icon">👥</div>
                  <div>
                    <div className="mhd-stat-val" style={{ color: "#38bdf8" }}>{analytics.activeClients}</div>
                    <div className="mhd-stat-label">לקוחות פעילים</div>
                  </div>
                </Link>
                <Link href="/tasks" className="mhd-stat" style={{ textDecoration: "none" }}>
                  <div className="mhd-stat-icon">✅</div>
                  <div>
                    <div className="mhd-stat-val" style={{ color: "#34d399" }}>{analytics.openTasks}</div>
                    <div className="mhd-stat-label">משימות פתוחות</div>
                  </div>
                </Link>
                <Link href="/payments" className="mhd-stat" style={{ textDecoration: "none" }}>
                  <div className="mhd-stat-icon">💳</div>
                  <div>
                    <div className="mhd-stat-val" style={{ color: "#fbbf24" }}>{formatCurrency(analytics.pendingPayments)}</div>
                    <div className="mhd-stat-label">תשלומים ממתינים</div>
                  </div>
                </Link>
                <Link href="/approvals" className="mhd-stat" style={{ textDecoration: "none" }}>
                  <div className="mhd-stat-icon">📋</div>
                  <div>
                    <div className="mhd-stat-val" style={{ color: "#ef4444" }}>{analytics.pendingApprovals}</div>
                    <div className="mhd-stat-label">אישורים ממתינים</div>
                  </div>
                </Link>
              </div>
            )}
          </div>
        </div>

        {/* ═══ 2. URGENT ACTIONS ═══ */}
        {!isLoading && analytics && (analytics.overduePaymentsCount > 0 || analytics.overdueTasks > 0 || analytics.pendingApprovals > 0 || analytics.dueTodayFollowUps > 0) && (
          <div style={{ background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.15)", borderRadius: "0.75rem", padding: "1.25rem", direction: "rtl" }}>
            <div style={{ fontSize: "0.875rem", fontWeight: 600, marginBottom: "0.75rem", color: "#ef4444" }}>
              🚨 צריך טיפול עכשיו
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: "0.75rem" }}>
              {analytics.overduePaymentsCount > 0 && (
                <Link href="/accounting" className="premium-card ux-card ux-light-sweep" style={{ textDecoration: "none", padding: "0.75rem" }}>
                  <div style={{ fontSize: "0.72rem", color: "var(--foreground-muted)" }}>תשלומים בפיגור</div>
                  <div style={{ fontSize: "1.25rem", fontWeight: 700, color: "#ef4444" }}>{analytics.overduePaymentsCount}</div>
                  <div style={{ fontSize: "0.68rem", color: "var(--foreground-muted)" }}>{formatCurrency(analytics.overdueTotal)}</div>
                </Link>
              )}
              {analytics.overdueTasks > 0 && (
                <Link href="/tasks" className="premium-card ux-card ux-light-sweep" style={{ textDecoration: "none", padding: "0.75rem" }}>
                  <div style={{ fontSize: "0.72rem", color: "var(--foreground-muted)" }}>משימות בפיגור</div>
                  <div style={{ fontSize: "1.25rem", fontWeight: 700, color: "#f97316" }}>{analytics.overdueTasks}</div>
                </Link>
              )}
              {analytics.pendingApprovals > 0 && (
                <Link href="/approvals" className="premium-card ux-card ux-light-sweep" style={{ textDecoration: "none", padding: "0.75rem" }}>
                  <div style={{ fontSize: "0.72rem", color: "var(--foreground-muted)" }}>אישורים ממתינים</div>
                  <div style={{ fontSize: "1.25rem", fontWeight: 700, color: "#ef4444" }}>{analytics.pendingApprovals}</div>
                </Link>
              )}
              {analytics.dueTodayFollowUps > 0 && (
                <Link href="/leads" className="premium-card ux-card ux-light-sweep" style={{ textDecoration: "none", padding: "0.75rem" }}>
                  <div style={{ fontSize: "0.72rem", color: "var(--foreground-muted)" }}>פולואפים היום</div>
                  <div style={{ fontSize: "1.25rem", fontWeight: 700, color: "#f97316" }}>{analytics.dueTodayFollowUps}</div>
                </Link>
              )}
              {analytics.clientsMissingGantt > 0 && (
                <Link href="/clients" className="premium-card ux-card ux-light-sweep" style={{ textDecoration: "none", padding: "0.75rem" }}>
                  <div style={{ fontSize: "0.72rem", color: "var(--foreground-muted)" }}>לקוחות ללא תוכנית</div>
                  <div style={{ fontSize: "1.25rem", fontWeight: 700, color: "#f59e0b" }}>{analytics.clientsMissingGantt}</div>
                </Link>
              )}
            </div>
          </div>
        )}

        {/* ═══ 3. KPI ROW (with skeleton) ═══ */}
        <div>
          <div className="mhd-section-label">מדדי ביצוע עיקריים</div>
          {isLoading ? (
            <SkeletonKPIRow count={8} />
          ) : analytics ? (
            <div className="ux-stagger" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: "0.75rem" }}>
              <KPICard icon="👥" value={analytics.activeClients} label="לקוחות פעילים" color="#38bdf8" href="/clients" />
              <KPICard icon="🎯" value={analytics.leadsThisMonth} label="לידים החודש" color="#34d399" href="/leads" />
              <KPICard icon="💰" value={formatCurrency(analytics.revenue)} label="הכנסה החודש" color="#10b981" href="/accounting" />
              <KPICard icon="⚠️" value={analytics.overduePaymentsCount} label="תשלומים בפיגור" color="#ef4444" href="/accounting" />
              <KPICard icon="📋" value={analytics.openTasks} label="משימות פתוחות" color="#2dd4bf" href="/tasks" />
              <KPICard icon="⏳" value={analytics.pendingApprovals} label="אישורים ממתינים" color="#f59e0b" href="/approvals" />
              <KPICard icon="📣" value={analytics.activeCampaigns} label="קמפיינים פעילים" color="#a78bfa" href="/campaigns" />
              <KPICard icon="🎙️" value={analytics.podcastThisMonth} label="פודקאסטים החודש" color="#E8F401" href="/accounting/podcast" />
            </div>
          ) : null}
        </div>

        {/* ═══ 4. QUICK ACTIONS ═══ */}
        <div>
          <div className="mhd-section-label">פעולות מהירות</div>
          <div className="ux-stagger" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(110px, 1fr))", gap: "0.75rem" }}>
            {QUICK_ACTIONS.map(a => (
              <Link key={a.label} href={a.route} className="quick-action-btn ux-light-sweep">
                <span className="quick-action-icon" style={{ filter: `drop-shadow(0 2px 8px ${a.color}60)` }}>{a.icon}</span>
                <span className="quick-action-label">{a.label}</span>
              </Link>
            ))}
          </div>
        </div>

        {/* ═══ 5. AI INSIGHTS (smart cards) ═══ */}
        {aiInsights.length > 0 && (
          <div>
            <div className="mhd-section-label">🧠 תובנות AI</div>
            <AIInsightsPanel insights={aiInsights} />
          </div>
        )}

        {/* ═══ 6. QUICK SECTIONS (2-col grid) ═══ */}
        <div>
          <div className="mhd-section-label">סקירה מהירה</div>
          {isLoading ? (
            <SkeletonGrid count={4} columns="repeat(auto-fit, minmax(280px, 1fr))" />
          ) : analytics ? (
            <div className="ux-stagger" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "1rem" }}>
              <SummaryPane title="סיכום כלכלי" icon="💰" color="#10b981" href="/accounting" linkText="צפה בפרטים"
                rows={[
                  { label: "הכנסה החודש", value: formatCurrency(analytics.revenue), color: "#10b981" },
                  { label: "בפיגור", value: formatCurrency(analytics.overdueTotal), color: "#ef4444" },
                  { label: "גביות קרובות", value: formatCurrency(analytics.upcomingCollections), color: "#38bdf8" },
                  ...(analytics.projectsTotalValue > 0 ? [{ label: "שווי פרויקטים", value: formatCurrency(analytics.projectsTotalValue), color: "#818cf8" }] : []),
                ]}
              />
              <SummaryPane title="בריאות לקוחות" icon="👥" color="#38bdf8" href="/clients" linkText="צפה בלקוחות"
                rows={[
                  { label: "ללא תוכנית", value: analytics.clientsMissingGantt, color: "#f59e0b" },
                  { label: "ללא מנהל", value: analytics.noManagerCount, color: "#a78bfa" },
                ]}
              />
              <SummaryPane title="סקירת לידים" icon="🎯" color="#34d399" href="/leads" linkText="צפה בלידים"
                rows={[
                  { label: "לידים פעילים", value: analytics.activeLeads, color: "#34d399" },
                  { label: "זכו החודש", value: analytics.wonLeads, color: "#10b981" },
                ]}
              />
              <SummaryPane title="משימות וצוות" icon="👨‍💼" color="#2dd4bf" href="/tasks" linkText="צפה בלוח"
                rows={[
                  { label: "פתוחות", value: analytics.openTasks, color: "#34d399" },
                  { label: "בפיגור", value: analytics.overdueTasks, color: "#ef4444" },
                  { label: "בביקורת", value: analytics.underReview, color: "#f59e0b" },
                  { label: "עובד עסוק ביותר", value: `${analytics.busiestEmployee.name} (${analytics.busiestEmployee.count})` },
                ]}
              />
            </div>
          ) : null}
        </div>

        {/* ═══ 7. TODAY TIMELINE ═══ */}
        {analytics && (analytics.todayTasks.length > 0 || analytics.todayPodcasts.length > 0) && (
          <div>
            <div className="mhd-section-label">📅 ציר הזמן של היום</div>
            <div className="premium-card ux-card" style={{ direction: "rtl" }}>
              {analytics.todayTasks.map(t => (
                <TimelineItem
                  key={t.id}
                  icon="📋"
                  title={t.title || "משימה"}
                  subtitle={`סטטוס: ${t.status || "חדש"}`}
                  time="היום"
                  color="#2dd4bf"
                />
              ))}
              {analytics.todayPodcasts.map((s: any) => (
                <TimelineItem
                  key={s.id}
                  icon="🎙️"
                  title={s.clientName || "הקלטה"}
                  subtitle={s.episodeTitle || "אפיזוד"}
                  time={s.sessionTime || "היום"}
                  color="#E8F401"
                />
              ))}
            </div>
          </div>
        )}

        {/* ═══ 8. TRENDS WIDGET ═══ */}
        <div>
          <div className="mhd-section-label">🔥 מה חם השבוע</div>
          <div style={{
            background: "linear-gradient(135deg, rgba(239,68,68,0.05), rgba(249,115,22,0.05))",
            border: "1px solid rgba(239,68,68,0.1)", borderRadius: "0.75rem",
            padding: "1.25rem", direction: "rtl",
          }}>
            {trendsLoading ? (
              <SkeletonGrid count={3} columns="repeat(auto-fit, minmax(250px, 1fr))" />
            ) : trends.length === 0 ? (
              <div style={{ textAlign: "center", padding: "2rem", color: "var(--foreground-muted)", fontSize: "0.875rem" }}>
                אין טרנדים זמינים כרגע
              </div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", gap: "1rem" }}>
                {trends.slice(0, 4).map(trend => (
                  <div key={trend.id} className="premium-card ux-card ux-light-sweep" style={{ padding: "1rem" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "0.75rem" }}>
                      <div style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--foreground)", flex: 1 }}>
                        {trend.name}
                      </div>
                      <span style={{
                        fontSize: "0.625rem", fontWeight: 700, padding: "0.25rem 0.5rem", borderRadius: "0.25rem",
                        background: trend.urgency === "high" ? "rgba(239,68,68,0.15)" : trend.urgency === "medium" ? "rgba(249,115,22,0.15)" : "rgba(34,197,94,0.15)",
                        color: trend.urgency === "high" ? "#ef4444" : trend.urgency === "medium" ? "#f97316" : "#22c55e",
                        marginRight: "0.5rem",
                      }}>
                        {trend.urgency === "high" ? "דחוף" : trend.urgency === "medium" ? "בינוני" : "רגיל"}
                      </span>
                    </div>
                    <div style={{ fontSize: "0.75rem", color: "var(--foreground-muted)", lineHeight: 1.5, marginBottom: "0.75rem" }}>
                      {trend.contentIdea}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.7rem", color: "var(--foreground-muted)" }}>
                      <div style={{ flex: 1, height: "0.375rem", background: "var(--border)", borderRadius: "0.125rem", overflow: "hidden" }}>
                        <div style={{
                          height: "100%", width: `${Math.max(20, trend.relevanceScore)}%`, transition: "width 0.3s ease",
                          background: trend.relevanceScore >= 75 ? "#22c55e" : trend.relevanceScore >= 50 ? "#f59e0b" : "#ef4444",
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

        {/* ═══ 8.5 SMART WEEKLY CALENDAR ═══ */}
        <SmartWeeklyCalendar />

        {/* ═══ 9. MODULE GRID ═══ */}
        <div>
          <div className="mhd-section-label">מודולי המערכת</div>
          <div className="mhd-grid">
            {modules.map(m => (
              <Link key={m.title} href={m.route} className="mhd-card ux-light-sweep" style={{ "--mc": m.color, textDecoration: "none" } as React.CSSProperties}>
                <div className="mhd-card-icon" style={{ background: m.bg, boxShadow: `0 0 0 1px ${m.color}28` }}>
                  <span style={{ filter: `drop-shadow(0 2px 10px ${m.color}90)` }}>{m.icon}</span>
                </div>
                <div className="mhd-card-title">{m.title}</div>
                <div className="mhd-card-desc">{m.desc}</div>
                <div className="mhd-card-footer">
                  <span className="mhd-card-arrow" style={{ color: m.color }}>←</span>
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* ═══ 10. OPERATIONAL INSIGHTS & ALERTS ═══ */}
        {opInsights.length > 0 && (
          <div>
            <div className="mhd-section-label">✨ תובנות מערכת</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "1rem" }}>
              {opInsights.slice(0, 3).map((insight, idx) => (
                <div key={idx} className="premium-card ux-card">
                  <div style={{ fontSize: "1.5rem", marginBottom: "0.5rem" }}>{insight.icon}</div>
                  <div style={{ fontSize: "0.875rem", fontWeight: 600, marginBottom: "0.5rem" }}>{insight.title}</div>
                  <div style={{ fontSize: "0.75rem", color: "var(--foreground-muted)", lineHeight: 1.5 }}>{insight.description}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {alerts.length > 0 && (
          <div>
            <div className="mhd-section-label">🔔 התראות המערכת</div>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              {alerts.slice(0, 5).map((alert, idx) => (
                <div key={idx} className="premium-card ux-card ux-stagger-item" style={{ padding: "0.75rem", display: "flex", gap: "0.75rem", alignItems: "flex-start" }}>
                  <div style={{ width: "0.5rem", height: "0.5rem", borderRadius: "50%", background: alert.severity === "critical" ? "#ef4444" : "#f59e0b", marginTop: "0.35rem", flexShrink: 0 }} />
                  <div>
                    <div style={{ fontWeight: 600, fontSize: "0.875rem" }}>{alert.title}</div>
                    <div style={{ fontSize: "0.75rem", color: "var(--foreground-muted)" }}>{alert.description}</div>
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
