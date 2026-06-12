"use client";

/**
 * Client Tasks Tab — THE CLIENT DELIVERY WORKSPACE.
 * A premium project-execution surface (inspired by Linear / ClickUp / Notion):
 *  · Client project header (progress + health + quick actions)
 *  · Task-health overview cards
 *  · Smart workflow grouping (not a flat list)
 *  · Alive task cards (owner, priority, due, progress, files/comments, visibility)
 *  · Rich full-height side workspace: header, description, timeline, files,
 *    collaboration thread, activity, AI assistant, approval, next-action
 *  · Role-based views (client / employee / manager)
 * Real data via the global tasks store; collaboration persisted in the task.
 */
import { useMemo, useRef, useState } from "react";
import type { Client, Employee } from "@/lib/db/schema";
import { useTasks, useEmployeeTasks } from "@/lib/api/use-entity";
import { useAuth } from "@/lib/auth/auth-context";
import Avatar from "@/components/ui/avatar";

const TYPE_CONFIG: Record<string, { emoji: string; label: string; color: string }> = {
  social: { emoji: "📱", label: "סושיאל", color: "#3b82f6" },
  internal: { emoji: "🏢", label: "פנימי", color: "#00B5FE" },
  design: { emoji: "🎨", label: "עיצוב", color: "#ec4899" },
  website: { emoji: "🌐", label: "אתר", color: "#10b981" },
  branding: { emoji: "✨", label: "מיתוג", color: "#f59e0b" },
  general: { emoji: "📋", label: "כללי", color: "#6b7280" },
};
const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  new: { label: "חדש", color: "#3b82f6" },
  in_progress: { label: "בעבודה", color: "#f59e0b" },
  under_review: { label: "בבדיקה", color: "#00B5FE" },
  returned: { label: "הוחזר", color: "#f97316" },
  approved: { label: "אושר", color: "#22c55e" },
  completed: { label: "הושלם", color: "#10b981" },
};
const PRIORITY_CONFIG: Record<string, { label: string; color: string }> = {
  urgent: { label: "דחוף", color: "#ef4444" },
  high: { label: "גבוה", color: "#f97316" },
  medium: { label: "בינוני", color: "#3b82f6" },
  low: { label: "נמוך", color: "#9ca3af" },
};

// Visual lifecycle stages → progress %
const PROGRESS_BY_STATUS: Record<string, number> = { new: 10, returned: 35, in_progress: 55, under_review: 80, approved: 95, completed: 100 };
const TIMELINE_STAGES = [
  { key: "created", label: "נוצר" },
  { key: "assigned", label: "שובץ" },
  { key: "in_progress", label: "בעבודה" },
  { key: "under_review", label: "בדיקה פנימית" },
  { key: "approved", label: "אושר" },
  { key: "completed", label: "הושלם" },
];
function stageIndex(t: any): number {
  if (t.status === "completed") return 5;
  if (t.status === "approved") return 4;
  if (t.status === "under_review") return 3;
  if (t.status === "in_progress" || t.status === "returned") return 2;
  if ((t.assigneeIds || []).length > 0) return 1;
  return 0;
}

type Comment = { id: string; author: string; role: string; audience: "internal" | "client"; text: string; at: string };
function parseThread(notes: string): Comment[] {
  if (!notes) return [];
  try { const o = JSON.parse(notes); if (o && Array.isArray(o.thread)) return o.thread as Comment[]; } catch {}
  return notes.trim() ? [{ id: "legacy", author: "הערה פנימית", role: "internal", audience: "internal", text: notes, at: "" }] : [];
}

const ILDate = (d?: string | null) => (d ? new Date(d).toLocaleDateString("he-IL", { day: "2-digit", month: "2-digit" }) : "—");
const isOverdue = (d?: string | null, status?: string) => !!(d && status !== "completed" && status !== "approved" && new Date(d) < new Date(new Date().toDateString()));
const getType = (t: any) => (t.tags || []).find((x: string) => Object.keys(TYPE_CONFIG).includes(x)) || "general";

interface Props { client: Client; employees: Employee[] }

