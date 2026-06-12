"use client";

/**
 * Premium client-workspace overview — the executive "operating system" view that
 * sits at the top of a client's Overview tab. Brand-consistent (turquoise/blue,
 * light theme, RTL, rounded cards). Reuses the client's existing data.
 */
import React, { useMemo } from "react";

const BRAND = "#00B5FE";

/* ── tiny inline SVG helpers ── */
function Sparkline({ values, color = BRAND, w = 96, h = 30 }: { values: number[]; color?: string; w?: number; h?: number }) {
  const v = values.length ? values : [0, 0];
  const max = Math.max(...v, 1), min = Math.min(...v, 0);
  const span = max - min || 1;
  const pts = v.map((n, i) => `${(i / (v.length - 1 || 1)) * w},${h - ((n - min) / span) * (h - 4) - 2}`).join(" ");
  return (
    <svg width={w} height={h} style={{ display: "block" }}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={w} cy={h - ((v[v.length - 1] - min) / span) * (h - 4) - 2} r={2.5} fill={color} />
    </svg>
  );
}
function Ring({ pct, size = 96, stroke = 9, color = BRAND }: { pct: number; size?: number; stroke?: number; color?: string }) {
  const r = (size - stroke) / 2, c = 2 * Math.PI * r, off = c - (Math.max(0, Math.min(100, pct)) / 100) * c;
  return (
    <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--border)" strokeWidth={stroke} />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round" strokeDasharray={c} strokeDashoffset={off} style={{ transition: "stroke-dashoffset 600ms" }} />
    </svg>
  );
}

const card: React.CSSProperties = { background: "var(--surface-raised)", border: "1px solid var(--border)", borderRadius: 16, padding: "1.25rem" };
const fmtCur = (n: number) => `₪${Math.round(n).toLocaleString("he-IL")}`;

interface Props {
  client: any;
  tasks?: any[]; payments?: any[]; projectPayments?: any[]; campaigns?: any[]; leads?: any[]; ganttItems?: any[];
  onNavigateTab?: (tab: string) => void;
}

