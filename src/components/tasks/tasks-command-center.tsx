"use client";

/**
 * Tasks Command Center — the new "tell me what matters now" experience that sits
 * at the top of /tasks (the Kanban becomes a secondary, collapsible work view).
 *
 * Sections:
 *   1) Command metrics (today / overdue / blocked / done this week / score)
 *   2) AI Focus — the 3-5 highest-priority tasks, chosen by a transparent score
 *   3) Today's tasks — a large, prominent grid of everything due today
 *   4) Active projects — minimal cards with progress + health
 *   5) AI Insights — rule-based intelligence (risk / waiting / overdue / bottleneck)
 *
 * Role-aware: an employee sees only their own work; admin/manager sees the team.
 */

import { useMemo } from "react";
import { useTasks, useEmployeeTasks, useBusinessProjects, useApprovals, useEmployees } from "@/lib/api/use-entity";
import { useAuth } from "@/lib/auth/auth-context";

type AnyTask = any;

const PRIO_WEIGHT: Record<string, number> = { urgent: 40, high: 25, medium: 10, low: 0 };
const PRIO_COLOR: Record<string, string> = { urgent: "#ef4444", high: "#f97316", medium: "#fbbf24", low: "#22c55e" };
const STATUS_LABEL: Record<string, string> = { new: "חדש", in_progress: "בביצוע", under_review: "בביקורת", returned: "הוחזר", pending: "ממתין", approved: "אושר" };

function todayStr() { return new Date().toISOString().split("T")[0]; }
function daysBetween(a: string, b: string) { return Math.round((new Date(a).getTime() - new Date(b).getTime()) / 86400000); }

