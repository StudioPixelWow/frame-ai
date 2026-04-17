'use client';

import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { useParams } from 'next/navigation';
import {
  useBusinessProjects,
  useProjectMilestones,
  useProjectPayments,
  useClients,
  useEmployees,
  useClientFiles,
  useTasks,
  useMilestoneFiles,
  useProjectTimeline,
} from '@/lib/api/use-entity';
import { BusinessProject, ProjectMilestone, ProjectPayment, Client, Employee, ClientFile, MilestoneFile, ProjectTimelineEvent } from '@/lib/db/schema';
import { ProjectNotificationBell } from '@/components/project-notification-bell';
import { useAuth } from '@/lib/auth/auth-context';

type Tab = 'overview' | 'milestones' | 'files' | 'payments' | 'activity';
type MilestoneStatus = 'pending' | 'in_progress' | 'submitted' | 'approved' | 'returned';
type ProjectPaymentStatus = 'pending' | 'collection_needed' | 'paid' | 'overdue';
type FileCategory = 'agreements' | 'branding' | 'website' | 'general';

interface MilestoneFormData {
  title: string;
  description: string;
  dueDate: string;
  assigneeId: string;
  notes: string;
}

interface FileFormData {
  url: string;
  category: FileCategory;
}

const statusColors: Record<MilestoneStatus, string> = {
  pending: '#6b7280',
  in_progress: '#f59e0b',
  submitted: '#8b5cf6',
  approved: '#22c55e',
  returned: '#f97316',
};

const paymentStatusLabels: Record<ProjectPaymentStatus, string> = {
  pending: 'בתהליך',
  collection_needed: 'צריך גביה',
  paid: 'שולם',
  overdue: 'באיחור',
};

interface PaymentFormData {
  title: string;
  amount: string;
  dueDate: string;
  description: string;
  milestoneId: string;
}

const projectTypeLabels: Record<string, string> = {
  website: 'אתר',
  branding: 'מיתוג',
  social: 'סושיאל',
  campaign: 'קמפיין',
  seo: 'SEO',
  landing_page: 'דף נחיתה',
  automation: 'אוטומציה',
  crm: 'CRM',
  design: 'עיצוב',
  consulting: 'ייעוץ',
};

const projectStatusLabels: Record<string, string> = {
  not_started: 'לא התחיל',
  in_progress: 'בתהליך',
  awaiting_approval: 'ממתין לאישור',
  waiting_for_client: 'בהמתנה ללקוח',
  completed: 'הושלם',
};

const projectStatusColors: Record<string, string> = {
  not_started: '#6b7280',
  in_progress: '#f59e0b',
  awaiting_approval: '#8b5cf6',
  waiting_for_client: '#f97316',
  completed: '#22c55e',
};

const milestoneStatusLabels: Record<MilestoneStatus, string> = {
  pending: 'בהמתנה',
  in_progress: 'בתהליך',
  submitted: 'הוגש',
  approved: 'אישור',
  returned: 'החזר',
};

// Project file upload constants
const MAX_PROJECT_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
const ALLOWED_FILE_EXTENSIONS = ['pdf', 'png', 'jpg', 'jpeg', 'gif', 'webp'];

// Safe helper functions
function formatDate(dateStr: string | null): string {
  try {
    if (!dateStr) return 'לא הגדר';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('he-IL');
  } catch {
    return dateStr || 'לא הגדר';
  }
}

function getProjectTypeLabel(type: string | undefined): string {
  if (!type) return '—';
  return projectTypeLabels[type] || type;
}

function getProjectStatusLabel(status: string | undefined): string {
  return projectStatusLabels[status || 'not_started'] || 'לא התחיל';
}

function getProjectStatusColor(status: string | undefined): string {
  return projectStatusColors[status || 'not_started'] || '#6b7280';
}

