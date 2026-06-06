'use client';

export const dynamic = "force-dynamic";

import { useState, useEffect, useCallback } from 'react';
import { useApprovals, useTasks, useEmployeeTasks } from '@/lib/api/use-entity';
import { useToast } from '@/components/ui/toast';
import { Modal } from '@/components/ui/modal';
import type { Approval, CampaignAction } from '@/lib/db/schema';
import { fireConfetti } from '@/lib/confetti';
import { ACTION_TYPE_META, ACTION_STATUS_META } from '@/lib/optimization/actions';
import { loadImage } from '@/lib/creative-pixelai/adapter';
import { aiAdaptImageToFormat } from '@/lib/creative-pixelai/ai-adapt';

function parseFileEntry(f: string): { name: string; url: string } {
  const i = f.indexOf('|');
  return i === -1 ? { name: f, url: f } : { name: f.slice(0, i), url: f.slice(i + 1) };
}
const isImageUrl = (u: string) => /\.(png|jpe?g|webp|gif)(\?|$)/i.test(u);

const STATUS_LABELS: Record<string, string> = {
  draft: 'טיוטה',
  pending_approval: 'ממתין לאישור',
  approved: 'אושר',
  rejected: 'נדחה',
  needs_changes: 'דורש שינויים',
};

const TYPE_LABELS: Record<string, { label: string; emoji: string; color: string }> = {
  video: { label: 'וידאו', emoji: '🎬', color: '#f59e0b' },
  post: { label: 'פוסט', emoji: '📱', color: '#3b82f6' },
  gantt: { label: 'גאנט', emoji: '📊', color: '#22c55e' },
  design: { label: 'עיצוב', emoji: '🎨', color: '#ec4899' },
  milestone: { label: 'אבן דרך', emoji: '🏁', color: '#0092cc' },
};

const STATUS_COLORS: Record<string, string> = {
  draft: '#6b7280',
  pending_approval: '#f59e0b',
  approved: '#22c55e',
  rejected: '#ef4444',
  needs_changes: '#f97316',
};

const TYPE_OPTIONS = [
  { value: 'video', label: 'וידאו' },
  { value: 'post', label: 'פוסט' },
  { value: 'gantt', label: 'גאנט' },
  { value: 'design', label: 'עיצוב' },
  { value: 'milestone', label: 'אבן דרך' },
];

const STATUS_OPTIONS = [
  { value: 'draft', label: 'טיוטה' },
  { value: 'pending_approval', label: 'ממתין לאישור' },
  { value: 'approved', label: 'אושר' },
  { value: 'rejected', label: 'נדחה' },
  { value: 'needs_changes', label: 'דורש שינויים' },
];

interface FormData {
  type: 'video' | 'post' | 'gantt' | 'design' | 'milestone' | '';
  title: string;
  clientName: string;
  status: 'draft' | 'pending_approval' | 'approved' | 'rejected' | 'needs_changes' | '';
}

