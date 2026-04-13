'use client';

import { useState } from 'react';
import { useApprovals } from '@/lib/api/use-entity';
import { useToast } from '@/components/ui/toast';
import { Modal } from '@/components/ui/modal';
import type { Approval } from '@/lib/db/schema';

const STATUS_LABELS: Record<string, string> = {
  draft: 'טיוטה',
  pending_approval: 'ממתין לאישור',
  approved: 'אושר',
  rejected: 'נדחה',
  needs_changes: 'דורש שינויים',
};

const STATUS_COLORS: Record<string, string> = {
  draft: '#6b7280',
  pending_approval: '#fbbf24',
  approved: '#22c55e',
  rejected: '#f87171',
  needs_changes: '#f59e0b',
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
        <button className="mod-btn-primary" onClick={openCreateModal}>
          + אישור חדש
        </button>
      </div>

      {/* KPI Row */}
      <div className="apr-kpi-row">
        {kpis.map((kpi) => (
          <div key={kpi.label} className="apr-kpi" style={{
            padding: '1.5rem',
            backgroundColor: '#f3f4f6',
            borderRadius: '0.5rem',
            textAlign: 'center',
            minWidth: '120px',
          }}>
            <div className="apr-kpi-val" style={{ fontSize: '2rem', fontWeight: 'bold', color: '#1f2937' }}>
              {kpi.value}
            </div>
            <div className="apr-kpi-label" style={{ fontSize: '0.875rem', color: '#6b7280', marginTop: '0.5rem' }}>
              {kpi.label}
            </div>
          </div>
        ))}
      </div>

      {/* Approvals Grid */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: '#6b7280' }}>
          טוען אישורים...
        </div>
      ) : approvals.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: '#6b7280' }}>
          אין אישורים להצגה
        </div>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
          gap: '1.5rem',
          marginTop: '2rem',
        }}>
          {approvals.map((approval) => (
            <div
              key={approval.id}
              className="agd-card"
              style={{
                border: '1px solid #e5e7eb',
                borderRadius: '0.5rem',
                padding: '1.5rem',
                backgroundColor: '#fff',
                boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
              }}
            >
              {/* Card Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                <span
                  style={{
                    backgroundColor: '#e5e7eb',
                    color: '#374151',
                    padding: '0.25rem 0.75rem',
                    borderRadius: '0.25rem',
                    fontSize: '0.75rem',
                    fontWeight: '600',
                  }}
                >
                  {TYPE_LABELS[approval.type] || approval.type}
                </span>
                <span
                  style={{
                    backgroundColor: STATUS_COLORS[approval.status],
                    color: '#fff',
                    padding: '0.25rem 0.75rem',
                    borderRadius: '0.25rem',
                    fontSize: '0.75rem',
                    fontWeight: '600',
                  }}
                >
                  {STATUS_LABELS[approval.status]}
                </span>
              </div>

              {/* Card Title */}
              <h3 style={{
                fontSize: '1.125rem',
                fontWeight: '600',
                color: '#1f2937',
                marginBottom: '0.5rem',
              }}>
                {approval.title}
              </h3>

              {/* Client Name */}
              <p style={{
                fontSize: '0.875rem',
                color: '#6b7280',
                marginBottom: '1rem',
              }}>
                {approval.clientName}
              </p>

              {/* Meta Info */}
              <div style={{
                fontSize: '0.75rem',
                color: '#9ca3af',
                marginBottom: '1rem',
                borderTop: '1px solid #e5e7eb',
                paddingTop: '0.75rem',
              }}>
                <div>עדכון אחרון: {new Date(approval.updatedAt).toLocaleDateString('he-IL')}</div>
              </div>

              {/* Action Buttons */}
              <div style={{
                display: 'flex',
                gap: '0.5rem',
                flexWrap: 'wrap',
              }}>
                {approval.status === 'pending_approval' && (
                  <>
                    <button
                      className="mod-btn-primary"
                      onClick={() => handleApprove(approval.id)}
                      style={{ flex: '1', minWidth: '80px', fontSize: '0.875rem', padding: '0.5rem' }}
                    >
                      אישור
                    </button>
                    <button
                      className="mod-btn-ghost"
                      onClick={() => handleReject(approval.id)}
                      style={{ flex: '1', minWidth: '80px', fontSize: '0.875rem', padding: '0.5rem', color: '#ef4444', borderColor: '#fecaca' }}
                    >
                      דחייה
                    </button>
                  </>
                )}
                <button
                  className="mod-btn-ghost"
                  onClick={() => openEditModal(approval)}
                  style={{ flex: '1', minWidth: '80px', fontSize: '0.875rem', padding: '0.5rem' }}
                >
                  עריכה
                </button>
                <button
                  className="mod-btn-ghost"
                  onClick={() => handleDelete(approval.id)}
                  style={{ flex: '1', minWidth: '80px', fontSize: '0.875rem', padding: '0.5rem', color: '#ef4444', borderColor: '#fecaca' }}
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
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600', color: '#374151' }}>
                סוג
              </label>
              <select
                className="form-select"
                value={formData.type}
                onChange={(e) => setFormData({ ...formData, type: e.target.value as any })}
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  border: '1px solid #d1d5db',
                  borderRadius: '0.375rem',
                  fontFamily: 'inherit',
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
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600', color: '#374151' }}>
                כותרת
              </label>
              <input
                className="form-input"
                type="text"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="הזן כותרת"
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  border: '1px solid #d1d5db',
                  borderRadius: '0.375rem',
                  fontFamily: 'inherit',
                }}
              />
            </div>

            {/* Client Name Input */}
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600', color: '#374151' }}>
                שם לקוח
              </label>
              <input
                className="form-input"
                type="text"
                value={formData.clientName}
                onChange={(e) => setFormData({ ...formData, clientName: e.target.value })}
                placeholder="הזן שם לקוח"
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  border: '1px solid #d1d5db',
                  borderRadius: '0.375rem',
                  fontFamily: 'inherit',
                }}
              />
            </div>

            {/* Status Select */}
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600', color: '#374151' }}>
                סטטוס
              </label>
              <select
                className="form-select"
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  border: '1px solid #d1d5db',
                  borderRadius: '0.375rem',
                  fontFamily: 'inherit',
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
                className="mod-btn-ghost"
                onClick={() => setShowModal(false)}
                style={{ padding: '0.5rem 1rem' }}
              >
                ביטול
              </button>
              <button
                className="mod-btn-primary"
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