export default function TasksCommandCenter({ onOpenTask }: { onOpenTask: (task: AnyTask) => void }) {
  const { role, employeeId } = useAuth();
  const { data: tasks } = useTasks();
  const { data: employeeTasks } = useEmployeeTasks();
  const { data: projects } = useBusinessProjects();
  const { data: approvals } = useApprovals();
  const { data: employees } = useEmployees();

  const isEmployee = role === "employee";
  const today = todayStr();

  // My open tasks (employee → mine; admin → all open).
  const myTasks = useMemo(() => {
    const g = (tasks || []).filter((t: AnyTask) => t.status !== "completed" && t.status !== "approved");
    const e = (employeeTasks || []).filter((t: AnyTask) => t.status !== "completed");
    const merged = [...g, ...e];
    if (!isEmployee) return merged;
    return merged.filter((t: AnyTask) =>
      (Array.isArray(t.assigneeIds) && t.assigneeIds.includes(employeeId)) || t.assignedEmployeeId === employeeId,
    );
  }, [tasks, employeeTasks, isEmployee, employeeId]);

  const score = (t: AnyTask): number => {
    let s = PRIO_WEIGHT[t.priority] ?? 5;
    if (t.dueDate) {
      if (t.dueDate < today) s += 100 + Math.min(daysBetween(today, t.dueDate) * 5, 60);
      else if (t.dueDate === today) s += 60;
      else if (daysBetween(t.dueDate, today) <= 2) s += 30;
    }
    if (t.status === "returned") s += 25; // blocked / needs rework
    return s;
  };

  const overdue = myTasks.filter((t) => t.dueDate && t.dueDate < today);
  const dueToday = myTasks.filter((t) => t.dueDate === today);
  const blocked = myTasks.filter((t) => t.status === "returned");
  const focus = [...myTasks].sort((a, b) => score(b) - score(a)).slice(0, 5);

  // Done this week
  const weekAgo = new Date(); weekAgo.setDate(weekAgo.getDate() - 7);
  const doneThisWeek = [...(tasks || []), ...(employeeTasks || [])].filter((t: AnyTask) => {
    const done = t.status === "completed" || t.status === "approved";
    if (!done) return false;
    if (isEmployee && !((Array.isArray(t.assigneeIds) && t.assigneeIds.includes(employeeId)) || t.assignedEmployeeId === employeeId)) return false;
    const when = t.updatedAt || t.completedAt;
    return when ? new Date(when) >= weekAgo : true;
  }).length;

  const total = myTasks.length;
  const productivity = total + doneThisWeek === 0 ? 100 : Math.round((doneThisWeek / (doneThisWeek + overdue.length + total * 0.5 + 1)) * 100);

  // Active projects (admin only — employees stay task-focused)
  const activeProjects = useMemo(() => {
    if (isEmployee) return [];
    return (projects || [])
      .filter((p: AnyTask) => p.projectStatus === "in_progress")
      .map((p: AnyTask) => {
        const open = myTasks.filter((t) => t.businessProjectId === p.id || t.projectId === p.id).length;
        const due = p.dueDate || p.endDate || null;
        const near = due && daysBetween(due, today) <= 7;
        const health = open > 6 && near ? "#ef4444" : open > 3 ? "#f59e0b" : "#22c55e";
        const progress = typeof p.progress === "number" ? p.progress : Math.max(5, 100 - open * 8);
        return { id: p.id, name: p.projectName || p.name || "פרויקט", open, due, health, progress: Math.min(100, progress) };
      })
      .slice(0, 6);
  }, [projects, myTasks, isEmployee, today]);

  // Rule-based insights
  const insights = useMemo(() => {
    const out: Array<{ tone: "danger" | "warning" | "info"; icon: string; text: string }> = [];
    for (const p of activeProjects) {
      if (p.health === "#ef4444") out.push({ tone: "danger", icon: "⚠️", text: `פרויקט "${p.name}" בסיכון — ${p.open} משימות פתוחות לפני יעד קרוב` });
    }
    const waiting = (approvals || []).filter((a: AnyTask) => a.status === "pending_approval");
    if (waiting.length > 0) out.push({ tone: "warning", icon: "⏳", text: `${waiting.length} פריטים ממתינים לאישור לקוח` });
    const veryLate = overdue.filter((t) => daysBetween(today, t.dueDate) >= 5);
    if (veryLate.length > 0) out.push({ tone: "danger", icon: "🔴", text: `${veryLate.length} משימות באיחור של 5+ ימים — "${veryLate[0].title}"` });
    if (!isEmployee) {
      const load: Record<string, number> = {};
      for (const t of myTasks) for (const id of (Array.isArray(t.assigneeIds) ? t.assigneeIds : [])) load[id] = (load[id] || 0) + 1;
      const top = Object.entries(load).sort((a, b) => b[1] - a[1])[0];
      if (top && top[1] >= 8) out.push({ tone: "warning", icon: "👥", text: `צוואר בקבוק: ${employees.find((e) => e.id === top[0])?.name || "עובד"} עם ${top[1]} משימות פתוחות` });
    }
    if (focus[0]) out.push({ tone: "info", icon: "➡️", text: `פעולה מומלצת: התחל ב"${focus[0].title}"` });
    return out.slice(0, 5);
  }, [activeProjects, approvals, overdue, myTasks, focus, isEmployee, employees, today]);

  const empName = (t: AnyTask) => isEmployee ? null : (Array.isArray(t.assigneeIds) ? t.assigneeIds.map((id: string) => employees.find((e) => e.id === id)?.name).filter(Boolean).join(", ") : null);

  const C = {
    text: "var(--foreground)", muted: "var(--foreground-muted)", sub: "var(--foreground-subtle, var(--foreground-muted))",
    surface: "var(--surface-raised)", border: "var(--border)", accent: "var(--accent, #00B5FE)",
  };

  return (
    <div dir="rtl" style={{ maxWidth: 980, margin: "0 auto", display: "flex", flexDirection: "column", gap: "2rem" }}>
      {/* ── 1. Command metrics ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 12 }}>
        {[
          { v: dueToday.length, l: "להיום", c: C.accent },
          { v: overdue.length, l: "באיחור", c: "#ef4444" },
          { v: blocked.length, l: "תקועות", c: "#f59e0b" },
          { v: doneThisWeek, l: "הושלמו השבוע", c: "#22c55e" },
          { v: productivity, l: "ציון פרודוקטיביות", c: "#8b5cf6", suffix: "" },
        ].map((m) => (
          <div key={m.l} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, padding: "1.1rem 1rem" }}>
            <div style={{ fontSize: "2rem", fontWeight: 800, color: m.c, lineHeight: 1 }}>{m.v}</div>
            <div style={{ fontSize: "0.78rem", color: C.muted, marginTop: 6 }}>{m.l}</div>
          </div>
        ))}
      </div>

      {/* ── 2. AI Focus ── */}
      {focus.length > 0 && (
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
            <span style={{ fontSize: "1.15rem", fontWeight: 800, color: C.text }}>✨ הפוקוס של היום</span>
            <span style={{ fontSize: "0.75rem", color: C.muted }}>נבחר אוטומטית לפי דחיפות</span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
            {focus.map((t) => {
              const od = t.dueDate && t.dueDate < today;
              const why = od ? `באיחור ${daysBetween(today, t.dueDate)} ימים`
                : t.dueDate === today ? "מתוכנן להיום"
                : t.status === "returned" ? "הוחזר — דורש תיקון"
                : t.priority === "urgent" ? "עדיפות דחופה" : "הבא בתור";
              return (
                <button key={t.id} onClick={() => onOpenTask(t)} style={{
                  textAlign: "right", cursor: "pointer", background: C.surface, border: `1px solid ${od ? "rgba(239,68,68,0.4)" : C.border}`,
                  borderRadius: 16, padding: "1.1rem", display: "flex", flexDirection: "column", gap: 8, transition: "all 160ms ease",
                }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.transform = "translateY(-3px)"; (e.currentTarget as HTMLElement).style.borderColor = C.accent; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.transform = "translateY(0)"; (e.currentTarget as HTMLElement).style.borderColor = od ? "rgba(239,68,68,0.4)" : C.border; }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ width: 10, height: 10, borderRadius: "50%", background: PRIO_COLOR[t.priority] || "#94a3b8" }} />
                    <span style={{ fontSize: "0.72rem", fontWeight: 700, color: od ? "#ef4444" : C.muted }}>{why}</span>
                  </div>
                  <div style={{ fontSize: "1rem", fontWeight: 700, color: C.text, lineHeight: 1.35 }}>{t.title}</div>
                  <div style={{ fontSize: "0.78rem", color: C.muted }}>{t.clientName || "כללי"}{empName(t) ? ` · ${empName(t)}` : ""}</div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ── 3. Today's tasks — large & prominent ── */}
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
          <span style={{ fontSize: "1.15rem", fontWeight: 800, color: C.text }}>📅 כל המשימות להיום</span>
          <span style={{ fontSize: "0.85rem", color: C.muted }}>({dueToday.length})</span>
        </div>
        {dueToday.length === 0 ? (
          <div style={{ textAlign: "center", padding: "2.5rem", color: C.muted, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16 }}>
            <div style={{ fontSize: "2rem", marginBottom: 8 }}>☕</div>
            אין משימות מתוזמנות להיום.
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 12 }}>
            {dueToday.sort((a, b) => score(b) - score(a)).map((t) => (
              <button key={t.id} onClick={() => onOpenTask(t)} style={{
                textAlign: "right", cursor: "pointer", background: C.surface, border: `1px solid ${C.border}`,
                borderRadius: 16, padding: "1.25rem", display: "flex", flexDirection: "column", gap: 10, transition: "all 160ms ease", minHeight: 110,
              }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.transform = "translateY(-3px)"; (e.currentTarget as HTMLElement).style.borderColor = C.accent; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.transform = "translateY(0)"; (e.currentTarget as HTMLElement).style.borderColor = C.border; }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ width: 10, height: 10, borderRadius: "50%", background: PRIO_COLOR[t.priority] || "#94a3b8" }} />
                    <span style={{ fontSize: "0.7rem", fontWeight: 700, color: C.muted, background: "var(--surface)", padding: "2px 10px", borderRadius: 999 }}>{STATUS_LABEL[t.status] || t.status}</span>
                  </div>
                  {empName(t) && <span style={{ fontSize: "0.72rem", color: C.muted }}>👤 {empName(t)}</span>}
                </div>
                <div style={{ fontSize: "1.05rem", fontWeight: 700, color: C.text, lineHeight: 1.4 }}>{t.title}</div>
                <div style={{ fontSize: "0.8rem", color: C.muted, marginTop: "auto" }}>{t.clientName || "כללי"}</div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── 4. Active projects (admin) ── */}
      {activeProjects.length > 0 && (
        <div>
          <div style={{ fontSize: "1.15rem", fontWeight: 800, color: C.text, marginBottom: 12 }}>🚀 פרויקטים פעילים</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 }}>
            {activeProjects.map((p) => (
              <div key={p.id} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, padding: "1.1rem" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: "0.95rem", fontWeight: 700, color: C.text }}>{p.name}</span>
                  <span style={{ width: 9, height: 9, borderRadius: "50%", background: p.health }} />
                </div>
                <div style={{ height: 7, background: "var(--surface)", borderRadius: 999, margin: "12px 0 8px", overflow: "hidden" }}>
                  <div style={{ width: `${p.progress}%`, height: 7, background: C.accent, borderRadius: 999 }} />
                </div>
                <div style={{ fontSize: "0.78rem", color: C.muted }}>{p.progress}% · {p.open} משימות פתוחות{p.due ? ` · יעד ${new Date(p.due).toLocaleDateString("he-IL", { day: "numeric", month: "short" })}` : ""}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── 5. AI Insights ── */}
      {insights.length > 0 && (
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
            <span style={{ fontSize: "1.05rem", fontWeight: 800, color: C.text }}>✨ תובנות חכמות</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {insights.map((ins, i) => {
              const bg = ins.tone === "danger" ? "rgba(239,68,68,0.08)" : ins.tone === "warning" ? "rgba(245,158,11,0.1)" : "rgba(0,181,254,0.08)";
              const col = ins.tone === "danger" ? "#dc2626" : ins.tone === "warning" ? "#b45309" : "#0369a1";
              return (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, background: bg, borderRadius: 12, padding: "0.85rem 1.1rem" }}>
                  <span style={{ fontSize: "1.1rem" }}>{ins.icon}</span>
                  <span style={{ fontSize: "0.88rem", color: col, fontWeight: 500 }}>{ins.text}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
