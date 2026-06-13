"use client";

import { useState, useMemo, useEffect } from "react";
import type { Client, Employee } from "@/lib/db/schema";
import Avatar from "@/components/ui/avatar";
import ClientLogo from "@/components/ui/client-logo";
import { Sparkline } from "@/components/ui/saas-kit";
import {
  computeClientHealth,
  inferClientStatus,
  STATUS_LABELS_EXTENDED,
  getClientSnapshotCounts,
  type ClientHealthScore,
  type ClientStatusExtended,
} from "@/lib/business/client-health";

const CLIENT_TYPE_LABELS: Record<string, { label: string; color: string; emoji?: string }> = {
  marketing: { label: "מרקטינג", color: "#00B5FE" },
  branding: { label: "ברנדינג", color: "#00B5FE" },
  websites: { label: "אתרים", color: "#22c55e" },
  hosting: { label: "הוסטינג", color: "#f59e0b" },
  podcast: { label: "פודקאסט", color: "#CCFF00", emoji: "🎙️" },
  lead: { label: "ליד", color: "#94a3b8", emoji: "🔗" },
};

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  active: { label: "פעיל", color: "#22c55e" },
  inactive: { label: "לא פעיל", color: "#f59e0b" },
  prospect: { label: "פוטנציאלי", color: "#a1a1aa" },
};

const PAYMENT_STATUS_COLORS: Record<string, string> = {
  current: "#22c55e",
  overdue: "#ef4444",
  pending: "#f59e0b",
  none: "#6b7280",
};

const GANTT_STATUS_COLORS: Record<string, { label: string; color: string }> = {
  draft: { label: "טיוטה", color: "#6b7280" },
  approved: { label: "מאושר", color: "#22c55e" },
  sent_to_client: { label: "נשלח ללקוח", color: "#38bdf8" },
  client_approved: { label: "אושר על ידי לקוח", color: "#10b981" },
  none: { label: "לא יוצר", color: "#9ca3af" },
};

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  const months = ["ינו", "פבר", "מרץ", "אפר", "מאי", "יונ", "יול", "אוג", "ספט", "אוק", "נוב", "דצמ"];
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

function initials(name: string) {
  return name.split(" ").map((w) => w[0]).join("").slice(0, 2);
}

interface TabOverviewProps {
  client: Client;
  assignedManager?: Employee;
  color: string;
  onUpdateClient?: (updates: Partial<Client>) => Promise<void>;
  employees?: Employee[];
  onNavigateTab?: (tab: string) => void;
  tasks?: any[];
  payments?: any[];
  projectPayments?: any[];
  campaigns?: any[];
  leads?: any[];
  ganttItems?: any[];
  socialPosts?: any[];
  meetings?: any[];
  approvals?: any[];
  activities?: any[];
}

