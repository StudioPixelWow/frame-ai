'use client';

import { useState, useMemo } from 'react';
import type { AutomationRule, AutomationTrigger, AutomationAction } from '@/lib/db/schema';

type Category = 'all' | 'tasks' | 'gantt' | 'payments' | 'leads' | 'podcast';

const TRIGGER_LABELS: Record<AutomationTrigger, string> = {
  task_created: 'משימה נוצרה',
  task_status_changed: 'סטטוס משימה השתנה',
  file_uploaded_to_task: 'קובץ הועלה למשימה',
  gantt_created: 'גאנט נוצר',
  gantt_approved: 'גאנט אושר',
  gantt_sent_to_client: 'גאנט נשלח ללקוח',
  payment_due: 'תשלום מתקרב',
  payment_overdue: 'תשלום באיחור',
  lead_status_changed: 'סטטוס ליד השתנה',
  proposal_sent: 'הצעה נשלחה',
  project_created: 'פרויקט נוצר',
  project_status_changed: 'סטטוס פרויקט השתנה',
  podcast_session_booked: 'הקלטת פודקאסט נקבעה',
  podcast_session_completed: 'הקלטת פודקאסט הושלמה',
  client_missing_monthly_gantt: 'לקוח חסר גאנט חודשי',
  client_less_than_2_weekly_posts: 'פחות מ-2 פוסטים שבועיים',
  weekly_client_email_day: 'יום מיילים שבועי',
  employee_task_due_today: 'משימת עובד היום',
};

const ACTION_LABELS: Record<AutomationAction, string> = {
  send_email: 'שלח מייל',
  send_whatsapp: 'שלח וואטסאפ',
  create_task: 'צור משימה',
  update_status: 'עדכן סטטוס',
  create_notification: 'צור התראה',
  assign_employee: 'שייך עובד',
  generate_pdf: 'הפק PDF',
  add_to_calendar: 'הוסף ליומן',
  push_to_approval_center: 'שלח למרכז אישורים',
};

const TRIGGER_TO_CATEGORY: Record<AutomationTrigger, Category> = {
  task_created: 'tasks',
  task_status_changed: 'tasks',
  file_uploaded_to_task: 'tasks',
  gantt_created: 'gantt',
  gantt_approved: 'gantt',
  gantt_sent_to_client: 'gantt',
  payment_due: 'payments',
  payment_overdue: 'payments',
  lead_status_changed: 'leads',
  proposal_sent: 'leads',
  project_created: 'tasks',
  project_status_changed: 'tasks',
  podcast_session_booked: 'podcast',
  podcast_session_completed: 'podcast',
  client_missing_monthly_gantt: 'gantt',
  client_less_than_2_weekly_posts: 'gantt',
  weekly_client_email_day: 'tasks',
  employee_task_due_today: 'tasks',
};

const CATEGORY_LABELS: Record<Category, string> = {
  all: 'הכל',
  tasks: 'משימות',
  gantt: 'תוכן',
  payments: 'תשלומים',
  leads: 'לידים',
  podcast: 'פודקאסט',
};

