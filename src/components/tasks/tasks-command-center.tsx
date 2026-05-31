"use client";

/**
 * Tasks Workspace — execution-first, not a dashboard.
 * Answers "what should I work on right now?" in 2 seconds.
 *
 * Primary area = "Today's Work": every NOT-completed task with due_date <= today,
 * shown together in one execution list, visually split into 🔴 Overdue and 🟠 Today.
 * Linear/Height/Superhuman feel: dense actionable rows, complete-in-place, momentum.
 * No KPI blocks as the focus.
 */

import { useState, useMemo } from "react";
import { useTasks, useEmployeeTasks, useEmployees } from "@/lib/api/use-entity";
import { useAuth } from "@/lib/auth/auth-context";

type AnyTask = any;

const PRIO_WEIGHT: Record<string, number> = { urgent: 40, high: 25, medium: 10, low: 0 };
const PRIO_COLOR: Record<string, string> = { urgent: "#ef4444", high: "#f97316", medium: "#fbbf24", low: "#22c55e" };
const STATUS_LABEL: Record<string, string> = { new: "חדש", in_progress: "בביצוע", under_review: "בביקורת", returned: "הוחזר", pending: "ממתין" };

const todayStr = () => new Date().toISOString().split("T")[0];
const daysBetween = (a: string, b: string) => Math.round((new Date(a).getTime() - new Date(b).getTime()) / 86400000);

