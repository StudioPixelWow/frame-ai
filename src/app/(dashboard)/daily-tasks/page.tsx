"use client";

export const dynamic = "force-dynamic";

import { useState, useMemo, useCallback, useEffect } from "react";
import { useClients, useClientGanttItems, useEmployees } from "@/lib/api/use-entity";
import { useAuth } from "@/lib/auth/auth-context";
import { useToast } from "@/components/ui/toast";
import { Modal } from "@/components/ui/modal";
import Avatar from "@/components/ui/avatar";
import type { Client, ClientGanttItem, GanttItemStatus, ContentPlatform, ContentFormat } from "@/lib/db/schema";

/* ─────────────────────────────────────────────────────────────────────────────
   Constants
───────────────────────────────────────────────────────────────────────────── */

const STATUS_COLORS: Record<GanttItemStatus, string> = {
  new_idea: "#8b5cf6",
  draft: "#6b7280",
  planned: "#3b82f6",
  in_progress: "#fbbf24",
  submitted_for_approval: "#a78bfa",
  returned_for_changes: "#f97316",
  approved: "#22c55e",
  scheduled: "#06b6d4",
  published: "#10b981",
  cancelled: "#ef4444",
  missed: "#dc2626",
};

const STATUS_LABELS: Record<GanttItemStatus, string> = {
  new_idea: "רעיון חדש",
  draft: "טיוטה",
  planned: "מתוכנן",
  in_progress: "בעבודה",
  submitted_for_approval: "ממתין לאישור",
  returned_for_changes: "הוחזר לתיקון",
  approved: "מאושר",
  scheduled: "מתוזמן",
  published: "פורסם",
  cancelled: "בוטל",
  missed: "הוחמץ",
};

const PLATFORM_ICONS: Record<ContentPlatform, string> = {
  facebook: "📘",
  instagram: "📸",
  tiktok: "🎵",
  all: "🌐",
};

const PLATFORM_LABELS: Record<ContentPlatform, string> = {
  facebook: "פייסבוק",
  instagram: "אינסטגרם",
  tiktok: "טיקטוק",
  all: "כל הפלטפורמות",
};

const FORMAT_LABELS: Record<ContentFormat, string> = {
  image: "תמונה",
  video: "סרטון",
  story: "סטורי",
  reel: "ריל",
  carousel: "קרוסלה",
  live: "לייב",
  text: "טקסט",
};

const DAY_NAMES_HE = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"];

type FilterMode = "all" | "with_tasks" | "without_tasks";

interface TaskFormState {
  title: string;
  ideaSummary: string;
  caption: string;
  graphicText: string;
  visualConcept: string;
  platform: ContentPlatform;
  format: ContentFormat;
}

const EMPTY_FORM: TaskFormState = {
  title: "",
  ideaSummary: "",
  caption: "",
  graphicText: "",
  visualConcept: "",
  platform: "facebook",
  format: "image",
};

/* ─────────────────────────────────────────────────────────────────────────────
   Page Component
───────────────────────────────────────────────────────────────────────────── */

