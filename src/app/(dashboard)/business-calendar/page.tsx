"use client";

import { useState, useMemo, useCallback } from "react";
import {
  useEmployeeTasks,
  useTasks,
  usePayments,
  useLeads,
  useClients,
  useEmployees,
  usePodcastSessions,
  useBusinessProjects,
  useProjectMilestones,
  useMeetings,
} from "@/lib/api/use-entity";
import { useToast } from "@/components/ui/toast";
import { Modal } from "@/components/ui/modal";
import type { EmployeeTask, EmployeeTaskStatus, EmployeeTaskPriority, Meeting, MeetingStatus } from "@/lib/db/schema";

/* ── Hebrew helpers ────────────────────────────────────────────── */
const HEBREW_MONTHS = ["ינואר","פברואר","מרץ","אפריל","מאי","יוני","יולי","אוגוסט","ספטמבר","אוקטובר","נובמבר","דצמבר"];
const HEBREW_DAYS  = ["ראשון","שני","שלישי","רביעי","חמישי","שישי","שבת"];

/* ── Event types & colors ──────────────────────────────────────── */
type EventType = "employee_task" | "task" | "payment" | "lead" | "podcast" | "milestone" | "meeting";

const EVENT_META: Record<EventType, { label: string; color: string; icon: string }> = {
  employee_task: { label: "משימות עובדים", color: "#0092cc", icon: "👤" },
  task:          { label: "משימות כלליות", color: "#3b82f6", icon: "📋" },
  payment:       { label: "תשלומים",       color: "#fbbf24", icon: "💰" },
  lead:          { label: "פולואפ לידים",  color: "#34d399", icon: "📞" },
  podcast:       { label: "הקלטות פודקאסט",color: "#f472b6", icon: "🎙️" },
  milestone:     { label: "אבני דרך",      color: "#f97316", icon: "🏁" },
  meeting:       { label: "פגישות",        color: "#06b6d4", icon: "🤝" },
};

const STATUS_LABELS: Record<string, string> = {
  new: "חדש", in_progress: "בעבודה", under_review: "בבדיקה",
  returned: "הוחזר", approved: "אושר", completed: "הושלם",
};
const STATUS_COLORS: Record<string, string> = {
  new: "#3b82f6", in_progress: "#fbbf24", under_review: "#a78bfa",
  returned: "#f97316", approved: "#22c55e", completed: "#10b981",
};
const PRIORITY_LABELS: Record<string, string> = {
  urgent: "דחוף", high: "גבוה", medium: "בינוני", low: "נמוך",
};
const PRIORITY_COLORS: Record<string, string> = {
  urgent: "#ef4444", high: "#f59e0b", medium: "#38bdf8", low: "#6b7280",
};

/* ── Unified calendar event ──────────────────────────────────── */
interface CalEvent {
  day: number;
  month: number;
  year: number;
  type: EventType;
  title: string;
  subtitle?: string;
  color: string;
  icon: string;
  sourceId?: string;
  priority?: string;
  status?: string;
  clientName?: string;
}

/* ── Page view modes ─────────────────────────────────────────── */
type ViewMode = "calendar" | "tasks" | "completed";

/* ================================================================
   MAIN PAGE
   ================================================================ */
