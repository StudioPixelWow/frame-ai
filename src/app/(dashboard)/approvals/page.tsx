'use client';

import { useState } from 'react';
import { useApprovals } from '@/lib/api/use-entity';
import { useToast } from '@/components/ui/toast';
import { Modal } from '@/components/ui/modal';
import type { Approval } from '@/lib/db/schema';
import { fireConfetti } from '@/lib/confetti';

const STATUS_LABELS: Record<string, string> = {
  draft: 'טיוטה',
  pending_approval: 'ממתין לאישור',
  approved: 'אושר',
  rejected: 'נדחה',
  needs_changes: 'דורש שינויים',
};

const TYPE_LABELS: Record<string, string> = {
  video: 'וידאו',
  post: 'פוסט',
  gantt: 'גאנט',
  design: 'עיצוב',
  milestone: 'אבן דרך',
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
  const toast = useToast();
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<FormData>({
    type: '',
    title: '',
    clientName: '',
    status: '',
  });

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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <h1 className="mod-page-title">מערכת אישורים</h1>
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
        <div className="apr-board ux-stagger" style={{ marginTop: '1rem' }}>
          {approvals.map((approval) => (
            <div key={approval.id} className="apr-card premium-card ux-stagger-item">
              {/* Card Header */}
              <div className="apr-card-header" style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                <span className={`apr-type-badge apr-st-${approval.status}`}>
                  {TYPE_LABELS[approval.type] || approval.type}
                </span>
                <span className={`apr-type-badge apr-st-${approval.status}`}>
                  {STATUS_LABELS[approval.status]}
                </span>
              </div>

              {/* Card Title */}
              <h3 className="apr-card-title" style={{ marginBottom: '0.35rem' }}>
                {approval.title}
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
              }}>
                <div>עדכון אחרון: {new Date(approval.updatedAt).toLocaleDateString('he-IL')}</div>
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
          ))}
        </div>
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
