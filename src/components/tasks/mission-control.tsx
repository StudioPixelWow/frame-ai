"use client";

/**
 * Tasks "Mission Control" — management layer above the task board: Pixel AI task
 * insights, task-health dashboard (by status / priority / completion), team
 * workload bars, and an upcoming-deadlines overview. Brand-consistent (light,
 * RTL, rounded cards). Reads the page's existing tasks + employees.
 */
import React, { useMemo } from "react";

const BRAND = "#00B5FE";
const card: React.CSSProperties = { background: "var(--surface-raised)", border: "1px solid var(--border)", borderRadius: 16, padding: "1.15rem 1.25rem" };
const STATUS: Record<string, { label: string; color: string }> = {
  new: { label: "חדש", color: "#3b82f6" }, in_progress: { label: "בעבודה", color: "#fbbf24" },
  under_review: { label: "בבדיקה", color: "#a78bfa" }, returned: { label: "הוחזר", color: "#f97316" },
  approved: { label: "אושר", color: "#22c55e" }, completed: { label: "הושלם", color: "#10b981" },
};
const PRIO: Record<string, { label: string; color: string }> = {
  high: { label: "דחוף", color: "#ef4444" }, medium: { label: "רגיל", color: "#f59e0b" }, low: { label: "נמוך", color: "#10b981" },
};
const DONE = (s: string) => s === "completed" || s === "approved";

