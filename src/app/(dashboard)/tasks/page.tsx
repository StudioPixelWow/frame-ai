"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useTasks, useEmployees, useClients, useEmployeeTasks } from "@/lib/api/use-entity";
import { useToast } from "@/components/ui/toast";
import { Modal } from "@/components/ui/modal";
import type { Task } from "@/lib/db/schema";

const COLUMNS = [
  { id: "new", label: "חדש", color: "#3b82f6" },
  { id: "in_progress", label: "בעבודה", color: "#fbbf24" },
  { id: "under_review", label: "בבדיקה", color: "#a78bfa" },
  { id: "returned", label: "הוחזר לתיקון", color: "#f97316" },
  { id: "approved", label: "אושר", color: "#22c55e" },
  { id: "completed", label: "הושלם", color: "#10b981" },
] as const;

const PRIORITIES = [
  { id: "urgent", label: "דחוף", color: "#ef4444" },
  { id: "high", label: "גבוה", color: "#f59e0b" },
  { id: "medium", label: "בינוני", color: "#38bdf8" },
  { id: "low", label: "נמוך", color: "#6b7280" },
] as const;

export default function TasksPage() {
  const { data: tasks, loading, create, update, remove } = useTasks();
  const { data: employeeTasks, loading: employeeTasksLoading } = useEmployeeTasks();
  const { data: employees } = useEmployees();
  const TEAM_MEMBERS = ["טל זטלמן", "מאיה זטלמן", "נועם בוברין", "מיכאלה"];
  const teamEmployees = useMemo(() => (employees || []).filter(e => TEAM_MEMBERS.includes(e.name)), [employees]);
  const { data: clients } = useClients();
  const toast = useToast();

  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [defaultStatus, setDefaultStatus] = useState<Task["status"]>("new");
  const [viewMode, setViewMode] = useState<'board' | 'by_employee'>('board');
  const [expandedEmployees, setExpandedEmployees] = useState<Set<string>>(new Set());
  const [filterEmployee, setFilterEmployee] = useState("");
  const [filterClient, setFilterClient] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterDateRange, setFilterDateRange] = useState("all");

  const [form, setForm] = useState({
    title: "", description: "", status: "new" as Task["status"],
    priority: "medium" as Task["priority"], clientId: "",
    clientName: "", dueDate: "", tags: "",
    assigneeIds: [] as string[],
    files: [] as string[],
    notes: "",
  });

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadingTaskId, setUploadingTaskId] = useState<string | null>(null);
  const [showReviewNotes, setShowReviewNotes] = useState(false);
  const [reviewNotes, setReviewNotes] = useState("");
  const [autoAssignmentNote, setAutoAssignmentNote] = useState("");

  // Auto-assign employee when client is selected
  useEffect(() => {
    if (form.clientId && !editingTask) {
      const selectedClient = clients.find(c => c.id === form.clientId);
      if (selectedClient?.assignedManagerId) {
        setForm(prev => ({
          ...prev,
          assigneeIds: [selectedClient.assignedManagerId!]
        }));
        setAutoAssignmentNote("עובד אחראי הוקצה אוטומטית");
      } else {
        setForm(prev => ({
          ...prev,
          assigneeIds: []
        }));
        setAutoAssignmentNote("");
      }
    }
  }, [form.clientId, editingTask, clients]);

  const openCreate = (status: Task["status"] = "new") => {
    setEditingTask(null);
    setDefaultStatus(status);
    setForm({ title: "", description: "", status, priority: "medium", clientId: "", clientName: "", dueDate: "", tags: "", assigneeIds: [], files: [], notes: "" });
    setModalOpen(true);
  };

  // Helper: derive client name from clients array (API may not return clientName)
  const getClientName = (task: Task): string => {
    if (task.clientName) return task.clientName;
    if (task.clientId) {
      const c = clients.find(cl => cl.id === task.clientId);
      return c?.name || '';
    }
    return '';
  };

  const openEdit = (task: Task) => {
    setEditingTask(task);
    // Defensive: task.tags / task.assigneeIds may be undefined if API doesn't return them
    const tags = Array.isArray(task.tags) ? task.tags : [];
    const assigneeIds = Array.isArray(task.assigneeIds)
      ? task.assigneeIds
      : ((task as any).assigneeId ? [(task as any).assigneeId] : []);
    setForm({
      title: task.title || '',
      description: task.description || '',
      status: task.status,
      priority: task.priority || 'medium',
      clientId: task.clientId || '',
      clientName: getClientName(task),
      dueDate: task.dueDate || '',
      tags: tags.join(', '),
      assigneeIds,
      files: Array.isArray((task as any).files) ? (task as any).files : [],
      notes: (task as any).notes || '',
    });
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!form.title.trim()) { toast("כותרת המשימה היא שדה חובה", "error"); return; }
    const client = clients.find((c) => c.id === form.clientId);
    const payload = {
      ...form,
      clientName: client?.name || form.clientName,
      dueDate: form.dueDate || null,
      tags: form.tags ? form.tags.split(",").map((t) => t.trim()).filter(Boolean) : [],
      files: form.files,
      notes: form.notes,
    };
    try {
      if (editingTask) {
        await update(editingTask.id, payload);
        toast("המשימה עודכנה", "success");
      } else {
        await create(payload);
        toast("משימה חדשה נוצרה", "success");
      }
      setModalOpen(false);
      setReviewNotes("");
    } catch {
      toast("שגיאה בשמירה", "error");
    }
  };

  const handleStatusChange = async (taskId: string, newStatus: Task["status"]) => {
    await update(taskId, { status: newStatus });
  };

  const handleSendForReview = async () => {
    if (!editingTask) return;
    try {
      await update(editingTask.id, { status: "under_review" });
      toast("המשימה נשלחה לבדיקה", "success");
      setEditingTask({ ...editingTask, status: "under_review" });
      setForm(prev => ({ ...prev, status: "under_review" }));
    } catch {
      toast("שגיאה בשליחה לבדיקה", "error");
    }
  };

  const handleReturnForChanges = async () => {
    if (!editingTask || !reviewNotes.trim()) {
      toast("יש להוסיף הערות בחזרה", "error");
      return;
    }
    try {
      await update(editingTask.id, { status: "returned", notes: reviewNotes });
      toast("המשימה הוחזרה לעובד", "success");
      setEditingTask({ ...editingTask, status: "returned", notes: reviewNotes } as any);
      setForm(prev => ({ ...prev, status: "returned", notes: reviewNotes }));
      setShowReviewNotes(false);
      setReviewNotes("");
    } catch {
      toast("שגיאה בהחזרה לעובד", "error");
    }
  };

  const handleApproveTask = async () => {
    if (!editingTask) return;
    try {
      await update(editingTask.id, { status: "approved" });
      toast("המשימה אושרה", "success");
      setEditingTask({ ...editingTask, status: "approved" });
      setForm(prev => ({ ...prev, status: "approved" }));
    } catch {
      toast("שגיאה באישור", "error");
    }
  };

  const handleAddFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const newFiles = [...form.files, file.name];
      setForm({ ...form, files: newFiles });
      toast(`קובץ ${file.name} נוסף`, "success");
    }
  };

  const handleRemoveFile = (index: number) => {
    const newFiles = form.files.filter((_, i) => i !== index);
    setForm({ ...form, files: newFiles });
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
    }
  };

  const handleFileUpload = async () => {
    if (!selectedFile || !uploadingTaskId) return;

    try {
      await update(uploadingTaskId, { status: "under_review" as Task["status"] });
      toast("הקובץ הועלה והמשימה עברה לבדיקה", "success");
      setSelectedFile(null);
      setUploadingTaskId(null);

      const fileInput = document.querySelector(`input[data-task="${uploadingTaskId}"]`) as HTMLInputElement;
      if (fileInput) fileInput.value = "";
    } catch {
      toast("שגיאה בהעלאת קובץ", "error");
    }
  };

  // Calculate today's date for task filtering
  const today = new Date().toISOString().split('T')[0];
  const getWeekStart = () => {
    const d = new Date();
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    const weekStart = new Date(d.setDate(diff)).toISOString().split('T')[0];
    return weekStart;
  };

  // Filter function with all criteria
  const applyFilters = (tasksToFilter: any[]) => {
    return tasksToFilter.filter((t) => {
      // Search filter
      if (search) {
        const q = search.toLowerCase();
        if (!t.title?.toLowerCase().includes(q) && !t.clientName?.toLowerCase().includes(q) && !(t.tags || []).some((tag: string) => tag.toLowerCase().includes(q))) {
          return false;
        }
      }

      // Employee filter — handle both assigneeIds (array) and assigneeId (string)
      if (filterEmployee) {
        const ids = Array.isArray(t.assigneeIds) ? t.assigneeIds : [];
        const singleId = t.assigneeId || t.assignedEmployeeId || '';
        if (!ids.includes(filterEmployee) && singleId !== filterEmployee) {
          return false;
        }
      }

      // Client filter
      if (filterClient && t.clientId !== filterClient) {
        return false;
      }

      // Status filter
      if (filterStatus && t.status !== filterStatus) {
        return false;
      }

      // Date range filter
      if (filterDateRange !== 'all') {
        if (filterDateRange === 'today' && t.dueDate !== today) {
          return false;
        }
        if (filterDateRange === 'this_week') {
          const weekStart = getWeekStart();
          if (!t.dueDate || t.dueDate < weekStart || t.dueDate > today) {
            return false;
          }
        }
        if (filterDateRange === 'overdue') {
          if (!t.dueDate || t.dueDate >= today) {
            return false;
          }
        }
      }

      return true;
    });
  };

  // Build client name lookup map for rendering
  const clientNameMap = useMemo(() => {
    const map = new Map<string, string>();
    clients.forEach(c => map.set(c.id, c.name));
    return map;
  }, [clients]);

  // Helper to resolve clientName (may not come from API)
  const resolveClientName = (task: any): string => {
    if (task.clientName) return task.clientName;
    if (task.clientId) return clientNameMap.get(task.clientId) || '';
    return '';
  };

  const filtered = applyFilters(tasks);
  const filteredEmployeeTasks = applyFilters(employeeTasks || []);

  const todayTasks = filtered.filter(t => t.dueDate === today && t.status !== 'completed' && t.status !== 'approved');
  const overdueTasks = filtered.filter(t => t.dueDate && t.dueDate < today && t.status !== 'completed' && t.status !== 'approved');

  const toggleEmployeeExpand = (employeeId: string) => {
    const newExpanded = new Set(expandedEmployees);
    if (newExpanded.has(employeeId)) {
      newExpanded.delete(employeeId);
    } else {
      newExpanded.add(employeeId);
    }
    setExpandedEmployees(newExpanded);
  };

  const getEmployeeTaskCount = (employeeId: string) => {
    const empTasks = filtered.filter((t: any) => {
      const ids = Array.isArray(t.assigneeIds) ? t.assigneeIds : [];
      return ids.includes(employeeId) || t.assigneeId === employeeId;
    });
    const empTasksFromOther = filteredEmployeeTasks.filter((t: any) => t.assignedEmployeeId === employeeId);
    return empTasks.length + empTasksFromOther.length;
  };

  return (
    <div className="tasks-page">
      {/* Header */}
      <div className="tasks-header">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "0.75rem" }}>
          <div className="mod-page-title">✅ לוח משימות</div>
          <div style={{ display: "flex", gap: "0.6rem", alignItems: "center", flexWrap: "wrap" }}>
            <input className="mod-search" placeholder="🔍 חיפוש משימה..." value={search} onChange={(e) => setSearch(e.target.value)} />
            <button className="mod-btn-primary" onClick={() => openCreate("new")}>+ משימה חדשה</button>
          </div>
        </div>
      </div>

      {/* View Mode Toggle */}
      <div style={{ marginBottom: "1rem", display: "flex", gap: "0.5rem", alignItems: "center", flexWrap: "wrap" }}>
        <div style={{ display: "flex", border: "1px solid var(--border)", borderRadius: "0.5rem", overflow: "hidden" }}>
          <button
            onClick={() => setViewMode('board')}
            style={{
              flex: 1,
              padding: "0.5rem 1rem",
              background: viewMode === 'board' ? "var(--accent)" : "transparent",
              color: viewMode === 'board' ? "white" : "var(--foreground)",
              border: "none",
              cursor: "pointer",
              fontSize: "0.875rem",
              fontWeight: 500,
              transition: "all 0.2s",
            }}
          >
            לוח
          </button>
          <button
            onClick={() => setViewMode('by_employee')}
            style={{
              flex: 1,
              padding: "0.5rem 1rem",
              background: viewMode === 'by_employee' ? "var(--accent)" : "transparent",
              color: viewMode === 'by_employee' ? "white" : "var(--foreground)",
              border: "none",
              borderRight: "1px solid var(--border)",
              cursor: "pointer",
              fontSize: "0.875rem",
              fontWeight: 500,
              transition: "all 0.2s",
            }}
          >
            לפי עובד
          </button>
        </div>
      </div>

      {/* Global Filters */}
      <div style={{ marginBottom: "1rem", display: "flex", gap: "0.75rem", alignItems: "center", flexWrap: "wrap", background: "var(--surface-raised)", padding: "0.75rem", borderRadius: "0.75rem", border: "1px solid var(--border)" }}>
        <span style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--foreground-muted)" }}>סינון:</span>

        <select
          value={filterEmployee}
          onChange={(e) => setFilterEmployee(e.target.value)}
          style={{
            padding: "0.4rem 0.6rem",
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: "0.375rem",
            color: "var(--foreground)",
            fontSize: "0.875rem",
            cursor: "pointer",
          }}
        >
          <option value="">כל העובדים</option>
          {teamEmployees.map((emp) => (
            <option key={emp.id} value={emp.id}>{emp.name}</option>
          ))}
        </select>

        <select
          value={filterClient}
          onChange={(e) => setFilterClient(e.target.value)}
          style={{
            padding: "0.4rem 0.6rem",
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: "0.375rem",
            color: "var(--foreground)",
            fontSize: "0.875rem",
            cursor: "pointer",
          }}
        >
          <option value="">כל הלקוחות</option>
          {clients.map((client) => (
            <option key={client.id} value={client.id}>{client.name}</option>
          ))}
        </select>

        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          style={{
            padding: "0.4rem 0.6rem",
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: "0.375rem",
            color: "var(--foreground)",
            fontSize: "0.875rem",
            cursor: "pointer",
          }}
        >
          <option value="">כל הסטטוסים</option>
          {COLUMNS.map((col) => (
            <option key={col.id} value={col.id}>{col.label}</option>
          ))}
        </select>

        <select
          value={filterDateRange}
          onChange={(e) => setFilterDateRange(e.target.value)}
          style={{
            padding: "0.4rem 0.6rem",
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: "0.375rem",
            color: "var(--foreground)",
            fontSize: "0.875rem",
            cursor: "pointer",
          }}
        >
          <option value="all">כל התאריכים</option>
          <option value="today">היום</option>
          <option value="this_week">השבוע</option>
          <option value="overdue">בעיכוב</option>
        </select>

        {(filterEmployee || filterClient || filterStatus || filterDateRange !== 'all') && (
          <button
            onClick={() => {
              setFilterEmployee("");
              setFilterClient("");
              setFilterStatus("");
              setFilterDateRange("all");
            }}
            style={{
              padding: "0.4rem 0.75rem",
              background: "transparent",
              border: "1px solid var(--border)",
              borderRadius: "0.375rem",
              color: "var(--foreground-muted)",
              fontSize: "0.875rem",
              cursor: "pointer",
              transition: "all 0.2s",
            }}
          >
            ✕ נקה סינון
          </button>
        )}
      </div>

      {/* Today's Tasks Section */}
      {!loading && (todayTasks.length > 0 || overdueTasks.length > 0) && (
        <div style={{ marginBottom: "2rem", background: "var(--surface-raised)", border: "1px solid var(--border)", borderRadius: "0.75rem", padding: "1rem" }}>
          <div style={{ fontSize: "0.9rem", fontWeight: 700, marginBottom: "1rem", color: "var(--foreground)" }}>
            📅 משימות להיום
          </div>
          <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
            {/* Overdue Tasks */}
            {overdueTasks.map((task) => {
              const pri = PRIORITIES.find((p) => p.id === task.priority);
              return (
                <div
                  key={task.id}
                  onClick={() => openEdit(task)}
                  style={{
                    flex: "0 1 auto",
                    minWidth: "200px",
                    padding: "0.75rem",
                    background: "var(--surface)",
                    border: "2px solid #f87171",
                    borderRadius: "0.5rem",
                    cursor: "pointer",
                    transition: "all 0.2s",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.transform = 'translateY(-2px)')}
                  onMouseLeave={(e) => (e.currentTarget.style.transform = 'translateY(0)')}
                >
                  <div style={{ fontSize: "0.875rem", fontWeight: 700, marginBottom: "0.25rem", color: "#f87171" }}>
                    ⚠️ {task.title}
                  </div>
                  <div style={{ fontSize: "0.75rem", display: "flex", gap: "0.5rem", alignItems: "center", color: "var(--foreground-muted)" }}>
                    {resolveClientName(task) && <span>{resolveClientName(task)}</span>}
                    <span style={{ display: "inline-block", padding: "0.125rem 0.375rem", background: pri?.color || "#6b7280", borderRadius: "2px", color: "#fff", fontSize: "0.65rem" }}>
                      {PRIORITIES.find(p => p.id === task.priority)?.label}
                    </span>
                  </div>
                </div>
              );
            })}
            {/* Today's Tasks */}
            {todayTasks.map((task) => {
              const pri = PRIORITIES.find((p) => p.id === task.priority);
              return (
                <div
                  key={task.id}
                  onClick={() => openEdit(task)}
                  style={{
                    flex: "0 1 auto",
                    minWidth: "200px",
                    padding: "0.75rem",
                    background: "var(--surface)",
                    border: "1px solid var(--border)",
                    borderRadius: "0.5rem",
                    cursor: "pointer",
                    transition: "all 0.2s",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.transform = 'translateY(-2px)')}
                  onMouseLeave={(e) => (e.currentTarget.style.transform = 'translateY(0)')}
                >
                  <div style={{ fontSize: "0.875rem", fontWeight: 700, marginBottom: "0.25rem" }}>
                    {task.title}
                  </div>
                  <div style={{ fontSize: "0.75rem", display: "flex", gap: "0.5rem", alignItems: "center", color: "var(--foreground-muted)" }}>
                    {resolveClientName(task) && <span>{resolveClientName(task)}</span>}
                    <span style={{ display: "inline-block", padding: "0.125rem 0.375rem", background: pri?.color || "#6b7280", borderRadius: "2px", color: "#fff", fontSize: "0.65rem" }}>
                      {PRIORITIES.find(p => p.id === task.priority)?.label}
                    </span>
                    <span style={{ display: "inline-block", padding: "0.125rem 0.375rem", background: COLUMNS.find(c => c.id === task.status)?.color || "#6b7280", borderRadius: "2px", color: "#fff", fontSize: "0.65rem" }}>
                      {COLUMNS.find(c => c.id === task.status)?.label}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Kanban Board View */}
      {viewMode === 'board' && (
        <>
          {loading ? (
            <div className="mod-empty"><div>טוען...</div></div>
          ) : (
            <>
              <div style={{ fontSize: "0.9rem", fontWeight: 700, marginBottom: "1rem", color: "var(--foreground)" }}>
                📋 משימות כלליות
              </div>
              <div className="tasks-board">
              {COLUMNS.map((col) => {
                const colTasks = filtered.filter((t) => t.status === col.id);
                return (
                  <div key={col.id} className="tasks-col">
                    <div className="tasks-col-header">
                      <div className="tasks-col-title" style={{ color: col.color }}>
                        {col.label}
                        <span className="tasks-col-count">{colTasks.length}</span>
                      </div>
                    </div>
                    <div className="tasks-col-body">
                      {colTasks.map((task) => {
                        const pri = PRIORITIES.find((p) => p.id === task.priority);
                        const isUploading = uploadingTaskId === task.id;
                        const taskClientName = resolveClientName(task);
                        const isOverdue = task.dueDate && new Date(task.dueDate) < new Date() && task.status !== "completed" && task.status !== "approved";
                        const assigneeNames = (Array.isArray(task.assigneeIds) ? task.assigneeIds : [])
                          .map(id => teamEmployees.find(e => e.id === id)?.name)
                          .filter(Boolean);
                        return (
                          <div key={task.id} style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                            <div
                              className="task-card"
                              onClick={() => openEdit(task)}
                              style={isOverdue ? { borderRight: '3px solid #f87171' } : undefined}
                            >
                              <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", marginBottom: "0.2rem" }}>
                                <span style={{ display: "inline-block", width: "8px", height: "8px", borderRadius: "50%", background: pri?.color || "#6b7280", flexShrink: 0 }} />
                                <span className="task-card-title" style={{ margin: 0, flex: 1 }}>{task.title}</span>
                              </div>
                              <div className="task-card-meta">
                                {taskClientName && <span>{taskClientName}</span>}
                                {task.dueDate && (
                                  <span style={{ color: isOverdue ? "#f87171" : "inherit", fontWeight: isOverdue ? 600 : 400 }}>
                                    {isOverdue ? '⚠ ' : ''}
                                    {new Date(task.dueDate).toLocaleDateString("he-IL", { day: "numeric", month: "short" })}
                                  </span>
                                )}
                              </div>
                              {assigneeNames.length > 0 && (
                                <div style={{ fontSize: "0.68rem", color: "var(--foreground-muted)", marginTop: "0.2rem" }}>
                                  👤 {assigneeNames.join(', ')}
                                </div>
                              )}
                              {Array.isArray(task.tags) && task.tags.length > 0 && (
                                <div style={{ display: "flex", gap: "0.25rem", flexWrap: "wrap", marginTop: "0.3rem" }}>
                                  {task.tags.slice(0, 3).map((tag: string) => (
                                    <span key={tag} className="task-tag">{tag}</span>
                                  ))}
                                </div>
                              )}
                            </div>

                            {/* File Upload Section */}
                            {isUploading && (
                              <div style={{
                                background: "var(--surface-raised)",
                                border: "2px dashed var(--border-muted)",
                                borderRadius: "0.5rem",
                                padding: "0.75rem",
                                display: "flex",
                                flexDirection: "column",
                                gap: "0.5rem",
                              }}>
                                <label style={{ fontSize: "0.7rem", fontWeight: 600, color: "var(--foreground-muted)" }}>
                                  העלאת קובץ
                                </label>
                                <input
                                  data-task={task.id}
                                  type="file"
                                  accept="image/*,video/*,.pdf,.doc,.docx"
                                  onChange={handleFileSelect}
                                  style={{
                                    fontSize: "0.75rem",
                                    padding: "0.25rem",
                                    background: "var(--surface)",
                                    border: "1px solid var(--border)",
                                    borderRadius: "0.375rem",
                                    color: "var(--foreground)",
                                  }}
                                />
                                {selectedFile && (
                                  <div style={{ fontSize: "0.7rem", color: "var(--accent-text)", wordBreak: "break-word" }}>
                                    ✓ {selectedFile.name}
                                  </div>
                                )}
                                <div style={{ display: "flex", gap: "0.5rem" }}>
                                  <button
                                    className="mod-btn-primary"
                                    onClick={handleFileUpload}
                                    disabled={!selectedFile}
                                    style={{ flex: 1, fontSize: "0.7rem", padding: "0.4rem 0.5rem" }}
                                  >
                                    העלה
                                  </button>
                                  <button
                                    className="mod-btn-ghost"
                                    onClick={() => {
                                      setUploadingTaskId(null);
                                      setSelectedFile(null);
                                    }}
                                    style={{ flex: 1, fontSize: "0.7rem", padding: "0.4rem 0.5rem" }}
                                  >
                                    ביטול
                                  </button>
                                </div>
                              </div>
                            )}

                            {/* Upload Button (only show when not uploading) */}
                            {!isUploading && (
                              <button
                                className="mod-btn-ghost"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setUploadingTaskId(task.id);
                                  setSelectedFile(null);
                                }}
                                style={{ fontSize: "0.7rem", padding: "0.4rem 0.5rem" }}
                              >
                                📎 העלאת קובץ
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                    <button className="tasks-add-btn" onClick={() => openCreate(col.id as Task["status"])}>+ הוסף משימה</button>
                  </div>
                );
              })}
            </div>
            </>
          )}
        </>
      )}

      {/* Employee-Based View */}
      {viewMode === 'by_employee' && (
        <>
          {loading && employeeTasksLoading ? (
            <div className="mod-empty"><div>טוען...</div></div>
          ) : (
            <>
              <div style={{ fontSize: "0.9rem", fontWeight: 700, marginBottom: "1rem", color: "var(--foreground)" }}>
                👥 משימות לפי עובד
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                {/* Unassigned Tasks Section */}
                {filtered.filter(t => (!Array.isArray(t.assigneeIds) || t.assigneeIds.length === 0) && !t.assigneeId).length > 0 && (
                  <div style={{ background: "var(--surface-raised)", border: "1px solid var(--border)", borderRadius: "0.75rem", overflow: "hidden" }}>
                    <div
                      onClick={() => toggleEmployeeExpand('unassigned')}
                      style={{
                        padding: "0.75rem",
                        background: "var(--surface)",
                        borderBottom: "1px solid var(--border)",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: "0.5rem",
                        fontWeight: 600,
                        transition: "all 0.2s",
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--surface-raised)')}
                      onMouseLeave={(e) => (e.currentTarget.style.background = 'var(--surface)')}
                    >
                      <span>{expandedEmployees.has('unassigned') ? '▼' : '▶'}</span>
                      <span style={{ fontSize: "0.875rem" }}>👤 משימות ללא הקצאה</span>
                      <span style={{ marginLeft: "auto", fontSize: "0.75rem", background: "var(--accent)", color: "white", padding: "0.2rem 0.5rem", borderRadius: "2px" }}>
                        {filtered.filter(t => (!Array.isArray(t.assigneeIds) || t.assigneeIds.length === 0) && !t.assigneeId).length}
                      </span>
                    </div>
                    {expandedEmployees.has('unassigned') && (
                      <div style={{ padding: "1rem", display: "flex", flexDirection: "column", gap: "1rem" }}>
                        {/* Status Groups */}
                        {["today_tasks", "in_progress", "under_review", "returned", "approved", "completed"].map((statusGroup) => {
                          let statusTasks = filtered.filter(t => (!Array.isArray(t.assigneeIds) || t.assigneeIds.length === 0) && !t.assigneeId);

                          if (statusGroup === "today_tasks") {
                            statusTasks = statusTasks.filter(t => t.dueDate === today && t.status !== 'completed' && t.status !== 'approved');
                          } else {
                            statusTasks = statusTasks.filter(t => t.status === statusGroup);
                          }

                          if (statusTasks.length === 0) return null;

                          const statusLabel = statusGroup === "today_tasks" ? "להיום" : COLUMNS.find(c => c.id === statusGroup)?.label || statusGroup;

                          return (
                            <div key={statusGroup}>
                              <div style={{ fontSize: "0.8rem", fontWeight: 600, marginBottom: "0.5rem", color: "var(--foreground-muted)" }}>
                                {statusLabel} ({statusTasks.length})
                              </div>
                              <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                                {statusTasks.map((task) => {
                                  const pri = PRIORITIES.find((p) => p.id === task.priority);
                                  return (
                                    <div
                                      key={task.id}
                                      onClick={() => openEdit(task)}
                                      style={{
                                        flex: "0 1 auto",
                                        minWidth: "180px",
                                        padding: "0.6rem",
                                        background: "var(--surface)",
                                        border: "1px solid var(--border)",
                                        borderRadius: "0.5rem",
                                        cursor: "pointer",
                                        transition: "all 0.2s",
                                      }}
                                      onMouseEnter={(e) => (e.currentTarget.style.transform = 'translateY(-2px)')}
                                      onMouseLeave={(e) => (e.currentTarget.style.transform = 'translateY(0)')}
                                    >
                                      <div style={{ fontSize: "0.8rem", fontWeight: 700, marginBottom: "0.25rem" }}>
                                        {task.title}
                                      </div>
                                      {resolveClientName(task) && (
                                        <div style={{ fontSize: "0.7rem", color: "var(--foreground-muted)", marginBottom: "0.25rem" }}>
                                          {resolveClientName(task)}
                                        </div>
                                      )}
                                      <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", fontSize: "0.7rem" }}>
                                        <span className="task-priority-dot" style={{ background: pri?.color || "#6b7280", width: "8px", height: "8px", borderRadius: "50%" }} />
                                        {task.dueDate && (
                                          <span style={{ color: new Date(task.dueDate) < new Date() ? "#f87171" : "inherit" }}>
                                            {new Date(task.dueDate).toLocaleDateString("he-IL", { day: "numeric", month: "short" })}
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {/* Employee Sections */}
                {teamEmployees.map((employee) => {
                  const empTasks = filtered.filter((t: any) => {
                    const ids = Array.isArray(t.assigneeIds) ? t.assigneeIds : [];
                    return ids.includes(employee.id) || t.assigneeId === employee.id;
                  });
                  const empTasksFromOther = filteredEmployeeTasks.filter((t: any) => t.assignedEmployeeId === employee.id);
                  const allEmpTasks = [...empTasks, ...empTasksFromOther];

                  if (allEmpTasks.length === 0) return null;

                  const empInitial = employee.name.charAt(0).toUpperCase();

                  return (
                    <div key={employee.id} style={{ background: "var(--surface-raised)", border: "1px solid var(--border)", borderRadius: "0.75rem", overflow: "hidden" }}>
                      <div
                        onClick={() => toggleEmployeeExpand(employee.id)}
                        style={{
                          padding: "0.75rem",
                          background: "var(--surface)",
                          borderBottom: "1px solid var(--border)",
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          gap: "0.75rem",
                          fontWeight: 600,
                          transition: "all 0.2s",
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--surface-raised)')}
                        onMouseLeave={(e) => (e.currentTarget.style.background = 'var(--surface)')}
                      >
                        <span>{expandedEmployees.has(employee.id) ? '▼' : '▶'}</span>
                        <div style={{
                          width: "32px",
                          height: "32px",
                          borderRadius: "50%",
                          background: "var(--accent)",
                          color: "white",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontWeight: 700,
                          fontSize: "0.875rem",
                        }}>
                          {empInitial}
                        </div>
                        <span style={{ fontSize: "0.875rem" }}>{employee.name}</span>
                        <span style={{ marginLeft: "auto", fontSize: "0.75rem", background: "var(--accent)", color: "white", padding: "0.2rem 0.5rem", borderRadius: "2px" }}>
                          {allEmpTasks.length}
                        </span>
                      </div>
                      {expandedEmployees.has(employee.id) && (
                        <div style={{ padding: "1rem", display: "flex", flexDirection: "column", gap: "1rem" }}>
                          {/* Status Groups */}
                          {["today_tasks", "in_progress", "under_review", "returned", "approved", "completed"].map((statusGroup) => {
                            let statusTasks = allEmpTasks;

                            if (statusGroup === "today_tasks") {
                              statusTasks = statusTasks.filter(t => {
                                const dueDate = 'dueDate' in t ? t.dueDate : null;
                                const status = 'status' in t ? t.status : null;
                                return dueDate === today && status !== 'completed' && status !== 'approved';
                              });
                            } else {
                              statusTasks = statusTasks.filter(t => {
                                const status = 'status' in t ? t.status : null;
                                return status === statusGroup;
                              });
                            }

                            if (statusTasks.length === 0) return null;

                            const statusLabel = statusGroup === "today_tasks" ? "להיום" : COLUMNS.find(c => c.id === statusGroup)?.label || statusGroup;

                            return (
                              <div key={statusGroup}>
                                <div style={{ fontSize: "0.8rem", fontWeight: 600, marginBottom: "0.5rem", color: "var(--foreground-muted)" }}>
                                  {statusLabel} ({statusTasks.length})
                                </div>
                                <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                                  {statusTasks.map((task) => {
                                    const pri = PRIORITIES.find((p) => p.id === (task as any).priority);
                                    const taskDueDate = (task as any).dueDate;
                                    const taskTitle = (task as any).title;
                                    const clientName = resolveClientName(task as any);
                                    return (
                                      <div
                                        key={task.id}
                                        onClick={() => openEdit(task as Task)}
                                        style={{
                                          flex: "0 1 auto",
                                          minWidth: "180px",
                                          padding: "0.6rem",
                                          background: "var(--surface)",
                                          border: "1px solid var(--border)",
                                          borderRadius: "0.5rem",
                                          cursor: "pointer",
                                          transition: "all 0.2s",
                                        }}
                                        onMouseEnter={(e) => (e.currentTarget.style.transform = 'translateY(-2px)')}
                                        onMouseLeave={(e) => (e.currentTarget.style.transform = 'translateY(0)')}
                                      >
                                        <div style={{ fontSize: "0.8rem", fontWeight: 700, marginBottom: "0.25rem" }}>
                                          {taskTitle}
                                        </div>
                                        {clientName && (
                                          <div style={{ fontSize: "0.7rem", color: "var(--foreground-muted)", marginBottom: "0.25rem" }}>
                                            {clientName}
                                          </div>
                                        )}
                                        <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", fontSize: "0.7rem" }}>
                                          <span className="task-priority-dot" style={{ background: pri?.color || "#6b7280", width: "8px", height: "8px", borderRadius: "50%" }} />
                                          {taskDueDate && (
                                            <span style={{ color: new Date(taskDueDate) < new Date() ? "#f87171" : "inherit" }}>
                                              {new Date(taskDueDate).toLocaleDateString("he-IL", { day: "numeric", month: "short" })}
                                            </span>
                                          )}
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </>
      )}

      {/* Task Modal */}
      <Modal open={modalOpen} onClose={() => { setModalOpen(false); setReviewNotes(""); setShowReviewNotes(false); }} title={editingTask ? `עריכת משימה — ${COLUMNS.find(c => c.id === form.status)?.label || ''}` : "משימה חדשה"} footer={
        <div style={{ display: "flex", gap: "0.5rem", justifyContent: "space-between", flexWrap: "wrap" }}>
          <div>
            {editingTask && (
              <button className="mod-btn-ghost" style={{ color: "#f87171", borderColor: "rgba(248,113,113,0.3)", fontSize: "0.75rem" }} onClick={async () => {
                await remove(editingTask.id);
                setModalOpen(false);
                toast("המשימה נמחקה", "info");
              }}>
                🗑 מחיקה
              </button>
            )}
          </div>
          <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
            {editingTask && (form.status === "in_progress" || form.status === "new") && (
              <button className="mod-btn-primary" onClick={handleSendForReview} style={{ fontSize: "0.75rem" }}>
                שלח לבדיקה
              </button>
            )}
            {editingTask && form.status === "under_review" && !showReviewNotes && (
              <>
                <button
                  className="mod-btn-ghost"
                  onClick={() => setShowReviewNotes(true)}
                  style={{ fontSize: "0.75rem", color: "#f97316", borderColor: "rgba(249,115,22,0.3)" }}
                >
                  החזר לתיקון
                </button>
                <button
                  className="mod-btn-primary"
                  onClick={handleApproveTask}
                  style={{ fontSize: "0.75rem", background: "#22c55e" }}
                >
                  אשר משימה
                </button>
              </>
            )}
            {editingTask && form.status === "returned" && (
              <button
                className="mod-btn-primary"
                onClick={async () => {
                  if (!editingTask) return;
                  try {
                    await update(editingTask.id, { status: "under_review" });
                    toast("המשימה נשלחה לבדיקה מחדש", "success");
                    setEditingTask({ ...editingTask, status: "under_review" });
                    setForm(prev => ({ ...prev, status: "under_review" }));
                  } catch {
                    toast("שגיאה בשליחה לבדיקה", "error");
                  }
                }}
                style={{ fontSize: "0.75rem", background: "#38bdf8" }}
              >
                שלח משימה לבדיקה
              </button>
            )}
            <button className="mod-btn-ghost" onClick={() => { setModalOpen(false); setReviewNotes(""); setShowReviewNotes(false); }}>ביטול</button>
            {!showReviewNotes && (
              <button className="mod-btn-primary" onClick={handleSave}>
                {editingTask ? "שמור" : "צור משימה"}
              </button>
            )}
            {showReviewNotes && (
              <button className="mod-btn-primary" onClick={handleReturnForChanges} style={{ background: "#f97316" }}>
                שלח הערות
              </button>
            )}
          </div>
        </div>
      }>
        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", maxHeight: "60vh", overflowY: "auto" }}>
          {!showReviewNotes ? (
            <>
              <div>
                <label style={{ fontSize: "0.72rem", fontWeight: 600, color: "var(--foreground-muted)", display: "block", marginBottom: "0.25rem" }}>כותרת *</label>
                <input className="form-input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="כותרת המשימה" />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
                <div>
                  <label style={{ fontSize: "0.72rem", fontWeight: 600, color: "var(--foreground-muted)", display: "block", marginBottom: "0.25rem" }}>סטטוס</label>
                  <select className="form-select" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as Task["status"] })}>
                    {COLUMNS.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: "0.72rem", fontWeight: 600, color: "var(--foreground-muted)", display: "block", marginBottom: "0.25rem" }}>עדיפות</label>
                  <select className="form-select" value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value as Task["priority"] })}>
                    {PRIORITIES.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
                  </select>
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
                <div>
                  <label style={{ fontSize: "0.72rem", fontWeight: 600, color: "var(--foreground-muted)", display: "block", marginBottom: "0.25rem" }}>לקוח</label>
                  <select className="form-select" value={form.clientId} onChange={(e) => setForm({ ...form, clientId: e.target.value })}>
                    <option value="">ללא לקוח</option>
                    {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: "0.72rem", fontWeight: 600, color: "var(--foreground-muted)", display: "block", marginBottom: "0.25rem" }}>תאריך יעד</label>
                  <input className="form-input" type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} dir="ltr" />
                </div>
              </div>
              <div>
                <label style={{ fontSize: "0.72rem", fontWeight: 600, color: "var(--foreground-muted)", display: "block", marginBottom: "0.25rem" }}>תגיות (מופרדות בפסיק)</label>
                <input className="form-input" value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} placeholder="עיצוב, AI, עריכה" />
              </div>
              <div>
                <label style={{ fontSize: "0.72rem", fontWeight: 600, color: "var(--foreground-muted)", display: "block", marginBottom: "0.25rem" }}>תיאור</label>
                <textarea className="form-input" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="תיאור המשימה..." rows={3} style={{ resize: "vertical" }} />
              </div>

              {/* Assignees Section */}
              <div>
                <label style={{ fontSize: "0.72rem", fontWeight: 600, color: "var(--foreground-muted)", display: "block", marginBottom: "0.25rem" }}>מוקצה לעובדים</label>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                  <select
                    multiple
                    className="form-select"
                    value={form.assigneeIds}
                    onChange={(e) => {
                      const selected = Array.from(e.target.selectedOptions, option => option.value);
                      setForm({ ...form, assigneeIds: selected });
                    }}
                    style={{
                      minHeight: "90px",
                    }}
                  >
                    {teamEmployees.map((emp) => (
                      <option key={emp.id} value={emp.id}>{emp.name}</option>
                    ))}
                  </select>
                  {autoAssignmentNote && !editingTask && (
                    <div style={{
                      fontSize: "0.7rem",
                      color: "#10b981",
                      fontWeight: 500,
                      padding: "0.4rem 0.6rem",
                      background: "#10b98115",
                      borderRadius: "0.375rem",
                    }}>
                      ✓ {autoAssignmentNote}
                    </div>
                  )}
                </div>
              </div>

              {/* File Upload Section */}
              <div style={{ background: "var(--surface-raised)", border: "1px solid var(--border)", borderRadius: "0.5rem", padding: "0.75rem" }}>
                <label style={{ fontSize: "0.72rem", fontWeight: 600, color: "var(--foreground-muted)", display: "block", marginBottom: "0.5rem" }}>קבצים</label>
                <div style={{ display: "flex", gap: "0.5rem", marginBottom: "0.5rem" }}>
                  <input
                    type="file"
                    accept="image/*,video/*,.pdf,.doc,.docx,.xls,.xlsx"
                    onChange={handleAddFile}
                    style={{
                      fontSize: "0.7rem",
                      padding: "0.4rem",
                      background: "var(--surface)",
                      border: "1px solid var(--border)",
                      borderRadius: "0.375rem",
                      color: "var(--foreground)",
                      flex: 1,
                    }}
                  />
                </div>
                {form.files.length > 0 && (
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.3rem" }}>
                    {form.files.map((file, idx) => (
                      <div key={idx} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.4rem", background: "var(--surface)", borderRadius: "0.375rem", fontSize: "0.7rem" }}>
                        <span>📄 {file}</span>
                        <button
                          onClick={() => handleRemoveFile(idx)}
                          style={{ background: "transparent", border: "none", color: "#f87171", cursor: "pointer", fontSize: "0.6rem" }}
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Notes Section */}
              <div>
                <label style={{ fontSize: "0.72rem", fontWeight: 600, color: "var(--foreground-muted)", display: "block", marginBottom: "0.25rem" }}>הערות</label>
                <textarea className="form-input" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="הערות פנימיות על המשימה..." rows={2} style={{ resize: "vertical", fontSize: "0.75rem" }} />
              </div>

              {/* Timeline/History Section */}
              {editingTask && (
                <div style={{ background: "var(--surface-raised)", border: "1px solid var(--border)", borderRadius: "0.5rem", padding: "0.75rem", marginTop: "0.5rem" }}>
                  <label style={{ fontSize: "0.72rem", fontWeight: 600, color: "var(--foreground-muted)", display: "block", marginBottom: "0.5rem" }}>היסטוריה</label>
                  <div style={{ fontSize: "0.7rem", display: "flex", flexDirection: "column", gap: "0.4rem" }}>
                    <div style={{ display: "flex", gap: "0.5rem" }}>
                      <span style={{ color: "var(--accent)" }}>●</span>
                      <span><strong>נוצרה:</strong> {new Date(editingTask.createdAt).toLocaleDateString("he-IL")}</span>
                    </div>
                    <div style={{ display: "flex", gap: "0.5rem" }}>
                      <span style={{ color: "var(--accent)" }}>●</span>
                      <span><strong>סטטוס נוכחי:</strong> {COLUMNS.find(c => c.id === editingTask.status)?.label || editingTask.status}</span>
                    </div>
                    {(editingTask as any).notes && (
                      <div style={{ display: "flex", gap: "0.5rem" }}>
                        <span style={{ color: "var(--accent)" }}>●</span>
                        <span><strong>הערות:</strong> {(editingTask as any).notes}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              <div>
                <label style={{ fontSize: "0.72rem", fontWeight: 600, color: "var(--foreground-muted)", display: "block", marginBottom: "0.5rem" }}>הערות בחזרה *</label>
                <textarea
                  className="form-input"
                  value={reviewNotes}
                  onChange={(e) => setReviewNotes(e.target.value)}
                  placeholder="הוסף הערות למה יש להחזיר את המשימה לעובד..."
                  rows={4}
                  style={{ resize: "vertical" }}
                />
              </div>
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}
