'use client';

import { useState, useMemo, useCallback } from 'react';
import { useClients, useEmployees, useMailings, useEmailTemplates } from '@/lib/api/use-entity';
import { useToast } from '@/components/ui/toast';
import type { Mailing, MailingStatus, Client, EmailTemplate } from '@/lib/db/schema';

const MAILING_STATUS_LABELS: Record<MailingStatus, string> = {
  draft: 'טיוטה',
  scheduled: 'מתוזמן',
  sending: 'בשליחה',
  sent: 'נשלח',
  failed: 'נכשל',
};

const MAILING_STATUS_COLORS: Record<MailingStatus, string> = {
  draft: '#6b7280',
  scheduled: '#8b5cf6',
  sending: '#3b82f6',
  sent: '#22c55e',
  failed: '#ef4444',
};

const CLIENT_TYPE_OPTIONS = [
  { value: 'marketing', label: 'פרסום ושיווק' },
  { value: 'branding', label: 'מיתוג' },
  { value: 'websites', label: 'בניית אתרים' },
  { value: 'podcast', label: 'פודקאסט' },
  { value: 'hosting', label: 'אחסון' },
];

const PAYMENT_STATUS_OPTIONS = [
  { value: 'current', label: 'עדכני' },
  { value: 'overdue', label: 'דריסה' },
  { value: 'pending', label: 'בהמתנה' },
];

interface FormState {
  subject: string;
  body: string;
  recipientFilterType: 'all' | 'by_client_type' | 'by_employee' | 'by_payment_status' | 'by_portal' | 'manual';
  selectedClientTypes: string[];
  selectedEmployeeId: string;
  selectedPaymentStatus: string;
  selectedManualClientIds: string[];
  scheduleEnabled: boolean;
  scheduledDate: string;
  scheduledTime: string;
}

const EMPTY_FORM: FormState = {
  subject: '',
  body: '',
  recipientFilterType: 'all',
  selectedClientTypes: [],
  selectedEmployeeId: '',
  selectedPaymentStatus: '',
  selectedManualClientIds: [],
  scheduleEnabled: false,
  scheduledDate: '',
  scheduledTime: '',
};

