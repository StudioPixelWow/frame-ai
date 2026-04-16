'use client';

import { useState, useMemo } from 'react';
import { useParams } from 'next/navigation';
import {
  useBusinessProjects,
  useProjectMilestones,
  useProjectPayments,
  useClients,
  useEmployees,
  useClientFiles,
  useTasks,
} from '@/lib/api/use-entity';
import { BusinessProject, ProjectMilestone, ProjectPayment, Client, Employee, ClientFile } from '@/lib/db/schema';

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

  // NOTE: All hooks must run on every render (Rules of Hooks). Keep these
  // useMemos above the early returns and make them safe when project is undefined.
  const projectClient = useMemo(
    () => project ? clientsData.find((c: Client) => c.id === project.clientId) : undefined,
    [clientsData, project]
  );

  const assignedManager = useMemo(
    () => project ? employeesData.find((e: Employee) => e.id === project.assignedManagerId) : undefined,
    [employeesData, project]
  );

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

  const handleAddMilestone = async () => {
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
  const handleAssignMilestoneEmployee = async (milestone: any) => {
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

  const handleUpdateMilestone = async (milestoneId: string, updates: Partial<ProjectMilestone>) => {
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

  const handleUpdatePaymentStatus = async (paymentId: string, status: ProjectPaymentStatus) => {
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

  const handleAddFile = async () => {
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

  const handleUpdateProjectStatus = async (newStatus: string) => {
    setLoading(true);
    try {
      await updateProject(projectId, { projectStatus: newStatus } as any);
    } catch (error) {
      console.error('Error updating project status:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleMarkComplete = async () => {
    await handleUpdateProjectStatus('completed');
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
            <h1
              style={{
                fontSize: '32px',
                fontWeight: '700',
                color: 'var(--foreground)',
                margin: '0 0 8px 0',
              }}
            >
              {project.projectName}
            </h1>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '12px' }}>
              {projectClient && (
                <a
                  href={`/clients/${projectClient.id}`}
                  style={{
                    color: 'var(--accent)',
                    textDecoration: 'none',
                    fontSize: '14px',
                    fontWeight: '600',
                  }}
                >
                  {projectClient.name}
                </a>
              )}
            </div>
          </div>

          <div style={{ display: 'flex', gap: '8px', flexDirection: 'column', alignItems: 'flex-start' }}>
            <button
              className="mod-btn-primary"
              style={{ width: '100%', minWidth: '140px' }}
              onClick={handleMarkComplete}
              disabled={loading}
            >
              סימון כהושלם
            </button>
            <select
              className="form-select"
              value={project?.projectStatus || 'not_started'}
              onChange={(e) => handleUpdateProjectStatus(e.target.value)}
              disabled={loading}
              style={{ minWidth: '140px' }}
            >
              <option value="not_started">לא התחיל</option>
              <option value="in_progress">בתהליך</option>
              <option value="waiting_for_client">בהמתנה ללקוח</option>
              <option value="completed">הושלם</option>
            </select>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '12px' }}>
          <div>
            <span style={{ fontSize: '12px', color: 'var(--foreground-muted)', display: 'block', marginBottom: '4px' }}>
              סוג
            </span>
            <div
              style={{
                display: 'inline-block',
                padding: '4px 12px',
                background: 'var(--accent-muted)',
                color: 'var(--accent)',
                borderRadius: '6px',
                fontSize: '12px',
                fontWeight: '600',
              }}
            >
              {getProjectTypeLabel(project?.projectType)}
            </div>
          </div>

          <div>
            <span style={{ fontSize: '12px', color: 'var(--foreground-muted)', display: 'block', marginBottom: '4px' }}>
              סטטוס
            </span>
            <div
              style={{
                display: 'inline-block',
                padding: '4px 12px',
                background: getProjectStatusColor(project?.projectStatus),
                color: '#fff',
                borderRadius: '6px',
                fontSize: '12px',
                fontWeight: '600',
              }}
            >
              {getProjectStatusLabel(project?.projectStatus)}
            </div>
          </div>

          <div>
            <span style={{ fontSize: '12px', color: 'var(--foreground-muted)', display: 'block', marginBottom: '4px' }}>
              הסכם
            </span>
            <span style={{ fontSize: '16px' }}>
              {project?.agreementSigned ? '✓' : '✗'}
            </span>
          </div>

          <div>
            <span style={{ fontSize: '12px', color: 'var(--foreground-muted)', display: 'block', marginBottom: '4px' }}>
              מנהל
            </span>
            <span style={{ fontSize: '14px', color: 'var(--foreground)', fontWeight: '500' }}>
              {assignedManager?.name || 'לא הוצמד' || 'לא ידוע'}
            </span>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '12px', marginTop: '16px' }}>
          <div>
            <span style={{ fontSize: '12px', color: 'var(--foreground-muted)', display: 'block', marginBottom: '4px' }}>
              תאריך התחלה
            </span>
            <span style={{ fontSize: '14px', color: 'var(--foreground)' }}>
              {formatDate(project?.startDate || null)}
            </span>
          </div>

          <div>
            <span style={{ fontSize: '12px', color: 'var(--foreground-muted)', display: 'block', marginBottom: '4px' }}>
              תאריך סיום
            </span>
            <span style={{ fontSize: '14px', color: 'var(--foreground)' }}>
              {formatDate(project?.endDate || null)}
            </span>
          </div>
        </div>
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
                              {milestone?.files?.length || 0} קבצים
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
                <h4 style={{ marginTop: 0, color: 'var(--foreground)' }}>קובץ חדש</h4>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', marginBottom: '12px' }}>
                  <input
                    type="url"
                    className="form-input"
                    placeholder="כתובת URL של הקובץ"
                    value={fileFormData.url}
                    onChange={(e) =>
                      setFileFormData({ ...fileFormData, url: e.target.value })
                    }
                    style={{ direction: 'rtl' }}
                  />
                  <select
                    className="form-select"
                    value={fileFormData.category}
                    onChange={(e) =>
                      setFileFormData({ ...fileFormData, category: e.target.value as FileCategory })
                    }
                  >
                    <option value="general">כללי</option>
                    <option value="agreements">הסכמים</option>
                    <option value="branding">ברנדינג</option>
                    <option value="website">אתר</option>
                  </select>
                </div>

                <button
                  className="mod-btn-primary"
                  onClick={handleAddFile}
                  disabled={loading}
                  style={{ marginRight: '8px' }}
                >
                  {loading ? 'שומר...' : 'הוסף'}
                </button>
                <button
                  className="mod-btn-ghost"
                  onClick={() => setShowFileForm(false)}
                  disabled={loading}
                >
                  ביטול
                </button>
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