const DEFAULT_AUTOMATIONS: AutomationRule[] = [
  {
    id: '1',
    name: 'שלח מייל כשקובץ הועלה',
    description: 'שלח מייל ללקוח כאשר קובץ חדש הועלה למשימה',
    trigger: 'file_uploaded_to_task',
    action: 'send_email',
    isActive: true,
    targetEmail: 'client@example.com',
    targetWhatsApp: '',
    templateId: null,
    conditions: '',
    lastTriggeredAt: '2026-04-10T14:23:00Z',
    triggerCount: 12,
    createdAt: '2026-03-15T10:00:00Z',
    updatedAt: '2026-04-10T14:23:00Z',
  },
  {
    id: '2',
    name: 'התראה על תשלום באיחור',
    description: 'הודע לעובד כשתשלום לא בוצע בזמן',
    trigger: 'payment_overdue',
    action: 'send_email',
    isActive: true,
    targetEmail: 'accounting@example.com',
    targetWhatsApp: '',
    templateId: null,
    conditions: '',
    lastTriggeredAt: '2026-04-09T09:15:00Z',
    triggerCount: 5,
    createdAt: '2026-03-20T10:00:00Z',
    updatedAt: '2026-04-09T09:15:00Z',
  },
  {
    id: '3',
    name: 'שלח גאנט ללקוח',
    description: 'שלח גאנט ללקוח לאחר אישור פנימי',
    trigger: 'gantt_approved',
    action: 'send_email',
    isActive: true,
    targetEmail: 'client@example.com',
    targetWhatsApp: '',
    templateId: null,
    conditions: '',
    lastTriggeredAt: '2026-04-08T11:45:00Z',
    triggerCount: 8,
    createdAt: '2026-03-18T10:00:00Z',
    updatedAt: '2026-04-08T11:45:00Z',
  },
  {
    id: '4',
    name: 'תזכורת משימה יומית',
    description: 'הודע לעובד על משימות שיש להשלים היום',
    trigger: 'employee_task_due_today',
    action: 'create_notification',
    isActive: true,
    targetEmail: '',
    targetWhatsApp: '',
    templateId: null,
    conditions: '',
    lastTriggeredAt: '2026-04-11T08:00:00Z',
    triggerCount: 45,
    createdAt: '2026-03-10T10:00:00Z',
    updatedAt: '2026-04-11T08:00:00Z',
  },
  {
    id: '5',
    name: 'פולואפ אחרי הצעה',
    description: 'שלח מייל עקוב 3 ימים אחרי שליחת הצעה',
    trigger: 'proposal_sent',
    action: 'send_email',
    isActive: true,
    targetEmail: 'sales@example.com',
    targetWhatsApp: '',
    templateId: null,
    conditions: '',
    lastTriggeredAt: '2026-04-06T16:30:00Z',
    triggerCount: 3,
    createdAt: '2026-03-25T10:00:00Z',
    updatedAt: '2026-04-06T16:30:00Z',
  },
  {
    id: '6',
    name: 'התראה על לקוח בלי גאנט',
    description: 'הודע כשלקוח לא קיבל גאנט חודשי',
    trigger: 'client_missing_monthly_gantt',
    action: 'create_notification',
    isActive: false,
    targetEmail: '',
    targetWhatsApp: '',
    templateId: null,
    conditions: '',
    lastTriggeredAt: null,
    triggerCount: 0,
    createdAt: '2026-03-22T10:00:00Z',
    updatedAt: '2026-03-22T10:00:00Z',
  },
  {
    id: '7',
    name: 'הזמנת פודקאסט - צור תשלום',
    description: 'צור משימת תשלום כשפודקאסט הוזמן',
    trigger: 'podcast_session_booked',
    action: 'create_task',
    isActive: true,
    targetEmail: '',
    targetWhatsApp: '',
    templateId: null,
    conditions: '',
    lastTriggeredAt: '2026-04-05T13:20:00Z',
    triggerCount: 2,
    createdAt: '2026-03-30T10:00:00Z',
    updatedAt: '2026-04-05T13:20:00Z',
  },
  {
    id: '8',
    name: 'שלח חומרים סופיים',
    description: 'שלח חומרים סופיים אחרי השלמת הקלטה',
    trigger: 'podcast_session_completed',
    action: 'send_email',
    isActive: true,
    targetEmail: 'podcast@example.com',
    targetWhatsApp: '',
    templateId: null,
    conditions: '',
    lastTriggeredAt: '2026-04-04T10:00:00Z',
    triggerCount: 1,
    createdAt: '2026-03-28T10:00:00Z',
    updatedAt: '2026-04-04T10:00:00Z',
  },
  {
    id: '9',
    name: 'תשלום מתקרב - הזכרון',
    description: 'הזכר על תשלומים שעומדים להתבצע',
    trigger: 'payment_due',
    action: 'send_whatsapp',
    isActive: false,
    targetEmail: '',
    targetWhatsApp: '+972501234567',
    templateId: null,
    conditions: '',
    lastTriggeredAt: null,
    triggerCount: 0,
    createdAt: '2026-03-12T10:00:00Z',
    updatedAt: '2026-03-12T10:00:00Z',
  },
  {
    id: '10',
    name: 'משימה חדשה - אודעה',
    description: 'צור התראה כשמשימה חדשה נוצרה',
    trigger: 'task_created',
    action: 'create_notification',
    isActive: true,
    targetEmail: '',
    targetWhatsApp: '',
    templateId: null,
    conditions: '',
    lastTriggeredAt: '2026-04-11T15:45:00Z',
    triggerCount: 28,
    createdAt: '2026-03-05T10:00:00Z',
    updatedAt: '2026-04-11T15:45:00Z',
  },
];

