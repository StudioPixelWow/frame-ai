"use client";

export const dynamic = "force-dynamic";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { wow } from '@/lib/wow';
import { SmartTooltip } from '@/components/ui/smart-tooltip';
import { KPIPopup } from '@/components/ui/kpi-popup';
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
  useEmployeeTasks,
  useMeetings,
  useActivities,
  useHostingRecords,
} from "@/lib/api/use-entity";
import { KpiRow, KpiCard, SectionCard, Sparkline, StatusBadge } from "@/components/ui/saas-kit";
import Avatar from "@/components/ui/avatar";
import { useOperationalAlerts } from "@/lib/alerts/use-alerts";
import { SkeletonKPIRow, SkeletonGrid } from "@/components/ui/skeleton";
import { AIInsightsPanel, generateInsights } from "@/components/ai-insights-panel";
import SmartWeeklyCalendar from "@/components/ui/SmartWeeklyCalendar";
import { AnimatedCounter } from "@/components/ui/animated-counter";
import WelcomeBand from "@/components/ui/welcome-band";
import { useAuth } from "@/lib/auth/auth-context";
import { generateWeeklyTrends, generateClientContentIdeas, type SmartTrend, type ContentIdea } from "@/lib/ai/smart-trends";
import { PremiumKpiCard, PremiumStatGrid, BRAND } from '@/components/charts';
import ExecutiveDashboard from '@/components/dashboard/executive-dashboard';

/* ── Module definitions ── */
const modules = [
  { icon: "👤", title: "לקוחות", desc: "ניהול לקוחות, חוזים ויצירות קשר", route: "/clients", color: "#38bdf8", bg: "rgba(56,189,248,0.13)" },
  { icon: "📣", title: "קמפיינים", desc: "תכנון, אישור ותזמון קמפיינים לכל פלטפורמה", route: "/campaigns", color: "#a78bfa", bg: "rgba(167,139,250,0.13)" },
  { icon: "✨", title: "PixelManageAI", desc: "יצירת תוכן ויזואלי מבוסס AI — תמונות, רילסים", route: "/projects/new", color: "#818cf8", bg: "rgba(129,140,248,0.13)" },
  { icon: "🎯", title: "לידים", desc: "עקוב אחר לידים, צינור מכירות וסגירת עסקאות", route: "/leads", color: "#34d399", bg: "rgba(52,211,153,0.13)" },
  { icon: "💳", title: "תשלומים", desc: "חשבוניות, גבייה ומעקב הכנסות", route: "/payments", color: "#fbbf24", bg: "rgba(251,191,36,0.13)" },
  { icon: "🧑‍💻", title: "צוות", desc: "ניהול עובדים, תפקידים ועומס עבודה", route: "/employees", color: "#f472b6", bg: "rgba(244,114,182,0.13)" },
  { icon: "📅", title: "משימות", desc: "לוח זמנים, משימות, עדיפויות ותזכורות", route: "/tasks", color: "#2dd4bf", bg: "rgba(45,212,191,0.13)" },
  { icon: "📊", title: "סטטיסטיקות", desc: "דוחות ביצועים, סטטיסטיקות ותובנות", route: "/stats", color: "#fb923c", bg: "rgba(251,146,60,0.13)" },
  { icon: "🎙️", title: "פודקאסט", desc: "ניהול הקלטות, לקוחות וסטטוס תוכן", route: "/accounting/podcast", color: "#E8F401", bg: "rgba(232,244,1,0.13)" },
  { icon: "📋", title: "פרויקטים", desc: "פרויקטי מיתוג, אתרים והוסטינג", route: "/business-projects", color: "#f97316", bg: "rgba(249,115,22,0.13)" },
  { icon: "💰", title: "הנהלת חשבונות", desc: "תשלומים, גביות ומסמכי רואה חשבון", route: "/accounting", color: "#10b981", bg: "rgba(16,185,129,0.13)" },
  { icon: "✅", title: "אישורים", desc: "מרכז אישורים לתוכן, וידאו ופרויקטים", route: "/approvals", color: "#ef4444", bg: "rgba(239,68,68,0.13)" },
  { icon: "🌐", title: "פורטל לקוח", desc: "גישת לקוחות לצפייה ואישור תוכן", route: "/client-portal", color: "#00B5FE", bg: "rgba(0,181,254,0.13)" },
  { icon: "📈", title: "דשבורד מנהלים", desc: "מרכז שליטה, התראות ותובנות AI", route: "/exec-dashboard", color: "#ec4899", bg: "rgba(236,72,153,0.13)" },
  { icon: "🔍", title: "PIXEL SEO/GEO", desc: "קידום אורגני ונראות AI — סריקה, פערים ואוטופיילוט", route: "/seo-geo/dashboard", color: "#0ea5e9", bg: "rgba(14,165,233,0.13)" },
  { icon: "📡", title: "קמפיינים Meta", desc: "ניהול, אופטימיזציה והמלצות לקמפיינים מסונכרנים", route: "/meta-campaigns", color: "#1877f2", bg: "rgba(24,119,242,0.13)" },
];

const QUICK_ACTIONS = [
  { icon: "👤", label: "לקוח חדש", route: "/clients", color: "#38bdf8" },
  { icon: "📅", label: "משימה חדשה", route: "/tasks", color: "#2dd4bf" },
  { icon: "📣", label: "קמפיין חדש", route: "/campaigns", color: "#a78bfa" },
  { icon: "📝", label: "פוסט חדש", route: "/projects/new", color: "#818cf8" },
  { icon: "🎙️", label: "הקלטה חדשה", route: "/accounting/podcast", color: "#E8F401" },
  { icon: "📋", label: "פרויקט חדש", route: "/business-projects", color: "#f97316" },
  { icon: "📊", label: "דוחות חודשיים", route: "__monthly_reports__", color: "#00B5FE" },
];


function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("he-IL", { style: "currency", currency: "ILS", minimumFractionDigits: 0 }).format(amount);
}

/* ── Summary pane ── */
function SummaryPane({ title, icon, color, rows, href, linkText }: {
  title: string; icon: string; color: string;
  rows: Array<{ label: string; value: string | number; color?: string }>;
  href: string; linkText: string;
}) {
  return (
    <div className="premium-card" style={{ direction: "rtl", padding: "1.4rem 1.4rem", height: "100%", display: "flex", flexDirection: "column", boxSizing: "border-box" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "1.1rem", paddingBottom: "0.85rem", borderBottom: "1px solid var(--border)" }}>
        <span style={{ fontSize: "1.05rem", width: 30, height: 30, borderRadius: 9, background: `${color}1a`, display: "flex", alignItems: "center", justifyContent: "center" }}>{icon}</span>
        <span style={{ fontSize: "0.9rem", fontWeight: 700, color }}>{title}</span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: "0.7rem", flex: 1 }}>
        {rows.map((r) => (
          <div key={r.label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: "0.8rem", color: "var(--foreground-muted)" }}>{r.label}</span>
            <span style={{ fontSize: "1.05rem", fontWeight: 800, color: r.color || "var(--foreground)", whiteSpace: "nowrap" }}>{r.value}</span>
          </div>
        ))}
      </div>
      <Link href={href} style={{ display: "inline-block", marginTop: "1rem", paddingTop: "0.85rem", borderTop: "1px solid var(--border)", fontSize: "0.78rem", color, textDecoration: "none", fontWeight: 700 }}>
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

