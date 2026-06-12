"use client";

/**
 * Premium agency "Executive Dashboard" — the redesigned body of the main
 * dashboard: KPI cards w/ sparklines, business overview + chart, 3-column command
 * center, Pixel AI workspace, quick-access modules, activity timeline, smart
 * insights. Brand-consistent (turquoise/blue, light, RTL, rounded cards).
 */
import React, { useMemo } from "react";
import Link from "next/link";

const BRAND = "#00B5FE";
const card: React.CSSProperties = { background: "var(--surface-raised)", border: "1px solid var(--border)", borderRadius: 16, padding: "1.25rem" };
const cur = (n: number) => `₪${Math.round(n).toLocaleString("he-IL")}`;

function Spark({ values, color = BRAND, w = 104, h = 32 }: { values: number[]; color?: string; w?: number; h?: number }) {
  const v = values.length ? values : [0, 0];
  const max = Math.max(...v, 1), min = Math.min(...v, 0), span = max - min || 1;
  const pts = v.map((n, i) => `${(i / (v.length - 1 || 1)) * w},${h - ((n - min) / span) * (h - 4) - 2}`).join(" ");
  return <svg width={w} height={h} style={{ display: "block" }}><polyline points={pts} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

interface Props { analytics: any; clients?: any[]; tasks?: any[]; leads?: any[]; payments?: any[]; campaigns?: any[]; aiInsights?: any[]; }

export default function ExecutiveDashboard({ analytics, clients = [], tasks = [], leads = [], payments = [], aiInsights = [] }: Props) {
  const m = useMemo(() => {
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 864e5);
    const DONE = (s: string) => s === "completed" || s === "approved";
    const leadsSeries = Array.from({ length: 7 }, (_, i) => {
      const day = new Date(now.getTime() - (6 - i) * 864e5).toDateString();
      return leads.filter((l) => l.createdAt && new Date(l.createdAt).toDateString() === day).length;
    });
    const revSeries = Array.from({ length: 6 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1), e = new Date(now.getFullYear(), now.getMonth() - (5 - i) + 1, 0);
      return payments.filter((p) => p.status === "paid" && p.paidAt && new Date(p.paidAt) >= d && new Date(p.paidAt) <= e).reduce((s, p) => s + (Number(p.amount) || 0), 0);
    });
    const tasksSeries = Array.from({ length: 7 }, (_, i) => {
      const day = new Date(now.getTime() - (6 - i) * 864e5).toDateString();
      return tasks.filter((t) => DONE(t.status) && (t.completedAt || t.updatedAt) && new Date(t.completedAt || t.updatedAt).toDateString() === day).length;
    });
    const needsAttention = tasks.filter((t) => (t.dueDate && new Date(t.dueDate) < now && !DONE(t.status)) || t.status === "under_review");
    const inProgress = tasks.filter((t) => t.status === "in_progress");
    const completedWeek = tasks.filter((t) => DONE(t.status) && (t.completedAt || t.updatedAt) && new Date(t.completedAt || t.updatedAt) >= weekAgo);

    // Activity timeline
    const acts: { t: number; icon: string; text: string }[] = [];
    leads.slice(-30).forEach((l) => l.createdAt && acts.push({ t: Date.parse(l.createdAt), icon: "🎯", text: `ליד חדש: ${l.fullName || l.name || l.company || ""}` }));
    payments.filter((p) => p.status === "paid" && p.paidAt).slice(-30).forEach((p) => acts.push({ t: Date.parse(p.paidAt), icon: "💰", text: `תשלום התקבל: ${cur(Number(p.amount) || 0)}` }));
    tasks.filter((t) => DONE(t.status) && (t.completedAt || t.updatedAt)).slice(-30).forEach((t) => acts.push({ t: Date.parse(t.completedAt || t.updatedAt), icon: "✅", text: `משימה הושלמה: ${t.title || ""}` }));
    const activity = acts.filter((a) => !isNaN(a.t)).sort((a, b) => b.t - a.t).slice(0, 8);

    return { leadsSeries, revSeries, tasksSeries, needsAttention, inProgress, completedWeek, activity, revMax: Math.max(...revSeries, 1) };
  }, [tasks, leads, payments]);

  const a = analytics || {};
  const kpis = [
    { label: "לידים החודש", value: String(a.leadsThisMonth ?? 0), icon: "🎯", series: m.leadsSeries, color: "#8b5cf6", href: "/leads" },
    { label: "הכנסה החודש", value: cur(a.revenue ?? 0), icon: "💰", series: m.revSeries, color: "#10b981", href: "/accounting" },
    { label: "משימות פתוחות", value: String(a.openTasks ?? 0), icon: "✅", series: m.tasksSeries, color: BRAND, href: "/tasks" },
    { label: "קמפיינים פעילים", value: String(a.activeCampaigns ?? 0), icon: "📣", series: m.revSeries.map((x) => x / 1000), color: "#f59e0b", href: "/campaigns" },
  ];

  const insightList = (aiInsights || []).slice(0, 4).map((x: any) => (typeof x === "string" ? x : x.title || x.description || x.text || "")).filter(Boolean);
  if (insightList.length === 0) {
    if (a.overdueTasks) insightList.push(`${a.overdueTasks} משימות בפיגור דורשות טיפול`);
    if (a.overduePaymentsCount) insightList.push(`${a.overduePaymentsCount} תשלומים בפיגור גבייה`);
    if (a.clientsMissingGantt) insightList.push(`${a.clientsMissingGantt} לקוחות ללא תוכנית חודשית`);
    if (insightList.length === 0) insightList.push("הכל תקין — המשך במומנטום 💪");
  }

  const primary = [
    { l: "לידים", icon: "🎯", href: "/leads" }, { l: "לקוחות", icon: "👥", href: "/clients" },
    { l: "משימות", icon: "✅", href: "/tasks" }, { l: "פרויקטים", icon: "📂", href: "/business-projects" },
  ];
  const secondary = [
    { l: "קמפיינים", icon: "📣", href: "/campaigns" }, { l: "SEO/GEO", icon: "🔍", href: "/seo-geo/dashboard" },
    { l: "PixelManageAI", icon: "📸", href: "/projects" }, { l: "חשבונות", icon: "💳", href: "/accounting" },
    { l: "אוטומציות", icon: "⚙️", href: "/seo-geo/automation" }, { l: "פודקאסט", icon: "🎙️", href: "/accounting/podcast" },
  ];
  const fmtTime = (t: number) => { try { return new Date(t).toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" }); } catch { return ""; } };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem", direction: "rtl" }}>
      {/* 1. Executive KPIs */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px,1fr))", gap: "1rem" }}>
        {kpis.map((k) => (
          <Link key={k.label} href={k.href} style={{ ...card, textDecoration: "none", display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ fontSize: "1.4rem" }}>{k.icon}</div>
            <div style={{ fontSize: "2rem", fontWeight: 800, color: "var(--foreground)", lineHeight: 1 }}>{k.value}</div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
              <span style={{ fontSize: "0.82rem", color: "var(--foreground-muted)" }}>{k.label}</span>
              <Spark values={k.series} color={k.color} />
            </div>
          </Link>
        ))}
      </div>

      {/* 2. Business overview */}
      <div style={{ display: "grid", gridTemplateColumns: "1.6fr 1fr", gap: "1rem" }}>
        <div style={card}>
          <div style={{ fontWeight: 800, fontSize: "1rem", marginBottom: "1rem" }}>הכנסות — 6 חודשים</div>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 12, height: 160 }}>
            {m.revSeries.map((n, i) => (
              <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
                <span style={{ fontSize: "0.62rem", color: "var(--foreground-muted)" }}>{n > 0 ? `${Math.round(n / 1000)}k` : ""}</span>
                <div style={{ width: "100%", height: `${(n / m.revMax) * 120}px`, minHeight: 4, background: `linear-gradient(180deg, ${BRAND}, #0095D0)`, borderRadius: "6px 6px 0 0" }} />
                <span style={{ fontSize: "0.66rem", color: "var(--foreground-muted)" }}>{["ינו", "פבר", "מרץ", "אפר", "מאי", "יונ", "יול", "אוג", "ספט", "אוק", "נוב", "דצמ"][(new Date().getMonth() - (5 - i) + 12) % 12]}</span>
              </div>
            ))}
          </div>
        </div>
        <div style={card}>
          <div style={{ fontWeight: 800, fontSize: "1rem", marginBottom: "0.85rem" }}>תמונת מצב</div>
          {[
            { l: "לידים פעילים", v: a.activeLeads ?? 0 }, { l: "עסקאות שנסגרו", v: a.wonLeads ?? 0 },
            { l: "משימות פתוחות", v: a.openTasks ?? 0 }, { l: "גבייה ממתינה", v: cur(a.pendingPayments ?? 0) }, { l: "הכנסה החודש", v: cur(a.revenue ?? 0) },
          ].map((r) => (
            <div key={r.l} style={{ display: "flex", justifyContent: "space-between", padding: "0.55rem 0", borderBottom: "1px solid var(--border)" }}>
              <span style={{ fontSize: "0.85rem", color: "var(--foreground-muted)" }}>{r.l}</span>
              <span style={{ fontSize: "1.05rem", fontWeight: 800, color: "var(--foreground)" }}>{r.v}</span>
            </div>
          ))}
        </div>
      </div>

      {/* 3. Pixel AI */}
      <div style={{ borderRadius: 18, padding: "1.4rem", background: "linear-gradient(135deg,#eef2ff 0%,#f5f3ff 45%,#ecfeff 100%)", border: "1px solid #c7d2fe" }}>
        <div style={{ fontSize: "1.15rem", fontWeight: 900, background: "linear-gradient(90deg,#6366f1,#06b6d4)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>✨ Pixel AI</div>
        <div style={{ fontSize: "0.82rem", color: "#64748b", marginBottom: 10 }}>העוזר החכם של הסוכנות</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
          {[{ l: "צור קמפיין", h: "/campaigns" }, { l: "מחולל הצעות", h: "/proposals" }, { l: "נתח ביצועים", h: "/stats" }, { l: "מנכ״ל AI", h: "/ai-ceo" }, { l: "תוכן", h: "/clients" }].map((q) => (
            <Link key={q.l} href={q.h} style={{ padding: "0.5rem 0.9rem", borderRadius: 10, border: "1px solid #c7d2fe", background: "rgba(255,255,255,0.7)", fontSize: "0.82rem", fontWeight: 700, color: "#4f46e5", textDecoration: "none" }}>{q.l}</Link>
          ))}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {insightList.map((t: string, i: number) => (
            <div key={i} style={{ fontSize: "0.82rem", color: "#334155", background: "rgba(255,255,255,0.6)", borderRadius: 8, padding: "0.45rem 0.7rem" }}>💡 {t}</div>
          ))}
        </div>
      </div>

      {/* 4. Command center (3 cols) */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: "0.9rem" }}>
        {[
          { title: "דורש טיפול", items: m.needsAttention, color: "#ef4444", bg: "#fef2f2" },
          { title: "בתהליך", items: m.inProgress, color: "#f59e0b", bg: "#fffbeb" },
          { title: "הושלם השבוע", items: m.completedWeek, color: "#10b981", bg: "#f0fdf4" },
        ].map((col) => (
          <div key={col.title} style={{ ...card, padding: "0.95rem", background: col.bg, borderColor: `${col.color}30` }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <span style={{ fontWeight: 800, fontSize: "0.88rem", color: col.color }}>{col.title}</span>
              <span style={{ fontSize: "0.78rem", fontWeight: 800, color: col.color, background: "#fff", borderRadius: 8, padding: "1px 9px" }}>{col.items.length}</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {col.items.slice(0, 5).map((t: any, i: number) => (
                <Link key={i} href="/tasks" style={{ background: "#fff", border: "1px solid var(--border)", borderRadius: 8, padding: "0.5rem 0.6rem", textDecoration: "none" }}>
                  <div style={{ fontSize: "0.78rem", fontWeight: 600, color: "var(--foreground)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.title}</div>
                </Link>
              ))}
              {col.items.length === 0 && <div style={{ fontSize: "0.74rem", color: "var(--foreground-muted)", textAlign: "center", padding: "0.5rem" }}>—</div>}
            </div>
          </div>
        ))}
      </div>

      {/* 5. Quick access */}
      <div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px,1fr))", gap: "0.9rem", marginBottom: "0.75rem" }}>
          {primary.map((p) => (
            <Link key={p.l} href={p.href} style={{ ...card, textDecoration: "none", display: "flex", flexDirection: "column", alignItems: "center", gap: 8, padding: "1.4rem 1rem" }}>
              <span style={{ fontSize: "2rem" }}>{p.icon}</span>
              <span style={{ fontSize: "0.95rem", fontWeight: 700, color: "var(--foreground)" }}>{p.l}</span>
            </Link>
          ))}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px,1fr))", gap: "0.6rem" }}>
          {secondary.map((p) => (
            <Link key={p.l} href={p.href} style={{ background: "var(--surface-raised)", border: "1px solid var(--border)", borderRadius: 12, textDecoration: "none", display: "flex", alignItems: "center", gap: 8, padding: "0.7rem 0.9rem" }}>
              <span style={{ fontSize: "1.15rem" }}>{p.icon}</span>
              <span style={{ fontSize: "0.82rem", fontWeight: 600, color: "var(--foreground-muted)" }}>{p.l}</span>
            </Link>
          ))}
        </div>
      </div>

      {/* 6. Activity timeline */}
      {m.activity.length > 0 && (
        <div style={card}>
          <div style={{ fontWeight: 800, fontSize: "1rem", marginBottom: "0.85rem" }}>פעילות אחרונה</div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            {m.activity.map((act, i) => (
              <div key={i} style={{ display: "flex", gap: 12, alignItems: "center", padding: "0.5rem 0", borderBottom: i < m.activity.length - 1 ? "1px solid var(--border)" : "none" }}>
                <span style={{ fontSize: "0.72rem", color: "var(--foreground-muted)", width: 44, flexShrink: 0 }}>{fmtTime(act.t)}</span>
                <span style={{ fontSize: "1rem" }}>{act.icon}</span>
                <span style={{ fontSize: "0.85rem", color: "var(--foreground)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{act.text}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
