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
import ClientLogo from "@/components/ui/client-logo";
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

  // ── Content produced this month ──
  const contentThisMonth = socialPosts.filter((p: any) => { const d = p.createdAt ? new Date(p.createdAt) : null; if (!d) return false; const n = new Date(); return d.getMonth() === n.getMonth() && d.getFullYear() === n.getFullYear(); }).length;

  // ── Today's collections (due today) ──
  const todayCollections = (() => {
    const t = new Date().toDateString();
    const sum = (arr: any[]) => arr.filter((p: any) => p.dueDate && new Date(p.dueDate).toDateString() === t && ["pending", "overdue", "collection_needed"].includes(p.status)).reduce((s: number, p: any) => s + (Number(p.amount) || 0), 0);
    return sum(payments) + sum(projectPayments || []);
  })();

  // ── Open debt (overdue total) ──
  const openDebt = analytics?.overdueTotal || 0;

  // ── 6-month revenue trend (paid) ──
  const revenueSeries = (() => {
    const months = [...Array(6)].map((_, i) => { const d = new Date(); d.setMonth(d.getMonth() - (5 - i)); return { y: d.getFullYear(), m: d.getMonth() }; });
    const all = [...payments, ...(projectPayments || [])];
    return months.map((mm) => all.filter((p: any) => p.status === "paid" && p.paidAt && new Date(p.paidAt).getMonth() === mm.m && new Date(p.paidAt).getFullYear() === mm.y).reduce((s: number, p: any) => s + (Number(p.amount) || 0), 0));
  })();

  // ── Client Health — active clients needing attention, with real reasons ──
  const clientHealth = useMemo(() => {
    const now = new Date();
    return clients.filter((c: any) => c.status === "active").map((c: any) => {
      const reasons: string[] = [];
      let severity = 0;
      const owe = [...payments, ...(projectPayments || [])].filter((p: any) => p.clientId === c.id && p.status === "overdue");
      if (owe.length) { reasons.push("תשלום באיחור"); severity += 3; }
      const ap = approvals.filter((a: any) => a.clientId === c.id && a.status === "pending_approval");
      if (ap.length) { const oldest = ap.map((a: any) => a.createdAt ? Math.floor((+now - +new Date(a.createdAt)) / 864e5) : 0).sort((x: number, y: number) => y - x)[0] || 0; reasons.push(oldest > 0 ? `${oldest} ימים ללא אישור` : "אישור ממתין"); severity += Math.min(3, Math.ceil((oldest || 1) / 7)); }
      if (!c.monthlyGanttStatus || c.monthlyGanttStatus === "none" || c.monthlyGanttStatus === "draft") { reasons.push("חסר תוכן חודשי"); severity += 2; }
      if (!c.assignedManagerId) { reasons.push("ללא מנהל מטפל"); severity += 1; }
      return { id: c.id, name: c.name, logo: (c as any).logoUrl, reasons, severity };
    }).filter((r: any) => r.reasons.length > 0).sort((a: any, b: any) => b.severity - a.severity).slice(0, 6);
  }, [clients, payments, projectPayments, approvals]);

  // ── Floating quick actions ──
  const [fabOpen, setFabOpen] = useState(false);
  const fabActions = [
    { icon: "👤", label: "לקוח חדש", href: "/clients" },
    { icon: "✅", label: "משימה חדשה", href: "/tasks" },
    { icon: "📝", label: "תוכן חדש", href: "/projects/new" },
    { icon: "📋", label: "פרויקט חדש", href: "/business-projects" },
    { icon: "💳", label: "חשבונית", href: "/accounting" },
    { icon: "📷", label: "יום צילום", href: "/business-calendar" },
    { icon: "🗓️", label: "תוכנית חודשית", href: "/clients" },
    { icon: "🎨", label: "לוח תוכן", href: "/campaigns" },
  ];

  return (
    <div className="mhd-root">
      <div className="mhd-content stagger-in" style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
        {(isLoading || !analytics) ? (
          <div style={{ padding: "4rem", textAlign: "center", color: "var(--foreground-muted)" }}>טוען מרכז פיקוד…</div>
        ) : (
          <>
            {/* ═══════════════ 1 · DAILY COMMAND CENTER (HERO) ═══════════════ */}
            <div style={{ display: "grid", gridTemplateColumns: "1.55fr 1fr", gap: "1.1rem", alignItems: "stretch" }} className="dash-2col">
              {/* Greeting + today's must-knows */}
              <div style={{ borderRadius: 22, padding: "1.6rem 1.8rem", background: "linear-gradient(135deg,#eff6ff 0%,#f5f3ff 45%,#ecfeff 100%)", border: "1px solid #dbeafe", direction: "rtl" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 8 }}>
                  <div>
                    <h1 style={{ fontSize: "1.85rem", fontWeight: 900, margin: 0, color: "#0f172a" }}>{greeting}, טל! 👋</h1>
                    <div style={{ fontSize: "0.85rem", color: "#64748b", marginTop: 3 }}>{todayLabel}</div>
                  </div>
                  <div style={{ fontSize: "0.82rem", color: "#475569", maxWidth: 320, textAlign: "start" }}>הנה מה שמחכה לך היום</div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(110px,1fr))", gap: "0.7rem", margin: "1.2rem 0" }}>
                  {[
                    { v: clientHealth.length, l: "לקוחות לטיפול", c: "#ef4444", href: "/clients" },
                    { v: analytics.overdueTasks, l: "משימות דחופות", c: "#f97316", href: "/tasks" },
                    { v: analytics.pendingApprovals, l: "אישורים ממתינים", c: "#3b82f6", href: "/approvals" },
                    { v: formatCurrency(todayCollections || analytics.pendingPayments), l: "גבייה להיום", c: "#8b5cf6", href: "/accounting" },
                    { v: schedule.today[0]?.time || "—", l: schedule.today[0]?.title || "אין אירוע", c: "#06b6d4", href: "/business-calendar" },
                  ].map((m, i) => (
                    <Link key={i} href={m.href} style={{ background: "rgba(255,255,255,0.75)", border: "1px solid rgba(255,255,255,0.9)", borderRadius: 14, padding: "0.7rem 0.6rem", textAlign: "center", textDecoration: "none", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
                      <div style={{ fontSize: "1.35rem", fontWeight: 900, color: m.c, lineHeight: 1.1 }}>{m.v}</div>
                      <div style={{ fontSize: "0.66rem", color: "#64748b", marginTop: 3 }}>{m.l}</div>
                    </Link>
                  ))}
                </div>
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  <Link href="/calendar" style={{ display: "inline-flex", alignItems: "center", gap: 7, background: "linear-gradient(135deg,#6366f1,#06b6d4)", color: "#fff", borderRadius: 12, padding: "0.65rem 1.3rem", fontWeight: 800, fontSize: "0.88rem", textDecoration: "none" }}>← פתח את היום שלי</Link>
                  <Link href="/exec-dashboard" style={{ display: "inline-flex", alignItems: "center", gap: 7, background: "#fff", color: "#4f46e5", border: "1px solid #c7d2fe", borderRadius: 12, padding: "0.65rem 1.1rem", fontWeight: 700, fontSize: "0.82rem", textDecoration: "none" }}>סדר עדיפויות →</Link>
                </div>
              </div>
              {/* Dark Pixel AI Chief of Staff hero card */}
              <div style={{ position: "relative", overflow: "hidden", borderRadius: 22, padding: "1.6rem", background: "linear-gradient(145deg,#1e1b4b 0%,#312e81 50%,#0c4a6e 100%)", border: "1px solid #4338ca", direction: "rtl", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", minHeight: 230 }}>
                <div style={{ position: "absolute", inset: 0, background: "radial-gradient(circle at 50% 30%, rgba(99,102,241,0.45), transparent 60%)" }} />
                <div style={{ position: "relative", zIndex: 1 }}>
                  <div style={{ fontSize: "1.25rem", fontWeight: 900, color: "#fff", letterSpacing: 0.5 }}>Pixel AI</div>
                  <div style={{ fontSize: "0.85rem", fontWeight: 700, background: "linear-gradient(90deg,#a5b4fc,#67e8f9)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>Chief of Staff</div>
                  <div style={{ width: 92, height: 92, borderRadius: "50%", margin: "1rem auto", background: "radial-gradient(circle at 35% 30%, #818cf8, #3730a3 70%)", boxShadow: "0 0 40px rgba(129,140,248,0.7), inset 0 -8px 20px rgba(0,0,0,0.3)", display: "flex", alignItems: "center", justifyContent: "center", position: "relative" }}>
                    <span style={{ position: "absolute", top: 32, left: 26, width: 12, height: 12, borderRadius: "50%", background: "#22d3ee", boxShadow: "0 0 10px #22d3ee" }} />
                    <span style={{ position: "absolute", top: 32, right: 26, width: 12, height: 12, borderRadius: "50%", background: "#22d3ee", boxShadow: "0 0 10px #22d3ee" }} />
                    <span style={{ position: "absolute", bottom: 26, width: 26, height: 7, borderRadius: 6, background: "rgba(255,255,255,0.55)" }} />
                  </div>
                  <div style={{ fontSize: "0.82rem", color: "#c7d2fe", lineHeight: 1.5, maxWidth: 230 }}>העוזר האישי שלך לניהול הסטודיו — עוקב, מתריע וממליץ.</div>
                </div>
              </div>
            </div>

            {/* ═══════════════ 2 · TOP KPI CARDS ═══════════════ */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(155px,1fr))", gap: "0.85rem" }}>
              {[
                { icon: "👥", c: "#38bdf8", val: analytics.activeClients, label: "לקוחות פעילים", sub: `${clients.length} סה"כ`, href: "/clients", series: undefined as number[] | undefined },
                { icon: "💰", c: "#8b5cf6", val: formatCurrency(analytics.revenue), label: "הכנסה חודשית", sub: "החודש", href: "/accounting", series: revenueSeries },
                { icon: "📋", c: "#f97316", val: openProjects, label: "פרויקטים פתוחים", sub: `${analytics.activeCampaigns} קמפיינים`, href: "/business-projects", series: undefined },
                { icon: "✋", c: "#3b82f6", val: analytics.pendingApprovals, label: "אישורים ממתינים", sub: "דורש טיפול", href: "/approvals", series: undefined },
                { icon: "💬", c: "#25D366", val: waUnread.length, label: "וואטסאפ שלא נענה", sub: waState === "off" ? "לא מחובר" : "ממתין", href: "/whatsapp-inbox", series: undefined },
                { icon: "🧾", c: "#10b981", val: formatCurrency(todayCollections), label: "גבייה להיום", sub: formatCurrency(analytics.pendingPayments) + " פתוח", href: "/accounting", series: undefined },
              ].map((k, i) => (
                <Link key={i} href={k.href} className="premium-card" style={{ padding: "1rem", textDecoration: "none", display: "flex", flexDirection: "column", gap: 5 }}>
                  <span style={{ width: 34, height: 34, borderRadius: 10, background: k.c + "1a", color: k.c, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1rem" }}>{k.icon}</span>
                  <span style={{ fontSize: "1.35rem", fontWeight: 900, color: "var(--foreground)", lineHeight: 1.05 }}>{k.val}</span>
                  <span style={{ fontSize: "0.76rem", fontWeight: 700, color: "var(--foreground)" }}>{k.label}</span>
                  <span style={{ fontSize: "0.66rem", color: "var(--foreground-muted)" }}>{k.sub}</span>
                  {k.series && k.series.some((n) => n > 0) && <Sparkline values={k.series} />}
                </Link>
              ))}
            </div>

            {/* ═══════════════ 3 · WHATSAPP COMMAND CENTER  +  4 · AI RECOMMENDATIONS ═══════════════ */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }} className="dash-2col">
              <SectionCard title="💬 מרכז וואטסאפ" action={<Link href="/whatsapp-inbox" style={linkSmall}>פתח את כל השיחות ←</Link>}>
                {waState === "off" ? <div style={{ fontSize: "0.82rem", color: "var(--foreground-muted)" }}>הוואטסאפ לא מחובר. <Link href="/whatsapp-broadcast" style={{ color: "var(--accent)", fontWeight: 700 }}>חבר עכשיו</Link></div>
                  : waChats.length === 0 ? <div style={{ fontSize: "0.85rem", color: "var(--foreground-muted)" }}>אין שיחות אחרונות</div>
                  : waChats.slice(0, 5).map((c: any, i: number) => (
                    <Link key={i} href="/whatsapp-inbox" style={{ display: "flex", gap: 11, alignItems: "center", padding: "0.55rem 0", textDecoration: "none", borderBottom: "1px solid var(--border)" }}>
                      <Avatar name={c.name || c.phone} size={36} ring={false} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", gap: 6 }}>
                          <span style={{ fontSize: "0.82rem", fontWeight: 700, color: "var(--foreground)" }}>{c.name || c.phone}</span>
                          <span style={{ fontSize: "0.64rem", color: "var(--foreground-subtle)" }}>{timeSince(c.timestamp)}</span>
                        </div>
                        <div style={{ fontSize: "0.72rem", color: "var(--foreground-muted)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.lastMessage || ""}</div>
                      </div>
                      {(c.unread || 0) > 0 ? <span style={{ background: "#25D366", color: "#fff", fontSize: "0.64rem", fontWeight: 800, borderRadius: 999, padding: "1px 8px" }}>{c.unread}</span> : <span style={{ width: 9, height: 9, borderRadius: "50%", background: "var(--border)" }} />}
                    </Link>
                  ))}
              </SectionCard>

              <SectionCard title="✨ Pixel AI — Chief of Staff" action={<Link href="/exec-dashboard" style={linkSmall}>המלצות נוספות ←</Link>}>
                {[...opInsights, ...aiInsights].slice(0, 4).map((ins: any, i: number) => (
                  <Link key={i} href={(ins as any).href || "/exec-dashboard"} style={{ display: "flex", gap: 9, alignItems: "flex-start", padding: "0.5rem 0", textDecoration: "none", borderBottom: "1px solid var(--border)" }}>
                    <span style={{ fontSize: "1rem", marginTop: 1 }}>{ins.icon || "💡"}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: "0.8rem", fontWeight: 700, color: "var(--foreground)" }}>{ins.title || ins.description}</div>
                      {ins.title && ins.description && <div style={{ fontSize: "0.7rem", color: "var(--foreground-muted)" }}>{ins.description}</div>}
                    </div>
                    <span style={{ color: "var(--foreground-subtle)" }}>›</span>
                  </Link>
                ))}
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
                  {recommended.slice(0, 2).map((r, i) => (
                    <Link key={i} href={r.href} style={{ fontSize: "0.72rem", fontWeight: 700, color: "#4f46e5", background: "#eef2ff", border: "1px solid #c7d2fe", borderRadius: 999, padding: "0.35rem 0.8rem", textDecoration: "none" }}>{r.icon} {r.label}</Link>
                  ))}
                </div>
              </SectionCard>
            </div>

            {/* ═══════════════ 5 · TODAY TIMELINE (control tower) ═══════════════ */}
            <div>
              <div style={sectionLabel}>📆 היום שלך</div>
              {schedule.today.length === 0 ? (
                <div className="premium-card" style={{ padding: "1.2rem", fontSize: "0.82rem", color: "var(--foreground-muted)" }}>אין אירועים מתוכננים להיום</div>
              ) : (
                <div style={{ display: "flex", gap: "0.8rem", overflowX: "auto", paddingBottom: 6 }}>
                  {schedule.today.map((e: any, i: number) => (
                    <Link key={i} href={e.href} className="premium-card" style={{ minWidth: 160, padding: "0.95rem 1rem", textDecoration: "none", display: "flex", flexDirection: "column", gap: 5, borderTop: "3px solid var(--accent)" }}>
                      <span style={{ fontSize: "0.95rem", fontWeight: 900, color: "var(--accent)" }}>{e.time || "—"}</span>
                      <span style={{ fontSize: "1.1rem" }}>{e.icon}</span>
                      <span style={{ fontSize: "0.82rem", fontWeight: 700, color: "var(--foreground)" }}>{e.title}</span>
                      <span style={{ fontSize: "0.68rem", color: "var(--foreground-muted)" }}>{e.sub}</span>
                    </Link>
                  ))}
                </div>
              )}
            </div>

            {/* ═══════════════ 6 · TASK COMMAND CENTER (4 columns) ═══════════════ */}
            <div>
              <div style={sectionLabel}>✅ משימות — מרכז הביצוע</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: "0.9rem" }} className="dash-4col">
                {[
                  { label: "לטיפול", color: "#ef4444", items: actionCenter.needs, href: "/tasks" },
                  { label: "בתהליך", color: "#3b82f6", items: actionCenter.inProgress, href: "/tasks" },
                  { label: "ממתין לאישור", color: "#f59e0b", items: waitingClient, href: "/approvals" },
                  { label: "הושלם השבוע", color: "#22c55e", items: actionCenter.done, href: "/tasks" },
                ].map((col, ci) => (
                  <div key={ci} className="premium-card" style={{ padding: "1rem", borderTop: `3px solid ${col.color}` }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                      <span style={{ fontSize: "0.8rem", fontWeight: 800, color: "var(--foreground)" }}>{col.label}</span>
                      <span style={{ fontSize: "0.68rem", fontWeight: 800, color: col.color, background: col.color + "1a", borderRadius: 999, padding: "2px 9px" }}>{col.items.length}</span>
                    </div>
                    {col.items.length === 0 ? <div style={{ fontSize: "0.74rem", color: "var(--foreground-subtle)" }}>—</div> :
                      col.items.slice(0, 4).map((it: any, i: number) => (
                        <Link key={i} href={it.href || col.href} style={{ display: "flex", gap: 7, alignItems: "flex-start", padding: "0.4rem 0", textDecoration: "none", borderBottom: "1px solid var(--border)" }}>
                          <span style={{ fontSize: "0.85rem" }}>{it.icon || "•"}</span>
                          <div style={{ minWidth: 0, flex: 1 }}>
                            <div style={{ fontSize: "0.77rem", fontWeight: 600, color: "var(--foreground)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{it.title}</div>
                            {it.sub && <div style={{ fontSize: "0.66rem", color: "var(--foreground-muted)" }}>{it.sub}</div>}
                          </div>
                        </Link>
                      ))}
                    <Link href={col.href} style={{ ...linkSmall, display: "block", marginTop: 8, color: col.color }}>ראה הכל ←</Link>
                  </div>
                ))}
              </div>
            </div>

            {/* ═══════════════ 7 · BUSINESS OVERVIEW ═══════════════ */}
            <div>
              <div style={sectionLabel}>📊 סקירת עסק</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: "0.85rem" }}>
                {[
                  { label: "לקוחות פעילים", val: analytics.activeClients, series: undefined as number[] | undefined, href: "/clients" },
                  { label: "הכנסות החודש", val: formatCurrency(analytics.revenue), series: revenueSeries, href: "/accounting" },
                  { label: "גבייה פתוחה", val: formatCurrency(analytics.pendingPayments), series: undefined, href: "/accounting" },
                  { label: "חובות פתוחים", val: formatCurrency(openDebt), series: undefined, href: "/accounting" },
                  { label: "תכנים החודש", val: contentThisMonth, series: doneSeries, href: "/campaigns" },
                  { label: "שיעור סגירה", val: `${closeRate}%`, series: leadsSeries, href: "/leads" },
                ].map((k, i) => (
                  <Link key={i} href={k.href} className="premium-card" style={{ padding: "0.95rem 1rem", textDecoration: "none", display: "flex", flexDirection: "column", gap: 4 }}>
                    <span style={{ fontSize: "0.74rem", color: "var(--foreground-muted)" }}>{k.label}</span>
                    <span style={{ fontSize: "1.45rem", fontWeight: 900, color: "var(--foreground)", lineHeight: 1.1 }}>{k.val}</span>
                    {k.series && k.series.some((n) => n > 0) && <Sparkline values={k.series} />}
                  </Link>
                ))}
              </div>
            </div>

            {/* ═══════════════ 8 · PROJECTS CENTER ═══════════════ */}
            {projectsStatus.length > 0 && (
              <div>
                <div style={sectionLabel}>📁 פרויקטים פעילים</div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(230px,1fr))", gap: "0.9rem" }}>
                  {projectsStatus.map((p: any) => {
                    const cl = clients.find((c: any) => c.name === p.clientName);
                    return (
                    <Link key={p.id} href="/business-projects" className="premium-card" style={{ padding: "1.05rem 1.1rem", textDecoration: "none", display: "flex", flexDirection: "column", gap: 9 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <ClientLogo src={cl ? (cl as any).logoUrl : undefined} name={p.clientName || p.name} size={34} />
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: "0.88rem", fontWeight: 800, color: "var(--foreground)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.name}</div>
                          <div style={{ fontSize: "0.7rem", color: "var(--foreground-muted)" }}>{p.clientName}</div>
                        </div>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.72rem", color: "var(--foreground-muted)" }}>
                        <span>התקדמות</span><span style={{ fontWeight: 800, color: pColor(p.pct) }}>{p.pct}%</span>
                      </div>
                      <div style={{ height: 8, background: "var(--surface)", borderRadius: 999, overflow: "hidden" }}><div style={{ width: `${p.pct}%`, height: "100%", background: pColor(p.pct), borderRadius: 999 }} /></div>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ fontSize: "0.68rem", color: p.pct < 40 ? "#ef4444" : "var(--foreground-muted)" }}>{p.deadline ? `יעד ${new Date(p.deadline).toLocaleDateString("he-IL", { day: "2-digit", month: "2-digit" })}` : ""}{p.pct < 40 ? " · בסיכון" : ""}</span>
                        {p.mgr && <Avatar src={p.mgr.avatarUrl} name={p.mgr.name} size={24} ring={false} />}
                      </div>
                    </Link>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ═══════════════ 9 · CLIENT HEALTH CENTER ═══════════════ */}
            <div>
              <div style={sectionLabel}>🩺 לקוחות הדורשים תשומת לב</div>
              {clientHealth.length === 0 ? (
                <div className="premium-card" style={{ padding: "1.2rem", fontSize: "0.85rem", color: "#16a34a", fontWeight: 700 }}>כל הלקוחות בטיפול תקין 🎉</div>
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: "0.85rem" }}>
                  {clientHealth.map((c: any) => {
                    const tone = c.severity >= 5 ? "#ef4444" : c.severity >= 3 ? "#f59e0b" : "#64748b";
                    return (
                      <Link key={c.id} href={`/clients/${c.id}`} className="premium-card" style={{ padding: "1rem", textDecoration: "none", display: "flex", flexDirection: "column", gap: 8, borderInlineStart: `4px solid ${tone}`, background: tone === "#ef4444" ? "rgba(239,68,68,0.05)" : "var(--surface-raised)" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                          <ClientLogo src={c.logo} name={c.name} size={30} />
                          <span style={{ fontSize: "0.85rem", fontWeight: 800, color: "var(--foreground)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.name}</span>
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                          {c.reasons.slice(0, 3).map((r: string, i: number) => (
                            <span key={i} style={{ fontSize: "0.72rem", color: tone, fontWeight: 600, display: "flex", alignItems: "center", gap: 5 }}><span style={{ width: 5, height: 5, borderRadius: "50%", background: tone }} />{r}</span>
                          ))}
                        </div>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>

            {/* ═══════════════ 10·11 · AI INSIGHTS · MONTHLY CHART · ACTIVITY ═══════════════ */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "1rem" }} className="dash-3col">
              <SectionCard title="🧠 תובנות AI לעסק">
                {[...opInsights, ...aiInsights].slice(0, 5).map((ins: any, i: number) => (
                  <div key={i} style={{ display: "flex", gap: 9, alignItems: "flex-start", padding: "0.45rem 0", borderBottom: "1px solid var(--border)" }}>
                    <span style={{ fontSize: "1rem" }}>{ins.icon || "💡"}</span>
                    <div><div style={{ fontSize: "0.79rem", fontWeight: 700, color: "var(--foreground)" }}>{ins.title || ins.description}</div>{ins.title && ins.description && <div style={{ fontSize: "0.7rem", color: "var(--foreground-muted)" }}>{ins.description}</div>}</div>
                  </div>
                ))}
              </SectionCard>

              <SectionCard title="📈 ביצועים — 6 חודשים" action={<Link href="/accounting" style={linkSmall}>פירוט ←</Link>}>
                <div style={{ fontSize: "1.5rem", fontWeight: 900, color: "var(--foreground)" }}>{formatCurrency(revenueSeries[revenueSeries.length - 1] || 0)}</div>
                <div style={{ fontSize: "0.7rem", color: "var(--foreground-muted)", marginBottom: 10 }}>הכנסות החודש הנוכחי</div>
                {revenueSeries.some((n) => n > 0) ? <Sparkline values={revenueSeries} /> : <div style={{ fontSize: "0.78rem", color: "var(--foreground-subtle)" }}>אין נתוני הכנסה עדיין</div>}
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: 12, fontSize: "0.72rem" }}>
                  <div><div style={{ color: "var(--foreground-muted)" }}>לידים</div><div style={{ fontWeight: 800, color: "var(--accent)" }}>{analytics.activeLeads}</div></div>
                  <div><div style={{ color: "var(--foreground-muted)" }}>נסגרו</div><div style={{ fontWeight: 800, color: "#22c55e" }}>{analytics.wonLeads}</div></div>
                  <div><div style={{ color: "var(--foreground-muted)" }}>תכנים</div><div style={{ fontWeight: 800, color: "#8b5cf6" }}>{contentThisMonth}</div></div>
                </div>
              </SectionCard>

              <SectionCard title="🕒 פעילות אחרונה">
                {activities.length === 0 ? <div style={{ fontSize: "0.82rem", color: "var(--foreground-muted)" }}>אין פעילות אחרונה</div> :
                  activities.slice(0, 7).map((a: any, i: number) => (
                    <div key={i} style={{ display: "flex", gap: 9, alignItems: "flex-start", padding: "0.4rem 0", borderBottom: "1px solid var(--border)" }}>
                      <span style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--accent)", marginTop: 6, flexShrink: 0 }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: "0.77rem", color: "var(--foreground)" }}>{a.description || a.title || a.action || "פעילות"}</div>
                        <div style={{ fontSize: "0.65rem", color: "var(--foreground-subtle)" }}>{a.userName ? a.userName + " · " : ""}{a.createdAt ? new Date(a.createdAt).toLocaleString("he-IL", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : ""}</div>
                      </div>
                    </div>
                  ))}
              </SectionCard>
            </div>

            {/* ═══════════════ 12 · FLOATING QUICK ACTIONS ═══════════════ */}
            <div style={{ position: "fixed", insetInlineEnd: 24, bottom: 24, zIndex: 50, direction: "rtl" }}>
              {fabOpen && (
                <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 12, alignItems: "flex-end" }}>
                  {fabActions.map((a, i) => (
                    <Link key={i} href={a.href} onClick={() => setFabOpen(false)} style={{ display: "flex", alignItems: "center", gap: 9, background: "var(--surface-raised)", border: "1px solid var(--border)", borderRadius: 999, padding: "0.5rem 0.95rem", fontSize: "0.8rem", fontWeight: 700, color: "var(--foreground)", textDecoration: "none", boxShadow: "0 4px 14px rgba(0,0,0,0.12)" }}>
                      <span>{a.icon}</span>{a.label}
                    </Link>
                  ))}
                </div>
              )}
              <button onClick={() => setFabOpen((o) => !o)} aria-label="פעולות מהירות" style={{ width: 56, height: 56, borderRadius: "50%", border: "none", cursor: "pointer", background: "linear-gradient(135deg,#6366f1,#06b6d4)", color: "#fff", fontSize: "1.6rem", boxShadow: "0 6px 22px rgba(99,102,241,0.5)", transition: "transform 0.2s", transform: fabOpen ? "rotate(45deg)" : "none" }}>+</button>
            </div>
          </>
        )}
        <style>{`@media (max-width:1100px){.dash-3col,.dash-4col{grid-template-columns:1fr 1fr !important}}@media (max-width:760px){.dash-2col,.dash-3col,.dash-4col{grid-template-columns:1fr !important}}`}</style>
      </div>
    </div>
  );
}