export default function BusinessProjectPage() {
  const params = useParams();
  const projectId = params.id as string;
  const { canEdit, canDelete, isClient } = useAuth();

  const { data: projectsData = [], loading: projectsLoading, update: updateProject } = useBusinessProjects();
  const { data: milestonesData = [], create: createMilestone, update: updateMilestone } = useProjectMilestones();
  const { data: paymentsData = [], create: createPayment, update: updatePayment } = useProjectPayments();
  const { data: clientsData = [] } = useClients();
  const { data: employeesData = [] } = useEmployees();
  const { data: clientFilesData = [], create: createClientFile } = useClientFiles();
  const { data: tasksData = [], create: createTask, update: updateTask } = useTasks();
  const { data: milestoneFilesData = [], refetch: refetchMilestoneFiles, remove: deleteMilestoneFile } = useMilestoneFiles();
  const { data: timelineData = [], refetch: refetchTimeline } = useProjectTimeline();

  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [editingMilestoneId, setEditingMilestoneId] = useState<string | null>(null);
  const [showMilestoneForm, setShowMilestoneForm] = useState(false);
  const [showFileForm, setShowFileForm] = useState(false);
  const [milestoneFormData, setMilestoneFormData] = useState<MilestoneFormData>({
    title: '',
    description: '',
    dueDate: '',
    assigneeId: '',
    notes: '',
  });
  const [fileFormData, setFileFormData] = useState<FileFormData>({
    url: '',
    category: 'general',
  });
  const [loading, setLoading] = useState(false);
  // Client-side override map — applied on top of the server milestone list so
  // a button click reflects instantly in the UI regardless of whether the
  // server response (or DB schema) includes the timestamp columns.
  const [milestoneOverrides, setMilestoneOverrides] = useState<Record<string, Record<string, unknown>>>({});
  // Pending employee selection per milestone — only committed on button click
  const [pendingAssignee, setPendingAssignee] = useState<Record<string, string>>({});
  // Per-milestone feedback: { milestoneId: { type: 'success'|'error', message: string } }
  const [assignFeedback, setAssignFeedback] = useState<Record<string, { type: 'success' | 'error'; message: string }>>({});
  // Track which milestone is currently being assigned (for loading state)
  const [assigningMilestone, setAssigningMilestone] = useState<string | null>(null);
  // Project editing state
  const [isEditingProject, setIsEditingProject] = useState(false);
  const [editForm, setEditForm] = useState<Record<string, unknown>>({});
  const [savingProject, setSavingProject] = useState(false);
  const [projectSaveFeedback, setProjectSaveFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [paymentFormData, setPaymentFormData] = useState<PaymentFormData>({
    title: '', amount: '', dueDate: '', description: '', milestoneId: '',
  });
  const [savingPayment, setSavingPayment] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  // Inline milestone notes editing (always-visible per-milestone)
  const [milestoneNotesDraft, setMilestoneNotesDraft] = useState<Record<string, string>>({});
  const [savingMilestoneNotes, setSavingMilestoneNotes] = useState<string | null>(null);
  const [milestoneNotesFeedback, setMilestoneNotesFeedback] = useState<Record<string, { type: 'success' | 'error'; message: string }>>({});

  // ── Derived data (useMemo) — must be declared before useCallback blocks that reference them ──
  const project = useMemo(
    () => projectsData.find((p: BusinessProject) => p.id === projectId),
    [projectsData, projectId]
  );

  const projectMilestones = useMemo(
    () =>
      (milestonesData || [])
        .filter((m: ProjectMilestone) => m.projectId === projectId)
        .map((m: ProjectMilestone) => ({
          ...(m as any),
          ...(milestoneOverrides[(m as any).id] || {}),
        })),
    [milestonesData, projectId, milestoneOverrides]
  );

  const projectPayments = useMemo(
    () => paymentsData.filter((p: ProjectPayment) => p.projectId === projectId),
    [paymentsData, projectId]
  );

  const projectClientFiles = useMemo(
    () => project ? clientFilesData.filter((f: ClientFile) => f.clientId === project.clientId) : [],
    [clientFilesData, project]
  );

  const projectClient = useMemo(
    () => project ? clientsData.find((c: Client) => c.id === project.clientId) : undefined,
    [clientsData, project]
  );

  const assignedManager = useMemo(
    () => project ? employeesData.find((e: Employee) => e.id === project.assignedManagerId) : undefined,
    [employeesData, project]
  );

  // Timeline events filtered for this project, sorted by newest first
  const projectTimeline = useMemo(
    () =>
      (timelineData || [])
        .filter((e: ProjectTimelineEvent) => e.projectId === projectId)
        .sort((a: ProjectTimelineEvent, b: ProjectTimelineEvent) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        ),
    [timelineData, projectId]
  );

  // ── Derived project status & progress from milestones (source of truth) ──
  // Counts per status bucket — used by both progress and status derivation.
  const milestoneCounts = useMemo(() => {
    const all = projectMilestones || [];
    return {
      total: all.length,
      pending: all.filter((m: any) => m.status === 'pending').length,
      inProgress: all.filter((m: any) => m.status === 'in_progress').length,
      submitted: all.filter((m: any) => m.status === 'submitted').length,
      approved: all.filter((m: any) => m.status === 'approved').length,
      returned: all.filter((m: any) => m.status === 'returned').length,
    };
  }, [projectMilestones]);

  // Progress: simple ratio — completed (approved) / total
  const milestoneProgress = useMemo(() => {
    if (milestoneCounts.total === 0) return 0;
    return Math.round((milestoneCounts.approved / milestoneCounts.total) * 100);
  }, [milestoneCounts]);

  // Color thresholds: 0–30% red, 30–70% orange, 70–100% green
  const progressBarColor = useMemo(() => {
    if (milestoneProgress <= 30) return '#ef4444';
    if (milestoneProgress <= 70) return '#f59e0b';
    return '#22c55e';
  }, [milestoneProgress]);

  // Status: derived entirely from milestone states
  const derivedProjectStatus = useMemo(() => {
    const { total, approved, submitted, inProgress, returned, pending } = milestoneCounts;
    if (total === 0) return project?.projectStatus || 'not_started';
    if (approved === total) return 'completed';
    if (submitted > 0 && inProgress === 0 && pending === 0 && returned === 0) return 'awaiting_approval';
    if (returned > 0) return 'waiting_for_client';
    if (inProgress > 0 || approved > 0 || submitted > 0) return 'in_progress';
    return 'not_started';
  }, [milestoneCounts, project?.projectStatus]);

  // ── Confetti effect when project reaches 100% ──
  const [showConfetti, setShowConfetti] = useState(false);
  const prevProgressRef = useRef<number>(0);
  useEffect(() => {
    if (milestoneProgress === 100 && prevProgressRef.current < 100 && prevProgressRef.current > 0) {
      setShowConfetti(true);
      const timer = setTimeout(() => setShowConfetti(false), 4500);
      return () => clearTimeout(timer);
    }
    prevProgressRef.current = milestoneProgress;
  }, [milestoneProgress]);

  // ── Sync derived status & progress back to the project DB record ──
  // Runs whenever milestones change so the project row always reflects reality.
  const lastSyncedRef = useRef<string>('');
  useEffect(() => {
    if (!project?.id || milestoneCounts.total === 0) return;
    // Build a fingerprint to avoid duplicate writes
    const fingerprint = `${derivedProjectStatus}|${milestoneProgress}`;
    if (fingerprint === lastSyncedRef.current) return;
    // Also skip if the project already has the correct values
    if (
      project?.projectStatus === derivedProjectStatus &&
      (project as any)?.progress === milestoneProgress
    ) {
      lastSyncedRef.current = fingerprint;
      return;
    }
    lastSyncedRef.current = fingerprint;
    // Fire-and-forget — no loading spinner, no blocking
    updateProject(project.id, {
      projectStatus: derivedProjectStatus,
      progress: milestoneProgress,
    } as any).catch((err: any) =>
      console.warn('[project-sync] failed to persist derived status:', err?.message)
    );
  }, [project?.id, project?.projectStatus, derivedProjectStatus, milestoneProgress, milestoneCounts.total, updateProject]);

  // ── Project file upload (hooks MUST be before any early return) ──
  const projectFileInputRef = useRef<HTMLInputElement | null>(null);
  const [uploadingProjectFile, setUploadingProjectFile] = useState(false);
  const [projectFileError, setProjectFileError] = useState<string | null>(null);

  const handleProjectFileUpload = useCallback(async (file: File) => {
    setProjectFileError(null);

    // Client-side validation
    if (file.size > MAX_PROJECT_FILE_SIZE) {
      setProjectFileError(`הקובץ גדול מדי (${(file.size / (1024 * 1024)).toFixed(1)} MB). מקסימום 10 MB`);
      return;
    }
    const ext = file.name.includes('.') ? file.name.split('.').pop()?.toLowerCase() || '' : '';
    if (!ALLOWED_FILE_EXTENSIONS.includes(ext)) {
      setProjectFileError(`סוג קובץ לא נתמך (${ext}). מותר: PDF, תמונות`);
      return;
    }

    setUploadingProjectFile(true);
    try {
      // 1. Upload to Supabase Storage via server endpoint
      const form = new FormData();
      form.append('file', file);
      form.append('projectId', projectId);
      const res = await fetch('/api/data/project-file-upload', { method: 'POST', body: form });
      const result = await res.json();
      if (!res.ok) {
        throw new Error(result?.error || `Upload failed (${res.status})`);
      }

      // 2. Save reference via the existing client-files flow
      await createClientFile({
        clientId: project?.clientId || '',
        fileName: file.name,
        fileUrl: result.url,
        fileType: ext === 'pdf' ? 'document' : 'image',
        category: fileFormData.category || 'general',
        fileSize: file.size,
        linkedTaskId: null,
        linkedGanttItemId: null,
        uploadedBy: null,
        notes: '',
      } as any);

      console.log(`[project-file-upload] ✅ saved file="${file.name}" url=${result.url}`);
    } catch (err: any) {
      console.error('[project-file-upload] error:', err);
      setProjectFileError(err?.message || 'שגיאה בהעלאה');
    } finally {
      setUploadingProjectFile(false);
      if (projectFileInputRef.current) projectFileInputRef.current.value = '';
    }
  }, [projectId, project?.clientId, fileFormData.category, createClientFile]);

  // ── Milestone file uploads (hooks MUST be before any early return) ──
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const [uploadingMilestone, setUploadingMilestone] = useState<string | null>(null);

  const handleMilestoneFileUpload = useCallback(async (milestoneId: string, file: File) => {
    console.log(`[milestone-upload] ▶ START  milestoneId="${milestoneId}" file="${file.name}" size=${file.size} type="${file.type}"`);
    setUploadingMilestone(milestoneId);
    try {
      const form = new FormData();
      form.append('file', file);
      form.append('milestoneId', milestoneId);
      console.log(`[milestone-upload] ▶ POST /api/data/milestone-files …`);
      const res = await fetch('/api/data/milestone-files', { method: 'POST', body: form });
      const body = await res.json().catch(() => ({}));
      console.log(`[milestone-upload] ◀ status=${res.status}`, JSON.stringify(body).slice(0, 300));
      if (!res.ok) {
        throw new Error(body?.error || `Upload failed (${res.status})`);
      }
      console.log(`[milestone-upload] ✅ upload saved, refetching files…`);
      await refetchMilestoneFiles();
      refetchTimeline();
      console.log(`[milestone-upload] ✅ refetch done, milestoneFilesData count=${milestoneFilesData?.length ?? '?'}`);
    } catch (err: any) {
      console.error('[milestone-upload] ❌ error:', err?.message || err);
      alert(`שגיאה בהעלאת קובץ: ${err?.message || 'unknown'}`);
    } finally {
      setUploadingMilestone(null);
      const input = fileInputRefs.current[milestoneId];
      if (input) input.value = '';
    }
  }, [refetchMilestoneFiles, refetchTimeline, milestoneFilesData?.length]);

  const handleDeleteMilestoneFile = useCallback(async (fileId: string) => {
    try {
      await deleteMilestoneFile(fileId);
      console.log(`[milestone-files] ✅ deleted file=${fileId}`);
    } catch (err: any) {
      console.error('[milestone-files] delete error:', err);
    }
  }, [deleteMilestoneFile]);

  const getFilesForMilestone = useCallback((milestoneId: string): MilestoneFile[] => {
    const files = Array.isArray(milestoneFilesData) ? milestoneFilesData : [];
    return files.filter(
      (f: MilestoneFile) => f?.milestoneId === milestoneId
    );
  }, [milestoneFilesData]);

  // While the projects list is still loading on first mount, projectsData is []
  // and `project` is undefined — don't render a misleading 404. Show a loader
  // until the fetch finishes, then check for the actual not-found case.
  if (projectsLoading) {
    return (
      <div style={{ padding: '40px', textAlign: 'center', direction: 'rtl', color: 'var(--foreground-muted)' }}>
        טוען...
      </div>
    );
  }

  if (!project) {
    return (
      <div style={{ padding: '40px', textAlign: 'center', direction: 'rtl' }}>
        <h1 style={{ color: 'var(--foreground)', marginBottom: '16px' }}>404 - פרויקט לא נמצא</h1>
        <p style={{ color: 'var(--foreground-muted)' }}>הפרויקט שחיפשת אינו קיים</p>
      </div>
    );
  }

  const completedMilestones = (projectMilestones || []).filter(
    (m: ProjectMilestone) => m?.status === 'approved'
  ).length;

  const paidAmount = (projectPayments || [])
    .filter((p: ProjectPayment) => p?.status === 'paid')
    .reduce((sum: number, p: ProjectPayment) => sum + (p?.amount || 0), 0);

  // scheduledAmount = sum of ALL payment rows (regardless of status)
  const scheduledAmount = (projectPayments || []).reduce((sum: number, p: ProjectPayment) => sum + (p?.amount || 0), 0);

  // remainingToCollect = budget minus what's already scheduled
  const remainingToCollect = (project?.budget || 0) - scheduledAmount;

  // NOTE: All handlers below use `function` declarations (not `const` arrows)
  // so they are hoisted and cannot cause TDZ "Cannot access before initialization" errors.
  async function handleAddMilestone() {
    if (!milestoneFormData.title || !milestoneFormData.dueDate) {
      return;
    }

    setLoading(true);
    try {
      await createMilestone({
        projectId,
        title: milestoneFormData.title,
        description: milestoneFormData.description,
        dueDate: milestoneFormData.dueDate,
        assignedEmployeeId: milestoneFormData.assigneeId,
        notes: milestoneFormData.notes,
        status: 'pending',
      } as any);

      setMilestoneFormData({
        title: '',
        description: '',
        dueDate: '',
        assigneeId: '',
        notes: '',
      });
      setShowMilestoneForm(false);
      refetchTimeline();
    } catch (error) {
      console.error('Error adding milestone:', error);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Assign (or clear) an employee on a milestone.
   * - Persists assignee_id on business_project_milestones.
   * - If an employee is picked and no task exists for this milestone yet,
   *   creates a row in public.tasks linking milestone ↔ employee ↔ project.
   * - Server-side POST /api/data/tasks also dedupes by milestone_id, so even
   *   concurrent clicks can't produce duplicate tasks.
   */
  /**
   * Called ONLY by the "שייך לעובד" button — never by dropdown onChange.
   * 1. Validates that an employee is selected
   * 2. Saves assignee_id on the milestone
   * 3. Creates or updates the related task in public.tasks
   * 4. Shows success/failure feedback
   */
  async function handleAssignMilestoneEmployee(milestone: any) {
    if (!milestone?.id) {
      console.warn('[assign] aborted — milestone has no id', milestone);
      return;
    }
    const selected = pendingAssignee[milestone.id];
    const normalized = selected && selected.trim() !== '' ? selected : null;

    // Validation: must pick an employee
    if (!normalized) {
      setAssignFeedback((prev) => ({
        ...prev,
        [milestone.id]: { type: 'error', message: 'יש לבחור עובד לפני שיוך' },
      }));
      return;
    }

    // Clear previous feedback, set loading
    setAssignFeedback((prev) => { const n = { ...prev }; delete n[milestone.id]; return n; });
    setAssigningMilestone(milestone.id);

    console.log(
      `[assign] start milestoneId=${milestone.id} employee=${normalized} project=${projectId} title="${milestone.title ?? ''}"`
    );

    // 1. Immediate local override so the dropdown shows the new selection.
    setMilestoneOverrides((prev) => ({
      ...prev,
      [milestone.id]: {
        ...(prev[milestone.id] || {}),
        assigneeId: normalized,
        assignedEmployeeId: normalized,
      },
    }));

    // 2. Persist the assignee on the milestone.
    try {
      const payload = { assigneeId: normalized, businessProjectId: projectId };
      console.log(`[assign] ➜ PUT /api/data/project-milestones/${milestone.id} payload=${JSON.stringify(payload)}`);
      const saved = await updateMilestone(milestone.id, payload as any);
      console.log(`[assign] ✅ assignee saved milestone=${milestone.id} employee=${normalized} serverAssigneeId=${(saved as any)?.assigneeId ?? 'null'}`);
    } catch (error) {
      console.error('[assign] ❌ assignee save failed:', error);
      setMilestoneOverrides((prev) => {
        const next = { ...prev };
        if (next[milestone.id]) {
          const entry = { ...next[milestone.id] };
          delete entry.assigneeId;
          delete entry.assignedEmployeeId;
          next[milestone.id] = entry;
        }
        return next;
      });
      setAssignFeedback((prev) => ({
        ...prev,
        [milestone.id]: { type: 'error', message: 'שגיאה בשמירת העובד על האבן דרך' },
      }));
      setAssigningMilestone(null);
      return;
    }

    // 3. Create or update the task for this milestone.
    //    Check if a task already exists for this milestone_id.
    try {
      const existingTask = (tasksData || []).find(
        (t: any) => t.milestoneId === milestone.id || (t as any).milestone_id === milestone.id
      );

      if (existingTask) {
        // UPDATE existing task
        const updatePayload = {
          assigneeId: normalized,
          businessProjectId: projectId,  // FK → public.business_projects (NOT project_id)
          title: milestone.title || 'משימה',
        };
        console.log(`[assign] ➜ PUT /api/data/tasks/${existingTask.id} (update) payload=${JSON.stringify(updatePayload)}`);
        const updated = await updateTask(existingTask.id, updatePayload as any);
        console.log(`[assign] ✅ task updated:`, JSON.stringify(updated));
      } else {
        // CREATE new task
        const taskPayload = {
          title: milestone.title || 'משימה',
          assigneeId: normalized,
          businessProjectId: projectId,  // FK → public.business_projects (NOT project_id)
          milestoneId: milestone.id,
          status: 'pending',
        };
        console.log(`[assign] ➜ POST /api/data/tasks payload=${JSON.stringify(taskPayload)}`);
        const created = await createTask(taskPayload as any);
        console.log(`[assign] ✅ task created:`, JSON.stringify(created));
      }

      setAssignFeedback((prev) => ({
        ...prev,
        [milestone.id]: { type: 'success', message: 'העובד שויך בהצלחה ומשימה נוצרה' },
      }));
    } catch (error: any) {
      const msg = error?.message ?? String(error);
      console.error('[assign] ❌ task creation/update failed:', msg, error);
      setAssignFeedback((prev) => ({
        ...prev,
        [milestone.id]: { type: 'error', message: `העובד שויך אך יצירת המשימה נכשלה: ${msg}` },
      }));
    }

    setAssigningMilestone(null);
    refetchTimeline();
    // Auto-clear success feedback after 4 seconds
    setTimeout(() => {
      setAssignFeedback((prev) => {
        const n = { ...prev };
        if (n[milestone.id]?.type === 'success') delete n[milestone.id];
        return n;
      });
    }, 4000);
  };

  async function handleUpdateMilestone(milestoneId: string, updates: Partial<ProjectMilestone>) {
    setLoading(true);

    // Build the enriched payload. Status transitions auto-attach timestamps.
    const now = new Date().toISOString();
    const currentMilestone = (milestonesData || []).find((m: any) => m?.id === milestoneId) as any;
    const enriched: Record<string, unknown> = { ...updates };
    if (updates.status === 'in_progress' && !currentMilestone?.startedAt) {
      enriched.startedAt = now;
    }
    if (updates.status === 'submitted') {
      enriched.submittedAt = now;
    }
    if (updates.status === 'approved') {
      enriched.approvedAt = now;
    }
    if (updates.status === 'completed') {
      enriched.completedAt = now;
    }

    // Apply immediate local override so the card updates the instant the
    // user clicks — no waiting for the network, no dependence on whether
    // the DB column exists.
    setMilestoneOverrides((prev) => ({
      ...prev,
      [milestoneId]: { ...(prev[milestoneId] || {}), ...enriched },
    }));

    try {
      const saved = await updateMilestone(milestoneId, enriched as any);
      // Merge any server-confirmed fields back into the override so the
      // local view matches the server response exactly.
      if (saved && typeof saved === 'object') {
        setMilestoneOverrides((prev) => ({
          ...prev,
          [milestoneId]: { ...(prev[milestoneId] || {}), ...(saved as any) },
        }));
      }
      setEditingMilestoneId(null);
      // Refetch timeline to show new events
      refetchTimeline();
    } catch (error) {
      console.error('Error updating milestone:', error);
      // Roll back the override on failure so the UI doesn't show stale state.
      setMilestoneOverrides((prev) => {
        const next = { ...prev };
        delete next[milestoneId];
        return next;
      });
    } finally {
      setLoading(false);
    }
  };

  async function handleUpdatePaymentStatus(paymentId: string, status: ProjectPaymentStatus) {
    setLoading(true);
    try {
      const paidAt = status === 'paid' ? new Date().toISOString() : null;
      await updatePayment(paymentId, { status, paidAt } as any);
      refetchTimeline();
    } catch (error) {
      console.error('Error updating payment:', error);
    } finally {
      setLoading(false);
    }
  };

  async function handleAddPayment() {
    if (!paymentFormData.title || !paymentFormData.amount) return;
    setSavingPayment(true);
    setPaymentError(null);
    try {
      const payload = {
        projectId,
        clientId: project?.clientId || '',
        title: paymentFormData.title,
        amount: parseFloat(paymentFormData.amount) || 0,
        dueDate: paymentFormData.dueDate || null,
        status: 'pending' as const,
        description: paymentFormData.description,
        milestoneId: paymentFormData.milestoneId || null,
      };
      console.log('[handleAddPayment] creating payment:', JSON.stringify(payload));
      const result = await createPayment(payload as any);
      console.log('[handleAddPayment] payment created:', JSON.stringify(result));
      setPaymentFormData({ title: '', amount: '', dueDate: '', description: '', milestoneId: '' });
      setShowPaymentForm(false);
      refetchTimeline();
    } catch (error: any) {
      console.error('Error adding payment:', error);
      setPaymentError(error?.message || 'שגיאה בשמירת התשלום');
    } finally {
      setSavingPayment(false);
    }
  }

  async function handleAddFile() {
    if (!fileFormData.url) {
      return;
    }

    setLoading(true);
    try {
      const fileName = fileFormData.url.split('/').pop() || 'קובץ';
      await createClientFile({
        clientId: project.clientId,
        fileName,
        fileUrl: fileFormData.url,
        fileType: 'other' as const,
        category: fileFormData.category,
        fileSize: 0,
        linkedTaskId: null,
        linkedGanttItemId: null,
        uploadedBy: null,
        notes: '',
      } as any);

      setFileFormData({ url: '', category: 'general' });
      setShowFileForm(false);
    } catch (error) {
      console.error('Error adding file:', error);
    } finally {
      setLoading(false);
    }
  };

  async function handleUpdateProjectStatus(newStatus: string) {
    setLoading(true);
    try {
      await updateProject(projectId, { projectStatus: newStatus } as any);
    } catch (error) {
      console.error('Error updating project status:', error);
    } finally {
      setLoading(false);
    }
  };

  async function handleMarkComplete() {
    // Mark all non-approved milestones as approved first, so the derivation
    // logic agrees that the project is completed (it checks all milestones).
    setLoading(true);
    try {
      const nonApproved = (projectMilestones || []).filter(
        (m: any) => m.status !== 'approved'
      );
      await Promise.all(
        nonApproved.map((m: any) =>
          updateMilestone(m.id, { status: 'approved' } as any).catch((err: any) =>
            console.warn(`[handleMarkComplete] failed to approve milestone ${m.id}:`, err?.message)
          )
        )
      );
      // Update the project status explicitly as well (derivation will sync anyway)
      await updateProject(projectId, { projectStatus: 'completed', progress: 100 } as any);
      refetchTimeline();
    } catch (error) {
      console.error('Error marking project complete:', error);
    } finally {
      setLoading(false);
    }
  }

  function handleStartEditProject() {
    setEditForm({
      projectName: project?.projectName || '',
      serviceType: project?.serviceType || project?.projectType || '',
      description: project?.description || '',
      assignedManagerId: project?.assignedManagerId || '',
      startDate: project?.startDate ? (project.startDate as string).slice(0, 10) : '',
      endDate: project?.endDate ? (project.endDate as string).slice(0, 10) : '',
      projectStatus: project?.projectStatus || 'not_started',
      contractSigned: (project as any)?.contractSigned ?? false,
      budget: project?.budget ?? 0,
    });
    setIsEditingProject(true);
    setProjectSaveFeedback(null);
  };

  function handleCancelEditProject() {
    setIsEditingProject(false);
    setEditForm({});
    setProjectSaveFeedback(null);
  };

  async function handleSaveProject() {
    setSavingProject(true);
    setProjectSaveFeedback(null);
    try {
      const payload: Record<string, unknown> = { ...editForm };
      // If contractSigned changed to true and was previously false, set timestamp
      const wasSigned = (project as any)?.contractSigned ?? false;
      if (payload.contractSigned && !wasSigned) {
        payload.contractSignedAt = new Date().toISOString();
      } else if (!payload.contractSigned && wasSigned) {
        payload.contractSignedAt = null;
      }
      console.log(`[project-edit] saving project=${projectId} payload=${JSON.stringify(payload)}`);
      await updateProject(projectId, payload as any);
      setIsEditingProject(false);
      setProjectSaveFeedback({ type: 'success', message: 'הפרויקט עודכן בהצלחה' });
      setTimeout(() => setProjectSaveFeedback(null), 3000);
      refetchTimeline();
    } catch (error: any) {
      console.error('[project-edit] save failed:', error);
      setProjectSaveFeedback({ type: 'error', message: `שגיאה בשמירה: ${error?.message || 'unknown'}` });
    } finally {
      setSavingProject(false);
    }
  };

  async function handleToggleContractSigned() {
    const current = (project as any)?.contractSigned ?? false;
    const newVal = !current;
    try {
      const payload: Record<string, unknown> = { contractSigned: newVal };
      if (newVal) payload.contractSignedAt = new Date().toISOString();
      else payload.contractSignedAt = null;
      await updateProject(projectId, payload as any);
      refetchTimeline();
    } catch (error) {
      console.error('[project-edit] contract toggle failed:', error);
    }
  };

  return (
    <div
      style={{
        direction: 'rtl',
        padding: '32px',
        maxWidth: '1400px',
        margin: '0 auto',
        fontFamily: 'system-ui, -apple-system, sans-serif',
      }}
    >
      {/* ── CSS Animations ── */}
      <style>{`
        @keyframes confetti-drift {
          0% { transform: translateY(-8px) translateX(0) rotate(0deg) scale(1); opacity: 0.9; }
          25% { transform: translateY(25vh) translateX(15px) rotate(180deg) scale(0.95); opacity: 0.8; }
          50% { transform: translateY(50vh) translateX(-10px) rotate(360deg) scale(0.85); opacity: 0.6; }
          75% { transform: translateY(75vh) translateX(8px) rotate(540deg) scale(0.7); opacity: 0.3; }
          100% { transform: translateY(100vh) translateX(-5px) rotate(720deg) scale(0.5); opacity: 0; }
        }
        @keyframes fade-in-up {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes pulse-glow {
          0%, 100% { box-shadow: 0 0 0 0 rgba(34,197,94,0.3); }
          50% { box-shadow: 0 0 16px 4px rgba(34,197,94,0.15); }
        }
        @keyframes progress-shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(200%); }
        }
        @keyframes status-pop {
          0% { transform: scale(1); }
          40% { transform: scale(1.08); }
          100% { transform: scale(1); }
        }
        .prj-card {
          background: #1a1a2e;
          border: 1px solid rgba(255,255,255,0.06);
          border-radius: 12px;
          padding: 20px;
          transition: transform 0.25s cubic-bezier(0.4,0,0.2,1), box-shadow 0.25s cubic-bezier(0.4,0,0.2,1), border-color 0.3s ease;
        }
        .prj-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 24px rgba(0,0,0,0.3);
          border-color: rgba(255,255,255,0.12);
        }
        .prj-milestone-card {
          background: #1a1a2e;
          border: 1px solid rgba(255,255,255,0.06);
          border-radius: 12px;
          padding: 20px;
          transition: transform 0.3s cubic-bezier(0.4,0,0.2,1),
                      box-shadow 0.3s cubic-bezier(0.4,0,0.2,1),
                      border-color 0.4s ease,
                      border-right-color 0.5s ease;
          animation: fade-in-up 0.4s cubic-bezier(0.4,0,0.2,1) both;
        }
        .prj-milestone-card:hover {
          transform: translateY(-3px) scale(1.003);
          box-shadow: 0 12px 32px rgba(0,0,0,0.35), 0 0 0 1px rgba(99,102,241,0.08);
          border-color: rgba(255,255,255,0.15);
        }
        .prj-milestone-card:active {
          transform: translateY(-1px) scale(0.998);
          transition-duration: 0.1s;
        }
        .prj-status-badge {
          display: inline-flex; align-items: center; gap: 6px;
          padding: 5px 14px; border-radius: 20px;
          font-size: 12px; font-weight: 600; letter-spacing: 0.3px;
          transition: all 0.35s cubic-bezier(0.4,0,0.2,1);
        }
        .prj-status-badge[data-fresh="true"] {
          animation: status-pop 0.35s cubic-bezier(0.4,0,0.2,1);
        }
        .prj-btn {
          padding: 8px 16px; border-radius: 8px; font-size: 13px; font-weight: 600;
          cursor: pointer; border: none;
          transition: transform 0.2s cubic-bezier(0.4,0,0.2,1), box-shadow 0.2s ease, background 0.2s ease, color 0.2s ease;
        }
        .prj-btn:hover { transform: translateY(-1px); }
        .prj-btn:active { transform: translateY(0) scale(0.97); transition-duration: 0.08s; }
        .prj-btn-primary { background: #6366f1; color: #fff; }
        .prj-btn-primary:hover { background: #818cf8; box-shadow: 0 4px 12px rgba(99,102,241,0.3); }
        .prj-btn-success { background: #22c55e; color: #fff; }
        .prj-btn-success:hover { background: #4ade80; box-shadow: 0 4px 12px rgba(34,197,94,0.3); }
        .prj-btn-ghost { background: transparent; color: #94a3b8; border: 1px solid rgba(255,255,255,0.1); }
        .prj-btn-ghost:hover { background: rgba(255,255,255,0.05); color: #e2e8f0; }
        .prj-btn-danger { background: transparent; color: #f87171; border: 1px solid rgba(248,113,113,0.3); }
        .prj-btn-danger:hover { background: rgba(248,113,113,0.1); }
        .prj-tab {
          padding: 12px 20px; background: none; border: none;
          font-size: 14px; font-weight: 500; cursor: pointer;
          color: #64748b; border-bottom: 2px solid transparent;
          transition: color 0.25s ease, border-color 0.25s ease; position: relative;
        }
        .prj-tab:hover { color: #94a3b8; }
        .prj-tab-active { color: #6366f1 !important; border-bottom-color: #6366f1 !important; font-weight: 600; }
        .prj-timeline-item {
          display: flex; gap: 16px; align-items: flex-start;
          padding: 16px 20px; border-radius: 10px;
          background: #1a1a2e; border: 1px solid rgba(255,255,255,0.04);
          transition: background 0.25s ease, border-color 0.25s ease;
          animation: fade-in-up 0.4s cubic-bezier(0.4,0,0.2,1) both;
        }
        .prj-timeline-item:hover { background: #1e1e36; border-color: rgba(255,255,255,0.08); }
        .prj-file-chip {
          display: flex; align-items: center; gap: 8px;
          padding: 8px 12px; background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.06); border-radius: 8px;
          font-size: 12px; transition: all 0.2s ease; cursor: pointer;
          text-decoration: none; color: inherit;
        }
        .prj-file-chip:hover { background: rgba(99,102,241,0.1); border-color: rgba(99,102,241,0.3); }
        .prj-progress-track {
          width: 100%; height: 8px; background: rgba(255,255,255,0.06);
          border-radius: 4px; overflow: hidden; position: relative;
        }
        .prj-progress-fill {
          height: 100%; border-radius: 4px; position: relative; overflow: hidden;
          transition: width 1s cubic-bezier(0.4,0,0.2,1), background 0.5s ease;
        }
        .prj-progress-fill::after {
          content: '';
          position: absolute; inset: 0;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.15), transparent);
          animation: progress-shimmer 2.5s ease-in-out infinite;
        }
      `}</style>

      {/* ── Confetti Overlay ── */}
      {showConfetti && (
        <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 9999, overflow: 'hidden' }}>
          {Array.from({ length: 28 }).map((_, i) => {
            const colors = ['#22c55e', '#4ade80', '#6366f1', '#818cf8', '#a78bfa', '#34d399'];
            const size = 4 + Math.random() * 5;
            const shapes = ['50%', '2px', '1px'];
            return (
              <div
                key={i}
                style={{
                  position: 'absolute',
                  top: '-8px',
                  left: `${5 + Math.random() * 90}%`,
                  width: `${size}px`,
                  height: `${size * (0.6 + Math.random() * 0.8)}px`,
                  background: colors[i % colors.length],
                  borderRadius: shapes[i % shapes.length],
                  animation: `confetti-drift ${3 + Math.random() * 2.5}s cubic-bezier(0.25, 0.46, 0.45, 0.94) ${Math.random() * 0.8}s forwards`,
                  opacity: 0,
                }}
              />
            );
          })}
        </div>
      )}

      {/* ══════════ HEADER ══════════ */}
      <div
        style={{
          marginBottom: '28px',
          background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
          border: '1px solid rgba(255,255,255,0.06)',
          borderRadius: '16px',
          padding: '28px 32px',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Subtle accent glow */}
        <div style={{
          position: 'absolute', top: '-40px', left: '-40px', width: '200px', height: '200px',
          background: `radial-gradient(circle, ${progressBarColor}15 0%, transparent 70%)`,
          pointerEvents: 'none',
        }} />

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px', position: 'relative' }}>
          <div style={{ flex: 1 }}>
            {isEditingProject ? (
              <input
                type="text"
                value={(editForm.projectName as string) || ''}
                onChange={(e) => setEditForm((f) => ({ ...f, projectName: e.target.value }))}
                style={{
                  fontSize: '28px', fontWeight: '700', color: '#f1f5f9',
                  background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '8px', padding: '6px 12px', width: '100%',
                  marginBottom: '8px', direction: 'rtl', outline: 'none',
                }}
                placeholder="שם הפרויקט"
              />
            ) : (
              <h1 style={{ fontSize: '28px', fontWeight: '700', color: '#f1f5f9', margin: '0 0 6px 0', letterSpacing: '-0.3px' }}>
                {project.projectName}
              </h1>
            )}
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
              {projectClient && (
                <span style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                  <a href={`/clients/${projectClient.id}`} style={{
                    color: '#818cf8', textDecoration: 'none', fontSize: '14px', fontWeight: '500',
                    transition: 'color 0.2s',
                  }}>
                    {projectClient.name}
                  </a>
                  {projectClient.phone && (
                    <a href={`tel:${projectClient.phone}`} style={{ color: '#94a3b8', fontSize: '12px', textDecoration: 'none' }} title="טלפון">
                      {projectClient.phone}
                    </a>
                  )}
                  {projectClient.email && (
                    <a href={`mailto:${projectClient.email}`} style={{ color: '#94a3b8', fontSize: '12px', textDecoration: 'none' }} title="אימייל">
                      {projectClient.email}
                    </a>
                  )}
                </span>
              )}
              <span style={{ color: 'rgba(255,255,255,0.2)' }}>|</span>
              <span className="prj-status-badge" style={{
                background: `${getProjectStatusColor(derivedProjectStatus)}20`,
                color: getProjectStatusColor(derivedProjectStatus),
              }}>
                <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: getProjectStatusColor(derivedProjectStatus) }} />
                {getProjectStatusLabel(derivedProjectStatus)}
              </span>
              {!isEditingProject && (
                <span className="prj-status-badge" style={{
                  background: 'rgba(255,255,255,0.05)', color: '#94a3b8',
                }}>
                  {getProjectTypeLabel(project?.projectType)}
                </span>
              )}
            </div>
          </div>

          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <ProjectNotificationBell projectId={projectId} />
            {isEditingProject ? (
              <>
                <button className="prj-btn prj-btn-primary" onClick={handleSaveProject} disabled={savingProject}>
                  {savingProject ? '...' : 'שמור שינויים'}
                </button>
                <button className="prj-btn prj-btn-ghost" onClick={handleCancelEditProject} disabled={savingProject}>
                  ביטול
                </button>
              </>
            ) : (
              <>
                {canEdit && (
                  <button className="prj-btn prj-btn-ghost" onClick={handleStartEditProject}>
                    עריכה
                  </button>
                )}
                {canEdit && (
                  <button className="prj-btn prj-btn-success" onClick={handleMarkComplete} disabled={loading}>
                    סימון כהושלם
                  </button>
                )}
              </>
            )}
          </div>
        </div>

        {/* Edit mode fields */}
        {isEditingProject && (
          <div style={{ marginBottom: '20px', display: 'grid', gap: '16px' }}>
            <div>
              <span style={{ fontSize: '12px', color: '#64748b', display: 'block', marginBottom: '4px' }}>תיאור</span>
              <textarea
                value={(editForm.description as string) || ''}
                onChange={(e) => setEditForm((f) => ({ ...f, description: e.target.value }))}
                rows={3}
                style={{
                  width: '100%', fontSize: '14px', color: '#e2e8f0',
                  background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '8px', padding: '10px 12px', direction: 'rtl', resize: 'vertical', outline: 'none',
                }}
                placeholder="תיאור הפרויקט"
              />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px' }}>
              <div>
                <span style={{ fontSize: '12px', color: '#64748b', display: 'block', marginBottom: '4px' }}>סוג</span>
                <select
                  value={(editForm.serviceType as string) || ''}
                  onChange={(e) => setEditForm((f) => ({ ...f, serviceType: e.target.value }))}
                  style={{
                    fontSize: '13px', color: '#e2e8f0', background: 'rgba(255,255,255,0.05)',
                    border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', padding: '8px 10px',
                    width: '100%', direction: 'rtl', outline: 'none',
                  }}
                >
                  <option value="">בחר סוג</option>
                  {Object.entries(projectTypeLabels).map(([val, label]) => (
                    <option key={val} value={val}>{label}</option>
                  ))}
                </select>
              </div>
              <div>
                <span style={{ fontSize: '12px', color: '#64748b', display: 'block', marginBottom: '4px' }}>סטטוס</span>
                <select
                  value={(editForm.projectStatus as string) || 'not_started'}
                  onChange={(e) => setEditForm((f) => ({ ...f, projectStatus: e.target.value }))}
                  style={{
                    fontSize: '13px', color: '#e2e8f0', background: 'rgba(255,255,255,0.05)',
                    border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', padding: '8px 10px',
                    width: '100%', direction: 'rtl', outline: 'none',
                  }}
                >
                  <option value="not_started">לא התחיל</option>
                  <option value="in_progress">בתהליך</option>
                  <option value="awaiting_approval">ממתין לאישור</option>
                  <option value="waiting_for_client">בהמתנה ללקוח</option>
                  <option value="completed">הושלם</option>
                </select>
              </div>
              <div>
                <span style={{ fontSize: '12px', color: '#64748b', display: 'block', marginBottom: '4px' }}>מנהל</span>
                <select
                  value={(editForm.assignedManagerId as string) || ''}
                  onChange={(e) => setEditForm((f) => ({ ...f, assignedManagerId: e.target.value }))}
                  style={{
                    fontSize: '13px', color: '#e2e8f0', background: 'rgba(255,255,255,0.05)',
                    border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', padding: '8px 10px',
                    width: '100%', direction: 'rtl', outline: 'none',
                  }}
                >
                  <option value="">לא הוצמד</option>
                  {(employeesData || []).map((emp: Employee) => (
                    <option key={emp.id} value={emp.id}>{emp.name || (emp as any).email}</option>
                  ))}
                </select>
              </div>
              <div>
                <span style={{ fontSize: '12px', color: '#64748b', display: 'block', marginBottom: '4px' }}>תאריך התחלה</span>
                <input type="date" value={(editForm.startDate as string) || ''}
                  onChange={(e) => setEditForm((f) => ({ ...f, startDate: e.target.value }))}
                  style={{
                    fontSize: '13px', color: '#e2e8f0', background: 'rgba(255,255,255,0.05)',
                    border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', padding: '8px 10px', width: '100%', outline: 'none',
                  }}
                />
              </div>
              <div>
                <span style={{ fontSize: '12px', color: '#64748b', display: 'block', marginBottom: '4px' }}>תאריך סיום</span>
                <input type="date" value={(editForm.endDate as string) || ''}
                  onChange={(e) => setEditForm((f) => ({ ...f, endDate: e.target.value }))}
                  style={{
                    fontSize: '13px', color: '#e2e8f0', background: 'rgba(255,255,255,0.05)',
                    border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', padding: '8px 10px', width: '100%', outline: 'none',
                  }}
                />
              </div>
              <div>
                <span style={{ fontSize: '12px', color: '#64748b', display: 'block', marginBottom: '4px' }}>חוזה חתום</span>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', padding: '8px 0' }}>
                  <input type="checkbox" checked={!!editForm.contractSigned}
                    onChange={(e) => setEditForm((f) => ({ ...f, contractSigned: e.target.checked }))}
                    style={{ width: '16px', height: '16px', accentColor: '#6366f1' }}
                  />
                  <span style={{ fontSize: '13px', color: '#e2e8f0' }}>
                    {editForm.contractSigned ? 'חתום' : 'לא חתום'}
                  </span>
                </label>
              </div>
              <div>
                <span style={{ fontSize: '12px', color: '#64748b', display: 'block', marginBottom: '4px' }}>מחיר כולל (₪)</span>
                <input type="number" value={editForm.budget as number ?? 0}
                  onChange={(e) => setEditForm((f) => ({ ...f, budget: parseFloat(e.target.value) || 0 }))}
                  style={{
                    fontSize: '13px', color: '#e2e8f0', background: 'rgba(255,255,255,0.05)',
                    border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', padding: '8px 10px',
                    width: '100%', direction: 'rtl', outline: 'none',
                  }}
                  placeholder="0"
                  min="0"
                />
              </div>
            </div>
          </div>
        )}

        {/* Progress bar in header */}
        <div style={{ position: 'relative' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <div style={{ display: 'flex', gap: '16px', alignItems: 'center', fontSize: '13px', color: '#94a3b8' }}>
              <span>{completedMilestones} / {projectMilestones?.length || 0} אבני דרך</span>
              {!isEditingProject && (
                <>
                  <span style={{ color: 'rgba(255,255,255,0.1)' }}>|</span>
                  <span>{assignedManager?.name || 'ללא מנהל'}</span>
                  <span style={{ color: 'rgba(255,255,255,0.1)' }}>|</span>
                  <span>{formatDate(project?.startDate || null)} - {formatDate(project?.endDate || null)}</span>
                </>
              )}
            </div>
            <span style={{
              fontSize: '20px', fontWeight: '700', color: progressBarColor,
              transition: 'color 0.4s ease',
            }}>
              {milestoneProgress}%
            </span>
          </div>
          <div className="prj-progress-track">
            <div
              className="prj-progress-fill"
              style={{
                width: `${milestoneProgress}%`,
                background: `linear-gradient(90deg, ${progressBarColor}, ${progressBarColor}cc)`,
                animation: milestoneProgress === 100 ? 'pulse-glow 2s ease-in-out infinite' : undefined,
              }}
            />
          </div>
        </div>

        {/* Non-edit info chips */}
        {!isEditingProject && (
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginTop: '16px' }}>
            <button
              onClick={handleToggleContractSigned}
              disabled={loading}
              className="prj-btn"
              style={{
                padding: '4px 14px', fontSize: '12px',
                background: (project as any)?.contractSigned ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
                color: (project as any)?.contractSigned ? '#4ade80' : '#f87171',
                border: `1px solid ${(project as any)?.contractSigned ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.2)'}`,
                borderRadius: '20px',
              }}
            >
              {(project as any)?.contractSigned ? '✓ חוזה חתום' : '✗ חוזה לא חתום'}
            </button>
            {milestoneCounts.total > 0 && (
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                {milestoneCounts.approved > 0 && (
                  <span style={{ fontSize: '11px', padding: '4px 10px', borderRadius: '20px', background: 'rgba(34,197,94,0.1)', color: '#4ade80' }}>
                    ✓ {milestoneCounts.approved} אושרו
                  </span>
                )}
                {milestoneCounts.submitted > 0 && (
                  <span style={{ fontSize: '11px', padding: '4px 10px', borderRadius: '20px', background: 'rgba(139,92,246,0.1)', color: '#a78bfa' }}>
                    {milestoneCounts.submitted} הוגשו
                  </span>
                )}
                {milestoneCounts.inProgress > 0 && (
                  <span style={{ fontSize: '11px', padding: '4px 10px', borderRadius: '20px', background: 'rgba(245,158,11,0.1)', color: '#fbbf24' }}>
                    {milestoneCounts.inProgress} בתהליך
                  </span>
                )}
                {milestoneCounts.returned > 0 && (
                  <span style={{ fontSize: '11px', padding: '4px 10px', borderRadius: '20px', background: 'rgba(249,115,22,0.1)', color: '#fb923c' }}>
                    {milestoneCounts.returned} הוחזרו
                  </span>
                )}
                {milestoneCounts.pending > 0 && (
                  <span style={{ fontSize: '11px', padding: '4px 10px', borderRadius: '20px', background: 'rgba(255,255,255,0.05)', color: '#94a3b8' }}>
                    {milestoneCounts.pending} בהמתנה
                  </span>
                )}
              </div>
            )}
          </div>
        )}

        {/* Feedback */}
        {projectSaveFeedback && (
          <div style={{
            marginTop: '12px', fontSize: '13px', padding: '8px 14px', borderRadius: '8px',
            background: projectSaveFeedback.type === 'success' ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
            color: projectSaveFeedback.type === 'success' ? '#4ade80' : '#f87171',
          }}>
            {projectSaveFeedback.message}
          </div>
        )}
      </div>

      {/* ══════════ TABS ══════════ */}
      <div style={{
        display: 'flex', gap: '4px',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        marginBottom: '28px',
      }}>
        {(['overview', 'milestones', 'files', 'payments', 'activity'] as const).map((tab) => {
          const tabLabels: Record<Tab, string> = {
            overview: 'סקירה',
            milestones: 'אבני דרך',
            files: 'קבצים',
            payments: 'תשלומים',
            activity: 'פעילות',
          };
          return (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`prj-tab ${activeTab === tab ? 'prj-tab-active' : ''}`}
            >
              {tabLabels[tab]}
            </button>
          );
        })}
      </div>

      {/* ══════════ OVERVIEW TAB ══════════ */}
      {activeTab === 'overview' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
          {/* Project Summary */}
          <div className="prj-card">
            <h3 style={{ fontSize: '14px', fontWeight: '600', color: '#94a3b8', marginTop: 0, marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              סיכום פרויקט
            </h3>
            <p style={{ color: '#cbd5e1', fontSize: '14px', lineHeight: '1.7', margin: 0 }}>
              {project?.description || 'אין תיאור זמין'}
            </p>
          </div>

          {/* Milestones Progress Card */}
          <div className="prj-card">
            <h3 style={{ fontSize: '14px', fontWeight: '600', color: '#94a3b8', marginTop: 0, marginBottom: '16px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              התקדמות אבני דרך
            </h3>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '10px' }}>
              <span style={{ color: '#e2e8f0', fontWeight: '600', fontSize: '14px' }}>
                {completedMilestones} / {projectMilestones?.length || 0}
              </span>
              <span style={{ fontSize: '24px', fontWeight: '700', color: progressBarColor, transition: 'color 0.4s' }}>
                {milestoneProgress}%
              </span>
            </div>
            <div className="prj-progress-track">
              <div
                className="prj-progress-fill"
                style={{
                  width: `${milestoneProgress}%`,
                  background: progressBarColor,
                }}
              />
            </div>
          </div>

          {/* Payments Summary */}
          <div className="prj-card">
            <h3 style={{ fontSize: '14px', fontWeight: '600', color: '#94a3b8', marginTop: 0, marginBottom: '16px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              תשלומים
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {(project?.budget > 0) && (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#64748b', fontSize: '13px' }}>מחיר פרויקט</span>
                    <span style={{ color: '#818cf8', fontWeight: '700', fontSize: '16px' }}>₪{(project!.budget).toLocaleString('he-IL')}</span>
                  </div>
                  <div style={{ height: '1px', background: 'rgba(255,255,255,0.06)' }} />
                </>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#64748b', fontSize: '13px' }}>תשלומים מתוכננים</span>
                <span style={{ color: '#e2e8f0', fontWeight: '600', fontSize: '15px' }}>₪{scheduledAmount.toLocaleString('he-IL')}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#64748b', fontSize: '13px' }}>שולם</span>
                <span style={{ color: '#4ade80', fontWeight: '600', fontSize: '15px' }}>₪{paidAmount.toLocaleString('he-IL')}</span>
              </div>
              <div style={{ height: '1px', background: 'rgba(255,255,255,0.06)' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#64748b', fontSize: '13px' }}>נותר לגביה</span>
                <span style={{ color: '#fbbf24', fontWeight: '600', fontSize: '15px' }}>₪{remainingToCollect.toLocaleString('he-IL')}</span>
              </div>
            </div>
          </div>

          {/* Timeline & Dates */}
          <div className="prj-card" style={{ gridColumn: '1 / -1' }}>
            <h3 style={{ fontSize: '14px', fontWeight: '600', color: '#94a3b8', marginTop: 0, marginBottom: '16px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              ציר זמן
            </h3>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '20px' }}>
              <div style={{
                padding: '10px 20px', background: 'rgba(99,102,241,0.1)', borderRadius: '10px',
                border: '1px solid rgba(99,102,241,0.15)',
              }}>
                <div style={{ fontSize: '11px', color: '#818cf8', marginBottom: '2px' }}>התחלה</div>
                <div style={{ fontSize: '14px', fontWeight: '600', color: '#e2e8f0' }}>
                  {formatDate(project?.startDate || null)}
                </div>
              </div>
              <div style={{ flex: 1, height: '2px', background: 'linear-gradient(90deg, rgba(99,102,241,0.3), rgba(34,197,94,0.3))' }} />
              <div style={{
                padding: '10px 20px', background: 'rgba(34,197,94,0.1)', borderRadius: '10px',
                border: '1px solid rgba(34,197,94,0.15)',
              }}>
                <div style={{ fontSize: '11px', color: '#4ade80', marginBottom: '2px' }}>סיום</div>
                <div style={{ fontSize: '14px', fontWeight: '600', color: '#e2e8f0' }}>
                  {formatDate(project?.endDate || null)}
                </div>
              </div>
            </div>
            {/* Recent timeline events */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {projectTimeline.slice(0, 5).map((event: ProjectTimelineEvent) => {
                const iconMap: Record<string, string> = {
                  milestone_created: '📌', milestone_status_changed: '🔄',
                  milestone_assigned: '👤', milestone_completed: '✅',
                  file_uploaded: '📎', payment_created: '💰',
                  project_created: '⭐', project_edited: '✏️',
                };
                return (
                  <div key={event.id} style={{ display: 'flex', gap: '10px', alignItems: 'center', fontSize: '13px' }}>
                    <span>{iconMap[event.actionType] || '📋'}</span>
                    <span style={{ color: '#cbd5e1', flex: 1 }}>{event.description}</span>
                    <span style={{ color: '#475569', fontSize: '11px', flexShrink: 0 }}>
                      {new Date(event.createdAt).toLocaleDateString('he-IL')}
                    </span>
                  </div>
                );
              })}
              {projectTimeline.length === 0 && (
                <span style={{ color: '#475569', fontSize: '13px' }}>פרויקט נוצר בתאריך {formatDate(project?.createdAt || null)}</span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ══════════ MILESTONES TAB ══════════ */}
      {activeTab === 'milestones' && (
        <div>
          {canEdit && (
          <div style={{ marginBottom: '24px' }}>
            <button
              className="prj-btn prj-btn-primary"
              onClick={() => setShowMilestoneForm(!showMilestoneForm)}
            >
              {showMilestoneForm ? 'ביטול' : '+ הוספת אבן דרך'}
            </button>

            {showMilestoneForm && (
              <div className="prj-milestone-card" style={{ marginTop: '16px' }}>
                <h4 style={{ marginTop: 0, color: '#e2e8f0', fontSize: '16px', fontWeight: '600', marginBottom: '16px' }}>אבן דרך חדשה</h4>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', marginBottom: '12px' }}>
                  <input type="text" placeholder="שם אבן דרך" value={milestoneFormData.title}
                    onChange={(e) => setMilestoneFormData({ ...milestoneFormData, title: e.target.value })}
                    style={{
                      direction: 'rtl', fontSize: '14px', padding: '10px 12px', color: '#e2e8f0',
                      background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: '8px', outline: 'none',
                    }}
                  />
                  <input type="date" value={milestoneFormData.dueDate}
                    onChange={(e) => setMilestoneFormData({ ...milestoneFormData, dueDate: e.target.value })}
                    style={{
                      fontSize: '14px', padding: '10px 12px', color: '#e2e8f0',
                      background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: '8px', outline: 'none',
                    }}
                  />
                  <select value={milestoneFormData.assigneeId}
                    onChange={(e) => setMilestoneFormData({ ...milestoneFormData, assigneeId: e.target.value })}
                    style={{
                      fontSize: '14px', padding: '10px 12px', color: '#e2e8f0',
                      background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: '8px', outline: 'none', direction: 'rtl',
                    }}
                  >
                    <option value="">בחר עובד</option>
                    {employeesData.map((emp: Employee) => (
                      <option key={emp.id} value={emp.id}>{emp.name}</option>
                    ))}
                  </select>
                </div>
                <textarea placeholder="תיאור" value={milestoneFormData.description}
                  onChange={(e) => setMilestoneFormData({ ...milestoneFormData, description: e.target.value })}
                  style={{
                    direction: 'rtl', minHeight: '70px', marginBottom: '12px', fontFamily: 'inherit',
                    width: '100%', fontSize: '14px', padding: '10px 12px', color: '#e2e8f0',
                    background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '8px', outline: 'none', resize: 'vertical',
                  }}
                />
                <textarea placeholder="הערות" value={milestoneFormData.notes}
                  onChange={(e) => setMilestoneFormData({ ...milestoneFormData, notes: e.target.value })}
                  style={{
                    direction: 'rtl', minHeight: '50px', marginBottom: '16px', fontFamily: 'inherit',
                    width: '100%', fontSize: '14px', padding: '10px 12px', color: '#e2e8f0',
                    background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '8px', outline: 'none', resize: 'vertical',
                  }}
                />
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button className="prj-btn prj-btn-primary" onClick={handleAddMilestone} disabled={loading}>
                    {loading ? 'שומר...' : 'הוסף'}
                  </button>
                  <button className="prj-btn prj-btn-ghost" onClick={() => setShowMilestoneForm(false)} disabled={loading}>
                    ביטול
                  </button>
                </div>
              </div>
            )}
          </div>
          )}

          <div style={{ display: 'grid', gap: '16px' }}>
            {(projectMilestones?.length || 0) === 0 ? (
              <div className="prj-milestone-card" style={{ textAlign: 'center', padding: '40px' }}>
                <div style={{ fontSize: '32px', marginBottom: '12px', opacity: 0.3 }}>📋</div>
                <p style={{ color: '#64748b', margin: 0, fontSize: '14px' }}>
                  אין אבני דרך לפרויקט זה
                </p>
              </div>
            ) : (
              (projectMilestones || []).map((milestone: ProjectMilestone, idx: number) => {
                const assignee = (employeesData || []).find((e: Employee) => e?.id === milestone?.assignedEmployeeId);
                const isEditing = editingMilestoneId === milestone?.id;
                const milestoneFiles = getFilesForMilestone(milestone.id);
                const statusConfig: Record<string, { bg: string; color: string; border: string }> = {
                  pending: { bg: 'rgba(100,116,139,0.12)', color: '#94a3b8', border: 'rgba(100,116,139,0.2)' },
                  in_progress: { bg: 'rgba(245,158,11,0.12)', color: '#fbbf24', border: 'rgba(245,158,11,0.2)' },
                  submitted: { bg: 'rgba(139,92,246,0.12)', color: '#a78bfa', border: 'rgba(139,92,246,0.2)' },
                  approved: { bg: 'rgba(34,197,94,0.12)', color: '#4ade80', border: 'rgba(34,197,94,0.2)' },
                  returned: { bg: 'rgba(249,115,22,0.12)', color: '#fb923c', border: 'rgba(249,115,22,0.2)' },
                };
                const sc = statusConfig[milestone?.status || 'pending'] || statusConfig.pending;

                return (
                  <div
                    key={milestone.id}
                    className="prj-milestone-card"
                    style={{
                      animationDelay: `${idx * 0.05}s`,
                      borderRight: `3px solid ${sc.color}`,
                    }}
                  >
                    {isEditing ? (
                      <div>
                        <input type="text"
                          value={milestoneOverrides[milestone.id]?._editTitle !== undefined ? (milestoneOverrides[milestone.id]._editTitle as string) : milestone.title}
                          onChange={(e) => setMilestoneOverrides((prev) => ({
                            ...prev,
                            [milestone.id]: { ...(prev[milestone.id] || {}), _editTitle: e.target.value },
                          }))}
                          style={{
                            direction: 'rtl', marginBottom: '12px', width: '100%', fontSize: '14px',
                            padding: '10px 12px', color: '#e2e8f0',
                            background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                            borderRadius: '8px', outline: 'none',
                          }}
                          placeholder="שם אבן דרך"
                        />
                        <textarea
                          value={milestoneOverrides[milestone.id]?._editDescription !== undefined ? (milestoneOverrides[milestone.id]._editDescription as string) : (milestone.description || '')}
                          onChange={(e) => setMilestoneOverrides((prev) => ({
                            ...prev,
                            [milestone.id]: { ...(prev[milestone.id] || {}), _editDescription: e.target.value },
                          }))}
                          rows={3}
                          style={{
                            direction: 'rtl', marginBottom: '12px', width: '100%', fontSize: '13px',
                            padding: '10px 12px', color: '#e2e8f0', resize: 'vertical',
                            background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                            borderRadius: '8px', outline: 'none',
                          }}
                          placeholder="תיאור / פירוט אבן הדרך"
                        />
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button className="prj-btn prj-btn-primary" disabled={loading} onClick={async () => {
                            const overrides = milestoneOverrides[milestone.id] || {};
                            const newTitle = overrides._editTitle !== undefined ? (overrides._editTitle as string) : milestone.title;
                            const newDescription = overrides._editDescription !== undefined ? (overrides._editDescription as string) : (milestone.description || '');
                            setLoading(true);
                            try {
                              await updateMilestone(milestone.id, { title: newTitle, description: newDescription } as any);
                              // Clear edit overrides
                              setMilestoneOverrides((prev) => {
                                const next = { ...prev };
                                if (next[milestone.id]) {
                                  const { _editTitle: _a, _editDescription: _b, _editNotes: _c, ...rest } = next[milestone.id] as any;
                                  next[milestone.id] = rest;
                                }
                                return next;
                              });
                              setEditingMilestoneId(null);
                              refetchTimeline();
                            } catch (error) {
                              console.error('Error saving milestone edit:', error);
                            } finally {
                              setLoading(false);
                            }
                          }}>{loading ? '...' : 'שמור'}</button>
                          <button className="prj-btn prj-btn-ghost" onClick={() => {
                            // Clear edit overrides on cancel
                            setMilestoneOverrides((prev) => {
                              const next = { ...prev };
                              if (next[milestone.id]) {
                                const { _editTitle: _a, _editDescription: _b, _editNotes: _c, ...rest } = next[milestone.id] as any;
                                next[milestone.id] = rest;
                              }
                              return next;
                            });
                            setEditingMilestoneId(null);
                          }}>ביטול</button>
                        </div>
                      </div>
                    ) : (
                      <div>
                        {/* Title row */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '14px' }}>
                          <div style={{ flex: 1 }}>
                            <h4 style={{ fontSize: '16px', fontWeight: '600', color: '#e2e8f0', margin: '0' }}>
                              {milestone.title}
                            </h4>
                          </div>
                          <span className="prj-status-badge" style={{
                            background: sc.bg, color: sc.color, border: `1px solid ${sc.border}`,
                            marginRight: '12px',
                          }}>
                            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: sc.color }} />
                            {milestoneStatusLabels[milestone?.status || 'pending']}
                          </span>
                        </div>

                        {/* Info row */}
                        <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap', marginBottom: '14px' }}>
                          <div>
                            <span style={{ fontSize: '11px', color: '#475569', display: 'block', marginBottom: '2px' }}>תאריך הגשה</span>
                            <span style={{ fontSize: '13px', color: '#cbd5e1', fontWeight: '500' }}>
                              {formatDate(milestone?.dueDate || null)}
                            </span>
                          </div>
                          <div>
                            <span style={{ fontSize: '11px', color: '#475569', display: 'block', marginBottom: '2px' }}>מוקצה ל</span>
                            <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                              <select
                                value={
                                  pendingAssignee[milestone.id] !== undefined
                                    ? pendingAssignee[milestone.id]
                                    : (milestone as any)?.assigneeId || (milestone as any)?.assignedEmployeeId || ''
                                }
                                onChange={(e) => {
                                  setPendingAssignee((prev) => ({ ...prev, [milestone.id]: e.target.value }));
                                  setAssignFeedback((prev) => { const n = { ...prev }; delete n[milestone.id]; return n; });
                                }}
                                disabled={loading || assigningMilestone === milestone.id}
                                style={{
                                  fontSize: '13px', color: '#e2e8f0', direction: 'rtl',
                                  background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                                  borderRadius: '6px', padding: '4px 8px', outline: 'none',
                                }}
                              >
                                <option value="">לא הוצמד</option>
                                {(employeesData || []).map((emp: Employee) => (
                                  <option key={emp.id} value={emp.id}>{emp.name || (emp as any).email}</option>
                                ))}
                              </select>
                              <button
                                className="prj-btn prj-btn-primary"
                                onClick={() => handleAssignMilestoneEmployee(milestone)}
                                disabled={loading || assigningMilestone === milestone.id}
                                style={{ fontSize: '11px', padding: '4px 10px' }}
                              >
                                {assigningMilestone === milestone.id ? '...' : 'שייך'}
                              </button>
                            </div>
                            {assignFeedback[milestone.id] && (
                              <div style={{
                                fontSize: '11px', marginTop: '4px',
                                color: assignFeedback[milestone.id].type === 'success' ? '#4ade80' : '#f87171',
                              }}>
                                {assignFeedback[milestone.id].message}
                              </div>
                            )}
                          </div>
                          <div>
                            <span style={{ fontSize: '11px', color: '#475569', display: 'block', marginBottom: '2px' }}>קבצים</span>
                            <span style={{ fontSize: '13px', color: '#818cf8', fontWeight: '500' }}>
                              {milestoneFiles.length} קבצים
                            </span>
                          </div>
                        </div>

                        {/* Timestamps */}
                        {((milestone as any)?.startedAt || (milestone as any)?.submittedAt || (milestone as any)?.approvedAt) && (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', fontSize: '11px', color: '#475569', marginBottom: '14px' }}>
                            {(milestone as any)?.startedAt && (
                              <span>התחיל: <span style={{ color: '#94a3b8' }}>{formatDate((milestone as any).startedAt)}</span></span>
                            )}
                            {(milestone as any)?.submittedAt && (
                              <span>הוגש: <span style={{ color: '#94a3b8' }}>{formatDate((milestone as any).submittedAt)}</span></span>
                            )}
                            {(milestone as any)?.approvedAt && (
                              <span>אושר: <span style={{ color: '#94a3b8' }}>{formatDate((milestone as any).approvedAt)}</span></span>
                            )}
                          </div>
                        )}

                        {/* Inline editable notes/details */}
                        <div style={{
                          marginBottom: '14px', padding: '10px 14px',
                          background: 'rgba(255,255,255,0.03)', borderRadius: '8px',
                          border: '1px solid rgba(255,255,255,0.06)',
                        }}>
                          <span style={{ fontSize: '11px', color: '#475569', display: 'block', marginBottom: '6px', fontWeight: 600 }}>פרטים / הערות</span>
                          <textarea
                            value={milestoneNotesDraft[milestone.id] !== undefined ? milestoneNotesDraft[milestone.id] : (milestone.description || '')}
                            onChange={(e) => {
                              setMilestoneNotesDraft((prev) => ({ ...prev, [milestone.id]: e.target.value }));
                              setMilestoneNotesFeedback((prev) => { const n = { ...prev }; delete n[milestone.id]; return n; });
                            }}
                            rows={2}
                            style={{
                              direction: 'rtl', width: '100%', fontSize: '13px',
                              padding: '8px 10px', color: '#e2e8f0', resize: 'vertical',
                              background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)',
                              borderRadius: '6px', outline: 'none', lineHeight: '1.5',
                              fontFamily: 'inherit',
                            }}
                            placeholder="הוסף פרטים, הערות או תיאור לאבן הדרך..."
                          />
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '6px' }}>
                            <button
                              className="prj-btn prj-btn-primary"
                              disabled={savingMilestoneNotes === milestone.id || (milestoneNotesDraft[milestone.id] === undefined && !milestone.description) || milestoneNotesDraft[milestone.id] === (milestone.description || '')}
                              onClick={async () => {
                                const newDesc = milestoneNotesDraft[milestone.id] !== undefined ? milestoneNotesDraft[milestone.id] : (milestone.description || '');
                                setSavingMilestoneNotes(milestone.id);
                                setMilestoneNotesFeedback((prev) => { const n = { ...prev }; delete n[milestone.id]; return n; });
                                try {
                                  await updateMilestone(milestone.id, { description: newDesc } as any);
                                  setMilestoneNotesDraft((prev) => { const n = { ...prev }; delete n[milestone.id]; return n; });
                                  setMilestoneNotesFeedback((prev) => ({ ...prev, [milestone.id]: { type: 'success', message: 'נשמר בהצלחה' } }));
                                  refetchTimeline();
                                  setTimeout(() => setMilestoneNotesFeedback((prev) => { const n = { ...prev }; delete n[milestone.id]; return n; }), 2500);
                                } catch (err: any) {
                                  setMilestoneNotesFeedback((prev) => ({ ...prev, [milestone.id]: { type: 'error', message: err?.message || 'שגיאה בשמירה' } }));
                                } finally {
                                  setSavingMilestoneNotes(null);
                                }
                              }}
                              style={{ fontSize: '11px', padding: '4px 14px' }}
                            >
                              {savingMilestoneNotes === milestone.id ? '...' : 'שמור הערות'}
                            </button>
                            {milestoneNotesFeedback[milestone.id] && (
                              <span style={{
                                fontSize: '11px',
                                color: milestoneNotesFeedback[milestone.id].type === 'success' ? '#4ade80' : '#f87171',
                              }}>
                                {milestoneNotesFeedback[milestone.id].message}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* ── Files Section with previews ── */}
                        <div style={{ marginBottom: '14px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                            <span style={{ fontSize: '12px', fontWeight: '600', color: '#94a3b8' }}>קבצים מצורפים</span>
                            <input type="file"
                              ref={(el) => { fileInputRefs.current[milestone.id] = el; }}
                              style={{ display: 'none' }}
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) handleMilestoneFileUpload(milestone.id, file);
                              }}
                            />
                            <button
                              className="prj-btn prj-btn-primary"
                              onClick={() => fileInputRefs.current[milestone.id]?.click()}
                              disabled={uploadingMilestone === milestone.id}
                              style={{ fontSize: '11px', padding: '3px 10px' }}
                            >
                              {uploadingMilestone === milestone.id ? 'מעלה...' : 'העלאת קובץ'}
                            </button>
                          </div>
                          {milestoneFiles.length > 0 ? (
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                              {milestoneFiles.map((mf: MilestoneFile) => {
                                const isImage = /\.(png|jpg|jpeg|gif|webp|svg)$/i.test(mf.fileName);
                                return (
                                  <a
                                    key={mf.id}
                                    href={mf.fileUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="prj-file-chip"
                                    title={mf.fileName}
                                  >
                                    {isImage ? (
                                      <img
                                        src={mf.fileUrl}
                                        alt={mf.fileName}
                                        style={{
                                          width: '32px', height: '32px', objectFit: 'cover',
                                          borderRadius: '4px', flexShrink: 0,
                                        }}
                                      />
                                    ) : (
                                      <span style={{
                                        width: '32px', height: '32px', display: 'flex',
                                        alignItems: 'center', justifyContent: 'center',
                                        background: 'rgba(99,102,241,0.1)', borderRadius: '4px',
                                        fontSize: '14px', flexShrink: 0,
                                      }}>
                                        📄
                                      </span>
                                    )}
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                      <div style={{
                                        color: '#cbd5e1', fontSize: '12px', fontWeight: '500',
                                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                                      }}>
                                        {mf.fileName}
                                      </div>
                                      <div style={{ color: '#475569', fontSize: '10px' }}>
                                        {(mf.fileSize || 0) > 1024 * 1024
                                          ? `${((mf.fileSize || 0) / (1024 * 1024)).toFixed(1)} MB`
                                          : `${Math.round((mf.fileSize || 0) / 1024)} KB`}
                                      </div>
                                    </div>
                                    <button
                                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleDeleteMilestoneFile(mf.id); }}
                                      className="prj-btn prj-btn-danger"
                                      style={{
                                        fontSize: '10px', padding: '2px 6px', borderRadius: '4px',
                                        flexShrink: 0, minWidth: 'auto',
                                      }}
                                    >
                                      ✕
                                    </button>
                                  </a>
                                );
                              })}
                            </div>
                          ) : (
                            <span style={{ fontSize: '12px', color: '#475569' }}>אין קבצים מצורפים</span>
                          )}
                        </div>

                        {/* Quick actions */}
                        {canEdit && (
                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', paddingTop: '12px', borderTop: '1px solid rgba(255,255,255,0.04)' }}>
                          {milestone?.status === 'pending' && (
                            <button className="prj-btn prj-btn-primary" style={{ fontSize: '12px', padding: '6px 14px' }}
                              onClick={() => handleUpdateMilestone(milestone?.id || '', { status: 'in_progress' })} disabled={loading}>
                              התחל
                            </button>
                          )}
                          {milestone?.status === 'in_progress' && (
                            <button className="prj-btn prj-btn-primary" style={{ fontSize: '12px', padding: '6px 14px' }}
                              onClick={() => handleUpdateMilestone(milestone?.id || '', { status: 'submitted' })} disabled={loading}>
                              הגש
                            </button>
                          )}
                          {milestone?.status === 'submitted' && (
                            <>
                              <button className="prj-btn prj-btn-success" style={{ fontSize: '12px', padding: '6px 14px' }}
                                onClick={() => handleUpdateMilestone(milestone?.id || '', { status: 'approved' })} disabled={loading}>
                                אשר
                              </button>
                              <button className="prj-btn prj-btn-ghost" style={{ fontSize: '12px', padding: '6px 14px' }}
                                onClick={() => handleUpdateMilestone(milestone?.id || '', { status: 'returned' })} disabled={loading}>
                                החזר
                              </button>
                            </>
                          )}
                          {canEdit && (
                          <button className="prj-btn prj-btn-ghost" style={{ fontSize: '12px', padding: '6px 14px' }}
                            onClick={() => setEditingMilestoneId(milestone?.id || null)} disabled={loading}>
                            עריכה
                          </button>
                          )}
                        </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* ══════════ FILES TAB ══════════ */}
      {activeTab === 'files' && (
        <div>
          {canEdit && (
          <div style={{ marginBottom: '24px' }}>
            <button className="prj-btn prj-btn-primary" onClick={() => setShowFileForm(!showFileForm)}>
              {showFileForm ? 'ביטול' : '+ הוספת קובץ'}
            </button>

            {showFileForm && (
              <div className="prj-card" style={{ marginTop: '16px' }}>
                <div style={{ marginBottom: '16px' }}>
                  <span style={{ fontSize: '12px', color: '#64748b', display: 'block', marginBottom: '4px' }}>קטגוריה</span>
                  <select value={fileFormData.category}
                    onChange={(e) => setFileFormData({ ...fileFormData, category: e.target.value as FileCategory })}
                    style={{
                      maxWidth: '200px', fontSize: '13px', color: '#e2e8f0', direction: 'rtl',
                      background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: '8px', padding: '8px 10px', outline: 'none',
                    }}
                  >
                    <option value="general">כללי</option>
                    <option value="agreements">הסכמים</option>
                    <option value="branding">ברנדינג</option>
                    <option value="website">אתר</option>
                  </select>
                </div>
                <div style={{
                  padding: '16px', background: 'rgba(255,255,255,0.02)',
                  border: '1px solid rgba(255,255,255,0.06)', borderRadius: '10px', marginBottom: '12px',
                }}>
                  <h4 style={{ marginTop: 0, fontSize: '14px', color: '#e2e8f0' }}>העלאה מהמחשב</h4>
                  <p style={{ fontSize: '11px', color: '#475569', margin: '0 0 10px 0' }}>PDF, תמונות — עד 10 MB</p>
                  <input type="file" ref={projectFileInputRef} accept=".pdf,.png,.jpg,.jpeg,.gif,.webp"
                    style={{ display: 'none' }}
                    onChange={(e) => { const file = e.target.files?.[0]; if (file) handleProjectFileUpload(file); }}
                  />
                  <button className="prj-btn prj-btn-primary"
                    onClick={() => projectFileInputRef.current?.click()} disabled={uploadingProjectFile}>
                    {uploadingProjectFile ? 'מעלה...' : 'העלה קובץ'}
                  </button>
                  {projectFileError && (
                    <div style={{ marginTop: '8px', fontSize: '12px', color: '#f87171' }}>{projectFileError}</div>
                  )}
                </div>
                <div style={{
                  padding: '16px', background: 'rgba(255,255,255,0.02)',
                  border: '1px solid rgba(255,255,255,0.06)', borderRadius: '10px',
                }}>
                  <h4 style={{ marginTop: 0, fontSize: '14px', color: '#e2e8f0' }}>או הוספה מקישור</h4>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <input type="url" placeholder="כתובת URL של הקובץ" value={fileFormData.url}
                      onChange={(e) => setFileFormData({ ...fileFormData, url: e.target.value })}
                      style={{
                        direction: 'rtl', flex: 1, fontSize: '13px', padding: '10px 12px', color: '#e2e8f0',
                        background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                        borderRadius: '8px', outline: 'none',
                      }}
                    />
                    <button className="prj-btn prj-btn-primary" onClick={handleAddFile} disabled={loading}>
                      {loading ? '...' : 'הוסף'}
                    </button>
                  </div>
                </div>
                <div style={{ marginTop: '12px' }}>
                  <button className="prj-btn prj-btn-ghost"
                    onClick={() => { setShowFileForm(false); setProjectFileError(null); }}
                    disabled={loading || uploadingProjectFile}>
                    ביטול
                  </button>
                </div>
              </div>
            )}
          </div>
          )}

          {/* ── Milestone files section ── */}
          {(() => {
            const allMilestoneFiles = (milestoneFilesData || []).filter((mf: MilestoneFile) => {
              const parentMilestone = (projectMilestones || []).find((m: any) => m.id === mf.milestoneId);
              return !!parentMilestone;
            });
            if (allMilestoneFiles.length > 0) {
              return (
                <div style={{ marginBottom: '24px' }}>
                  <h3 style={{ fontSize: '14px', fontWeight: '600', color: '#94a3b8', marginBottom: '12px' }}>קבצי אבני דרך</h3>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '16px' }}>
                    {allMilestoneFiles.map((mf: MilestoneFile) => {
                      const parentMilestone = (projectMilestones || []).find((m: any) => m.id === mf.milestoneId);
                      const isImage = /\.(png|jpg|jpeg|gif|webp|svg)$/i.test(mf.fileName || '');
                      const uploadDate = mf.createdAt ? new Date(mf.createdAt) : null;
                      return (
                        <a key={mf.id} href={mf.fileUrl} target="_blank" rel="noopener noreferrer"
                          className="prj-card"
                          style={{ textDecoration: 'none', color: 'inherit', display: 'flex', flexDirection: 'column', cursor: 'pointer' }}
                        >
                          {isImage && mf.fileUrl ? (
                            <div style={{
                              width: '100%', height: '100px', borderRadius: '8px', marginBottom: '10px',
                              overflow: 'hidden', background: 'rgba(255,255,255,0.03)',
                            }}>
                              <img src={mf.fileUrl} alt={mf.fileName}
                                style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            </div>
                          ) : (
                            <div style={{
                              width: '48px', height: '48px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                              background: 'rgba(99,102,241,0.1)', borderRadius: '10px', fontSize: '20px', marginBottom: '10px',
                            }}>
                              📄
                            </div>
                          )}
                          <h4 style={{
                            fontSize: '13px', fontWeight: '600', color: '#e2e8f0', margin: '0 0 6px 0',
                            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                          }}>
                            {mf.fileName || 'קובץ'}
                          </h4>
                          <span style={{
                            display: 'inline-block', fontSize: '10px', padding: '2px 8px',
                            background: 'rgba(245,158,11,0.1)', color: '#fbbf24', borderRadius: '4px', marginBottom: '6px',
                            alignSelf: 'flex-start',
                          }}>
                            {(parentMilestone as any)?.title || 'אבן דרך'}
                          </span>
                          <div style={{ fontSize: '11px', color: '#475569', marginTop: 'auto' }}>
                            {uploadDate?.toLocaleDateString('he-IL') || '-'}
                          </div>
                        </a>
                      );
                    })}
                  </div>
                </div>
              );
            }
            return null;
          })()}

          {/* ── Client / project files section ── */}
          <div>
            {(projectClientFiles?.length || 0) > 0 && (
              <h3 style={{ fontSize: '14px', fontWeight: '600', color: '#94a3b8', marginBottom: '12px' }}>קבצי פרויקט</h3>
            )}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '16px' }}>
              {(projectClientFiles?.length || 0) === 0 && (milestoneFilesData || []).filter((mf: MilestoneFile) => (projectMilestones || []).some((m: any) => m.id === mf.milestoneId)).length === 0 ? (
                <div className="prj-card" style={{ textAlign: 'center', padding: '40px' }}>
                  <div style={{ fontSize: '32px', marginBottom: '12px', opacity: 0.3 }}>📁</div>
                  <p style={{ color: '#64748b', margin: 0 }}>אין קבצים</p>
                </div>
              ) : (
                (projectClientFiles || []).map((file) => {
                  const uploadDate = file?.createdAt ? new Date(file.createdAt) : null;
                  const categoryLabels: Record<string, string> = { general: 'כללי', agreements: 'הסכמים', branding: 'ברנדינג', website: 'אתר' };
                  const isImage = /\.(png|jpg|jpeg|gif|webp|svg)$/i.test(file?.fileName || '');

                  return (
                    <a key={file?.id || ''} href={file?.fileUrl || '#'} target="_blank" rel="noopener noreferrer"
                      className="prj-card"
                      style={{ textDecoration: 'none', color: 'inherit', display: 'flex', flexDirection: 'column', cursor: 'pointer' }}
                    >
                      {isImage && file?.fileUrl ? (
                        <div style={{
                          width: '100%', height: '100px', borderRadius: '8px', marginBottom: '10px',
                          overflow: 'hidden', background: 'rgba(255,255,255,0.03)',
                        }}>
                          <img src={file.fileUrl} alt={file.fileName}
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        </div>
                      ) : (
                        <div style={{
                          width: '48px', height: '48px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                          background: 'rgba(99,102,241,0.1)', borderRadius: '10px', fontSize: '20px', marginBottom: '10px',
                        }}>
                          📄
                        </div>
                      )}
                      <h4 style={{
                        fontSize: '13px', fontWeight: '600', color: '#e2e8f0', margin: '0 0 6px 0',
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>
                        {file?.fileName || 'קובץ'}
                      </h4>
                      <span style={{
                        display: 'inline-block', fontSize: '10px', padding: '2px 8px',
                        background: 'rgba(99,102,241,0.1)', color: '#818cf8', borderRadius: '4px', marginBottom: '6px',
                        alignSelf: 'flex-start',
                      }}>
                        {categoryLabels[file.category] || file.category}
                      </span>
                      <div style={{ fontSize: '11px', color: '#475569', marginTop: 'auto' }}>
                        {uploadDate?.toLocaleDateString('he-IL') || '-'}
                      </div>
                    </a>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* ══════════ PAYMENTS TAB ══════════ */}
      {activeTab === 'payments' && (
        <div>
          {/* Summary cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px', marginBottom: '24px' }}>
            {(project?.budget > 0) && (
              <div className="prj-card">
                <h4 style={{ fontSize: '11px', color: '#64748b', margin: '0 0 8px 0', textTransform: 'uppercase', letterSpacing: '0.5px' }}>מחיר פרויקט</h4>
                <div style={{ fontSize: '24px', fontWeight: '700', color: '#818cf8' }}>₪{(project!.budget).toLocaleString('he-IL')}</div>
              </div>
            )}
            <div className="prj-card">
              <h4 style={{ fontSize: '11px', color: '#64748b', margin: '0 0 8px 0', textTransform: 'uppercase', letterSpacing: '0.5px' }}>תשלומים מתוכננים</h4>
              <div style={{ fontSize: '24px', fontWeight: '700', color: '#e2e8f0' }}>₪{scheduledAmount.toLocaleString('he-IL')}</div>
            </div>
            <div className="prj-card">
              <h4 style={{ fontSize: '11px', color: '#64748b', margin: '0 0 8px 0', textTransform: 'uppercase', letterSpacing: '0.5px' }}>שולם</h4>
              <div style={{ fontSize: '24px', fontWeight: '700', color: '#4ade80' }}>₪{paidAmount.toLocaleString('he-IL')}</div>
            </div>
            <div className="prj-card">
              <h4 style={{ fontSize: '11px', color: '#64748b', margin: '0 0 8px 0', textTransform: 'uppercase', letterSpacing: '0.5px' }}>נותר לגביה</h4>
              <div style={{ fontSize: '24px', fontWeight: '700', color: '#fbbf24' }}>₪{remainingToCollect.toLocaleString('he-IL')}</div>
            </div>
          </div>

          <div style={{ marginBottom: '16px' }}>
            {!showPaymentForm ? (
              <button className="prj-btn prj-btn-primary" onClick={() => setShowPaymentForm(true)}>
                + הוסף תשלום
              </button>
            ) : (
              <div className="prj-card" style={{ marginBottom: '16px' }}>
                <h4 style={{ fontSize: '16px', fontWeight: '600', color: '#e2e8f0', margin: '0 0 16px 0' }}>תשלום חדש</h4>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                  <div>
                    <label style={{ fontSize: '12px', color: '#64748b', display: 'block', marginBottom: '4px' }}>כותרת *</label>
                    <input type="text" value={paymentFormData.title}
                      onChange={(e) => setPaymentFormData((f) => ({ ...f, title: e.target.value }))}
                      placeholder="למשל: תשלום ראשון"
                      style={{
                        width: '100%', fontSize: '13px', padding: '10px 12px', color: '#e2e8f0', direction: 'rtl',
                        background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                        borderRadius: '8px', outline: 'none',
                      }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '12px', color: '#64748b', display: 'block', marginBottom: '4px' }}>סכום (₪) *</label>
                    <input type="number" value={paymentFormData.amount}
                      onChange={(e) => setPaymentFormData((f) => ({ ...f, amount: e.target.value }))}
                      placeholder="0"
                      style={{
                        width: '100%', fontSize: '13px', padding: '10px 12px', color: '#e2e8f0', direction: 'ltr',
                        background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                        borderRadius: '8px', outline: 'none',
                      }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '12px', color: '#64748b', display: 'block', marginBottom: '4px' }}>תאריך יעד</label>
                    <input type="date" value={paymentFormData.dueDate}
                      onChange={(e) => setPaymentFormData((f) => ({ ...f, dueDate: e.target.value }))}
                      style={{
                        width: '100%', fontSize: '13px', padding: '10px 12px', color: '#e2e8f0',
                        background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                        borderRadius: '8px', outline: 'none',
                      }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '12px', color: '#64748b', display: 'block', marginBottom: '4px' }}>אבן דרך מקושרת</label>
                    <select value={paymentFormData.milestoneId}
                      onChange={(e) => setPaymentFormData((f) => ({ ...f, milestoneId: e.target.value }))}
                      style={{
                        width: '100%', fontSize: '13px', padding: '10px 12px', color: '#e2e8f0', direction: 'rtl',
                        background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                        borderRadius: '8px', outline: 'none',
                      }}
                    >
                      <option value="">ללא</option>
                      {(projectMilestones || []).map((m: any) => (
                        <option key={m.id} value={m.id}>{m.title}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div style={{ marginBottom: '12px' }}>
                  <label style={{ fontSize: '12px', color: '#64748b', display: 'block', marginBottom: '4px' }}>תיאור</label>
                  <textarea value={paymentFormData.description}
                    onChange={(e) => setPaymentFormData((f) => ({ ...f, description: e.target.value }))}
                    rows={2} placeholder="הערות לגבי התשלום..."
                    style={{
                      width: '100%', fontSize: '13px', padding: '10px 12px', color: '#e2e8f0', direction: 'rtl', resize: 'vertical',
                      background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: '8px', outline: 'none',
                    }}
                  />
                </div>
                {paymentError && (
                  <div style={{ color: '#f87171', fontSize: '12px', marginBottom: '8px', padding: '6px 10px', background: 'rgba(248,113,113,0.1)', borderRadius: '6px' }}>
                    {paymentError}
                  </div>
                )}
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button className="prj-btn prj-btn-primary" onClick={handleAddPayment}
                    disabled={savingPayment || !paymentFormData.title || !paymentFormData.amount}>
                    {savingPayment ? 'שומר...' : 'שמור תשלום'}
                  </button>
                  <button className="prj-btn prj-btn-ghost"
                    onClick={() => { setShowPaymentForm(false); setPaymentFormData({ title: '', amount: '', dueDate: '', description: '', milestoneId: '' }); setPaymentError(null); }}>
                    ביטול
                  </button>
                </div>
              </div>
            )}
          </div>

          <div style={{ display: 'grid', gap: '12px' }}>
            {(projectPayments?.length || 0) === 0 ? (
              <div className="prj-card" style={{ textAlign: 'center', padding: '40px' }}>
                <div style={{ fontSize: '32px', marginBottom: '12px', opacity: 0.3 }}>💰</div>
                <p style={{ color: '#64748b', margin: 0 }}>אין תשלומים לפרויקט זה</p>
              </div>
            ) : (
              (projectPayments || []).map((payment) => {
                const statusColor =
                  payment?.status === 'paid' ? '#4ade80'
                  : payment?.status === 'overdue' ? '#f87171'
                  : payment?.status === 'collection_needed' ? '#fb923c'
                  : '#fbbf24';
                const linkedMilestone = payment?.milestoneId
                  ? (projectMilestones || []).find((m: any) => m.id === payment.milestoneId)
                  : null;

                return (
                  <div key={payment?.id || ''} className="prj-card"
                    style={{
                      display: 'grid', gridTemplateColumns: 'auto 1fr auto auto auto',
                      alignItems: 'center', gap: '16px',
                    }}
                  >
                    <div style={{ width: '3px', height: '40px', background: statusColor, borderRadius: '2px' }} />
                    <div>
                      <div style={{ fontSize: '14px', fontWeight: '600', color: '#e2e8f0', marginBottom: '4px' }}>
                        {payment?.title || payment?.description || 'תשלום'}
                      </div>
                      <div style={{ fontSize: '12px', color: '#64748b' }}>
                        לתאריך: {formatDate(payment?.dueDate || null)}
                        {linkedMilestone && (
                          <span style={{ marginRight: '8px' }}>| אבן דרך: {(linkedMilestone as any).title}</span>
                        )}
                      </div>
                    </div>
                    <div style={{ textAlign: 'left' }}>
                      <div style={{ fontSize: '18px', fontWeight: '700', color: '#e2e8f0' }}>
                        ₪{(payment?.amount || 0).toLocaleString('he-IL')}
                      </div>
                    </div>
                    <span className="prj-status-badge" style={{
                      background: `${statusColor}20`, color: statusColor,
                      border: `1px solid ${statusColor}30`,
                    }}>
                      {paymentStatusLabels[(payment?.status as ProjectPaymentStatus) || 'pending'] || payment?.status}
                    </span>
                    <div>
                      {payment?.status !== 'paid' && (
                        <button className="prj-btn prj-btn-success" style={{ fontSize: '12px', padding: '6px 14px' }}
                          onClick={() => handleUpdatePaymentStatus(payment?.id || '', 'paid')} disabled={loading}>
                          סימון כשולם
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* ══════════ ACTIVITY TAB ══════════ */}
      {activeTab === 'activity' && (
        <div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {/* Project creation event */}
            <div className="prj-timeline-item">
              <div style={{
                width: '36px', height: '36px', borderRadius: '10px',
                background: 'rgba(99,102,241,0.12)', display: 'flex',
                alignItems: 'center', justifyContent: 'center', fontSize: '16px', flexShrink: 0,
              }}>
                ⭐
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '14px', fontWeight: '600', color: '#e2e8f0', marginBottom: '4px' }}>
                  פרויקט נוצר
                </div>
                <div style={{ fontSize: '12px', color: '#475569' }}>
                  {new Date(project.createdAt).toLocaleDateString('he-IL', {
                    year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit',
                  })}
                </div>
              </div>
            </div>

            {projectTimeline.length === 0 && (
              <div style={{ textAlign: 'center', padding: '32px', color: '#475569', fontSize: '14px' }}>
                אין אירועי ציר זמן נוספים עדיין. אירועים ייווצרו אוטומטית כאשר תבוצע פעולה על אבני דרך.
              </div>
            )}

            {projectTimeline.map((event: ProjectTimelineEvent, idx: number) => {
              const iconMap: Record<string, { icon: string; bg: string }> = {
                milestone_created: { icon: '📌', bg: 'rgba(99,102,241,0.12)' },
                milestone_status_changed: { icon: '🔄', bg: 'rgba(245,158,11,0.12)' },
                milestone_assigned: { icon: '👤', bg: 'rgba(139,92,246,0.12)' },
                milestone_completed: { icon: '✅', bg: 'rgba(34,197,94,0.12)' },
                file_uploaded: { icon: '📎', bg: 'rgba(59,130,246,0.12)' },
                payment_created: { icon: '💰', bg: 'rgba(245,158,11,0.12)' },
                project_created: { icon: '⭐', bg: 'rgba(99,102,241,0.12)' },
                project_edited: { icon: '✏️', bg: 'rgba(100,116,139,0.12)' },
              };
              const { icon, bg } = iconMap[event.actionType] || { icon: '📋', bg: 'rgba(100,116,139,0.12)' };

              return (
                <div key={event.id} className="prj-timeline-item"
                  style={{ animationDelay: `${idx * 0.04}s` }}
                >
                  <div style={{
                    width: '36px', height: '36px', borderRadius: '10px',
                    background: bg, display: 'flex',
                    alignItems: 'center', justifyContent: 'center', fontSize: '16px', flexShrink: 0,
                  }}>
                    {icon}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '14px', fontWeight: '500', color: '#cbd5e1', marginBottom: '4px' }}>
                      {event.description}
                    </div>
                    <div style={{ fontSize: '12px', color: '#475569' }}>
                      {new Date(event.createdAt).toLocaleDateString('he-IL', {
                        year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit',
                      })}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