export default function MailingPage() {
  const { data: allClients } = useClients();
  const { data: allEmployees } = useEmployees();
  const { data: allMailings, refetch: refetchMailings, create: createMailing, update: updateMailing } = useMailings();
  const { data: allTemplates, create: createTemplate, update: updateTemplate } = useEmailTemplates();
  const toast = useToast();

  const [activeTab, setActiveTab] = useState<'new' | 'scheduled' | 'sent' | 'templates'>('new');
  const [formState, setFormState] = useState<FormState>(EMPTY_FORM);
  const [templates, setTemplates] = useState<EmailTemplate[]>(allTemplates || []);
  const [showSaveTemplateModal, setShowSaveTemplateModal] = useState(false);
  const [templateNameInput, setTemplateNameInput] = useState('');

  const activeClients = useMemo(() => allClients?.filter(c => c.status === 'active') || [], [allClients]);

  const recipientCount = useMemo(() => {
    if (!activeClients.length) return 0;

    let filtered = activeClients;

    if (formState.recipientFilterType === 'all') {
      return filtered.length;
    }

    if (formState.recipientFilterType === 'by_client_type' && formState.selectedClientTypes.length > 0) {
      filtered = filtered.filter(c => formState.selectedClientTypes.includes(c.clientType));
      return filtered.length;
    }

    if (formState.recipientFilterType === 'by_employee' && formState.selectedEmployeeId) {
      filtered = filtered.filter(c => c.assignedManagerId === formState.selectedEmployeeId);
      return filtered.length;
    }

    if (formState.recipientFilterType === 'by_payment_status' && formState.selectedPaymentStatus) {
      filtered = filtered.filter(c => c.paymentStatus === formState.selectedPaymentStatus);
      return filtered.length;
    }

    if (formState.recipientFilterType === 'by_portal') {
      filtered = filtered.filter(c => c.portalEnabled);
      return filtered.length;
    }

    if (formState.recipientFilterType === 'manual' && formState.selectedManualClientIds.length > 0) {
      return formState.selectedManualClientIds.length;
    }

    return filtered.length;
  }, [formState, activeClients]);

  const handleCreateMailing = useCallback(async (sendNow: boolean) => {
    if (!formState.subject.trim()) {
      toast('נא הזן נושא', 'error');
      return;
    }

    if (!formState.body.trim()) {
      toast('נא הזן גוף הודעה', 'error');
      return;
    }

    if (recipientCount === 0) {
      toast('לא נבחרו מקבלים', 'error');
      return;
    }

    if (!sendNow && formState.scheduleEnabled) {
      if (!formState.scheduledDate || !formState.scheduledTime) {
        toast('נא בחר תאריך וזמן', 'error');
        return;
      }
    }

    const now = new Date();
    const scheduledDateTime = formState.scheduleEnabled
      ? `${formState.scheduledDate}T${formState.scheduledTime}`
      : null;

    const newMailing: Mailing = {
      id: `mai_${Date.now()}`,
      subject: formState.subject,
      body: formState.body,
      recipientFilter: {
        type: formState.recipientFilterType,
        clientTypes: formState.recipientFilterType === 'by_client_type' ? formState.selectedClientTypes : undefined,
        employeeId: formState.recipientFilterType === 'by_employee' ? formState.selectedEmployeeId : undefined,
        paymentStatus: formState.recipientFilterType === 'by_payment_status' ? formState.selectedPaymentStatus : undefined,
        portalEnabled: formState.recipientFilterType === 'by_portal' ? true : undefined,
        manualClientIds: formState.recipientFilterType === 'manual' ? formState.selectedManualClientIds : undefined,
      },
      recipientCount,
      status: sendNow ? 'sent' : (formState.scheduleEnabled ? 'scheduled' : 'draft'),
      scheduledAt: scheduledDateTime,
      sentAt: sendNow ? now.toISOString() : null,
      templateId: null,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    };

    try {
      await createMailing(newMailing as any);

      toast(
        sendNow ? 'דיוור נשלח בהצלחה!' : (formState.scheduleEnabled ? 'דיוור תוזמן בהצלחה!' : 'דיוור שמור כטיוטה'),
        'success'
      );

      setFormState(EMPTY_FORM);
      refetchMailings();
    } catch (error) {
      toast('שגיאה ביצירת הדיוור', 'error');
    }
  }, [formState, recipientCount, toast, refetchMailings, createMailing]);

  const handleSaveTemplate = useCallback(async () => {
    if (!templateNameInput.trim()) {
      toast('נא הזן שם תבנית', 'error');
      return;
    }

    const newTemplate: EmailTemplate = {
      id: `emt_${Date.now()}`,
      name: templateNameInput,
      type: 'general',
      subject: formState.subject,
      bodyHtml: formState.body,
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    try {
      await createTemplate(newTemplate as any);

      toast('תבנית נשמרה בהצלחה!', 'success');
      setTemplates([...templates, newTemplate]);
      setShowSaveTemplateModal(false);
      setTemplateNameInput('');
    } catch (error) {
      toast('שגיאה בשמירת התבנית', 'error');
    }
  }, [formState, templateNameInput, templates, toast, createTemplate]);

  const handleUseTemplate = (template: EmailTemplate) => {
    setFormState(prev => ({
      ...prev,
      subject: template.subject,
      body: template.bodyHtml,
    }));
    toast('התבנית נטענה בהצלחה!', 'success');
  };

  const handleDeleteTemplate = async (templateId: string) => {
    try {
      const response = await fetch(`/api/data/email-templates/${templateId}`, {
        method: 'DELETE',
      });

      if (!response.ok) throw new Error('Failed to delete template');

      setTemplates(templates.filter(t => t.id !== templateId));
      toast('התבנית נמחקה בהצלחה!', 'success');
    } catch (error) {
      toast('שגיאה במחיקת התבנית', 'error');
    }
  };

  const scheduledMailings = useMemo(() => allMailings?.filter(m => m.status === 'scheduled') || [], [allMailings]);
  const sentMailings = useMemo(() => allMailings?.filter(m => m.status === 'sent') || [], [allMailings]);

  const formatRecipientFilter = (filter: Mailing['recipientFilter']): string => {
    if (filter.type === 'all') return 'כל הלקוחות הפעילים';
    if (filter.type === 'by_client_type') return `לפי סוג לקוח: ${filter.clientTypes?.join(', ') || ''}`;
    if (filter.type === 'by_employee') {
      const emp = allEmployees?.find(e => e.id === filter.employeeId);
      return `לפי עובד: ${emp?.name || ''}`;
    }
    if (filter.type === 'by_payment_status') return `לפי סטטוס תשלום: ${filter.paymentStatus}`;
    if (filter.type === 'by_portal') return 'לקוחות פורטל בלבד';
    if (filter.type === 'manual') return `בחירה ידנית (${filter.manualClientIds?.length || 0} לקוחות)`;
    return 'לא ידוע';
  };

  const handleCancelScheduled = async (mailingId: string) => {
    try {
      await updateMailing(mailingId, { status: 'draft' });

      toast('הדיוור בוטל בהצלחה!', 'success');
      refetchMailings();
    } catch (error) {
      toast('שגיאה בביטול הדיוור', 'error');
    }
  };

  return (
    <div style={{ direction: 'rtl', padding: '20px' }}>
      <style>{`
        .tab-button {
          padding: 10px 16px;
          border: none;
          border-radius: 8px;
          cursor: pointer;
          font-weight: 500;
          font-size: 14px;
          transition: all 0.2s;
          background: var(--surface);
          color: var(--foreground-muted);
          border: 1px solid var(--border);
          margin-right: 8px;
        }
        .tab-button.active {
          background: var(--accent);
          color: white;
          border-color: var(--accent);
        }
        .tab-button:hover {
          border-color: var(--accent);
        }

        .section {
          display: none;
        }
        .section.active {
          display: block;
        }

        .card {
          background: var(--surface-raised);
          border: 1px solid var(--border);
          border-radius: 12px;
          padding: 16px;
          margin-bottom: 16px;
        }

        .input-group {
          margin-bottom: 16px;
        }

        .input-label {
          display: block;
          font-size: 14px;
          font-weight: 500;
          color: var(--foreground);
          margin-bottom: 8px;
        }

        input[type="text"],
        input[type="date"],
        input[type="time"],
        textarea,
        select {
          width: 100%;
          padding: 10px 14px;
          border: 1px solid var(--border);
          border-radius: 8px;
          background: var(--surface);
          color: var(--foreground);
          font-family: inherit;
          font-size: 14px;
          box-sizing: border-box;
        }

        textarea {
          min-height: 200px;
          resize: vertical;
        }

        input[type="text"]:focus,
        textarea:focus,
        select:focus {
          outline: none;
          border-color: var(--accent);
          box-shadow: 0 0 0 3px rgba(0, 181, 254, 0.1);
        }

        .radio-group {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .radio-item {
          display: flex;
          align-items: center;
          gap: 8px;
          cursor: pointer;
        }

        input[type="radio"] {
          cursor: pointer;
        }

        .checkbox-group {
          display: flex;
          flex-direction: column;
          gap: 8px;
          margin-top: 8px;
          margin-right: 24px;
        }

        .checkbox-item {
          display: flex;
          align-items: center;
          gap: 8px;
          cursor: pointer;
        }

        input[type="checkbox"] {
          cursor: pointer;
        }

        .button {
          padding: 10px 16px;
          border: none;
          border-radius: 8px;
          cursor: pointer;
          font-weight: 500;
          font-size: 14px;
          transition: all 0.2s;
          background: var(--surface);
          color: var(--foreground);
          border: 1px solid var(--border);
        }

        .button:hover {
          background: var(--surface-raised);
        }

        .button.primary {
          background: var(--accent);
          color: white;
          border-color: var(--accent);
        }

        .button.primary:hover {
          opacity: 0.9;
        }

        .button.danger {
          background: #ef4444;
          color: white;
          border-color: #ef4444;
        }

        .button.danger:hover {
          opacity: 0.9;
        }

        .button-group {
          display: flex;
          gap: 8px;
          margin-top: 16px;
          justify-content: flex-start;
          flex-direction: row-reverse;
        }

        .status-badge {
          display: inline-block;
          padding: 4px 10px;
          border-radius: 6px;
          font-size: 12px;
          font-weight: 500;
          color: white;
        }

        .table {
          width: 100%;
          border-collapse: collapse;
        }

        .table th,
        .table td {
          padding: 12px;
          text-align: right;
          border-bottom: 1px solid var(--border);
          font-size: 14px;
        }

        .table th {
          background: var(--surface);
          font-weight: 600;
          color: var(--foreground);
        }

        .table tr:hover {
          background: var(--surface-raised);
        }

        .table td {
          color: var(--foreground);
        }

        .recipient-count {
          padding: 12px;
          background: var(--surface);
          border-radius: 8px;
          border: 1px solid var(--border);
          text-align: center;
          font-size: 14px;
          font-weight: 500;
          color: var(--foreground);
          margin-top: 16px;
        }

        .formatting-toolbar {
          display: flex;
          gap: 4px;
          margin-bottom: 8px;
        }

        .toolbar-button {
          padding: 6px 10px;
          border: 1px solid var(--border);
          background: var(--surface);
          border-radius: 6px;
          cursor: pointer;
          font-size: 12px;
          font-weight: 500;
          color: var(--foreground-muted);
          transition: all 0.2s;
        }

        .toolbar-button:hover {
          background: var(--surface-raised);
          color: var(--foreground);
        }

        .template-card {
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: 8px;
          padding: 12px;
          margin-bottom: 8px;
          display: flex;
          justify-content: space-between;
          align-items: start;
          gap: 12px;
        }

        .template-info {
          flex: 1;
        }

        .template-name {
          font-weight: 500;
          color: var(--foreground);
          margin-bottom: 4px;
        }

        .template-preview {
          font-size: 12px;
          color: var(--foreground-muted);
          max-width: 300px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .template-actions {
          display: flex;
          gap: 4px;
        }

        .modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.5);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
        }

        .modal-content {
          background: var(--surface-raised);
          border: 1px solid var(--border);
          border-radius: 12px;
          padding: 20px;
          max-width: 400px;
          width: 90%;
          box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
        }

        .modal-title {
          font-size: 16px;
          font-weight: 600;
          margin-bottom: 12px;
          color: var(--foreground);
        }

        .modal-actions {
          display: flex;
          gap: 8px;
          margin-top: 16px;
          flex-direction: row-reverse;
        }

        .empty-state {
          text-align: center;
          padding: 40px 20px;
          color: var(--foreground-muted);
        }

        .empty-state-icon {
          font-size: 48px;
          margin-bottom: 12px;
        }

        .schedule-section {
          background: var(--surface);
          padding: 12px;
          border-radius: 8px;
          border: 1px solid var(--border);
          margin-top: 12px;
        }

        .toggle-label {
          display: flex;
          align-items: center;
          gap: 8px;
          cursor: pointer;
        }

        input[type="checkbox"].toggle {
          width: 40px;
          height: 24px;
          cursor: pointer;
          appearance: none;
          background: var(--border);
          border: none;
          border-radius: 12px;
          position: relative;
          transition: background 0.2s;
        }

        input[type="checkbox"].toggle:checked {
          background: var(--accent);
        }

        input[type="checkbox"].toggle:after {
          content: '';
          position: absolute;
          width: 20px;
          height: 20px;
          background: white;
          border-radius: 10px;
          top: 2px;
          right: 2px;
          transition: right 0.2s;
        }

        input[type="checkbox"].toggle:checked:after {
          right: auto;
          left: 2px;
        }

        .client-list {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
          gap: 8px;
          margin-top: 8px;
          max-height: 300px;
          overflow-y: auto;
        }

        .client-item {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px;
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: 6px;
          cursor: pointer;
          transition: all 0.2s;
        }

        .client-item:hover {
          background: var(--surface-raised);
          border-color: var(--accent);
        }

        .client-item input[type="checkbox"] {
          cursor: pointer;
        }

        .client-item label {
          cursor: pointer;
          flex: 1;
        }
      `}</style>

      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '16px', color: 'var(--foreground)' }}>
          דיוור ודיוור בתפזורת
        </h1>
        <p style={{ color: 'var(--foreground-muted)', fontSize: '14px' }}>
          ניהול קמפיינים דיוור לכל הלקוחות שלך
        </p>
      </div>

      <div style={{ marginBottom: '20px' }}>
        <button
          className={`tab-button ${activeTab === 'new' ? 'active' : ''}`}
          onClick={() => setActiveTab('new')}
        >
          דיוור חדש
        </button>
        <button
          className={`tab-button ${activeTab === 'scheduled' ? 'active' : ''}`}
          onClick={() => setActiveTab('scheduled')}
        >
          דיוורים מתוזמנים
        </button>
        <button
          className={`tab-button ${activeTab === 'sent' ? 'active' : ''}`}
          onClick={() => setActiveTab('sent')}
        >
          דיוורים שנשלחו
        </button>
        <button
          className={`tab-button ${activeTab === 'templates' ? 'active' : ''}`}
          onClick={() => setActiveTab('templates')}
        >
          תבניות
        </button>
      </div>

      {/* ── TAB 1: NEW MAILING ────────────────────────────────────────────── */}
      <section className={`section ${activeTab === 'new' ? 'active' : ''}`}>
        <div className="card">
          <h2 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '16px', color: 'var(--foreground)' }}>
            כתבת דיוור
          </h2>

          <div className="input-group">
            <label className="input-label">נושא *</label>
            <input
              type="text"
              placeholder="לדוגמה: עדכוני משהו חדש"
              value={formState.subject}
              onChange={(e) => setFormState(prev => ({ ...prev, subject: e.target.value }))}
            />
          </div>

          <div className="input-group">
            <label className="input-label">גוף ההודעה *</label>
            <div className="formatting-toolbar">
              <button className="toolbar-button" onClick={() => {
                const selection = window.getSelection()?.toString() || '';
                if (selection) {
                  setFormState(prev => ({
                    ...prev,
                    body: prev.body.replace(selection, `**${selection}**`),
                  }));
                }
              }}>
                B (בולד)
              </button>
              <button className="toolbar-button" onClick={() => {
                const selection = window.getSelection()?.toString() || '';
                if (selection) {
                  setFormState(prev => ({
                    ...prev,
                    body: prev.body.replace(selection, `*${selection}*`),
                  }));
                }
              }}>
                I (נטוי)
              </button>
            </div>
            <textarea
              placeholder="כתוב את גוף ההודעה שלך כאן..."
              value={formState.body}
              onChange={(e) => setFormState(prev => ({ ...prev, body: e.target.value }))}
            />
          </div>

          <div className="card" style={{ background: 'var(--surface)', margin: '16px 0' }}>
            <h3 style={{ fontSize: '14px', fontWeight: '600', marginBottom: '12px', color: 'var(--foreground)' }}>
              סינון מקבלים
            </h3>

            <div className="radio-group">
              <label className="radio-item">
                <input
                  type="radio"
                  name="filterType"
                  value="all"
                  checked={formState.recipientFilterType === 'all'}
                  onChange={() => setFormState(prev => ({ ...prev, recipientFilterType: 'all' }))}
                />
                <span>כל הלקוחות הפעילים</span>
              </label>

              <label className="radio-item">
                <input
                  type="radio"
                  name="filterType"
                  value="by_client_type"
                  checked={formState.recipientFilterType === 'by_client_type'}
                  onChange={() => setFormState(prev => ({ ...prev, recipientFilterType: 'by_client_type' }))}
                />
                <span>לפי סוג לקוח</span>
              </label>

              {formState.recipientFilterType === 'by_client_type' && (
                <div className="checkbox-group">
                  {CLIENT_TYPE_OPTIONS.map(option => (
                    <label key={option.value} className="checkbox-item">
                      <input
                        type="checkbox"
                        checked={formState.selectedClientTypes.includes(option.value)}
                        onChange={(e) => {
                          setFormState(prev => ({
                            ...prev,
                            selectedClientTypes: e.target.checked
                              ? [...prev.selectedClientTypes, option.value]
                              : prev.selectedClientTypes.filter(v => v !== option.value),
                          }));
                        }}
                      />
                      <span>{option.label}</span>
                    </label>
                  ))}
                </div>
              )}

              <label className="radio-item">
                <input
                  type="radio"
                  name="filterType"
                  value="by_employee"
                  checked={formState.recipientFilterType === 'by_employee'}
                  onChange={() => setFormState(prev => ({ ...prev, recipientFilterType: 'by_employee' }))}
                />
                <span>לפי עובד אחראי</span>
              </label>

              {formState.recipientFilterType === 'by_employee' && (
                <div style={{ marginRight: '24px' }}>
                  <select
                    value={formState.selectedEmployeeId}
                    onChange={(e) => setFormState(prev => ({ ...prev, selectedEmployeeId: e.target.value }))}
                  >
                    <option value="">בחר עובד</option>
                    {allEmployees?.map(emp => (
                      <option key={emp.id} value={emp.id}>{emp.name}</option>
                    ))}
                  </select>
                </div>
              )}

              <label className="radio-item">
                <input
                  type="radio"
                  name="filterType"
                  value="by_payment_status"
                  checked={formState.recipientFilterType === 'by_payment_status'}
                  onChange={() => setFormState(prev => ({ ...prev, recipientFilterType: 'by_payment_status' }))}
                />
                <span>לפי סטטוס תשלום</span>
              </label>

              {formState.recipientFilterType === 'by_payment_status' && (
                <div style={{ marginRight: '24px' }}>
                  <select
                    value={formState.selectedPaymentStatus}
                    onChange={(e) => setFormState(prev => ({ ...prev, selectedPaymentStatus: e.target.value }))}
                  >
                    <option value="">בחר סטטוס</option>
                    {PAYMENT_STATUS_OPTIONS.map(option => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </div>
              )}

              <label className="radio-item">
                <input
                  type="radio"
                  name="filterType"
                  value="by_portal"
                  checked={formState.recipientFilterType === 'by_portal'}
                  onChange={() => setFormState(prev => ({ ...prev, recipientFilterType: 'by_portal' }))}
                />
                <span>לקוחות פורטל בלבד</span>
              </label>

              <label className="radio-item">
                <input
                  type="radio"
                  name="filterType"
                  value="manual"
                  checked={formState.recipientFilterType === 'manual'}
                  onChange={() => setFormState(prev => ({ ...prev, recipientFilterType: 'manual' }))}
                />
                <span>בחירה ידנית</span>
              </label>

              {formState.recipientFilterType === 'manual' && (
                <div style={{ marginRight: '24px', marginTop: '8px' }}>
                  <div className="client-list">
                    {activeClients.map(client => (
                      <label key={client.id} className="client-item">
                        <input
                          type="checkbox"
                          checked={formState.selectedManualClientIds.includes(client.id)}
                          onChange={(e) => {
                            setFormState(prev => ({
                              ...prev,
                              selectedManualClientIds: e.target.checked
                                ? [...prev.selectedManualClientIds, client.id]
                                : prev.selectedManualClientIds.filter(id => id !== client.id),
                            }));
                          }}
                        />
                        <span>{client.name}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="recipient-count">
              {recipientCount} לקוחות יקבלו דיוור זה
            </div>
          </div>

          <div className="card" style={{ background: 'var(--surface)', margin: '16px 0' }}>
            <label className="toggle-label">
              <input
                type="checkbox"
                className="toggle"
                checked={formState.scheduleEnabled}
                onChange={(e) => setFormState(prev => ({ ...prev, scheduleEnabled: e.target.checked }))}
              />
              <span>תזמן דיוור</span>
            </label>

            {formState.scheduleEnabled && (
              <div className="schedule-section">
                <div className="input-group" style={{ marginBottom: '12px' }}>
                  <label className="input-label">תאריך</label>
                  <input
                    type="date"
                    value={formState.scheduledDate}
                    onChange={(e) => setFormState(prev => ({ ...prev, scheduledDate: e.target.value }))}
                  />
                </div>
                <div className="input-group">
                  <label className="input-label">שעה</label>
                  <input
                    type="time"
                    value={formState.scheduledTime}
                    onChange={(e) => setFormState(prev => ({ ...prev, scheduledTime: e.target.value }))}
                  />
                </div>
              </div>
            )}
          </div>

          <div className="button-group">
            <button
              className="button primary"
              onClick={() => handleCreateMailing(true)}
            >
              שלח עכשיו
            </button>
            <button
              className="button"
              onClick={() => handleCreateMailing(false)}
            >
              {formState.scheduleEnabled ? 'תזמן' : 'שמור כטיוטה'}
            </button>
            <button
              className="button"
              onClick={() => setShowSaveTemplateModal(true)}
            >
              שמור כתבנית
            </button>
          </div>
        </div>
      </section>

      {/* ── TAB 2: SCHEDULED MAILINGS ────────────────────────────────────── */}
      <section className={`section ${activeTab === 'scheduled' ? 'active' : ''}`}>
        {scheduledMailings.length > 0 ? (
          <div className="card">
            <h2 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '16px', color: 'var(--foreground)' }}>
              דיוורים מתוזמנים ({scheduledMailings.length})
            </h2>
            <table className="table">
              <thead>
                <tr>
                  <th>נושא</th>
                  <th>מקבלים</th>
                  <th>תאריך תזמון</th>
                  <th>פעולות</th>
                </tr>
              </thead>
              <tbody>
                {scheduledMailings.map(mailing => (
                  <tr key={mailing.id}>
                    <td style={{ maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {mailing.subject}
                    </td>
                    <td>{mailing.recipientCount}</td>
                    <td>
                      {mailing.scheduledAt
                        ? new Date(mailing.scheduledAt).toLocaleString('he-IL')
                        : '-'
                      }
                    </td>
                    <td>
                      <button
                        className="button"
                        onClick={() => handleCancelScheduled(mailing.id)}
                        style={{ marginRight: '8px', padding: '6px 12px', fontSize: '12px' }}
                      >
                        בטל
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="card">
            <div className="empty-state">
              <div className="empty-state-icon">📅</div>
              <div>אין דיוורים מתוזמנים כרגע</div>
            </div>
          </div>
        )}
      </section>

      {/* ── TAB 3: SENT MAILINGS ──────────────────────────────────────────── */}
      <section className={`section ${activeTab === 'sent' ? 'active' : ''}`}>
        {sentMailings.length > 0 ? (
          <div className="card">
            <h2 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '16px', color: 'var(--foreground)' }}>
              דיוורים שנשלחו ({sentMailings.length})
            </h2>
            <table className="table">
              <thead>
                <tr>
                  <th>נושא</th>
                  <th>מקבלים</th>
                  <th>סינון</th>
                  <th>תאריך שליחה</th>
                  <th>סטטוס</th>
                </tr>
              </thead>
              <tbody>
                {sentMailings.map(mailing => (
                  <tr key={mailing.id}>
                    <td style={{ maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {mailing.subject}
                    </td>
                    <td>{mailing.recipientCount}</td>
                    <td style={{ fontSize: '12px', color: 'var(--foreground-muted)' }}>
                      {formatRecipientFilter(mailing.recipientFilter)}
                    </td>
                    <td>
                      {mailing.sentAt
                        ? new Date(mailing.sentAt).toLocaleString('he-IL')
                        : '-'
                      }
                    </td>
                    <td>
                      <span
                        className="status-badge"
                        style={{ backgroundColor: MAILING_STATUS_COLORS[mailing.status] }}
                      >
                        {MAILING_STATUS_LABELS[mailing.status]}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="card">
            <div className="empty-state">
              <div className="empty-state-icon">✉️</div>
              <div>לא נשלחו דיוורים עדיין</div>
            </div>
          </div>
        )}
      </section>

      {/* ── TAB 4: TEMPLATES ──────────────────────────────────────────────── */}
      <section className={`section ${activeTab === 'templates' ? 'active' : ''}`}>
        {templates && templates.length > 0 ? (
          <div className="card">
            <h2 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '16px', color: 'var(--foreground)' }}>
              תבניות שמורות ({templates.length})
            </h2>
            {templates.map(template => (
              <div key={template.id} className="template-card">
                <div className="template-info">
                  <div className="template-name">{template.name}</div>
                  <div className="template-preview">{template.subject}</div>
                </div>
                <div className="template-actions">
                  <button
                    className="button"
                    onClick={() => handleUseTemplate(template)}
                    style={{ padding: '6px 12px', fontSize: '12px' }}
                  >
                    השתמש
                  </button>
                  <button
                    className="button danger"
                    onClick={() => handleDeleteTemplate(template.id)}
                    style={{ padding: '6px 12px', fontSize: '12px' }}
                  >
                    מחק
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="card">
            <div className="empty-state">
              <div className="empty-state-icon">📋</div>
              <div>אין תבניות שמורות</div>
              <p style={{ marginTop: '8px', fontSize: '12px' }}>שמור תבנית מהדיוור החדש</p>
            </div>
          </div>
        )}
      </section>

      {/* ── SAVE TEMPLATE MODAL ────────────────────────────────────────────── */}
      {showSaveTemplateModal && (
        <div className="modal-overlay" onClick={() => setShowSaveTemplateModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-title">שמור כתבנית</div>
            <div className="input-group">
              <label className="input-label">שם התבנית</label>
              <input
                type="text"
                placeholder="לדוגמה: דיוור חודשי"
                value={templateNameInput}
                onChange={(e) => setTemplateNameInput(e.target.value)}
                autoFocus
              />
            </div>
            <div className="modal-actions">
              <button
                className="button primary"
                onClick={handleSaveTemplate}
              >
                שמור
              </button>
              <button
                className="button"
                onClick={() => {
                  setShowSaveTemplateModal(false);
                  setTemplateNameInput('');
                }}
              >
                בטל
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
