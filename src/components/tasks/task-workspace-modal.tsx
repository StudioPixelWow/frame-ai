"use client";

/**
 * Task Workspace Modal — premium, tabbed, role-based task workspace.
 * Used from the global task board (and re-usable elsewhere). Replaces the long
 * "edit form" with a structured workspace: fixed header + tabs
 * (Overview / Brief / Files / Activity / Comments / AI / Approval).
 * Role-based emphasis: manager (full command) · employee (execution) · client (approval).
 * Preserves the system's light/RTL/turquoise SaaS language.
 */
import { useMemo, useRef, useState } from "react";
import Avatar from "@/components/ui/avatar";

type Role = "admin" | "employee" | "client";

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
  under_review: { label: "מוכן לבדיקה", color: "#00B5FE" },
  returned: { label: "דרושים שינויים", color: "#f97316" },
  approved: { label: "אושר", color: "#22c55e" },
  completed: { label: "הושלם", color: "#10b981" },
};
const PRIORITY_CONFIG: Record<string, { label: string; color: string }> = {
  urgent: { label: "דחוף", color: "#ef4444" },
  high: { label: "גבוה", color: "#f97316" },
  medium: { label: "בינוני", color: "#3b82f6" },
  low: { label: "נמוך", color: "#9ca3af" },
};
const PROGRESS: Record<string, number> = { new: 10, returned: 35, in_progress: 55, under_review: 80, approved: 95, completed: 100 };
const STAGES = [
  { key: "draft", label: "טיוטה" },
  { key: "work", label: "עבודת עובד" },
  { key: "review", label: "בדיקה פנימית" },
  { key: "approved", label: "אישור מנהל" },
  { key: "completed", label: "הושלם" },
];
function stageIdx(t: any): number {
  if (t.status === "completed") return 4;
  if (t.status === "approved") return 3;
  if (t.status === "under_review") return 2;
  if (t.status === "in_progress" || t.status === "returned") return 1;
  return 0;
}
type Comment = { id: string; author: string; audience: "internal" | "client"; text: string; at: string };
function parseThread(notes: string): Comment[] {
  if (!notes) return [];
  try { const o = JSON.parse(notes); if (o && Array.isArray(o.thread)) return o.thread as Comment[]; } catch {}
  return notes.trim() ? [{ id: "legacy", author: "הערה פנימית", audience: "internal", text: notes, at: "" }] : [];
}
const baseNotes = (notes: string) => { try { const o = JSON.parse(notes); if (o && Array.isArray(o.thread)) return ""; } catch {} return notes || ""; };
const ILDate = (d?: string | null) => (d ? new Date(d).toLocaleDateString("he-IL", { day: "2-digit", month: "2-digit", year: "numeric" }) : "—");
const ILDateTime = (d?: string | null) => (d ? new Date(d).toLocaleString("he-IL", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "");
const isOverdue = (d?: string | null, status?: string) => !!(d && status !== "completed" && status !== "approved" && new Date(d) < new Date(new Date().toDateString()));
const getType = (t: any) => (t.tags || []).find((x: string) => Object.keys(TYPE_CONFIG).includes(x)) || "general";

interface Props {
  task: any;
  employees: any[];
  clients?: any[];
  role?: Role;
  displayName?: string;
  onClose: () => void;
  onUpdate: (id: string, patch: any) => Promise<any>;
  onDelete?: (id: string) => Promise<any> | void;
}

const TABS_ALL = ["overview", "brief", "files", "activity", "comments", "ai", "approval"] as const;
const TAB_LABEL: Record<string, string> = { overview: "📋 סקירה", brief: "📝 בריף", files: "📎 קבצים", activity: "🕒 פעילות", comments: "💬 תגובות", ai: "✨ AI", approval: "✅ אישור" };

export default function TaskWorkspaceModal({ task, employees, clients = [], role = "admin", displayName, onClose, onUpdate, onDelete }: Props) {
  const isClient = role === "client";
  const isEmployee = role === "employee";
  const isManager = role === "admin";

  const tabs = useMemo(() => {
    if (isClient) return ["overview", "files", "comments", "approval"];
    if (isEmployee) return ["overview", "brief", "files", "activity", "comments", "approval"];
    return [...TABS_ALL];
  }, [isClient, isEmployee]);
  const [tab, setTab] = useState<string>("overview");
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const sc = STATUS_CONFIG[task.status] || STATUS_CONFIG.new;
  const pc = PRIORITY_CONFIG[task.priority] || PRIORITY_CONFIG.medium;
  const tc = TYPE_CONFIG[getType(task)];
  const prog = PROGRESS[task.status] || 0;
  const owner = employees.find((e) => e.id === (task.assigneeIds || [])[0]);
  const client = clients.find((c) => c.id === task.clientId);
  const od = isOverdue(task.dueDate, task.status);
  const thread = parseThread(task.notes || "");
  const visibleThread = isClient ? thread.filter((c) => c.audience === "client") : thread;

  const setStatus = async (status: string) => { setBusy(true); try { await onUpdate(task.id, { status }); } finally { setBusy(false); } };

  // ── Brief edit (manager) ──
  const [brief, setBrief] = useState({ title: task.title || "", description: task.description || "", priority: task.priority || "medium", assignee: (task.assigneeIds || [])[0] || "", dueDate: task.dueDate ? String(task.dueDate).slice(0, 10) : "", type: getType(task) });
  const saveBrief = async () => {
    setBusy(true);
    try {
      const tags = [brief.type, ...((task.tags || []).filter((x: string) => !Object.keys(TYPE_CONFIG).includes(x)))];
      await onUpdate(task.id, { title: brief.title, description: brief.description, priority: brief.priority, assigneeIds: brief.assignee ? [brief.assignee] : [], dueDate: brief.dueDate || null, tags });
    } finally { setBusy(false); }
  };

  // ── Comments ──
  const [text, setText] = useState("");
  const [audience, setAudience] = useState<"internal" | "client">(isClient ? "client" : "internal");
  const addComment = async () => {
    if (!text.trim()) return; setBusy(true);
    const c: Comment = { id: String(Date.now()), author: displayName || (isClient ? "לקוח" : "צוות"), audience: isClient ? "client" : audience, text: text.trim(), at: new Date().toISOString() };
    try { await onUpdate(task.id, { notes: JSON.stringify({ base: baseNotes(task.notes || ""), thread: [...thread, c] }) }); setText(""); } finally { setBusy(false); }
  };

  // ── Files ──
  const onUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return; setBusy(true);
    try {
      const r = await fetch("/api/upload", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ fileName: `tasks/${task.id}/${Date.now()}_${file.name}`, contentType: file.type, fileSize: file.size }) });
      const { uploadUrl, publicUrl } = await r.json();
      await fetch(uploadUrl, { method: "PUT", headers: { "Content-Type": file.type }, body: file });
      await onUpdate(task.id, { files: [...(task.files || []), publicUrl] });
    } catch (err) { console.error(err); } finally { setBusy(false); if (fileRef.current) fileRef.current.value = ""; }
  };
  const removeFile = async (url: string) => { setBusy(true); try { await onUpdate(task.id, { files: (task.files || []).filter((f: string) => f !== url) }); } finally { setBusy(false); } };

  // ── Activity (derived + thread) ──
  const activity = useMemo(() => {
    const items: { icon: string; text: string; at: string }[] = [];
    if (task.createdAt) items.push({ icon: "✨", text: "המשימה נוצרה", at: task.createdAt });
    if (owner) items.push({ icon: "👤", text: `שובץ ${owner.name}`, at: task.createdAt || "" });
    thread.forEach((c) => items.push({ icon: c.audience === "client" ? "💬" : "🗒️", text: `${c.author}: ${c.text.slice(0, 60)}`, at: c.at }));
    (task.files || []).forEach(() => {});
    if (task.status === "under_review") items.push({ icon: "🔍", text: "נשלח לבדיקה", at: task.updatedAt || "" });
    if (task.status === "approved") items.push({ icon: "✅", text: "אושר", at: task.updatedAt || "" });
    if (task.status === "completed") items.push({ icon: "🏁", text: "הושלם", at: task.updatedAt || "" });
    return items.filter((x) => x.at).sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
  }, [task, owner, thread]);

  // ── AI assistant (deterministic PM) ──
  const ai = useMemo(() => {
    const summary = task.description?.trim() ? task.description.slice(0, 180) : `${tc.label} עבור ${task.clientName || "הלקוח"}.`;
    let next = "לשבץ אחראי ולהתחיל בעבודה.";
    if (task.status === "in_progress") next = "להשלים ולשלוח לבדיקה פנימית.";
    else if (task.status === "under_review") next = "מנהל יאשר או יבקש שינויים.";
    else if (task.status === "returned") next = "לטפל בהערות ולהחזיר לבדיקה.";
    else if (task.status === "approved") next = "לשתף עם הלקוח ולסמן כהושלם.";
    else if (task.status === "completed") next = "הושלם — אין פעולה נדרשת.";
    const clientMsg = `שלום${client?.name ? " " + client.name : ""}, "${task.title}" מוכן לאישורכם. נשמח למשוב 🙏`;
    const blockers: string[] = [];
    if (od) blockers.push("עבר את תאריך היעד");
    if (!owner) blockers.push("לא שובץ אחראי");
    if (task.status === "returned") blockers.push("הוחזר עם הערות");
    return { summary, next, clientMsg, blockers };
  }, [task, owner, client, od, tc]);

  return (
    <div onClick={onClose} style={scrim}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: "var(--surface)", borderRadius: 18, width: "min(820px,96vw)", maxHeight: "92vh", display: "flex", flexDirection: "column", direction: "rtl", overflow: "hidden", boxShadow: "0 30px 80px rgba(0,0,0,0.3)", animation: "twm-pop 0.28s cubic-bezier(.18,1.1,.4,1)" }}>
        {/* ── FIXED HEADER ── */}
        <div style={{ padding: "1.1rem 1.4rem", borderBottom: "1px solid var(--border)", background: "var(--surface-raised)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
            <div style={{ display: "flex", gap: 12, minWidth: 0 }}>
              {client?.logoUrl ? <div style={{ width: 44, height: 44, borderRadius: 12, backgroundImage: `url(${client.logoUrl})`, backgroundSize: "cover", backgroundPosition: "center", flexShrink: 0, border: "1px solid var(--border)" }} />
                : <div style={{ width: 44, height: 44, borderRadius: 12, background: tc.color + "1a", color: tc.color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.2rem", flexShrink: 0 }}>{tc.emoji}</div>}
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: "1.05rem", fontWeight: 900, color: "var(--foreground)" }}>{task.title}</div>
                <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8, marginTop: 5 }}>
                  <Badge color={sc.color}>{sc.label}</Badge>
                  <Badge color={pc.color}>{pc.label}</Badge>
                  <span style={{ fontSize: "0.74rem", color: "var(--foreground-muted)", display: "flex", alignItems: "center", gap: 5 }}>{owner ? <><Avatar src={owner.avatarUrl} name={owner.name} size={20} ring={false} />{owner.name}</> : "ללא אחראי"}</span>
                  <span style={{ fontSize: "0.74rem", color: od ? "#ef4444" : "var(--foreground-muted)", fontWeight: od ? 700 : 400 }}>📅 {ILDate(task.dueDate)}</span>
                  {task.clientName && <span style={{ fontSize: "0.74rem", color: "var(--foreground-muted)" }}>· {task.clientName}</span>}
                </div>
              </div>
            </div>
            <button onClick={onClose} style={{ background: "none", border: "none", fontSize: "1.3rem", cursor: "pointer", color: "var(--foreground-muted)", lineHeight: 1 }}>✕</button>
          </div>
          {/* progress + quick actions */}
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 12 }}>
            <div style={{ flex: 1, height: 7, background: "var(--surface)", borderRadius: 999, overflow: "hidden" }}>
              <div style={{ width: `${prog}%`, height: "100%", background: "linear-gradient(90deg,#00B5FE,#22c55e)", borderRadius: 999 }} />
            </div>
            <div style={{ display: "flex", gap: 7 }}>
              {isClient ? (
                task.status === "approved" || task.status === "under_review" ? <button disabled={busy} onClick={() => setStatus("completed")} style={btnSuccess}>אשר</button> : null
              ) : isEmployee ? (
                task.status === "in_progress" || task.status === "new" || task.status === "returned" ? <button disabled={busy} onClick={() => setStatus("under_review")} style={btnPrimary}>סמן מוכן לבדיקה</button> : null
              ) : (
                <>
                  {task.status === "under_review" && <button disabled={busy} onClick={() => setStatus("approved")} style={btnSuccess}>אשר</button>}
                  {task.status === "under_review" && <button disabled={busy} onClick={() => setStatus("returned")} style={btnWarn}>בקש שינויים</button>}
                  {task.status === "approved" && <button disabled={busy} onClick={() => setStatus("completed")} style={btnPrimary}>השלם</button>}
                  {(task.status === "new" || task.status === "in_progress") && <button disabled={busy} onClick={() => setStatus("under_review")} style={btnPrimary}>שלח לבדיקה</button>}
                </>
              )}
            </div>
          </div>
        </div>

        {/* ── TABS ── */}
        <div style={{ display: "flex", gap: 2, padding: "0 1.1rem", borderBottom: "1px solid var(--border)", background: "var(--surface-raised)", overflowX: "auto" }}>
          {tabs.map((t) => (
            <button key={t} onClick={() => setTab(t)} style={{ padding: "0.7rem 0.85rem", border: "none", background: "none", cursor: "pointer", fontSize: "0.8rem", fontWeight: tab === t ? 800 : 500, color: tab === t ? "var(--accent)" : "var(--foreground-muted)", borderBottom: `2px solid ${tab === t ? "var(--accent)" : "transparent"}`, whiteSpace: "nowrap" }}>{TAB_LABEL[t]}</button>
          ))}
        </div>

        {/* ── CONTENT ── */}
        <div style={{ padding: "1.2rem 1.4rem", overflowY: "auto", display: "flex", flexDirection: "column", gap: "1.1rem" }}>
          {tab === "overview" && (
            <>
              <Card title="🎯 סקירת המשימה">
                <div style={{ fontSize: "0.85rem", color: "var(--foreground)", lineHeight: 1.6 }}>{ai.summary}</div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))", gap: 10, marginTop: 12 }}>
                  <Mini label="סטטוס" value={sc.label} color={sc.color} />
                  <Mini label="עדיפות" value={pc.label} color={pc.color} />
                  <Mini label="דדליין" value={ILDate(task.dueDate)} color={od ? "#ef4444" : "var(--foreground)"} />
                  <Mini label="התקדמות" value={`${prog}%`} color="#00B5FE" />
                </div>
              </Card>
              <Card title="🧭 הצעד הבא"><div style={{ fontSize: "0.85rem", color: "var(--foreground)" }}>{ai.next}</div>{!isClient && ai.blockers.length > 0 && <div style={{ fontSize: "0.78rem", color: "#ef4444", marginTop: 6 }}>⛔ {ai.blockers.join(" · ")}</div>}</Card>
              {(task.files || []).length > 0 && <Card title="📎 קבצים אחרונים"><div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>{(task.files || []).slice(0, 4).map((u: string, i: number) => <FileThumb key={i} url={u} />)}</div></Card>}
            </>
          )}

          {tab === "brief" && (
            <Card title="📝 בריף">
              {isManager ? (
                <>
                  <Field label="כותרת"><input value={brief.title} onChange={(e) => setBrief({ ...brief, title: e.target.value })} style={inp} /></Field>
                  <Field label="תיאור / הנחיות"><textarea value={brief.description} onChange={(e) => setBrief({ ...brief, description: e.target.value })} rows={5} style={{ ...inp, resize: "vertical" }} /></Field>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                    <Field label="סוג"><select value={brief.type} onChange={(e) => setBrief({ ...brief, type: e.target.value })} style={inp}>{Object.entries(TYPE_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.emoji} {v.label}</option>)}</select></Field>
                    <Field label="עדיפות"><select value={brief.priority} onChange={(e) => setBrief({ ...brief, priority: e.target.value })} style={inp}>{Object.entries(PRIORITY_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</select></Field>
                    <Field label="אחראי"><select value={brief.assignee} onChange={(e) => setBrief({ ...brief, assignee: e.target.value })} style={inp}><option value="">ללא</option>{employees.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}</select></Field>
                    <Field label="דדליין"><input type="date" value={brief.dueDate} onChange={(e) => setBrief({ ...brief, dueDate: e.target.value })} style={inp} /></Field>
                  </div>
                  <button disabled={busy} onClick={saveBrief} style={btnPrimary}>שמור בריף</button>
                </>
              ) : (
                <div style={{ fontSize: "0.85rem", color: "var(--foreground)", lineHeight: 1.7, whiteSpace: "pre-wrap" }}>{task.description || "אין תיאור."}</div>
              )}
            </Card>
          )}

          {tab === "files" && (
            <Card title="📎 קבצים ותוצרים" action={!isClient ? <button onClick={() => fileRef.current?.click()} style={btnGhostSm}>+ העלה</button> : undefined}>
              <input ref={fileRef} type="file" hidden onChange={onUpload} />
              {(task.files || []).length === 0 ? <Empty>אין קבצים</Empty> : (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(150px,1fr))", gap: 10 }}>
                  {(task.files || []).map((u: string, i: number) => (
                    <div key={i} style={{ border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden", background: "var(--surface-raised)" }}>
                      <FileThumb url={u} big />
                      <div style={{ padding: "0.5rem 0.6rem", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 6 }}>
                        <a href={u} target="_blank" rel="noreferrer" style={{ fontSize: "0.7rem", color: "var(--accent)", textDecoration: "none", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>הורד</a>
                        {!isClient && <button onClick={() => removeFile(u)} style={{ background: "none", border: "none", cursor: "pointer", color: "#ef4444", fontSize: "0.72rem" }}>מחק</button>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          )}

          {tab === "activity" && (
            <Card title="🕒 ציר פעילות">
              {activity.length === 0 ? <Empty>אין פעילות</Empty> : (
                <div style={{ display: "flex", flexDirection: "column" }}>
                  {activity.map((a, i) => (
                    <div key={i} style={{ display: "flex", gap: 10, padding: "0.5rem 0", borderBottom: "1px solid var(--border)" }}>
                      <span>{a.icon}</span>
                      <div style={{ flex: 1 }}><div style={{ fontSize: "0.8rem", color: "var(--foreground)" }}>{a.text}</div><div style={{ fontSize: "0.66rem", color: "var(--foreground-subtle)" }}>{ILDateTime(a.at)}</div></div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          )}

          {tab === "comments" && (
            <Card title="💬 תגובות">
              {visibleThread.length === 0 ? <Empty>אין תגובות</Empty> : (
                <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 12 }}>
                  {visibleThread.map((c) => (
                    <div key={c.id} style={{ display: "flex", gap: 9 }}>
                      <Avatar name={c.author} size={28} ring={false} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <span style={{ fontSize: "0.78rem", fontWeight: 700 }}>{c.author}</span>
                          {c.audience === "client" ? <Badge color="#0ea5e9">גלוי ללקוח</Badge> : <Badge color="#64748b">פנימי</Badge>}
                          {c.at && <span style={{ fontSize: "0.64rem", color: "var(--foreground-subtle)" }}>{ILDateTime(c.at)}</span>}
                        </div>
                        <div style={{ fontSize: "0.82rem", color: "var(--foreground)", marginTop: 2 }}>{c.text}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
                <textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="כתוב תגובה…" rows={2} style={{ ...inp, marginBottom: 0, resize: "vertical", flex: 1 }} />
                <button disabled={busy || !text.trim()} onClick={addComment} style={btnPrimary}>שלח</button>
              </div>
              {!isClient && (
                <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
                  {(["internal", "client"] as const).map((a) => <button key={a} onClick={() => setAudience(a)} style={{ fontSize: "0.68rem", fontWeight: 700, padding: "0.25rem 0.7rem", borderRadius: 999, cursor: "pointer", border: `1px solid ${audience === a ? "var(--accent)" : "var(--border)"}`, background: audience === a ? "var(--accent)" : "transparent", color: audience === a ? "#fff" : "var(--foreground-muted)" }}>{a === "internal" ? "פנימי" : "גלוי ללקוח"}</button>)}
                </div>
              )}
            </Card>
          )}

          {tab === "ai" && !isClient && (
            <Card title="✨ Pixel AI — עוזר ניהול" accent>
              <Row label="סיכום בריף">{ai.summary}</Row>
              <Row label="צעד מומלץ">{ai.next}</Row>
              <Row label="הודעת אישור ללקוח">{ai.clientMsg}</Row>
              <button onClick={() => { try { navigator.clipboard?.writeText(ai.clientMsg); } catch {} }} style={{ ...btnGhostSm, marginTop: 8 }}>העתק הודעה ללקוח</button>
            </Card>
          )}

          {tab === "approval" && (
            <Card title="✅ מסלול אישור">
              <div style={{ display: "flex", alignItems: "center", marginBottom: 16 }}>
                {STAGES.map((s, i) => {
                  const cur = stageIdx(task);
                  return (
                    <div key={s.key} style={{ flex: 1, textAlign: "center", position: "relative" }}>
                      {i > 0 && <div style={{ position: "absolute", top: 12, insetInlineEnd: "50%", width: "100%", height: 2, background: i <= cur ? "#22c55e" : "var(--border)" }} />}
                      <div style={{ position: "relative", zIndex: 1, width: 26, height: 26, borderRadius: "50%", margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.72rem", color: "#fff", background: i < cur ? "#22c55e" : i === cur ? "#00B5FE" : "var(--border)" }}>{i < cur ? "✓" : i + 1}</div>
                      <div style={{ fontSize: "0.62rem", color: i <= cur ? "var(--foreground)" : "var(--foreground-subtle)", marginTop: 5 }}>{s.label}</div>
                    </div>
                  );
                })}
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {isClient ? (
                  <>
                    <button disabled={busy} onClick={() => setStatus("completed")} style={btnSuccess}>אשר</button>
                    <button disabled={busy} onClick={() => setStatus("returned")} style={btnWarn}>בקש שינויים</button>
                  </>
                ) : isEmployee ? (
                  <button disabled={busy} onClick={() => setStatus("under_review")} style={btnPrimary}>סמן מוכן לבדיקה</button>
                ) : (
                  <>
                    {task.status === "under_review" && <button disabled={busy} onClick={() => setStatus("approved")} style={btnSuccess}>אשר פנימית</button>}
                    {task.status === "under_review" && <button disabled={busy} onClick={() => setStatus("returned")} style={btnWarn}>בקש שינויים</button>}
                    {task.status === "approved" && <button disabled={busy} onClick={() => setStatus("completed")} style={btnPrimary}>השלם משימה</button>}
                    {(task.status === "new" || task.status === "in_progress" || task.status === "returned") && <button disabled={busy} onClick={() => setStatus("under_review")} style={btnPrimary}>שלח לבדיקה</button>}
                  </>
                )}
              </div>
            </Card>
          )}

          {/* danger zone — manager only, separated */}
          {isManager && onDelete && (
            <div style={{ marginTop: 6, paddingTop: 12, borderTop: "1px dashed var(--border)" }}>
              <button onClick={async () => { if (confirm("למחוק את המשימה?")) { await onDelete(task.id); onClose(); } }} style={btnDanger}>מחק משימה</button>
            </div>
          )}
        </div>
        <style>{`@keyframes twm-pop{from{opacity:0;transform:scale(.95)}to{opacity:1;transform:scale(1)}}`}</style>
      </div>
    </div>
  );
}

/* ── building blocks ── */
function Card({ title, children, action, accent }: { title: string; children: React.ReactNode; action?: React.ReactNode; accent?: boolean }) {
  return (
    <div style={{ border: "1px solid var(--border)", borderRadius: 14, padding: "1rem 1.1rem", background: accent ? "linear-gradient(135deg,#eef2ff,#ecfeff)" : "var(--surface-raised)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <span style={{ fontSize: "0.82rem", fontWeight: 800, color: "var(--foreground)" }}>{title}</span>{action}
      </div>
      {children}
    </div>
  );
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div style={{ marginBottom: 10 }}><div style={{ fontSize: "0.72rem", fontWeight: 700, color: "var(--foreground-muted)", marginBottom: 4 }}>{label}</div>{children}</div>;
}
function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return <div style={{ display: "flex", gap: 8, fontSize: "0.82rem", marginBottom: 6 }}><span style={{ color: "var(--foreground-muted)", fontWeight: 700, minWidth: 110 }}>{label}:</span><span style={{ color: "var(--foreground)", flex: 1 }}>{children}</span></div>;
}
function Mini({ label, value, color }: { label: string; value: string; color: string }) {
  return <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, padding: "0.55rem 0.7rem" }}><div style={{ fontSize: "0.66rem", color: "var(--foreground-muted)" }}>{label}</div><div style={{ fontSize: "0.92rem", fontWeight: 800, color }}>{value}</div></div>;
}
function Badge({ color, children }: { color: string; children: React.ReactNode }) {
  return <span style={{ fontSize: "0.64rem", fontWeight: 800, color, background: color + "1a", borderRadius: 999, padding: "2px 9px", whiteSpace: "nowrap" }}>{children}</span>;
}
function Empty({ children }: { children: React.ReactNode }) { return <div style={{ fontSize: "0.8rem", color: "var(--foreground-subtle)", padding: "0.3rem 0" }}>{children}</div>; }
function FileThumb({ url, big }: { url: string; big?: boolean }) {
  const isImg = /\.(png|jpe?g|gif|webp|svg)$/i.test(url);
  const h = big ? 96 : 56;
  return isImg
    ? <div style={{ width: big ? "100%" : 56, height: h, borderRadius: big ? 0 : 8, backgroundImage: `url(${url})`, backgroundSize: "cover", backgroundPosition: "center" }} />
    : <div style={{ width: big ? "100%" : 56, height: h, background: "var(--surface)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.4rem" }}>📄</div>;
}

/* ── styles ── */
const inp: React.CSSProperties = { width: "100%", border: "1px solid var(--border)", borderRadius: 10, padding: "0.55rem 0.75rem", fontSize: "0.85rem", fontFamily: "inherit", background: "var(--surface)", color: "var(--foreground)", boxSizing: "border-box" };
const btnPrimary: React.CSSProperties = { background: "var(--accent)", color: "#fff", border: "none", borderRadius: 10, padding: "0.5rem 1.1rem", fontWeight: 700, fontSize: "0.8rem", cursor: "pointer" };
const btnSuccess: React.CSSProperties = { ...btnPrimary, background: "#22c55e" };
const btnWarn: React.CSSProperties = { background: "#fff7ed", color: "#c2410c", border: "1px solid #fed7aa", borderRadius: 10, padding: "0.5rem 1.1rem", fontWeight: 700, fontSize: "0.8rem", cursor: "pointer" };
const btnGhostSm: React.CSSProperties = { background: "transparent", color: "var(--foreground-muted)", border: "1px solid var(--border)", borderRadius: 10, padding: "0.3rem 0.7rem", fontWeight: 700, fontSize: "0.72rem", cursor: "pointer" };
const btnDanger: React.CSSProperties = { background: "#fef2f2", color: "#dc2626", border: "1px solid #fecaca", borderRadius: 10, padding: "0.5rem 1.1rem", fontWeight: 700, fontSize: "0.8rem", cursor: "pointer" };
const scrim: React.CSSProperties = { position: "fixed", inset: 0, background: "rgba(15,23,42,0.5)", zIndex: 9000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 };
