'use client';

import { useState, useMemo, useCallback, useRef } from 'react';
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
} from '@/lib/api/use-entity';
import { BusinessProject, ProjectMilestone, ProjectPayment, Client, Employee, ClientFile, MilestoneFile } from '@/lib/db/schema';

type Tab = 'overview' | 'milestones' | 'files' | 'payments' | 'activity';
type MilestoneStatus = 'pending' | 'in_progress' | 'submitted' | 'approved' | 'returned';
type ProjectPaymentStatus = 'pending' | 'collection_needed' | 'paid';
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
};

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
  waiting_for_client: 'בהמתנה ללקוח',
  completed: 'הושלם',
};

const projectStatusColors: Record<string, string> = {
  not_started: '#6b7280',
  in_progress: '#f59e0b',
  waiting_for_client: '#8b5cf6',
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

  const { data: projectsData = [], loading: projectsLoading, update: updateProject } = useBusinessProjects();
  const { data: milestonesData = [], create: createMilestone, update: updateMilestone } = useProjectMilestones();
  const { data: paymentsData = [], update: updatePayment } = useProjectPayments();
  const { data: clientsData = [] } = useClients();
  const { data: employeesData = [] } = useEmployees();
  const { data: clientFilesData = [], create: createClientFile } = useClientFiles();
  const { data: tasksData = [], create: createTask, update: updateTask } = useTasks();
  const { data: milestoneFilesData = [], refetch: refetchMilestoneFiles, remove: deleteMilestoneFile } = useMilestoneFiles();

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
    setUploadingMilestone(milestoneId);
    try {
      const form = new FormData();
      form.append('file', file);
      form.append('milestoneId', milestoneId);
      const res = await fetch('/api/data/milestone-files', { method: 'POST', body: form });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error || `Upload failed (${res.status})`);
      }
      console.log(`[milestone-files] ✅ uploaded to milestone=${milestoneId}`);
      await refetchMilestoneFiles();
    } catch (err: any) {
      console.error('[milestone-files] upload error:', err);
      alert(`שגיאה בהעלאת קובץ: ${err?.message || 'unknown'}`);
    } finally {
      setUploadingMilestone(null);
      const input = fileInputRefs.current[milestoneId];
      if (input) input.value = '';
    }
  }, [refetchMilestoneFiles]);

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

  const totalAmount = (projectPayments || []).reduce((sum: number, p: ProjectPayment) => sum + (p?.amount || 0), 0);

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
    } catch (error) {
      console.error('Error updating payment:', error);
    } finally {
      setLoading(false);
    }
  };

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
    await handleUpdateProjectStatus('completed');
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
    } catch (error) {
      console.error('[project-edit] contract toggle failed:', error);
    }
  };

  const startDate = project?.startDate ? new Date(project.startDate) : null;
  const endDate = project?.endDate ? new Date(project.endDate) : null;

  return (
    <div
      style={{
        direction: 'rtl',
        padding: '24px',
        maxWidth: '1400px',
        margin: '0 auto',
        fontFamily: 'system-ui, -apple-system, sans-serif',
      }}
    >
      {/* Header */}
      <div
        style={{
          marginBottom: '32px',
          background: 'var(--surface-raised)',
          border: `1px solid var(--border)`,
          borderRadius: '8px',
          padding: '24px',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
          <div style={{ flex: 1 }}>
            {isEditingProject ? (
              <input
                type="text"
                value={(editForm.projectName as string) || ''}
                onChange={(e) => setEditForm((f) => ({ ...f, projectName: e.target.value }))}
                style={{
                  fontSize: '28px', fontWeight: '700', color: 'var(--foreground)',
                  background: 'var(--surface)', border: '1px solid var(--border)',
                  borderRadius: '6px', padding: '4px 8px', width: '100%',
                  marginBottom: '8px', direction: 'rtl',
                }}
                placeholder="שם הפרויקט"
              />
            ) : (
              <h1 style={{ fontSize: '32px', fontWeight: '700', color: 'var(--foreground)', margin: '0 0 8px 0' }}>
                {project.projectName}
              </h1>
            )}
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '12px' }}>
              {projectClient && (
                <a href={`/clients/${projectClient.id}`} style={{ color: 'var(--accent)', textDecoration: 'none', fontSize: '14px', fontWeight: '600' }}>
                  {projectClient.name}
                </a>
              )}
            </div>
          </div>

          <div style={{ display: 'flex', gap: '8px', flexDirection: 'column', alignItems: 'flex-start' }}>
            {isEditingProject ? (
              <>
                <button
                  onClick={handleSaveProject}
                  disabled={savingProject}
                  style={{
                    width: '100%', minWidth: '140px', padding: '8px 16px',
                    borderRadius: '6px', border: '1px solid var(--accent)',
                    background: 'var(--accent)', color: '#fff', cursor: savingProject ? 'wait' : 'pointer',
                    fontSize: '14px', fontWeight: '600',
                  }}
                >
                  {savingProject ? '...' : 'שמור שינויים'}
                </button>
                <button
                  onClick={handleCancelEditProject}
                  disabled={savingProject}
                  style={{
                    width: '100%', minWidth: '140px', padding: '8px 16px',
                    borderRadius: '6px', border: '1px solid var(--border)',
                    background: 'var(--surface)', color: 'var(--foreground)', cursor: 'pointer',
                    fontSize: '14px',
                  }}
                >
                  ביטול
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={handleStartEditProject}
                  style={{
                    width: '100%', minWidth: '140px', padding: '8px 16px',
                    borderRadius: '6px', border: '1px solid var(--border)',
                    background: 'var(--surface)', color: 'var(--foreground)', cursor: 'pointer',
                    fontSize: '14px',
                  }}
                >
                  עריכת פרויקט
                </button>
                <button
                  className="mod-btn-primary"
                  style={{ width: '100%', minWidth: '140px' }}
                  onClick={handleMarkComplete}
                  disabled={loading}
                >
                  סימון כהושלם
                </button>
              </>
            )}
          </div>
        </div>

        {/* Description — edit mode */}
        {isEditingProject && (
          <div style={{ marginBottom: '16px' }}>
            <span style={{ fontSize: '12px', color: 'var(--foreground-muted)', display: 'block', marginBottom: '4px' }}>
              תיאור
            </span>
            <textarea
              value={(editForm.description as string) || ''}
              onChange={(e) => setEditForm((f) => ({ ...f, description: e.target.value }))}
              rows={3}
              style={{
                width: '100%', fontSize: '14px', color: 'var(--foreground)',
                background: 'var(--surface)', border: '1px solid var(--border)',
                borderRadius: '6px', padding: '8px', direction: 'rtl', resize: 'vertical',
              }}
              placeholder="תיאור הפרויקט"
            />
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '12px' }}>
          {/* Service Type */}
          <div>
            <span style={{ fontSize: '12px', color: 'var(--foreground-muted)', display: 'block', marginBottom: '4px' }}>
              סוג
            </span>
            {isEditingProject ? (
              <select
                value={(editForm.serviceType as string) || ''}
                onChange={(e) => setEditForm((f) => ({ ...f, serviceType: e.target.value }))}
                style={{
                  fontSize: '13px', color: 'var(--foreground)', background: 'var(--surface)',
                  border: '1px solid var(--border)', borderRadius: '4px', padding: '4px 8px',
                  width: '100%', direction: 'rtl',
                }}
              >
                <option value="">בחר סוג</option>
                {Object.entries(projectTypeLabels).map(([val, label]) => (
                  <option key={val} value={val}>{label}</option>
                ))}
              </select>
            ) : (
              <div style={{
                display: 'inline-block', padding: '4px 12px', background: 'var(--accent-muted)',
                color: 'var(--accent)', borderRadius: '6px', fontSize: '12px', fontWeight: '600',
              }}>
                {getProjectTypeLabel(project?.projectType)}
              </div>
            )}
          </div>

          {/* Status */}
          <div>
            <span style={{ fontSize: '12px', color: 'var(--foreground-muted)', display: 'block', marginBottom: '4px' }}>
              סטטוס
            </span>
            {isEditingProject ? (
              <select
                value={(editForm.projectStatus as string) || 'not_started'}
                onChange={(e) => setEditForm((f) => ({ ...f, projectStatus: e.target.value }))}
                style={{
                  fontSize: '13px', color: 'var(--foreground)', background: 'var(--surface)',
                  border: '1px solid var(--border)', borderRadius: '4px', padding: '4px 8px',
                  width: '100%', direction: 'rtl',
                }}
              >
                <option value="not_started">לא התחיל</option>
                <option value="in_progress">בתהליך</option>
                <option value="waiting_for_client">בהמתנה ללקוח</option>
                <option value="completed">הושלם</option>
              </select>
            ) : (
              <div style={{
                display: 'inline-block', padding: '4px 12px',
                background: getProjectStatusColor(project?.projectStatus),
                color: '#fff', borderRadius: '6px', fontSize: '12px', fontWeight: '600',
              }}>
                {getProjectStatusLabel(project?.projectStatus)}
              </div>
            )}
          </div>

          {/* Contract Signed */}
          <div>
            <span style={{ fontSize: '12px', color: 'var(--foreground-muted)', display: 'block', marginBottom: '4px' }}>
              חוזה חתום
            </span>
            {isEditingProject ? (
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={!!editForm.contractSigned}
                  onChange={(e) => setEditForm((f) => ({ ...f, contractSigned: e.target.checked }))}
                  style={{ width: '16px', height: '16px', accentColor: 'var(--accent)' }}
                />
                <span style={{ fontSize: '13px', color: 'var(--foreground)' }}>
                  {editForm.contractSigned ? 'חתום' : 'לא חתום'}
                </span>
              </label>
            ) : (
              <button
                onClick={handleToggleContractSigned}
                disabled={loading}
                title={(project as any)?.contractSignedAt ? `חתום ב-${formatDate((project as any).contractSignedAt)}` : 'לחץ לשינוי'}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: '4px',
                  padding: '4px 12px', borderRadius: '6px', fontSize: '12px', fontWeight: '600',
                  cursor: 'pointer', border: '1px solid var(--border)',
                  background: (project as any)?.contractSigned ? '#dcfce7' : '#fef2f2',
                  color: (project as any)?.contractSigned ? '#16a34a' : '#dc2626',
                }}
              >
                {(project as any)?.contractSigned ? '✓ חתום' : '✗ לא חתום'}
              </button>
            )}
          </div>

          {/* Assigned Manager */}
          <div>
            <span style={{ fontSize: '12px', color: 'var(--foreground-muted)', display: 'block', marginBottom: '4px' }}>
              מנהל
            </span>
            {isEditingProject ? (
              <select
                value={(editForm.assignedManagerId as string) || ''}
                onChange={(e) => setEditForm((f) => ({ ...f, assignedManagerId: e.target.value }))}
                style={{
                  fontSize: '13px', color: 'var(--foreground)', background: 'var(--surface)',
                  border: '1px solid var(--border)', borderRadius: '4px', padding: '4px 8px',
                  width: '100%', direction: 'rtl',
                }}
              >
                <option value="">לא הוצמד</option>
                {(employeesData || []).map((emp: Employee) => (
                  <option key={emp.id} value={emp.id}>{emp.name || (emp as any).email}</option>
                ))}
              </select>
            ) : (
              <span style={{ fontSize: '14px', color: 'var(--foreground)', fontWeight: '500' }}>
                {assignedManager?.name || 'לא הוצמד'}
              </span>
            )}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '12px', marginTop: '16px' }}>
          {/* Start Date */}
          <div>
            <span style={{ fontSize: '12px', color: 'var(--foreground-muted)', display: 'block', marginBottom: '4px' }}>
              תאריך התחלה
            </span>
            {isEditingProject ? (
              <input
                type="date"
                value={(editForm.startDate as string) || ''}
                onChange={(e) => setEditForm((f) => ({ ...f, startDate: e.target.value }))}
                style={{
                  fontSize: '13px', color: 'var(--foreground)', background: 'var(--surface)',
                  border: '1px solid var(--border)', borderRadius: '4px', padding: '4px 8px', width: '100%',
                }}
              />
            ) : (
              <span style={{ fontSize: '14px', color: 'var(--foreground)' }}>
                {formatDate(project?.startDate || null)}
              </span>
            )}
          </div>

          {/* End Date */}
          <div>
            <span style={{ fontSize: '12px', color: 'var(--foreground-muted)', display: 'block', marginBottom: '4px' }}>
              תאריך סיום
            </span>
            {isEditingProject ? (
              <input
                type="date"
                value={(editForm.endDate as string) || ''}
                onChange={(e) => setEditForm((f) => ({ ...f, endDate: e.target.value }))}
                style={{
                  fontSize: '13px', color: 'var(--foreground)', background: 'var(--surface)',
                  border: '1px solid var(--border)', borderRadius: '4px', padding: '4px 8px', width: '100%',
                }}
              />
            ) : (
              <span style={{ fontSize: '14px', color: 'var(--foreground)' }}>
                {formatDate(project?.endDate || null)}
              </span>
            )}
          </div>

          {/* Contract Signed At (read-only, shown when signed) */}
          {!isEditingProject && (project as any)?.contractSigned && (project as any)?.contractSignedAt && (
            <div>
              <span style={{ fontSize: '12px', color: 'var(--foreground-muted)', display: 'block', marginBottom: '4px' }}>
                תאריך חתימה
              </span>
              <span style={{ fontSize: '14px', color: 'var(--foreground)' }}>
                {formatDate((project as any).contractSignedAt)}
              </span>
            </div>
          )}
        </div>

        {/* Feedback */}
        {projectSaveFeedback && (
          <div style={{
            marginTop: '12px', fontSize: '13px',
            color: projectSaveFeedback.type === 'success' ? '#22c55e' : '#ef4444',
          }}>
            {projectSaveFeedback.message}
          </div>
        )}
      </div>

      {/* Tabs */}
      <div
        style={{
          display: 'flex',
          gap: '8px',
          borderBottom: `2px solid var(--border)`,
          marginBottom: '24px',
          paddingBottom: '0',
        }}
      >
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
              style={{
                padding: '12px 16px',
                background: 'none',
                border: 'none',
                color: activeTab === tab ? 'var(--accent)' : 'var(--foreground-muted)',
                borderBottom: activeTab === tab ? `3px solid var(--accent)` : 'none',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: activeTab === tab ? '600' : '500',
                transition: 'all 0.2s',
              }}
            >
              {tabLabels[tab]}
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px' }}>
          {/* Project Summary */}
          <div
            className="agd-card"
            style={{
              background: 'var(--surface-raised)',
              border: `1px solid var(--border)`,
              borderRadius: '8px',
              padding: '16px',
            }}
          >
            <h3 style={{ fontSize: '16px', fontWeight: '600', color: 'var(--foreground)', marginTop: 0 }}>
              סיכום פרויקט
            </h3>
            <p style={{ color: 'var(--foreground-muted)', fontSize: '14px', lineHeight: '1.6' }}>
              {project?.description || 'אין תיאור זמין'}
            </p>
          </div>

          {/* Milestones Progress */}
          <div
            className="agd-card"
            style={{
              background: 'var(--surface-raised)',
              border: `1px solid var(--border)`,
              borderRadius: '8px',
              padding: '16px',
            }}
          >
            <h3 style={{ fontSize: '16px', fontWeight: '600', color: 'var(--foreground)', marginTop: 0 }}>
              התקדמות אבני דרך
            </h3>
            <div style={{ marginBottom: '12px' }}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '8px',
                }}
              >
                <span style={{ color: 'var(--foreground)', fontWeight: '600', fontSize: '14px' }}>
                  {completedMilestones} / {projectMilestones?.length || 0}
                </span>
              </div>
              <div
                style={{
                  width: '100%',
                  height: '8px',
                  background: 'var(--border)',
                  borderRadius: '4px',
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    height: '100%',
                    width: `${(projectMilestones?.length || 0) > 0 ? (completedMilestones / (projectMilestones?.length || 1)) * 100 : 0}%`,
                    background: '#22c55e',
                    transition: 'width 0.3s',
                  }}
                />
              </div>
            </div>
          </div>

          {/* Payments Summary */}
          <div
            className="agd-card"
            style={{
              background: 'var(--surface-raised)',
              border: `1px solid var(--border)`,
              borderRadius: '8px',
              padding: '16px',
            }}
          >
            <h3 style={{ fontSize: '16px', fontWeight: '600', color: 'var(--foreground)', marginTop: 0 }}>
              סיכום תשלומים
            </h3>
            <div style={{ marginBottom: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ color: 'var(--foreground-muted)', fontSize: '12px' }}>שולם</span>
                <span style={{ color: '#22c55e', fontWeight: '600' }}>₪{paidAmount.toLocaleString('he-IL')}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ color: 'var(--foreground-muted)', fontSize: '12px' }}>כולל</span>
                <span style={{ color: 'var(--foreground)', fontWeight: '600' }}>₪{totalAmount.toLocaleString('he-IL')}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--foreground-muted)', fontSize: '12px' }}>נותר</span>
                <span style={{ color: '#f59e0b', fontWeight: '600' }}>₪{(totalAmount - paidAmount).toLocaleString('he-IL')}</span>
              </div>
            </div>
          </div>

          {/* Timeline */}
          <div
            className="agd-card"
            style={{
              background: 'var(--surface-raised)',
              border: `1px solid var(--border)`,
              borderRadius: '8px',
              padding: '16px',
              gridColumn: 'span 2',
            }}
          >
            <h3 style={{ fontSize: '16px', fontWeight: '600', color: 'var(--foreground)', marginTop: 0 }}>
              ציר הזמן
            </h3>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '12px', color: 'var(--foreground-muted)', marginBottom: '4px' }}>
                  התחלה
                </div>
                <div style={{ fontSize: '14px', fontWeight: '600', color: 'var(--foreground)' }}>
                  {formatDate(project?.startDate || null)}
                </div>
              </div>

              <div
                style={{
                  flex: 1,
                  height: '2px',
                  background: 'var(--border)',
                  margin: '0 16px',
                  marginTop: '16px',
                }}
              />

              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '12px', color: 'var(--foreground-muted)', marginBottom: '4px' }}>
                  סיום
                </div>
                <div style={{ fontSize: '14px', fontWeight: '600', color: 'var(--foreground)' }}>
                  {formatDate(project?.endDate || null)}
                </div>
              </div>
            </div>
          </div>

          {/* Recent Activity */}
          <div
            className="agd-card"
            style={{
              background: 'var(--surface-raised)',
              border: `1px solid var(--border)`,
              borderRadius: '8px',
              padding: '16px',
              gridColumn: 'span 2',
            }}
          >
            <h3 style={{ fontSize: '16px', fontWeight: '600', color: 'var(--foreground)', marginTop: 0 }}>
              פעילות אחרונה
            </h3>
            <p style={{ color: 'var(--foreground-muted)', fontSize: '14px', margin: 0 }}>
              פרויקט נוצר בתאריך {formatDate(project?.createdAt || null)}
            </p>
          </div>
        </div>
      )}

      {activeTab === 'milestones' && (
        <div>
          <div style={{ marginBottom: '24px' }}>
            <button
              className="mod-btn-primary"
              onClick={() => setShowMilestoneForm(!showMilestoneForm)}
              style={{ marginBottom: '16px' }}
            >
              {showMilestoneForm ? 'ביטול' : '+ הוספת אבן דרך'}
            </button>

            {showMilestoneForm && (
              <div
                style={{
                  background: 'var(--surface-raised)',
                  border: `1px solid var(--border)`,
                  borderRadius: '8px',
                  padding: '16px',
                  marginBottom: '16px',
                }}
              >
                <h4 style={{ marginTop: 0, color: 'var(--foreground)' }}>אבן דרך חדשה</h4>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', marginBottom: '12px' }}>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="שם אבן דרך"
                    value={milestoneFormData.title}
                    onChange={(e) =>
                      setMilestoneFormData({ ...milestoneFormData, title: e.target.value })
                    }
                    style={{ direction: 'rtl' }}
                  />
                  <input
                    type="date"
                    className="form-input"
                    value={milestoneFormData.dueDate}
                    onChange={(e) =>
                      setMilestoneFormData({ ...milestoneFormData, dueDate: e.target.value })
                    }
                    style={{ direction: 'rtl' }}
                  />
                  <select
                    className="form-select"
                    value={milestoneFormData.assigneeId}
                    onChange={(e) =>
                      setMilestoneFormData({ ...milestoneFormData, assigneeId: e.target.value })
                    }
                  >
                    <option value="">בחר עובד</option>
                    {employeesData.map((emp: Employee) => (
                      <option key={emp.id} value={emp.id}>
                        {emp.name}
                      </option>
                    ))}
                  </select>
                </div>

                <textarea
                  className="form-input"
                  placeholder="תיאור"
                  value={milestoneFormData.description}
                  onChange={(e) =>
                    setMilestoneFormData({ ...milestoneFormData, description: e.target.value })
                  }
                  style={{
                    direction: 'rtl',
                    minHeight: '80px',
                    marginBottom: '12px',
                    fontFamily: 'inherit',
                  }}
                />

                <textarea
                  className="form-input"
                  placeholder="הערות"
                  value={milestoneFormData.notes}
                  onChange={(e) =>
                    setMilestoneFormData({ ...milestoneFormData, notes: e.target.value })
                  }
                  style={{
                    direction: 'rtl',
                    minHeight: '60px',
                    marginBottom: '12px',
                    fontFamily: 'inherit',
                  }}
                />

                <button
                  className="mod-btn-primary"
                  onClick={handleAddMilestone}
                  disabled={loading}
                  style={{ marginRight: '8px' }}
                >
                  {loading ? 'שומר...' : 'הוסף'}
                </button>
                <button
                  className="mod-btn-ghost"
                  onClick={() => setShowMilestoneForm(false)}
                  disabled={loading}
                >
                  ביטול
                </button>
              </div>
            )}
          </div>

          <div style={{ display: 'grid', gap: '16px' }}>
            {(projectMilestones?.length || 0) === 0 ? (
              <div
                style={{
                  background: 'var(--surface-raised)',
                  border: `1px solid var(--border)`,
                  borderRadius: '8px',
                  padding: '24px',
                  textAlign: 'center',
                }}
              >
                <p style={{ color: 'var(--foreground-muted)', margin: 0 }}>
                  אין אבני דרך לפרויקט זה
                </p>
              </div>
            ) : (
              (projectMilestones || []).map((milestone: ProjectMilestone) => {
                const assignee = (employeesData || []).find((e: Employee) => e?.id === milestone?.assignedEmployeeId);
                const dueDate = milestone?.dueDate ? new Date(milestone.dueDate) : null;
                const isEditing = editingMilestoneId === milestone?.id;

                return (
                  <div
                    key={milestone.id}
                    style={{
                      background: 'var(--surface-raised)',
                      border: `1px solid var(--border)`,
                      borderRadius: '8px',
                      padding: '16px',
                    }}
                  >
                    {isEditing ? (
                      <div>
                        <input
                          type="text"
                          className="form-input"
                          value={milestone.title}
                          onChange={(e) => {
                            // Update logic would go here
                          }}
                          style={{ direction: 'rtl', marginBottom: '12px' }}
                        />
                        <button
                          className="mod-btn-primary"
                          onClick={() => setEditingMilestoneId(null)}
                          style={{ marginRight: '8px' }}
                        >
                          שמור
                        </button>
                        <button
                          className="mod-btn-ghost"
                          onClick={() => setEditingMilestoneId(null)}
                        >
                          ביטול
                        </button>
                      </div>
                    ) : (
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                          <div>
                            <h4
                              style={{
                                fontSize: '16px',
                                fontWeight: '600',
                                color: 'var(--foreground)',
                                margin: '0 0 4px 0',
                              }}
                            >
                              {milestone.title}
                            </h4>
                            <p
                              style={{
                                fontSize: '13px',
                                color: 'var(--foreground-muted)',
                                margin: 0,
                              }}
                            >
                              {milestone.description}
                            </p>
                          </div>

                          <div
                            style={{
                              display: 'inline-block',
                              padding: '4px 12px',
                              background: statusColors[milestone?.status || 'pending'],
                              color: '#fff',
                              borderRadius: '6px',
                              fontSize: '12px',
                              fontWeight: '600',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {milestoneStatusLabels[milestone?.status || 'pending']}
                          </div>
                        </div>

                        <div
                          style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
                            gap: '12px',
                            marginBottom: '12px',
                          }}
                        >
                          <div>
                            <span style={{ fontSize: '11px', color: 'var(--foreground-muted)', display: 'block', marginBottom: '2px' }}>
                              תאריך הגשה
                            </span>
                            <span style={{ fontSize: '13px', color: 'var(--foreground)' }}>
                              {formatDate(milestone?.dueDate || null)}
                            </span>
                          </div>

                          <div>
                            <span style={{ fontSize: '11px', color: 'var(--foreground-muted)', display: 'block', marginBottom: '2px' }}>
                              מוקצה ל
                            </span>
                            <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                              <select
                                value={
                                  pendingAssignee[milestone.id] !== undefined
                                    ? pendingAssignee[milestone.id]
                                    : (milestone as any)?.assigneeId || (milestone as any)?.assignedEmployeeId || ''
                                }
                                onChange={(e) => {
                                  setPendingAssignee((prev) => ({ ...prev, [milestone.id]: e.target.value }));
                                  // Clear any stale feedback when user changes selection
                                  setAssignFeedback((prev) => { const n = { ...prev }; delete n[milestone.id]; return n; });
                                }}
                                disabled={loading || assigningMilestone === milestone.id}
                                style={{
                                  fontSize: '13px',
                                  color: 'var(--foreground)',
                                  background: 'var(--surface)',
                                  border: '1px solid var(--border)',
                                  borderRadius: '4px',
                                  padding: '2px 6px',
                                  flex: 1,
                                  direction: 'rtl',
                                }}
                              >
                                <option value="">לא הוצמד</option>
                                {(employeesData || []).map((emp: Employee) => (
                                  <option key={emp.id} value={emp.id}>
                                    {emp.name || (emp as any).email}
                                  </option>
                                ))}
                              </select>
                              <button
                                onClick={() => handleAssignMilestoneEmployee(milestone)}
                                disabled={loading || assigningMilestone === milestone.id}
                                style={{
                                  fontSize: '12px',
                                  padding: '3px 10px',
                                  borderRadius: '4px',
                                  border: '1px solid var(--accent)',
                                  background: assigningMilestone === milestone.id ? 'var(--surface)' : 'var(--accent)',
                                  color: assigningMilestone === milestone.id ? 'var(--foreground-muted)' : '#fff',
                                  cursor: assigningMilestone === milestone.id ? 'wait' : 'pointer',
                                  whiteSpace: 'nowrap',
                                }}
                              >
                                {assigningMilestone === milestone.id ? '...' : 'שייך לעובד'}
                              </button>
                            </div>
                            {assignFeedback[milestone.id] && (
                              <div
                                style={{
                                  fontSize: '11px',
                                  marginTop: '4px',
                                  color: assignFeedback[milestone.id].type === 'success' ? '#22c55e' : '#ef4444',
                                }}
                              >
                                {assignFeedback[milestone.id].message}
                              </div>
                            )}
                          </div>

                          <div>
                            <span style={{ fontSize: '11px', color: 'var(--foreground-muted)', display: 'block', marginBottom: '2px' }}>
                              קבצים
                            </span>
                            <span style={{ fontSize: '13px', color: 'var(--accent)' }}>
                              {getFilesForMilestone(milestone.id).length} קבצים
                            </span>
                          </div>
                        </div>

                        {((milestone as any)?.startedAt || (milestone as any)?.submittedAt || (milestone as any)?.approvedAt) && (
                          <div
                            style={{
                              display: 'flex',
                              flexWrap: 'wrap',
                              gap: '12px',
                              fontSize: '11px',
                              color: 'var(--foreground-muted)',
                              marginBottom: '12px',
                            }}
                          >
                            {(milestone as any)?.startedAt && (
                              <span>
                                התחיל: <span style={{ color: 'var(--foreground)' }}>{formatDate((milestone as any).startedAt)}</span>
                              </span>
                            )}
                            {(milestone as any)?.submittedAt && (
                              <span>
                                הוגש: <span style={{ color: 'var(--foreground)' }}>{formatDate((milestone as any).submittedAt)}</span>
                              </span>
                            )}
                            {(milestone as any)?.approvedAt && (
                              <span>
                                אושר: <span style={{ color: 'var(--foreground)' }}>{formatDate((milestone as any).approvedAt)}</span>
                              </span>
                            )}
                          </div>
                        )}

                        {milestone?.notes && (
                          <div style={{ marginBottom: '12px', padding: '8px', background: 'var(--border)', borderRadius: '4px' }}>
                            <span style={{ fontSize: '11px', color: 'var(--foreground-muted)', display: 'block', marginBottom: '4px' }}>
                              הערות
                            </span>
                            <span style={{ fontSize: '13px', color: 'var(--foreground)' }}>
                              {milestone?.notes}
                            </span>
                          </div>
                        )}

                        {/* ── Milestone Files Section ── */}
                        <div style={{ marginBottom: '12px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                            <span style={{ fontSize: '12px', fontWeight: '600', color: 'var(--foreground)' }}>
                              קבצים מצורפים
                            </span>
                            <input
                              type="file"
                              ref={(el) => { fileInputRefs.current[milestone.id] = el; }}
                              style={{ display: 'none' }}
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) handleMilestoneFileUpload(milestone.id, file);
                              }}
                            />
                            <button
                              onClick={() => fileInputRefs.current[milestone.id]?.click()}
                              disabled={uploadingMilestone === milestone.id}
                              style={{
                                fontSize: '11px', padding: '2px 8px', borderRadius: '4px',
                                border: '1px solid var(--accent)', background: 'var(--accent)',
                                color: '#fff', cursor: uploadingMilestone === milestone.id ? 'wait' : 'pointer',
                              }}
                            >
                              {uploadingMilestone === milestone.id ? 'מעלה...' : 'העלאת קובץ'}
                            </button>
                          </div>
                          {getFilesForMilestone(milestone.id).length > 0 ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                              {getFilesForMilestone(milestone.id).map((mf: MilestoneFile) => (
                                <div
                                  key={mf.id}
                                  style={{
                                    display: 'flex', alignItems: 'center', gap: '8px',
                                    padding: '4px 8px', background: 'var(--surface)',
                                    border: '1px solid var(--border)', borderRadius: '4px',
                                    fontSize: '12px',
                                  }}
                                >
                                  <a
                                    href={mf.fileUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    style={{ color: 'var(--accent)', textDecoration: 'none', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                                    title={mf.fileName}
                                  >
                                    {mf.fileName}
                                  </a>
                                  <span style={{ color: 'var(--foreground-muted)', fontSize: '10px', flexShrink: 0 }}>
                                    {(mf.fileSize || 0) > 1024 * 1024
                                      ? `${((mf.fileSize || 0) / (1024 * 1024)).toFixed(1)} MB`
                                      : `${Math.round((mf.fileSize || 0) / 1024)} KB`}
                                  </span>
                                  <button
                                    onClick={() => handleDeleteMilestoneFile(mf.id)}
                                    style={{
                                      fontSize: '11px', padding: '1px 6px', borderRadius: '3px',
                                      border: '1px solid #fca5a5', background: '#fef2f2',
                                      color: '#dc2626', cursor: 'pointer', flexShrink: 0,
                                    }}
                                    title="מחק קובץ"
                                  >
                                    ✕
                                  </button>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <span style={{ fontSize: '11px', color: 'var(--foreground-muted)' }}>
                              אין קבצים מצורפים
                            </span>
                          )}
                        </div>

                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                          {milestone?.status === 'pending' && (
                            <button
                              className="mod-btn-primary"
                              onClick={() =>
                                handleUpdateMilestone(milestone?.id || '', { status: 'in_progress' })
                              }
                              disabled={loading}
                              style={{ fontSize: '12px', padding: '6px 12px' }}
                            >
                              התחל
                            </button>
                          )}

                          {milestone?.status === 'in_progress' && (
                            <button
                              className="mod-btn-primary"
                              onClick={() =>
                                handleUpdateMilestone(milestone?.id || '', { status: 'submitted' })
                              }
                              disabled={loading}
                              style={{ fontSize: '12px', padding: '6px 12px' }}
                            >
                              הגש
                            </button>
                          )}

                          {milestone?.status === 'submitted' && (
                            <>
                              <button
                                className="mod-btn-primary"
                                onClick={() =>
                                  handleUpdateMilestone(milestone?.id || '', { status: 'approved' })
                                }
                                disabled={loading}
                                style={{ fontSize: '12px', padding: '6px 12px', background: '#22c55e' }}
                              >
                                אשר
                              </button>
                              <button
                                className="mod-btn-ghost"
                                onClick={() =>
                                  handleUpdateMilestone(milestone?.id || '', { status: 'returned' })
                                }
                                disabled={loading}
                                style={{ fontSize: '12px', padding: '6px 12px' }}
                              >
                                החזר
                              </button>
                            </>
                          )}

                          <button
                            className="mod-btn-ghost"
                            onClick={() => setEditingMilestoneId(milestone?.id || null)}
                            disabled={loading}
                            style={{ fontSize: '12px', padding: '6px 12px' }}
                          >
                            עריכה
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {activeTab === 'files' && (
        <div>
          <div style={{ marginBottom: '24px' }}>
            <button
              className="mod-btn-primary"
              onClick={() => setShowFileForm(!showFileForm)}
              style={{ marginBottom: '16px' }}
            >
              {showFileForm ? 'ביטול' : '+ הוספת קובץ'}
            </button>

            {showFileForm && (
              <div
                style={{
                  background: 'var(--surface-raised)',
                  border: `1px solid var(--border)`,
                  borderRadius: '8px',
                  padding: '16px',
                  marginBottom: '16px',
                }}
              >
                {/* Category selector — shared by both upload methods */}
                <div style={{ marginBottom: '12px' }}>
                  <span style={{ fontSize: '12px', color: 'var(--foreground-muted)', display: 'block', marginBottom: '4px' }}>
                    קטגוריה
                  </span>
                  <select
                    className="form-select"
                    value={fileFormData.category}
                    onChange={(e) =>
                      setFileFormData({ ...fileFormData, category: e.target.value as FileCategory })
                    }
                    style={{ maxWidth: '200px' }}
                  >
                    <option value="general">כללי</option>
                    <option value="agreements">הסכמים</option>
                    <option value="branding">ברנדינג</option>
                    <option value="website">אתר</option>
                  </select>
                </div>

                {/* ── Upload from computer ── */}
                <div
                  style={{
                    padding: '12px',
                    background: 'var(--surface)',
                    border: '1px solid var(--border)',
                    borderRadius: '6px',
                    marginBottom: '12px',
                  }}
                >
                  <h4 style={{ marginTop: 0, fontSize: '14px', color: 'var(--foreground)' }}>
                    העלאה מהמחשב
                  </h4>
                  <p style={{ fontSize: '11px', color: 'var(--foreground-muted)', margin: '0 0 8px 0' }}>
                    PDF, תמונות (PNG, JPG, GIF, WEBP) — עד 10 MB
                  </p>
                  <input
                    type="file"
                    ref={projectFileInputRef}
                    accept=".pdf,.png,.jpg,.jpeg,.gif,.webp"
                    style={{ display: 'none' }}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleProjectFileUpload(file);
                    }}
                  />
                  <button
                    onClick={() => projectFileInputRef.current?.click()}
                    disabled={uploadingProjectFile}
                    style={{
                      fontSize: '13px', padding: '6px 16px', borderRadius: '6px',
                      border: '1px solid var(--accent)', background: 'var(--accent)',
                      color: '#fff', cursor: uploadingProjectFile ? 'wait' : 'pointer',
                    }}
                  >
                    {uploadingProjectFile ? 'מעלה...' : 'העלה קובץ'}
                  </button>
                  {projectFileError && (
                    <div style={{ marginTop: '8px', fontSize: '12px', color: '#ef4444' }}>
                      {projectFileError}
                    </div>
                  )}
                </div>

                {/* ── Or add by URL link ── */}
                <div
                  style={{
                    padding: '12px',
                    background: 'var(--surface)',
                    border: '1px solid var(--border)',
                    borderRadius: '6px',
                  }}
                >
                  <h4 style={{ marginTop: 0, fontSize: '14px', color: 'var(--foreground)' }}>
                    או הוספה מקישור
                  </h4>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <input
                      type="url"
                      className="form-input"
                      placeholder="כתובת URL של הקובץ"
                      value={fileFormData.url}
                      onChange={(e) =>
                        setFileFormData({ ...fileFormData, url: e.target.value })
                      }
                      style={{ direction: 'rtl', flex: 1 }}
                    />
                    <button
                      className="mod-btn-primary"
                      onClick={handleAddFile}
                      disabled={loading}
                      style={{ whiteSpace: 'nowrap' }}
                    >
                      {loading ? 'שומר...' : 'הוסף קישור'}
                    </button>
                  </div>
                </div>

                <div style={{ marginTop: '12px' }}>
                  <button
                    className="mod-btn-ghost"
                    onClick={() => { setShowFileForm(false); setProjectFileError(null); }}
                    disabled={loading || uploadingProjectFile}
                  >
                    ביטול
                  </button>
                </div>
              </div>
            )}
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
              gap: '16px',
            }}
          >
            {(projectClientFiles?.length || 0) === 0 ? (
              <div
                style={{
                  background: 'var(--surface-raised)',
                  border: `1px solid var(--border)`,
                  borderRadius: '8px',
                  padding: '24px',
                  textAlign: 'center',
                  gridColumn: 'span 1',
                }}
              >
                <p style={{ color: 'var(--foreground-muted)', margin: 0 }}>
                  אין קבצים
                </p>
              </div>
            ) : (
              (projectClientFiles || []).map((file) => {
                const uploadDate = file?.createdAt ? new Date(file.createdAt) : null;
                const categoryLabels: Record<string, string> = {
                  general: 'כללי',
                  agreements: 'הסכמים',
                  branding: 'ברנדינג',
                  website: 'אתר',
                };

                return (
                  <a
                    key={file?.id || ''}
                    href={file?.fileUrl || '#'}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      background: 'var(--surface-raised)',
                      border: `1px solid var(--border)`,
                      borderRadius: '8px',
                      padding: '16px',
                      textDecoration: 'none',
                      color: 'inherit',
                      transition: 'all 0.2s',
                    }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLElement).style.borderColor = 'var(--accent)';
                      (e.currentTarget as HTMLElement).style.background = 'var(--border)';
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)';
                      (e.currentTarget as HTMLElement).style.background = 'var(--surface-raised)';
                    }}
                  >
                    <div style={{ fontSize: '20px', marginBottom: '8px' }}>
                      📄
                    </div>
                    <h4
                      style={{
                        fontSize: '14px',
                        fontWeight: '600',
                        color: 'var(--foreground)',
                        margin: '0 0 8px 0',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {file?.fileName || 'קובץ'}
                    </h4>
                    <div style={{ marginBottom: '8px' }}>
                      <span
                        style={{
                          display: 'inline-block',
                          fontSize: '11px',
                          padding: '2px 8px',
                          background: 'var(--accent-muted)',
                          color: 'var(--accent)',
                          borderRadius: '4px',
                        }}
                      >
                        {categoryLabels[file.category] || file.category}
                      </span>
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--foreground-muted)' }}>
                      {uploadDate?.toLocaleDateString('he-IL') || '-'}
                    </div>
                  </a>
                );
              })
            )}
          </div>
        </div>
      )}

      {activeTab === 'payments' && (
        <div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
              gap: '16px',
              marginBottom: '24px',
            }}
          >
            <div
              className="agd-card"
              style={{
                background: 'var(--surface-raised)',
                border: `1px solid var(--border)`,
                borderRadius: '8px',
                padding: '16px',
              }}
            >
              <h4 style={{ fontSize: '12px', color: 'var(--foreground-muted)', margin: '0 0 8px 0', textTransform: 'uppercase' }}>
                סה"כ
              </h4>
              <div style={{ fontSize: '24px', fontWeight: '700', color: 'var(--foreground)' }}>
                ₪{totalAmount.toLocaleString('he-IL')}
              </div>
            </div>

            <div
              className="agd-card"
              style={{
                background: 'var(--surface-raised)',
                border: `1px solid var(--border)`,
                borderRadius: '8px',
                padding: '16px',
              }}
            >
              <h4 style={{ fontSize: '12px', color: 'var(--foreground-muted)', margin: '0 0 8px 0', textTransform: 'uppercase' }}>
                שולם
              </h4>
              <div style={{ fontSize: '24px', fontWeight: '700', color: '#22c55e' }}>
                ₪{paidAmount.toLocaleString('he-IL')}
              </div>
            </div>

            <div
              className="agd-card"
              style={{
                background: 'var(--surface-raised)',
                border: `1px solid var(--border)`,
                borderRadius: '8px',
                padding: '16px',
              }}
            >
              <h4 style={{ fontSize: '12px', color: 'var(--foreground-muted)', margin: '0 0 8px 0', textTransform: 'uppercase' }}>
                נותר
              </h4>
              <div style={{ fontSize: '24px', fontWeight: '700', color: '#f59e0b' }}>
                ₪{(totalAmount - paidAmount).toLocaleString('he-IL')}
              </div>
            </div>
          </div>

          <div
            style={{
              display: 'grid',
              gap: '12px',
            }}
          >
            {(projectPayments?.length || 0) === 0 ? (
              <div
                style={{
                  background: 'var(--surface-raised)',
                  border: `1px solid var(--border)`,
                  borderRadius: '8px',
                  padding: '24px',
                  textAlign: 'center',
                }}
              >
                <p style={{ color: 'var(--foreground-muted)', margin: 0 }}>
                  אין תשלומים לפרויקט זה
                </p>
              </div>
            ) : (
              (projectPayments || []).map((payment) => {
                const dueDate = payment?.dueDate ? new Date(payment.dueDate) : null;
                const statusColor =
                  payment?.status === 'paid'
                    ? '#22c55e'
                    : payment?.status === 'pending'
                    ? '#f59e0b'
                    : '#f97316';

                return (
                  <div
                    key={payment?.id || ''}
                    style={{
                      background: 'var(--surface-raised)',
                      border: `1px solid var(--border)`,
                      borderRadius: '8px',
                      padding: '16px',
                      display: 'grid',
                      gridTemplateColumns: 'auto 1fr auto auto auto',
                      alignItems: 'center',
                      gap: '16px',
                    }}
                  >
                    <div
                      style={{
                        width: '4px',
                        height: '40px',
                        background: statusColor,
                        borderRadius: '2px',
                      }}
                    />

                    <div>
                      <div style={{ fontSize: '14px', fontWeight: '600', color: 'var(--foreground)', marginBottom: '4px' }}>
                        {payment?.description || 'תשלום'}
                      </div>
                      <div style={{ fontSize: '12px', color: 'var(--foreground-muted)' }}>
                        לתאריך: {formatDate(payment?.dueDate || null)}
                      </div>
                    </div>

                    <div style={{ textAlign: 'left' }}>
                      <div style={{ fontSize: '16px', fontWeight: '700', color: 'var(--foreground)' }}>
                        ₪{(payment?.amount || 0).toLocaleString('he-IL')}
                      </div>
                    </div>

                    <div
                      style={{
                        display: 'inline-block',
                        padding: '4px 12px',
                        background: statusColor,
                        color: '#fff',
                        borderRadius: '6px',
                        fontSize: '12px',
                        fontWeight: '600',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {paymentStatusLabels[payment?.status || 'pending']}
                    </div>

                    <div style={{ display: 'flex', gap: '8px' }}>
                      {payment?.status !== 'paid' && (
                        <button
                          className="mod-btn-primary"
                          onClick={() =>
                            handleUpdatePaymentStatus(payment?.id || '', 'paid')
                          }
                          disabled={loading}
                          style={{ fontSize: '12px', padding: '6px 12px' }}
                        >
                          סימון כשולם
                        </button>
                      )}
                      <button
                        className="mod-btn-ghost"
                        onClick={() => {
                          // Send reminder logic
                        }}
                        disabled={loading}
                        style={{ fontSize: '12px', padding: '6px 12px' }}
                      >
                        הזכר
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {activeTab === 'activity' && (
        <div>
          <div
            style={{
              display: 'grid',
              gap: '16px',
            }}
          >
            {(projectMilestones?.length || 0) === 0 && (projectPayments?.length || 0) === 0 ? (
              <div
                style={{
                  background: 'var(--surface-raised)',
                  border: `1px solid var(--border)`,
                  borderRadius: '8px',
                  padding: '24px',
                  textAlign: 'center',
                }}
              >
                <p style={{ color: 'var(--foreground-muted)', margin: 0 }}>
                  אין פעילות בפרויקט זה
                </p>
              </div>
            ) : (
              <>
                <div
                  style={{
                    background: 'var(--surface-raised)',
                    border: `1px solid var(--border)`,
                    borderRadius: '8px',
                    padding: '16px',
                    display: 'flex',
                    gap: '16px',
                  }}
                >
                  <div
                    style={{
                      fontSize: '24px',
                      minWidth: '32px',
                      textAlign: 'center',
                    }}
                  >
                    ⭐
                  </div>
                  <div>
                    <div style={{ fontSize: '14px', fontWeight: '600', color: 'var(--foreground)', marginBottom: '4px' }}>
                      פרויקט נוצר
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--foreground-muted)' }}>
                      {new Date(project.createdAt).toLocaleDateString('he-IL', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </div>
                  </div>
                </div>

                {projectMilestones
                  .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                  .map((milestone) => (
                    <div
                      key={`milestone-${milestone.id}`}
                      style={{
                        background: 'var(--surface-raised)',
                        border: `1px solid var(--border)`,
                        borderRadius: '8px',
                        padding: '16px',
                        display: 'flex',
                        gap: '16px',
                      }}
                    >
                      <div
                        style={{
                          fontSize: '24px',
                          minWidth: '32px',
                          textAlign: 'center',
                        }}
                      >
                        ✓
                      </div>
                      <div>
                        <div style={{ fontSize: '14px', fontWeight: '600', color: 'var(--foreground)', marginBottom: '4px' }}>
                          אבן דרך: {milestone.title}
                        </div>
                        <div style={{ fontSize: '12px', color: 'var(--foreground-muted)', marginBottom: '4px' }}>
                          סטטוס: {milestoneStatusLabels[milestone.status]}
                        </div>
                        <div style={{ fontSize: '12px', color: 'var(--foreground-muted)' }}>
                          {new Date(milestone.createdAt).toLocaleDateString('he-IL', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </div>
                      </div>
                    </div>
                  ))}

                {projectPayments
                  .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                  .map((payment) => (
                    <div
                      key={`payment-${payment.id}`}
                      style={{
                        background: 'var(--surface-raised)',
                        border: `1px solid var(--border)`,
                        borderRadius: '8px',
                        padding: '16px',
                        display: 'flex',
                        gap: '16px',
                      }}
                    >
                      <div
                        style={{
                          fontSize: '24px',
                          minWidth: '32px',
                          textAlign: 'center',
                        }}
                      >
                        💰
                      </div>
                      <div>
                        <div style={{ fontSize: '14px', fontWeight: '600', color: 'var(--foreground)', marginBottom: '4px' }}>
                          תשלום: ₪{payment.amount.toLocaleString('he-IL')}
                        </div>
                        <div style={{ fontSize: '12px', color: 'var(--foreground-muted)', marginBottom: '4px' }}>
                          סטטוס: {paymentStatusLabels[payment.status]}
                        </div>
                        <div style={{ fontSize: '12px', color: 'var(--foreground-muted)' }}>
                          {new Date(payment.createdAt).toLocaleDateString('he-IL', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </div>
                      </div>
                    </div>
                  ))}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
