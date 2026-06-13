"use client";

/**
 * EmployeeTasksWorkspace — the employee's primary execution center for the
 * Tasks page. Built for "what do I do next", not for reporting. Reuses the
 * page's existing task data + handlers (onOpenTask / onUpdate). Employee-scoped.
 *
 * Sections: top productivity bar · Pixel AI assistant · Requires Attention Now
 * (smart table) · Quick Wins · compact pipeline · personal performance ·
 * recently completed · workload analysis · Focus Mode.
 */

import { useMemo, useState } from "react";
import Avatar from "@/components/ui/avatar";

interface Props {
  tasks: any[];
  employeeTasks: any[];
  employees: any[];
  employeeId: string;
  displayName?: string;
  onOpenTask: (task: any) => void;
  onComplete: (task: any) => void;
}

const PRIO_COLOR: Record<string, string> = { urgent: "#ef4444", high: "#f97316", medium: "#f59e0b", low: "#22c55e" };

function Spark({ values, color }: { values: number[]; color: string }) {
  const v = values.length ? values : [0, 0];
  const max = Math.max(...v, 1), min = Math.min(...v, 0), span = max - min || 1, w = 88, h = 26;
  const pts = v.map((n, i) => `${(i / (v.length - 1 || 1)) * w},${h - ((n - min) / span) * (h - 4) - 2}`).join(" ");
  return <svg width={w} height={h} style={{ display: "block" }}><polyline points={pts} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

export default function EmployeeTasksWorkspace({ tasks, employeeTasks, employees, employeeId, displayName, onOpenTask, onComplete }: Props) {
  const [focusMode, setFocusMode] = useState(false);
  const [filter, setFilter] = useState<"all" | "today" | "overdue" | "urgent" | "high" | "medium" | "low">("all");

  const me = employees.find((e) => e.id === employeeId);
  const meName = me?.name || displayName || "עובד";
  const today = new Date().toISOString().split("T")[0];
  const todayStart = new Date(new Date().toDateString()).getTime();
  const getEmp = (id?: string) => employees.find((e) => e.id === id);

  const myAll = useMemo(() => {
    const dedupKey = (t: any) => (t.ganttItemId ? `g:${t.ganttItemId}` : `k:${String(t.clientName || "").trim()}|${String(t.title || "").trim()}|${t.dueDate || ""}`);
    const g = (tasks || []).filter((t: any) => t.assigneeIds?.includes(employeeId));
    const e = (employeeTasks || []).filter((t: any) => t.assignedEmployeeId === employeeId);
    const merged = [...e, ...g]; const seen = new Set<string>(); const out: any[] = [];
    for (const t of merged) { const k = dedupKey(t); if (seen.has(k)) continue; seen.add(k); out.push(t); }
    return out;
  }, [tasks, employeeTasks, employeeId]);

  const isDone = (t: any) => t.status === "completed" || t.status === "approved";
  const open = myAll.filter((t) => !isDone(t));
  const overdue = open.filter((t) => t.dueDate && t.dueDate < today);
  const todayList = open.filter((t) => t.dueDate && t.dueDate === today);
  const urgent = open.filter((t) => t.priority === "urgent" || t.priority === "high");
  const completed = myAll.filter(isDone);
  const weekAgo = todayStart - 7 * 864e5;
  const completedWeek = completed.filter((t) => { const d = t.completedAt || t.updatedAt; return d && new Date(d).getTime() >= weekAgo; });

  const estMin = (t: any) => Number(t.estimatedMinutes) || (t.priority === "urgent" ? 180 : t.priority === "high" ? 120 : t.priority === "low" ? 30 : 60);
  const fmtEst = (t: any) => { const m = estMin(t); return m >= 60 ? `${Math.round(m / 60)} שעות` : `${m} דקות`; };
  const situation = (t: any) => {
    if (t.dueDate && t.dueDate < today) { const d = Math.round((todayStart - new Date(t.dueDate).getTime()) / 864e5); return { l: `באיחור ${d} ימים`, c: "#ef4444" }; }
    if (t.dueDate === today) return { l: "דדליין היום", c: "#f59e0b" };
    if (t.status === "returned") return { l: "הוחזר אליך", c: "#ef4444" };
    if (t.status === "under_review") return { l: "ממתין ממך", c: "#f59e0b" };
    if (t.status === "in_progress") return { l: "בביצוע", c: "#3b82f6" };
    return { l: "פתוח", c: "#64748b" };
  };
  const dueLabel = (t: any) => { if (!t.dueDate) return "ללא יעד"; const d = new Date(t.dueDate); const isToday = t.dueDate === today; const isPast = t.dueDate < today; return `${isToday ? "היום" : isPast ? "אתמול" : d.toLocaleDateString("he-IL", { day: "2-digit", month: "2-digit" })}`; };

  // Requires-attention list (sorted by urgency) + filter
  const byUrgency = (a: any, b: any) => { const da = a.dueDate || "9999"; const db = b.dueDate || "9999"; return da < db ? -1 : da > db ? 1 : 0; };
  const attentionAll = [...open].sort(byUrgency);
  const attention = attentionAll.filter((t) => {
    if (filter === "today") return t.dueDate === today;
    if (filter === "overdue") return t.dueDate && t.dueDate < today;
    if (filter === "urgent") return t.priority === "urgent";
    if (filter === "high") return t.priority === "high";
    if (filter === "medium") return t.priority === "medium";
    if (filter === "low") return t.priority === "low";
    return true;
  });

  const quickWins = [...open].sort((a, b) => estMin(a) - estMin(b)).slice(0, 5);
  const recent = [...completed].filter((t) => t.completedAt || t.updatedAt).sort((a, b) => +new Date(b.completedAt || b.updatedAt) - +new Date(a.completedAt || a.updatedAt)).slice(0, 5);

  const inProgress = open.filter((t) => t.status === "in_progress");
  const waiting = open.filter((t) => t.status === "under_review" || t.status === "pending" || t.status === "returned");
  const PROG: Record<string, number> = { new: 10, in_progress: 50, under_review: 75, returned: 40, pending: 20, approved: 90, completed: 100 };

  // performance
  const weeklyTarget = completedWeek.length + todayList.length + overdue.length;
  const weeklyPct = weeklyTarget ? Math.round((completedWeek.length / weeklyTarget) * 100) : (completedWeek.length ? 100 : 0);
  const weeklyRemaining = Math.max(0, weeklyTarget - completedWeek.length);
  const dueCompleted = completed.filter((t) => t.dueDate && (t.completedAt || t.updatedAt));
  const onTimeN = dueCompleted.filter((t) => new Date(t.completedAt || t.updatedAt) <= new Date(t.dueDate + "T23:59:59")).length;
  const onTimeRate = dueCompleted.length ? Math.round((onTimeN / dueCompleted.length) * 100) : null;
  const returnedN = myAll.filter((t) => t.status === "returned").length;
  const reviewedN = completed.length + returnedN;
  const qualityScore = reviewedN ? Math.round((completed.length / reviewedN) * 100) : null;
  const lateEvents = [...overdue.map((t: any) => t.dueDate), ...dueCompleted.filter((t) => new Date(t.completedAt || t.updatedAt) > new Date(t.dueDate + "T23:59:59")).map((t: any) => t.dueDate)].filter(Boolean).sort();
  const lastLate = lateEvents[lateEvents.length - 1] as string | undefined;
  const streak = overdue.length > 0 ? 0 : lastLate ? Math.min(60, Math.round((todayStart - new Date(lastLate).getTime()) / 864e5)) : Math.min(30, completedWeek.length * 2);

  // 7-day completion sparkline
  const compSeries = [...Array(7)].map((_, i) => { const day = new Date(todayStart - (6 - i) * 864e5).toDateString(); return completed.filter((t) => { const d = t.completedAt || t.updatedAt; return d && new Date(d).toDateString() === day; }).length; });

  const ai: string[] = [];
  if (overdue.length) ai.push(`${overdue.length} משימות באיחור — התחל מהן`);
  if (under1hCount()) ai.push(`${under1hCount()} משימות ניתן לסיים בפחות משעה`);
  if (waiting.length) ai.push(`${waiting.length} משימות ממתינות לך (ביקורת/הוחזר)`);
  if (attentionAll[0]) ai.push(`מומלץ להתחיל מ: ${attentionAll[0].title}`);
  if (ai.length === 0) ai.push("אין משימות דחופות — שיהיה יום מעולה! ☕");
  function under1hCount() { return open.filter((t) => estMin(t) <= 60).length; }

  const card: React.CSSProperties = { background: "var(--surface-raised)", border: "1px solid var(--border)", borderRadius: 16, padding: "1.2rem" };
  const secTitle: React.CSSProperties = { fontSize: "1rem", fontWeight: 800, color: "var(--foreground)" };

  // ── FOCUS MODE ──
  if (focusMode) {
    const fl = attentionAll.slice(0, 3);
    const labels = ["המשימה הנוכחית", "הבאה בתור", "אחר כך"];
    return (
      <div style={{ maxWidth: 640, margin: "0 auto", display: "flex", flexDirection: "column", gap: 16, direction: "rtl", padding: "1rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: "1.2rem", fontWeight: 900 }}>🎯 מצב פוקוס</span>
          <button onClick={() => setFocusMode(false)} style={{ fontSize: "0.8rem", fontWeight: 700, color: "var(--foreground-muted)", background: "transparent", border: "1px solid var(--border)", borderRadius: 999, padding: "0.4rem 0.9rem", cursor: "pointer" }}>צא ממצב פוקוס</button>
        </div>
        {fl.length === 0 ? <div style={{ ...card, textAlign: "center", padding: "3rem" }}>אין משימות פתוחות — שיהיה יום מעולה! ✨</div> :
          fl.map((t, i) => (
            <div key={t.id} onClick={() => onOpenTask(t)} style={{ ...card, cursor: "pointer", borderInlineStart: `4px solid ${i === 0 ? "var(--accent)" : "var(--border)"}`, opacity: i === 0 ? 1 : 0.7 }}>
              <div style={{ fontSize: "0.72rem", color: "var(--foreground-subtle)" }}>{labels[i]}</div>
              <div style={{ fontSize: i === 0 ? "1.3rem" : "1rem", fontWeight: 800, color: "var(--foreground)", margin: "4px 0" }}>{t.title}</div>
              <div style={{ fontSize: "0.78rem", color: "var(--foreground-muted)" }}>{t.clientName || "כללי"} · {situation(t).l} · {fmtEst(t)}</div>
              {i === 0 && <button onClick={(e) => { e.stopPropagation(); onComplete(t); }} style={{ marginTop: 12, background: "#22c55e", color: "#fff", border: "none", borderRadius: 10, padding: "0.5rem 1.1rem", fontWeight: 700, fontSize: "0.82rem", cursor: "pointer" }}>✓ סמן כהושלם</button>}
            </div>
          ))}
      </div>
    );
  }

  const kpis = [
    { n: completedWeek.length, l: "הושלם השבוע", c: "#22c55e", spark: compSeries },
    { n: overdue.length, l: "באיחור", c: "#ef4444" },
    { n: urgent.length, l: "קריטיות", c: "#8b5cf6" },
    { n: todayList.length, l: "היום", c: "#3b82f6" },
    { n: open.length, l: "פתוחות", c: "#0ea5e9" },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20, direction: "rtl", maxWidth: 1200, margin: "0 auto", padding: "0.5rem" }}>
      {/* header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Avatar src={(me as any)?.avatarUrl} name={meName} size={42} />
          <div><div style={{ fontSize: "1.2rem", fontWeight: 900 }}>המשימות שלי</div><div style={{ fontSize: "0.74rem", color: "var(--foreground-muted)" }}>{meName}</div></div>
        </div>
        <button onClick={() => setFocusMode(true)} style={{ background: "linear-gradient(135deg,#6366f1,#06b6d4)", color: "#fff", border: "none", borderRadius: 12, padding: "0.55rem 1.2rem", fontWeight: 800, fontSize: "0.82rem", cursor: "pointer" }}>🎯 התחל מצב פוקוס</button>
      </div>

      {/* ═══ 1 · TOP PRODUCTIVITY BAR + 2 · AI ASSISTANT ═══ */}
      <div style={{ display: "grid", gridTemplateColumns: "2.4fr 1fr", gap: 16 }} className="et-2col">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 10 }} className="et-kpis">
          {kpis.map((k, i) => (
            <div key={i} style={{ ...card, padding: "0.9rem 1rem" }}>
              <div style={{ fontSize: "1.7rem", fontWeight: 900, color: k.c, lineHeight: 1 }}>{k.n}</div>
              <div style={{ fontSize: "0.68rem", color: "var(--foreground-muted)", margin: "4px 0 6px" }}>{k.l}</div>
              {k.spark ? <Spark values={k.spark} color={k.c} /> : <div style={{ height: 26 }} />}
            </div>
          ))}
        </div>
        <div style={{ position: "relative", overflow: "hidden", borderRadius: 16, padding: "1.2rem", background: "linear-gradient(145deg,#1e1b4b,#312e81 55%,#4c1d95)", border: "1px solid #6d28d9", color: "#fff" }}>
          <div style={{ position: "absolute", insetInlineStart: -10, top: 0, width: 150, height: 150, borderRadius: "50%", background: "radial-gradient(circle, rgba(167,139,250,0.45), transparent 70%)" }} />
          <div style={{ position: "relative", zIndex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}><span>🤖</span><span style={{ fontSize: "0.95rem", fontWeight: 900 }}>Pixel AI Assistant</span></div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 12 }}>
              {ai.slice(0, 3).map((t, i) => <div key={i} style={{ display: "flex", gap: 7, fontSize: "0.74rem", color: "#ede9fe" }}><span style={{ color: "#c4b5fd" }}>•</span>{t}</div>)}
            </div>
            <button onClick={() => setFocusMode(true)} style={{ width: "100%", background: "rgba(255,255,255,0.14)", border: "1px solid rgba(255,255,255,0.25)", borderRadius: 10, padding: "0.5rem", color: "#fff", fontWeight: 800, fontSize: "0.78rem", cursor: "pointer" }}>✨ הצג סדר עבודה מומלץ</button>
          </div>
        </div>
      </div>

      {/* filter chips */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {([["all", "כל המשימות"], ["today", "היום"], ["overdue", "באיחור"], ["urgent", "דחוף"], ["high", "גבוהה"], ["medium", "בינונית"], ["low", "נמוכה"]] as const).map(([v, l]) => (
          <button key={v} onClick={() => setFilter(v)} style={{ fontSize: "0.74rem", fontWeight: 700, padding: "0.35rem 0.9rem", borderRadius: 999, cursor: "pointer", border: `1px solid ${filter === v ? "var(--accent)" : "var(--border)"}`, background: filter === v ? "var(--accent)" : "transparent", color: filter === v ? "#fff" : "var(--foreground-muted)" }}>{l}</button>
        ))}
      </div>

      {/* ═══ 3 · REQUIRES ATTENTION NOW (smart table) ═══ */}
      <div style={card}>
        <div style={{ marginBottom: 14 }}>
          <span style={secTitle}>🔥 דורש טיפול עכשיו ({attention.length})</span>
          <div style={{ fontSize: "0.74rem", color: "var(--foreground-muted)", marginTop: 2 }}>המשימות הדחופות והחשובות ביותר שדורשות את תשומת הלב שלך</div>
        </div>
        {attention.length === 0 ? <div style={{ fontSize: "0.85rem", color: "var(--foreground-muted)" }}>אין משימות בקטגוריה זו 🎉</div> : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.82rem" }}>
              <thead>
                <tr style={{ color: "var(--foreground-muted)", fontSize: "0.68rem", textAlign: "right" }}>
                  {["משימה", "פרויקט", "דדליין", "סטטוס", "הוקצה על ידי", "זמן משוער", "פעולות"].map((h) => <th key={h} style={{ padding: "0.4rem 0.5rem", fontWeight: 600 }}>{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {attention.slice(0, 8).map((t) => {
                  const sit = situation(t); const assigner = getEmp(t.assignedById || t.createdBy);
                  return (
                    <tr key={t.id} onClick={() => onOpenTask(t)} style={{ cursor: "pointer", borderTop: "1px solid var(--border)" }}>
                      <td style={{ padding: "0.6rem 0.5rem", fontWeight: 700, color: "var(--foreground)" }}><span style={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%", background: PRIO_COLOR[t.priority] || "#94a3b8", marginInlineStart: 7 }} />{t.title}</td>
                      <td style={{ padding: "0.6rem 0.5rem", color: "var(--foreground-muted)" }}>{t.clientName || "כללי"}</td>
                      <td style={{ padding: "0.6rem 0.5rem", color: sit.c, fontWeight: 700 }}>{dueLabel(t)}</td>
                      <td style={{ padding: "0.6rem 0.5rem" }}><span style={{ fontSize: "0.68rem", fontWeight: 700, color: sit.c, background: sit.c + "1a", borderRadius: 999, padding: "1px 8px" }}>{sit.l}</span></td>
                      <td style={{ padding: "0.6rem 0.5rem" }}>{assigner ? <Avatar src={(assigner as any).avatarUrl} name={assigner.name} size={26} ring={false} /> : <span style={{ fontSize: "0.7rem", color: "var(--foreground-subtle)" }}>—</span>}</td>
                      <td style={{ padding: "0.6rem 0.5rem", color: "var(--foreground-muted)" }}>⏱ {fmtEst(t)}</td>
                      <td style={{ padding: "0.6rem 0.5rem" }} onClick={(e) => e.stopPropagation()}>
                        <button onClick={() => onOpenTask(t)} style={{ fontSize: "0.72rem", fontWeight: 700, color: "var(--accent)", background: "var(--accent-muted)", border: "none", borderRadius: 8, padding: "0.35rem 0.8rem", cursor: "pointer" }}>פתח משימה</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ═══ 4 · QUICK WINS  +  5 · PIPELINE ═══ */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1.7fr", gap: 16 }} className="et-2col">
        <div style={{ ...card, background: "linear-gradient(135deg,#f0fdf4,#ecfdf5)", border: "1px solid #bbf7d0" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}><span style={secTitle}>⚡ משימות מהירות</span></div>
          <div style={{ fontSize: "0.7rem", color: "#15803d", marginBottom: 12 }}>ניתן לסיים בפחות מ-30 דקות</div>
          {quickWins.length === 0 ? <div style={{ fontSize: "0.82rem", color: "var(--foreground-muted)" }}>אין משימות פתוחות 🎉</div> :
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {quickWins.map((t) => (
                <div key={t.id} onClick={() => onOpenTask(t)} style={{ display: "flex", alignItems: "center", gap: 10, background: "var(--surface-raised)", border: "1px solid var(--border)", borderRadius: 10, padding: "0.55rem 0.7rem", cursor: "pointer" }}>
                  <span style={{ fontSize: "0.66rem", fontWeight: 700, color: "#16a34a", background: "#dcfce7", borderRadius: 8, padding: "0.2rem 0.5rem", flexShrink: 0 }}>{estMin(t)} דק׳</span>
                  <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--foreground)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.title}</div><div style={{ fontSize: "0.66rem", color: "var(--foreground-muted)" }}>{t.clientName || "כללי"}</div></div>
                  <button onClick={(e) => { e.stopPropagation(); onComplete(t); }} title="סמן כהושלם" style={{ color: "#16a34a", background: "transparent", border: "none", cursor: "pointer", fontSize: "1rem" }}>✓</button>
                </div>
              ))}
            </div>}
        </div>
        <div style={card}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 12 }}><span style={secTitle}>📋 My Work Pipeline</span></div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10 }} className="et-3col">
            {[
              { l: "הושלם השבוע", c: "#22c55e", items: completedWeek },
              { l: "בביצוע", c: "#3b82f6", items: inProgress },
              { l: "ממתין", c: "#8b5cf6", items: waiting },
            ].map((col, ci) => (
              <div key={ci} style={{ background: "var(--surface)", borderRadius: 12, padding: "0.7rem", borderTop: `3px solid ${col.c}` }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}><span style={{ fontSize: "0.74rem", fontWeight: 800, color: col.c }}>{col.l}</span><span style={{ fontSize: "0.66rem", color: "var(--foreground-muted)" }}>{col.items.length}</span></div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {col.items.slice(0, 3).map((t: any) => {
                    const emp = getEmp((t.assigneeIds || [])[0] || t.assignedEmployeeId);
                    const prog = PROG[t.status] ?? 30;
                    return (
                      <div key={t.id} onClick={() => onOpenTask(t)} style={{ background: "var(--surface-raised)", border: "1px solid var(--border)", borderRadius: 9, padding: "0.5rem 0.6rem", cursor: "pointer" }}>
                        <div style={{ fontSize: "0.74rem", fontWeight: 600, color: "var(--foreground)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.title}</div>
                        <div style={{ fontSize: "0.62rem", color: "var(--foreground-muted)", marginBottom: 4 }}>{t.clientName || "כללי"}</div>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          {ci === 0 ? <span style={{ color: "#22c55e" }}>✓</span> : (
                            <div style={{ flex: 1, height: 4, background: "var(--surface)", borderRadius: 999, overflow: "hidden" }}><div style={{ width: `${prog}%`, height: "100%", background: col.c }} /></div>
                          )}
                          {emp && <Avatar src={(emp as any).avatarUrl} name={emp.name} size={18} ring={false} />}
                        </div>
                      </div>
                    );
                  })}
                  {col.items.length === 0 && <div style={{ fontSize: "0.7rem", color: "var(--foreground-subtle)" }}>—</div>}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ═══ 6 · PERFORMANCE  +  7 · RECENTLY COMPLETED ═══ */}
      <div style={{ display: "grid", gridTemplateColumns: "1.1fr 1fr", gap: 16 }} className="et-2col">
        <div style={card}>
          <div style={{ ...secTitle, marginBottom: 14 }}>ביצועים אישיים</div>
          <div style={{ display: "flex", justifyContent: "space-around", gap: 10, flexWrap: "wrap" }}>
            {[
              { l: "יעד שבועי", v: weeklyPct, suf: "%", c: "#6366f1", sub: weeklyRemaining > 0 ? `דרוש ${weeklyRemaining}` : "הושג!" },
              { l: "עמידה בזמן", v: onTimeRate, suf: "%", c: "#06b6d4", sub: onTimeRate === null ? "אין נתונים" : "" },
              { l: "איכות", v: qualityScore, suf: "%", c: "#8b5cf6", sub: qualityScore === null ? "אין נתונים" : "" },
              { l: "רצף הצלחות", v: streak, suf: "", c: "#22c55e", sub: "ימים" },
            ].map((r, i) => (
              <div key={i} style={{ textAlign: "center" }}>
                <div style={{ position: "relative", width: 66, height: 66, borderRadius: "50%", margin: "0 auto", background: r.v === null ? "var(--border)" : `conic-gradient(${r.c} ${Math.min(100, Number(r.v)) * 3.6}deg, var(--border) 0deg)`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <div style={{ width: 52, height: 52, borderRadius: "50%", background: "var(--surface-raised)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.92rem", fontWeight: 900, color: r.v === null ? "var(--foreground-subtle)" : r.c }}>{r.v === null ? "—" : `${r.v}${r.suf}`}</div>
                </div>
                <div style={{ fontSize: "0.7rem", fontWeight: 700, marginTop: 7 }}>{r.l}</div>
                <div style={{ fontSize: "0.6rem", color: "var(--foreground-subtle)" }}>{r.sub}</div>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.7rem", color: "var(--foreground-muted)", marginBottom: 4 }}><span>יעד שבועי: {weeklyTarget} משימות</span><span>{completedWeek.length}/{weeklyTarget}</span></div>
            <div style={{ height: 8, background: "var(--surface)", borderRadius: 999, overflow: "hidden" }}><div style={{ width: `${weeklyPct}%`, height: "100%", background: "linear-gradient(90deg,#6366f1,#8b5cf6)" }} /></div>
          </div>
        </div>
        <div style={card}>
          <div style={{ ...secTitle, marginBottom: 12 }}>✅ הושלם לאחרונה</div>
          {recent.length === 0 ? <div style={{ fontSize: "0.82rem", color: "var(--foreground-muted)" }}>עדיין אין משימות שהושלמו</div> :
            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              {recent.map((t) => (
                <div key={t.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "0.5rem 0.2rem", borderBottom: "1px solid var(--border)" }}>
                  <span style={{ color: "#22c55e" }}>✓</span>
                  <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontSize: "0.8rem", color: "var(--foreground)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.title}</div></div>
                  <span style={{ fontSize: "0.66rem", color: "var(--foreground-muted)" }}>{t.clientName || "כללי"}</span>
                  <span style={{ fontSize: "0.64rem", color: "var(--foreground-subtle)", minWidth: 50, textAlign: "left" }}>{(t.completedAt || t.updatedAt) ? new Date(t.completedAt || t.updatedAt).toLocaleDateString("he-IL", { day: "2-digit", month: "2-digit" }) : ""}</span>
                </div>
              ))}
            </div>}
        </div>
      </div>

      {/* ═══ 9 · WORKLOAD ANALYSIS ═══ */}
      <div style={{ ...card, background: "linear-gradient(135deg,#ecfeff,#f0fdfa)", border: "1px solid #99f6e4" }}>
        <div style={{ ...secTitle, marginBottom: 12 }}>📊 ניתוח עומס</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 12 }}>
          {[
            { l: "עומס נוכחי", v: `${open.length} משימות`, c: open.length >= 12 ? "#ef4444" : "#0d9488" },
            { l: "זמן עבודה משוער", v: `${Math.round(open.reduce((s, t) => s + estMin(t), 0) / 60)} שעות`, c: "#0d9488" },
            { l: "סיכון איחור", v: overdue.length >= 5 ? "גבוה" : overdue.length >= 2 ? "בינוני" : "נמוך", c: overdue.length >= 5 ? "#ef4444" : overdue.length >= 2 ? "#f59e0b" : "#22c55e" },
            { l: "תחזית סגירת איחורים", v: overdue.length === 0 ? "אין איחורים" : `${Math.ceil(overdue.length / 2)} ימים`, c: "#3b82f6" },
          ].map((r, i) => (
            <div key={i} style={{ background: "rgba(255,255,255,0.7)", borderRadius: 12, padding: "0.9rem 1rem" }}>
              <div style={{ fontSize: "0.7rem", color: "#64748b" }}>{r.l}</div>
              <div style={{ fontSize: "1.2rem", fontWeight: 900, color: r.c }}>{r.v}</div>
            </div>
          ))}
        </div>
        <div style={{ fontSize: "0.76rem", color: "#0f766e", marginTop: 12 }}>🤖 {overdue.length === 0 ? "אין איחורים — אתה בקצב מצוין! 💪" : `בקצב הנוכחי תסגור את כל המשימות באיחור תוך כ-${Math.ceil(overdue.length / 2)} ימים.`}</div>
      </div>

      <style>{`@media (max-width:1000px){.et-2col,.et-3col{grid-template-columns:1fr !important}.et-kpis{grid-template-columns:repeat(3,1fr) !important}}`}</style>
    </div>
  );
}
