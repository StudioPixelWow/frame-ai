"use client";

export const dynamic = "force-dynamic";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useTasks, useEmployees, useClients, useEmployeeTasks } from "@/lib/api/use-entity";
import { useToast } from "@/components/ui/toast";
import { Modal } from "@/components/ui/modal";
import { SmartHint } from "@/components/ui/smart-hint";
import TasksCommandCenter from "@/components/tasks/tasks-command-center";
import type { Task } from "@/lib/db/schema";
import { fireConfetti } from "@/lib/confetti";
import { useAuth } from "@/lib/auth/auth-context";
import { loadImage } from "@/lib/creative-pixelai/adapter";
import { aiAdaptImageToFormat } from "@/lib/creative-pixelai/ai-adapt";

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
  const { isEmployee } = useAuth();
  const { data: tasks, loading, create, update, remove } = useTasks();
  const { data: employeeTasks, loading: employeeTasksLoading, update: updateEmployeeTask } = useEmployeeTasks();
  const { data: employees } = useEmployees();

  // Source-aware update: tasks may come from the `tasks` table OR the `employee-tasks`
  // collection (UUID ids). Route the update to the correct endpoint so it doesn't 404.
  const updateAny = useCallback((id: string, patch: any) => {
    const isEmp = (employeeTasks || []).some((t: any) => t.id === id);
    return isEmp ? updateEmployeeTask(id, patch) : update(id, patch);
  }, [employeeTasks, updateEmployeeTask, update]);

  // Celebration popup shown when an employee submits a task.
  const [celebrateMsg, setCelebrateMsg] = useState<string | null>(null);
  const celebrate = useCallback((msg: string) => {
    try { fireConfetti(); } catch { /* noop */ }
    setCelebrateMsg(msg);
    setTimeout(() => setCelebrateMsg(null), 3800);
  }, []);
  const TEAM_MEMBERS = ["טל זטלמן", "מאיה זטלמן", "נועם בוברין", "מיכאלה"];
  const teamEmployees = useMemo(() => (employees || []).filter(e => TEAM_MEMBERS.includes(e.name)), [employees]);
  const { data: clients } = useClients();
  const toast = useToast();

  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [defaultStatus, setDefaultStatus] = useState<Task["status"]>("new");
  const [viewMode, setViewMode] = useState<'board' | 'by_employee'>('board');
  const [showWork, setShowWork] = useState(false); // Kanban is a secondary, collapsible view
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
    submittedFiles: [] as string[],
    notes: "",
    contentType: "" as "" | "post" | "story" | "reel",
  });

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadingTaskId, setUploadingTaskId] = useState<string | null>(null);
  const [fileUploading, setFileUploading] = useState(false);
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
    setForm({ title: "", description: "", status, priority: "medium", clientId: "", clientName: "", dueDate: "", tags: "", assigneeIds: [], files: [], submittedFiles: [], notes: "", contentType: "" });
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
      submittedFiles: Array.isArray((task as any).submittedFiles) ? (task as any).submittedFiles : [],
      notes: (task as any).notes || '',
      contentType: ((task as any).contentType as "" | "post" | "story" | "reel") || "",
    });
    setTaskAdaptations(((task as any).adaptations as Record<string, string>) || null);
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!form.title.trim()) { toast("כותרת המשימה היא שדה חובה", "error"); return; }
    const client = clients.find((c) => c.id === form.clientId);
    const { submittedFiles: _omitSubmitted, ...formRest } = form; // never clobber the employee's submission from the manager form
    const payload = {
      ...formRest,
      clientName: client?.name || form.clientName,
      dueDate: form.dueDate || null,
      tags: form.tags ? form.tags.split(",").map((t) => t.trim()).filter(Boolean) : [],
      files: form.files,
      notes: form.notes,
    };
    try {
      if (editingTask) {
        await updateAny(editingTask.id, payload);
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
    await updateAny(taskId, { status: newStatus });
  };

  const handleSendForReview = async () => {
    if (!editingTask) return;
    try {
      await updateAny(editingTask.id, { status: "under_review" });
      setModalOpen(false);
      celebrate("מעולה! המשימה הוגשה, נמשיך למשימה הבאה! 🎉");
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
      await updateAny(editingTask.id, { status: "returned", notes: reviewNotes });
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
      await updateAny(editingTask.id, { status: "approved" });
      toast("המשימה אושרה", "success");
      setEditingTask({ ...editingTask, status: "approved" });
      setForm(prev => ({ ...prev, status: "approved" }));
    } catch {
      toast("שגיאה באישור", "error");
    }
  };

  const handleMarkCompleted = async () => {
    if (!editingTask) return;
    try {
      await updateAny(editingTask.id, { status: "completed" });
      toast("המשימה הושלמה", "success");
      fireConfetti(35);
      setEditingTask({ ...editingTask, status: "completed" });
      setForm(prev => ({ ...prev, status: "completed" }));
    } catch {
      toast("שגיאה בסימון כהושלם", "error");
    }
  };

  const handleAddFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileUploading(true);
    try {
      // 1) Signed upload URL (direct to Supabase Storage — no Vercel size limit).
      const signRes = await fetch("/api/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileName: `tasks/${Date.now()}_${file.name}`, contentType: file.type, fileSize: file.size }),
      });
      const sign = await signRes.json();
      if (!signRes.ok || !sign.uploadUrl) throw new Error(sign.error || "קבלת כתובת העלאה נכשלה");
      // 2) Upload the file itself.
      const putRes = await fetch(sign.uploadUrl, { method: "PUT", headers: { "Content-Type": file.type || "application/octet-stream" }, body: file });
      if (!putRes.ok) throw new Error("ההעלאה נכשלה");
      // 3) Store "name|url" so it persists in the DB and can be downloaded.
      const entry = `${file.name}|${sign.publicUrl}`;
      setForm((f) => ({ ...f, files: [...f.files, entry] }));
      toast(`הקובץ "${file.name}" הועלה ונשמר`, "success");
    } catch (err) {
      toast(err instanceof Error ? err.message : "שגיאת העלאה", "error");
    } finally {
      setFileUploading(false);
      e.target.value = "";
    }
  };

  // Split a stored file entry "name|url" → { name, url }. Old entries (name only) → no url.
  const parseFile = (entry: string): { name: string; url: string | null } => {
    const i = entry.indexOf("|");
    if (i === -1) return { name: entry, url: null };
    return { name: entry.slice(0, i), url: entry.slice(i + 1) };
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
      // 1) Upload the file to Supabase Storage (direct, no size limit).
      const signRes = await fetch("/api/upload", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileName: `tasks/${Date.now()}_${selectedFile.name}`, contentType: selectedFile.type, fileSize: selectedFile.size }),
      });
      const sign = await signRes.json();
      if (!signRes.ok || !sign.uploadUrl) throw new Error(sign.error || "קבלת כתובת העלאה נכשלה");
      const putRes = await fetch(sign.uploadUrl, { method: "PUT", headers: { "Content-Type": selectedFile.type || "application/octet-stream" }, body: selectedFile });
      if (!putRes.ok) throw new Error("ההעלאה נכשלה");

      // 2) Persist the file ON the task as a SUBMITTED file (separate from the
      //    reference/helper files added at creation) AND move to review — so the
      //    employee's deliverable travels through the approval flow on its own field.
      const entry = `${selectedFile.name}|${sign.publicUrl}`;
      const cur = [...(tasks || []), ...(employeeTasks || [])].find((x: any) => x.id === uploadingTaskId) as any;
      const existing = Array.isArray(cur?.submittedFiles) ? cur.submittedFiles : [];
      await updateAny(uploadingTaskId, { submittedFiles: [...existing, entry], status: "under_review" as Task["status"] });

      setModalOpen(false);
      celebrate("מעולה! המשימה הוגשה לבדיקת המנהל! 🎉");
      const fileInput = document.querySelector(`input[data-task="${uploadingTaskId}"]`) as HTMLInputElement;
      if (fileInput) fileInput.value = "";
      setSelectedFile(null);
      setUploadingTaskId(null);
    } catch (err) {
      toast(err instanceof Error ? err.message : "שגיאה בהעלאת קובץ", "error");
    }
  };

  /* ── AI size adaptations for approved content tasks ──
     Takes the task's attached creative, runs Creative PixelAI (redesign) for
     Square / 4:5 / Story, uploads the results and saves them INTO the task. */
  const [adaptingSizes, setAdaptingSizes] = useState<string | null>(null);
  const [taskAdaptations, setTaskAdaptations] = useState<Record<string, string> | null>(null);

  const handleAdaptSizes = async () => {
    if (!editingTask) return;
    // First attached image = the approved creative.
    const parseEntry = (f: string) => { const i = f.indexOf("|"); return i === -1 ? { name: f, url: "" } : { name: f.slice(0, i), url: f.slice(i + 1) }; };
    const imgEntry = (form.files || []).map(parseEntry).find((e) => e.url && /\.(png|jpe?g|webp)(\?|$)/i.test(e.url));
    if (!imgEntry) { toast("אין קובץ תמונה מצורף למשימה", "error"); return; }
    try {
      setAdaptingSizes("טוען את הקריאייטיב…");
      const img = await loadImage(imgEntry.url);
      const formats: Array<{ id: "square" | "feed_4_5" | "story"; label: string; fileName: string }> = [
        { id: "square", label: "Square", fileName: "Square-1080x1080.png" },
        { id: "feed_4_5", label: "4:5", fileName: "Feed-1080x1350.png" },
        { id: "story", label: "Story", fileName: "Story-1080x1920.png" },
      ];
      const urls: Record<string, string> = {};
      const newFileEntries: string[] = [];
      for (let i = 0; i < formats.length; i++) {
        const f = formats[i];
        setAdaptingSizes(`יוצר ${i + 1}/3 — ${f.label}…`);
        const blob = await aiAdaptImageToFormat(img, f.id);
        // upload through the system pipeline
        const init = await fetch("/api/upload", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ fileName: `creative-assets/tasks/${editingTask.id}/${Date.now()}_${f.fileName}`, contentType: "image/png", fileSize: blob.size }),
        });
        if (!init.ok) throw new Error("קבלת כתובת העלאה נכשלה");
        const { uploadUrl, publicUrl } = await init.json();
        const put = await fetch(uploadUrl, { method: "PUT", headers: { "Content-Type": "image/png" }, body: blob });
        if (!put.ok) throw new Error("העלאת התוצר נכשלה");
        urls[f.id] = publicUrl;
        newFileEntries.push(`🎨 ${f.fileName}|${publicUrl}`);
      }
      setAdaptingSizes("שומר למשימה…");
      const adaptations = { ...urls, createdAt: new Date().toISOString() };
      const mergedFiles = [...(form.files || []), ...newFileEntries];
      await updateAny(editingTask.id, { adaptations, files: mergedFiles } as any);
      setForm((prev) => ({ ...prev, files: mergedFiles }));
      setTaskAdaptations(urls);
      toast("✓ נוצרו 3 גרסאות (Square / 4:5 / Story) ונשמרו במשימה", "success");
      try { fireConfetti(); } catch { /* noop */ }
    } catch (e) {
      toast(e instanceof Error ? e.message : "ההתאמה נכשלה", "error");
    } finally { setAdaptingSizes(null); }
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

  // Priority sort helper: urgent → high → medium → low → undefined
  const PRIORITY_ORDER: Record<string, number> = { urgent: 0, high: 1, medium: 2, low: 3 };
  const sortByPriority = (list: any[]) => {
    return [...list].sort((a, b) => {
      const pa = PRIORITY_ORDER[a.priority] ?? 4;
      const pb = PRIORITY_ORDER[b.priority] ?? 4;
      return pa - pb;
    });
  };

  const filtered = applyFilters(tasks);
  const filteredEmployeeTasks = applyFilters(employeeTasks || []);

  const todayTasks = sortByPriority(filtered.filter(t => t.dueDate === today && t.status !== 'completed' && t.status !== 'approved'));
  const overdueTasks = sortByPriority(filtered.filter(t => t.dueDate && t.dueDate < today && t.status !== 'completed' && t.status !== 'approved'));
  const underReviewTasks = filtered.filter(t => t.status === 'under_review');

  // Future tasks: upcoming tasks with dueDate > today, not completed
  const futureTasks = sortByPriority(filtered.filter(t => t.dueDate && t.dueDate > today && t.status !== 'completed' && t.status !== 'approved')).slice(0, 8);

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
            <input className="mod-search ux-input" placeholder="🔍 חיפוש משימה..." value={search} onChange={(e) => setSearch(e.target.value)} />
            <button className="mod-btn-primary ux-btn ux-btn-glow" onClick={() => openCreate("new")}>+ משימה חדשה</button>
          </div>
        </div>
      </div>

      {/* ── New execution-first workspace (primary) ── */}
      <TasksCommandCenter onOpenTask={openEdit} onCompleteTask={(t) => { updateAny(t.id, { status: "completed" }); fireConfetti(); }} />

      <button
        onClick={() => setShowWork(v => !v)}
        style={{ margin: "2rem auto 1.25rem", display: "block", padding: "0.7rem 1.5rem", borderRadius: 12, border: "1px solid var(--border)", background: "var(--surface-raised)", color: "var(--foreground)", fontWeight: 600, fontSize: "0.85rem", cursor: "pointer" }}
      >
        {showWork ? "▲ הסתר לוח עבודה מלא" : "▼ פתח לוח עבודה מלא (קנבן)"}
      </button>

      {showWork && (<>
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
          className="ux-chip"
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
          className="ux-chip"
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
          className="ux-chip"
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
          className="ux-chip"
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
            className="ux-btn"
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

      {/* Contextual Smart Hints */}
      {!loading && (overdueTasks.length > 0 || underReviewTasks.length > 0) && (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", marginBottom: "1.5rem" }}>
          {overdueTasks.length > 0 && (
            <SmartHint
              type="warning"
              text={`יש ${overdueTasks.length} משימות בפיגור — כדאי לעדכן או להקצות מחדש`}
              dismissible
            />
          )}
          {underReviewTasks.length > 0 && (
            <SmartHint
              type="ai"
              text={`יש ${underReviewTasks.length} משימות בביקורת — אישור מהיר משחרר את הצוות`}
              dismissible
            />
          )}
        </div>
      )}

      {/* Today's Tasks Section */}
      {!loading && (todayTasks.length > 0 || overdueTasks.length > 0) && (
        <div style={{ marginBottom: "2rem", background: "var(--surface-raised)", border: "1px solid var(--border)", borderRadius: "0.75rem", padding: "1rem" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1rem" }}>
            <div style={{ fontSize: "0.9rem", fontWeight: 700, color: "var(--foreground)" }}>
              📅 משימות להיום — {new Date().toLocaleDateString("he-IL", { weekday: "long", day: "numeric", month: "long" })}
            </div>
            <div style={{ fontSize: "0.75rem", color: "var(--foreground-muted)" }}>
              {todayTasks.length + overdueTasks.length} משימות פתוחות
              {overdueTasks.length > 0 && <span style={{ color: "#f87171", fontWeight: 600 }}> ({overdueTasks.length} באיחור)</span>}
            </div>
          </div>
          <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }} className="ux-stagger">
            {/* Overdue Tasks */}
            {overdueTasks.map((task) => {
              const pri = PRIORITIES.find((p) => p.id === task.priority);
              return (
                <div
                  key={task.id}
                  onClick={() => openEdit(task)}
                  className="ux-stagger-item"
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
                  className="ux-stagger-item"
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

      {/* Future Tasks Section */}
      {!loading && futureTasks.length > 0 && (
        <div style={{ marginBottom: "2rem", background: "var(--surface-raised)", border: "1px solid rgba(0,181,254,0.2)", borderRadius: "0.75rem", padding: "1rem" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1rem" }}>
            <div style={{ fontSize: "0.9rem", fontWeight: 700, color: "var(--foreground)" }}>
              📌 משימות קרובות
            </div>
            <span style={{ fontSize: "0.7rem", color: "var(--foreground-muted)", background: "var(--surface)", padding: "0.2rem 0.6rem", borderRadius: "999px", border: "1px solid var(--border)" }}>
              {futureTasks.length} משימות בהמתנה
            </span>
          </div>
          <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }} className="ux-stagger">
            {futureTasks.map((task: any) => {
              const pri = PRIORITIES.find((p) => p.id === task.priority);
              const dueDate = task.dueDate ? new Date(task.dueDate) : null;
              const daysUntil = dueDate ? Math.ceil((dueDate.getTime() - Date.now()) / 86400000) : null;
              return (
                <div
                  key={task.id}
                  onClick={() => openEdit(task)}
                  className="ux-stagger-item"
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
                      {PRIORITIES.find(p => p.id === task.priority)?.label || "רגיל"}
                    </span>
                    {dueDate && (
                      <span style={{ fontSize: "0.68rem", color: daysUntil !== null && daysUntil <= 2 ? "#f59e0b" : "var(--foreground-muted)" }}>
                        {dueDate.toLocaleDateString("he-IL", { weekday: "short", day: "numeric", month: "short" })}
                        {daysUntil !== null && ` (${daysUntil === 1 ? "מחר" : `בעוד ${daysUntil} ימים`})`}
                      </span>
                    )}
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
              <div className="tasks-board ux-stagger">
              {COLUMNS.map((col) => {
                const colTasks = sortByPriority(filtered.filter((t) => t.status === col.id));
                return (
                  <div key={col.id} className="tasks-col ux-stagger-item">
                    <div className="tasks-col-header">
                      <div className="tasks-col-title" style={{ color: col.color }}>
                        {col.label}
                        <span className="tasks-col-count">{colTasks.length}</span>
                      </div>
                    </div>
                    <div className="tasks-col-body ux-stagger">
                      {colTasks.map((task) => {
                        const pri = PRIORITIES.find((p) => p.id === task.priority);
                        const isUploading = uploadingTaskId === task.id;
                        const taskClientName = resolveClientName(task);
                        const isOverdue = task.dueDate && new Date(task.dueDate) < new Date() && task.status !== "completed" && task.status !== "approved";
                        const assigneeNames = (Array.isArray(task.assigneeIds) ? task.assigneeIds : [])
                          .map((id: any) => teamEmployees.find(e => e.id === id)?.name)
                          .filter(Boolean);
                        return (
                          <div key={task.id} style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }} className="ux-stagger-item">
                            <div
                              className="task-card premium-card"
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
                                    className="mod-btn-primary ux-btn ux-btn-glow"
                                    onClick={handleFileUpload}
                                    disabled={!selectedFile}
                                    style={{ flex: 1, fontSize: "0.7rem", padding: "0.4rem 0.5rem" }}
                                  >
                                    העלה
                                  </button>
                                  <button
                                    className="mod-btn-ghost ux-btn"
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
                                className="mod-btn-ghost ux-btn"
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
                    <button className="tasks-add-btn ux-btn ux-btn-glow" onClick={() => openCreate(col.id as Task["status"])}>+ הוסף משימה</button>
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

              <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }} className="ux-stagger">
                {/* Unassigned Tasks Section */}
                {filtered.filter(t => (!Array.isArray(t.assigneeIds) || t.assigneeIds.length === 0) && !t.assigneeId).length > 0 && (
                  <div style={{ background: "var(--surface-raised)", border: "1px solid var(--border)", borderRadius: "0.75rem", overflow: "hidden" }} className="ux-card ux-stagger-item">
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
                          let statusTasks = sortByPriority(filtered.filter(t => (!Array.isArray(t.assigneeIds) || t.assigneeIds.length === 0) && !t.assigneeId));

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
                              <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }} className="ux-stagger">
                                {statusTasks.map((task) => {
                                  const pri = PRIORITIES.find((p) => p.id === task.priority);
                                  return (
                                    <div
                                      key={task.id}
                                      onClick={() => openEdit(task)}
                                      className="premium-card ux-stagger-item"
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
                  const allEmpTasks = sortByPriority([...empTasks, ...empTasksFromOther]);

                  if (allEmpTasks.length === 0) return null;

                  const empInitial = employee.name.charAt(0).toUpperCase();

                  return (
                    <div key={employee.id} style={{ background: "var(--surface-raised)", border: "1px solid var(--border)", borderRadius: "0.75rem", overflow: "hidden" }} className="ux-card ux-stagger-item">
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
                          {/* Status Groups — same logic as general board: overdue → today → future → status columns */}
                          {["overdue_tasks", "today_tasks", "future_tasks", "in_progress", "under_review", "returned", "approved", "completed"].map((statusGroup) => {
                            let statusTasks = allEmpTasks;

                            if (statusGroup === "overdue_tasks") {
                              statusTasks = statusTasks.filter(t => {
                                const dd = 'dueDate' in t ? t.dueDate : null;
                                const status = 'status' in t ? t.status : null;
                                return dd && dd < today && status !== 'completed' && status !== 'approved';
                              });
                            } else if (statusGroup === "today_tasks") {
                              statusTasks = statusTasks.filter(t => {
                                const dd = 'dueDate' in t ? t.dueDate : null;
                                const status = 'status' in t ? t.status : null;
                                return dd === today && status !== 'completed' && status !== 'approved';
                              });
                            } else if (statusGroup === "future_tasks") {
                              statusTasks = statusTasks.filter(t => {
                                const dd = 'dueDate' in t ? t.dueDate : null;
                                const status = 'status' in t ? t.status : null;
                                return dd && dd > today && status !== 'completed' && status !== 'approved';
                              });
                            } else {
                              statusTasks = statusTasks.filter(t => {
                                const status = 'status' in t ? t.status : null;
                                return status === statusGroup;
                              });
                            }

                            if (statusTasks.length === 0) return null;

                            const statusLabel = statusGroup === "overdue_tasks" ? "⚠️ באיחור" : statusGroup === "today_tasks" ? "📅 להיום" : statusGroup === "future_tasks" ? "📌 קרובות" : COLUMNS.find(c => c.id === statusGroup)?.label || statusGroup;

                            return (
                              <div key={statusGroup}>
                                <div style={{ fontSize: "0.8rem", fontWeight: 600, marginBottom: "0.5rem", color: statusGroup === "overdue_tasks" ? "#f87171" : "var(--foreground-muted)" }}>
                                  {statusLabel} ({statusTasks.length})
                                </div>
                                <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }} className="ux-stagger">
                                  {statusTasks.map((task) => {
                                    const pri = PRIORITIES.find((p) => p.id === (task as any).priority);
                                    const taskDueDate = (task as any).dueDate;
                                    const taskTitle = (task as any).title;
                                    const clientName = resolveClientName(task as any);
                                    return (
                                      <div
                                        key={task.id}
                                        onClick={() => openEdit(task as Task)}
                                        className="premium-card ux-stagger-item"
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
      </>)}

      {/* Celebration popup (employee submitted a task) */}
      {celebrateMsg && (
        <div onClick={() => setCelebrateMsg(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 4000 }}>
          <div dir="rtl" style={{ background: "var(--surface-raised, #fff)", borderRadius: 22, padding: "2.5rem 2.75rem", textAlign: "center", maxWidth: 420, boxShadow: "0 20px 60px rgba(0,0,0,0.25)" }}>
            <div style={{ fontSize: "3.5rem", marginBottom: 12 }}>🎉</div>
            <div style={{ fontSize: "1.35rem", fontWeight: 800, color: "var(--foreground)" }}>{celebrateMsg}</div>
            <button onClick={() => setCelebrateMsg(null)} style={{ marginTop: 20, padding: "0.6rem 1.6rem", borderRadius: 12, border: "none", background: "var(--accent, #00B5FE)", color: "#fff", fontWeight: 700, fontSize: "0.9rem", cursor: "pointer" }}>סבבה!</button>
          </div>
        </div>
      )}

      {/* Task Modal */}
      <Modal open={modalOpen} onClose={() => { setModalOpen(false); setReviewNotes(""); setShowReviewNotes(false); }} title={editingTask ? `עריכת משימה — ${COLUMNS.find(c => c.id === form.status)?.label || ''}` : "משימה חדשה"} footer={
        <div style={{ display: "flex", gap: "0.5rem", justifyContent: "space-between", flexWrap: "wrap" }}>
          <div>
            {!isEmployee && editingTask && (
              <button className="mod-btn-ghost ux-btn" style={{ color: "#f87171", borderColor: "rgba(248,113,113,0.3)", fontSize: "0.75rem" }} onClick={async () => {
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
              <button className="mod-btn-primary ux-btn ux-btn-glow" onClick={handleSendForReview} style={{ fontSize: "0.75rem" }}>
                שלח לבדיקה
              </button>
            )}
            {!isEmployee && editingTask && form.status === "under_review" && !showReviewNotes && (
              <>
                <button
                  className="mod-btn-ghost ux-btn"
                  onClick={() => setShowReviewNotes(true)}
                  style={{ fontSize: "0.75rem", color: "#f97316", borderColor: "rgba(249,115,22,0.3)" }}
                >
                  החזר לתיקון
                </button>
                <button
                  className="mod-btn-primary ux-btn ux-btn-glow"
                  onClick={handleApproveTask}
                  style={{ fontSize: "0.75rem", background: "#22c55e" }}
                >
                  אשר משימה
                </button>
              </>
            )}
            {!isEmployee && editingTask && form.status === "approved" && !showReviewNotes && (
              <button
                className="mod-btn-primary ux-btn ux-btn-glow"
                onClick={handleMarkCompleted}
                style={{ fontSize: "0.85rem", background: "#10b981", fontWeight: 700, padding: "0.5rem 1.25rem" }}
              >
                העבר להושלם
              </button>
            )}
            {editingTask && form.status === "returned" && (
              <button
                className="mod-btn-primary ux-btn ux-btn-glow"
                onClick={async () => {
                  if (!editingTask) return;
                  try {
                    await updateAny(editingTask.id, { status: "under_review" });
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
            <button className="mod-btn-ghost ux-btn" onClick={() => { setModalOpen(false); setReviewNotes(""); setShowReviewNotes(false); }}>ביטול</button>
            {!isEmployee && !showReviewNotes && (
              <button className="mod-btn-primary ux-btn ux-btn-glow" onClick={handleSave}>
                {editingTask ? "שמור" : "צור משימה"}
              </button>
            )}
            {showReviewNotes && (
              <button className="mod-btn-primary ux-btn ux-btn-glow" onClick={handleReturnForChanges} style={{ background: "#f97316" }}>
                שלח הערות
              </button>
            )}
          </div>
        </div>
      }>
        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", maxHeight: "60vh", overflowY: "auto" }}>
          {!showReviewNotes ? (
            <>
              {/* HERO — title + graphic text, made to stand out far more than the rest */}
              {(() => {
                const desc = form.description || "";
                const m = desc.match(/טקסט לגרפיקה[:\s]*([\s\S]*?)(?:\n\n|🖼️|💬|📅|🎉|🔬|$)/);
                const gtext = m ? m[1].trim() : "";
                const CT: Record<string, { label: string; icon: string; color: string; bg: string }> = {
                  post: { label: "פוסט", icon: "🖼️", color: "#0369a1", bg: "rgba(2,132,199,0.12)" },
                  story: { label: "סטורי", icon: "📱", color: "#7c3aed", bg: "rgba(124,58,237,0.12)" },
                  reel: { label: "רילס", icon: "🎬", color: "#db2777", bg: "rgba(219,39,119,0.12)" },
                };
                const ct = form.contentType ? CT[form.contentType] : null;
                return (
                  <div style={{ background: "linear-gradient(135deg, #eff6ff 0%, #f0fdfa 100%)", border: "1px solid #bae6fd", borderRadius: 18, padding: "1.2rem 1.35rem", marginBottom: "0.4rem", boxShadow: "0 2px 10px rgba(2,132,199,0.08)" }}>
                    {/* CONTENT TYPE — big, first thing the employee sees */}
                    {ct && (
                      <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: ct.bg, border: `2px solid ${ct.color}55`, borderRadius: 12, padding: "0.45rem 1rem", marginBottom: 12 }}>
                        <span style={{ fontSize: "1.5rem", lineHeight: 1 }}>{ct.icon}</span>
                        <span style={{ fontSize: "1.15rem", fontWeight: 800, color: ct.color }}>סוג תוכן: {ct.label}</span>
                      </div>
                    )}
                    <div style={{ fontSize: "0.7rem", fontWeight: 800, color: "#0369a1", letterSpacing: "0.05em", marginBottom: 6 }}>כותרת</div>
                    <div style={{ fontSize: "1.5rem", fontWeight: 800, color: "var(--foreground, #0f172a)", lineHeight: 1.25 }}>{form.title || "—"}</div>
                    {gtext && (
                      <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px dashed #bae6fd" }}>
                        <div style={{ fontSize: "0.8rem", fontWeight: 800, color: "#0369a1", marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>✍️ טקסט לגרפיקה</div>
                        <div style={{ fontSize: "1.1rem", fontWeight: 600, color: "var(--foreground, #0f172a)", lineHeight: 1.65, whiteSpace: "pre-wrap" }}>{gtext}</div>
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* קבצי עזר / רפרנס — design assets the MANAGER attaches for the employee to use */}
              <div style={{ background: "var(--surface-raised)", border: "1px solid var(--border)", borderRadius: "0.75rem", padding: "0.9rem 1rem" }}>
                <label style={{ fontSize: "0.8rem", fontWeight: 800, color: "#0369a1", marginBottom: "0.2rem", display: "flex", alignItems: "center", gap: 6 }}>🎨 קבצי עזר ורפרנס למשימה</label>
                <div style={{ fontSize: "0.68rem", color: "var(--foreground-muted)", marginBottom: "0.6rem" }}>
                  {isEmployee ? "קבצים שהמנהל צירף לעזרה — לצפייה והורדה בלבד (לא קבצי ההגשה)." : "צרף כאן חומרי עזר / רפרנס שיעזרו לעובד בהכנת המשימה."}
                </div>
                {/* Managers can attach design assets; employees view/download only. */}
                {!isEmployee && (
                  <div style={{ display: "flex", gap: "0.5rem", marginBottom: "0.5rem" }}>
                    <input
                      type="file"
                      accept="image/*,video/*,.pdf,.doc,.docx,.xls,.xlsx"
                      onChange={handleAddFile}
                      disabled={fileUploading}
                      className="ux-input"
                      style={{ fontSize: "0.7rem", padding: "0.4rem", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "0.375rem", color: "var(--foreground)", flex: 1, opacity: fileUploading ? 0.6 : 1 }}
                    />
                  </div>
                )}
                {fileUploading && (
                  <div style={{ fontSize: "0.7rem", color: "var(--accent)", marginBottom: "0.4rem" }}>⏳ מעלה קובץ...</div>
                )}
                {form.files.length > 0 ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.3rem" }}>
                    {form.files.map((file, idx) => {
                      const { name, url } = parseFile(file);
                      return (
                        <div key={idx} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.45rem 0.55rem", background: "var(--surface)", borderRadius: "0.375rem", fontSize: "0.78rem" }}>
                          {url ? (
                            <a href={url} target="_blank" rel="noopener noreferrer" download style={{ color: "var(--accent)", textDecoration: "none", fontWeight: 600 }}>
                              📥 {name}
                            </a>
                          ) : (
                            <span>📄 {name}</span>
                          )}
                          {!isEmployee && (
                            <button onClick={() => handleRemoveFile(idx)} style={{ background: "transparent", border: "none", color: "#f87171", cursor: "pointer", fontSize: "0.7rem" }}>✕</button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div style={{ fontSize: "0.72rem", color: "var(--foreground-muted)" }}>אין קבצים מצורפים למשימה.</div>
                )}
              </div>

              {/* MANAGER: AI size adaptations — turn the approved creative into Square/4:5/Story, saved INTO the task */}
              {!isEmployee && editingTask && (
                <div style={{ background: "linear-gradient(135deg, #f0f9ff 0%, #faf5ff 100%)", border: "1px solid #ddd6fe", borderRadius: 16, padding: "1rem 1.1rem" }}>
                  <div style={{ fontSize: "0.85rem", fontWeight: 800, color: "#7c3aed", marginBottom: 4 }}>🎨 התאמות גדלים — Creative PixelAI</div>
                  <div style={{ fontSize: "0.7rem", color: "var(--foreground-muted)", marginBottom: 10 }}>
                    לוקח את הקריאייטיב המצורף ויוצר אוטומטית גרסאות Square / 4:5 / Story — נשמרות בתוך המשימה.
                  </div>
                  {taskAdaptations && (
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
                      {([["square", "⬜ Square"], ["feed_4_5", "📐 4:5"], ["story", "📱 Story"]] as const).map(([k, label]) => taskAdaptations[k] && (
                        <a key={k} href={taskAdaptations[k]} target="_blank" rel="noopener noreferrer"
                          style={{ fontSize: "0.72rem", fontWeight: 700, color: "#7c3aed", background: "rgba(124,58,237,0.1)", border: "1px solid rgba(124,58,237,0.3)", borderRadius: 8, padding: "0.3rem 0.7rem", textDecoration: "none" }}>
                          {label} ⬇
                        </a>
                      ))}
                    </div>
                  )}
                  <button
                    onClick={handleAdaptSizes}
                    disabled={!!adaptingSizes}
                    className="mod-btn-primary ux-btn"
                    style={{ width: "100%", fontSize: "0.8rem", fontWeight: 800, background: "#7c3aed", opacity: adaptingSizes ? 0.7 : 1 }}
                  >
                    {adaptingSizes ? `⏳ ${adaptingSizes}` : taskAdaptations ? "🔄 צור מחדש את כל הגרסאות" : "🚀 צור גרסאות Square / 4:5 / Story"}
                  </button>
                </div>
              )}

              {/* EMPLOYEE: upload-for-review is the ONLY action — no status changes, no "complete" */}
              {isEmployee && editingTask && (
                <div style={{ background: "linear-gradient(135deg, #ecfdf5 0%, #eff6ff 100%)", border: "2px solid #34d399", borderRadius: 16, padding: "1.1rem 1.25rem" }}>
                  <div style={{ fontSize: "0.9rem", fontWeight: 800, color: "#047857", marginBottom: 4, display: "flex", alignItems: "center", gap: 6 }}>📤 הגשת קובץ לאישור המנהל</div>
                  <div style={{ fontSize: "0.72rem", color: "var(--foreground-muted)", marginBottom: 10 }}>כאן מעלים את התוצר המוגמר. ההעלאה תעביר את המשימה אוטומטית לסטטוס “בבדיקה” ותשלח אותה למנהל. (לא להתבלבל עם קבצי העזר למעלה.)</div>
                  {form.submittedFiles.length > 0 && (
                    <div style={{ marginBottom: 10, display: "flex", flexDirection: "column", gap: "0.3rem" }}>
                      <div style={{ fontSize: "0.7rem", fontWeight: 700, color: "#047857" }}>כבר הוגשו:</div>
                      {form.submittedFiles.map((file, idx) => {
                        const { name, url } = parseFile(file);
                        return (
                          <div key={idx} style={{ padding: "0.4rem 0.55rem", background: "var(--surface)", borderRadius: 8, fontSize: "0.76rem" }}>
                            {url ? <a href={url} target="_blank" rel="noopener noreferrer" download style={{ color: "var(--accent)", fontWeight: 600, textDecoration: "none" }}>📥 {name}</a> : <span>📄 {name}</span>}
                          </div>
                        );
                      })}
                    </div>
                  )}
                  <input
                    type="file"
                    accept="image/*,video/*,.pdf,.doc,.docx"
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) { setSelectedFile(f); setUploadingTaskId(editingTask.id); } }}
                    style={{ fontSize: "0.78rem", padding: "0.4rem", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, width: "100%", boxSizing: "border-box" }}
                  />
                  {selectedFile && uploadingTaskId === editingTask.id && (
                    <div style={{ fontSize: "0.75rem", color: "#047857", marginTop: 8, wordBreak: "break-word" }}>✓ {selectedFile.name}</div>
                  )}
                  <button
                    onClick={handleFileUpload}
                    disabled={!selectedFile || uploadingTaskId !== editingTask.id}
                    className="mod-btn-primary ux-btn ux-btn-glow"
                    style={{ marginTop: 12, width: "100%", background: "#10b981", fontWeight: 800, fontSize: "0.85rem", padding: "0.6rem", opacity: (!selectedFile || uploadingTaskId !== editingTask.id) ? 0.55 : 1 }}
                  >
                    📤 העלה ושלח לבדיקה
                  </button>
                </div>
              )}

              <div>
                <label style={{ fontSize: "0.72rem", fontWeight: 600, color: "var(--foreground-muted)", display: "block", marginBottom: "0.25rem" }}>כותרת *</label>
                <input className="form-input ux-input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="כותרת המשימה" disabled={isEmployee} />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0.75rem" }}>
                <div>
                  <label style={{ fontSize: "0.72rem", fontWeight: 600, color: "var(--foreground-muted)", display: "block", marginBottom: "0.25rem" }}>סטטוס</label>
                  <select className="form-select ux-input ux-chip" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as Task["status"] })}>
                    {COLUMNS.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: "0.72rem", fontWeight: 600, color: "var(--foreground-muted)", display: "block", marginBottom: "0.25rem" }}>עדיפות</label>
                  <select className="form-select ux-input ux-chip" value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value as Task["priority"] })}>
                    {PRIORITIES.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: "0.72rem", fontWeight: 600, color: "var(--foreground-muted)", display: "block", marginBottom: "0.25rem" }}>סוג תוכן</label>
                  <select className="form-select ux-input ux-chip" value={form.contentType} onChange={(e) => setForm({ ...form, contentType: e.target.value as "" | "post" | "story" | "reel" })} disabled={isEmployee}>
                    <option value="">ללא</option>
                    <option value="post">🖼️ פוסט</option>
                    <option value="story">📱 סטורי</option>
                    <option value="reel">🎬 רילס</option>
                  </select>
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
                <div>
                  <label style={{ fontSize: "0.72rem", fontWeight: 600, color: "var(--foreground-muted)", display: "block", marginBottom: "0.25rem" }}>לקוח</label>
                  <select className="form-select ux-input ux-chip" value={form.clientId} onChange={(e) => setForm({ ...form, clientId: e.target.value })}>
                    <option value="">ללא לקוח</option>
                    {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: "0.72rem", fontWeight: 600, color: "var(--foreground-muted)", display: "block", marginBottom: "0.25rem" }}>תאריך יעד</label>
                  <input className="form-input ux-input" type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} dir="ltr" />
                </div>
              </div>
              <div>
                <label style={{ fontSize: "0.72rem", fontWeight: 600, color: "var(--foreground-muted)", display: "block", marginBottom: "0.25rem" }}>תגיות (מופרדות בפסיק)</label>
                <input className="form-input ux-input" value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} placeholder="עיצוב, AI, עריכה" />
              </div>
              <div>
                <label style={{ fontSize: "0.72rem", fontWeight: 600, color: "var(--foreground-muted)", display: "block", marginBottom: "0.25rem" }}>תיאור</label>
                <textarea className="form-input ux-input" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="תיאור המשימה..." rows={3} style={{ resize: "vertical" }} />
              </div>

              {/* Assignees Section */}
              <div>
                <label style={{ fontSize: "0.72rem", fontWeight: 600, color: "var(--foreground-muted)", display: "block", marginBottom: "0.25rem" }}>מוקצה לעובדים</label>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                  <select
                    multiple
                    className="form-select ux-input ux-chip"
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

              {/* Notes Section */}
              <div>
                <label style={{ fontSize: "0.72rem", fontWeight: 600, color: "var(--foreground-muted)", display: "block", marginBottom: "0.25rem" }}>הערות</label>
                <textarea className="form-input ux-input" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="הערות פנימיות על המשימה..." rows={2} style={{ resize: "vertical", fontSize: "0.75rem" }} />
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
                  className="form-input ux-input"
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