export default function TasksCommandCenter({ onOpenTask, onCompleteTask }: { onOpenTask: (task: AnyTask) => void; onCompleteTask?: (task: AnyTask) => void }) {
  const { role, employeeId } = useAuth();
  const { data: tasks } = useTasks();
  const { data: employeeTasks } = useEmployeeTasks();
  const { data: employees } = useEmployees();
  const [showUpcoming, setShowUpcoming] = useState(false);
  const [justDone, setJustDone] = useState<Set<string>>(new Set());

  const isEmployee = role === "employee";
  const today = todayStr();

  const myTasks = useMemo(() => {
    const g = (tasks || []).filter((t: AnyTask) => t.status !== "completed" && t.status !== "approved");
    const e = (employeeTasks || []).filter((t: AnyTask) => t.status !== "completed");
    const merged = [...g, ...e].filter((t) => !justDone.has(t.id));
    if (!isEmployee) return merged;
    return merged.filter((t: AnyTask) => (Array.isArray(t.assigneeIds) && t.assigneeIds.includes(employeeId)) || t.assignedEmployeeId === employeeId);
  }, [tasks, employeeTasks, isEmployee, employeeId, justDone]);

  const score = (t: AnyTask): number => {
    let s = PRIO_WEIGHT[t.priority] ?? 5;
    if (t.dueDate) {
      if (t.dueDate < today) s += 100 + Math.min(daysBetween(today, t.dueDate) * 5, 60);
      else if (t.dueDate === today) s += 60;
    }
    if (t.status === "returned") s += 25;
    return s;
  };
  const bySore = (a: AnyTask, b: AnyTask) => score(b) - score(a);

  const overdue = myTasks.filter((t) => t.dueDate && t.dueDate < today).sort(bySore);
  const dueToday = myTasks.filter((t) => t.dueDate === today).sort(bySore);
  const upcoming = myTasks.filter((t) => !t.dueDate || t.dueDate > today)
    .sort((a, b) => (a.dueDate || "9999").localeCompare(b.dueDate || "9999"));
  const todayWork = [...overdue, ...dueToday];

  // Momentum — completed today
  const doneToday = [...(tasks || []), ...(employeeTasks || [])].filter((t: AnyTask) => {
    if (t.status !== "completed" && t.status !== "approved") return false;
    if (isEmployee && !((Array.isArray(t.assigneeIds) && t.assigneeIds.includes(employeeId)) || t.assignedEmployeeId === employeeId)) return false;
    const w = t.updatedAt || t.completedAt;
    return w ? new Date(w).toISOString().split("T")[0] === today : false;
  }).length + justDone.size;

  const topNudge = todayWork[0];
  const nudgeWhy = topNudge ? (topNudge.dueDate! < today ? `באיחור ${daysBetween(today, topNudge.dueDate!)} ימים` : "מתוכנן להיום") : "";
  const empName = (t: AnyTask) => isEmployee ? "" : (Array.isArray(t.assigneeIds) ? t.assigneeIds.map((id: string) => employees.find((e) => e.id === id)?.name).filter(Boolean).join(", ") : "");

  const complete = (e: React.MouseEvent, t: AnyTask) => {
    e.stopPropagation();
    setJustDone((prev) => new Set(prev).add(t.id));
    onCompleteTask?.(t);
  };

  const C = { text: "var(--foreground)", muted: "var(--foreground-muted)", surface: "var(--surface-raised)", page: "var(--surface)", border: "var(--border)", accent: "var(--accent, #00B5FE)" };

  const Row = (t: AnyTask, accent: string) => (
    <div key={t.id} onClick={() => onOpenTask(t)} style={{
      display: "flex", alignItems: "center", gap: 12, padding: "0.7rem 0.9rem", cursor: "pointer",
      borderRadius: 10, transition: "background 120ms ease",
    }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "var(--surface)"; }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
    >
      <button onClick={(e) => complete(e, t)} title="סמן כהושלם" aria-label="סמן כהושלם" style={{
        width: 20, height: 20, borderRadius: "50%", border: `1.5px solid ${C.border}`, background: "transparent",
        cursor: "pointer", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", color: C.muted, fontSize: 12, padding: 0,
      }}
        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "#22c55e"; (e.currentTarget as HTMLElement).style.color = "#22c55e"; (e.currentTarget as HTMLElement).textContent = "✓"; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = C.border; (e.currentTarget as HTMLElement).textContent = ""; }}
      ></button>
      <span style={{ width: 8, height: 8, borderRadius: "50%", background: PRIO_COLOR[t.priority] || "#94a3b8", flexShrink: 0 }} />
      <span style={{ flex: 1, minWidth: 0, fontSize: "0.95rem", fontWeight: 500, color: C.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.title}</span>
      {empName(t) && <span style={{ fontSize: "0.72rem", color: C.muted, whiteSpace: "nowrap" }}>{empName(t)}</span>}
      <span style={{ fontSize: "0.74rem", color: C.muted, whiteSpace: "nowrap" }}>{t.clientName || "כללי"}</span>
      <span style={{ fontSize: "0.72rem", fontWeight: 600, padding: "2px 9px", borderRadius: 999, background: "var(--surface)", color: C.muted, whiteSpace: "nowrap" }}>{STATUS_LABEL[t.status] || t.status}</span>
      <span style={{ fontSize: "0.74rem", fontWeight: 700, color: accent, minWidth: 56, textAlign: "left", whiteSpace: "nowrap" }}>
        {t.dueDate && t.dueDate < today ? `${daysBetween(today, t.dueDate)} ימי איחור` : t.dueDate === today ? "היום" : t.dueDate ? new Date(t.dueDate).toLocaleDateString("he-IL", { day: "numeric", month: "short" }) : ""}
      </span>
    </div>
  );

  const GroupHeader = (dot: string, label: string, count: number) => (
    <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "0.4rem 0.9rem", marginTop: 4 }}>
      <span style={{ width: 9, height: 9, borderRadius: "50%", background: dot }} />
      <span style={{ fontSize: "0.78rem", fontWeight: 700, color: C.text, letterSpacing: "0.01em" }}>{label}</span>
      <span style={{ fontSize: "0.72rem", color: C.muted }}>{count}</span>
    </div>
  );

  return (
    <div dir="rtl" style={{ maxWidth: 820, margin: "0 auto" }}>
      {/* Title + slim momentum + AI nudge */}
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", flexWrap: "wrap", gap: 8, marginBottom: 4 }}>
        <h1 style={{ fontSize: "1.5rem", fontWeight: 800, color: C.text, margin: 0 }}>העבודה של היום</h1>
        <span style={{ fontSize: "0.8rem", color: C.muted }}>
          {todayWork.length} לביצוע{doneToday > 0 ? ` · ${doneToday} הושלמו היום ✓` : ""}
        </span>
      </div>
      {topNudge ? (
        <div onClick={() => onOpenTask(topNudge)} style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", color: C.accent, fontSize: "0.85rem", marginBottom: 16 }}>
          <span>✨</span><span>התחל ב: <strong>{topNudge.title}</strong> · {nudgeWhy}</span>
        </div>
      ) : <div style={{ marginBottom: 16 }} />}

      {/* Execution area */}
      {todayWork.length === 0 ? (
        <div style={{ textAlign: "center", padding: "3rem 1.5rem", color: C.muted, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16 }}>
          <div style={{ fontSize: "2.2rem", marginBottom: 8 }}>🎯</div>
          <div style={{ fontSize: "0.95rem", fontWeight: 600, color: C.text }}>אין מה לבצע היום — הכל תחת שליטה</div>
          {upcoming.length > 0 && <div style={{ fontSize: "0.82rem", marginTop: 6 }}>{upcoming.length} משימות מתוכננות קדימה</div>}
        </div>
      ) : (
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, padding: "0.5rem", overflow: "hidden" }}>
          {overdue.length > 0 && <>{GroupHeader("#ef4444", "🔴 באיחור", overdue.length)}{overdue.map((t) => Row(t, "#ef4444"))}</>}
          {dueToday.length > 0 && <>{GroupHeader("#f59e0b", "🟠 להיום", dueToday.length)}{dueToday.map((t) => Row(t, "#f59e0b"))}</>}
        </div>
      )}

      {/* Up next — secondary, collapsed */}
      {upcoming.length > 0 && (
        <div style={{ marginTop: 18 }}>
          <button onClick={() => setShowUpcoming((v) => !v)} style={{ display: "flex", alignItems: "center", gap: 8, background: "none", border: "none", cursor: "pointer", color: C.muted, fontSize: "0.85rem", fontWeight: 600, padding: "0.3rem 0.5rem" }}>
            <span>{showUpcoming ? "▾" : "▸"}</span> הבא בתור ({upcoming.length})
          </button>
          {showUpcoming && (
            <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, padding: "0.5rem", marginTop: 6 }}>
              {upcoming.slice(0, 30).map((t) => Row(t, C.muted))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