export default function BusinessCalendarPage() {
  const today = new Date();
  const [year, setYear]     = useState(today.getFullYear());
  const [month, setMonth]   = useState(today.getMonth());
  const [view, setView]     = useState<ViewMode>("calendar");
  const [filters, setFilters] = useState<Set<EventType>>(
    new Set(["employee_task","task","payment","lead","podcast","milestone","meeting"])
  );
  const [selectedDay, setSelectedDay] = useState<number | null>(null);

  // Task creation / editing
  const [taskModalOpen, setTaskModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<EmployeeTask | null>(null);
  const [taskForm, setTaskForm] = useState({
    title: "", description: "", assignedEmployeeId: "",
    clientId: "", clientName: "", dueDate: "",
    status: "new" as EmployeeTaskStatus,
    priority: "medium" as EmployeeTaskPriority,
    notes: "",
  });

  // Meeting creation / editing
  const [meetingModalOpen, setMeetingModalOpen] = useState(false);
  const [editingMeeting, setEditingMeeting] = useState<Meeting | null>(null);
  const [meetingForm, setMeetingForm] = useState({
    title: "", date: "", startTime: "09:00", endTime: "10:00",
    description: "", clientId: "", clientName: "",
    location: "", reminderDayBefore: true, reminderSameDay: false,
    status: "scheduled" as MeetingStatus,
  });

  // Day click action chooser
  const [dayActionMenu, setDayActionMenu] = useState<{ day: number; x: number; y: number } | null>(null);

  const toast = useToast();

  /* ── Data hooks ──────────────────────────────────────────── */
  const { data: employeeTasks, create: createET, update: updateET, remove: removeET } = useEmployeeTasks();
  const { data: allMeetings, create: createMtg, update: updateMtg, remove: removeMtg } = useMeetings();
  const { data: tasks }       = useTasks();
  const { data: payments }    = usePayments();
  const { data: leads }       = useLeads();
  const { data: clients }     = useClients();
  const { data: employees }   = useEmployees();
  const { data: podcasts }    = usePodcastSessions();
  const { data: milestones }  = useProjectMilestones();

  /* ── Build unified events ────────────────────────────────── */
  const events = useMemo<CalEvent[]>(() => {
    const result: CalEvent[] = [];

    // Employee tasks
    (employeeTasks || []).forEach((t) => {
      if (t.dueDate) {
        const d = new Date(t.dueDate);
        if (!isNaN(d.getTime())) {
          const emp = (employees || []).find(e => e.id === t.assignedEmployeeId);
          result.push({
            day: d.getDate(), month: d.getMonth(), year: d.getFullYear(),
            type: "employee_task", title: t.title,
            subtitle: emp?.name || "",
            color: EVENT_META.employee_task.color,
            icon: EVENT_META.employee_task.icon,
            sourceId: t.id, priority: t.priority, status: t.status,
            clientName: t.clientName || undefined,
          });
        }
      }
    });

    // General tasks
    (tasks || []).forEach((t) => {
      if (t.dueDate) {
        const d = new Date(t.dueDate);
        if (!isNaN(d.getTime())) {
          result.push({
            day: d.getDate(), month: d.getMonth(), year: d.getFullYear(),
            type: "task", title: t.title,
            subtitle: t.clientName || "",
            color: EVENT_META.task.color,
            icon: EVENT_META.task.icon,
            sourceId: t.id, priority: t.priority, status: t.status,
          });
        }
      }
    });

    // Payments
    (payments || []).forEach((p) => {
      if (p.dueDate) {
        const d = new Date(p.dueDate);
        if (!isNaN(d.getTime())) {
          result.push({
            day: d.getDate(), month: d.getMonth(), year: d.getFullYear(),
            type: "payment",
            title: `תשלום: ${p.clientName}`,
            subtitle: `₪${(p.amount || 0).toLocaleString()}`,
            color: EVENT_META.payment.color,
            icon: EVENT_META.payment.icon,
            sourceId: p.id,
          });
        }
      }
    });

    // Lead follow-ups
    (leads || []).forEach((l) => {
      if (l.followUpAt) {
        const d = new Date(l.followUpAt);
        if (!isNaN(d.getTime())) {
          result.push({
            day: d.getDate(), month: d.getMonth(), year: d.getFullYear(),
            type: "lead",
            title: `פולואפ: ${l.name || ""}`,
            subtitle: (l as any).company || "",
            color: EVENT_META.lead.color,
            icon: EVENT_META.lead.icon,
            sourceId: l.id,
          });
        }
      }
    });

    // Podcast sessions
    (podcasts || []).forEach((s) => {
      if (s.sessionDate) {
        const d = new Date(s.sessionDate);
        if (!isNaN(d.getTime())) {
          result.push({
            day: d.getDate(), month: d.getMonth(), year: d.getFullYear(),
            type: "podcast",
            title: `הקלטה: ${(s as any).clientName || (s as any).guestName || ""}`,
            subtitle: s.startTime ? `${s.startTime}` : "",
            color: EVENT_META.podcast.color,
            icon: EVENT_META.podcast.icon,
            sourceId: s.id,
          });
        }
      }
    });

    // Project milestones
    (milestones || []).forEach((m) => {
      if (m.dueDate) {
        const d = new Date(m.dueDate);
        if (!isNaN(d.getTime())) {
          result.push({
            day: d.getDate(), month: d.getMonth(), year: d.getFullYear(),
            type: "milestone",
            title: `אבן דרך: ${m.title}`,
            color: EVENT_META.milestone.color,
            icon: EVENT_META.milestone.icon,
            sourceId: m.id, status: m.status,
          });
        }
      }
    });

    // Meetings
    (allMeetings || []).forEach((m) => {
      if (m.date) {
        const d = new Date(m.date);
        if (!isNaN(d.getTime())) {
          result.push({
            day: d.getDate(), month: d.getMonth(), year: d.getFullYear(),
            type: "meeting",
            title: m.title,
            subtitle: `${m.startTime || ""}–${m.endTime || ""}${m.location ? ` · ${m.location}` : ""}`,
            color: EVENT_META.meeting.color,
            icon: EVENT_META.meeting.icon,
            sourceId: m.id, status: m.status,
            clientName: m.clientName || undefined,
          });
        }
      }
    });

    return result;
  }, [employeeTasks, tasks, payments, leads, employees, podcasts, milestones, allMeetings]);

  /* ── Filtered events for current month ────────────────────── */
  const monthEvents = useMemo(
    () => events.filter(e => e.month === month && e.year === year && filters.has(e.type)),
    [events, month, year, filters]
  );

  /* ── Employee tasks lists ─────────────────────────────────── */
  const activeTasks = useMemo(
    () => (employeeTasks || []).filter(t => t.status !== "completed"),
    [employeeTasks]
  );
  const completedTasks = useMemo(
    () => (employeeTasks || []).filter(t => t.status === "completed"),
    [employeeTasks]
  );

  /* ── Calendar navigation ──────────────────────────────────── */
  const prevMonth = () => { if (month === 0) { setMonth(11); setYear(y => y - 1); } else setMonth(m => m - 1); };
  const nextMonth = () => { if (month === 11) { setMonth(0); setYear(y => y + 1); } else setMonth(m => m + 1); };
  const goToday   = () => { setYear(today.getFullYear()); setMonth(today.getMonth()); setSelectedDay(today.getDate()); };

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDay   = new Date(year, month, 1).getDay();
  const isCurrentMonth = year === today.getFullYear() && month === today.getMonth();

  const calendarDays: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) calendarDays.push(null);
  for (let i = 1; i <= daysInMonth; i++) calendarDays.push(i);

  const toggleFilter = (f: EventType) => {
    const n = new Set(filters);
    n.has(f) ? n.delete(f) : n.add(f);
    setFilters(n);
  };

  /* ── Task form helpers ────────────────────────────────────── */
  const resetForm = () => {
    setTaskForm({ title: "", description: "", assignedEmployeeId: "", clientId: "", clientName: "", dueDate: "", status: "new", priority: "medium", notes: "" });
    setEditingTask(null);
  };

  const openCreateTask = (prefillDate?: string) => {
    resetForm();
    if (prefillDate) setTaskForm(f => ({ ...f, dueDate: prefillDate }));
    setTaskModalOpen(true);
  };

  const openEditTask = (task: EmployeeTask) => {
    setEditingTask(task);
    setTaskForm({
      title: task.title,
      description: task.description,
      assignedEmployeeId: task.assignedEmployeeId,
      clientId: task.clientId || "",
      clientName: task.clientName || "",
      dueDate: task.dueDate || "",
      status: task.status,
      priority: task.priority,
      notes: task.notes,
    });
    setTaskModalOpen(true);
  };

  const handleSaveTask = useCallback(async () => {
    if (!taskForm.title.trim()) {
      toast("יש להזין כותרת למשימה", "error");
      return;
    }
    try {
      // Resolve client name
      let clientName = taskForm.clientName;
      if (taskForm.clientId && !clientName) {
        const c = (clients || []).find(cl => cl.id === taskForm.clientId);
        clientName = c?.name || "";
      }

      const payload = {
        title: taskForm.title,
        description: taskForm.description,
        assignedEmployeeId: taskForm.assignedEmployeeId,
        clientId: taskForm.clientId || null,
        clientName,
        projectId: null,
        ganttItemId: null,
        dueDate: taskForm.dueDate || null,
        status: taskForm.status,
        priority: taskForm.priority,
        files: editingTask?.files || [],
        notes: taskForm.notes,
      };

      if (editingTask) {
        await updateET(editingTask.id, payload);
        toast("המשימה עודכנה", "success");
      } else {
        await createET(payload);
        toast("המשימה נוצרה", "success");
      }
      setTaskModalOpen(false);
      resetForm();
    } catch {
      toast("שגיאה בשמירת המשימה", "error");
    }
  }, [taskForm, editingTask, clients, createET, updateET, toast]);

  const handleDeleteTask = useCallback(async (id: string) => {
    try {
      await removeET(id);
      toast("המשימה נמחקה", "success");
    } catch {
      toast("שגיאה במחיקת המשימה", "error");
    }
  }, [removeET, toast]);

  const handleStatusChange = useCallback(async (id: string, status: EmployeeTaskStatus) => {
    try {
      await updateET(id, { status });
      toast(`סטטוס עודכן: ${STATUS_LABELS[status]}`, "success");
    } catch {
      toast("שגיאה בעדכון סטטוס", "error");
    }
  }, [updateET, toast]);

  /* ── Meeting form helpers ─────────────────────────────────── */
  const resetMeetingForm = () => {
    setMeetingForm({ title: "", date: "", startTime: "09:00", endTime: "10:00", description: "", clientId: "", clientName: "", location: "", reminderDayBefore: true, reminderSameDay: false, status: "scheduled" });
    setEditingMeeting(null);
  };

  const openCreateMeeting = (prefillDate?: string) => {
    resetMeetingForm();
    if (prefillDate) setMeetingForm(f => ({ ...f, date: prefillDate }));
    setMeetingModalOpen(true);
  };

  const openEditMeeting = (meeting: Meeting) => {
    setEditingMeeting(meeting);
    setMeetingForm({
      title: meeting.title, date: meeting.date, startTime: meeting.startTime, endTime: meeting.endTime,
      description: meeting.description, clientId: meeting.clientId || "", clientName: meeting.clientName || "",
      location: meeting.location || "", reminderDayBefore: meeting.reminderDayBefore, reminderSameDay: meeting.reminderSameDay,
      status: meeting.status,
    });
    setMeetingModalOpen(true);
  };

  const handleSaveMeeting = useCallback(async () => {
    if (!meetingForm.title.trim()) { toast("יש להזין כותרת לפגישה", "error"); return; }
    if (!meetingForm.date) { toast("יש להזין תאריך", "error"); return; }
    try {
      let clientName = meetingForm.clientName;
      if (meetingForm.clientId && !clientName) {
        const c = (clients || []).find(cl => cl.id === meetingForm.clientId);
        clientName = c?.name || "";
      }
      const payload = {
        title: meetingForm.title, date: meetingForm.date, startTime: meetingForm.startTime, endTime: meetingForm.endTime,
        description: meetingForm.description, clientId: meetingForm.clientId || null, clientName,
        location: meetingForm.location, reminderSent: false,
        reminderDayBefore: meetingForm.reminderDayBefore, reminderSameDay: meetingForm.reminderSameDay,
        status: meetingForm.status,
      };
      if (editingMeeting) {
        await updateMtg(editingMeeting.id, payload);
        toast("הפגישה עודכנה", "success");
      } else {
        await createMtg(payload);
        toast("הפגישה נוצרה", "success");
      }
      setMeetingModalOpen(false);
      resetMeetingForm();
    } catch {
      toast("שגיאה בשמירת הפגישה", "error");
    }
  }, [meetingForm, editingMeeting, clients, createMtg, updateMtg, toast]);

  const handleDeleteMeeting = useCallback(async (id: string) => {
    try { await removeMtg(id); toast("הפגישה נמחקה", "success"); }
    catch { toast("שגיאה במחיקת הפגישה", "error"); }
  }, [removeMtg, toast]);

  /* ── Day detail events ────────────────────────────────────── */
  const selectedDayEvents = selectedDay
    ? monthEvents.filter(e => e.day === selectedDay)
    : [];

  /* ── Stats ────────────────────────────────────────────────── */
  const stats = useMemo(() => {
    const now = new Date();
    const overdue = activeTasks.filter(t => t.dueDate && new Date(t.dueDate) < now).length;
    const todayTasks = activeTasks.filter(t => {
      if (!t.dueDate) return false;
      const d = new Date(t.dueDate);
      return d.getDate() === now.getDate() && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    }).length;
    const thisWeek = activeTasks.filter(t => {
      if (!t.dueDate) return false;
      const d = new Date(t.dueDate);
      const diff = (d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
      return diff >= 0 && diff <= 7;
    }).length;
    return { total: activeTasks.length, overdue, todayTasks, thisWeek, completed: completedTasks.length };
  }, [activeTasks, completedTasks]);

  /* ================================================================
     RENDER
     ================================================================ */
  return (
    <div style={{ padding: "1.5rem 2rem", maxWidth: 1400, margin: "0 auto" }} dir="rtl">

      {/* ── Page header ─────────────────────────────────────── */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem", flexWrap: "wrap", gap: "1rem" }}>
        <h1 style={{ fontSize: "1.5rem", fontWeight: 700, display: "flex", alignItems: "center", gap: "0.5rem" }}>
          📅 ניהול יומן ומשימות
        </h1>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <button onClick={() => openCreateTask()} style={{
            padding: "0.5rem 1.2rem", borderRadius: "0.5rem", border: "none",
            background: "var(--accent)", color: "#fff", fontWeight: 600, cursor: "pointer", fontSize: "0.85rem",
          }}>
            + משימה חדשה
          </button>
          <button onClick={() => openCreateMeeting()} style={{
            padding: "0.5rem 1.2rem", borderRadius: "0.5rem",
            border: "1px solid #06b6d4", background: "rgba(6,182,212,0.08)", color: "#06b6d4",
            fontWeight: 600, cursor: "pointer", fontSize: "0.85rem",
          }}>
            🤝 פגישה חדשה
          </button>
        </div>
      </div>

      {/* ── Stats cards ─────────────────────────────────────── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: "0.75rem", marginBottom: "1.5rem" }}>
        {[
          { label: "משימות פעילות", value: stats.total, color: "#3b82f6" },
          { label: "להיום", value: stats.todayTasks, color: "#0092cc" },
          { label: "השבוע", value: stats.thisWeek, color: "#22c55e" },
          { label: "באיחור", value: stats.overdue, color: "#ef4444" },
          { label: "הושלמו", value: stats.completed, color: "#10b981" },
        ].map(s => (
          <div key={s.label} style={{
            background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "0.75rem",
            padding: "1rem", display: "flex", flexDirection: "column", gap: "0.25rem",
            borderTop: `3px solid ${s.color}`,
          }}>
            <span style={{ fontSize: "0.75rem", color: "var(--foreground-muted)" }}>{s.label}</span>
            <span style={{ fontSize: "1.6rem", fontWeight: 700 }}>{s.value}</span>
          </div>
        ))}
      </div>

      {/* ── View tabs ───────────────────────────────────────── */}
      <div style={{ display: "flex", gap: "0.35rem", marginBottom: "1.25rem", background: "var(--surface-raised)", borderRadius: "0.5rem", padding: "0.25rem", width: "fit-content" }}>
        {([
          { id: "calendar" as ViewMode, label: "📅 יומן" },
          { id: "tasks" as ViewMode, label: "📋 משימות פעילות" },
          { id: "completed" as ViewMode, label: "✅ הושלמו" },
        ]).map(tab => (
          <button key={tab.id} onClick={() => setView(tab.id)} style={{
            padding: "0.45rem 1rem", borderRadius: "0.375rem", border: "none",
            cursor: "pointer", fontSize: "0.82rem", fontWeight: 600, transition: "all 0.15s",
            background: view === tab.id ? "var(--accent)" : "transparent",
            color: view === tab.id ? "#fff" : "var(--foreground-muted)",
          }}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* ════════════════════════════════════════════════════════
         CALENDAR VIEW
         ════════════════════════════════════════════════════════ */}
      {view === "calendar" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>

          {/* Toolbar */}
          <div style={{ display: "flex", alignItems: "center", gap: "1rem", flexWrap: "wrap" }}>
            <button onClick={prevMonth} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "0.375rem", padding: "0.35rem 0.7rem", cursor: "pointer", color: "var(--foreground)" }}>→</button>
            <span style={{ fontSize: "1.1rem", fontWeight: 600, minWidth: "10rem", textAlign: "center" }}>
              {HEBREW_MONTHS[month]} {year}
            </span>
            <button onClick={nextMonth} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "0.375rem", padding: "0.35rem 0.7rem", cursor: "pointer", color: "var(--foreground)" }}>←</button>
            <button onClick={goToday} style={{
              padding: "0.35rem 0.85rem", borderRadius: "0.375rem", border: "none",
              background: "var(--accent)", color: "#fff", cursor: "pointer", fontSize: "0.82rem", fontWeight: 600,
            }}>
              היום
            </button>
          </div>

          {/* Filter chips */}
          <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap" }}>
            {(Object.keys(EVENT_META) as EventType[]).map(key => (
              <button key={key} onClick={() => toggleFilter(key)} style={{
                padding: "0.3rem 0.75rem", borderRadius: 999, fontSize: "0.75rem", fontWeight: 500,
                cursor: "pointer", transition: "all 0.15s",
                border: `2px solid ${EVENT_META[key].color}`,
                background: filters.has(key) ? EVENT_META[key].color : "transparent",
                color: filters.has(key) ? "#fff" : EVENT_META[key].color,
              }}>
                {EVENT_META[key].icon} {EVENT_META[key].label}
              </button>
            ))}
          </div>

          {/* Calendar grid + day detail */}
          <div style={{ display: "grid", gridTemplateColumns: selectedDay ? "1fr 320px" : "1fr", gap: "1rem" }}>

            {/* Grid */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: "0.3rem" }}>
              {HEBREW_DAYS.map(d => (
                <div key={d} style={{ fontWeight: 600, textAlign: "center", padding: "0.4rem", color: "var(--foreground-muted)", fontSize: "0.78rem" }}>{d}</div>
              ))}
              {calendarDays.map((day, idx) => {
                const dayEvents = day ? monthEvents.filter(e => e.day === day) : [];
                const isTodayCell = isCurrentMonth && day === today.getDate();
                const isSelected = day === selectedDay;
                return (
                  <div key={idx} onClick={() => day && setSelectedDay(day === selectedDay ? null : day)} style={{
                    minHeight: 80, padding: "0.35rem", borderRadius: "0.375rem",
                    display: "flex", flexDirection: "column", cursor: day ? "pointer" : "default",
                    border: isSelected ? "2px solid var(--accent)" : isTodayCell ? "2px solid var(--accent)" : "1px solid var(--border)",
                    background: !day ? "var(--surface-raised)" : isSelected ? "rgba(0,181,254,0.1)" : isTodayCell ? "rgba(0,181,254,0.04)" : "var(--surface)",
                    transition: "all 0.15s",
                  }}>
                    {day && (
                      <>
                        <div style={{ fontWeight: 600, fontSize: "0.78rem", marginBottom: "0.15rem", color: isTodayCell ? "var(--accent)" : "var(--foreground)" }}>{day}</div>
                        {dayEvents.slice(0, 3).map((ev, i) => (
                          <div key={i} style={{
                            fontSize: "0.58rem", padding: "0.1rem 0.3rem", borderRadius: "0.15rem",
                            background: ev.color, color: "#fff", overflow: "hidden",
                            textOverflow: "ellipsis", whiteSpace: "nowrap", marginBottom: "0.1rem",
                          }}>
                            {ev.icon} {ev.title}
                          </div>
                        ))}
                        {dayEvents.length > 3 && (
                          <div style={{ fontSize: "0.58rem", color: "var(--foreground-muted)" }}>+{dayEvents.length - 3} עוד</div>
                        )}
                      </>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Day detail panel */}
            {selectedDay && (
              <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "0.75rem", padding: "1rem", maxHeight: 600, overflowY: "auto" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
                  <h3 style={{ fontSize: "1rem", fontWeight: 600 }}>{selectedDay} {HEBREW_MONTHS[month]}</h3>
                  <button onClick={() => setSelectedDay(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--foreground-muted)", fontSize: "1.1rem" }}>✕</button>
                </div>
                <div style={{ display: "flex", gap: "0.35rem", marginBottom: "0.75rem" }}>
                  <button onClick={() => {
                    const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(selectedDay).padStart(2, "0")}`;
                    openCreateTask(dateStr);
                  }} style={{
                    flex: 1, padding: "0.4rem", borderRadius: "0.375rem", border: "1px dashed var(--border)",
                    background: "transparent", cursor: "pointer", color: "var(--foreground-muted)", fontSize: "0.72rem",
                  }}>
                    + משימה
                  </button>
                  <button onClick={() => {
                    const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(selectedDay).padStart(2, "0")}`;
                    openCreateMeeting(dateStr);
                  }} style={{
                    flex: 1, padding: "0.4rem", borderRadius: "0.375rem", border: "1px dashed #06b6d4",
                    background: "rgba(6,182,212,0.04)", cursor: "pointer", color: "#06b6d4", fontSize: "0.72rem",
                  }}>
                    🤝 פגישה
                  </button>
                </div>
                {selectedDayEvents.length === 0 ? (
                  <div style={{ textAlign: "center", color: "var(--foreground-muted)", padding: "1.5rem 0", fontSize: "0.85rem" }}>
                    אין אירועים ביום זה
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                    {selectedDayEvents.map((ev, i) => (
                      <div key={i} style={{
                        padding: "0.6rem", borderRadius: "0.5rem", background: "var(--surface-raised)",
                        borderInlineStart: `3px solid ${ev.color}`,
                      }}>
                        <div style={{ fontSize: "0.82rem", fontWeight: 600 }}>{ev.icon} {ev.title}</div>
                        {ev.subtitle && <div style={{ fontSize: "0.72rem", color: "var(--foreground-muted)", marginTop: "0.15rem" }}>{ev.subtitle}</div>}
                        <div style={{ display: "flex", gap: "0.35rem", marginTop: "0.35rem", flexWrap: "wrap" }}>
                          {ev.status && (
                            <span style={{ fontSize: "0.65rem", padding: "0.1rem 0.45rem", borderRadius: 999, background: STATUS_COLORS[ev.status] || "#666", color: "#fff" }}>
                              {STATUS_LABELS[ev.status] || ev.status}
                            </span>
                          )}
                          {ev.priority && (
                            <span style={{ fontSize: "0.65rem", padding: "0.1rem 0.45rem", borderRadius: 999, background: PRIORITY_COLORS[ev.priority] || "#666", color: "#fff" }}>
                              {PRIORITY_LABELS[ev.priority] || ev.priority}
                            </span>
                          )}
                          {ev.clientName && (
                            <span style={{ fontSize: "0.65rem", padding: "0.1rem 0.45rem", borderRadius: 999, background: "var(--surface)", border: "1px solid var(--border)" }}>
                              {ev.clientName}
                            </span>
                          )}
                        </div>
                        {/* Quick actions for employee tasks */}
                        {/* Employee task quick actions */}
                        {ev.type === "employee_task" && ev.sourceId && ev.status !== "completed" && (
                          <div style={{ display: "flex", gap: "0.3rem", marginTop: "0.4rem" }}>
                            <button onClick={(e) => { e.stopPropagation(); handleStatusChange(ev.sourceId!, "completed"); }} style={{
                              fontSize: "0.65rem", padding: "0.15rem 0.5rem", borderRadius: "0.25rem",
                              border: "1px solid #10b981", background: "transparent", color: "#10b981", cursor: "pointer",
                            }}>
                              סמן כהושלם
                            </button>
                            <button onClick={(e) => {
                              e.stopPropagation();
                              const task = (employeeTasks || []).find(t => t.id === ev.sourceId);
                              if (task) openEditTask(task);
                            }} style={{
                              fontSize: "0.65rem", padding: "0.15rem 0.5rem", borderRadius: "0.25rem",
                              border: "1px solid var(--border)", background: "transparent", color: "var(--foreground-muted)", cursor: "pointer",
                            }}>
                              ערוך
                            </button>
                          </div>
                        )}
                        {/* Meeting quick actions */}
                        {ev.type === "meeting" && ev.sourceId && (
                          <div style={{ display: "flex", gap: "0.3rem", marginTop: "0.4rem" }}>
                            <button onClick={(e) => {
                              e.stopPropagation();
                              const mtg = (allMeetings || []).find(m => m.id === ev.sourceId);
                              if (mtg) openEditMeeting(mtg);
                            }} style={{
                              fontSize: "0.65rem", padding: "0.15rem 0.5rem", borderRadius: "0.25rem",
                              border: "1px solid #06b6d4", background: "transparent", color: "#06b6d4", cursor: "pointer",
                            }}>
                              ערוך
                            </button>
                            <button onClick={(e) => { e.stopPropagation(); handleDeleteMeeting(ev.sourceId!); }} style={{
                              fontSize: "0.65rem", padding: "0.15rem 0.5rem", borderRadius: "0.25rem",
                              border: "1px solid #ef4444", background: "transparent", color: "#ef4444", cursor: "pointer",
                            }}>
                              מחק
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Legend */}
          <div style={{ display: "flex", gap: "1.25rem", flexWrap: "wrap", paddingTop: "0.75rem", borderTop: "1px solid var(--border)" }}>
            {(Object.keys(EVENT_META) as EventType[]).map(key => (
              <div key={key} style={{ display: "flex", alignItems: "center", gap: "0.35rem", fontSize: "0.75rem" }}>
                <div style={{ width: 10, height: 10, borderRadius: "0.15rem", background: EVENT_META[key].color }} />
                <span>{EVENT_META[key].label}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════
         ACTIVE TASKS VIEW
         ════════════════════════════════════════════════════════ */}
      {view === "tasks" && (
        <TasksListView
          tasks={activeTasks}
          employees={employees || []}
          clients={clients || []}
          onEdit={openEditTask}
          onDelete={handleDeleteTask}
          onStatusChange={handleStatusChange}
          emptyMessage="אין משימות פעילות"
          emptyIcon="📋"
        />
      )}

      {/* ════════════════════════════════════════════════════════
         COMPLETED TASKS VIEW
         ════════════════════════════════════════════════════════ */}
      {view === "completed" && (
        <TasksListView
          tasks={completedTasks}
          employees={employees || []}
          clients={clients || []}
          onEdit={openEditTask}
          onDelete={handleDeleteTask}
          onStatusChange={handleStatusChange}
          emptyMessage="אין משימות שהושלמו"
          emptyIcon="✅"
        />
      )}

      {/* ════════════════════════════════════════════════════════
         TASK MODAL
         ════════════════════════════════════════════════════════ */}
      <Modal open={taskModalOpen} onClose={() => { setTaskModalOpen(false); resetForm(); }} title={editingTask ? "עריכת משימה" : "משימה חדשה"}>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.85rem", maxWidth: 480, direction: "rtl" }}>

            {/* Title */}
            <div>
              <label style={{ fontSize: "0.78rem", fontWeight: 600, marginBottom: "0.25rem", display: "block" }}>כותרת *</label>
              <input value={taskForm.title} onChange={e => setTaskForm(f => ({ ...f, title: e.target.value }))}
                placeholder="כותרת המשימה"
                style={{ width: "100%", padding: "0.45rem 0.6rem", borderRadius: "0.375rem", border: "1px solid var(--border)", background: "var(--surface)", color: "var(--foreground)", fontSize: "0.85rem" }}
              />
            </div>

            {/* Description */}
            <div>
              <label style={{ fontSize: "0.78rem", fontWeight: 600, marginBottom: "0.25rem", display: "block" }}>תיאור</label>
              <textarea value={taskForm.description} onChange={e => setTaskForm(f => ({ ...f, description: e.target.value }))}
                rows={3} placeholder="תיאור המשימה..."
                style={{ width: "100%", padding: "0.45rem 0.6rem", borderRadius: "0.375rem", border: "1px solid var(--border)", background: "var(--surface)", color: "var(--foreground)", fontSize: "0.85rem", resize: "vertical" }}
              />
            </div>

            {/* Row: Employee + Client */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
              <div>
                <label style={{ fontSize: "0.78rem", fontWeight: 600, marginBottom: "0.25rem", display: "block" }}>עובד אחראי</label>
                <select value={taskForm.assignedEmployeeId} onChange={e => setTaskForm(f => ({ ...f, assignedEmployeeId: e.target.value }))}
                  style={{ width: "100%", padding: "0.45rem 0.6rem", borderRadius: "0.375rem", border: "1px solid var(--border)", background: "var(--surface)", color: "var(--foreground)", fontSize: "0.85rem" }}>
                  <option value="">בחר עובד</option>
                  {(employees || []).map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: "0.78rem", fontWeight: 600, marginBottom: "0.25rem", display: "block" }}>לקוח</label>
                <select value={taskForm.clientId} onChange={e => {
                  const c = (clients || []).find(cl => cl.id === e.target.value);
                  setTaskForm(f => ({ ...f, clientId: e.target.value, clientName: c?.name || "" }));
                }}
                  style={{ width: "100%", padding: "0.45rem 0.6rem", borderRadius: "0.375rem", border: "1px solid var(--border)", background: "var(--surface)", color: "var(--foreground)", fontSize: "0.85rem" }}>
                  <option value="">בחר לקוח</option>
                  {(clients || []).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
            </div>

            {/* Row: Due date + Priority + Status */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0.75rem" }}>
              <div>
                <label style={{ fontSize: "0.78rem", fontWeight: 600, marginBottom: "0.25rem", display: "block" }}>תאריך יעד</label>
                <input type="date" value={taskForm.dueDate} onChange={e => setTaskForm(f => ({ ...f, dueDate: e.target.value }))}
                  style={{ width: "100%", padding: "0.45rem 0.6rem", borderRadius: "0.375rem", border: "1px solid var(--border)", background: "var(--surface)", color: "var(--foreground)", fontSize: "0.85rem" }}
                />
              </div>
              <div>
                <label style={{ fontSize: "0.78rem", fontWeight: 600, marginBottom: "0.25rem", display: "block" }}>עדיפות</label>
                <select value={taskForm.priority} onChange={e => setTaskForm(f => ({ ...f, priority: e.target.value as EmployeeTaskPriority }))}
                  style={{ width: "100%", padding: "0.45rem 0.6rem", borderRadius: "0.375rem", border: "1px solid var(--border)", background: "var(--surface)", color: "var(--foreground)", fontSize: "0.85rem" }}>
                  {Object.entries(PRIORITY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: "0.78rem", fontWeight: 600, marginBottom: "0.25rem", display: "block" }}>סטטוס</label>
                <select value={taskForm.status} onChange={e => setTaskForm(f => ({ ...f, status: e.target.value as EmployeeTaskStatus }))}
                  style={{ width: "100%", padding: "0.45rem 0.6rem", borderRadius: "0.375rem", border: "1px solid var(--border)", background: "var(--surface)", color: "var(--foreground)", fontSize: "0.85rem" }}>
                  {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
            </div>

            {/* Notes */}
            <div>
              <label style={{ fontSize: "0.78rem", fontWeight: 600, marginBottom: "0.25rem", display: "block" }}>הערות</label>
              <textarea value={taskForm.notes} onChange={e => setTaskForm(f => ({ ...f, notes: e.target.value }))}
                rows={2} placeholder="הערות נוספות..."
                style={{ width: "100%", padding: "0.45rem 0.6rem", borderRadius: "0.375rem", border: "1px solid var(--border)", background: "var(--surface)", color: "var(--foreground)", fontSize: "0.85rem", resize: "vertical" }}
              />
            </div>

            {/* Action buttons */}
            <div style={{ display: "flex", justifyContent: "flex-start", gap: "0.5rem", paddingTop: "0.5rem" }}>
              <button onClick={handleSaveTask} style={{
                padding: "0.5rem 1.5rem", borderRadius: "0.375rem", border: "none",
                background: "var(--accent)", color: "#fff", fontWeight: 600, cursor: "pointer", fontSize: "0.85rem",
              }}>
                {editingTask ? "עדכן" : "צור משימה"}
              </button>
              <button onClick={() => { setTaskModalOpen(false); resetForm(); }} style={{
                padding: "0.5rem 1.5rem", borderRadius: "0.375rem",
                border: "1px solid var(--border)", background: "var(--surface)", color: "var(--foreground)", cursor: "pointer", fontSize: "0.85rem",
              }}>
                ביטול
              </button>
            </div>
          </div>
        </Modal>

      {/* ════════════════════════════════════════════════════════
         MEETING MODAL
         ════════════════════════════════════════════════════════ */}
      <Modal open={meetingModalOpen} onClose={() => { setMeetingModalOpen(false); resetMeetingForm(); }} title={editingMeeting ? "עריכת פגישה" : "פגישה חדשה"}>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.85rem", maxWidth: 480, direction: "rtl" }}>

            {/* Title */}
            <div>
              <label style={{ fontSize: "0.78rem", fontWeight: 600, marginBottom: "0.25rem", display: "block" }}>כותרת *</label>
              <input value={meetingForm.title} onChange={e => setMeetingForm(f => ({ ...f, title: e.target.value }))}
                placeholder="שם הפגישה"
                style={{ width: "100%", padding: "0.45rem 0.6rem", borderRadius: "0.375rem", border: "1px solid var(--border)", background: "var(--surface)", color: "var(--foreground)", fontSize: "0.85rem" }}
              />
            </div>

            {/* Date + Start + End */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0.75rem" }}>
              <div>
                <label style={{ fontSize: "0.78rem", fontWeight: 600, marginBottom: "0.25rem", display: "block" }}>תאריך *</label>
                <input type="date" value={meetingForm.date} onChange={e => setMeetingForm(f => ({ ...f, date: e.target.value }))}
                  style={{ width: "100%", padding: "0.45rem 0.6rem", borderRadius: "0.375rem", border: "1px solid var(--border)", background: "var(--surface)", color: "var(--foreground)", fontSize: "0.85rem" }}
                />
              </div>
              <div>
                <label style={{ fontSize: "0.78rem", fontWeight: 600, marginBottom: "0.25rem", display: "block" }}>שעת התחלה</label>
                <input type="time" value={meetingForm.startTime} onChange={e => setMeetingForm(f => ({ ...f, startTime: e.target.value }))}
                  style={{ width: "100%", padding: "0.45rem 0.6rem", borderRadius: "0.375rem", border: "1px solid var(--border)", background: "var(--surface)", color: "var(--foreground)", fontSize: "0.85rem" }}
                />
              </div>
              <div>
                <label style={{ fontSize: "0.78rem", fontWeight: 600, marginBottom: "0.25rem", display: "block" }}>שעת סיום</label>
                <input type="time" value={meetingForm.endTime} onChange={e => setMeetingForm(f => ({ ...f, endTime: e.target.value }))}
                  style={{ width: "100%", padding: "0.45rem 0.6rem", borderRadius: "0.375rem", border: "1px solid var(--border)", background: "var(--surface)", color: "var(--foreground)", fontSize: "0.85rem" }}
                />
              </div>
            </div>

            {/* Description */}
            <div>
              <label style={{ fontSize: "0.78rem", fontWeight: 600, marginBottom: "0.25rem", display: "block" }}>תיאור</label>
              <textarea value={meetingForm.description} onChange={e => setMeetingForm(f => ({ ...f, description: e.target.value }))}
                rows={2} placeholder="פרטי הפגישה..."
                style={{ width: "100%", padding: "0.45rem 0.6rem", borderRadius: "0.375rem", border: "1px solid var(--border)", background: "var(--surface)", color: "var(--foreground)", fontSize: "0.85rem", resize: "vertical" }}
              />
            </div>

            {/* Client + Location */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
              <div>
                <label style={{ fontSize: "0.78rem", fontWeight: 600, marginBottom: "0.25rem", display: "block" }}>לקוח (אופציונלי)</label>
                <select value={meetingForm.clientId} onChange={e => {
                  const c = (clients || []).find(cl => cl.id === e.target.value);
                  setMeetingForm(f => ({ ...f, clientId: e.target.value, clientName: c?.name || "" }));
                }}
                  style={{ width: "100%", padding: "0.45rem 0.6rem", borderRadius: "0.375rem", border: "1px solid var(--border)", background: "var(--surface)", color: "var(--foreground)", fontSize: "0.85rem" }}>
                  <option value="">ללא לקוח</option>
                  {(clients || []).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: "0.78rem", fontWeight: 600, marginBottom: "0.25rem", display: "block" }}>מיקום / קישור</label>
                <input value={meetingForm.location} onChange={e => setMeetingForm(f => ({ ...f, location: e.target.value }))}
                  placeholder="כתובת או קישור Zoom..."
                  style={{ width: "100%", padding: "0.45rem 0.6rem", borderRadius: "0.375rem", border: "1px solid var(--border)", background: "var(--surface)", color: "var(--foreground)", fontSize: "0.85rem" }}
                />
              </div>
            </div>

            {/* Reminder settings */}
            <div>
              <label style={{ fontSize: "0.78rem", fontWeight: 600, marginBottom: "0.35rem", display: "block" }}>תזכורות</label>
              <div style={{ display: "flex", gap: "1rem" }}>
                <label style={{ display: "flex", alignItems: "center", gap: "0.35rem", fontSize: "0.8rem", cursor: "pointer" }}>
                  <input type="checkbox" checked={meetingForm.reminderDayBefore}
                    onChange={e => setMeetingForm(f => ({ ...f, reminderDayBefore: e.target.checked }))} />
                  יום לפני
                </label>
                <label style={{ display: "flex", alignItems: "center", gap: "0.35rem", fontSize: "0.8rem", cursor: "pointer" }}>
                  <input type="checkbox" checked={meetingForm.reminderSameDay}
                    onChange={e => setMeetingForm(f => ({ ...f, reminderSameDay: e.target.checked }))} />
                  ביום הפגישה
                </label>
              </div>
            </div>

            {/* Status (for editing) */}
            {editingMeeting && (
              <div>
                <label style={{ fontSize: "0.78rem", fontWeight: 600, marginBottom: "0.25rem", display: "block" }}>סטטוס</label>
                <select value={meetingForm.status} onChange={e => setMeetingForm(f => ({ ...f, status: e.target.value as MeetingStatus }))}
                  style={{ width: "100%", padding: "0.45rem 0.6rem", borderRadius: "0.375rem", border: "1px solid var(--border)", background: "var(--surface)", color: "var(--foreground)", fontSize: "0.85rem" }}>
                  <option value="scheduled">מתוכננת</option>
                  <option value="completed">הושלמה</option>
                  <option value="cancelled">בוטלה</option>
                </select>
              </div>
            )}

            {/* Action buttons */}
            <div style={{ display: "flex", justifyContent: "flex-start", gap: "0.5rem", paddingTop: "0.5rem" }}>
              <button onClick={handleSaveMeeting} style={{
                padding: "0.5rem 1.5rem", borderRadius: "0.375rem", border: "none",
                background: "#06b6d4", color: "#fff", fontWeight: 600, cursor: "pointer", fontSize: "0.85rem",
              }}>
                {editingMeeting ? "עדכן" : "צור פגישה"}
              </button>
              <button onClick={() => { setMeetingModalOpen(false); resetMeetingForm(); }} style={{
                padding: "0.5rem 1.5rem", borderRadius: "0.375rem",
                border: "1px solid var(--border)", background: "var(--surface)", color: "var(--foreground)", cursor: "pointer", fontSize: "0.85rem",
              }}>
                ביטול
              </button>
            </div>
          </div>
        </Modal>
    </div>
  );
}


/* ════════════════════════════════════════════════════════════════
   TASKS LIST SUB-COMPONENT
   ════════════════════════════════════════════════════════════════ */
interface TasksListViewProps {
  tasks: EmployeeTask[];
  employees: { id: string; name: string }[];
  clients: { id: string; name: string }[];
  onEdit: (t: EmployeeTask) => void;
  onDelete: (id: string) => void;
  onStatusChange: (id: string, status: EmployeeTaskStatus) => void;
  emptyMessage: string;
  emptyIcon: string;
}

function TasksListView({ tasks, employees, clients, onEdit, onDelete, onStatusChange, emptyMessage, emptyIcon }: TasksListViewProps) {
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<"dueDate" | "priority" | "status">("dueDate");
  const [filterEmployee, setFilterEmployee] = useState("");
  const [filterClient, setFilterClient] = useState("");

  const priorityOrder: Record<string, number> = { urgent: 0, high: 1, medium: 2, low: 3 };
  const statusOrder: Record<string, number> = { new: 0, in_progress: 1, under_review: 2, returned: 3, approved: 4, completed: 5 };

  const filtered = useMemo(() => {
    let list = [...tasks];
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(t => t.title.toLowerCase().includes(q) || (t.clientName || "").toLowerCase().includes(q) || (t.description || "").toLowerCase().includes(q));
    }
    if (filterEmployee) list = list.filter(t => t.assignedEmployeeId === filterEmployee);
    if (filterClient) list = list.filter(t => t.clientId === filterClient);

    list.sort((a, b) => {
      if (sortBy === "dueDate") {
        if (!a.dueDate) return 1;
        if (!b.dueDate) return -1;
        return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
      }
      if (sortBy === "priority") return (priorityOrder[a.priority] ?? 9) - (priorityOrder[b.priority] ?? 9);
      return (statusOrder[a.status] ?? 9) - (statusOrder[b.status] ?? 9);
    });
    return list;
  }, [tasks, search, filterEmployee, filterClient, sortBy]);

  const now = new Date();

  if (tasks.length === 0) {
    return (
      <div style={{ textAlign: "center", padding: "3rem", color: "var(--foreground-muted)" }}>
        <div style={{ fontSize: "2.5rem", marginBottom: "0.5rem" }}>{emptyIcon}</div>
        <div>{emptyMessage}</div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
      {/* Filters bar */}
      <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", alignItems: "center" }}>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="חיפוש משימות..."
          style={{ flex: "1 1 200px", padding: "0.4rem 0.6rem", borderRadius: "0.375rem", border: "1px solid var(--border)", background: "var(--surface)", color: "var(--foreground)", fontSize: "0.82rem" }}
        />
        <select value={filterEmployee} onChange={e => setFilterEmployee(e.target.value)}
          style={{ padding: "0.4rem 0.6rem", borderRadius: "0.375rem", border: "1px solid var(--border)", background: "var(--surface)", color: "var(--foreground)", fontSize: "0.82rem" }}>
          <option value="">כל העובדים</option>
          {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
        </select>
        <select value={filterClient} onChange={e => setFilterClient(e.target.value)}
          style={{ padding: "0.4rem 0.6rem", borderRadius: "0.375rem", border: "1px solid var(--border)", background: "var(--surface)", color: "var(--foreground)", fontSize: "0.82rem" }}>
          <option value="">כל הלקוחות</option>
          {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select value={sortBy} onChange={e => setSortBy(e.target.value as typeof sortBy)}
          style={{ padding: "0.4rem 0.6rem", borderRadius: "0.375rem", border: "1px solid var(--border)", background: "var(--surface)", color: "var(--foreground)", fontSize: "0.82rem" }}>
          <option value="dueDate">מיון: תאריך</option>
          <option value="priority">מיון: עדיפות</option>
          <option value="status">מיון: סטטוס</option>
        </select>
      </div>

      {/* Task rows */}
      {filtered.map(task => {
        const emp = employees.find(e => e.id === task.assignedEmployeeId);
        const isOverdue = task.dueDate && new Date(task.dueDate) < now && task.status !== "completed";
        return (
          <div key={task.id} style={{
            display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr auto",
            gap: "0.5rem", alignItems: "center",
            padding: "0.7rem 1rem", borderRadius: "0.5rem",
            background: "var(--surface)", border: "1px solid var(--border)",
            borderInlineStart: `3px solid ${STATUS_COLORS[task.status] || "#666"}`,
          }}>
            {/* Title + description */}
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 600, fontSize: "0.85rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{task.title}</div>
              {task.clientName && <div style={{ fontSize: "0.72rem", color: "var(--foreground-muted)" }}>{task.clientName}</div>}
            </div>

            {/* Employee */}
            <div style={{ fontSize: "0.78rem", color: "var(--foreground-muted)" }}>
              {emp?.name || "—"}
            </div>

            {/* Due date */}
            <div style={{ fontSize: "0.78rem", color: isOverdue ? "#ef4444" : "var(--foreground-muted)", fontWeight: isOverdue ? 600 : 400 }}>
              {task.dueDate ? new Date(task.dueDate).toLocaleDateString("he-IL") : "—"}
              {isOverdue && " ⚠️"}
            </div>

            {/* Priority */}
            <span style={{
              fontSize: "0.68rem", padding: "0.15rem 0.5rem", borderRadius: 999, textAlign: "center",
              background: PRIORITY_COLORS[task.priority] || "#666", color: "#fff", fontWeight: 600,
            }}>
              {PRIORITY_LABELS[task.priority]}
            </span>

            {/* Status */}
            <span style={{
              fontSize: "0.68rem", padding: "0.15rem 0.5rem", borderRadius: 999, textAlign: "center",
              background: STATUS_COLORS[task.status] || "#666", color: "#fff", fontWeight: 600,
            }}>
              {STATUS_LABELS[task.status]}
            </span>

            {/* Actions */}
            <div style={{ display: "flex", gap: "0.25rem" }}>
              {task.status !== "completed" && (
                <button onClick={() => onStatusChange(task.id, "completed")} title="סמן כהושלם" style={{
                  width: 28, height: 28, borderRadius: "0.25rem", border: "1px solid var(--border)",
                  background: "transparent", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                  color: "#10b981", fontSize: "0.85rem",
                }}>
                  ✓
                </button>
              )}
              <button onClick={() => onEdit(task)} title="ערוך" style={{
                width: 28, height: 28, borderRadius: "0.25rem", border: "1px solid var(--border)",
                background: "transparent", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                color: "var(--foreground-muted)", fontSize: "0.75rem",
              }}>
                ✏
              </button>
              <button onClick={() => onDelete(task.id)} title="מחק" style={{
                width: 28, height: 28, borderRadius: "0.25rem", border: "1px solid var(--border)",
                background: "transparent", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                color: "#ef4444", fontSize: "0.75rem",
              }}>
                🗑
              </button>
            </div>
          </div>
        );
      })}

      <div style={{ textAlign: "center", fontSize: "0.75rem", color: "var(--foreground-muted)", paddingTop: "0.5rem" }}>
        {filtered.length} משימות מוצגות מתוך {tasks.length}
      </div>
    </div>
  );
}