export default function DailyTasksPage() {
  const { role } = useAuth();
  const toast = useToast();

  const { data: clients, loading: clientsLoading } = useClients();
  const { data: ganttItems, loading: ganttLoading, refetch: refetchGantt, update: updateGanttItem, create: createGanttItem } = useClientGanttItems();
  const { data: employees } = useEmployees();

  const [filter, setFilter] = useState<FilterMode>("all");
  const [viewModal, setViewModal] = useState<ClientGanttItem | null>(null);
  const [editModal, setEditModal] = useState<{ item: ClientGanttItem | null; clientId: string } | null>(null);
  const [createModal, setCreateModal] = useState<string | null>(null);
  const [form, setForm] = useState<TaskFormState>(EMPTY_FORM);
  const [regeneratingIds, setRegeneratingIds] = useState<Set<string>>(new Set());
  const [generatingClientIds, setGeneratingClientIds] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [assigningIds, setAssigningIds] = useState<Set<string>>(new Set());

  /* ── Date computations ── */
  const todayStr = useMemo(() => {
    const now = new Date();
    const jDate = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Jerusalem" }));
    const y = jDate.getFullYear();
    const m = String(jDate.getMonth() + 1).padStart(2, "0");
    const d = String(jDate.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }, []);

  const todayDisplay = useMemo(() => {
    const date = new Date(todayStr + "T12:00:00");
    const dayName = DAY_NAMES_HE[date.getDay()];
    const formatted = date.toLocaleDateString("he-IL", { year: "numeric", month: "long", day: "numeric", timeZone: "Asia/Jerusalem" });
    return `יום ${dayName}, ${formatted}`;
  }, [todayStr]);

  /* ── Filtered data ── */
  const marketingClients = useMemo(() => {
    return clients.filter((c: Client) => c.clientType === "marketing" && c.status === "active");
  }, [clients]);

  const todayItemsByClient = useMemo(() => {
    const map = new Map<string, ClientGanttItem[]>();
    for (const item of ganttItems) {
      if (item.date?.startsWith(todayStr)) {
        const arr = map.get(item.clientId) || [];
        arr.push(item);
        map.set(item.clientId, arr);
      }
    }
    return map;
  }, [ganttItems, todayStr]);

  const sortedClients = useMemo(() => {
    const filtered = marketingClients.filter((c: Client) => {
      const hasTasks = (todayItemsByClient.get(c.id)?.length || 0) > 0;
      if (filter === "with_tasks") return hasTasks;
      if (filter === "without_tasks") return !hasTasks;
      return true;
    });
    return filtered.sort((a: Client, b: Client) => {
      const aHas = (todayItemsByClient.get(a.id)?.length || 0) > 0 ? 0 : 1;
      const bHas = (todayItemsByClient.get(b.id)?.length || 0) > 0 ? 0 : 1;
      if (aHas !== bHas) return aHas - bHas;
      return (a.name || "").localeCompare(b.name || "", "he");
    });
  }, [marketingClients, todayItemsByClient, filter]);

  const totalTasks = useMemo(() => {
    let count = 0;
    for (const client of marketingClients) {
      count += todayItemsByClient.get(client.id)?.length || 0;
    }
    return count;
  }, [marketingClients, todayItemsByClient]);

  /* ── Employee lookup ── */
  const employeeMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const emp of employees) {
      map.set(emp.id, emp.name);
    }
    return map;
  }, [employees]);

  /* ── Keyboard: Escape closes modals ── */
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setViewModal(null);
        setEditModal(null);
        setCreateModal(null);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  /* ── Handlers ── */
  const handleRegenerate = useCallback(async (item: ClientGanttItem) => {
    setRegeneratingIds((prev) => new Set(prev).add(item.id));
    try {
      const res = await fetch("/api/daily-tasks/regenerate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ganttItemId: item.id, clientId: item.clientId }),
      });
      if (!res.ok) throw new Error("Regeneration failed");
      const data = await res.json();
      if (data.updatedItem) {
        await updateGanttItem(item.id, data.updatedItem);
      }
      await refetchGantt();
      toast("המשימה עודכנה בהצלחה", "success");
    } catch {
      toast("שגיאה ביצירת המשימה מחדש", "error");
    } finally {
      setRegeneratingIds((prev) => {
        const next = new Set(prev);
        next.delete(item.id);
        return next;
      });
    }
  }, [updateGanttItem, refetchGantt, toast]);

  const handleGenerateForClient = useCallback(async (clientId: string) => {
    setGeneratingClientIds((prev) => new Set(prev).add(clientId));
    try {
      const res = await fetch("/api/daily-tasks/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId, date: todayStr }),
      });
      if (!res.ok) throw new Error("Generation failed");
      await refetchGantt();
      toast("המשימה נוצרה בהצלחה", "success");
    } catch {
      toast("שגיאה ביצירת משימה", "error");
    } finally {
      setGeneratingClientIds((prev) => {
        const next = new Set(prev);
        next.delete(clientId);
        return next;
      });
    }
  }, [todayStr, refetchGantt, toast]);

  const openEditModal = useCallback((item: ClientGanttItem) => {
    setForm({
      title: item.title || "",
      ideaSummary: item.ideaSummary || "",
      caption: item.caption || "",
      graphicText: item.graphicText || "",
      visualConcept: item.visualConcept || "",
      platform: item.platform || "facebook",
      format: item.format || "image",
    });
    setEditModal({ item, clientId: item.clientId });
  }, []);

  const openCreateModal = useCallback((clientId: string) => {
    setForm(EMPTY_FORM);
    setCreateModal(clientId);
  }, []);

  const handleSaveEdit = useCallback(async () => {
    if (!editModal?.item) return;
    setSaving(true);
    try {
      await updateGanttItem(editModal.item.id, {
        title: form.title,
        ideaSummary: form.ideaSummary,
        caption: form.caption,
        graphicText: form.graphicText,
        visualConcept: form.visualConcept,
        platform: form.platform,
        format: form.format,
      });
      toast("המשימה עודכנה בהצלחה", "success");
      setEditModal(null);
    } catch {
      toast("שגיאה בעדכון המשימה", "error");
    } finally {
      setSaving(false);
    }
  }, [editModal, form, updateGanttItem, toast]);

  const handleSaveCreate = useCallback(async () => {
    if (!createModal) return;
    if (!form.title.trim()) {
      toast("נא להזין כותרת למשימה", "error");
      return;
    }
    setSaving(true);
    try {
      await createGanttItem({
        clientId: createModal,
        date: todayStr,
        title: form.title,
        ideaSummary: form.ideaSummary,
        caption: form.caption,
        graphicText: form.graphicText,
        visualConcept: form.visualConcept,
        platform: form.platform,
        format: form.format,
        status: "planned" as GanttItemStatus,
        ganttType: "monthly",
      });
      toast("המשימה נוצרה בהצלחה", "success");
      setCreateModal(null);
    } catch {
      toast("שגיאה ביצירת המשימה", "error");
    } finally {
      setSaving(false);
    }
  }, [createModal, form, todayStr, createGanttItem, toast]);

  const handleAssignEmployee = useCallback(async (taskId: string, employeeId: string | null) => {
    setAssigningIds((prev) => new Set(prev).add(taskId));
    try {
      await updateGanttItem(taskId, { assigneeId: employeeId });
      toast(employeeId ? "העובד שויך למשימה בהצלחה" : "השיוך הוסר מהמשימה", "success");
    } catch {
      toast("שגיאה בשיוך עובד למשימה", "error");
    } finally {
      setAssigningIds((prev) => {
        const next = new Set(prev);
        next.delete(taskId);
        return next;
      });
    }
  }, [updateGanttItem, toast]);

  const handleRefresh = useCallback(async () => {
    await refetchGantt();
    toast("הנתונים עודכנו", "info");
  }, [refetchGantt, toast]);

  /* ── Auth guard ── */
  if (role !== "admin") {
    return (
      <main dir="rtl" style={{ maxWidth: 1400, margin: "0 auto", padding: "2rem 1.5rem" }}>
        <div style={{
          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
          minHeight: "60vh", gap: "1rem", color: "var(--foreground-muted)", textAlign: "center",
        }}>
          <div style={{ fontSize: "3rem", opacity: 0.5 }}>🔒</div>
          <h2 style={{ fontSize: "1.25rem", fontWeight: 600, color: "var(--foreground)" }}>אין לך הרשאה לצפות בדף זה</h2>
          <p style={{ fontSize: "0.875rem", color: "var(--foreground-muted)" }}>דף זה זמין למנהלי מערכת בלבד</p>
        </div>
      </main>
    );
  }

  /* ── Loading state ── */
  const isLoading = clientsLoading || ganttLoading;

  if (isLoading) {
    return (
      <main dir="rtl" style={{ maxWidth: 1400, margin: "0 auto", padding: "2rem 1.5rem" }}>
        <div style={{
          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
          minHeight: "60vh", gap: "1rem",
        }}>
          <div style={{
            width: 40, height: 40, border: "3px solid var(--border)",
            borderTopColor: "var(--accent)", borderRadius: "50%",
            animation: "spin 0.8s linear infinite",
          }} />
          <p style={{ color: "var(--foreground-muted)", fontSize: "0.875rem" }}>טוען משימות...</p>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      </main>
    );
  }

  /* ── Main render ── */
  return (
    <main dir="rtl" style={{ maxWidth: 1400, margin: "0 auto", padding: "2rem 1.5rem" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>

        {/* ── Header ── */}
        <div className="ux-hero-enter" style={{
          display: "flex", flexDirection: "column", gap: "1rem",
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "1rem" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
              <h1 className="mod-page-title" style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <span style={{ fontSize: "1.6rem" }}>📋</span>
                ניהול משימות היום
              </h1>
              <p style={{ fontSize: "0.9rem", color: "var(--foreground-muted)", fontWeight: 500 }}>
                {todayDisplay}
              </p>
              <p style={{ fontSize: "0.8rem", color: "var(--foreground-muted)" }}>
                <span style={{ fontWeight: 600, color: "var(--accent)" }}>{marketingClients.length}</span>
                {" "}לקוחות פרסום{" · "}
                <span style={{ fontWeight: 600, color: "var(--accent)" }}>{totalTasks}</span>
                {" "}משימות להיום
              </p>
            </div>
            <button
              className="mod-btn-ghost ux-btn"
              onClick={handleRefresh}
              style={{ display: "flex", alignItems: "center", gap: "0.4rem", padding: "0.45rem 1rem" }}
            >
              <span style={{ fontSize: "1rem" }}>🔄</span>
              רענון
            </button>
          </div>

          {/* ── Filter buttons ── */}
          <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
            {([
              { key: "all" as FilterMode, label: "הכל" },
              { key: "with_tasks" as FilterMode, label: "עם משימות" },
              { key: "without_tasks" as FilterMode, label: "ללא משימות" },
            ]).map((f) => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className="ux-btn"
                style={{
                  padding: "0.4rem 1rem",
                  borderRadius: "9999px",
                  border: filter === f.key ? "1.5px solid var(--accent)" : "1px solid var(--border)",
                  background: filter === f.key ? "rgba(0, 181, 254, 0.1)" : "var(--surface)",
                  color: filter === f.key ? "var(--accent)" : "var(--foreground-muted)",
                  fontSize: "0.8125rem",
                  fontWeight: filter === f.key ? 600 : 400,
                  cursor: "pointer",
                  transition: "all 150ms ease",
                }}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* ── Empty state ── */}
        {sortedClients.length === 0 && (
          <div className="mod-empty">
            <div className="mod-empty-icon">📭</div>
            <div style={{ color: "var(--foreground-muted)", fontSize: "0.9rem" }}>
              {filter === "with_tasks" ? "אין לקוחות עם משימות להיום" :
               filter === "without_tasks" ? "כל הלקוחות עם משימות להיום" :
               "אין לקוחות פרסום פעילים"}
            </div>
          </div>
        )}

        {/* ── Client cards grid ── */}
        <div
          className="ux-stagger"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(380px, 1fr))",
            gap: "1.25rem",
          }}
        >
          {sortedClients.map((client: Client) => {
            const clientTasks = todayItemsByClient.get(client.id) || [];
            const hasTasks = clientTasks.length > 0;
            const isGenerating = generatingClientIds.has(client.id);

            return (
              <div
                key={client.id}
                className="agd-card ux-card ux-light-sweep"
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "1rem",
                  borderRadius: "1rem",
                  padding: "1.25rem",
                  background: "var(--surface)",
                  border: "1px solid var(--border)",
                  transition: "all 200ms ease",
                }}
              >
                {/* ── Client header ── */}
                <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                  <Avatar
                    src={client.logoUrl}
                    name={client.name}
                    size={42}
                    style={{
                      border: `2px solid ${client.color || "var(--accent)"}`,
                      boxShadow: `0 0 12px ${client.color || "var(--accent)"}33`,
                    }}
                  />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                      <h3 style={{
                        fontSize: "0.95rem", fontWeight: 700, color: "var(--foreground)",
                        margin: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                      }}>
                        {client.name}
                      </h3>
                      <span style={{
                        width: 8, height: 8, borderRadius: "50%", flexShrink: 0,
                        background: hasTasks ? "#22c55e" : "#f59e0b",
                        boxShadow: hasTasks ? "0 0 8px rgba(34, 197, 94, 0.5)" : "0 0 8px rgba(245, 158, 11, 0.4)",
                      }} />
                    </div>
                    {client.businessField && (
                      <p style={{ fontSize: "0.75rem", color: "var(--foreground-muted)", margin: 0, marginTop: "0.15rem" }}>
                        {client.businessField}
                      </p>
                    )}
                  </div>
                  <span style={{
                    fontSize: "0.7rem", fontWeight: 600, color: hasTasks ? "#22c55e" : "#f59e0b",
                    background: hasTasks ? "rgba(34, 197, 94, 0.1)" : "rgba(245, 158, 11, 0.1)",
                    padding: "0.2rem 0.6rem", borderRadius: "9999px",
                    border: `1px solid ${hasTasks ? "rgba(34, 197, 94, 0.25)" : "rgba(245, 158, 11, 0.25)"}`,
                  }}>
                    {hasTasks ? `${clientTasks.length} משימות` : "ללא משימות"}
                  </span>
                </div>

                {/* ── Tasks list ── */}
                {hasTasks ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                    {clientTasks.map((task) => {
                      const isRegenerating = regeneratingIds.has(task.id);
                      return (
                        <div
                          key={task.id}
                          style={{
                            background: "var(--surface-raised)",
                            borderRadius: "0.75rem",
                            padding: "1rem",
                            border: "1px solid var(--border)",
                            display: "flex",
                            flexDirection: "column",
                            gap: "0.6rem",
                            transition: "border-color 150ms ease",
                          }}
                        >
                          {/* Task header */}
                          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "0.5rem" }}>
                            <h4 style={{
                              fontSize: "0.85rem", fontWeight: 600, color: "var(--foreground)", margin: 0,
                              lineHeight: 1.4, flex: 1,
                            }}>
                              {task.title || "ללא כותרת"}
                            </h4>
                          </div>

                          {/* Platform, format, status badges */}
                          <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", flexWrap: "wrap" }}>
                            {task.platform && (
                              <span style={{
                                fontSize: "0.7rem", padding: "0.15rem 0.5rem", borderRadius: "9999px",
                                background: "rgba(0, 181, 254, 0.08)", color: "var(--accent)",
                                border: "1px solid rgba(0, 181, 254, 0.2)",
                                display: "flex", alignItems: "center", gap: "0.25rem",
                              }}>
                                <span>{PLATFORM_ICONS[task.platform]}</span>
                                {PLATFORM_LABELS[task.platform]}
                              </span>
                            )}
                            {task.format && (
                              <span style={{
                                fontSize: "0.7rem", padding: "0.15rem 0.5rem", borderRadius: "9999px",
                                background: "rgba(139, 92, 246, 0.08)", color: "#a78bfa",
                                border: "1px solid rgba(139, 92, 246, 0.2)",
                              }}>
                                {FORMAT_LABELS[task.format] || task.format}
                              </span>
                            )}
                            {task.status && (
                              <span style={{
                                fontSize: "0.7rem", padding: "0.15rem 0.5rem", borderRadius: "9999px",
                                background: `${STATUS_COLORS[task.status]}15`,
                                color: STATUS_COLORS[task.status],
                                border: `1px solid ${STATUS_COLORS[task.status]}30`,
                                fontWeight: 600,
                              }}>
                                {STATUS_LABELS[task.status]}
                              </span>
                            )}
                          </div>

                          {/* Employee assignment */}
                          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                            <span style={{ fontSize: "0.75rem", color: "var(--foreground-muted)", fontWeight: 500, whiteSpace: "nowrap" }}>
                              👤 עובד משויך:
                            </span>
                            <select
                              value={task.assigneeId || ""}
                              disabled={assigningIds.has(task.id)}
                              onChange={(e) => handleAssignEmployee(task.id, e.target.value || null)}
                              style={{
                                flex: 1,
                                fontSize: "0.75rem",
                                padding: "0.25rem 0.5rem",
                                borderRadius: "0.5rem",
                                border: "1px solid var(--border)",
                                background: "var(--surface)",
                                color: task.assigneeId ? "var(--foreground)" : "var(--foreground-muted)",
                                cursor: assigningIds.has(task.id) ? "not-allowed" : "pointer",
                                opacity: assigningIds.has(task.id) ? 0.6 : 1,
                                outline: "none",
                                direction: "rtl",
                                transition: "border-color 150ms ease",
                                maxWidth: "200px",
                              }}
                            >
                              <option value="">ללא שיוך</option>
                              {employees.map((emp: any) => (
                                <option key={emp.id} value={emp.id}>{emp.name}</option>
                              ))}
                            </select>
                            {assigningIds.has(task.id) && (
                              <span style={{
                                display: "inline-block", width: 14, height: 14,
                                border: "2px solid var(--accent)", borderTopColor: "transparent",
                                borderRadius: "50%", animation: "spin 0.8s linear infinite",
                              }} />
                            )}
                          </div>

                          {/* Content preview */}
                          {task.ideaSummary && (
                            <p style={{
                              fontSize: "0.78rem", color: "var(--foreground-muted)", margin: 0,
                              lineHeight: 1.5, display: "-webkit-box", WebkitLineClamp: 2,
                              WebkitBoxOrient: "vertical", overflow: "hidden",
                            }}>
                              {task.ideaSummary}
                            </p>
                          )}

                          {/* Action buttons */}
                          <div style={{ display: "flex", gap: "0.4rem", marginTop: "0.25rem", flexWrap: "wrap" }}>
                            <button
                              className="ux-btn"
                              onClick={() => setViewModal(task)}
                              style={{
                                padding: "0.3rem 0.7rem", borderRadius: "0.5rem", fontSize: "0.75rem",
                                border: "1px solid var(--border)", background: "var(--surface)",
                                color: "var(--foreground-muted)", cursor: "pointer", fontWeight: 500,
                                transition: "all 150ms ease", display: "flex", alignItems: "center", gap: "0.3rem",
                              }}
                            >
                              <span style={{ fontSize: "0.8rem" }}>👁</span>
                              צפייה
                            </button>
                            <button
                              className="ux-btn"
                              onClick={() => handleRegenerate(task)}
                              disabled={isRegenerating}
                              style={{
                                padding: "0.3rem 0.7rem", borderRadius: "0.5rem", fontSize: "0.75rem",
                                border: "1px solid rgba(0, 181, 254, 0.3)", background: "rgba(0, 181, 254, 0.06)",
                                color: "var(--accent)", cursor: isRegenerating ? "not-allowed" : "pointer",
                                fontWeight: 500, transition: "all 150ms ease",
                                display: "flex", alignItems: "center", gap: "0.3rem",
                                opacity: isRegenerating ? 0.6 : 1,
                              }}
                            >
                              {isRegenerating ? (
                                <>
                                  <span style={{
                                    display: "inline-block", width: 12, height: 12,
                                    border: "2px solid var(--accent)", borderTopColor: "transparent",
                                    borderRadius: "50%", animation: "spin 0.8s linear infinite",
                                  }} />
                                  מייצר...
                                </>
                              ) : (
                                <>
                                  <span style={{ fontSize: "0.8rem" }}>✨</span>
                                  צור מחדש (AI)
                                </>
                              )}
                            </button>
                            <button
                              className="ux-btn"
                              onClick={() => openEditModal(task)}
                              style={{
                                padding: "0.3rem 0.7rem", borderRadius: "0.5rem", fontSize: "0.75rem",
                                border: "1px solid var(--border)", background: "var(--surface)",
                                color: "var(--foreground-muted)", cursor: "pointer", fontWeight: 500,
                                transition: "all 150ms ease", display: "flex", alignItems: "center", gap: "0.3rem",
                              }}
                            >
                              <span style={{ fontSize: "0.8rem" }}>✏️</span>
                              צור ידנית
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  /* ── Empty state for client ── */
                  <div style={{
                    display: "flex", flexDirection: "column", alignItems: "center",
                    padding: "1.5rem 1rem", gap: "0.75rem",
                    background: "var(--surface-raised)", borderRadius: "0.75rem",
                    border: "1px dashed var(--border)",
                  }}>
                    <p style={{ fontSize: "0.82rem", color: "var(--foreground-muted)", margin: 0, textAlign: "center" }}>
                      אין משימות מתוכננות להיום
                    </p>
                    <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", justifyContent: "center" }}>
                      <button
                        className="ux-btn"
                        onClick={() => handleGenerateForClient(client.id)}
                        disabled={isGenerating}
                        style={{
                          padding: "0.35rem 0.85rem", borderRadius: "0.5rem", fontSize: "0.75rem",
                          border: "1px solid rgba(0, 181, 254, 0.3)", background: "rgba(0, 181, 254, 0.08)",
                          color: "var(--accent)", cursor: isGenerating ? "not-allowed" : "pointer",
                          fontWeight: 600, transition: "all 150ms ease",
                          display: "flex", alignItems: "center", gap: "0.3rem",
                          opacity: isGenerating ? 0.6 : 1,
                        }}
                      >
                        {isGenerating ? (
                          <>
                            <span style={{
                              display: "inline-block", width: 12, height: 12,
                              border: "2px solid var(--accent)", borderTopColor: "transparent",
                              borderRadius: "50%", animation: "spin 0.8s linear infinite",
                            }} />
                            מייצר...
                          </>
                        ) : (
                          <>
                            <span style={{ fontSize: "0.85rem" }}>✨</span>
                            צור משימה (AI)
                          </>
                        )}
                      </button>
                      <button
                        className="ux-btn"
                        onClick={() => openCreateModal(client.id)}
                        style={{
                          padding: "0.35rem 0.85rem", borderRadius: "0.5rem", fontSize: "0.75rem",
                          border: "1px solid var(--border)", background: "var(--surface)",
                          color: "var(--foreground-muted)", cursor: "pointer", fontWeight: 500,
                          transition: "all 150ms ease", display: "flex", alignItems: "center", gap: "0.3rem",
                        }}
                      >
                        <span style={{ fontSize: "0.85rem" }}>📝</span>
                        צור משימה ידנית
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════════
         View Modal
      ═══════════════════════════════════════════════════════════════════════ */}
      <Modal
        open={!!viewModal}
        onClose={() => setViewModal(null)}
        title="פרטי משימה"
        footer={
          <button className="mod-btn-ghost ux-btn" onClick={() => setViewModal(null)}>
            סגור
          </button>
        }
      >
        {viewModal && (
          <div dir="rtl" style={{ display: "flex", flexDirection: "column", gap: "1.25rem", padding: "0.5rem 0" }}>
            {/* Title */}
            <div>
              <h3 style={{ fontSize: "1.1rem", fontWeight: 700, color: "var(--foreground)", margin: 0, lineHeight: 1.4 }}>
                {viewModal.title || "ללא כותרת"}
              </h3>
            </div>

            {/* Meta badges */}
            <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
              {viewModal.platform && (
                <span style={{
                  fontSize: "0.78rem", padding: "0.25rem 0.65rem", borderRadius: "9999px",
                  background: "rgba(0, 181, 254, 0.1)", color: "var(--accent)",
                  border: "1px solid rgba(0, 181, 254, 0.25)",
                  display: "flex", alignItems: "center", gap: "0.3rem", fontWeight: 500,
                }}>
                  {PLATFORM_ICONS[viewModal.platform]} {PLATFORM_LABELS[viewModal.platform]}
                </span>
              )}
              {viewModal.format && (
                <span style={{
                  fontSize: "0.78rem", padding: "0.25rem 0.65rem", borderRadius: "9999px",
                  background: "rgba(139, 92, 246, 0.1)", color: "#a78bfa",
                  border: "1px solid rgba(139, 92, 246, 0.25)", fontWeight: 500,
                }}>
                  {FORMAT_LABELS[viewModal.format] || viewModal.format}
                </span>
              )}
              {viewModal.status && (
                <span style={{
                  fontSize: "0.78rem", padding: "0.25rem 0.65rem", borderRadius: "9999px",
                  background: `${STATUS_COLORS[viewModal.status]}18`,
                  color: STATUS_COLORS[viewModal.status],
                  border: `1px solid ${STATUS_COLORS[viewModal.status]}35`,
                  fontWeight: 600,
                }}>
                  {STATUS_LABELS[viewModal.status]}
                </span>
              )}
            </div>

            {/* Detail sections */}
            {viewModal.ideaSummary && (
              <DetailSection label="סיכום הרעיון" value={viewModal.ideaSummary} />
            )}
            {viewModal.caption && (
              <DetailSection label="קפשן" value={viewModal.caption} />
            )}
            {viewModal.graphicText && (
              <DetailSection label="טקסט גרפי" value={viewModal.graphicText} />
            )}
            {viewModal.visualConcept && (
              <DetailSection label="קונספט ויזואלי" value={viewModal.visualConcept} />
            )}

            {/* Assigned employee */}
            {viewModal.assigneeId && employeeMap.has(viewModal.assigneeId) && (
              <div style={{
                display: "flex", alignItems: "center", gap: "0.5rem",
                padding: "0.75rem 1rem", background: "var(--surface-raised)",
                borderRadius: "0.6rem", border: "1px solid var(--border)",
              }}>
                <span style={{ fontSize: "0.8rem", color: "var(--foreground-muted)" }}>👤</span>
                <span style={{ fontSize: "0.8rem", color: "var(--foreground-muted)" }}>אחראי:</span>
                <span style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--foreground)" }}>
                  {employeeMap.get(viewModal.assigneeId)}
                </span>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* ═══════════════════════════════════════════════════════════════════════
         Edit Modal
      ═══════════════════════════════════════════════════════════════════════ */}
      <Modal
        open={!!editModal}
        onClose={() => setEditModal(null)}
        title="עריכת משימה"
        footer={
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <button className="mod-btn-ghost ux-btn" onClick={() => setEditModal(null)}>
              ביטול
            </button>
            <button
              className="mod-btn-primary ux-btn ux-btn-glow"
              onClick={handleSaveEdit}
              disabled={saving}
              style={{ opacity: saving ? 0.7 : 1 }}
            >
              {saving ? "שומר..." : "שמירה"}
            </button>
          </div>
        }
      >
        <div dir="rtl" style={{ display: "flex", flexDirection: "column", gap: "1rem", padding: "0.5rem 0" }}>
          <TaskFormFields form={form} setForm={setForm} />
        </div>
      </Modal>

      {/* ═══════════════════════════════════════════════════════════════════════
         Create Modal
      ═══════════════════════════════════════════════════════════════════════ */}
      <Modal
        open={!!createModal}
        onClose={() => setCreateModal(null)}
        title="יצירת משימה חדשה"
        footer={
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <button className="mod-btn-ghost ux-btn" onClick={() => setCreateModal(null)}>
              ביטול
            </button>
            <button
              className="mod-btn-primary ux-btn ux-btn-glow"
              onClick={handleSaveCreate}
              disabled={saving}
              style={{ opacity: saving ? 0.7 : 1 }}
            >
              {saving ? "יוצר..." : "צור משימה"}
            </button>
          </div>
        }
      >
        <div dir="rtl" style={{ display: "flex", flexDirection: "column", gap: "1rem", padding: "0.5rem 0" }}>
          <TaskFormFields form={form} setForm={setForm} />
        </div>
      </Modal>

      {/* Inline keyframe for spinner */}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </main>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   Sub-components
───────────────────────────────────────────────────────────────────────────── */

function DetailSection({ label, value }: { label: string; value: string }) {
  return (
    <div style={{
      display: "flex", flexDirection: "column", gap: "0.35rem",
    }}>
      <span style={{
        fontSize: "0.75rem", fontWeight: 600, color: "var(--foreground-muted)",
        textTransform: "uppercase", letterSpacing: "0.03em",
      }}>
        {label}
      </span>
      <div style={{
        fontSize: "0.85rem", color: "var(--foreground)", lineHeight: 1.65,
        padding: "0.75rem 1rem", background: "var(--surface-raised)",
        borderRadius: "0.6rem", border: "1px solid var(--border)",
        whiteSpace: "pre-wrap", wordBreak: "break-word",
      }}>
        {value}
      </div>
    </div>
  );
}

function TaskFormFields({ form, setForm }: { form: TaskFormState; setForm: React.Dispatch<React.SetStateAction<TaskFormState>> }) {
  return (
    <>
      {/* Title */}
      <FormField label="כותרת">
        <input
          className="form-input ux-input"
          value={form.title}
          onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
          placeholder="הזן כותרת למשימה..."
          dir="rtl"
        />
      </FormField>

      {/* Platform & Format row */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
        <FormField label="פלטפורמה">
          <select
            className="form-select"
            value={form.platform}
            onChange={(e) => setForm((prev) => ({ ...prev, platform: e.target.value as ContentPlatform }))}
            dir="rtl"
          >
            <option value="facebook">📘 פייסבוק</option>
            <option value="instagram">📸 אינסטגרם</option>
            <option value="tiktok">🎵 טיקטוק</option>
            <option value="all">🌐 כל הפלטפורמות</option>
          </select>
        </FormField>
        <FormField label="פורמט">
          <select
            className="form-select"
            value={form.format}
            onChange={(e) => setForm((prev) => ({ ...prev, format: e.target.value as ContentFormat }))}
            dir="rtl"
          >
            <option value="image">תמונה</option>
            <option value="video">סרטון</option>
            <option value="story">סטורי</option>
            <option value="reel">ריל</option>
            <option value="carousel">קרוסלה</option>
          </select>
        </FormField>
      </div>

      {/* Idea Summary */}
      <FormField label="סיכום רעיון">
        <textarea
          className="form-input ux-input"
          value={form.ideaSummary}
          onChange={(e) => setForm((prev) => ({ ...prev, ideaSummary: e.target.value }))}
          placeholder="תאר את הרעיון בקצרה..."
          dir="rtl"
          rows={3}
          style={{ height: "auto", resize: "vertical", padding: "0.5rem 0.75rem" }}
        />
      </FormField>

      {/* Caption */}
      <FormField label="קפשן">
        <textarea
          className="form-input ux-input"
          value={form.caption}
          onChange={(e) => setForm((prev) => ({ ...prev, caption: e.target.value }))}
          placeholder="כתוב את הקפשן לפוסט..."
          dir="rtl"
          rows={5}
          style={{ height: "auto", resize: "vertical", padding: "0.5rem 0.75rem" }}
        />
      </FormField>

      {/* Graphic Text */}
      <FormField label="טקסט גרפי">
        <textarea
          className="form-input ux-input"
          value={form.graphicText}
          onChange={(e) => setForm((prev) => ({ ...prev, graphicText: e.target.value }))}
          placeholder="טקסט שיופיע על הגרפיקה..."
          dir="rtl"
          rows={2}
          style={{ height: "auto", resize: "vertical", padding: "0.5rem 0.75rem" }}
        />
      </FormField>

      {/* Visual Concept */}
      <FormField label="קונספט ויזואלי">
        <textarea
          className="form-input ux-input"
          value={form.visualConcept}
          onChange={(e) => setForm((prev) => ({ ...prev, visualConcept: e.target.value }))}
          placeholder="תאר את הקונספט הויזואלי..."
          dir="rtl"
          rows={3}
          style={{ height: "auto", resize: "vertical", padding: "0.5rem 0.75rem" }}
        />
      </FormField>
    </>
  );
}

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
      <label style={{
        fontSize: "0.78rem", fontWeight: 600, color: "var(--foreground-muted)",
      }}>
        {label}
      </label>
      {children}
    </div>
  );
}