export default function ClientWorkspaceOverview({ client, tasks = [], payments = [], projectPayments = [], campaigns = [], ganttItems = [], onNavigateTab }: Props) {
  const m = useMemo(() => {
    const cid = client.id;
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const weekAgo = new Date(now.getTime() - 7 * 864e5);
    const cTasks = tasks.filter((t) => t.clientId === cid);
    const cGantt = ganttItems.filter((g) => g.clientId === cid);
    const cCampaigns = campaigns.filter((c) => c.clientId === cid);
    const cPay = [...payments, ...projectPayments].filter((p: any) => p.clientId === cid);

    const inMonth = (d?: string) => d && new Date(d) >= monthStart && new Date(d) <= now;
    const DONE = (s: string) => s === "completed" || s === "approved" || s === "published";

    const openTasks = cTasks.filter((t) => !DONE(t.status)).length;
    const overdue = cTasks.filter((t) => t.dueDate && new Date(t.dueDate) < now && !DONE(t.status));
    const inProgress = cTasks.filter((t) => t.status === "in_progress" || t.status === "under_review");
    const completedThisWeek = cTasks.filter((t) => DONE(t.status) && (t.completedAt || t.updatedAt) && new Date(t.completedAt || t.updatedAt) >= weekAgo);
    const activeCampaigns = cCampaigns.filter((c) => c.status === "active").length;
    const contentThisMonth = cGantt.filter((g) => inMonth(g.date)).length;
    const revenue = cPay.filter((p: any) => p.status === "paid" && inMonth(p.paidAt)).reduce((s: number, p: any) => s + (Number(p.amount) || 0), 0);

    // 7-day series: tasks completed per day
    const tasksSeries = Array.from({ length: 7 }, (_, i) => {
      const day = new Date(now.getTime() - (6 - i) * 864e5).toDateString();
      return cTasks.filter((t) => (t.completedAt || (DONE(t.status) && t.updatedAt)) && new Date(t.completedAt || t.updatedAt).toDateString() === day).length;
    });
    // 6-month revenue series
    const revSeries = Array.from({ length: 6 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
      const e = new Date(now.getFullYear(), now.getMonth() - (5 - i) + 1, 0);
      return cPay.filter((p: any) => p.status === "paid" && p.paidAt && new Date(p.paidAt) >= d && new Date(p.paidAt) <= e).reduce((s: number, p: any) => s + (Number(p.amount) || 0), 0);
    });
    const contentSeries = Array.from({ length: 6 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
      const e = new Date(now.getFullYear(), now.getMonth() - (5 - i) + 1, 0);
      return cGantt.filter((g) => g.date && new Date(g.date) >= d && new Date(g.date) <= e).length;
    });
    const trend = (s: number[]) => { const a = s[s.length - 2] || 0, b = s[s.length - 1] || 0; return a === 0 ? (b > 0 ? 100 : 0) : Math.round(((b - a) / a) * 100); };

    // Health breakdown (proxy scores 0-100)
    const compRate = cTasks.length ? Math.round((cTasks.filter((t) => DONE(t.status)).length / cTasks.length) * 100) : 70;
    const health = {
      marketing: Math.min(100, activeCampaigns > 0 ? 80 + activeCampaigns * 4 : 45),
      seo: client.wpConnectionStatus === "connected" ? 82 : 55,
      content: Math.min(100, 40 + contentThisMonth * 8),
      tasks: compRate,
      ops: overdue.length === 0 ? 90 : Math.max(40, 90 - overdue.length * 8),
    };
    const overall = Math.round((health.marketing + health.seo + health.content + health.tasks + health.ops) / 5);

    return { cTasks, openTasks, overdue, inProgress, completedThisWeek, activeCampaigns, contentThisMonth, revenue, tasksSeries, revSeries, contentSeries, trend, health, overall };
  }, [client, tasks, payments, projectPayments, campaigns, ganttItems]);

  const go = (t: string) => onNavigateTab?.(t);

  const kpis = [
    { label: "הכנסה החודש", value: fmtCur(m.revenue), icon: "💰", series: m.revSeries, trend: m.trend(m.revSeries), color: "#10b981", tab: "accounting" },
    { label: "משימות פתוחות", value: String(m.openTasks), icon: "✅", series: m.tasksSeries, trend: -m.trend(m.tasksSeries), color: BRAND, tab: "tasks" },
    { label: "קמפיינים פעילים", value: String(m.activeCampaigns), icon: "📣", series: m.contentSeries, trend: 0, color: "#8b5cf6", tab: "campaigns" },
    { label: "תוכן החודש", value: String(m.contentThisMonth), icon: "🎨", series: m.contentSeries, trend: m.trend(m.contentSeries), color: "#f59e0b", tab: "content" },
  ];

  const aiInsights: string[] = [];
  if (m.overdue.length) aiInsights.push(`${m.overdue.length} משימות בפיגור דורשות טיפול`);
  if (m.contentThisMonth === 0) aiInsights.push("אין תוכן מתוכנן החודש — כדאי לבנות תוכנית");
  if (m.activeCampaigns === 0) aiInsights.push("אין קמפיין פעיל — הזדמנות להפעיל");
  if (m.overall >= 85) aiInsights.push("ביצועי הלקוח מצוינים — שקול הרחבת שירות");
  if (aiInsights.length === 0) aiInsights.push("הכל תקין — המשך במומנטום 💪");

  const maxBar = Math.max(...m.contentSeries, 1);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem", marginBottom: "2rem" }}>
      {/* ZONE: Executive KPIs */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "1rem" }}>
        {kpis.map((k) => (
          <div key={k.label} onClick={() => go(k.tab)} style={{ ...card, cursor: "pointer", display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: "1.4rem" }}>{k.icon}</span>
              {k.trend !== 0 && <span style={{ fontSize: "0.72rem", fontWeight: 700, color: k.trend > 0 ? "#10b981" : "#ef4444" }}>{k.trend > 0 ? "▲" : "▼"} {Math.abs(k.trend)}%</span>}
            </div>
            <div style={{ fontSize: "1.9rem", fontWeight: 800, color: "var(--foreground)", lineHeight: 1 }}>{k.value}</div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
              <span style={{ fontSize: "0.82rem", color: "var(--foreground-muted)" }}>{k.label}</span>
              <Sparkline values={k.series} color={k.color} />
            </div>
          </div>
        ))}
      </div>

      {/* ZONE: Performance + Snapshot */}
      <div style={{ display: "grid", gridTemplateColumns: "1.6fr 1fr", gap: "1rem" }}>
        <div style={card}>
          <div style={{ fontWeight: 800, fontSize: "1rem", marginBottom: "1rem" }}>ביצועי תוכן — 6 חודשים</div>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 10, height: 150 }}>
            {m.contentSeries.map((n, i) => (
              <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
                <div style={{ width: "100%", height: `${(n / maxBar) * 120}px`, minHeight: 4, background: `linear-gradient(180deg, ${BRAND}, #0095D0)`, borderRadius: "6px 6px 0 0" }} />
                <span style={{ fontSize: "0.7rem", color: "var(--foreground-muted)" }}>{["ינו", "פבר", "מרץ", "אפר", "מאי", "יונ", "יול", "אוג", "ספט", "אוק", "נוב", "דצמ"][(new Date().getMonth() - (5 - i) + 12) % 12]}</span>
              </div>
            ))}
          </div>
        </div>
        <div style={card}>
          <div style={{ fontWeight: 800, fontSize: "1rem", marginBottom: "0.85rem" }}>תמונת מצב</div>
          {[
            { l: "משימות פתוחות", v: m.openTasks, c: BRAND },
            { l: "הושלמו השבוע", v: m.completedThisWeek.length, c: "#10b981" },
            { l: "בפיגור", v: m.overdue.length, c: "#ef4444" },
            { l: "קמפיינים פעילים", v: m.activeCampaigns, c: "#8b5cf6" },
            { l: "הכנסה החודש", v: fmtCur(m.revenue), c: "#f59e0b" },
          ].map((r) => (
            <div key={r.l} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.55rem 0", borderBottom: "1px solid var(--border)" }}>
              <span style={{ fontSize: "0.85rem", color: "var(--foreground-muted)" }}>{r.l}</span>
              <span style={{ fontSize: "1.05rem", fontWeight: 800, color: r.c }}>{r.v}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ZONE: Pixel AI Command Center */}
      <div style={{ borderRadius: 18, padding: "1.4rem", background: "linear-gradient(135deg, #eef2ff 0%, #f5f3ff 45%, #ecfeff 100%)", border: "1px solid #c7d2fe" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
          <div>
            <div style={{ fontSize: "1.15rem", fontWeight: 900, background: "linear-gradient(90deg,#6366f1,#06b6d4)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>✨ Pixel AI</div>
            <div style={{ fontSize: "0.82rem", color: "#64748b" }}>עוזר האינטליגנציה של הסוכנות עבור {client.name}</div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", margin: "0.9rem 0" }}>
          {[
            { l: "צור קמפיין", t: "campaigns" }, { l: "תוכנית תוכן", t: "content" }, { l: "נתח ביצועים", t: "seo" },
            { l: "אסטרטגיה", t: "dna" }, { l: "חקר מתחרים", t: "competitors" }, { l: "דוח יומי", t: "daily-report" },
          ].map((a) => (
            <button key={a.l} onClick={() => go(a.t)} style={{ padding: "0.5rem 0.9rem", borderRadius: 10, border: "1px solid #c7d2fe", background: "rgba(255,255,255,0.7)", backdropFilter: "blur(6px)", fontSize: "0.82rem", fontWeight: 700, color: "#4f46e5", cursor: "pointer" }}>{a.l}</button>
          ))}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {aiInsights.slice(0, 3).map((t, i) => (
            <div key={i} style={{ display: "flex", gap: 8, alignItems: "center", fontSize: "0.82rem", color: "#334155", background: "rgba(255,255,255,0.6)", borderRadius: 8, padding: "0.45rem 0.7rem" }}>
              <span>💡</span>{t}
            </div>
          ))}
        </div>
      </div>

      {/* ZONE: Command Center (3 columns) + Health */}
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "1rem" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "0.75rem" }}>
          {[
            { title: "דורש טיפול", items: m.overdue, color: "#ef4444", bg: "#fef2f2" },
            { title: "בתהליך", items: m.inProgress, color: "#f59e0b", bg: "#fffbeb" },
            { title: "הושלם השבוע", items: m.completedThisWeek, color: "#10b981", bg: "#f0fdf4" },
          ].map((col) => (
            <div key={col.title} style={{ ...card, padding: "0.9rem", background: col.bg, borderColor: `${col.color}30` }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <span style={{ fontWeight: 800, fontSize: "0.85rem", color: col.color }}>{col.title}</span>
                <span style={{ fontSize: "0.78rem", fontWeight: 800, color: col.color, background: "#fff", borderRadius: 8, padding: "1px 8px" }}>{col.items.length}</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {col.items.slice(0, 4).map((t: any, i: number) => (
                  <div key={i} onClick={() => go("tasks")} style={{ background: "#fff", border: "1px solid var(--border)", borderRadius: 8, padding: "0.5rem 0.6rem", cursor: "pointer" }}>
                    <div style={{ fontSize: "0.78rem", fontWeight: 600, color: "var(--foreground)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.title}</div>
                    {t.dueDate && <div style={{ fontSize: "0.66rem", color: "var(--foreground-muted)" }}>{new Date(t.dueDate).toLocaleDateString("he-IL")}</div>}
                  </div>
                ))}
                {col.items.length === 0 && <div style={{ fontSize: "0.74rem", color: "var(--foreground-muted)", textAlign: "center", padding: "0.5rem" }}>—</div>}
              </div>
            </div>
          ))}
        </div>

        {/* Health score */}
        <div style={{ ...card, display: "flex", flexDirection: "column", alignItems: "center" }}>
          <div style={{ fontWeight: 800, fontSize: "0.95rem", alignSelf: "flex-start", marginBottom: 6 }}>ציון בריאות לקוח</div>
          <div style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Ring pct={m.overall} color={m.overall >= 80 ? "#10b981" : m.overall >= 60 ? "#f59e0b" : "#ef4444"} />
            <div style={{ position: "absolute", textAlign: "center" }}>
              <div style={{ fontSize: "1.4rem", fontWeight: 900, color: "var(--foreground)" }}>{m.overall}</div>
              <div style={{ fontSize: "0.6rem", color: "var(--foreground-muted)" }}>מתוך 100</div>
            </div>
          </div>
          <div style={{ width: "100%", marginTop: 10, display: "flex", flexDirection: "column", gap: 6 }}>
            {[
              { l: "שיווק", v: m.health.marketing }, { l: "SEO", v: m.health.seo }, { l: "תוכן", v: m.health.content },
              { l: "משימות", v: m.health.tasks }, { l: "תפעול", v: m.health.ops },
            ].map((h) => (
              <div key={h.l}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.7rem", color: "var(--foreground-muted)", marginBottom: 2 }}><span>{h.l}</span><span>{h.v}</span></div>
                <div style={{ height: 6, background: "var(--border)", borderRadius: 4, overflow: "hidden" }}>
                  <div style={{ width: `${h.v}%`, height: "100%", background: h.v >= 80 ? "#10b981" : h.v >= 60 ? "#f59e0b" : "#ef4444", borderRadius: 4 }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
