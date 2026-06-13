"use client";

import { useState, useMemo, useEffect } from "react";
import type { Client, Employee } from "@/lib/db/schema";
import Avatar from "@/components/ui/avatar";
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

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem", marginBottom: "2rem" }}>
      {/* ═══ COMMAND-CENTER KPI STRIP ═══ */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: "0.85rem" }}>
        {[
          { icon: "❤️", label: "בריאות לקוח", val: `${healthScore.score}/100`, color: healthScore.color },
          { icon: "💰", label: "ערך חודשי", val: cmd.monthlyValue > 0 ? fmt(cmd.monthlyValue) : "—", color: "#10b981" },
          { icon: "✅", label: "משימות פתוחות", val: cmd.openTasks, color: "#3b82f6", onClick: () => onNavigateTab?.("tasks") },
          { icon: "🔍", label: "בבדיקה", val: cmd.reviewTasks, color: "#00B5FE", onClick: () => onNavigateTab?.("tasks") },
          { icon: "🧾", label: "גבייה פתוחה", val: cmd.openCollections > 0 ? fmt(cmd.openCollections) : "—", color: "#f59e0b", onClick: () => onNavigateTab?.("accounting") },
          { icon: "📅", label: "פגישות החודש", val: cmd.meetingsThisMonth, color: "#06b6d4", onClick: () => onNavigateTab?.("activity") },
          { icon: "✋", label: "אישורים פתוחים", val: cmd.openApprovals, color: "#ef4444", onClick: () => onNavigateTab?.("activity") },
          { icon: "💬", label: "וואטסאפ", val: clientChats.reduce((s: number, c: any) => s + (c.unread || 0), 0), color: "#25D366", onClick: () => onNavigateTab?.("portal") },
        ].map((k, i) => (
          <div key={i} onClick={k.onClick} style={{ background: "var(--surface-raised)", border: "1px solid var(--border)", borderRadius: "0.75rem", padding: "0.9rem 1rem", borderTop: `3px solid ${k.color}`, cursor: k.onClick ? "pointer" : "default" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: "1.1rem" }}>{k.icon}</span>
              <span style={{ fontSize: "1.35rem", fontWeight: 900, color: k.color, lineHeight: 1 }}>{k.val}</span>
            </div>
            <div style={{ fontSize: "0.74rem", color: "var(--foreground-muted)", marginTop: 4 }}>{k.label}</div>
          </div>
        ))}
      </div>

      {/* ═══ AI ACCOUNT MANAGER ═══ */}
      <div style={{ borderRadius: 16, padding: "1.2rem 1.4rem", background: "linear-gradient(135deg,#eef2ff,#ecfeff)", border: "1px solid #c7d2fe" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
          <span style={{ fontSize: "1.05rem", fontWeight: 900, background: "linear-gradient(90deg,#6366f1,#06b6d4)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>🤖 מנהל לקוח AI</span>
          <span style={{ fontSize: "0.7rem", fontWeight: 700, color: statusInfo.color, background: `${statusInfo.color}15`, borderRadius: 999, padding: "2px 9px" }}>{statusInfo.label}</span>
        </div>
        <div style={{ fontSize: "0.86rem", color: "#334155", lineHeight: 1.6, marginBottom: 12 }}>
          {`${client.name} — ציון בריאות ${healthScore.score}/100. `}
          {cmd.risks.length ? `נדרש טיפול: ${cmd.risks.slice(0, 2).join(", ")}. ` : "אין סיכונים פתוחים. "}
          {cmd.opps.length ? `הזדמנות: ${cmd.opps[0]}.` : ""}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }} className="ovw-2col">
          <div>
            <div style={{ fontSize: "0.72rem", fontWeight: 800, color: "#ef4444", marginBottom: 6 }}>⚠️ סיכונים</div>
            {cmd.risks.length === 0 ? <div style={{ fontSize: "0.78rem", color: "var(--foreground-subtle)" }}>אין סיכונים מזוהים 🎉</div> :
              cmd.risks.map((r, i) => <div key={i} style={{ fontSize: "0.8rem", color: "#334155", marginBottom: 3 }}>• {r}</div>)}
          </div>
          <div>
            <div style={{ fontSize: "0.72rem", fontWeight: 800, color: "#16a34a", marginBottom: 6 }}>💡 הזדמנויות</div>
            {cmd.opps.length === 0 ? <div style={{ fontSize: "0.78rem", color: "var(--foreground-subtle)" }}>—</div> :
              cmd.opps.map((o, i) => <div key={i} style={{ fontSize: "0.8rem", color: "#334155", marginBottom: 3 }}>• {o}</div>)}
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
          <button onClick={() => onNavigateTab?.("tasks")} style={{ background: "#fff", border: "1px solid #c7d2fe", color: "#4f46e5", borderRadius: 999, padding: "0.4rem 0.85rem", fontSize: "0.76rem", fontWeight: 700, cursor: "pointer" }}>פתח משימות</button>
          <button onClick={() => onNavigateTab?.("accounting")} style={{ background: "#fff", border: "1px solid #c7d2fe", color: "#4f46e5", borderRadius: 999, padding: "0.4rem 0.85rem", fontSize: "0.76rem", fontWeight: 700, cursor: "pointer" }}>גבייה</button>
          <button onClick={() => onNavigateTab?.("content")} style={{ background: "#fff", border: "1px solid #c7d2fe", color: "#4f46e5", borderRadius: 999, padding: "0.4rem 0.85rem", fontSize: "0.76rem", fontWeight: 700, cursor: "pointer" }}>לוח תוכן</button>
        </div>
      </div>

      {/* ═══ WHATSAPP CENTER + CLIENT TIMELINE ═══ */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.5rem" }} className="ovw-2col">
        <div style={{ background: "var(--surface-raised)", border: "1px solid var(--border)", borderRadius: "0.75rem", padding: "1.25rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <span style={{ fontSize: "0.9rem", fontWeight: 700, color: "var(--foreground)" }}>💬 מרכז וואטסאפ</span>
            <a href="/whatsapp-inbox" style={{ fontSize: "0.74rem", fontWeight: 700, color: "var(--accent)", textDecoration: "none" }}>פתח תיבה ←</a>
          </div>
          {waState === "off" ? <div style={{ fontSize: "0.82rem", color: "var(--foreground-muted)" }}>הוואטסאפ לא מחובר.</div>
            : !(client as any).phone ? <div style={{ fontSize: "0.82rem", color: "var(--foreground-muted)" }}>לא הוגדר מספר טלפון ללקוח.</div>
            : clientChats.length === 0 ? <div style={{ fontSize: "0.82rem", color: "var(--foreground-muted)" }}>אין שיחות עם לקוח זה עדיין.</div>
            : clientChats.slice(0, 5).map((c: any, i: number) => (
              <a key={i} href="/whatsapp-inbox" style={{ display: "flex", gap: 10, alignItems: "center", padding: "0.5rem 0", textDecoration: "none", borderBottom: "1px solid var(--border)" }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                    <span style={{ fontSize: "0.82rem", fontWeight: 700, color: "var(--foreground)" }}>{c.name || c.phone}</span>
                    <span style={{ fontSize: "0.66rem", color: "var(--foreground-subtle)" }}>{waTimeSince(c.timestamp)}</span>
                  </div>
                  <div style={{ fontSize: "0.72rem", color: "var(--foreground-muted)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.lastMessage || ""}</div>
                </div>
                {c.unread > 0 && <span style={{ background: "#25D366", color: "#fff", fontSize: "0.64rem", fontWeight: 800, borderRadius: 999, padding: "1px 7px" }}>{c.unread}</span>}
              </a>
            ))}
        </div>
        <div style={{ background: "var(--surface-raised)", border: "1px solid var(--border)", borderRadius: "0.75rem", padding: "1.25rem" }}>
          <div style={{ fontSize: "0.9rem", fontWeight: 700, color: "var(--foreground)", marginBottom: 12 }}>🕒 ציר זמן לקוח</div>
          {cmd.timeline.length === 0 ? <div style={{ fontSize: "0.82rem", color: "var(--foreground-muted)" }}>אין פעילות מתועדת עדיין.</div> :
            cmd.timeline.map((e: any, i: number) => (
              <div key={i} style={{ display: "flex", gap: 9, alignItems: "flex-start", padding: "0.4rem 0", borderBottom: "1px solid var(--border)" }}>
                <span style={{ fontSize: "0.95rem" }}>{e.icon}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: "0.8rem", color: "var(--foreground)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{e.text}</div>
                  <div style={{ fontSize: "0.66rem", color: "var(--foreground-subtle)" }}>{new Date(e.at).toLocaleDateString("he-IL", { day: "2-digit", month: "2-digit", year: "2-digit" })}</div>
                </div>
              </div>
            ))}
        </div>
      </div>

      {/* Health Score + Snapshot Row */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.5rem" }}>
        {/* Health Score Card */}
        <div
          className="agd-card"
          style={{
            background: "var(--surface-raised)",
            border: `2px solid ${healthScore.color}30`,
            borderRadius: "0.75rem",
            padding: "1.5rem",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
            <h3 style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--foreground-muted)", margin: 0 }}>
              בריאות לקוח
            </h3>
            <div style={{
              padding: "0.25rem 0.75rem",
              borderRadius: "1rem",
              fontSize: "0.75rem",
              fontWeight: 600,
              background: `${statusInfo.color}15`,
              color: statusInfo.color,
              border: `1px solid ${statusInfo.color}30`,
            }}>
              {statusInfo.label}
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "1.25rem" }}>
            <div style={{
              width: 64,
              height: 64,
              borderRadius: "50%",
              background: `conic-gradient(${healthScore.color} ${healthScore.score * 3.6}deg, var(--border) 0deg)`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              position: "relative",
            }}>
              <div style={{
                width: 52,
                height: 52,
                borderRadius: "50%",
                background: "var(--surface-raised)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontWeight: 700,
                fontSize: "1.1rem",
                color: healthScore.color,
              }}>
                {healthScore.score}
              </div>
            </div>
            <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "0.35rem" }}>
              {healthScore.factors.slice(0, 3).map((factor, i) => (
                <div key={i} style={{ fontSize: "0.8rem", color: "var(--foreground-muted)", display: "flex", alignItems: "center", gap: "0.35rem" }}>
                  <span style={{ color: healthScore.color }}>•</span> {factor}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Client Snapshot Card */}
        <div
          className="agd-card"
          style={{
            background: "var(--surface-raised)",
            border: "1px solid var(--border)",
            borderRadius: "0.75rem",
            padding: "1.5rem",
          }}
        >
          <h3 style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--foreground-muted)", margin: "0 0 1rem 0" }}>
            תמונת מצב
          </h3>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
            {[
              { label: "קמפיינים פעילים", value: snapshot.activeCampaigns, color: "#00B5FE", tab: "campaigns" },
              { label: "לידים פתוחים", value: snapshot.openLeads, color: "#a78bfa", tab: "leads" },
              { label: "משימות בטיפול", value: snapshot.pendingTasks, color: "#f59e0b", tab: "tasks" },
              { label: "תוכן קרוב", value: snapshot.upcomingContent, color: "#22c55e", tab: "content" },
            ].map((item) => (
              <button
                key={item.label}
                onClick={() => onNavigateTab?.(item.tab)}
                style={{
                  background: `${item.color}08`,
                  border: `1px solid ${item.color}20`,
                  borderRadius: "0.5rem",
                  padding: "0.75rem",
                  cursor: "pointer",
                  textAlign: "right",
                  transition: "all 150ms",
                }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = `${item.color}50`; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = `${item.color}20`; }}
              >
                <div style={{ fontSize: "1.25rem", fontWeight: 700, color: item.color }}>{item.value}</div>
                <div style={{ fontSize: "0.75rem", color: "var(--foreground-muted)" }}>{item.label}</div>
              </button>
            ))}
          </div>
          {snapshot.totalPosts > 0 && (
            <div style={{ marginTop: "0.75rem", fontSize: "0.8rem", color: "var(--foreground-muted)", textAlign: "center", borderTop: "1px solid var(--border)", paddingTop: "0.5rem" }}>
              סה״כ {snapshot.totalPosts} פוסטים פורסמו
            </div>
          )}
        </div>
      </div>

      {/* Main Overview Grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "1.5rem",
        }}
      >
      {/* Left Column */}
      <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
        {/* Identity Card */}
        <div
          className="agd-card"
          style={{
            background: "var(--surface-raised)",
            border: "1px solid var(--border)",
            borderRadius: "0.75rem",
            padding: "1.5rem",
          }}
        >
          <h3 style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--foreground-muted)", margin: "0 0 1rem 0" }}>
            קובץ זהות
          </h3>

          <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginBottom: "1.5rem" }}>
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: client.logoUrl ? "0.5rem" : "50%",
                background: client.logoUrl ? "transparent" : `${color}20`,
                border: client.logoUrl ? "none" : `2px solid ${color}40`,
                color,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontWeight: 700,
                fontSize: "0.9rem",
                flexShrink: 0,
                backgroundImage: client.logoUrl ? `url(${client.logoUrl})` : undefined,
                backgroundSize: "cover",
                backgroundPosition: "center",
              }}
            >
              {!client.logoUrl && initials(client.name)}
            </div>
            <div>
              <div style={{ fontWeight: 600, fontSize: "0.95rem", color: "var(--foreground)" }}>
                {client.name}
              </div>
              {client.company && (
                <div style={{ fontSize: "0.8rem", color: "var(--foreground-muted)" }}>
                  {client.company}
                </div>
              )}
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", borderTop: "1px solid var(--border)", paddingTop: "1rem" }}>
            {client.clientType && (
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.85rem" }}>
                <span style={{ color: "var(--foreground-muted)" }}>סוג:</span>
                <span style={{ fontWeight: 500, color: "var(--foreground)" }}>
                  {CLIENT_TYPE_LABELS[client.clientType]?.label}
                </span>
              </div>
            )}
            {client.businessField && (
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.85rem" }}>
                <span style={{ color: "var(--foreground-muted)" }}>תחום:</span>
                <span style={{ fontWeight: 500, color: "var(--foreground)" }}>
                  {client.businessField}
                </span>
              </div>
            )}
            {client.status && (
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.85rem" }}>
                <span style={{ color: "var(--foreground-muted)" }}>סטטוס:</span>
                <span style={{ fontWeight: 500, color: STATUS_LABELS[client.status]?.color }}>
                  {STATUS_LABELS[client.status]?.label}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Business Summary */}
        {(client.marketingGoals || client.keyMarketingMessages) && (
          <div
            className="agd-card"
            style={{
              background: "var(--surface-raised)",
              border: "1px solid var(--border)",
              borderRadius: "0.75rem",
              padding: "1.5rem",
            }}
          >
            <h3 style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--foreground-muted)", margin: "0 0 1rem 0" }}>
              סיכום עסקי
            </h3>

            {client.marketingGoals && (
              <div style={{ marginBottom: "1rem" }}>
                <div style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--foreground-muted)", marginBottom: "0.5rem" }}>
                  יעדי מרקטינג
                </div>
                <div style={{ fontSize: "0.85rem", color: "var(--foreground)", lineHeight: "1.5" }}>
                  {client.marketingGoals}
                </div>
              </div>
            )}

            {client.keyMarketingMessages && (
              <div style={{ borderTop: client.marketingGoals ? "1px solid var(--border)" : "none", paddingTop: client.marketingGoals ? "1rem" : 0 }}>
                <div style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--foreground-muted)", marginBottom: "0.5rem" }}>
                  מסרים מרקטינגיים עיקריים
                </div>
                <div style={{ fontSize: "0.85rem", color: "var(--foreground)", lineHeight: "1.5" }}>
                  {client.keyMarketingMessages}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Assigned Responsible Employee */}
        <div
          className="agd-card"
          style={{
            background: "var(--surface-raised)",
            border: "1px solid var(--border)",
            borderRadius: "0.75rem",
            padding: "1.5rem",
            position: "relative",
          }}
        >
          <h3 style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--foreground-muted)", margin: "0 0 1rem 0" }}>
            עובד אחראי
          </h3>

          {assignedManager ? (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.75rem" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                <Avatar src={(assignedManager as any).avatarUrl} name={assignedManager.name} size={40} ring={false} />
                <div>
                  <div style={{ fontWeight: 600, fontSize: "0.9rem", color: "var(--foreground)" }}>
                    {assignedManager.name}
                  </div>
                  {assignedManager.email && (
                    <div style={{ fontSize: "0.75rem", color: "var(--foreground-muted)" }}>
                      {assignedManager.email}
                    </div>
                  )}
                </div>
              </div>
              {onUpdateClient && (
                <button
                  onClick={() => setIsAssigneeDropdownOpen(!isAssigneeDropdownOpen)}
                  style={{
                    padding: "0.4rem 0.75rem",
                    background: "var(--surface)",
                    border: "1px solid var(--border)",
                    borderRadius: "0.375rem",
                    fontSize: "0.75rem",
                    fontWeight: 500,
                    color: "var(--foreground)",
                    cursor: "pointer",
                    transition: "all 150ms",
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLElement).style.background = "var(--accent)";
                    (e.currentTarget as HTMLElement).style.color = "white";
                    (e.currentTarget as HTMLElement).style.borderColor = "var(--accent)";
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLElement).style.background = "var(--surface)";
                    (e.currentTarget as HTMLElement).style.color = "var(--foreground)";
                    (e.currentTarget as HTMLElement).style.borderColor = "var(--border)";
                  }}
                >
                  שנה עובד
                </button>
              )}
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              <div style={{
                padding: "0.75rem",
                background: "#f59e0b15",
                border: "1px solid #f59e0b30",
                borderRadius: "0.5rem",
                color: "#f59e0b",
                fontSize: "0.8rem",
                fontWeight: 500,
              }}>
                ⚠️ לא הוקצה עובד אחראי
              </div>
              {onUpdateClient && (
                <button
                  onClick={() => setIsAssigneeDropdownOpen(!isAssigneeDropdownOpen)}
                  className="mod-btn-primary"
                  style={{
                    fontSize: "0.8rem",
                    padding: "0.6rem 0.75rem",
                    width: "100%",
                  }}
                >
                  הקצה עובד
                </button>
              )}
            </div>
          )}

          {/* Assignee Dropdown */}
          {isAssigneeDropdownOpen && onUpdateClient && (
            <div
              style={{
                position: "absolute",
                top: "100%",
                right: 0,
                background: "var(--surface-raised)",
                border: "1px solid var(--border)",
                borderRadius: "0.5rem",
                marginTop: "0.5rem",
                minWidth: "200px",
                zIndex: 10,
                boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
              }}
            >
              {employees.length > 0 ? (
                employees.filter(e => TEAM_MEMBERS.includes(e.name)).map((emp) => (
                  <button
                    key={emp.id}
                    onClick={() => handleAssignEmployee(emp.id)}
                    disabled={isUpdating}
                    style={{
                      display: "block",
                      width: "100%",
                      padding: "0.75rem 1rem",
                      background: "transparent",
                      border: "none",
                      borderBottom: "1px solid var(--border)",
                      textAlign: "right",
                      cursor: isUpdating ? "not-allowed" : "pointer",
                      color: "var(--foreground)",
                      fontSize: "0.85rem",
                      transition: "background 150ms",
                    }}
                    onMouseEnter={(e) => {
                      if (!isUpdating) {
                        (e.currentTarget as HTMLElement).style.background = "var(--accent-muted)";
                      }
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLElement).style.background = "transparent";
                    }}
                  >
                    {emp.name}
                  </button>
                ))
              ) : (
                <div style={{ padding: "0.75rem 1rem", color: "var(--foreground-muted)", fontSize: "0.8rem" }}>
                  אין עובדים זמינים
                </div>
              )}
            </div>
          )}
        </div>

        {/* External Links Section */}
        <div
          className="agd-card"
          style={{
            background: "var(--surface-raised)",
            border: "1px solid var(--border)",
            borderRadius: "0.75rem",
            padding: "1.5rem",
          }}
        >
          <h3 style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--foreground-muted)", margin: "0 0 1rem 0" }}>
            קישורים חיצוניים
          </h3>

          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            {client.websiteUrl && (
              <a
                href={client.websiteUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.75rem",
                  padding: "0.75rem 1rem",
                  background: "var(--surface)",
                  border: "1px solid #00B5FE30",
                  borderRadius: "0.5rem",
                  textDecoration: "none",
                  color: "var(--foreground)",
                  transition: "all 150ms",
                  cursor: "pointer",
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.background = "#00B5FE10";
                  (e.currentTarget as HTMLElement).style.borderColor = "#00B5FE50";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.background = "var(--surface)";
                  (e.currentTarget as HTMLElement).style.borderColor = "#00B5FE30";
                }}
              >
                <span style={{ fontSize: "1.25rem" }}>🌐</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: "0.85rem", fontWeight: 500, color: "var(--foreground)" }}>אתר</div>
                  <div style={{ fontSize: "0.75rem", color: "var(--foreground-muted)", wordBreak: "break-all" }}>
                    {client.websiteUrl}
                  </div>
                </div>
                <span style={{ fontSize: "1rem", opacity: 0.6 }}>↗</span>
              </a>
            )}

            {client.facebookPageUrl && (
              <a
                href={client.facebookPageUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.75rem",
                  padding: "0.75rem 1rem",
                  background: "var(--surface)",
                  border: "1px solid #1877F230",
                  borderRadius: "0.5rem",
                  textDecoration: "none",
                  color: "var(--foreground)",
                  transition: "all 150ms",
                  cursor: "pointer",
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.background = "#1877F210";
                  (e.currentTarget as HTMLElement).style.borderColor = "#1877F250";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.background = "var(--surface)";
                  (e.currentTarget as HTMLElement).style.borderColor = "#1877F230";
                }}
              >
                <span style={{ fontSize: "1.25rem" }}>📘</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: "0.85rem", fontWeight: 500, color: "var(--foreground)" }}>Facebook</div>
                  <div style={{ fontSize: "0.75rem", color: "var(--foreground-muted)", wordBreak: "break-all" }}>
                    {client.facebookPageUrl}
                  </div>
                </div>
                <span style={{ fontSize: "1rem", opacity: 0.6 }}>↗</span>
              </a>
            )}

            {client.instagramProfileUrl && (
              <a
                href={client.instagramProfileUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.75rem",
                  padding: "0.75rem 1rem",
                  background: "var(--surface)",
                  border: "1px solid #E4405F30",
                  borderRadius: "0.5rem",
                  textDecoration: "none",
                  color: "var(--foreground)",
                  transition: "all 150ms",
                  cursor: "pointer",
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.background = "#E4405F10";
                  (e.currentTarget as HTMLElement).style.borderColor = "#E4405F50";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.background = "var(--surface)";
                  (e.currentTarget as HTMLElement).style.borderColor = "#E4405F30";
                }}
              >
                <span style={{ fontSize: "1.25rem" }}>📷</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: "0.85rem", fontWeight: 500, color: "var(--foreground)" }}>Instagram</div>
                  <div style={{ fontSize: "0.75rem", color: "var(--foreground-muted)", wordBreak: "break-all" }}>
                    {client.instagramProfileUrl}
                  </div>
                </div>
                <span style={{ fontSize: "1rem", opacity: 0.6 }}>↗</span>
              </a>
            )}

            {client.tiktokProfileUrl && (
              <a
                href={client.tiktokProfileUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.75rem",
                  padding: "0.75rem 1rem",
                  background: "var(--surface)",
                  border: "1px solid #69C9D030",
                  borderRadius: "0.5rem",
                  textDecoration: "none",
                  color: "var(--foreground)",
                  transition: "all 150ms",
                  cursor: "pointer",
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.background = "#69C9D010";
                  (e.currentTarget as HTMLElement).style.borderColor = "#69C9D050";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.background = "var(--surface)";
                  (e.currentTarget as HTMLElement).style.borderColor = "#69C9D030";
                }}
              >
                <span style={{ fontSize: "1.25rem" }}>🎵</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: "0.85rem", fontWeight: 500, color: "var(--foreground)" }}>TikTok</div>
                  <div style={{ fontSize: "0.75rem", color: "var(--foreground-muted)", wordBreak: "break-all" }}>
                    {client.tiktokProfileUrl}
                  </div>
                </div>
                <span style={{ fontSize: "1rem", opacity: 0.6 }}>↗</span>
              </a>
            )}

            {!client.websiteUrl && !client.facebookPageUrl && !client.instagramProfileUrl && !client.tiktokProfileUrl && (
              <div style={{ fontSize: "0.85rem", color: "var(--foreground-muted)", textAlign: "center", padding: "1rem" }}>
                אין קישורים חיצוניים מוגדרים
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Right Column */}
      <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
        {/* Financial Summary */}
        <div
          className="agd-card"
          style={{
            background: "var(--surface-raised)",
            border: "1px solid var(--border)",
            borderRadius: "0.75rem",
            padding: "1.5rem",
          }}
        >
          <h3 style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--foreground-muted)", margin: "0 0 1rem 0" }}>
            סיכום כספי
          </h3>

          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            {client.retainerAmount > 0 && (
              <div>
                <div style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--foreground-muted)", marginBottom: "0.35rem" }}>
                  ריטיינר (לפני מע״מ)
                </div>
                <div style={{ fontSize: "1.25rem", fontWeight: 700, color: "var(--foreground)" }}>
                  ₪{client.retainerAmount.toLocaleString()}
                </div>
                <div style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--foreground-muted)", marginTop: "0.5rem", marginBottom: "0.2rem" }}>
                  כולל מע״מ (18%)
                </div>
                <div style={{ fontSize: "1.1rem", fontWeight: 700, color: "var(--foreground)" }}>
                  ₪{Math.round(client.retainerAmount * 1.18).toLocaleString()}
                </div>
                {client.retainerDay > 0 && (
                  <div style={{ fontSize: "0.75rem", color: "var(--foreground-muted)", marginTop: "0.25rem" }}>
                    תאריך תשלום: ה-{client.retainerDay} בחודש
                  </div>
                )}
              </div>
            )}

            {client.nextPaymentDate && (
              <div style={{ borderTop: "1px solid var(--border)", paddingTop: "1rem" }}>
                <div style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--foreground-muted)", marginBottom: "0.35rem" }}>
                  התשלום הבא
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  <div
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: "50%",
                      background: PAYMENT_STATUS_COLORS[client.paymentStatus] || PAYMENT_STATUS_COLORS.none,
                    }}
                  />
                  <div style={{ fontSize: "0.9rem", fontWeight: 500, color: "var(--foreground)" }}>
                    {formatDate(client.nextPaymentDate)}
                  </div>
                </div>
                <div
                  style={{
                    fontSize: "0.7rem",
                    fontWeight: 600,
                    padding: "0.25rem 0.5rem",
                    borderRadius: 4,
                    background: `${PAYMENT_STATUS_COLORS[client.paymentStatus] || PAYMENT_STATUS_COLORS.none}15`,
                    color: PAYMENT_STATUS_COLORS[client.paymentStatus] || PAYMENT_STATUS_COLORS.none,
                    border: `1px solid ${PAYMENT_STATUS_COLORS[client.paymentStatus] || PAYMENT_STATUS_COLORS.none}30`,
                    display: "inline-block",
                    marginTop: "0.35rem",
                  }}
                >
                  {client.paymentStatus === "current"
                    ? "עדכני"
                    : client.paymentStatus === "overdue"
                      ? "חריג"
                      : client.paymentStatus === "pending"
                        ? "ממתין"
                        : "לא חל"}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Planning Summary */}
        <div
          className="agd-card"
          style={{
            background: "var(--surface-raised)",
            border: "1px solid var(--border)",
            borderRadius: "0.75rem",
            padding: "1.5rem",
          }}
        >
          <h3 style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--foreground-muted)", margin: "0 0 1rem 0" }}>
            סיכום תכנון
          </h3>

          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            {client.monthlyGanttStatus && client.monthlyGanttStatus !== "none" && (
              <div>
                <div style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--foreground-muted)", marginBottom: "0.35rem" }}>
                  גאנט חודשי
                </div>
                <div
                  style={{
                    fontSize: "0.75rem",
                    fontWeight: 600,
                    padding: "0.35rem 0.75rem",
                    borderRadius: 4,
                    background: `${GANTT_STATUS_COLORS[client.monthlyGanttStatus]?.color}15`,
                    color: GANTT_STATUS_COLORS[client.monthlyGanttStatus]?.color,
                    border: `1px solid ${GANTT_STATUS_COLORS[client.monthlyGanttStatus]?.color}30`,
                    display: "inline-block",
                  }}
                >
                  {GANTT_STATUS_COLORS[client.monthlyGanttStatus]?.label}
                </div>
              </div>
            )}

            {client.annualGanttStatus && client.annualGanttStatus !== "none" && (
              <div style={{ borderTop: client.monthlyGanttStatus && client.monthlyGanttStatus !== "none" ? "1px solid var(--border)" : "none", paddingTop: client.monthlyGanttStatus && client.monthlyGanttStatus !== "none" ? "1rem" : 0 }}>
                <div style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--foreground-muted)", marginBottom: "0.35rem" }}>
                  גאנט שנתי
                </div>
                <div
                  style={{
                    fontSize: "0.75rem",
                    fontWeight: 600,
                    padding: "0.35rem 0.75rem",
                    borderRadius: 4,
                    background: `${GANTT_STATUS_COLORS[client.annualGanttStatus]?.color}15`,
                    color: GANTT_STATUS_COLORS[client.annualGanttStatus]?.color,
                    border: `1px solid ${GANTT_STATUS_COLORS[client.annualGanttStatus]?.color}30`,
                    display: "inline-block",
                  }}
                >
                  {GANTT_STATUS_COLORS[client.annualGanttStatus]?.label}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Quick Actions Card */}
        <div
          className="agd-card"
          style={{
            background: "var(--surface-raised)",
            border: "1px solid var(--border)",
            borderRadius: "0.75rem",
            padding: "1.5rem",
          }}
        >
          <h3 style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--foreground-muted)", margin: "0 0 1rem 0" }}>
            פעולות מהירות
          </h3>

          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            <button
              className="mod-btn-primary"
              style={{
                fontSize: "0.8rem",
                padding: "0.6rem 0.75rem",
                width: "100%",
                textAlign: "center",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "0.375rem",
              }}
              onClick={() => onNavigateTab?.("content")}
            >
              📋 תוכן חדש
            </button>
            <button
              className="mod-btn-ghost"
              style={{
                fontSize: "0.8rem",
                padding: "0.6rem 0.75rem",
                width: "100%",
                textAlign: "center",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "0.375rem",
              }}
              onClick={() => onNavigateTab?.("content")}
            >
              📅 גאנט חודשי
            </button>
            <button
              className="mod-btn-ghost"
              style={{
                fontSize: "0.8rem",
                padding: "0.6rem 0.75rem",
                width: "100%",
                textAlign: "center",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "0.375rem",
              }}
              onClick={() => onNavigateTab?.("content")}
            >
              📆 גאנט שנתי
            </button>
            <button
              className="mod-btn-ghost"
              style={{
                fontSize: "0.8rem",
                padding: "0.6rem 0.75rem",
                width: "100%",
                textAlign: "center",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "0.375rem",
              }}
              onClick={() => onNavigateTab?.("tasks")}
            >
              ✓ משימה חדשה
            </button>
            {client.portalEnabled && (
              <button
                className="mod-btn-ghost"
                style={{
                  fontSize: "0.8rem",
                  padding: "0.6rem 0.75rem",
                  width: "100%",
                  textAlign: "center",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "0.375rem",
                }}
              >
                🌐 פורטל לקוח
              </button>
            )}
          </div>
        </div>
      </div>
      </div>
    </div>
  );
}