export default function TabTasks({ client, employees }: Props) {
  const { role } = useAuth();
  const isClient = role === "client";
  const isManager = role === "admin";
  const { data: allTasks, create: createTask, update: updateTask } = useTasks();
  const { create: createEmployeeTask } = useEmployeeTasks();

  const clientTasks = useMemo(() => (allTasks || []).filter((t: any) => t.clientId === client.id), [allTasks, client.id]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const selected = clientTasks.find((t: any) => t.id === selectedId) || null;

  const empById = (id?: string | null) => employees.find((e) => e.id === id);
  const ownerOf = (t: any) => empById((t.assigneeIds || [])[0]);

  // ── Health metrics ──
  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 86400000);
  const open = clientTasks.filter((t: any) => t.status !== "completed" && t.status !== "approved");
  const health = {
    open: open.length,
    inProgress: clientTasks.filter((t: any) => t.status === "in_progress").length,
    review: clientTasks.filter((t: any) => t.status === "under_review").length,
    blocked: clientTasks.filter((t: any) => t.status === "returned" || isOverdue(t.dueDate, t.status)).length,
    completedWeek: clientTasks.filter((t: any) => (t.status === "completed" || t.status === "approved") && t.updatedAt && new Date(t.updatedAt) >= weekAgo).length,
    total: clientTasks.length,
  };
  const overallProgress = clientTasks.length ? Math.round(clientTasks.reduce((s: number, t: any) => s + (PROGRESS_BY_STATUS[t.status] || 0), 0) / clientTasks.length) : 0;
  const nextDeadline = open.filter((t: any) => t.dueDate).sort((a: any, b: any) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())[0];

  // ── Smart workflow groups ──
  const groups: { id: string; label: string; color: string; items: any[] }[] = useMemo(() => {
    const g = {
      needs: { id: "needs", label: "דורש טיפול", color: "#ef4444", items: [] as any[] },
      progress: { id: "progress", label: "בעבודה", color: "#f59e0b", items: [] as any[] },
      review: { id: "review", label: "מוכן לבדיקה / אישור", color: "#00B5FE", items: [] as any[] },
      backlog: { id: "backlog", label: "ממתין להתחלה", color: "#6366f1", items: [] as any[] },
      done: { id: "done", label: "הושלם", color: "#22c55e", items: [] as any[] },
    };
    clientTasks.forEach((t: any) => {
      if (t.status === "completed" || t.status === "approved") g.done.items.push(t);
      else if (t.status === "returned" || isOverdue(t.dueDate, t.status) || t.priority === "urgent") g.needs.items.push(t);
      else if (t.status === "under_review") g.review.items.push(t);
      else if (t.status === "in_progress") g.progress.items.push(t);
      else g.backlog.items.push(t);
    });
    return [g.needs, g.progress, g.review, g.backlog, g.done].filter((x) => x.items.length > 0);
  }, [clientTasks]);

  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({ done: true });

  // ── Create task ──
  const [f, setF] = useState({ title: "", description: "", type: "general", priority: "medium", assignee: client.assignedManagerId || "", dueDate: "" });
  const submitCreate = async () => {
    if (!f.title.trim()) return;
    const base = { clientId: client.id, clientName: client.name, title: f.title, description: f.description, status: "new", priority: f.priority, assigneeIds: f.assignee ? [f.assignee] : [], dueDate: f.dueDate || null, tags: [f.type], files: [], notes: "" };
    try {
      await createTask(base as any);
      if (f.assignee) { try { await createEmployeeTask({ title: f.title, description: f.description, clientId: client.id, clientName: client.name, status: "new", priority: f.priority, assignedEmployeeId: f.assignee, dueDate: f.dueDate || null, projectId: null, files: [], notes: "" } as any); } catch {} }
      setF({ title: "", description: "", type: "general", priority: "medium", assignee: client.assignedManagerId || "", dueDate: "" });
      setShowCreate(false);
    } catch (e) { console.error(e); }
  };

  return (
    <div style={{ direction: "rtl", display: "flex", flexDirection: "column", gap: "1.25rem" }}>
      {/* ═══ 1. CLIENT PROJECT HEADER ═══ */}
      <div style={{ background: "linear-gradient(135deg,#eff6ff,#ecfeff)", border: "1px solid #dbeafe", borderRadius: 18, padding: "1.3rem 1.5rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 14 }}>
          <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
            {client.logoUrl ? (
              <div style={{ width: 52, height: 52, borderRadius: 14, backgroundImage: `url(${client.logoUrl})`, backgroundSize: "cover", backgroundPosition: "center", flexShrink: 0, border: "1px solid #e2e8f0" }} />
            ) : (
              <div style={{ width: 52, height: 52, borderRadius: 14, background: "#dbeafe", color: "#1d4ed8", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, flexShrink: 0 }}>{(client.name || "?").slice(0, 2)}</div>
            )}
            <div>
              <div style={{ fontSize: "1.3rem", fontWeight: 900, color: "#0f172a" }}>{client.name}</div>
              <div style={{ fontSize: "0.82rem", color: "#475569" }}>מרחב הספקה · {health.total} משימות{nextDeadline ? ` · דדליין קרוב ${ILDate(nextDeadline.dueDate)}` : ""}</div>
            </div>
          </div>
          {!isClient && (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button onClick={() => setShowCreate(true)} style={btnPrimary}>+ משימה חדשה</button>
            </div>
          )}
        </div>
        {/* overall progress */}
        <div style={{ marginTop: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.74rem", color: "#475569", marginBottom: 5 }}>
            <span>התקדמות כוללת</span><span style={{ fontWeight: 800 }}>{overallProgress}%</span>
          </div>
          <div style={{ height: 8, background: "#e2e8f0", borderRadius: 999, overflow: "hidden" }}>
            <div style={{ width: `${overallProgress}%`, height: "100%", background: "linear-gradient(90deg,#00B5FE,#22c55e)", borderRadius: 999 }} />
          </div>
        </div>
      </div>

      {/* ═══ 2. TASK HEALTH OVERVIEW ═══ */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: "0.75rem" }}>
        {[
          { label: "משימות פתוחות", val: health.open, color: "#3b82f6", icon: "📂" },
          { label: "בעבודה", val: health.inProgress, color: "#f59e0b", icon: "🔄" },
          { label: "ממתין לבדיקה", val: health.review, color: "#00B5FE", icon: "🔍" },
          { label: "חסום / באיחור", val: health.blocked, color: "#ef4444", icon: "⛔" },
          { label: "הושלם השבוע", val: health.completedWeek, color: "#22c55e", icon: "✅" },
        ].map((c, i) => (
          <div key={i} className="premium-card" style={{ padding: "0.9rem 1rem", borderTop: `3px solid ${c.color}` }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: "1.1rem" }}>{c.icon}</span>
              <span style={{ fontSize: "1.5rem", fontWeight: 900, color: c.color }}>{c.val}</span>
            </div>
            <div style={{ fontSize: "0.76rem", color: "var(--foreground-muted)", marginTop: 2 }}>{c.label}</div>
          </div>
        ))}
      </div>

      {/* ═══ 3 + 4. WORKFLOW GROUPS + TASK CARDS ═══ */}
      {clientTasks.length === 0 ? (
        <div style={{ textAlign: "center", padding: "3rem 1rem", color: "var(--foreground-muted)", background: "var(--surface-raised)", border: "1px solid var(--border)", borderRadius: 14 }}>
          <div style={{ fontSize: "2rem", marginBottom: 8 }}>📋</div>
          <div style={{ fontWeight: 700, color: "var(--foreground)" }}>אין עדיין משימות ללקוח</div>
          {!isClient && <button onClick={() => setShowCreate(true)} style={{ ...btnPrimary, marginTop: 12 }}>+ צור משימה ראשונה</button>}
        </div>
      ) : (
        groups.map((g) => (
          <div key={g.id}>
            <button onClick={() => setCollapsed((p) => ({ ...p, [g.id]: !p[g.id] }))} style={{ display: "flex", alignItems: "center", gap: 8, background: "none", border: "none", cursor: "pointer", padding: "0.3rem 0", width: "100%" }}>
              <span style={{ width: 9, height: 9, borderRadius: "50%", background: g.color }} />
              <span style={{ fontSize: "0.9rem", fontWeight: 800, color: "var(--foreground)" }}>{g.label}</span>
              <span style={{ fontSize: "0.72rem", fontWeight: 800, color: g.color, background: g.color + "1a", borderRadius: 999, padding: "1px 9px" }}>{g.items.length}</span>
              <span style={{ marginInlineStart: "auto", color: "var(--foreground-subtle)", fontSize: "0.8rem" }}>{collapsed[g.id] ? "▼" : "▲"}</span>
            </button>
            {!collapsed[g.id] && (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(300px,1fr))", gap: "0.75rem", marginTop: 8 }}>
                {g.items.map((t: any) => {
                  const tc = TYPE_CONFIG[getType(t)]; const sc = STATUS_CONFIG[t.status] || STATUS_CONFIG.new; const pc = PRIORITY_CONFIG[t.priority] || PRIORITY_CONFIG.medium;
                  const owner = ownerOf(t); const prog = PROGRESS_BY_STATUS[t.status] || 0; const od = isOverdue(t.dueDate, t.status);
                  const comments = parseThread(t.notes || "").length; const files = (t.files || []).length;
                  return (
                    <div key={t.id} onClick={() => setSelectedId(t.id)} className="premium-card" style={{ padding: "0.9rem 1rem", cursor: "pointer", borderInlineStart: `3px solid ${pc.color}`, display: "flex", flexDirection: "column", gap: 8 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                        <span style={{ fontSize: "0.88rem", fontWeight: 700, color: "var(--foreground)" }}>{tc.emoji} {t.title}</span>
                        <span style={{ fontSize: "0.64rem", fontWeight: 800, color: sc.color, background: sc.color + "1a", borderRadius: 999, padding: "2px 8px", whiteSpace: "nowrap" }}>{sc.label}</span>
                      </div>
                      {t.description && <div style={{ fontSize: "0.76rem", color: "var(--foreground-muted)", lineHeight: 1.5, maxHeight: "3em", overflow: "hidden" }}>{t.description}</div>}
                      <div style={{ height: 5, background: "var(--surface)", borderRadius: 999, overflow: "hidden" }}>
                        <div style={{ width: `${prog}%`, height: "100%", background: sc.color, borderRadius: 999 }} />
                      </div>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          {owner ? <Avatar src={(owner as any).avatarUrl} name={owner.name} size={24} ring={false} /> : <span style={{ fontSize: "0.7rem", color: "var(--foreground-subtle)" }}>ללא אחראי</span>}
                          <span style={{ fontSize: "0.7rem", fontWeight: 700, color: pc.color }}>{pc.label}</span>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 9, fontSize: "0.7rem", color: "var(--foreground-muted)" }}>
                          {files > 0 && <span>📎 {files}</span>}
                          {comments > 0 && <span>💬 {comments}</span>}
                          <span style={{ color: od ? "#ef4444" : "var(--foreground-muted)", fontWeight: od ? 700 : 400 }}>📅 {ILDate(t.dueDate)}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ))
      )}

      {/* ═══ 5. SIDE WORKSPACE ═══ */}
      {selected && (
        <TaskWorkspace task={selected} owner={ownerOf(selected)} employees={employees} isClient={isClient} isManager={isManager} onClose={() => setSelectedId(null)} updateTask={updateTask} />
      )}

      {/* ═══ CREATE TASK ═══ */}
      {showCreate && (
        <div onClick={() => setShowCreate(false)} style={scrim}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: "var(--surface-raised)", borderRadius: 16, padding: "1.4rem", width: "92%", maxWidth: 460, direction: "rtl" }}>
            <div style={{ fontSize: "1.05rem", fontWeight: 800, marginBottom: 14 }}>משימה חדשה</div>
            <input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="כותרת המשימה" style={inp} />
            <textarea value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} placeholder="תיאור" rows={3} style={{ ...inp, resize: "vertical" }} />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <select value={f.type} onChange={(e) => setF({ ...f, type: e.target.value })} style={inp}>{Object.entries(TYPE_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.emoji} {v.label}</option>)}</select>
              <select value={f.priority} onChange={(e) => setF({ ...f, priority: e.target.value })} style={inp}>{Object.entries(PRIORITY_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</select>
              <select value={f.assignee} onChange={(e) => setF({ ...f, assignee: e.target.value })} style={inp}><option value="">ללא אחראי</option>{employees.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}</select>
              <input type="date" value={f.dueDate} onChange={(e) => setF({ ...f, dueDate: e.target.value })} style={inp} />
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 12, justifyContent: "flex-start" }}>
              <button onClick={submitCreate} style={btnPrimary}>צור משימה</button>
              <button onClick={() => setShowCreate(false)} style={btnGhost}>ביטול</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ═══════════════ TASK SIDE WORKSPACE ═══════════════ */
function TaskWorkspace({ task, owner, employees, isClient, isManager, onClose, updateTask }: {
  task: any; owner?: Employee; employees: Employee[]; isClient: boolean; isManager: boolean; onClose: () => void; updateTask: (id: string, patch: any) => Promise<any>;
}) {
  const { displayName, role } = useAuth();
  const sc = STATUS_CONFIG[task.status] || STATUS_CONFIG.new;
  const pc = PRIORITY_CONFIG[task.priority] || PRIORITY_CONFIG.medium;
  const tc = TYPE_CONFIG[getType(task)];
  const prog = PROGRESS_BY_STATUS[task.status] || 0;
  const curStage = stageIndex(task);
  const od = isOverdue(task.dueDate, task.status);

  const thread = parseThread(task.notes || "");
  const visibleThread = isClient ? thread.filter((c) => c.audience === "client") : thread;
  const [text, setText] = useState("");
  const [audience, setAudience] = useState<"internal" | "client">(isClient ? "client" : "internal");
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const setStatus = async (status: string) => { setBusy(true); try { await updateTask(task.id, { status }); } finally { setBusy(false); } };

  const addComment = async () => {
    if (!text.trim()) return;
    setBusy(true);
    const c: Comment = { id: String(Date.now()), author: displayName || (isClient ? "לקוח" : "צוות"), role: role || "employee", audience: isClient ? "client" : audience, text: text.trim(), at: new Date().toISOString() };
    try { await updateTask(task.id, { notes: JSON.stringify({ thread: [...thread, c] }) }); setText(""); } finally { setBusy(false); }
  };

  const onUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return; setBusy(true);
    try {
      const r = await fetch("/api/upload", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ fileName: `tasks/${task.id}/${Date.now()}_${file.name}`, contentType: file.type, fileSize: file.size }) });
      const { uploadUrl, publicUrl } = await r.json();
      await fetch(uploadUrl, { method: "PUT", headers: { "Content-Type": file.type }, body: file });
      await updateTask(task.id, { files: [...(task.files || []), publicUrl] });
    } catch (err) { console.error(err); } finally { setBusy(false); if (fileRef.current) fileRef.current.value = ""; }
  };

  // AI assistant (deterministic PM guidance)
  const ai = (() => {
    const summary = task.description?.trim() ? task.description.slice(0, 160) : `${tc.label} עבור ${task.clientName || "הלקוח"}.`;
    let next = "להתחיל בעבודה ולשבץ אחראי.";
    if (task.status === "new") next = owner ? "האחראי יתחיל בעבודה ויעדכן ל'בעבודה'." : "לשבץ עובד אחראי ולהתחיל.";
    else if (task.status === "in_progress") next = "להשלים את העבודה ולהעביר לבדיקה פנימית.";
    else if (task.status === "under_review") next = "מנהל יאשר או יחזיר עם הערות.";
    else if (task.status === "returned") next = "לטפל בהערות ולהחזיר לבדיקה.";
    else if (task.status === "approved") next = "לשתף את הלקוח ולסמן כהושלם.";
    else if (task.status === "completed") next = "המשימה הושלמה — אין פעולה נדרשת.";
    const blockers: string[] = [];
    if (od) blockers.push("המשימה עברה את תאריך היעד");
    if (!owner) blockers.push("לא שובץ עובד אחראי");
    if (task.status === "returned") blockers.push("הוחזרה עם הערות לתיקון");
    return { summary, next, blockers };
  })();

  return (
    <div onClick={onClose} style={scrim}>
      <div onClick={(e) => e.stopPropagation()} style={{ position: "fixed", insetInlineStart: 0, top: 0, bottom: 0, width: "min(620px,96vw)", background: "var(--surface)", boxShadow: "8px 0 40px rgba(0,0,0,0.25)", overflowY: "auto", direction: "rtl", animation: "tw-slide 0.28s ease" }}>
        {/* Header */}
        <div style={{ padding: "1.2rem 1.4rem", borderBottom: "1px solid var(--border)", background: "var(--surface-raised)", position: "sticky", top: 0, zIndex: 2 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
            <div>
              <div style={{ display: "flex", gap: 6, marginBottom: 6 }}>
                <span style={{ fontSize: "0.66rem", fontWeight: 800, color: sc.color, background: sc.color + "1a", borderRadius: 999, padding: "2px 9px" }}>{sc.label}</span>
                <span style={{ fontSize: "0.66rem", fontWeight: 800, color: pc.color, background: pc.color + "1a", borderRadius: 999, padding: "2px 9px" }}>{pc.label}</span>
                <span style={{ fontSize: "0.66rem", fontWeight: 700, color: tc.color, background: tc.color + "1a", borderRadius: 999, padding: "2px 9px" }}>{tc.emoji} {tc.label}</span>
              </div>
              <div style={{ fontSize: "1.15rem", fontWeight: 900, color: "var(--foreground)" }}>{task.title}</div>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 8, fontSize: "0.78rem", color: "var(--foreground-muted)" }}>
                <span style={{ display: "flex", alignItems: "center", gap: 6 }}>{owner ? <><Avatar src={(owner as any).avatarUrl} name={owner.name} size={22} ring={false} />{owner.name}</> : "ללא אחראי"}</span>
                <span style={{ color: od ? "#ef4444" : "inherit", fontWeight: od ? 700 : 400 }}>📅 {ILDate(task.dueDate)}</span>
              </div>
            </div>
            <button onClick={onClose} style={{ background: "none", border: "none", fontSize: "1.4rem", cursor: "pointer", color: "var(--foreground-muted)", lineHeight: 1 }}>✕</button>
          </div>
          <div style={{ marginTop: 12, height: 7, background: "var(--surface)", borderRadius: 999, overflow: "hidden" }}>
            <div style={{ width: `${prog}%`, height: "100%", background: "linear-gradient(90deg,#00B5FE,#22c55e)", borderRadius: 999 }} />
          </div>
        </div>

        <div style={{ padding: "1.2rem 1.4rem", display: "flex", flexDirection: "column", gap: "1.3rem" }}>
          {/* AI assistant */}
          <Card title="🤖 עוזר AI לניהול המשימה" accent>
            <Row label="סיכום">{ai.summary}</Row>
            <Row label="הצעד הבא">{ai.next}</Row>
            {!isClient && ai.blockers.length > 0 && <Row label="חסמים"><span style={{ color: "#ef4444" }}>{ai.blockers.join(" · ")}</span></Row>}
          </Card>

          {/* Timeline */}
          <Card title="⏱️ מסלול המשימה">
            <div style={{ display: "flex", alignItems: "center", gap: 0 }}>
              {TIMELINE_STAGES.map((s, i) => (
                <div key={s.key} style={{ flex: 1, textAlign: "center", position: "relative" }}>
                  {i > 0 && <div style={{ position: "absolute", top: 11, insetInlineEnd: "50%", width: "100%", height: 2, background: i <= curStage ? "#22c55e" : "var(--border)" }} />}
                  <div style={{ position: "relative", zIndex: 1, width: 24, height: 24, borderRadius: "50%", margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.7rem", color: "#fff", background: i < curStage ? "#22c55e" : i === curStage ? "#00B5FE" : "var(--border)" }}>{i < curStage ? "✓" : i + 1}</div>
                  <div style={{ fontSize: "0.62rem", color: i <= curStage ? "var(--foreground)" : "var(--foreground-subtle)", marginTop: 4 }}>{s.label}</div>
                </div>
              ))}
            </div>
          </Card>

          {/* Description */}
          {task.description && (
            <Card title="📝 תיאור">
              <div style={{ fontSize: "0.85rem", color: "var(--foreground)", lineHeight: 1.7, whiteSpace: "pre-wrap" }}>{task.description}</div>
            </Card>
          )}

          {/* Approval center */}
          {!isClient && (
            <Card title="✅ מרכז אישורים">
              {task.status === "under_review" ? (
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {isManager && <button disabled={busy} onClick={() => setStatus("approved")} style={btnSuccess}>אשר</button>}
                  <button disabled={busy} onClick={() => setStatus("returned")} style={btnDanger}>החזר עם הערות</button>
                </div>
              ) : task.status === "approved" ? (
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                  <span style={{ fontSize: "0.82rem", color: "#22c55e", fontWeight: 700 }}>✓ אושר — מוכן ללקוח</span>
                  <button disabled={busy} onClick={() => setStatus("completed")} style={btnPrimary}>סמן כהושלם</button>
                </div>
              ) : task.status === "completed" ? (
                <span style={{ fontSize: "0.82rem", color: "#10b981", fontWeight: 700 }}>✓ המשימה הושלמה</span>
              ) : (
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {task.status !== "in_progress" && <button disabled={busy} onClick={() => setStatus("in_progress")} style={btnGhost}>התחל עבודה</button>}
                  <button disabled={busy} onClick={() => setStatus("under_review")} style={btnPrimary}>שלח לבדיקה</button>
                </div>
              )}
            </Card>
          )}

          {/* Files & deliverables */}
          <Card title="📎 קבצים ותוצרים" action={!isClient ? <button onClick={() => fileRef.current?.click()} style={btnGhostSm}>+ העלה</button> : undefined}>
            <input ref={fileRef} type="file" hidden onChange={onUpload} />
            {(task.files || []).length === 0 ? <Empty>אין קבצים עדיין</Empty> : (
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {(task.files || []).map((url: string, i: number) => {
                  const nm = decodeURIComponent(String(url).split("/").pop() || "קובץ").replace(/^\d+_/, "");
                  const isImg = /\.(png|jpe?g|gif|webp|svg)$/i.test(url);
                  return (
                    <a key={i} href={url} target="_blank" rel="noreferrer" style={{ display: "flex", alignItems: "center", gap: 10, padding: "0.5rem 0.6rem", border: "1px solid var(--border)", borderRadius: 10, textDecoration: "none", background: "var(--surface-raised)" }}>
                      {isImg ? <div style={{ width: 36, height: 36, borderRadius: 8, backgroundImage: `url(${url})`, backgroundSize: "cover", backgroundPosition: "center", flexShrink: 0 }} /> : <span style={{ fontSize: "1.2rem" }}>📄</span>}
                      <span style={{ fontSize: "0.8rem", color: "var(--foreground)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{nm}</span>
                    </a>
                  );
                })}
              </div>
            )}
          </Card>

          {/* Collaboration */}
          <Card title="💬 שיתוף פעולה">
            {visibleThread.length === 0 ? <Empty>אין עדיין הודעות</Empty> : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 12 }}>
                {visibleThread.map((c) => (
                  <div key={c.id} style={{ display: "flex", gap: 9 }}>
                    <Avatar name={c.author} size={28} ring={false} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <span style={{ fontSize: "0.78rem", fontWeight: 700, color: "var(--foreground)" }}>{c.author}</span>
                        {c.audience === "client" ? <span style={{ fontSize: "0.6rem", color: "#0ea5e9", background: "#e0f2fe", borderRadius: 999, padding: "1px 6px" }}>גלוי ללקוח</span> : <span style={{ fontSize: "0.6rem", color: "#64748b", background: "var(--surface)", borderRadius: 999, padding: "1px 6px" }}>פנימי</span>}
                        {c.at && <span style={{ fontSize: "0.64rem", color: "var(--foreground-subtle)" }}>{new Date(c.at).toLocaleString("he-IL", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</span>}
                      </div>
                      <div style={{ fontSize: "0.82rem", color: "var(--foreground)", lineHeight: 1.5, marginTop: 2 }}>{c.text}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
              <textarea value={text} onChange={(e) => setText(e.target.value)} placeholder={isClient ? "כתוב הודעה לצוות…" : "כתוב הודעה…"} rows={2} style={{ ...inp, marginBottom: 0, resize: "vertical", flex: 1 }} />
              <button disabled={busy || !text.trim()} onClick={addComment} style={btnPrimary}>שלח</button>
            </div>
            {!isClient && (
              <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
                {(["internal", "client"] as const).map((a) => (
                  <button key={a} onClick={() => setAudience(a)} style={{ fontSize: "0.68rem", fontWeight: 700, padding: "0.25rem 0.7rem", borderRadius: 999, cursor: "pointer", border: `1px solid ${audience === a ? "var(--accent)" : "var(--border)"}`, background: audience === a ? "var(--accent)" : "transparent", color: audience === a ? "#fff" : "var(--foreground-muted)" }}>{a === "internal" ? "פנימי" : "גלוי ללקוח"}</button>
                ))}
              </div>
            )}
          </Card>
        </div>
        <style>{`@keyframes tw-slide{from{transform:translateX(-100%)}to{transform:translateX(0)}}`}</style>
      </div>
    </div>
  );
}

/* ── small building blocks ── */
function Card({ title, children, action, accent }: { title: string; children: React.ReactNode; action?: React.ReactNode; accent?: boolean }) {
  return (
    <div style={{ border: "1px solid var(--border)", borderRadius: 14, padding: "1rem 1.1rem", background: accent ? "linear-gradient(135deg,#eef2ff,#ecfeff)" : "var(--surface-raised)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <span style={{ fontSize: "0.82rem", fontWeight: 800, color: "var(--foreground)" }}>{title}</span>
        {action}
      </div>
      {children}
    </div>
  );
}
function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", gap: 8, fontSize: "0.82rem", marginBottom: 6 }}>
      <span style={{ color: "var(--foreground-muted)", fontWeight: 700, minWidth: 70 }}>{label}:</span>
      <span style={{ color: "var(--foreground)", flex: 1 }}>{children}</span>
    </div>
  );
}
function Empty({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: "0.8rem", color: "var(--foreground-subtle)", padding: "0.3rem 0" }}>{children}</div>;
}

/* ── styles ── */
const inp: React.CSSProperties = { width: "100%", border: "1px solid var(--border)", borderRadius: 10, padding: "0.55rem 0.75rem", fontSize: "0.85rem", marginBottom: 10, fontFamily: "inherit", background: "var(--surface)", color: "var(--foreground)", boxSizing: "border-box" };
const btnPrimary: React.CSSProperties = { background: "var(--accent)", color: "#fff", border: "none", borderRadius: 10, padding: "0.5rem 1.1rem", fontWeight: 700, fontSize: "0.82rem", cursor: "pointer" };
const btnSuccess: React.CSSProperties = { background: "#22c55e", color: "#fff", border: "none", borderRadius: 10, padding: "0.5rem 1.1rem", fontWeight: 700, fontSize: "0.82rem", cursor: "pointer" };
const btnDanger: React.CSSProperties = { background: "#fef2f2", color: "#dc2626", border: "1px solid #fecaca", borderRadius: 10, padding: "0.5rem 1.1rem", fontWeight: 700, fontSize: "0.82rem", cursor: "pointer" };
const btnGhost: React.CSSProperties = { background: "transparent", color: "var(--foreground-muted)", border: "1px solid var(--border)", borderRadius: 10, padding: "0.5rem 1.1rem", fontWeight: 700, fontSize: "0.82rem", cursor: "pointer" };
const btnGhostSm: React.CSSProperties = { ...btnGhost, padding: "0.3rem 0.7rem", fontSize: "0.72rem" };
const scrim: React.CSSProperties = { position: "fixed", inset: 0, background: "rgba(15,23,42,0.45)", zIndex: 9000, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 };