interface ModalState {
  isOpen: boolean;
  editingId: string | null;
  formData: {
    name: string;
    description: string;
    trigger: AutomationTrigger;
    action: AutomationAction;
    targetEmail: string;
    targetWhatsApp: string;
    isActive: boolean;
  };
}

export default function AutomationsPage() {
  const [automations, setAutomations] = useState<AutomationRule[]>(DEFAULT_AUTOMATIONS);
  const [selectedCategory, setSelectedCategory] = useState<Category>('all');
  const [modal, setModal] = useState<ModalState>({
    isOpen: false,
    editingId: null,
    formData: {
      name: '',
      description: '',
      trigger: 'task_created',
      action: 'send_email',
      targetEmail: '',
      targetWhatsApp: '',
      isActive: true,
    },
  });

  const filteredAutomations = useMemo(() => {
    if (selectedCategory === 'all') {
      return automations;
    }
    return automations.filter(
      (a) => TRIGGER_TO_CATEGORY[a.trigger] === selectedCategory
    );
  }, [automations, selectedCategory]);

  const stats = useMemo(() => {
    const total = automations.length;
    const active = automations.filter((a) => a.isActive).length;
    const triggerCount = automations.reduce((sum, a) => sum + a.triggerCount, 0);
    const emailCount = automations.filter(
      (a) => a.action === 'send_email'
    ).length;

    return { total, active, triggerCount, emailCount };
  }, [automations]);

  const openCreateModal = () => {
    setModal({
      isOpen: true,
      editingId: null,
      formData: {
        name: '',
        description: '',
        trigger: 'task_created',
        action: 'send_email',
        targetEmail: '',
        targetWhatsApp: '',
        isActive: true,
      },
    });
  };

  const openEditModal = (automation: AutomationRule) => {
    setModal({
      isOpen: true,
      editingId: automation.id,
      formData: {
        name: automation.name,
        description: automation.description,
        trigger: automation.trigger,
        action: automation.action,
        targetEmail: automation.targetEmail,
        targetWhatsApp: automation.targetWhatsApp,
        isActive: automation.isActive,
      },
    });
  };

  const closeModal = () => {
    setModal({
      isOpen: false,
      editingId: null,
      formData: {
        name: '',
        description: '',
        trigger: 'task_created',
        action: 'send_email',
        targetEmail: '',
        targetWhatsApp: '',
        isActive: true,
      },
    });
  };

  const saveAutomation = () => {
    const { name, description, trigger, action, targetEmail, targetWhatsApp, isActive } =
      modal.formData;

    if (!name.trim()) {
      alert('נא להזין שם אוטומציה');
      return;
    }

    if (modal.editingId) {
      // Edit existing
      setAutomations((prev) =>
        prev.map((a) =>
          a.id === modal.editingId
            ? {
                ...a,
                name,
                description,
                trigger,
                action,
                targetEmail,
                targetWhatsApp,
                isActive,
                updatedAt: new Date().toISOString(),
              }
            : a
        )
      );
    } else {
      // Create new
      const newAutomation: AutomationRule = {
        id: Date.now().toString(),
        name,
        description,
        trigger,
        action,
        isActive,
        targetEmail,
        targetWhatsApp,
        templateId: null,
        conditions: '',
        lastTriggeredAt: null,
        triggerCount: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      setAutomations((prev) => [newAutomation, ...prev]);
    }

    closeModal();
  };

  const deleteAutomation = (id: string) => {
    if (confirm('האם אתה בטוח שברצונך למחוק אוטומציה זו?')) {
      setAutomations((prev) => prev.filter((a) => a.id !== id));
    }
  };

  const toggleActive = (id: string) => {
    setAutomations((prev) =>
      prev.map((a) =>
        a.id === id ? { ...a, isActive: !a.isActive } : a
      )
    );
  };

  const updateFormData = (
    key: keyof ModalState['formData'],
    value: any
  ) => {
    setModal((prev) => ({
      ...prev,
      formData: {
        ...prev.formData,
        [key]: value,
      },
    }));
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'לא הופעל';
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));

    if (diffDays > 0) return `לפני ${diffDays} ימים`;
    if (diffHours > 0) return `לפני ${diffHours} שעות`;
    return 'זה עתה';
  };

  return (
    <div dir="rtl" className="min-h-screen p-6" style={{ backgroundColor: 'var(--background)' }}>
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1
            className="text-4xl font-bold"
            style={{ color: 'var(--foreground)' }}
          >
            אוטומציות
          </h1>
          <p className="mt-2" style={{ color: 'var(--foreground-muted)' }}>
            ניהול חוקי אוטומציה והטריגרים שלך
          </p>
        </div>
        <button
          onClick={openCreateModal}
          className="px-6 py-3 rounded-lg font-medium transition-all"
          style={{
            backgroundColor: 'var(--accent)',
            color: 'white',
          }}
        >
          + אוטומציה חדשה
        </button>
      </div>

      {/* Stats Row */}
      <div className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-4">
        <StatCard
          label="סה״כ אוטומציות"
          value={stats.total.toString()}
          icon="⚙️"
        />
        <StatCard
          label="אוטומציות פעילות"
          value={stats.active.toString()}
          icon="✓"
        />
        <StatCard
          label="הפעלות השבוע"
          value={stats.triggerCount.toString()}
          icon="📊"
        />
        <StatCard
          label="מייל אוטומציות"
          value={stats.emailCount.toString()}
          icon="📧"
        />
      </div>

      {/* Category Tabs */}
      <div className="mb-6 flex flex-wrap gap-3">
        {(Object.keys(CATEGORY_LABELS) as Category[]).map((cat) => (
          <button
            key={cat}
            onClick={() => setSelectedCategory(cat)}
            className={`px-4 py-2 rounded-lg font-medium transition-all ${
              selectedCategory === cat
                ? 'text-white'
                : ''
            }`}
            style={{
              backgroundColor:
                selectedCategory === cat
                  ? 'var(--accent)'
                  : 'var(--surface)',
              color:
                selectedCategory === cat
                  ? 'white'
                  : 'var(--foreground)',
              border: `1px solid var(--border)`,
            }}
          >
            {CATEGORY_LABELS[cat]}
          </button>
        ))}
      </div>

      {/* Automations List */}
      <div className="space-y-4">
        {filteredAutomations.length === 0 ? (
          <div
            className="rounded-lg p-8 text-center"
            style={{
              backgroundColor: 'var(--surface)',
              border: '1px solid var(--border)',
            }}
          >
            <p style={{ color: 'var(--foreground-muted)' }}>
              אין אוטומציות בקטגוריה זו
            </p>
          </div>
        ) : (
          filteredAutomations.map((automation) => (
            <AutomationCard
              key={automation.id}
              automation={automation}
              onEdit={() => openEditModal(automation)}
              onDelete={() => deleteAutomation(automation.id)}
              onToggle={() => toggleActive(automation.id)}
            />
          ))
        )}
      </div>

      {/* Modal */}
      {modal.isOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}
          onClick={closeModal}
        >
          <div
            className="w-full max-w-2xl rounded-lg p-6"
            style={{ backgroundColor: 'var(--surface)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2
              className="mb-6 text-2xl font-bold"
              style={{ color: 'var(--foreground)' }}
            >
              {modal.editingId ? 'עריכת אוטומציה' : 'אוטומציה חדשה'}
            </h2>

            <div className="space-y-4 mb-6">
              <div>
                <label
                  className="block mb-2 text-sm font-medium"
                  style={{ color: 'var(--foreground)' }}
                >
                  שם
                </label>
                <input
                  type="text"
                  value={modal.formData.name}
                  onChange={(e) => updateFormData('name', e.target.value)}
                  className="w-full px-4 py-2 rounded-lg border transition-all focus:outline-none"
                  style={{
                    borderColor: 'var(--border)',
                    backgroundColor: 'var(--background)',
                    color: 'var(--foreground)',
                  }}
                  placeholder="שם האוטומציה"
                />
              </div>

              <div>
                <label
                  className="block mb-2 text-sm font-medium"
                  style={{ color: 'var(--foreground)' }}
                >
                  תיאור
                </label>
                <textarea
                  value={modal.formData.description}
                  onChange={(e) =>
                    updateFormData('description', e.target.value)
                  }
                  className="w-full px-4 py-2 rounded-lg border transition-all focus:outline-none"
                  style={{
                    borderColor: 'var(--border)',
                    backgroundColor: 'var(--background)',
                    color: 'var(--foreground)',
                  }}
                  placeholder="תיאור האוטומציה"
                  rows={3}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label
                    className="block mb-2 text-sm font-medium"
                    style={{ color: 'var(--foreground)' }}
                  >
                    טריגר
                  </label>
                  <select
                    value={modal.formData.trigger}
                    onChange={(e) =>
                      updateFormData(
                        'trigger',
                        e.target.value as AutomationTrigger
                      )
                    }
                    className="w-full px-4 py-2 rounded-lg border transition-all focus:outline-none"
                    style={{
                      borderColor: 'var(--border)',
                      backgroundColor: 'var(--background)',
                      color: 'var(--foreground)',
                    }}
                  >
                    {(Object.keys(TRIGGER_LABELS) as AutomationTrigger[]).map(
                      (trigger) => (
                        <option key={trigger} value={trigger}>
                          {TRIGGER_LABELS[trigger]}
                        </option>
                      )
                    )}
                  </select>
                </div>

                <div>
                  <label
                    className="block mb-2 text-sm font-medium"
                    style={{ color: 'var(--foreground)' }}
                  >
                    פעולה
                  </label>
                  <select
                    value={modal.formData.action}
                    onChange={(e) =>
                      updateFormData('action', e.target.value as AutomationAction)
                    }
                    className="w-full px-4 py-2 rounded-lg border transition-all focus:outline-none"
                    style={{
                      borderColor: 'var(--border)',
                      backgroundColor: 'var(--background)',
                      color: 'var(--foreground)',
                    }}
                  >
                    {(Object.keys(ACTION_LABELS) as AutomationAction[]).map(
                      (action) => (
                        <option key={action} value={action}>
                          {ACTION_LABELS[action]}
                        </option>
                      )
                    )}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label
                    className="block mb-2 text-sm font-medium"
                    style={{ color: 'var(--foreground)' }}
                  >
                    אימייל יעד
                  </label>
                  <input
                    type="email"
                    value={modal.formData.targetEmail}
                    onChange={(e) =>
                      updateFormData('targetEmail', e.target.value)
                    }
                    className="w-full px-4 py-2 rounded-lg border transition-all focus:outline-none"
                    style={{
                      borderColor: 'var(--border)',
                      backgroundColor: 'var(--background)',
                      color: 'var(--foreground)',
                    }}
                    placeholder="example@email.com"
                  />
                </div>

                <div>
                  <label
                    className="block mb-2 text-sm font-medium"
                    style={{ color: 'var(--foreground)' }}
                  >
                    וואטסאפ יעד
                  </label>
                  <input
                    type="text"
                    value={modal.formData.targetWhatsApp}
                    onChange={(e) =>
                      updateFormData('targetWhatsApp', e.target.value)
                    }
                    className="w-full px-4 py-2 rounded-lg border transition-all focus:outline-none"
                    style={{
                      borderColor: 'var(--border)',
                      backgroundColor: 'var(--background)',
                      color: 'var(--foreground)',
                    }}
                    placeholder="+972501234567"
                  />
                </div>
              </div>

              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="isActive"
                  checked={modal.formData.isActive}
                  onChange={(e) =>
                    updateFormData('isActive', e.target.checked)
                  }
                  className="w-5 h-5 rounded cursor-pointer"
                  style={{ accentColor: 'var(--accent)' }}
                />
                <label
                  htmlFor="isActive"
                  className="cursor-pointer font-medium"
                  style={{ color: 'var(--foreground)' }}
                >
                  פעיל
                </label>
              </div>
            </div>

            <div className="flex gap-3 justify-end">
              <button
                onClick={closeModal}
                className="px-6 py-2 rounded-lg font-medium transition-all"
                style={{
                  backgroundColor: 'var(--surface-variant)',
                  color: 'var(--foreground)',
                  border: '1px solid var(--border)',
                }}
              >
                ביטול
              </button>
              <button
                onClick={saveAutomation}
                className="px-6 py-2 rounded-lg font-medium text-white transition-all"
                style={{ backgroundColor: 'var(--accent)' }}
              >
                שמור
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

interface StatCardProps {
  label: string;
  value: string;
  icon: string;
}

function StatCard({ label, value, icon }: StatCardProps) {
  return (
    <div
      className="rounded-lg p-6 border"
      style={{
        backgroundColor: 'var(--surface)',
        borderColor: 'var(--border)',
      }}
    >
      <div className="flex items-start justify-between">
        <div>
          <p
            className="text-sm font-medium mb-2"
            style={{ color: 'var(--foreground-muted)' }}
          >
            {label}
          </p>
          <p
            className="text-3xl font-bold"
            style={{ color: 'var(--foreground)' }}
          >
            {value}
          </p>
        </div>
        <span className="text-2xl">{icon}</span>
      </div>
    </div>
  );
}

interface AutomationCardProps {
  automation: AutomationRule;
  onEdit: () => void;
  onDelete: () => void;
  onToggle: () => void;
}

function AutomationCard({
  automation,
  onEdit,
  onDelete,
  onToggle,
}: AutomationCardProps) {
  return (
    <div
      className="rounded-lg p-6 border transition-all hover:shadow-md"
      style={{
        backgroundColor: 'var(--surface)',
        borderColor: 'var(--border)',
      }}
    >
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <h3
            className="text-lg font-bold mb-1"
            style={{ color: 'var(--foreground)' }}
          >
            {automation.name}
          </h3>
          <p
            className="text-sm"
            style={{ color: 'var(--foreground-muted)' }}
          >
            {automation.description}
          </p>
        </div>
        <button
          onClick={onToggle}
          className="ml-4 relative inline-flex h-8 w-14 items-center rounded-full transition-colors flex-shrink-0"
          style={{
            backgroundColor: automation.isActive
              ? 'var(--accent)'
              : 'var(--border)',
          }}
        >
          <span
            className="inline-block h-6 w-6 transform rounded-full bg-white transition-transform"
            style={{
              transform: automation.isActive ? 'translateX(-1.5rem)' : 'translateX(0.25rem)',
            }}
          />
        </button>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        <Badge label={TRIGGER_LABELS[automation.trigger]} variant="trigger" />
        <span style={{ color: 'var(--foreground-muted)' }}>→</span>
        <Badge label={ACTION_LABELS[automation.action]} variant="action" />
      </div>

      <div
        className="grid grid-cols-3 gap-4 mb-4 pb-4 border-t"
        style={{ borderColor: 'var(--border)' }}
      >
        <div>
          <p
            className="text-xs font-medium mb-1"
            style={{ color: 'var(--foreground-muted)' }}
          >
            آخر تفعيل
          </p>
          <p style={{ color: 'var(--foreground)' }} className="text-sm">
            {formatDateDisplay(automation.lastTriggeredAt)}
          </p>
        </div>
        <div>
          <p
            className="text-xs font-medium mb-1"
            style={{ color: 'var(--foreground-muted)' }}
          >
            عدد التفعيلات
          </p>
          <p style={{ color: 'var(--foreground)' }} className="text-sm">
            {automation.triggerCount}
          </p>
        </div>
        <div>
          <p
            className="text-xs font-medium mb-1"
            style={{ color: 'var(--foreground-muted)' }}
          >
            الحالة
          </p>
          <p
            style={{
              color: automation.isActive
                ? 'var(--accent)'
                : 'var(--foreground-muted)',
            }}
            className="text-sm font-medium"
          >
            {automation.isActive ? 'فعال' : 'معطل'}
          </p>
        </div>
      </div>

      <div className="flex gap-2">
        <button
          onClick={onEdit}
          className="flex-1 px-4 py-2 rounded-lg font-medium transition-all text-sm"
          style={{
            backgroundColor: 'var(--surface-variant)',
            color: 'var(--foreground)',
            border: '1px solid var(--border)',
          }}
        >
          עריכה
        </button>
        <button
          onClick={onDelete}
          className="flex-1 px-4 py-2 rounded-lg font-medium transition-all text-sm text-white"
          style={{
            backgroundColor: '#ef4444',
          }}
        >
          מחיקה
        </button>
      </div>
    </div>
  );
}

interface BadgeProps {
  label: string;
  variant: 'trigger' | 'action';
}

function Badge({ label, variant }: BadgeProps) {
  const colors = {
    trigger: {
      bg: 'rgba(59, 130, 246, 0.1)',
      text: '#3b82f6',
    },
    action: {
      bg: 'rgba(34, 197, 94, 0.1)',
      text: '#22c55e',
    },
  };

  return (
    <span
      className="px-3 py-1 rounded-full text-sm font-medium"
      style={{
        backgroundColor: colors[variant].bg,
        color: colors[variant].text,
      }}
    >
      {label}
    </span>
  );
}

function formatDateDisplay(dateString: string | null): string {
  if (!dateString) return 'לא הופעל';
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffMins = Math.floor(diffMs / (1000 * 60));

  if (diffDays > 0) return `לפני ${diffDays} ימים`;
  if (diffHours > 0) return `לפני ${diffHours} שעות`;
  if (diffMins > 0) return `לפני ${diffMins} דקות`;
  return 'זה עתה';
}