/* ══════════════════════════════════════════════════════════════════════════════
   ═══ EMPLOYEE DASHBOARD ═══
   A focused, personalized view for employees — shows only their clients,
   tasks, projects, and content. No financial data or admin metrics.
   ══════════════════════════════════════════════════════════════════════════════ */

function EmployeeDashboard({ employeeId }: { employeeId: string }) {
  const { data: employees } = useEmployees();
  const { data: tasks } = useTasks();
  const { data: employeeTasks } = useEmployeeTasks();

  const employee = employees.find(e => e.id === employeeId);
  const employeeName = employee?.name || "עובד";

  // Tasks assigned to this employee (both global tasks and employee-tasks).
  // This view is intentionally scoped to the employee's own work only —
  // no client lists, payments, projects, or other agency/admin data.
  const myGlobalTasks = useMemo(() =>
    tasks.filter(t => t.assigneeIds?.includes(employeeId) && t.status !== "completed"),
    [tasks, employeeId]
  );
  const myEmployeeTasks = useMemo(() =>
    employeeTasks.filter(t => t.assignedEmployeeId === employeeId && t.status !== "completed"),
    [employeeTasks, employeeId]
  );
  const allMyTaskCount = myGlobalTasks.length + myEmployeeTasks.length;

  // Group all my tasks by urgency for a clean, calm layout.
  const today = new Date().toISOString().split("T")[0];
  // De-duplicate: a task may exist in both stores (gantt + client-tab create both).
  // Employee-tasks win the dedup so the assignedEmployeeId match is preserved.
  const dedupKey = (t: any) =>
    t.ganttItemId ? `g:${t.ganttItemId}` : `k:${String(t.clientName || "").trim()}|${String(t.title || "").trim()}|${t.dueDate || ""}`;
  const myTasks = (() => {
    const merged = [...myEmployeeTasks, ...myGlobalTasks];
    const seen = new Set<string>();
    const unique: any[] = [];
    for (const t of merged) {
      const k = dedupKey(t);
      if (seen.has(k)) continue;
      seen.add(k);
      unique.push(t);
    }
    return unique;
  })();
  const byDate = (a: any, b: any) => {
    const da = a.dueDate || "9999-99-99"; const db = b.dueDate || "9999-99-99";
    return da < db ? -1 : da > db ? 1 : 0;
  };
  const tomorrow = (() => { const d = new Date(); d.setDate(d.getDate() + 1); return d.toISOString().slice(0, 10); })();
  const overdue = myTasks.filter(t => t.dueDate && t.dueDate < today).sort(byDate);
  const todayList = myTasks.filter(t => t.dueDate && t.dueDate === today).sort(byDate);
  const upcoming = myTasks.filter(t => !t.dueDate || t.dueDate > today).sort(byDate);
  // Next 48 hours: today + tomorrow (the employee's focus list).
  const next48 = myTasks.filter(t => t.dueDate && t.dueDate >= today && t.dueDate <= tomorrow).sort(byDate);
  const overdueCount = overdue.length;
  const todayTaskCount = todayList.length;

  const STATUS_LABEL: Record<string, string> = { new: "חדש", in_progress: "בביצוע", under_review: "בביקורת", returned: "הוחזר", pending: "ממתין" };
  const PRIO_COLOR: Record<string, string> = { urgent: "#ef4444", high: "#f97316", medium: "#fbbf24", low: "#22c55e" };

  const renderTask = (task: any) => {
    const overdueRow = task.dueDate && task.dueDate < today;
    return (
      <Link key={task.id} href={`/tasks?task=${task.id}`} style={{
        textDecoration: "none", display: "flex", alignItems: "center", gap: "0.85rem",
        padding: "0.85rem 1rem", background: "var(--surface-raised)", border: "1px solid var(--border)",
        borderRadius: "0.6rem", direction: "rtl", transition: "all 150ms ease",
      }}
        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "var(--accent)"; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "var(--border)"; }}
      >
        <span style={{ width: 9, height: 9, borderRadius: "50%", background: PRIO_COLOR[task.priority] || "#94a3b8", flexShrink: 0 }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: "0.9rem", fontWeight: 600, color: "var(--foreground)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{task.title}</div>
          <div style={{ fontSize: "0.72rem", color: "var(--foreground-muted)", marginTop: 2 }}>
            {task.clientName || "כללי"}
          </div>
        </div>
        <span style={{ fontSize: "0.65rem", fontWeight: 600, padding: "0.2rem 0.6rem", borderRadius: 999, background: "var(--surface)", color: "var(--foreground-muted)", whiteSpace: "nowrap" }}>
          {STATUS_LABEL[task.status] || task.status}
        </span>
        {task.dueDate && (
          <span style={{ fontSize: "0.7rem", fontWeight: 700, whiteSpace: "nowrap", color: overdueRow ? "#ef4444" : "var(--foreground-muted)", minWidth: 54, textAlign: "left" }}>
            {new Date(task.dueDate).toLocaleDateString("he-IL", { day: "numeric", month: "short" })}
          </span>
        )}
      </Link>
    );
  };

  const Section = ({ title, color, items }: { title: string; color: string; items: any[] }) => (
    items.length === 0 ? null : (
      <div style={{ marginBottom: "1.5rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: "0.6rem", direction: "rtl" }}>
          <span style={{ width: 4, height: 16, borderRadius: 2, background: color }} />
          <span style={{ fontSize: "0.95rem", fontWeight: 700, color: "var(--foreground)" }}>{title}</span>
          <span style={{ fontSize: "0.75rem", color: "var(--foreground-muted)" }}>({items.length})</span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          {items.map(renderTask)}
        </div>
      </div>
    )
  );

  return (
    <div className="mhd-root">
      <div className="mhd-content stagger-in" style={{ maxWidth: 860, margin: "0 auto" }}>
        {/* ═══ UNIFIED WELCOME BAND ═══ */}
        <div style={{ marginBottom: "1.75rem" }}>
          <WelcomeBand
            name={employeeName}
            subtitle={overdueCount > 0 ? `יש ${overdueCount} משימות שמחכות לך — אתה על זה! 💪` : todayTaskCount > 0 ? `${todayTaskCount} משימות להיום — קדימה לעבודה! ✨` : "אין משימות דחופות — שיהיה יום מעולה! ☕"}
          />
        </div>

        {/* ═══ 3 CLEAN STATS ═══ */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "0.75rem", marginBottom: "1.75rem", direction: "rtl" }}>
          {[
            { value: allMyTaskCount, label: "משימות פתוחות", color: "#2dd4bf" },
            { value: overdueCount, label: "באיחור", color: "#ef4444" },
            { value: todayTaskCount, label: "להיום", color: "#38bdf8" },
          ].map((s) => (
            <div key={s.label} style={{ background: "var(--surface-raised)", border: "1px solid var(--border)", borderRadius: "0.75rem", padding: "1rem", textAlign: "center" }}>
              <div style={{ fontSize: "1.8rem", fontWeight: 800, color: s.color }}>{s.value}</div>
              <div style={{ fontSize: "0.75rem", color: "var(--foreground-muted)", marginTop: 2 }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* ═══ NEXT 48 HOURS — the employee's focus list ═══ */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.8rem", direction: "rtl" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: "1rem", fontWeight: 800, color: "var(--foreground)" }}>⚡ המשימות שלי ל-48 השעות הקרובות</span>
            <span style={{ fontSize: "0.72rem", fontWeight: 700, color: "#fff", background: "#00B5FE", borderRadius: 999, padding: "1px 9px" }}>{next48.length}</span>
          </div>
          <Link href="/tasks" style={{ fontSize: "0.78rem", fontWeight: 700, color: "#00B5FE", textDecoration: "none" }}>כל המשימות ←</Link>
        </div>
        {next48.length === 0 ? (
          <div style={{ textAlign: "center", padding: "3rem 1.5rem", color: "var(--foreground-muted)", background: "var(--surface-raised)", border: "1px solid var(--border)", borderRadius: "0.75rem" }}>
            <div style={{ fontSize: "2.5rem", marginBottom: "0.75rem" }}>✨</div>
            <div style={{ fontSize: "0.95rem", fontWeight: 600 }}>אין משימות ל-48 השעות הקרובות — שיהיה יום מעולה!</div>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            {next48.map(renderTask)}
          </div>
        )}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════════
   ═══ ADMIN / MANAGER DASHBOARD (original) ═══
   ══════════════════════════════════════════════════════════════════════════════ */

export default function DashboardPage() {
  const { role, employeeId, isEmployee } = useAuth();

  // If employee role with selected employee, show employee dashboard
  if (isEmployee && employeeId) {
    return <EmployeeDashboard employeeId={employeeId} />;
  }

  return <AdminDashboard />;
}

function AdminDashboard() {
  const { data: rawClients, loading: cL } = useClients();
  const { data: rawTasks, loading: tL } = useTasks();
  const { data: rawPayments, loading: pL } = usePayments();
  const { data: rawLeads, loading: lL } = useLeads();
  const { data: rawEmployees, loading: eL } = useEmployees();
  const { data: rawCampaigns, loading: caL } = useCampaigns();
  const { data: rawApprovals, loading: aL } = useApprovals();
  const { data: rawPodcastSessions, loading: poL } = usePodcastSessions();
  const { data: rawProjectPayments, loading: ppL } = useProjectPayments();
  const { data: rawBusinessProjects, loading: bpL } = useBusinessProjects();
  const { data: rawSocialPosts, loading: spL } = useSocialPosts();
  const { data: rawMeetings } = useMeetings();
  const { data: rawActivities } = useActivities();
  const { data: rawHosting } = useHostingRecords();
  const { data: rawEmployeeTasks } = useEmployeeTasks();

  // Safe fallbacks — never let undefined reach .filter/.map/.reduce/.length
  const clients = rawClients ?? [];
  const meetings = rawMeetings ?? [];
  const activities = rawActivities ?? [];
  const hosting = rawHosting ?? [];
  const allEmployeeTasks = rawEmployeeTasks ?? [];
  const tasks = rawTasks ?? [];
  const payments = rawPayments ?? [];
  const leads = rawLeads ?? [];
  const employees = rawEmployees ?? [];
  const campaigns = rawCampaigns ?? [];
  const approvals = rawApprovals ?? [];
  const podcastSessions = rawPodcastSessions ?? [];
  const projectPayments = rawProjectPayments ?? [];
  const businessProjects = rawBusinessProjects ?? [];
  const socialPosts = rawSocialPosts ?? [];
  const { alerts, insights: opInsights } = useOperationalAlerts();

  const isLoading = cL || tL || pL || lL || eL || caL || aL || poL || ppL || bpL || spL;

  // Monthly reports state
  const [sendingReports, setSendingReports] = useState(false);
  const [reportResult, setReportResult] = useState<{ sent: number; saved: number; errors: number } | null>(null);

  const handleSendMonthlyReports = async () => {
    if (sendingReports) return;
    setSendingReports(true);
    setReportResult(null);
    try {
      const res = await fetch('/api/reports/send-monthly', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sendEmail: true }),
      });
      const data = await res.json();
      setReportResult({
        sent: data.sent || 0,
        saved: data.saved || 0,
        errors: data.errors?.length || 0,
      });
      if (data.sent > 0) wow.reportReady();
    } catch {
      setReportResult({ sent: 0, saved: 0, errors: 1 });
    } finally {
      setSendingReports(false);
    }
  };

  // Smart Trends — deterministic, context-aware, rotated weekly
  const smartTrends = useMemo<SmartTrend[]>(() => {
    if (isLoading) return [];
    return generateWeeklyTrends({
      clients,
      ganttItems: [],
      campaigns,
      socialPosts,
    });
  }, [isLoading, clients, campaigns, socialPosts]);

  // Client-specific content suggestions (top 3 clients)
  const clientContentSuggestions = useMemo<Array<{ clientName: string; clientId: string; ideas: ContentIdea[] }>>(() => {
    if (isLoading) return [];
    const activeClients = clients.filter(c => c.status === "active").slice(0, 3);
    return activeClients.map(client => ({
      clientName: client.name,
      clientId: client.id,
      ideas: generateClientContentIdeas({
        client: {
          id: client.id,
          name: client.name,
          clientType: client.clientType || "marketing",
          businessField: client.businessField || "",
          status: client.status || "active",
          marketingGoals: client.marketingGoals || "",
          keyMarketingMessages: client.keyMarketingMessages || "",
        },
        recentGanttItems: [],
        recentPosts: socialPosts.filter(p => p.clientId === client.id),
      }),
    }));
  }, [isLoading, clients, socialPosts]);

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

    const generalPending = payments.filter(p => p.status === "pending" || p.status === "overdue").reduce((s, p) => s + (Number(p.amount) || 0), 0);
    const projectPending = (projectPayments || []).filter((p: any) => ["pending", "overdue", "collection_needed"].includes(p.status)).reduce((s: number, p: any) => s + (Number(p.amount) || 0), 0);
    const pendingPayments = Math.max(0, Number(generalPending) || 0) + Math.max(0, Number(projectPending) || 0);

    const generalRevenue = payments.filter(p => p.status === "paid" && p.paidAt && new Date(p.paidAt) >= monthStart && new Date(p.paidAt) <= monthEnd).reduce((s, p) => s + (Number(p.amount) || 0), 0);
    const projectRevenue = (projectPayments || []).filter((p: any) => p.status === "paid" && p.paidAt && new Date(p.paidAt) >= monthStart && new Date(p.paidAt) <= monthEnd).reduce((s: number, p: any) => s + (Number(p.amount) || 0), 0);
    const revenue = Math.max(0, Number(generalRevenue) || 0) + Math.max(0, Number(projectRevenue) || 0);

    const generalOverdue = payments.filter(p => p.status === "overdue");
    const projectOverdue = (projectPayments || []).filter((p: any) => p.status === "overdue");
    const overduePaymentsCount = generalOverdue.length + projectOverdue.length;
    const overdueTotal = generalOverdue.reduce((s, p) => s + (Number(p.amount) || 0), 0) + projectOverdue.reduce((s: number, p: any) => s + (Number(p.amount) || 0), 0);

    const leadsThisMonth = leads.filter(l => { const d = new Date(l.createdAt); return d >= monthStart && d <= monthEnd; }).length;
    const activeLeads = leads.filter(l => ["new", "contacted", "proposal_sent", "negotiation"].includes(l.status || "")).length;
    const wonLeads = leads.filter(l => l.status === "won" && new Date(l.createdAt) >= monthStart).length;

    const activeCampaigns = campaigns.filter(c => c.status === "active").length;
    const podcastThisMonth = podcastSessions.filter(s => { const d = new Date(s.sessionDate); return d >= monthStart && d <= monthEnd; }).length;

    const dueTodayFollowUps = leads.filter(l => l.followUpAt && new Date(l.followUpAt).toDateString() === today).length;
    const clientsMissingGantt = clients.filter(c => !c.monthlyGanttStatus || c.monthlyGanttStatus === "none" || c.monthlyGanttStatus === "draft").length;
    const noManagerCount = clients.filter(c => !c.assignedManagerId).length;

    const generalUpcoming = payments.filter(p => { if (!p.dueDate) return false; const d = new Date(p.dueDate); return d > now && d <= new Date(now.getTime() + 30 * 86400000); }).reduce((s, p) => s + (Number(p.amount) || 0), 0);
    const projectUpcoming = (projectPayments || []).filter((p: any) => { if (!p.dueDate) return false; const d = new Date(p.dueDate); return d > now && d <= new Date(now.getTime() + 30 * 86400000); }).reduce((s: number, p: any) => s + (Number(p.amount) || 0), 0);
    const upcomingCollections = Math.max(0, Number(generalUpcoming) || 0) + Math.max(0, Number(projectUpcoming) || 0);

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
      activeClients: Number(activeClients) || 0,
      openTasks: Number(openTasks) || 0,
      overdueTasks: Number(overdueTasks) || 0,
      underReview: Number(underReview) || 0,
      pendingApprovals: Number(pendingApprovals) || 0,
      pendingPayments: Number(pendingPayments) || 0,
      revenue: Number(revenue) || 0,
      overduePaymentsCount: Number(overduePaymentsCount) || 0,
      overdueTotal: Number(overdueTotal) || 0,
      leadsThisMonth: Number(leadsThisMonth) || 0,
      activeLeads: Number(activeLeads) || 0,
      wonLeads: Number(wonLeads) || 0,
      activeCampaigns: Number(activeCampaigns) || 0,
      podcastThisMonth: Number(podcastThisMonth) || 0,
      dueTodayFollowUps: Number(dueTodayFollowUps) || 0,
      clientsMissingGantt: Number(clientsMissingGantt) || 0,
      noManagerCount: Number(noManagerCount) || 0,
      upcomingCollections: Number(upcomingCollections) || 0,
      projectsTotalValue: Number(projectsTotalValue) || 0,
      busiestEmployee: busiestEmp ? { name: busiestEmp.name, count: Number(empCounts[busiestId]) || 0 } : { name: "—", count: 0 },
      todayTasks, todayPodcasts,
    };
  }, [isLoading, clients, tasks, payments, leads, employees, campaigns, approvals, podcastSessions, projectPayments, businessProjects, socialPosts]);

  // AI Insights
  const aiInsights = useMemo(() => {
    if (isLoading) return [];
    return generateInsights({ tasks, clients, approvals, payments, campaigns, socialPosts });
  }, [isLoading, tasks, clients, approvals, payments, campaigns, socialPosts]);

  // ── WhatsApp live conversations (QR microservice) ──
  const [waChats, setWaChats] = useState<any[]>([]);
  const [waState, setWaState] = useState<"loading" | "ok" | "off">("loading");
  useEffect(() => {
    let alive = true;
    const headers: Record<string, string> = {};
    try {
      const r = localStorage.getItem("frameai_role"); if (r) headers["x-app-role"] = r;
      const u = localStorage.getItem("frameai_user_id"); if (u) headers["x-app-user-id"] = u;
    } catch {}
    fetch("/api/whatsapp/qr-chats", { headers, cache: "no-store" })
      .then((r) => r.json())
      .then((d) => { if (!alive) return; if (d?.state === "ok" && Array.isArray(d?.chats)) { setWaChats(d.chats); setWaState("ok"); } else setWaState("off"); })
      .catch(() => { if (alive) setWaState("off"); });
    return () => { alive = false; };
  }, []);
  const waUnread = useMemo(() => waChats.filter((c: any) => (c.unread || 0) > 0).sort((a: any, b: any) => (b.timestamp || 0) - (a.timestamp || 0)), [waChats]);

  // ── Next 48h schedule ──
  const schedule = useMemo(() => {
    const now = new Date();
    const dayStr = (d: Date) => d.toDateString();
    type Ev = { time: string; title: string; sub: string; icon: string; href: string; sort: number };
    const build = (dStr: string): Ev[] => {
      const out: Ev[] = [];
      meetings.filter((m: any) => m.date && new Date(m.date).toDateString() === dStr && m.status !== "cancelled").forEach((m: any) => out.push({ time: m.startTime || "", title: m.title || "פגישה", sub: m.clientName || m.location || "", icon: "🤝", href: "/business-calendar", sort: parseInt(String(m.startTime || "0000").replace(":", "")) || 0 }));
      podcastSessions.filter((s: any) => s.sessionDate && new Date(s.sessionDate).toDateString() === dStr).forEach((s: any) => out.push({ time: "", title: "הקלטת פודקאסט", sub: s.clientName || "", icon: "🎙️", href: "/accounting/podcast/calendar", sort: 1200 }));
      tasks.filter((t: any) => t.dueDate && new Date(t.dueDate).toDateString() === dStr && t.status !== "completed" && t.status !== "approved").forEach((t: any) => out.push({ time: "", title: t.title || "משימה", sub: t.clientName || "דדליין", icon: "⏰", href: "/tasks", sort: 2400 }));
      return out.sort((a, b) => a.sort - b.sort);
    };
    return { today: build(dayStr(now)).slice(0, 6), tomorrow: build(dayStr(new Date(now.getTime() + 86400000))).slice(0, 6) };
  }, [meetings, tasks, podcastSessions]);

  // ── Collections (due/overdue) with client name + phone ──
  const collections = useMemo(() => {
    const now = new Date();
    const cOf = (id: string) => clients.find((c: any) => c.id === id);
    const list: any[] = [];
    const add = (p: any, prefix: string) => list.push({ id: `${prefix}-${p.id}`, clientId: p.clientId, name: p.clientName || cOf(p.clientId)?.name || "לקוח", amount: Number(p.amount) || 0, overdue: p.dueDate ? new Date(p.dueDate) < now : false, phone: cOf(p.clientId)?.phone || "" });
    payments.filter((p: any) => ["pending", "overdue", "collection_needed"].includes(p.status)).forEach((p: any) => add(p, "g"));
    (projectPayments || []).filter((p: any) => ["pending", "overdue", "collection_needed"].includes(p.status)).forEach((p: any) => add(p, "p"));
    return list.sort((a, b) => (Number(b.overdue) - Number(a.overdue)) || b.amount - a.amount).slice(0, 6);
  }, [payments, projectPayments, clients]);

  // ── Team execution: open tasks per employee ──
  const teamLoad = useMemo(() => {
    const counts: Record<string, { open: number; overdue: number }> = {};
    const now = new Date();
    const bump = (id: string, overdue: boolean) => { if (!id) return; counts[id] = counts[id] || { open: 0, overdue: 0 }; counts[id].open++; if (overdue) counts[id].overdue++; };
    tasks.filter((t: any) => t.status !== "completed" && t.status !== "approved").forEach((t: any) => (t.assigneeIds || []).forEach((id: string) => bump(id, !!(t.dueDate && new Date(t.dueDate) < now))));
    allEmployeeTasks.filter((t: any) => t.status !== "completed").forEach((t: any) => bump(t.assigneeId || t.employeeId, !!(t.dueDate && new Date(t.dueDate) < now)));
    return employees.map((e: any) => ({ id: e.id, name: e.name, avatarUrl: (e as any).avatarUrl, open: counts[e.id]?.open || 0, overdue: counts[e.id]?.overdue || 0 })).filter((e) => e.open > 0).sort((a, b) => b.open - a.open).slice(0, 6);
  }, [tasks, allEmployeeTasks, employees]);

  // ── Action center buckets ──
  const actionCenter = useMemo(() => {
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 86400000);
    const needs: any[] = [];
    tasks.filter((t: any) => t.dueDate && new Date(t.dueDate) < now && t.status !== "completed" && t.status !== "approved").slice(0, 4).forEach((t: any) => needs.push({ icon: "⏰", title: t.title || "משימה בפיגור", sub: t.clientName || "", href: "/tasks", tone: "#ef4444" }));
    approvals.filter((a: any) => a.status === "pending_approval").slice(0, 3).forEach((a: any) => needs.push({ icon: "✋", title: a.title || "אישור ממתין", sub: a.clientName || "", href: "/approvals", tone: "#f59e0b" }));
    collections.filter((c: any) => c.overdue).slice(0, 2).forEach((c: any) => needs.push({ icon: "💰", title: `גבייה — ${c.name}`, sub: formatCurrency(c.amount), href: "/accounting", tone: "#f59e0b" }));
    const inProgress: any[] = [];
    tasks.filter((t: any) => t.status === "under_review" || t.status === "in_progress").slice(0, 5).forEach((t: any) => inProgress.push({ icon: "🔄", title: t.title || "משימה", sub: t.clientName || "", href: "/tasks" }));
    campaigns.filter((c: any) => c.status === "active").slice(0, 3).forEach((c: any) => inProgress.push({ icon: "🚀", title: c.name || "קמפיין", sub: c.clientName || "פעיל", href: "/campaigns" }));
    const done: any[] = tasks.filter((t: any) => (t.status === "completed" || t.status === "approved") && t.updatedAt && new Date(t.updatedAt) >= weekAgo).slice(0, 6).map((t: any) => ({ icon: "✅", title: t.title || "משימה", sub: t.clientName || "", href: "/tasks" }));
    return { needs: needs.slice(0, 7), inProgress: inProgress.slice(0, 7), done };
  }, [tasks, approvals, collections, campaigns]);

  // ── Recommended actions (Chief of Staff) ──
  const recommended = useMemo(() => {
    if (!analytics) return [] as { icon: string; label: string; href: string }[];
    const recs: { icon: string; label: string; href: string }[] = [];
    if (waUnread.length) recs.push({ icon: "💬", label: `השב ל${waUnread[0].name || "לקוח"} בוואטסאפ`, href: "/whatsapp-inbox" });
    if (analytics.pendingApprovals > 0) recs.push({ icon: "✋", label: `אשר ${analytics.pendingApprovals} פריטים ממתינים`, href: "/approvals" });
    const ovd = collections.find((c: any) => c.overdue);
    if (ovd) recs.push({ icon: "💰", label: `שלח תזכורת גבייה ל${ovd.name}`, href: "/accounting" });
    if (analytics.overdueTasks > 0) recs.push({ icon: "⏰", label: `טפל ב-${analytics.overdueTasks} משימות בפיגור`, href: "/tasks" });
    if (analytics.clientsMissingGantt > 0) recs.push({ icon: "📅", label: `צור תוכנית חודשית ל-${analytics.clientsMissingGantt} לקוחות`, href: "/clients" });
    return recs.slice(0, 4);
  }, [analytics, waUnread, collections]);

  const greeting = (() => { const h = new Date().getHours(); return h < 12 ? "בוקר טוב" : h < 18 ? "צהריים טובים" : "ערב טוב"; })();
  const todayLabel = new Date().toLocaleDateString("he-IL", { weekday: "long", day: "numeric", month: "long" });

  const timeSince = (ts: number) => {
    if (!ts) return "";
    const diff = Math.max(0, Date.now() - ts * 1000);
    const m = Math.floor(diff / 60000);
    if (m < 1) return "עכשיו";
    if (m < 60) return `לפני ${m} ד׳`;
    const h = Math.floor(m / 60);
    if (h < 24) return `לפני ${h} ש׳`;
    return `לפני ${Math.floor(h / 24)} ימים`;
  };
  const openProjects = (businessProjects || []).filter((p: any) => p.projectStatus !== "completed").length;
  const sectionLabel: React.CSSProperties = { fontSize: "0.74rem", fontWeight: 800, letterSpacing: 1, color: "var(--foreground-muted)", marginBottom: 10, textTransform: "uppercase" };
  const linkSmall: React.CSSProperties = { fontSize: "0.74rem", fontWeight: 700, color: "var(--accent)", textDecoration: "none" };


  // ── extra data for the approved concept layout ──
  const last7 = [...Array(7)].map((_, i) => { const d = new Date(); d.setDate(d.getDate() - (6 - i)); return d.toDateString(); });
  const leadsSeries = last7.map((day) => leads.filter((l: any) => l.createdAt && new Date(l.createdAt).toDateString() === day).length);
  const doneSeries = last7.map((day) => tasks.filter((t: any) => (t.status === "completed" || t.status === "approved") && t.updatedAt && new Date(t.updatedAt).toDateString() === day).length);
  const wonLeads = leads.filter((l: any) => l.status === "won").length;
  const lostLeads = leads.filter((l: any) => l.status === "lost").length;
  const closeRate = (wonLeads + lostLeads) ? Math.round((wonLeads / (wonLeads + lostLeads)) * 100) : 0;
  const delayedProjects = (businessProjects || []).filter((p: any) => p.endDate && new Date(p.endDate) < new Date() && p.projectStatus !== "completed").length;
  const PSTATUS: Record<string, number> = { planning: 20, lead: 15, in_progress: 55, in_development: 55, design: 45, review: 80, active: 60, on_hold: 30, completed: 100 };
  const projectsStatus = (businessProjects || []).filter((p: any) => p.projectStatus !== "completed").slice(0, 4).map((p: any) => {
    const pct = typeof p.progress === "number" ? p.progress : (PSTATUS[p.projectStatus] || 40);
    return { id: p.id, name: p.projectName || "פרויקט", clientName: clients.find((c: any) => c.id === p.clientId)?.name || p.clientName || "", pct, deadline: p.endDate, mgr: employees.find((e: any) => e.id === p.assignedManagerId) };
  });
  const LPCT: Record<string, number> = { new: 20, assigned: 30, contacted: 40, no_answer: 35, interested: 60, proposal_sent: 70, negotiation: 85, meeting_set: 75 };
  const leadsTop = leads.filter((l: any) => LPCT[l.status]).sort((a: any, b: any) => +new Date(b.createdAt) - +new Date(a.createdAt)).slice(0, 4).map((l: any) => ({ id: l.id, name: l.name || l.fullName || l.businessName || "ליד", pct: LPCT[l.status] || 30 }));
  const waitingClient = tasks.filter((t: any) => t.status === "approved").slice(0, 6).map((t: any) => ({ icon: "⏳", title: t.title || "משימה", sub: t.clientName || "", href: "/tasks" }));
  const pColor = (p: number) => (p < 40 ? "#ef4444" : p < 70 ? "#f59e0b" : "#22c55e");

  return (
    <div className="mhd-root">
      <div className="mhd-content stagger-in" style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
        {(isLoading || !analytics) ? (
          <div style={{ padding: "4rem", textAlign: "center", color: "var(--foreground-muted)" }}>טוען מרכז פיקוד…</div>
        ) : (
          <>
            {/* ═══ 1 · MORNING BRIEFING HERO ═══ */}
            <div style={{ display: "grid", gridTemplateColumns: "minmax(280px,1fr) 2fr", gap: "1.1rem", alignItems: "stretch" }} className="dash-2col">
              <div style={{ borderRadius: 22, padding: "1.5rem 1.7rem", background: "linear-gradient(135deg,#eff6ff 0%,#f5f3ff 45%,#ecfeff 100%)", border: "1px solid #dbeafe", direction: "rtl" }}>
                <h1 style={{ fontSize: "1.7rem", fontWeight: 900, margin: 0, color: "#0f172a" }}>{greeting}, טל 👋</h1>
                <div style={{ fontSize: "0.85rem", color: "#64748b", marginTop: 2 }}>{todayLabel}</div>
                <div style={{ fontSize: "0.92rem", color: "#334155", lineHeight: 1.6, margin: "0.9rem 0" }}>
                  יש לך יום עמוס, אבל יש שליטה. {analytics.openTasks} משימות, {analytics.pendingApprovals} אישורים ו-{waUnread.length} שיחות ממתינות. בוא נעשה אותו מעולה. 💪
                </div>
                <Link href="/tasks" style={{ display: "inline-flex", alignItems: "center", gap: 7, background: "linear-gradient(135deg,#6366f1,#06b6d4)", color: "#fff", borderRadius: 12, padding: "0.6rem 1.1rem", fontWeight: 800, fontSize: "0.85rem", textDecoration: "none" }}>✨ סיכום חכם של היום</Link>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))", gap: "0.85rem" }}>
                {[
                  { icon: "💬", color: "#25D366", val: waUnread.length, label: "הודעות וואטסאפ", sub: "ממתינות למענה", href: "/whatsapp-inbox" },
                  { icon: "✋", color: "#f59e0b", val: analytics.pendingApprovals, label: "אישורים ממתינים", sub: "דורש טיפול", href: "/approvals" },
                  { icon: "✅", color: "#3b82f6", val: analytics.openTasks, label: "משימות פתוחות", sub: `מתוכן ${analytics.overdueTasks} בפיגור`, href: "/tasks" },
                  { icon: "💰", color: "#8b5cf6", val: formatCurrency(analytics.pendingPayments), label: "גבייה פתוחה", sub: "מ-לקוחות", href: "/accounting" },
                  { icon: "👤", color: "#ef4444", val: analytics.clientsMissingGantt, label: "לקוחות בטיפול", sub: "דורש מעקב", href: "/clients" },
                ].map((m, i) => (
                  <Link key={i} href={m.href} className="premium-card" style={{ padding: "1rem", textDecoration: "none", display: "flex", flexDirection: "column", gap: 6 }}>
                    <span style={{ width: 38, height: 38, borderRadius: 11, background: m.color + "1a", color: m.color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.1rem" }}>{m.icon}</span>
                    <span style={{ fontSize: "1.5rem", fontWeight: 900, color: "var(--foreground)", lineHeight: 1 }}>{m.val}</span>
                    <span style={{ fontSize: "0.78rem", fontWeight: 700, color: "var(--foreground)" }}>{m.label}</span>
                    <span style={{ fontSize: "0.68rem", color: "var(--foreground-muted)" }}>{m.sub}</span>
                  </Link>
                ))}
              </div>
            </div>

            {/* ═══ 2·3·4 · TODAY · COMMS · PIXEL AI ═══ */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: "1rem" }} className="dash-3col">
              <SectionCard title="📆 היום שלך" action={<Link href="/business-calendar" style={linkSmall}>ביומן המלא ←</Link>}>
                {schedule.today.length === 0 ? <div style={{ fontSize: "0.82rem", color: "var(--foreground-subtle)" }}>אין אירועים היום</div> :
                  schedule.today.map((e: any, i: number) => (
                    <Link key={i} href={e.href} style={{ display: "flex", gap: 9, alignItems: "center", padding: "0.5rem 0", textDecoration: "none", borderBottom: "1px solid var(--border)" }}>
                      <span style={{ fontSize: "0.72rem", fontWeight: 800, color: "var(--accent)", minWidth: 42 }}>{e.time || "—"}</span>
                      <span style={{ fontSize: "0.95rem" }}>{e.icon}</span>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: "0.82rem", fontWeight: 700, color: "var(--foreground)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{e.title}</div>
                        <div style={{ fontSize: "0.7rem", color: "var(--foreground-muted)" }}>{e.sub}</div>
                      </div>
                    </Link>
                  ))}
              </SectionCard>

              <SectionCard title="💬 מרכז תקשורת" action={<Link href="/whatsapp-inbox" style={linkSmall}>ראה הכל ←</Link>}>
                {waState === "off" ? <div style={{ fontSize: "0.82rem", color: "var(--foreground-muted)" }}>הוואטסאפ לא מחובר. <Link href="/whatsapp-broadcast" style={{ color: "var(--accent)", fontWeight: 700 }}>חבר</Link></div>
                  : waUnread.length === 0 ? <div style={{ fontSize: "0.85rem", color: "var(--foreground-muted)" }}>אין הודעות שלא נענו 🎉</div>
                  : waUnread.slice(0, 4).map((c: any, i: number) => (
                    <Link key={i} href="/whatsapp-inbox" style={{ display: "flex", gap: 10, alignItems: "center", padding: "0.5rem 0", textDecoration: "none", borderBottom: "1px solid var(--border)" }}>
                      <span style={{ fontSize: "0.66rem", color: "var(--foreground-subtle)", minWidth: 38 }}>{timeSince(c.timestamp)}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: "0.82rem", fontWeight: 700, color: "var(--foreground)" }}>{c.name || c.phone}</div>
                        <div style={{ fontSize: "0.72rem", color: "var(--foreground-muted)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.lastMessage || ""}</div>
                      </div>
                      <span style={{ background: "#25D366", color: "#fff", fontSize: "0.64rem", fontWeight: 800, borderRadius: 999, padding: "1px 7px" }}>{c.unread}</span>
                    </Link>
                  ))}
              </SectionCard>

              <div style={{ borderRadius: 16, padding: "1.1rem 1.2rem", background: "linear-gradient(135deg,#eef2ff,#ecfeff)", border: "1px solid #c7d2fe", direction: "rtl" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ fontSize: "1rem", fontWeight: 900, background: "linear-gradient(90deg,#6366f1,#06b6d4)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>Pixel AI</span>
                  <span style={{ fontSize: "0.7rem", color: "#64748b" }}>· Chief of Staff</span>
                </div>
                <div style={{ fontSize: "0.74rem", color: "#64748b", margin: "2px 0 10px" }}>הנה מה שחשוב שתדע לדעת היום:</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 5, marginBottom: 12 }}>
                  {[...opInsights, ...aiInsights].slice(0, 4).map((ins: any, i: number) => (
                    <div key={i} style={{ fontSize: "0.76rem", color: "#334155", background: "rgba(255,255,255,0.7)", borderRadius: 8, padding: "0.4rem 0.6rem" }}>{ins.icon || "💡"} {ins.title || ins.description}</div>
                  ))}
                </div>
                {recommended.length > 0 && (<>
                  <div style={{ fontSize: "0.7rem", fontWeight: 800, color: "#6366f1", marginBottom: 6 }}>המלצות להיום:</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                    {recommended.map((r, i) => (<Link key={i} href={r.href} style={{ fontSize: "0.76rem", color: "#4f46e5", textDecoration: "none", fontWeight: 600 }}>{i + 1}. {r.label}</Link>))}
                  </div>
                </>)}
              </div>
            </div>

            {/* ═══ 5 · ACTION CENTER (4 columns) ═══ */}
            <div>
              <div style={sectionLabel}>⚡ מרכז טיפול — מה דורש את תשומת הלב שלך</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: "0.9rem" }} className="dash-4col">
                {[
                  { label: "דורש טיפול עכשיו", color: "#ef4444", items: actionCenter.needs, href: "/tasks" },
                  { label: "ממתין ללקוח", color: "#f59e0b", items: waitingClient, href: "/approvals" },
                  { label: "בתהליך", color: "#3b82f6", items: actionCenter.inProgress, href: "/tasks" },
                  { label: "הושלם השבוע", color: "#22c55e", items: actionCenter.done, href: "/tasks" },
                ].map((col, ci) => (
                  <div key={ci} className="premium-card" style={{ padding: "1rem" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                      <span style={{ fontSize: "0.8rem", fontWeight: 800, color: "var(--foreground)" }}>{col.label}</span>
                      <span style={{ fontSize: "0.68rem", fontWeight: 800, color: col.color, background: col.color + "1a", borderRadius: 999, padding: "2px 9px" }}>{col.items.length}</span>
                    </div>
                    {col.items.length === 0 ? <div style={{ fontSize: "0.76rem", color: "var(--foreground-subtle)" }}>—</div> :
                      col.items.slice(0, 4).map((it: any, i: number) => (
                        <Link key={i} href={it.href || col.href} style={{ display: "flex", gap: 7, alignItems: "flex-start", padding: "0.38rem 0", textDecoration: "none", borderBottom: "1px solid var(--border)" }}>
                          <span style={{ fontSize: "0.85rem" }}>{it.icon || "•"}</span>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontSize: "0.78rem", fontWeight: 600, color: "var(--foreground)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{it.title}</div>
                            {it.sub && <div style={{ fontSize: "0.68rem", color: "var(--foreground-muted)" }}>{it.sub}</div>}
                          </div>
                        </Link>
                      ))}
                    <Link href={col.href} style={{ ...linkSmall, display: "block", marginTop: 8, color: col.color }}>ראה הכל ←</Link>
                  </div>
                ))}
              </div>
            </div>

            {/* ═══ 6 · BUSINESS SNAPSHOT ═══ */}
            <div>
              <div style={sectionLabel}>📊 מצב עסקי — מבט מהיר</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: "0.85rem" }}>
                {[
                  { label: "שיעור סגירה", val: `${closeRate}%`, series: undefined as number[] | undefined, href: "/leads" },
                  { label: "פרויקטים מעוכבים", val: delayedProjects, series: undefined, href: "/business-projects" },
                  { label: "לקוחות פעילים", val: analytics.activeClients, series: undefined, href: "/clients" },
                  { label: "הכנסה חודשית", val: formatCurrency(analytics.revenue), series: undefined, href: "/accounting" },
                  { label: "גבייה פתוחה", val: formatCurrency(analytics.pendingPayments), series: undefined, href: "/accounting" },
                  { label: "משימות פתוחות", val: analytics.openTasks, series: doneSeries, href: "/tasks" },
                  { label: "לידים פעילים", val: analytics.activeLeads, series: leadsSeries, href: "/leads" },
                ].map((k, i) => (
                  <Link key={i} href={k.href} className="premium-card" style={{ padding: "0.95rem 1rem", textDecoration: "none", display: "flex", flexDirection: "column", gap: 4 }}>
                    <span style={{ fontSize: "0.74rem", color: "var(--foreground-muted)" }}>{k.label}</span>
                    <span style={{ fontSize: "1.5rem", fontWeight: 900, color: "var(--foreground)", lineHeight: 1.1 }}>{k.val}</span>
                    {k.series && k.series.some((n) => n > 0) && <Sparkline values={k.series} />}
                  </Link>
                ))}
              </div>
            </div>

            {/* ═══ 7 · PROJECTS STATUS CENTER ═══ */}
            {projectsStatus.length > 0 && (
              <div>
                <div style={sectionLabel}>📁 פרויקטים — תמונת מצב</div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(230px,1fr))", gap: "0.9rem" }}>
                  {projectsStatus.map((p: any) => (
                    <Link key={p.id} href="/business-projects" className="premium-card" style={{ padding: "1.05rem 1.1rem", textDecoration: "none", display: "flex", flexDirection: "column", gap: 8 }}>
                      <div>
                        <div style={{ fontSize: "0.88rem", fontWeight: 800, color: "var(--foreground)" }}>{p.name}</div>
                        <div style={{ fontSize: "0.72rem", color: "var(--foreground-muted)" }}>{p.clientName}</div>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.72rem", color: "var(--foreground-muted)" }}>
                        <span>התקדמות</span><span style={{ fontWeight: 800, color: pColor(p.pct) }}>{p.pct}%</span>
                      </div>
                      <div style={{ height: 7, background: "var(--surface)", borderRadius: 999, overflow: "hidden" }}><div style={{ width: `${p.pct}%`, height: "100%", background: pColor(p.pct), borderRadius: 999 }} /></div>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ fontSize: "0.7rem", color: "var(--foreground-muted)" }}>{p.deadline ? `יעד ${new Date(p.deadline).toLocaleDateString("he-IL", { day: "2-digit", month: "2-digit", year: "2-digit" })}` : ""}</span>
                        {p.mgr && <Avatar src={p.mgr.avatarUrl} name={p.mgr.name} size={24} ring={false} />}
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* ═══ 8·9·10 · TEAM · LEADS · COLLECTIONS ═══ */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: "1rem" }} className="dash-3col">
              <SectionCard title="👥 פעילות צוות" action={<Link href="/workload" style={linkSmall}>ראה הכל ←</Link>}>
                {teamLoad.length === 0 ? <div style={{ fontSize: "0.82rem", color: "var(--foreground-muted)" }}>אין משימות פתוחות</div> :
                  teamLoad.map((e: any, i: number) => (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: 9, padding: "0.4rem 0", borderBottom: "1px solid var(--border)" }}>
                      <Avatar src={e.avatarUrl} name={e.name} size={28} ring={false} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: "0.8rem", fontWeight: 700, color: "var(--foreground)" }}>{e.name}</div>
                        <div style={{ fontSize: "0.68rem", color: "var(--foreground-muted)" }}>{e.open} משימות{e.overdue > 0 ? ` · ${e.overdue} בפיגור` : ""}</div>
                      </div>
                      {e.overdue > 0 && <span style={{ fontSize: "0.6rem", fontWeight: 800, color: "#ef4444", background: "#fef2f2", borderRadius: 999, padding: "2px 7px" }}>עומס</span>}
                    </div>
                  ))}
              </SectionCard>

              <SectionCard title="🎯 לידים — מעקב חכם" action={<Link href="/leads" style={linkSmall}>ראה הכל ←</Link>}>
                {leadsTop.length === 0 ? <div style={{ fontSize: "0.82rem", color: "var(--foreground-muted)" }}>אין לידים פעילים</div> :
                  leadsTop.map((l: any) => (
                    <div key={l.id} style={{ padding: "0.45rem 0", borderBottom: "1px solid var(--border)" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.8rem", marginBottom: 4 }}><span style={{ fontWeight: 700, color: "var(--foreground)" }}>{l.name}</span><span style={{ fontWeight: 800, color: "var(--accent)" }}>{l.pct}%</span></div>
                      <div style={{ height: 6, background: "var(--surface)", borderRadius: 999, overflow: "hidden" }}><div style={{ width: `${l.pct}%`, height: "100%", background: "var(--accent)", borderRadius: 999 }} /></div>
                    </div>
                  ))}
              </SectionCard>

              <SectionCard title="💰 בנייה ותשלומים" action={<Link href="/accounting" style={linkSmall}>ראה הכל ←</Link>}>
                {collections.length === 0 ? <div style={{ fontSize: "0.82rem", color: "var(--foreground-muted)" }}>אין תשלומים פתוחים 🎉</div> :
                  collections.map((c: any, i: number) => (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "0.45rem 0", borderBottom: "1px solid var(--border)" }}>
                      <span style={{ width: 7, height: 7, borderRadius: "50%", background: c.overdue ? "#ef4444" : "#f59e0b", flexShrink: 0 }} />
                      <span style={{ flex: 1, fontSize: "0.8rem", fontWeight: 700, color: "var(--foreground)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.name}</span>
                      <span style={{ fontSize: "0.84rem", fontWeight: 800, color: "var(--foreground)" }}>{formatCurrency(c.amount)}</span>
                    </div>
                  ))}
              </SectionCard>
            </div>

            {/* ═══ 11 · AI INSIGHTS + ACTIVITY ═══ */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }} className="dash-2col">
              <SectionCard title="🧠 תובנות AI לעסק שלך">
                {[...opInsights, ...aiInsights].slice(0, 4).map((ins: any, i: number) => (
                  <div key={i} style={{ display: "flex", gap: 9, alignItems: "flex-start", padding: "0.45rem 0", borderBottom: "1px solid var(--border)" }}>
                    <span style={{ fontSize: "1rem" }}>{ins.icon || "💡"}</span>
                    <div><div style={{ fontSize: "0.8rem", fontWeight: 700, color: "var(--foreground)" }}>{ins.title}</div>{ins.description && <div style={{ fontSize: "0.72rem", color: "var(--foreground-muted)" }}>{ins.description}</div>}</div>
                  </div>
                ))}
              </SectionCard>
              <SectionCard title="🕒 פעילות אחרונה">
                {activities.length === 0 ? <div style={{ fontSize: "0.82rem", color: "var(--foreground-muted)" }}>אין פעילות אחרונה</div> :
                  activities.slice(0, 7).map((a: any, i: number) => (
                    <div key={i} style={{ display: "flex", gap: 9, alignItems: "flex-start", padding: "0.4rem 0", borderBottom: "1px solid var(--border)" }}>
                      <span style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--accent)", marginTop: 6, flexShrink: 0 }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: "0.78rem", color: "var(--foreground)" }}>{a.description || a.title || a.action || "פעילות"}</div>
                        <div style={{ fontSize: "0.66rem", color: "var(--foreground-subtle)" }}>{a.userName ? a.userName + " · " : ""}{a.createdAt ? new Date(a.createdAt).toLocaleString("he-IL", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : ""}</div>
                      </div>
                    </div>
                  ))}
              </SectionCard>
            </div>

            {/* ═══ 12 · QUICK ACCESS TOOLS ═══ */}
            <div>
              <div style={sectionLabel}>🔗 גישה מהירה</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "0.6rem" }}>
                {[
                  { t: "SEO/GEO", icon: "🔍", href: "/seo-geo" }, { t: "פודקאסט", icon: "🎙️", href: "/accounting/podcast/calendar" },
                  { t: "אחסון", icon: "🌐", href: "/business-projects/hosting" }, { t: "מסמכים", icon: "📄", href: "/accounting/documents" },
                  { t: "קריאייטיב AI", icon: "✨", href: "/creative-pixelai" }, { t: "דוחות", icon: "📑", href: "/reports" },
                  { t: "אוטומציות", icon: "⚙️", href: "/automations" }, { t: "הגדרות", icon: "🔧", href: "/settings" },
                ].map((s, i) => (
                  <Link key={i} href={s.href} style={{ display: "flex", alignItems: "center", gap: 7, background: "var(--surface-raised)", border: "1px solid var(--border)", borderRadius: 10, padding: "0.5rem 0.85rem", fontSize: "0.8rem", fontWeight: 600, color: "var(--foreground)", textDecoration: "none" }}><span>{s.icon}</span>{s.t}</Link>
                ))}
              </div>
            </div>
          </>
        )}
        <style>{`@media (max-width:1100px){.dash-3col,.dash-4col{grid-template-columns:1fr 1fr !important}}@media (max-width:760px){.dash-2col,.dash-3col,.dash-4col{grid-template-columns:1fr !important}}`}</style>
      </div>
    </div>
  );
}
