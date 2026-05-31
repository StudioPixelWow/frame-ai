"use client";

/**
 * Tasks Workspace — a personal AI operating system for managing work.
 * Client-grouped execution: each client is a card; expanding it reveals that
 * client's overdue + today tasks and the AI-recommended next action.
 * Tasks live in ONE place (inside their client) — no duplication across sections.
 *
 *   Hero        → greeting, counts, daily progress ring (momentum)
 *   Workspace   → client cards (tasks / overdue / priority / progress) → expand
 *   AI Insights → insights only, never repeated tasks
 *   Performance → elegant lightweight gamification (goal / week / today / streak)
 */

import { useState, useMemo } from "react";
import { useTasks, useEmployeeTasks, useEmployees } from "@/lib/api/use-entity";
import { useAuth } from "@/lib/auth/auth-context";

type AnyTask = any;

const PRIO_WEIGHT: Record<string, number> = { urgent: 40, high: 25, medium: 10, low: 0 };
const PRIO_RANK: Record<string, number> = { urgent: 3, high: 2, medium: 1, low: 0 };
const PRIO_COLOR: Record<string, string> = { urgent: "#ef4444", high: "#f97316", medium: "#fbbf24", low: "#22c55e" };
const PRIO_LABEL: Record<string, string> = { urgent: "דחוף", high: "גבוהה", medium: "בינונית", low: "נמוכה" };
const STATUS_LABEL: Record<string, string> = { new: "חדש", in_progress: "בביצוע", under_review: "בביקורת", returned: "הוחזר", pending: "ממתין" };

const DAILY_TARGET = 12;
const todayStr = () => new Date().toISOString().split("T")[0];
const daysBetween = (a: string, b: string) => Math.round((new Date(a).getTime() - new Date(b).getTime()) / 86400000);