export default function TabOverview({ client, assignedManager, color, onUpdateClient, employees = [], onNavigateTab, tasks = [], payments = [], projectPayments = [], campaigns = [], leads = [], ganttItems = [], socialPosts = [], meetings = [], approvals = [], activities = [] }: TabOverviewProps) {
  const [isAssigneeDropdownOpen, setIsAssigneeDropdownOpen] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  const TEAM_MEMBERS = ["טל זטלמן", "מאיה זטלמן", "נועם בוברין", "מיכאלה"];

  // Health Score
  const healthScore = useMemo(() => {
    const clientTasks = tasks.filter((t: any) => t.clientId === client.id);
    const clientPayments = payments.filter((p: any) => p.clientId === client.id);
    const clientProjectPayments = projectPayments.filter((p: any) => p.clientId === client.id);
    return computeClientHealth(client as any, clientTasks, clientPayments, clientProjectPayments);
  }, [client, tasks, payments, projectPayments]);

  const extendedStatus = useMemo(() => inferClientStatus(client as any, healthScore), [client, healthScore]);

  // Snapshot counts
  const snapshot = useMemo(() => {
    return getClientSnapshotCounts(client.id, campaigns as any, leads as any, tasks as any, ganttItems as any, socialPosts as any);
  }, [client.id, campaigns, leads, tasks, ganttItems, socialPosts]);

  const handleAssignEmployee = async (employeeId: string) => {
    if (!onUpdateClient) return;
    setIsUpdating(true);
    try {
      await onUpdateClient({ assignedManagerId: employeeId });
      setIsAssigneeDropdownOpen(false);
    } finally {
      setIsUpdating(false);
    }
  };

  const statusInfo = STATUS_LABELS_EXTENDED[extendedStatus] || STATUS_LABELS_EXTENDED.active;

  // ── Command-center model (real data already passed to this tab) ──
  const cmd = useMemo(() => {
    const now = new Date();
    const ct = tasks.filter((t: any) => t.clientId === client.id);
    const openTasks = ct.filter((t: any) => t.status !== "completed" && t.status !== "approved");
    const overdueTasks = openTasks.filter((t: any) => t.dueDate && new Date(t.dueDate) < new Date(now.toDateString()));
    const reviewTasks = ct.filter((t: any) => t.status === "under_review").length;
    const cp = [...payments.filter((p: any) => p.clientId === client.id), ...projectPayments.filter((p: any) => p.clientId === client.id)];
    const openCollections = cp.filter((p: any) => ["pending", "overdue", "collection_needed"].includes(p.status)).reduce((s: number, p: any) => s + (Number(p.amount) || 0), 0);
    const overdueCollections = cp.filter((p: any) => p.status === "overdue").reduce((s: number, p: any) => s + (Number(p.amount) || 0), 0);
    const monthlyValue = Number((client as any).retainerAmount || (client as any).monthlyValue || 0);
    const activeCampaigns = (campaigns || []).filter((c: any) => c.clientId === client.id && c.status === "active").length;
    const activeLeads = (leads || []).filter((l: any) => l.clientId === client.id && !["won", "lost", "not_relevant", "duplicate"].includes(l.status || "")).length;
    // AI account-manager insights (derived, no fake data)
    const risks: string[] = [];
    const opps: string[] = [];
    if (overdueTasks.length) risks.push(`${overdueTasks.length} משימות בפיגור`);
    if (overdueCollections > 0) risks.push(`₪${overdueCollections.toLocaleString()} בפיגור גבייה`);
    if (!assignedManager) risks.push("לא הוקצה מנהל לקוח");
    (healthScore.factors || []).slice(0, 2).forEach((f: string) => { if (/חוב|איחור|נמוך|ללא|חסר/.test(f)) risks.push(f); });
    if (activeLeads > 0) opps.push(`${activeLeads} לידים פעילים לקידום`);
    if (monthlyValue > 0 && activeCampaigns === 0) opps.push("אין קמפיין פעיל — הזדמנות להרחבה");

    // meetings this month (for this client)
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).getTime();
    const clientMeetings = (meetings || []).filter((m: any) => m.clientId === client.id && m.status !== "cancelled");
    const meetingsThisMonth = clientMeetings.filter((m: any) => m.date && new Date(m.date).getTime() >= monthStart && new Date(m.date).getTime() <= monthEnd).length;
    const lastMeeting = clientMeetings.filter((m: any) => m.date && new Date(m.date) <= now).sort((a: any, b: any) => +new Date(b.date) - +new Date(a.date))[0];
    const daysSinceMeeting = lastMeeting ? Math.floor((now.getTime() - new Date(lastMeeting.date).getTime()) / 86400000) : null;
    if (daysSinceMeeting !== null && daysSinceMeeting > 30) risks.push(`לא נערכה פגישה ${daysSinceMeeting} ימים`);
    else if (daysSinceMeeting === null && clientMeetings.length === 0) opps.push("קבעו פגישת היכרות/סטטוס");

    // open approvals for this client
    const clientApprovals = (approvals || []).filter((a: any) => a.clientId === client.id);
    const openApprovals = clientApprovals.filter((a: any) => a.status === "pending_approval").length;
    if (openApprovals > 0) risks.push(`${openApprovals} אישורים ממתינים`);

    // client timeline (real events from completed tasks, payments, meetings, activities)
    const tl: { icon: string; text: string; at: string }[] = [];
    ct.filter((t: any) => (t.status === "completed" || t.status === "approved") && (t.updatedAt || t.createdAt)).forEach((t: any) => tl.push({ icon: "✅", text: `הושלמה: ${t.title}`, at: t.updatedAt || t.createdAt }));
    cp.filter((p: any) => p.status === "paid" && (p.paidAt || p.updatedAt)).forEach((p: any) => tl.push({ icon: "💰", text: `תשלום שולם · ₪${(Number(p.amount) || 0).toLocaleString()}`, at: p.paidAt || p.updatedAt }));
    clientMeetings.filter((m: any) => m.status === "completed" && m.date).forEach((m: any) => tl.push({ icon: "🤝", text: `פגישה: ${m.title}`, at: m.date }));
    (activities || []).filter((a: any) => a.clientId === client.id && (a.createdAt)).forEach((a: any) => tl.push({ icon: "📌", text: a.description || a.title || a.action || "פעילות", at: a.createdAt }));
    const timeline = tl.filter((x) => x.at).sort((a, b) => +new Date(b.at) - +new Date(a.at)).slice(0, 8);

    return { openTasks: openTasks.length, overdueTasks: overdueTasks.length, reviewTasks, openCollections, monthlyValue, activeCampaigns, activeLeads, risks, opps, meetingsThisMonth, openApprovals, timeline };
  }, [client, tasks, payments, projectPayments, campaigns, leads, assignedManager, healthScore, meetings, approvals, activities]);

  // ── WhatsApp Center (live chats filtered to this client's phone) ──
  const [waChats, setWaChats] = useState<any[]>([]);
  const [waState, setWaState] = useState<"loading" | "ok" | "off">("loading");
  useEffect(() => {
    let alive = true;
    const headers: Record<string, string> = {};
    try { const r = localStorage.getItem("frameai_role"); if (r) headers["x-app-role"] = r; const u = localStorage.getItem("frameai_user_id"); if (u) headers["x-app-user-id"] = u; } catch {}
    fetch("/api/whatsapp/qr-chats", { headers, cache: "no-store" }).then((r) => r.json())
      .then((d) => { if (!alive) return; if (d?.state === "ok" && Array.isArray(d.chats)) { setWaChats(d.chats); setWaState("ok"); } else setWaState("off"); })
      .catch(() => { if (alive) setWaState("off"); });
    return () => { alive = false; };
  }, []);
  const clientChats = useMemo(() => {
    const digits = (s: string) => String(s || "").replace(/\D/g, "").slice(-9);
    const phone = digits((client as any).phone || "");
    if (!phone) return [];
    return waChats.filter((c: any) => digits(c.phone).includes(phone) || phone.includes(digits(c.phone))).sort((a: any, b: any) => (b.timestamp || 0) - (a.timestamp || 0));
  }, [waChats, client]);
  const waTimeSince = (ts: number) => { if (!ts) return ""; const m = Math.floor((Date.now() - ts * 1000) / 60000); if (m < 60) return `לפני ${m} ד׳`; const h = Math.floor(m / 60); return h < 24 ? `לפני ${h} ש׳` : `לפני ${Math.floor(h / 24)} ימים`; };

  const fmt = (n: number) => new Intl.NumberFormat("he-IL", { style: "currency", currency: "ILS", minimumFractionDigits: 0 }).format(n);

  // ══ Client Command Center derivations (real data only) ══
  const now2 = new Date();
  const empById = (id: string) => employees.find((e: any) => e.id === id);
  const sinceStr = formatDate((client as any).createdAt || null);
  const servicesCount = (client as any).services?.length || cmd.activeCampaigns || 0;

  // Marketing funnel (this client's content pipeline)
  const gi = (ganttItems || []).filter((g: any) => g.clientId === client.id);
  const funnel = [
    { label: "מתוכנן", n: gi.filter((g: any) => ["new_idea", "draft", "planned"].includes(g.status)).length, color: "#c4b5fd" },
    { label: "בעיצוב", n: gi.filter((g: any) => ["in_progress", "returned_for_changes"].includes(g.status)).length, color: "#93c5fd" },
    { label: "ממתין לאישור", n: gi.filter((g: any) => ["submitted_for_approval", "scheduled"].includes(g.status)).length, color: "#fcd34d" },
    { label: "אושר", n: gi.filter((g: any) => g.status === "approved").length, color: "#86efac" },
    { label: "פורסם", n: gi.filter((g: any) => g.status === "published").length, color: "#4ade80" },
  ];
  const funnelMax = Math.max(1, ...funnel.map((f) => f.n));
  const publishedCount = funnel[4].n;
  const monthlyGoal = Number((client as any).monthlyContentGoal || 0);

  // Active projects (this client's active campaigns rendered as project cards)
  const PCT_BY_CSTATUS: Record<string, number> = { planning: 20, draft: 25, in_progress: 55, active: 60, review: 80, scheduled: 70, completed: 100 };
  const clientProjects = (campaigns || []).filter((c: any) => c.clientId === client.id && c.status !== "completed" && c.status !== "archived").slice(0, 5).map((c: any) => ({ id: c.id, name: c.name || "קמפיין", status: c.status, pct: typeof c.progress === "number" ? c.progress : (PCT_BY_CSTATUS[c.status] || 40), deadline: c.endDate || c.scheduledDate, mgr: assignedManager }));

  // Team operations (employees with open work for this client)
  const teamOps = (() => {
    const counts: Record<string, number> = {};
    tasks.filter((t: any) => t.clientId === client.id && t.status !== "completed" && t.status !== "approved").forEach((t: any) => (t.assigneeIds || []).forEach((id: string) => { counts[id] = (counts[id] || 0) + 1; }));
    return employees.map((e: any) => ({ id: e.id, name: e.name, role: (e as any).role, avatarUrl: (e as any).avatarUrl, open: counts[e.id] || 0 })).filter((e) => e.open > 0).sort((a, b) => b.open - a.open).slice(0, 5);
  })();

  // Task command columns (this client)
  const ctAll = tasks.filter((t: any) => t.clientId === client.id);
  const taskCols = [
    { label: "דחוף", color: "#ef4444", items: ctAll.filter((t: any) => t.status !== "completed" && t.status !== "approved" && t.dueDate && new Date(t.dueDate) < new Date(now2.toDateString())) },
    { label: "בתהליך", color: "#3b82f6", items: ctAll.filter((t: any) => t.status === "in_progress") },
    { label: "ממתין ללקוח", color: "#f59e0b", items: ctAll.filter((t: any) => t.status === "under_review" || t.status === "returned" || t.status === "approved") },
    { label: "הושלם", color: "#22c55e", items: ctAll.filter((t: any) => t.status === "completed") },
  ];

  // Finance center (this client)
  const cpAll = [...payments.filter((p: any) => p.clientId === client.id), ...projectPayments.filter((p: any) => p.clientId === client.id)];
  const paidTotal = cpAll.filter((p: any) => p.status === "paid").reduce((s: number, p: any) => s + (Number(p.amount) || 0), 0);
  const overdueTotalC = cpAll.filter((p: any) => p.status === "overdue").reduce((s: number, p: any) => s + (Number(p.amount) || 0), 0);
  const upcomingTotal = cpAll.filter((p: any) => p.dueDate && new Date(p.dueDate) > now2 && new Date(p.dueDate) <= new Date(now2.getTime() + 30 * 864e5) && ["pending", "collection_needed"].includes(p.status)).reduce((s: number, p: any) => s + (Number(p.amount) || 0), 0);
  const paidPayments = cpAll.filter((p: any) => p.status === "paid" && (p.paidAt || p.dueDate));
  const latePays = paidPayments.filter((p: any) => p.paidAt && p.dueDate && new Date(p.paidAt) > new Date(p.dueDate)).length;
  const collectionAI: string[] = [];
  if (latePays >= 2) collectionAI.push("הלקוח נוטה לשלם באיחור — מומלץ לתזכר מראש");
  else if (paidPayments.length > 0) collectionAI.push("הלקוח משלם בזמן ✓");
  const nextDue = cpAll.filter((p: any) => p.dueDate && new Date(p.dueDate) >= now2 && ["pending", "collection_needed"].includes(p.status)).sort((a: any, b: any) => +new Date(a.dueDate) - +new Date(b.dueDate))[0];
  if (nextDue) { const days = Math.ceil((+new Date(nextDue.dueDate) - +now2) / 864e5); collectionAI.push(`תשלום קרוב בעוד ${days} ימים · ${fmt(Number(nextDue.amount) || 0)}`); }
  if (overdueTotalC > 0) collectionAI.push(`${fmt(overdueTotalC)} בפיגור — סיכון גבייה`);
  if (collectionAI.length === 0) collectionAI.push("אין סיכון גבייה כרגע");

  // AI insight cards (executive)
  const aiCards = [
    { tone: "#22c55e", icon: "✅", title: "מצב לקוח", body: healthScore.score >= 70 ? "הלקוח במצב טוב — המשך תחזוקה שוטפת." : healthScore.score >= 40 ? "מצב בינוני — שווה לחזק מעורבות." : "מצב חלש — דורש טיפול מיידי.", bg: "rgba(34,197,94,0.06)" },
    ...((funnel[0].n + funnel[1].n) < 4 ? [{ tone: "#f59e0b", icon: "⚠️", title: "חוסר תוכן", body: "מלאי התוכן נמוך לחודש הקרוב — מומלץ ליצור תוכנית.", bg: "rgba(245,158,11,0.06)" }] : []),
    ...(cmd.openApprovals > 0 ? [{ tone: "#ef4444", icon: "⏳", title: "צוואר בקבוק באישורים", body: `${cmd.openApprovals} אישורים ממתינים — תזכר את הלקוח.`, bg: "rgba(239,68,68,0.06)" }] : []),
    ...(cmd.activeCampaigns === 0 && cmd.monthlyValue > 0 ? [{ tone: "#8b5cf6", icon: "📈", title: "הזדמנות מכירה", body: "אין קמפיין פעיל — הצעה להרחבת שירות.", bg: "rgba(139,92,246,0.06)" }] : []),
    { tone: "#00B5FE", icon: "🧭", title: "הצעדים הבאים", body: (cmd.risks[0] || cmd.opps[0] || "הכל תקין — המשך כרגיל."), bg: "rgba(0,181,254,0.06)" },
  ].slice(0, 5);

  const ccCard: React.CSSProperties = { background: "var(--surface-raised)", border: "1px solid var(--border)", borderRadius: 16, padding: "1.25rem" };
  const ccTitle: React.CSSProperties = { fontSize: "0.92rem", fontWeight: 800, color: "var(--foreground)", marginBottom: 14 };
  const pColorCC = (p: number) => (p < 40 ? "#ef4444" : p < 70 ? "#f59e0b" : "#22c55e");

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem", marginBottom: "2.5rem", direction: "rtl" }}>

      {/* ═══════════ 1 · CLIENT HERO ═══════════ */}
      <div style={{ ...ccCard, padding: "1.5rem 1.7rem", display: "flex", gap: "1.4rem", alignItems: "center", flexWrap: "wrap" }}>
        <ClientLogo src={(client as any).logoUrl} name={client.name} size={84} />
        <div style={{ flex: 1, minWidth: 200 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <h1 style={{ fontSize: "1.7rem", fontWeight: 900, margin: 0, color: "var(--foreground)" }}>{client.name}</h1>
            <span style={{ color: "#3b82f6", fontSize: "1rem" }}>✔️</span>
            <span style={{ fontSize: "0.7rem", fontWeight: 800, color: statusInfo.color, background: statusInfo.color + "1a", borderRadius: 999, padding: "2px 10px" }}>{statusInfo.label}</span>
          </div>
          <div style={{ fontSize: "0.85rem", color: "var(--foreground-muted)", marginTop: 3 }}>{(client as any).businessField || CLIENT_TYPE_LABELS[(client as any).clientType]?.label || ""}</div>
          <div style={{ display: "flex", gap: 22, flexWrap: "wrap", marginTop: 16 }}>
            {[
              { l: "מנהל לקוח", v: assignedManager?.name || "—", avatar: assignedManager },
              { l: "לקוח מאז", v: sinceStr || "—" },
              { l: "שירותים פעילים", v: `${servicesCount} שירותים` },
              { l: "חיוב חודשי", v: cmd.monthlyValue > 0 ? fmt(cmd.monthlyValue) : "—" },
            ].map((c, i) => (
              <div key={i} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <span style={{ fontSize: "0.66rem", color: "var(--foreground-subtle)" }}>{c.l}</span>
                <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "0.88rem", fontWeight: 800, color: "var(--foreground)" }}>
                  {c.avatar && <Avatar src={(c.avatar as any).avatarUrl} name={(c.avatar as any).name} size={22} ring={false} />}{c.v}
                </span>
              </div>
            ))}
          </div>
        </div>
        {/* Health gauge */}
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ position: "relative", width: 96, height: 96, borderRadius: "50%", background: `conic-gradient(${healthScore.color} ${healthScore.score * 3.6}deg, var(--border) 0deg)`, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <div style={{ width: 74, height: 74, borderRadius: "50%", background: "var(--surface-raised)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
              <span style={{ fontSize: "1.5rem", fontWeight: 900, color: healthScore.color, lineHeight: 1 }}>{healthScore.score}</span>
              <span style={{ fontSize: "0.6rem", color: "var(--foreground-subtle)" }}>/100</span>
            </div>
          </div>
          <div>
            <div style={{ fontSize: "0.66rem", color: "var(--foreground-subtle)" }}>ציון בריאות</div>
            <div style={{ fontSize: "0.78rem", fontWeight: 700, color: healthScore.color }}>מצב: {healthScore.score >= 70 ? "טוב" : healthScore.score >= 40 ? "בינוני" : "דורש טיפול"}</div>
          </div>
        </div>
      </div>

      {/* ═══════════ 2 · WHATSAPP CENTER + AI CLIENT MANAGER ═══════════ */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.1rem" }} className="cc-2col">
        {/* WhatsApp Center */}
        <div style={ccCard}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <span style={ccTitle}>💬 WhatsApp Center</span>
            <span onClick={() => onNavigateTab?.("whatsapp")} style={{ fontSize: "0.74rem", fontWeight: 700, color: "#25D366", cursor: "pointer" }}>פתח WhatsApp ←</span>
          </div>
          {waState === "off" ? <div style={{ fontSize: "0.82rem", color: "var(--foreground-muted)" }}>הוואטסאפ לא מחובר.</div>
            : clientChats.length === 0 ? <div style={{ fontSize: "0.82rem", color: "var(--foreground-muted)" }}>אין שיחות עם הלקוח הזה.</div>
            : clientChats.slice(0, 4).map((c: any, i: number) => (
              <div key={i} style={{ display: "flex", gap: 10, alignItems: "center", padding: "0.55rem 0", borderBottom: "1px solid var(--border)" }}>
                <Avatar name={c.name || c.phone} size={34} ring={false} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: "0.82rem", fontWeight: 700, color: "var(--foreground)" }}>{c.name || c.phone}</div>
                  <div style={{ fontSize: "0.72rem", color: "var(--foreground-muted)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.lastMessage || ""}</div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 3 }}>
                  <span style={{ fontSize: "0.64rem", color: "var(--foreground-subtle)" }}>{waTimeSince(c.timestamp)}</span>
                  {(c.unread || 0) > 0 && <span style={{ background: "#25D366", color: "#fff", fontSize: "0.62rem", fontWeight: 800, borderRadius: 999, padding: "1px 7px" }}>{c.unread}</span>}
                </div>
              </div>
            ))}
          <div style={{ display: "flex", gap: 16, justifyContent: "space-around", marginTop: 14, paddingTop: 12, borderTop: "1px solid var(--border)" }}>
            {[{ i: "📥", l: "צפה בכל השיחות", t: "whatsapp" }, { i: "📋", l: "צור משימה", t: "tasks" }, { i: "✅", l: "תגובה מהירה", t: "whatsapp" }, { i: "✨", l: "תגובה עם AI", t: "whatsapp" }].map((a, i) => (
              <button key={i} onClick={() => onNavigateTab?.(a.t)} style={{ background: "none", border: "none", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 4, color: "var(--foreground-muted)", fontSize: "0.66rem" }}>
                <span style={{ fontSize: "1.1rem" }}>{a.i}</span>{a.l}
              </button>
            ))}
          </div>
        </div>

        {/* Pixel AI Client Manager (dark premium) */}
        <div style={{ position: "relative", overflow: "hidden", borderRadius: 16, padding: "1.4rem", background: "linear-gradient(140deg,#1e1b4b,#312e81 55%,#0c4a6e)", border: "1px solid #4338ca", color: "#fff", direction: "rtl" }}>
          <div style={{ position: "absolute", insetInlineEnd: -20, top: 10, width: 150, height: 150, borderRadius: "50%", background: "radial-gradient(circle, rgba(129,140,248,0.45), transparent 70%)" }} />
          <div style={{ position: "relative", zIndex: 1 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: "1.05rem" }}>✨</span>
                <span style={{ fontSize: "1.02rem", fontWeight: 900 }}>Pixel AI Client Manager</span>
              </div>
              <span style={{ fontSize: "0.66rem", color: "#a5b4fc" }}>AI המלצות</span>
            </div>
            <div style={{ fontSize: "0.9rem", fontWeight: 800, margin: "12px 0 8px", color: healthScore.score >= 70 ? "#86efac" : "#fcd34d" }}>
              {healthScore.score >= 70 ? "הלקוח במצב טוב" : healthScore.score >= 40 ? "הלקוח במצב בינוני" : "הלקוח דורש טיפול"}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 14 }}>
              {[
                cmd.openApprovals > 0 ? `${cmd.openApprovals} אישורים ממתינים לאישור` : "אין אישורים תקועים ✓",
                `${cmd.activeCampaigns} שירותים/קמפיינים פעילים`,
                (funnel[0].n + funnel[1].n) < 4 ? "חסר תוכן מתוכנן לחודש הבא" : "מלאי תוכן תקין לחודש הקרוב",
                ...collectionAI.slice(0, 2),
              ].slice(0, 5).map((t, i) => (
                <div key={i} style={{ display: "flex", gap: 8, alignItems: "flex-start", fontSize: "0.78rem", color: "#e0e7ff" }}>
                  <span style={{ color: "#67e8f9" }}>✓</span>{t}
                </div>
              ))}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 8 }}>
              {[{ i: "🗓️", l: "צור תוכנית תוכן", t: "content" }, { i: "📷", l: "קבע יום צילום", t: "calendar" }, { i: "🔔", l: "שלח תזכורת", t: "accounting" }, { i: "📝", l: "פתח משימה", t: "tasks" }].map((a, i) => (
                <button key={i} onClick={() => onNavigateTab?.(a.t)} style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 10, padding: "0.6rem 0.4rem", cursor: "pointer", color: "#fff", display: "flex", flexDirection: "column", alignItems: "center", gap: 5, fontSize: "0.64rem", fontWeight: 600 }}>
                  <span style={{ fontSize: "1.05rem" }}>{a.i}</span>{a.l}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ═══════════ 3 · CLIENT TIMELINE ═══════════ */}
      <div style={ccCard}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <span style={ccTitle}>🕒 ציר זמן</span>
          <span style={{ fontSize: "0.7rem", color: "var(--foreground-subtle)" }}>הימים האחרונים</span>
        </div>
        {cmd.timeline.length === 0 ? <div style={{ fontSize: "0.82rem", color: "var(--foreground-muted)" }}>אין פעילות מתועדת עדיין.</div> : (
          <div style={{ display: "flex", gap: "1rem", overflowX: "auto", paddingBottom: 6 }}>
            {cmd.timeline.map((e: any, i: number) => (
              <div key={i} style={{ minWidth: 150, textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
                <span style={{ width: 40, height: 40, borderRadius: "50%", background: "var(--surface)", border: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.1rem" }}>{e.icon}</span>
                <div style={{ fontSize: "0.74rem", fontWeight: 600, color: "var(--foreground)", lineHeight: 1.35 }}>{e.text}</div>
                <div style={{ fontSize: "0.66rem", color: "var(--foreground-subtle)" }}>{new Date(e.at).toLocaleDateString("he-IL", { day: "2-digit", month: "2-digit", year: "numeric" })}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ═══════════ 4 · MARKETING PIPELINE  +  5 · ACTIVE PROJECTS ═══════════ */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1.3fr", gap: "1.1rem" }} className="cc-2col">
        <div style={ccCard}>
          <span style={ccTitle}>🪣 משפך השיווק</span>
          <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
            <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 7 }}>
              {funnel.map((s, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ flex: 1, height: 26, borderRadius: 6, background: s.color + "55", position: "relative", overflow: "hidden", width: `${40 + (s.n / funnelMax) * 60}%`, minWidth: 60 }}>
                    <span style={{ position: "absolute", insetInlineStart: 8, top: "50%", transform: "translateY(-50%)", fontSize: "0.7rem", color: "#334155" }}>{s.label}</span>
                  </div>
                  <span style={{ fontSize: "0.85rem", fontWeight: 900, color: "var(--foreground)", minWidth: 22, textAlign: "left" }}>{s.n}</span>
                </div>
              ))}
            </div>
            {monthlyGoal > 0 && (
              <div style={{ textAlign: "center" }}>
                <div style={{ position: "relative", width: 72, height: 72, borderRadius: "50%", background: `conic-gradient(var(--accent) ${Math.min(100, (publishedCount / monthlyGoal) * 100) * 3.6}deg, var(--border) 0deg)`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <div style={{ width: 56, height: 56, borderRadius: "50%", background: "var(--surface-raised)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.85rem", fontWeight: 900, color: "var(--accent)" }}>{Math.round((publishedCount / monthlyGoal) * 100)}%</div>
                </div>
                <div style={{ fontSize: "0.64rem", color: "var(--foreground-subtle)", marginTop: 4 }}>יעד חודשי</div>
                <div style={{ fontSize: "0.72rem", fontWeight: 800 }}>{monthlyGoal} / {publishedCount}</div>
              </div>
            )}
          </div>
        </div>

        <div style={ccCard}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <span style={ccTitle}>📁 פרויקטים פעילים</span>
            <span onClick={() => onNavigateTab?.("campaigns")} style={{ fontSize: "0.74rem", fontWeight: 700, color: "var(--accent)", cursor: "pointer" }}>צפה בכל הפרויקטים ←</span>
          </div>
          {clientProjects.length === 0 ? <div style={{ fontSize: "0.82rem", color: "var(--foreground-muted)" }}>אין פרויקטים פעילים.</div> :
            clientProjects.map((p: any) => (
              <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "0.55rem 0", borderBottom: "1px solid var(--border)" }}>
                <span style={{ fontSize: "0.82rem", fontWeight: 800, color: pColorCC(p.pct), minWidth: 38 }}>{p.pct}%</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: "0.8rem", fontWeight: 700, color: "var(--foreground)" }}>{p.name}</div>
                  <div style={{ height: 6, background: "var(--surface)", borderRadius: 999, overflow: "hidden", marginTop: 4 }}><div style={{ width: `${p.pct}%`, height: "100%", background: pColorCC(p.pct), borderRadius: 999 }} /></div>
                </div>
                {p.mgr && <Avatar src={(p.mgr as any).avatarUrl} name={(p.mgr as any).name} size={26} ring={false} />}
                <span style={{ fontSize: "0.66rem", color: p.pct < 40 ? "#ef4444" : "var(--foreground-muted)", minWidth: 64, textAlign: "left" }}>{p.deadline ? new Date(p.deadline).toLocaleDateString("he-IL", { day: "2-digit", month: "2-digit", year: "2-digit" }) : ""}{p.pct < 40 ? " · בסיכון" : ""}</span>
              </div>
            ))}
        </div>
      </div>

      {/* ═══════════ 6 · TASK COMMAND CENTER ═══════════ */}
      <div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <span style={ccTitle}>✅ משימות</span>
          <span onClick={() => onNavigateTab?.("tasks")} style={{ fontSize: "0.74rem", fontWeight: 700, color: "var(--accent)", cursor: "pointer" }}>צפה בכל המשימות ←</span>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: "0.9rem" }} className="cc-4col">
          {taskCols.map((col, ci) => (
            <div key={ci} style={{ ...ccCard, padding: "1rem", borderTop: `3px solid ${col.color}` }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <span style={{ fontSize: "0.8rem", fontWeight: 800, color: "var(--foreground)" }}>{col.label}</span>
                <span style={{ fontSize: "0.66rem", fontWeight: 800, color: col.color, background: col.color + "1a", borderRadius: 999, padding: "2px 8px" }}>{col.items.length}</span>
              </div>
              {col.items.length === 0 ? <div style={{ fontSize: "0.72rem", color: "var(--foreground-subtle)" }}>—</div> :
                col.items.slice(0, 4).map((t: any, i: number) => {
                  const emp = empById((t.assigneeIds || [])[0]);
                  return (
                    <div key={i} style={{ display: "flex", gap: 8, alignItems: "center", padding: "0.4rem 0", borderBottom: "1px solid var(--border)" }}>
                      {emp ? <Avatar src={(emp as any).avatarUrl} name={emp.name} size={22} ring={false} /> : <span style={{ width: 22, height: 22, borderRadius: "50%", background: "var(--surface)", display: "inline-block" }} />}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: "0.74rem", fontWeight: 600, color: "var(--foreground)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{t.title}</div>
                        {t.dueDate && <div style={{ fontSize: "0.62rem", color: "var(--foreground-subtle)" }}>{new Date(t.dueDate).toLocaleDateString("he-IL", { day: "2-digit", month: "2-digit" })}</div>}
                      </div>
                    </div>
                  );
                })}
              <button onClick={() => onNavigateTab?.("tasks")} style={{ marginTop: 8, width: "100%", background: "none", border: "1px dashed var(--border)", borderRadius: 8, padding: "0.4rem", fontSize: "0.7rem", color: "var(--foreground-muted)", cursor: "pointer" }}>+ משימה חדשה</button>
            </div>
          ))}
        </div>
      </div>

      {/* ═══════════ 7 · CLIENT OPERATIONS (team) ═══════════ */}
      <div style={ccCard}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <span style={ccTitle}>👥 צוות העובד על הלקוח</span>
          <span onClick={() => onNavigateTab?.("tasks")} style={{ fontSize: "0.74rem", fontWeight: 700, color: "var(--accent)", cursor: "pointer" }}>צפה בכל הצוות ←</span>
        </div>
        {teamOps.length === 0 ? <div style={{ fontSize: "0.82rem", color: "var(--foreground-muted)" }}>אין צוות משובץ למשימות פתוחות.</div> :
          teamOps.map((e: any) => (
            <div key={e.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "0.6rem 0", borderBottom: "1px solid var(--border)" }}>
              <Avatar src={e.avatarUrl} name={e.name} size={38} ring={false} />
              <div style={{ minWidth: 130 }}>
                <div style={{ fontSize: "0.84rem", fontWeight: 700, color: "var(--foreground)" }}>{e.name}</div>
                <div style={{ fontSize: "0.68rem", color: "var(--foreground-muted)" }}>{e.role || "צוות"}</div>
              </div>
              <div style={{ flex: 1, maxWidth: 200 }}>
                <div style={{ fontSize: "0.66rem", color: "var(--foreground-subtle)", marginBottom: 3 }}>עומס עבודה</div>
                <div style={{ height: 6, background: "var(--surface)", borderRadius: 999, overflow: "hidden" }}><div style={{ width: `${Math.min(100, e.open * 15)}%`, height: "100%", background: e.open >= 6 ? "#ef4444" : "var(--accent)", borderRadius: 999 }} /></div>
              </div>
              <span style={{ fontSize: "0.74rem", color: "var(--foreground-muted)" }}>{e.open} משימות פעילות</span>
            </div>
          ))}
      </div>

      {/* ═══════════ 8 · FINANCE CENTER ═══════════ */}
      <div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <span style={ccTitle}>💰 מרכז פיננסי</span>
          <span onClick={() => onNavigateTab?.("accounting")} style={{ fontSize: "0.74rem", fontWeight: 700, color: "#22c55e", cursor: "pointer" }}>צפה בכל החשבונות ←</span>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "1.1rem" }} className="cc-2col">
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(120px,1fr))", gap: "0.7rem" }}>
            {[
              { l: "חיוב חודשי", v: cmd.monthlyValue > 0 ? fmt(cmd.monthlyValue) : "—", c: "#22c55e", sub: "קבוע" },
              { l: "סה\"כ הכנסות", v: fmt(paidTotal), c: "var(--foreground)", sub: "שולם" },
              { l: "גבייה פתוחה", v: fmt(cmd.openCollections), c: "#f59e0b", sub: "ממתין" },
              { l: "חובות פתוחים", v: fmt(overdueTotalC), c: overdueTotalC > 0 ? "#ef4444" : "var(--foreground)", sub: "בפיגור" },
              { l: "גבייה צפויה", v: fmt(upcomingTotal), c: "#3b82f6", sub: "30 יום" },
              { l: "ציון גבייה", v: `${Math.max(0, 100 - latePays * 20 - (overdueTotalC > 0 ? 20 : 0))}/100`, c: "#22c55e", sub: latePays >= 2 ? "בינוני" : "טוב" },
            ].map((k, i) => (
              <div key={i} style={{ ...ccCard, padding: "0.9rem" }}>
                <div style={{ fontSize: "0.7rem", color: "var(--foreground-muted)" }}>{k.l}</div>
                <div style={{ fontSize: "1.15rem", fontWeight: 900, color: k.c, lineHeight: 1.2 }}>{k.v}</div>
                <div style={{ fontSize: "0.62rem", color: "var(--foreground-subtle)" }}>{k.sub}</div>
              </div>
            ))}
          </div>
          <div style={{ ...ccCard, background: "rgba(139,92,246,0.06)", border: "1px solid #ddd6fe" }}>
            <div style={{ fontSize: "0.82rem", fontWeight: 800, color: "#7c3aed", marginBottom: 10 }}>🤖 תובנות גבייה AI</div>
            {collectionAI.map((t, i) => (
              <div key={i} style={{ display: "flex", gap: 7, alignItems: "flex-start", fontSize: "0.76rem", color: "#4c1d95", marginBottom: 7 }}>
                <span style={{ color: "#7c3aed" }}>✓</span>{t}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ═══════════ 9 · AI INSIGHTS ═══════════ */}
      <div>
        <div style={ccTitle}>🧠 תובנות AI ופעולות מומלצות</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: "0.85rem" }}>
          {aiCards.map((c, i) => (
            <div key={i} style={{ ...ccCard, background: c.bg, borderInlineStart: `4px solid ${c.tone}` }}>
              <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 6 }}>
                <span style={{ fontSize: "1rem" }}>{c.icon}</span>
                <span style={{ fontSize: "0.8rem", fontWeight: 800, color: c.tone }}>{c.title}</span>
              </div>
              <div style={{ fontSize: "0.76rem", color: "var(--foreground)", lineHeight: 1.5 }}>{c.body}</div>
            </div>
          ))}
        </div>
      </div>

      <style>{`@media (max-width:1000px){.cc-2col,.cc-4col{grid-template-columns:1fr 1fr !important}}@media (max-width:680px){.cc-2col,.cc-4col{grid-template-columns:1fr !important}}`}</style>
    </div>
  );
}