export default function ApprovalsPage() {
  const { data: approvals, loading, create, update, remove } = useApprovals();
  const { data: tasks, update: updateTask } = useTasks();
  const { data: employeeTasks, update: updateEmployeeTask } = useEmployeeTasks();
  const toast = useToast();

  // ── Task-approval detail (open card → preview + approve / return) ──
  const [detail, setDetail] = useState<{ approval: Approval; task: any } | null>(null);
  const [returnNotes, setReturnNotes] = useState('');
  const [showReturnBox, setShowReturnBox] = useState(false);
  const [processing, setProcessing] = useState<string>('');

  // The employee's submission lives in `submittedFiles` (separate from the
  // reference/helper `files`). Legacy tasks may still have it in `files`.
  const submittedOf = (t: any): string[] =>
    Array.isArray(t?.submittedFiles) && t.submittedFiles.length ? t.submittedFiles
    : (Array.isArray(t?.files) ? t.files : []);

  // Mirror split: a content task can live as BOTH a tsk_ record and an
  // employee-task. The employee may have submitted on the sibling. If the given
  // task has no submission, find a sibling (same gantt item, or same client+title)
  // that DOES, and merge its submitted files in so the work always shows.
  const mergeSiblingFiles = useCallback((primary: any): any => {
    if (!primary) return primary;
    if (submittedOf(primary).length > 0) return primary;
    const all = [...(employeeTasks || []), ...(tasks || [])];
    const sib = all.find((t: any) =>
      t.id !== primary.id && submittedOf(t).length > 0 && (
        (primary.ganttItemId && t.ganttItemId === primary.ganttItemId) ||
        (String(t.title || '').trim() === String(primary.title || '').trim() &&
         String(t.clientName || '').trim() === String(primary.clientName || '').trim())
      )
    );
    return sib ? { ...primary, submittedFiles: submittedOf(sib), adaptations: primary.adaptations || sib.adaptations } : primary;
  }, [tasks, employeeTasks]);

  const findTask = useCallback((taskId: string): any => {
    const primary = [...(employeeTasks || []), ...(tasks || [])].find((t: any) => t.id === taskId);
    return primary ? mergeSiblingFiles(primary) : null;
  }, [tasks, employeeTasks, mergeSiblingFiles]);

  // Fetch the linked task fresh by id (in-memory lists can be stale or scoped).
  // Tries both stores, then merges in any sibling file.
  const fetchTaskById = useCallback(async (taskId: string): Promise<any> => {
    for (const ep of ['employee-tasks', 'tasks']) {
      try {
        const r = await fetch(`/api/data/${ep}/${taskId}`);
        if (r.ok) {
          const j = await r.json();
          if (j && j.id) return mergeSiblingFiles(j);
        }
      } catch { /* try next */ }
    }
    return null;
  }, [mergeSiblingFiles]);

  // Source-aware task update (employee-tasks UUID vs tasks tsk_).
  const updateAnyTask = useCallback((id: string, patch: any) => {
    const isEmp = (employeeTasks || []).some((t: any) => t.id === id);
    return isEmp ? updateEmployeeTask(id, patch) : updateTask(id, patch);
  }, [employeeTasks, updateEmployeeTask, updateTask]);

  const openTaskApproval = async (approval: Approval) => {
    const taskId = (approval as any).taskId;
    if (!taskId) { openEditModal(approval); return; }
    setShowReturnBox(false);
    setReturnNotes('');
    setDetail({ approval, task: findTask(taskId) }); // optimistic from memory
    // Always refresh from the API — the in-memory list may be stale or scoped,
    // and the just-uploaded file may not be in it yet.
    const fresh = await fetchTaskById(taskId);
    if (fresh) setDetail((d) => (d && d.approval.id === approval.id ? { ...d, task: fresh } : d));
  };

  // All task records (both stores) that represent the SAME logical task — by
  // gantt link or client+title — so an approval propagates to every mirror.
  const relatedTaskIds = useCallback((task: any): string[] => {
    const all = [...(employeeTasks || []), ...(tasks || [])];
    const ids = new Set<string>();
    if (task?.id) ids.add(task.id);
    for (const t of all) {
      const sameGantt = task?.ganttItemId && t.ganttItemId === task.ganttItemId;
      const sameKey = String(t.title || '').trim() === String(task?.title || '').trim() &&
        String(t.clientName || '').trim() === String(task?.clientName || '').trim();
      if (sameGantt || sameKey) ids.add(t.id);
    }
    return [...ids];
  }, [tasks, employeeTasks]);

  // APPROVE: mark approved across every mirror task → auto-adapt the submitted
  // graphic to all sizes → write the deliverables into the task, the linked
  // gantt item ("ready for publishing"), and the client's Files tab.
  const approveTaskFlow = async () => {
    if (!detail) return;
    const { approval, task } = detail;
    const taskId = (approval as any).taskId;
    try {
      setProcessing('מאשר…');
      await update(approval.id, { status: 'approved' });
      // Update EVERY mirror record so the board reflects it everywhere.
      const ids = relatedTaskIds(task);
      for (const id of ids) { try { await updateAnyTask(id, { status: 'approved' }); } catch { /* keep going */ } }
      fireConfetti(30);

      // Auto size-adaptation on the first SUBMITTED image.
      const files: string[] = submittedOf(task);
      const imgEntry = files.map(parseFileEntry).find((e) => isImageUrl(e.url));
      const urls: Record<string, string> = {};
      const newFiles: string[] = [];
      if (taskId && imgEntry) {
        const img = await loadImage(imgEntry.url);
        const formats: Array<{ id: 'square' | 'feed_4_5' | 'story'; file: string }> = [
          { id: 'square', file: 'Square-1080x1080.png' },
          { id: 'feed_4_5', file: 'Feed-1080x1350.png' },
          { id: 'story', file: 'Story-1080x1920.png' },
        ];
        for (let i = 0; i < formats.length; i++) {
          setProcessing(`מתאים גדלים ${i + 1}/3…`);
          const blob = await aiAdaptImageToFormat(img, formats[i].id);
          const init = await fetch('/api/upload', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fileName: `creative-assets/tasks/${taskId}/${Date.now()}_${formats[i].file}`, contentType: 'image/png', fileSize: blob.size }) });
          if (!init.ok) continue;
          const { uploadUrl, publicUrl } = await init.json();
          const put = await fetch(uploadUrl, { method: 'PUT', headers: { 'Content-Type': 'image/png' }, body: blob });
          if (!put.ok) continue;
          urls[formats[i].id] = publicUrl;
          newFiles.push(`🎨 ${formats[i].file}|${publicUrl}`);
        }
        if (Object.keys(urls).length > 0) {
          setProcessing('שומר למשימה…');
          // Save adaptations + append deliverables to reference files on every mirror.
          for (const id of ids) {
            try {
              const rec = [...(employeeTasks || []), ...(tasks || [])].find((t: any) => t.id === id);
              const refFiles: string[] = Array.isArray(rec?.files) ? rec.files : (Array.isArray(task?.files) ? task.files : []);
              await updateAnyTask(id, { adaptations: { ...urls, createdAt: new Date().toISOString() }, files: [...refFiles, ...newFiles] });
            } catch { /* keep going */ }
          }
        }
      }

      // The full deliverable set = submitted files + adapted sizes (plain URLs).
      const deliverableEntries = [...files, ...newFiles];
      const deliverableUrls = deliverableEntries.map(parseFileEntry).map((e) => e.url).filter(Boolean);
      const imageUrls = deliverableEntries.map(parseFileEntry).filter((e) => isImageUrl(e.url)).map((e) => e.url);

      // 1) Linked gantt item → "מאושר / מוכן לפרסום" with the files.
      if (task?.ganttItemId && deliverableUrls.length) {
        setProcessing('מעדכן בגאנט התוכן…');
        try {
          await fetch(`/api/data/client-gantt-items/${task.ganttItemId}`, {
            method: 'PUT', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'approved', attachedFiles: deliverableUrls, imageUrls }),
          });
        } catch { /* best-effort */ }
      }

      // 2) Client Files tab → save the approved deliverables (deduped by URL).
      if (task?.clientId && deliverableEntries.length) {
        setProcessing('שומר בקבצי הלקוח…');
        for (const entry of deliverableEntries) {
          const { name, url } = parseFileEntry(entry);
          if (!url) continue;
          try {
            await fetch('/api/data/client-files', {
              method: 'POST', headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                clientId: task.clientId,
                fileName: `${task.title || 'תוכן מאושר'} — ${name.replace(/^🎨\s*/, '')}`,
                fileUrl: url,
                fileType: isImageUrl(url) ? 'image' : 'other',
                category: 'approved_final',
                fileSize: 0,
                linkedTaskId: taskId || null,
                linkedGanttItemId: task.ganttItemId || null,
                uploadedBy: null,
                notes: `תוכן מאושר ב-${new Date().toLocaleDateString('he-IL')}`,
              }),
            });
          } catch { /* best-effort */ }
        }
      }

      toast(imgEntry ? '✓ אושר — הותאם לכל הגדלים, עודכן בגאנט ובקבצי הלקוח' : '✓ אושר ועודכן', 'success');
      setDetail(null);
    } catch (e) {
      toast(e instanceof Error ? e.message : 'שגיאה באישור', 'error');
    } finally { setProcessing(''); }
  };

  const returnTaskFlow = async () => {
    if (!detail || !returnNotes.trim()) { toast('כתוב הערות לתיקון', 'error'); return; }
    const { approval } = detail;
    const taskId = (approval as any).taskId;
    try {
      setProcessing('מחזיר לתיקון…');
      await update(approval.id, { status: 'needs_changes' });
      const ids = relatedTaskIds(detail.task || { id: taskId });
      for (const id of ids) { try { await updateAnyTask(id, { status: 'returned', notes: returnNotes.trim() }); } catch { /* keep going */ } }
      toast('הוחזר לעובד לסבב תיקון', 'info');
      setDetail(null);
    } catch (e) {
      toast(e instanceof Error ? e.message : 'שגיאה בהחזרה', 'error');
    } finally { setProcessing(''); }
  };
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<FormData>({
    type: '',
    title: '',
    clientName: '',
    status: '',
  });

  // ── Campaign Actions ──────────────────────────────────────────────
  const [campaignActionsData, setCampaignActionsData] = useState<CampaignAction[]>([]);
  const [actionsLoading, setActionsLoading] = useState(true);

  const fetchActions = useCallback(async () => {
    try {
      const res = await fetch('/api/data/campaign-actions');
      if (res.ok) {
        const data = await res.json();
        setCampaignActionsData(data.actions || []);
      }
    } catch { /* silent */ }
    setActionsLoading(false);
  }, []);

  useEffect(() => { fetchActions(); }, [fetchActions]);

  const handleActionDecision = useCallback(async (actionId: string, decision: 'approve' | 'reject' | 'execute', reason?: string) => {
    try {
      const body: Record<string, unknown> = { action: decision };
      if (reason) body.rejectionReason = reason;
      if (decision === 'execute') body.publishToMeta = true; // actually write to Meta
      const res = await fetch(`/api/data/campaign-actions/${actionId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'x-user-role': 'admin' },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        if (decision === 'approve') {
          toast('הפעולה אושרה', 'success');
          fireConfetti(20);
        } else if (decision === 'reject') {
          toast('הפעולה נדחתה', 'info');
        } else if (decision === 'execute') {
          toast('הפעולה בוצעה בהצלחה', 'success');
          fireConfetti(30);
        }
        fetchActions();
      } else {
        const err = await res.json();
        toast(err.error || 'שגיאה', 'error');
      }
    } catch { toast('שגיאה בעדכון הפעולה', 'error'); }
  }, [toast, fetchActions]);

  // ── Role-based visibility ──────────────────────────────────────
  // In production this comes from auth context; for now read from a simple toggle
  const [userRole, setUserRole] = useState<'admin' | 'client' | 'employee'>('admin');

  const pendingActions = campaignActionsData.filter(a => a.status === 'pending' || a.status === 'approval_required');
  const approvedActions = campaignActionsData.filter(a => a.status === 'approved');
  const completedActions = campaignActionsData.filter(a => a.status === 'executed' || a.status === 'rejected' || a.status === 'failed');

  // Calculate KPIs
  const pendingCount = approvals.filter(a => a.status === 'pending_approval').length;
  const approvedCount = approvals.filter(a => a.status === 'approved').length;
  const draftCount = approvals.filter(a => a.status === 'draft').length;
  const totalCount = approvals.length;

  const kpis = [
    { label: 'ממתין לאישור', value: pendingCount },
    { label: 'אושר', value: approvedCount },
    { label: 'טיוטה', value: draftCount },
    { label: 'סה"כ', value: totalCount },
  ];

  const openCreateModal = () => {
    setEditingId(null);
    setFormData({ type: '', title: '', clientName: '', status: '' });
    setShowModal(true);
  };

  const openEditModal = (approval: Approval) => {
    setEditingId(approval.id);
    setFormData({
      type: approval.type,
      title: approval.title,
      clientName: approval.clientName,
      status: approval.status,
    });
    setShowModal(true);
  };

  const handleSubmit = async () => {
    if (!formData.type || !formData.title || !formData.clientName || !formData.status) {
      toast('אנא מלא את כל השדות', 'error');
      return;
    }

    try {
      if (editingId) {
        await update(editingId, {
          type: formData.type as Approval['type'],
          title: formData.title,
          clientName: formData.clientName,
          status: formData.status as Approval['status'],
        });
        toast('האישור עודכן בהצלחה', 'success');
      } else {
        await create({
          type: formData.type as Approval['type'],
          title: formData.title,
          clientName: formData.clientName,
          status: formData.status as Approval['status'],
        });
        toast('האישור נוצר בהצלחה', 'success');
      }
      setShowModal(false);
      setFormData({ type: '', title: '', clientName: '', status: '' });
    } catch (error) {
      toast('אירעה שגיאה בעדכון האישור', 'error');
    }
  };

  const handleApprove = async (id: string) => {
    try {
      await update(id, { status: 'approved' });
      toast('האישור אושר בהצלחה', 'success');
      fireConfetti(30);
    } catch (error) {
      toast('שגיאה בעדכון הסטטוס', 'error');
    }
  };

  const handleReject = async (id: string) => {
    try {
      await update(id, { status: 'rejected' });
      toast('האישור נדחה בהצלחה', 'success');
    } catch (error) {
      toast('שגיאה בעדכון הסטטוס', 'error');
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm('האם אתה בטוח שברצונך למחוק אישור זה?')) {
      try {
        await remove(id);
        toast('האישור הוסר בהצלחה', 'success');
      } catch (error) {
        toast('שגיאה במחיקת האישור', 'error');
      }
    }
  };

  return (
    <div dir="rtl" className="apr-page">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2rem', borderBottom: '1px solid var(--border)', paddingBottom: '1rem' }}>
        <div>
          <h1 className="mod-page-title">מערכת אישורים</h1>
          <p style={{ fontSize: '0.8rem', color: 'var(--foreground-muted)', marginTop: '0.25rem' }}>
            ניהול בקשות אישור — תוכן, גאנטים, עיצובים ופעולות שדורשות אישור
          </p>
        </div>
        <button className="mod-btn-primary ux-btn ux-btn-glow" onClick={openCreateModal}>
          + אישור חדש
        </button>
      </div>

      {/* KPI Row */}
      <div className="apr-kpi-row">
        {kpis.map((kpi) => (
          <div key={kpi.label} className="apr-kpi">
            <div className="apr-kpi-val">
              {kpi.value}
            </div>
            <div className="apr-kpi-label">
              {kpi.label}
            </div>
          </div>
        ))}
      </div>

      {/* Approvals Grid */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--foreground-muted)' }}>
          טוען אישורים...
        </div>
      ) : approvals.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--foreground-muted)' }}>
          אין אישורים להצגה
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', marginTop: '1rem' }}>
          {/* Group by status — pending first */}
          {(['pending_approval', 'needs_changes', 'draft', 'approved', 'rejected'] as const).map(statusGroup => {
            const groupApprovals = approvals.filter(a => a.status === statusGroup);
            if (groupApprovals.length === 0) return null;
            const statusColor = STATUS_COLORS[statusGroup] || '#6b7280';
            return (
              <div key={statusGroup}>
                <div style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: '0.75rem', color: statusColor, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  {STATUS_LABELS[statusGroup]} ({groupApprovals.length})
                </div>
                <div className="apr-board ux-stagger">
                  {groupApprovals.map((approval) => {
                    const typeInfo = TYPE_LABELS[approval.type] || { label: approval.type, emoji: '📄', color: '#6b7280' };
                    const stColor = STATUS_COLORS[approval.status] || '#6b7280';
                    return (
                      <div key={approval.id} className="apr-card premium-card ux-stagger-item" style={{ borderRight: `3px solid ${stColor}` }}>
                        {/* Card Header */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                          <span style={{
                            display: 'inline-flex', alignItems: 'center', gap: '0.3rem',
                            fontSize: '0.7rem', fontWeight: 600, padding: '0.2rem 0.5rem',
                            borderRadius: '0.25rem', background: `${typeInfo.color}15`, color: typeInfo.color,
                            border: `1px solid ${typeInfo.color}30`,
                          }}>
                            {typeInfo.emoji} {typeInfo.label}
                          </span>
                          <span style={{
                            fontSize: '0.65rem', fontWeight: 600, padding: '0.2rem 0.5rem',
                            borderRadius: '0.25rem', background: `${stColor}15`, color: stColor,
                          }}>
                            {STATUS_LABELS[approval.status]}
                          </span>
                        </div>

                        {/* Card Title — click to open full review (for task approvals) */}
                        <h3 className="apr-card-title" style={{ marginBottom: '0.35rem', cursor: (approval as any).taskId ? 'pointer' : 'default', color: (approval as any).taskId ? 'var(--accent-text, #00B5FE)' : undefined }}
                          onClick={() => (approval as any).taskId && openTaskApproval(approval)}>
                          {approval.title} {(approval as any).taskId ? '↗' : ''}
                        </h3>

                        {/* Client Name */}
                        <p className="apr-card-desc" style={{ marginBottom: '0.75rem' }}>
                          {approval.clientName}
                        </p>

                        {/* Meta Info */}
                        <div style={{
                          fontSize: '0.72rem',
                          color: 'var(--foreground-subtle)',
                          marginBottom: '0.75rem',
                          borderTop: '1px solid var(--border)',
                          paddingTop: '0.6rem',
                          display: 'flex',
                          justifyContent: 'space-between',
                        }}>
                          <span>נוצר: {new Date(approval.createdAt).toLocaleDateString('he-IL')}</span>
                          <span>עודכן: {new Date(approval.updatedAt).toLocaleDateString('he-IL')}</span>
                        </div>

                        {/* Action Buttons */}
                        <div className="apr-actions" style={{ justifyContent: 'flex-start' }}>
                          {approval.status === 'pending_approval' && (
                            <>
                              <button
                                className="mod-btn-primary ux-btn ux-btn-glow"
                                onClick={() => handleApprove(approval.id)}
                                style={{ fontSize: '0.8rem', padding: '0.4rem 0.75rem' }}
                              >
                                אישור
                              </button>
                              <button
                                className="mod-btn-ghost ux-btn"
                                onClick={() => handleReject(approval.id)}
                                style={{ fontSize: '0.8rem', padding: '0.4rem 0.75rem', color: '#ef4444' }}
                              >
                                דחייה
                              </button>
                            </>
                          )}
                          <button
                            className="mod-btn-ghost ux-btn"
                            onClick={() => openEditModal(approval)}
                            style={{ fontSize: '0.8rem', padding: '0.4rem 0.75rem' }}
                          >
                            עריכה
                          </button>
                          <button
                            className="mod-btn-ghost ux-btn"
                            onClick={() => handleDelete(approval.id)}
                            style={{ fontSize: '0.8rem', padding: '0.4rem 0.75rem', color: '#ef4444' }}
                          >
                            מחיקה
                          </button>
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

      {/* ── Campaign Actions Queue ─────────────────────────────────── */}
      {!actionsLoading && campaignActionsData.length > 0 && (
        <div style={{ marginTop: '2.5rem', borderTop: '2px solid var(--border)', paddingTop: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <div>
              <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--foreground)', margin: 0 }}>
                🤖 פעולות קמפיין — מנוע אופטימיזציה
              </h2>
              <p style={{ fontSize: '0.75rem', color: 'var(--foreground-muted)', marginTop: '0.2rem' }}>
                פעולות שנוצרו מתוך המלצות AI — אשרו, דחו, או בצעו
              </p>
            </div>
            <div style={{ display: 'flex', gap: '0.75rem', fontSize: '0.75rem', alignItems: 'center' }}>
              <span style={{ color: '#f59e0b', fontWeight: 600 }}>⏳ {pendingActions.length} ממתינים</span>
              <span style={{ color: '#22c55e', fontWeight: 600 }}>✅ {approvedActions.length} מאושרים</span>
              <span style={{ color: '#6b7280', fontWeight: 600 }}>📦 {completedActions.length} הושלמו</span>
              {/* Role toggle */}
              <select
                value={userRole}
                onChange={e => setUserRole(e.target.value as 'admin' | 'client' | 'employee')}
                style={{ fontSize: '0.7rem', padding: '0.2rem 0.4rem', borderRadius: '0.25rem', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--foreground)', marginRight: '0.5rem' }}
              >
                <option value="admin">תפקיד: מנהל</option>
                <option value="client">תפקיד: לקוח</option>
                <option value="employee">תפקיד: עובד</option>
              </select>
            </div>
          </div>

          {/* Pending Actions */}
          {pendingActions.length > 0 && (
            <div style={{ marginBottom: '1.5rem' }}>
              <div style={{ fontSize: '0.85rem', fontWeight: 700, marginBottom: '0.5rem', color: '#f59e0b' }}>
                ממתינים לאישור ({pendingActions.length})
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '0.75rem' }}>
                {pendingActions.map(act => {
                  const meta = ACTION_TYPE_META[act.type] || { icon: '⚙️', label: act.type, color: '#6b7280', description: '' };
                  return (
                    <div key={act.id} className="premium-card" style={{ padding: '1rem', borderRight: `3px solid ${meta.color}` }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                        <span style={{ fontSize: '0.75rem', fontWeight: 600, color: meta.color }}>
                          {meta.icon} {meta.label}
                        </span>
                        <span style={{ fontSize: '0.65rem', color: 'var(--foreground-muted)' }}>
                          {act.clientName}
                        </span>
                      </div>

                      {/* Title + Description */}
                      {act.title && (
                        <p style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--foreground)', marginBottom: '0.2rem' }}>
                          {act.title}
                        </p>
                      )}
                      <p style={{ fontSize: '0.78rem', color: 'var(--foreground)', marginBottom: '0.35rem' }}>
                        {act.description}
                      </p>
                      <p style={{ fontSize: '0.72rem', color: 'var(--foreground-muted)', marginBottom: '0.5rem' }}>
                        קמפיין: {act.campaignName}
                      </p>

                      {/* Before / After Preview */}
                      {(act.previewBefore || act.previewAfter) && (
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginBottom: '0.75rem' }}>
                          <div style={{ padding: '0.4rem 0.5rem', borderRadius: '0.25rem', background: 'rgba(239,68,68,0.06)', fontSize: '0.68rem', color: 'var(--foreground-muted)' }}>
                            <div style={{ fontWeight: 600, marginBottom: '0.15rem', color: '#ef4444' }}>לפני:</div>
                            {act.previewBefore || '—'}
                          </div>
                          <div style={{ padding: '0.4rem 0.5rem', borderRadius: '0.25rem', background: 'rgba(34,197,94,0.06)', fontSize: '0.68rem', color: 'var(--foreground-muted)' }}>
                            <div style={{ fontWeight: 600, marginBottom: '0.15rem', color: '#22c55e' }}>אחרי:</div>
                            {act.previewAfter || '—'}
                          </div>
                        </div>
                      )}

                      {/* Internal-only label */}
                      <div style={{
                        fontSize: '0.65rem', color: '#a855f7', fontWeight: 600,
                        marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.3rem',
                      }}>
                        <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#a855f7', display: 'inline-block' }} />
                        פעולה פנימית — טרם פורסם למטא
                      </div>

                      {/* Action Buttons — role-based */}
                      <div style={{ display: 'flex', gap: '0.4rem' }}>
                        <button
                          className="mod-btn-primary ux-btn"
                          onClick={() => handleActionDecision(act.id, 'approve')}
                          style={{ fontSize: '0.75rem', padding: '0.35rem 0.65rem' }}
                        >
                          ✅ אישור
                        </button>
                        <button
                          className="mod-btn-ghost ux-btn"
                          onClick={() => {
                            const reason = prompt('סיבת דחייה:');
                            if (reason !== null) handleActionDecision(act.id, 'reject', reason);
                          }}
                          style={{ fontSize: '0.75rem', padding: '0.35rem 0.65rem', color: '#ef4444' }}
                        >
                          ❌ דחייה
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Approved — ready to execute */}
          {approvedActions.length > 0 && (
            <div style={{ marginBottom: '1.5rem' }}>
              <div style={{ fontSize: '0.85rem', fontWeight: 700, marginBottom: '0.5rem', color: '#22c55e' }}>
                מאושרים — מוכנים לביצוע ({approvedActions.length})
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '0.75rem' }}>
                {approvedActions.map(act => {
                  const meta = ACTION_TYPE_META[act.type] || { icon: '⚙️', label: act.type, color: '#6b7280', description: '' };
                  return (
                    <div key={act.id} className="premium-card" style={{ padding: '1rem', borderRight: `3px solid #22c55e` }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                        <span style={{ fontSize: '0.75rem', fontWeight: 600, color: meta.color }}>
                          {meta.icon} {meta.label}
                        </span>
                        <span style={{ fontSize: '0.65rem', padding: '0.15rem 0.4rem', borderRadius: '0.2rem', background: 'rgba(34,197,94,0.1)', color: '#22c55e', fontWeight: 600 }}>
                          מאושר
                        </span>
                      </div>
                      {act.title && (
                        <p style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--foreground)', marginBottom: '0.2rem' }}>
                          {act.title}
                        </p>
                      )}
                      <p style={{ fontSize: '0.8rem', color: 'var(--foreground)', marginBottom: '0.35rem' }}>
                        {act.description}
                      </p>
                      {act.approvedBy && (
                        <p style={{ fontSize: '0.68rem', color: 'var(--foreground-muted)', marginBottom: '0.35rem' }}>
                          אושר ע&quot;י: {act.approvedBy} • {act.approvedAt ? new Date(act.approvedAt).toLocaleDateString('he-IL') : ''}
                        </p>
                      )}
                      {/* Internal-only label */}
                      <div style={{
                        fontSize: '0.65rem', color: '#a855f7', fontWeight: 600,
                        marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.3rem',
                      }}>
                        <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#a855f7', display: 'inline-block' }} />
                        פעולה פנימית — טרם פורסם למטא
                      </div>
                      {/* Only admin/employee can execute — client sees "ממתין לביצוע" */}
                      {userRole === 'client' ? (
                        <p style={{ fontSize: '0.72rem', color: '#f59e0b', fontWeight: 600, marginTop: '0.3rem' }}>
                          ⏳ ממתין לביצוע על ידי מנהל
                        </p>
                      ) : (
                        <button
                          className="mod-btn-primary ux-btn ux-btn-glow"
                          onClick={() => handleActionDecision(act.id, 'execute')}
                          style={{ fontSize: '0.75rem', padding: '0.35rem 0.85rem', marginTop: '0.3rem' }}
                        >
                          🚀 בצע עכשיו
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Completed Actions (collapsed) */}
          {completedActions.length > 0 && (
            <details style={{ marginTop: '0.5rem' }}>
              <summary style={{ fontSize: '0.8rem', color: 'var(--foreground-muted)', cursor: 'pointer', fontWeight: 600 }}>
                היסטוריה ({completedActions.length})
              </summary>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '0.5rem', marginTop: '0.5rem' }}>
                {completedActions.slice(0, 10).map(act => {
                  const meta = ACTION_TYPE_META[act.type] || { icon: '⚙️', label: act.type, color: '#6b7280', description: '' };
                  const stMeta = ACTION_STATUS_META[act.status] || { label: act.status, color: '#6b7280', bgColor: 'transparent' };
                  return (
                    <div key={act.id} className="premium-card" style={{ padding: '0.75rem', opacity: 0.7 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.72rem', color: meta.color }}>{meta.icon} {meta.label}</span>
                        <span style={{ fontSize: '0.65rem', padding: '0.1rem 0.35rem', borderRadius: '0.2rem', background: stMeta.bgColor, color: stMeta.color, fontWeight: 600 }}>
                          {stMeta.label}
                        </span>
                      </div>
                      {act.title && (
                        <p style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--foreground)', marginTop: '0.25rem' }}>{act.title}</p>
                      )}
                      <p style={{ fontSize: '0.72rem', color: 'var(--foreground-muted)', marginTop: '0.15rem' }}>{act.description}</p>
                      {act.status === 'rejected' && act.rejectionReason && (
                        <p style={{ fontSize: '0.68rem', color: '#ef4444', marginTop: '0.2rem' }}>
                          סיבת דחייה: {act.rejectionReason}
                        </p>
                      )}
                      {act.status === 'failed' && act.failedReason && (
                        <p style={{ fontSize: '0.68rem', color: '#dc2626', marginTop: '0.2rem' }}>
                          סיבת כשלון: {act.failedReason}
                        </p>
                      )}
                      <p style={{ fontSize: '0.65rem', color: 'var(--foreground-subtle)', marginTop: '0.15rem' }}>
                        {new Date(act.updatedAt).toLocaleDateString('he-IL')} {new Date(act.updatedAt).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  );
                })}
              </div>
            </details>
          )}
        </div>
      )}

      {/* Task-approval detail — preview + approve / return-for-fixing */}
      {detail && (
        <Modal open={!!detail} onClose={() => setDetail(null)} title={`בדיקת משימה — ${detail.approval.title}`}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', maxHeight: '70vh', overflowY: 'auto' }}>
            {!detail.task ? (
              <div style={{ color: 'var(--foreground-muted)', fontSize: 13 }}>המשימה המקושרת לא נמצאה (ייתכן שנמחקה).</div>
            ) : (
              <>
                {(() => {
                  const t = detail.task;
                  const ct = t.contentType ? ({ post: '🖼️ פוסט', story: '📱 סטורי', reel: '🎬 רילס' } as any)[t.contentType] : null;
                  const files: string[] = submittedOf(t);
                  const images = files.map(parseFileEntry).filter((e) => isImageUrl(e.url));
                  const others = files.map(parseFileEntry).filter((e) => !isImageUrl(e.url));
                  return (
                    <>
                      {ct && <span style={{ alignSelf: 'flex-start', fontSize: 13, fontWeight: 800, color: '#7c3aed', background: 'rgba(124,58,237,0.1)', padding: '0.3rem 0.8rem', borderRadius: 999 }}>{ct}</span>}
                      <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--foreground)' }}>{t.title}</div>
                      {t.clientName && <div style={{ fontSize: 13, color: 'var(--foreground-muted)' }}>לקוח: {t.clientName}</div>}
                      {t.description && <div style={{ fontSize: 13, color: 'var(--foreground)', whiteSpace: 'pre-wrap', background: 'var(--surface)', borderRadius: 10, padding: '0.75rem' }}>{t.description}</div>}

                      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--foreground)' }}>קבצים שהוגשו ({files.length}):</div>
                      {images.length > 0 && (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 10 }}>
                          {images.map((im, i) => (
                            <a key={i} href={im.url} target="_blank" rel="noopener noreferrer" style={{ display: 'block', borderRadius: 10, overflow: 'hidden', border: '1px solid var(--border)' }}>
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={im.url} alt={im.name} style={{ width: '100%', height: 140, objectFit: 'cover', display: 'block' }} />
                            </a>
                          ))}
                        </div>
                      )}
                      {others.map((o, i) => (
                        <a key={i} href={o.url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 13, color: 'var(--accent-text,#00B5FE)' }}>📎 {o.name}</a>
                      ))}
                      {files.length === 0 && <div style={{ fontSize: 13, color: 'var(--foreground-muted)' }}>אין קבצים מצורפים.</div>}
                    </>
                  );
                })()}

                {showReturnBox ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <textarea className="form-input ux-input" rows={3} value={returnNotes} onChange={(e) => setReturnNotes(e.target.value)} placeholder="כתוב מה צריך לתקן…" style={{ resize: 'vertical', fontSize: 13 }} />
                    <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                      <button className="mod-btn-ghost ux-btn" onClick={() => setShowReturnBox(false)} disabled={!!processing}>ביטול</button>
                      <button className="mod-btn-primary ux-btn" onClick={returnTaskFlow} disabled={!!processing || !returnNotes.trim()} style={{ background: '#f97316' }}>{processing || 'שלח הערות והחזר לתיקון'}</button>
                    </div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', borderTop: '1px solid var(--border)', paddingTop: 12 }}>
                    <button className="mod-btn-ghost ux-btn" onClick={() => setShowReturnBox(true)} disabled={!!processing} style={{ color: '#f97316', borderColor: 'rgba(249,115,22,0.3)' }}>🔧 החזר לתיקון</button>
                    <button className="mod-btn-primary ux-btn ux-btn-glow" onClick={approveTaskFlow} disabled={!!processing} style={{ background: '#22c55e', fontWeight: 800 }}>
                      {processing || '✓ אשר + התאם גדלים אוטומטית'}
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </Modal>
      )}

      {/* Modal */}
      {showModal && (
        <Modal open={showModal} onClose={() => setShowModal(false)} title={editingId ? 'עריכת אישור' : 'אישור חדש'}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {/* Type Select */}
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600', color: 'var(--foreground)' }}>
                סוג
              </label>
              <select
                className="form-select ux-chip"
                value={formData.type}
                onChange={(e) => setFormData({ ...formData, type: e.target.value as any })}
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  border: '1px solid var(--border)',
                  borderRadius: '0.375rem',
                  fontFamily: 'inherit',
                  background: 'var(--surface)',
                  color: 'var(--foreground)',
                }}
              >
                <option value="">בחר סוג</option>
                {TYPE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Title Input */}
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600', color: 'var(--foreground)' }}>
                כותרת
              </label>
              <input
                className="form-input ux-input"
                type="text"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="הזן כותרת"
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  border: '1px solid var(--border)',
                  borderRadius: '0.375rem',
                  fontFamily: 'inherit',
                  background: 'var(--surface)',
                  color: 'var(--foreground)',
                }}
              />
            </div>

            {/* Client Name Input */}
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600', color: 'var(--foreground)' }}>
                שם לקוח
              </label>
              <input
                className="form-input ux-input"
                type="text"
                value={formData.clientName}
                onChange={(e) => setFormData({ ...formData, clientName: e.target.value })}
                placeholder="הזן שם לקוח"
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  border: '1px solid var(--border)',
                  borderRadius: '0.375rem',
                  fontFamily: 'inherit',
                  background: 'var(--surface)',
                  color: 'var(--foreground)',
                }}
              />
            </div>

            {/* Status Select */}
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600', color: 'var(--foreground)' }}>
                סטטוס
              </label>
              <select
                className="form-select ux-chip"
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  border: '1px solid var(--border)',
                  borderRadius: '0.375rem',
                  fontFamily: 'inherit',
                  background: 'var(--surface)',
                  color: 'var(--foreground)',
                }}
              >
                <option value="">בחר סטטוס</option>
                {STATUS_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Modal Actions */}
            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', marginTop: '1rem' }}>
              <button
                className="mod-btn-ghost ux-btn"
                onClick={() => setShowModal(false)}
                style={{ padding: '0.5rem 1rem' }}
              >
                ביטול
              </button>
              <button
                className="mod-btn-primary ux-btn ux-btn-glow"
                onClick={handleSubmit}
                style={{ padding: '0.5rem 1rem' }}
              >
                {editingId ? 'עדכן' : 'צור'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