export default function TasksCommandCenter({ onOpenTask, onCompleteTask }: { onOpenTask: (task: AnyTask) => void; onCompleteTask?: (task: AnyTask) => void }) {
  const { role, employeeId } = useAuth();
  const { data: tasks } = useTasks();
  const { data: employeeTasks } = useEmployeeTasks();
  const { data: employees } = useEmployees();
  const [expanded, setExpanded] = useState<string | null>(null);
  const [justDone, setJustDone] = useState<Set<string>>(new Set());

  const isEmployee = role === "employee";
  const today = todayStr();
  const employeeName = employees.find((e) => e.id === employeeId)?.name?.split(" ")[0] || "";

  const mineFilter = (t: AnyTask) => !isEmployee || (Array.isArray(t.assigneeIds) && t.assigneeIds.includes(employeeId)) || t.assignedEmployeeId === employeeId;
  const allMine = useMemo(() => [...(tasks || []), ...(employeeTasks || [])].filter(mineFilter), [tasks, employeeTasks, isEmployee, employeeId]);
  const open = allMine.filter((t) => t.status !== "completed" && t.status !== "approved" && !justDone.has(t.id));

  const score = (t: AnyTask): number => {
    let s = PRIO_WEIGHT[t.priority] ?? 5;
    if (t.dueDate) { if (t.dueDate < today) s += 100 + Math.min(daysBetween(today, t.dueDate) * 5, 60); else if (t.dueDate === today) s += 60; }
    if (t.status === "returned") s += 25;
    return s;
  };

  // Group by client
  const clients = useMemo(() => {
    const map = new Map<string, { name: string; open: AnyTask[]; overdue: AnyTask[]; dueToday: AnyTask[]; completed: number; total: number }>();
    for (const t of allMine) {
      const key = t.clientName || "כללי";
      if (!map.has(key)) map.set(key, { name: key, open: [], overdue: [], dueToday: [], completed: 0, total: 0 });
      const c = map.get(key)!;
      c.total++;
      const done = t.status === "completed" || t.status === "approved";
      if (done) { c.completed++; return; }
      if (justDone.has(t.id)) { c.completed++; return; }
      c.open.push(t);
      if (t.dueDate && t.dueDate < today) c.overdue.push(t);
      else if (t.dueDate === today) c.dueToday.push(t);
    }
    return [...map.values()]
      .filter((c) => c.open.length > 0)
      .map((c) => ({
        ...c,
        topPrio: c.open.reduce((m, t) => Math.max(m, PRIO_RANK[t.priority] ?? 0), 0),
        progress: c.total > 0 ? Math.round((c.completed / c.total) * 100) : 0,
        next: [...c.open].sort((a, b) => score(b) - score(a))[0],
      }))
      .sort((a, b) => (b.overdue.length - a.overdue.length) || (b.topPrio - a.topPrio) || (b.open.length - a.open.length));
  }, [allMine, today, justDone]);

  const tasksWaiting = open.length;
  const clientsAttention = clients.filter((c) => c.overdue.length > 0 || c.dueToday.length > 0).length;

  // Momentum
  const completedDays = allMine.filter((t) => (t.status === "completed" || t.status === "approved") && (t.updatedAt || t.completedAt))
    .map((t) => new Date(t.updatedAt || t.completedAt).toISOString().split("T")[0]);
  const doneToday = completedDays.filter((d) => d === today).length + justDone.size;
  const weekAgo = new Date(); weekAgo.setDate(weekAgo.getDate() - 7);
  const doneWeek = allMine.filter((t) => (t.status === "completed" || t.status === "approved") && (t.updatedAt || t.completedAt) && new Date(t.updatedAt || t.completedAt) >= weekAgo).length;
  const weekRate = doneWeek + tasksWaiting === 0 ? 100 : Math.round((doneWeek / (doneWeek + tasksWaiting)) * 100);
  let streak = 0; { const set = new Set(completedDays); const d = new Date(); if (doneToday === 0) d.setDate(d.getDate() - 1); for (;;) { const k = d.toISOString().split("T")[0]; if (set.has(k) || (k === today && doneToday > 0)) { streak++; d.setDate(d.getDate() - 1); } else break; if (streak > 60) break; } }

  // Insights (no task duplication — insights only)
  const insights = useMemo(() => {
    const out: Array<{ tone: "danger" | "warning" | "info"; icon: string; text: string }> = [];
    const worst = clients.find((c) => c.overdue.length >= 3);
    if (worst) out.push({ tone: "danger", icon: "🔥", text: `${worst.overdue.length} משימות באיחור אצל ${worst.name}` });
    const stale = open.filter((t) => t.dueDate && daysBetween(today, t.dueDate) >= 4);
    if (stale.length) out.push({ tone: "warning", icon: "⏳", text: `${stale.length} משימות מחכות 4+ ימים` });
    const fast = clients.find((c) => c.progress >= 80 && c.open.length <= 2);
    if (fast) out.push({ tone: "info", icon: "📈", text: `${fast.name} מתקדם מצוין (${fast.progress}%)` });
    const top = clients[0]?.next;
    if (top) out.push({ tone: "info", icon: "💡", text: `המשימה הבאה המומלצת: ${top.title}` });
    return out.slice(0, 4);
  }, [clients, open, today]);

  const complete = (e: React.MouseEvent, t: AnyTask) => { e.stopPropagation(); setJustDone((p) => new Set(p).add(t.id)); onCompleteTask?.(t); };

  const C = { text: "var(--foreground)", muted: "var(--foreground-muted)", surface: "var(--surface-raised)", page: "var(--surface)", border: "var(--border)", accent: "var(--accent, #00B5FE)" };
  const ring = (val: number, max: number) => { const r = 34, circ = 2 * Math.PI * r, pct = Math.min(1, max ? val / max : 0); return { r, circ, off: circ * (1 - pct) }; };
  const rg = ring(doneToday, DAILY_TARGET);

  const TaskLine = (t: AnyTask, accent: string) => (
    <div key={t.id} onClick={(e) => { e.stopPropagation(); onOpenTask(t); }} style={{ display: "flex", alignItems: "center", gap: 10, padding: "0.55rem 0.5rem", cursor: "pointer", borderRadius: 8 }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "var(--surface)"; }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}>
      <button onClick={(e) => complete(e, t)} aria-label="הושלם" style={{ width: 18, height: 18, borderRadius: "50%", border: `1.5px solid ${C.border}`, background: "transparent", cursor: "pointer", flexShrink: 0, color: "#22c55e", fontSize: 11 }}
        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "#22c55e"; (e.currentTarget as HTMLElement).textContent = "✓"; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = C.border; (e.currentTarget as HTMLElement).textContent = ""; }}></button>
      <span style={{ width: 7, height: 7, borderRadius: "50%", background: PRIO_COLOR[t.priority] || "#94a3b8", flexShrink: 0 }} />
      <span style={{ flex: 1, minWidth: 0, fontSize: "0.88rem", color: C.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.title}</span>
      <span style={{ fontSize: "0.72rem", fontWeight: 600, color: accent, whiteSpace: "nowrap" }}>{t.dueDate && t.dueDate < today ? `${daysBetween(today, t.dueDate)}ד׳ איחור` : "היום"}</span>
    </div>
  );

  return (
    <div dir="rtl" style={{ maxWidth: 880, margin: "0 auto", display: "flex", flexDirection: "column", gap: "2.25rem" }}>
      {/* HERO */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 16 }}>
        <div>
          <div style={{ fontSize: "1.7rem", fontWeight: 800, color: C.text }}>בוקר טוב{employeeName ? `, ${employeeName}` : ""} 👋</div>
          <div style={{ fontSize: "0.95rem", color: C.muted, marginTop: 6 }}>
            {tasksWaiting} משימות ממתינות{clientsAttention > 0 ? ` · ${clientsAttention} לקוחות דורשים תשומת לב` : ""}
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ position: "relative", width: 84, height: 84 }}>
            <svg width="84" height="84" viewBox="0 0 84 84">
              <circle cx="42" cy="42" r={rg.r} fill="none" stroke="var(--border)" strokeWidth="7" />
              <circle cx="42" cy="42" r={rg.r} fill="none" stroke={C.accent} strokeWidth="7" strokeLinecap="round" strokeDasharray={rg.circ} strokeDashoffset={rg.off} transform="rotate(-90 42 42)" />
            </svg>
            <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
              <span style={{ fontSize: "1.05rem", fontWeight: 800, color: C.text }}>{doneToday}/{DAILY_TARGET}</span>
              <span style={{ fontSize: "0.6rem", color: C.muted }}>היום</span>
            </div>
          </div>
          <div style={{ fontSize: "0.8rem", color: C.muted, lineHeight: 1.8 }}>
            <div>{weekRate}% השלמה השבוע</div>
            <div>🔥 רצף {streak} ימים</div>
          </div>
        </div>
      </div>

      {/* CLIENT WORKSPACE */}
      <div>
        <div style={{ fontSize: "0.78rem", fontWeight: 700, color: C.muted, letterSpacing: "0.05em", marginBottom: 12 }}>מרחב לקוחות</div>
        {clients.length === 0 ? (
          <div style={{ textAlign: "center", padding: "3rem", color: C.muted, background: C.surface, borderRadius: 18 }}>
            <div style={{ fontSize: "2.2rem", marginBottom: 8 }}>🎯</div>
            <div style={{ fontSize: "0.95rem", fontWeight: 600, color: C.text }}>אין עבודה פתוחה — הכל תחת שליטה</div>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", gap: 14 }}>
            {clients.map((c) => {
              const isOpen = expanded === c.name;
              const prioKey = (Object.keys(PRIO_RANK).find((k) => PRIO_RANK[k] === c.topPrio)) || "low";
              return (
                <div key={c.name} style={{ gridColumn: isOpen ? "1 / -1" : "auto", background: C.surface, border: `1px solid ${C.border}`, borderRadius: 18, padding: "1.25rem", cursor: "pointer", transition: "transform 160ms ease, box-shadow 160ms ease", boxShadow: "0 1px 2px rgba(0,0,0,0.04)" }}
                  onClick={() => setExpanded(isOpen ? null : c.name)}
                  onMouseEnter={(e) => { if (!isOpen) { (e.currentTarget as HTMLElement).style.transform = "translateY(-3px)"; (e.currentTarget as HTMLElement).style.boxShadow = "0 12px 28px rgba(0,0,0,0.10)"; } }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.transform = "translateY(0)"; (e.currentTarget as HTMLElement).style.boxShadow = "0 1px 2px rgba(0,0,0,0.04)"; }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <span style={{ fontSize: "1.1rem", fontWeight: 700, color: C.text }}>{c.name}</span>
                    <span style={{ fontSize: "0.66rem", fontWeight: 700, padding: "2px 9px", borderRadius: 999, color: PRIO_COLOR[prioKey], background: `${PRIO_COLOR[prioKey]}1a` }}>{PRIO_LABEL[prioKey]}</span>
                  </div>
                  <div style={{ fontSize: "0.82rem", color: C.muted, marginTop: 8 }}>
                    {c.open.length} משימות{c.overdue.length > 0 ? <span style={{ color: "#ef4444", fontWeight: 600 }}> · {c.overdue.length} באיחור</span> : ""}
                  </div>
                  <div style={{ height: 6, background: "var(--surface)", borderRadius: 999, marginTop: 12, overflow: "hidden" }}>
                    <div style={{ width: `${c.progress}%`, height: 6, background: c.overdue.length > 0 ? "#f59e0b" : C.accent, borderRadius: 999 }} />
                  </div>
                  <div style={{ fontSize: "0.7rem", color: C.muted, marginTop: 5 }}>{c.progress}% הושלם</div>

                  {isOpen && (
                    <div style={{ marginTop: 14, borderTop: `1px solid ${C.border}`, paddingTop: 10 }} onClick={(e) => e.stopPropagation()}>
                      {c.next && (
                        <div style={{ display: "flex", alignItems: "center", gap: 8, color: C.accent, fontSize: "0.82rem", marginBottom: 8 }}>
                          <span>✨</span><span>פעולה מומלצת: <strong>{c.next.title}</strong></span>
                        </div>
                      )}
                      {c.overdue.length > 0 && <div style={{ fontSize: "0.72rem", fontWeight: 700, color: "#ef4444", padding: "4px 0.5rem" }}>🔴 באיחור</div>}
                      {c.overdue.map((t) => TaskLine(t, "#ef4444"))}
                      {c.dueToday.length > 0 && <div style={{ fontSize: "0.72rem", fontWeight: 700, color: "#f59e0b", padding: "6px 0.5rem 4px" }}>🟠 להיום</div>}
                      {c.dueToday.map((t) => TaskLine(t, "#f59e0b"))}
                      {c.overdue.length === 0 && c.dueToday.length === 0 && <div style={{ fontSize: "0.78rem", color: C.muted, padding: "4px 0.5rem" }}>אין משימות לביצוע מיידי — {c.open.length} מתוכננות קדימה</div>}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* AI INSIGHTS */}
      {insights.length > 0 && (
        <div>
          <div style={{ fontSize: "0.78rem", fontWeight: 700, color: C.muted, letterSpacing: "0.05em", marginBottom: 10 }}>✨ תובנות</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {insights.map((ins, i) => {
              const col = ins.tone === "danger" ? "#dc2626" : ins.tone === "warning" ? "#b45309" : "#0369a1";
              const bg = ins.tone === "danger" ? "rgba(239,68,68,0.07)" : ins.tone === "warning" ? "rgba(245,158,11,0.09)" : "rgba(0,181,254,0.07)";
              return (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, background: bg, borderRadius: 12, padding: "0.8rem 1.1rem" }}>
                  <span style={{ fontSize: "1.05rem" }}>{ins.icon}</span>
                  <span style={{ fontSize: "0.86rem", color: col, fontWeight: 500 }}>{ins.text}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* PERFORMANCE */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 12 }}>
        {[
          { v: `${doneToday}/${DAILY_TARGET}`, l: "יעד יומי" },
          { v: `${weekRate}%`, l: "השלמה שבועית" },
          { v: doneToday, l: "הושלמו היום" },
          { v: `${streak} ימים`, l: "רצף פוקוס" },
        ].map((m) => (
          <div key={m.l} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, padding: "0.9rem 1rem", textAlign: "center" }}>
            <div style={{ fontSize: "1.35rem", fontWeight: 800, color: C.text }}>{m.v}</div>
            <div style={{ fontSize: "0.72rem", color: C.muted, marginTop: 3 }}>{m.l}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