export default function TasksMissionControl({ tasks = [], employees = [] }: { tasks?: any[]; employees?: any[] }) {
  const m = useMemo(() => {
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 864e5);
    const open = tasks.filter((t) => !DONE(t.status));
    const overdue = open.filter((t) => t.dueDate && new Date(t.dueDate) < now);
    const review = tasks.filter((t) => t.status === "under_review");
    const completedWeek = tasks.filter((t) => DONE(t.status) && (t.completedAt || t.updatedAt) && new Date(t.completedAt || t.updatedAt) >= weekAgo);
    const completionRate = tasks.length ? Math.round((tasks.filter((t) => DONE(t.status)).length / tasks.length) * 100) : 0;
    const overdueRate = open.length ? Math.round((overdue.length / open.length) * 100) : 0;

    const byStatus = Object.keys(STATUS).map((k) => ({ k, ...STATUS[k], n: tasks.filter((t) => t.status === k).length }));
    const byPrio = Object.keys(PRIO).map((k) => ({ k, ...PRIO[k], n: open.filter((t) => (t.priority || "medium") === k).length }));

    const CAP = 10;
    const workload = (employees || []).map((e) => {
      const mine = open.filter((t) => Array.isArray(t.assigneeIds) && t.assigneeIds.includes(e.id));
      const od = mine.filter((t) => t.dueDate && new Date(t.dueDate) < now).length;
      return { id: e.id, name: e.name, open: mine.length, overdue: od, pct: Math.min(150, Math.round((mine.length / CAP) * 100)) };
    }).filter((w) => w.open > 0).sort((a, b) => b.open - a.open).slice(0, 8);

    const inRange = (a: Date, b: Date) => open.filter((t) => t.dueDate && new Date(t.dueDate) >= a && new Date(t.dueDate) < b);
    const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const d1 = new Date(startToday.getTime() + 864e5), d2 = new Date(startToday.getTime() + 2 * 864e5);
    const wkEnd = new Date(startToday.getTime() + 7 * 864e5), nextWkEnd = new Date(startToday.getTime() + 14 * 864e5);
    const deadlines = [
      { l: "היום", n: inRange(startToday, d1).length, c: "#ef4444" },
      { l: "מחר", n: inRange(d1, d2).length, c: "#f59e0b" },
      { l: "השבוע", n: inRange(d2, wkEnd).length, c: BRAND },
      { l: "שבוע הבא", n: inRange(wkEnd, nextWkEnd).length, c: "#8b5cf6" },
    ];

    const maxStatus = Math.max(...byStatus.map((s) => s.n), 1);
    const overloaded = workload.find((w) => w.pct > 100);
    return { open, overdue, review, completedWeek, completionRate, overdueRate, byStatus, byPrio, workload, deadlines, maxStatus, overloaded };
  }, [tasks, employees]);

  const insights: string[] = [];
  if (m.overdue.length) insights.push(`${m.overdue.length} משימות בפיגור דורשות טיפול`);
  if (m.review.length) insights.push(`${m.review.length} משימות ממתינות לבדיקת מנהל`);
  if (m.overloaded) insights.push(`עומס גבוה: ${m.overloaded.name} (${m.overloaded.open} משימות פתוחות)`);
  insights.push(`${m.completedWeek.length} משימות הושלמו השבוע · ${m.completionRate}% שיעור השלמה`);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem", direction: "rtl", marginBottom: "1.5rem" }}>
      <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr", gap: "1rem" }}>
        <div style={{ borderRadius: 18, padding: "1.25rem", background: "linear-gradient(135deg,#eef2ff 0%,#f5f3ff 45%,#ecfeff 100%)", border: "1px solid #c7d2fe" }}>
          <div style={{ fontSize: "1.1rem", fontWeight: 900, background: "linear-gradient(90deg,#6366f1,#06b6d4)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>✨ Pixel AI · בקרת משימות</div>
          <div style={{ fontSize: "0.8rem", color: "#64748b", marginBottom: 10 }}>{m.open.length} משימות פתוחות · {m.overdue.length} בפיגור</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {insights.map((t, i) => <div key={i} style={{ fontSize: "0.83rem", color: "#334155", background: "rgba(255,255,255,0.65)", borderRadius: 8, padding: "0.45rem 0.7rem" }}>💡 {t}</div>)}
          </div>
        </div>
        <div style={{ ...card, display: "flex", flexDirection: "column", justifyContent: "center", gap: 12 }}>
          {[
            { l: "שיעור השלמה", v: `${m.completionRate}%`, c: "#10b981" },
            { l: "שיעור פיגור", v: `${m.overdueRate}%`, c: m.overdueRate > 30 ? "#ef4444" : "#f59e0b" },
            { l: "ממתין לבדיקה", v: String(m.review.length), c: "#a78bfa" },
            { l: "הושלמו השבוע", v: String(m.completedWeek.length), c: BRAND },
          ].map((r) => (
            <div key={r.l} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: "0.84rem", color: "var(--foreground-muted)" }}>{r.l}</span>
              <span style={{ fontSize: "1.2rem", fontWeight: 800, color: r.c }}>{r.v}</span>
            </div>
          ))}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.3fr 1fr 1fr", gap: "1rem" }}>
        <div style={card}>
          <div style={{ fontWeight: 800, fontSize: "0.95rem", marginBottom: 10 }}>משימות לפי סטטוס</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
            {m.byStatus.map((s) => (
              <div key={s.k}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.74rem", color: "var(--foreground-muted)", marginBottom: 2 }}><span>{s.label}</span><span>{s.n}</span></div>
                <div style={{ height: 7, background: "var(--border)", borderRadius: 4, overflow: "hidden" }}><div style={{ width: `${(s.n / m.maxStatus) * 100}%`, height: "100%", background: s.color, borderRadius: 4 }} /></div>
              </div>
            ))}
          </div>
        </div>
        <div style={card}>
          <div style={{ fontWeight: 800, fontSize: "0.95rem", marginBottom: 10 }}>לפי עדיפות (פתוחות)</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
            {m.byPrio.map((p) => (
              <div key={p.k} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: "0.82rem", color: "var(--foreground)" }}>● {p.label}</span>
                <span style={{ fontSize: "1.05rem", fontWeight: 800, color: p.color }}>{p.n}</span>
              </div>
            ))}
          </div>
        </div>
        <div style={card}>
          <div style={{ fontWeight: 800, fontSize: "0.95rem", marginBottom: 10 }}>📅 דדליינים</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
            {m.deadlines.map((d) => (
              <div key={d.l} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: "0.82rem", color: "var(--foreground-muted)" }}>{d.l}</span>
                <span style={{ fontSize: "1.05rem", fontWeight: 800, color: d.n > 0 ? d.c : "var(--foreground-muted)" }}>{d.n}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {m.workload.length > 0 && (
        <div style={card}>
          <div style={{ fontWeight: 800, fontSize: "0.95rem", marginBottom: 10 }}>👥 עומס צוות</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px,1fr))", gap: "0.8rem" }}>
            {m.workload.map((w) => (
              <div key={w.id}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.78rem", marginBottom: 3 }}>
                  <span style={{ fontWeight: 600, color: "var(--foreground)" }}>{w.name}</span>
                  <span style={{ color: w.pct > 100 ? "#ef4444" : "var(--foreground-muted)" }}>{w.open} משימות{w.overdue ? ` · ${w.overdue} בפיגור` : ""}</span>
                </div>
                <div style={{ height: 8, background: "var(--border)", borderRadius: 5, overflow: "hidden" }}>
                  <div style={{ width: `${Math.min(100, w.pct)}%`, height: "100%", background: w.pct > 100 ? "#ef4444" : w.pct > 70 ? "#f59e0b" : "#10b981", borderRadius: 5 }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
