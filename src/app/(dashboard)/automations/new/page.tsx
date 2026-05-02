'use client';

export const dynamic = "force-dynamic";

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';

type Step = 1 | 2 | 3 | 4 | 5;
type TriggerType =
  | 'new_lead' | 'lead_not_assigned' | 'no_response' | 'lead_status_changed'
  | 'campaign_issue' | 'campaign_budget_alert'
  | 'client_inactivity' | 'client_missing_gantt'
  | 'task_created' | 'task_overdue'
  | 'manual_trigger';

type ActionType =
  | 'assign_lead' | 'create_task' | 'notify_user' | 'send_whatsapp'
  | 'send_alert' | 'ai_suggestion' | 'push_approval';

type ApprovalMode = 'auto_safe' | 'requires_approval' | 'recommendation_only';

interface Condition {
  id: string;
  field: string;
  operator: string;
  value: string;
}

const TRIGGER_CATEGORIES = {
  leads: {
    label: 'לידים',
    triggers: {
      new_lead: { icon: '👤', title: 'ליד חדש', desc: 'כשליד חדש נכנס למערכת' },
      lead_not_assigned: { icon: '⚠️', title: 'ליד לא שויך', desc: 'ליד שלא שויך לאיש מכירות' },
      no_response: { icon: '⏰', title: 'אין תגובה', desc: 'ליד ללא תגובה אחרי X שעות' },
      lead_status_changed: { icon: '🔄', title: 'סטטוס ליד השתנה', desc: 'כשסטטוס ליד מתעדכן' },
    },
  },
  campaigns: {
    label: 'קמפיינים',
    triggers: {
      campaign_issue: { icon: '📉', title: 'בעיה בקמפיין', desc: 'ירידה בביצועים או עייפות קריאייטיב' },
      campaign_budget_alert: { icon: '💰', title: 'תקציב קמפיין', desc: 'חריגה או מיצוי תקציב' },
    },
  },
  clients: {
    label: 'לקוחות',
    triggers: {
      client_inactivity: { icon: '😴', title: 'לקוח לא פעיל', desc: 'אין פעילות X ימים' },
      client_missing_gantt: { icon: '📋', title: 'חסר גאנט חודשי', desc: 'לקוח בלי גאנט לחודש הנוכחי' },
    },
  },
  tasks: {
    label: 'משימות',
    triggers: {
      task_created: { icon: '✅', title: 'משימה נוצרה', desc: 'כשמשימה חדשה נוצרת' },
      task_overdue: { icon: '🔴', title: 'משימה באיחור', desc: 'משימה שעבר תאריך היעד שלה' },
    },
  },
  manual: {
    label: 'ידני',
    triggers: {
      manual_trigger: { icon: '🖱️', title: 'הפעלה ידנית', desc: 'הפעל אוטומציה ידנית' },
    },
  },
};

const ACTIONS = {
  assign_lead: { icon: '👤', title: 'שייך ליד', desc: 'שייך ליד לאיש מכירות הטוב ביותר' },
  create_task: { icon: '📝', title: 'צור משימה', desc: 'צור משימה אוטומטית' },
  notify_user: { icon: '🔔', title: 'שלח התראה', desc: 'שלח התראה פנימית' },
  send_whatsapp: { icon: '💬', title: 'שלח וואטסאפ', desc: 'שלח הודעת וואטסאפ (סימולציה)' },
  send_alert: { icon: '🚨', title: 'התראה דחופה', desc: 'שלח התראה דחופה לצוות' },
  ai_suggestion: { icon: '🤖', title: 'הצעת AI', desc: 'בקש הצעה חכמה מ-AI' },
  push_approval: { icon: '✋', title: 'שלח לאישור', desc: 'שלח למרכז אישורים' },
};

const APPROVAL_MODES = {
  auto_safe: {
    icon: '⚡',
    title: 'אוטומטי מלא',
    desc: 'הפעולה תתבצע ישירות ללא אישור. מתאים לפעולות בטוחות כמו התראות.',
    badge: 'מומלץ לפעולות בסיסיות',
  },
  requires_approval: {
    icon: '✋',
    title: 'דורש אישור',
    desc: 'הפעולה תחכה לאישור ידני לפני ביצוע. מתאים לפעולות שמשפיעות על לקוחות.',
    badge: 'מומלץ לפעולות חיצוניות',
  },
  recommendation_only: {
    icon: '💡',
    title: 'המלצה בלבד',
    desc: 'המערכת תציע את הפעולה אבל לא תבצע. אתה מחליט.',
    badge: 'הכי בטוח',
  },
};

const CONDITION_FIELDS = [
  'ציון ליד',
  'לקוח',
  'סוג קמפיין',
  'בעלים',
  'סטטוס',
  'ערך עסקה',
];

const OPERATORS = [
  'שווה ל',
  'גדול מ',
  'קטן מ',
  'מכיל',
  'לא שווה ל',
];

export default function AutomationBuilderPage() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState<Step>(1);
  const [selectedTrigger, setSelectedTrigger] = useState<TriggerType | null>(null);
  const [selectedAction, setSelectedAction] = useState<ActionType | null>(null);
  const [approvalMode, setApprovalMode] = useState<ApprovalMode>('auto_safe');
  const [conditions, setConditions] = useState<Condition[]>([]);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const handleAddCondition = useCallback(() => {
    const newCondition: Condition = {
      id: Math.random().toString(36).substr(2, 9),
      field: CONDITION_FIELDS[0],
      operator: OPERATORS[0],
      value: '',
    };
    setConditions([...conditions, newCondition]);
  }, [conditions]);

  const handleRemoveCondition = useCallback((id: string) => {
    setConditions(conditions.filter((c) => c.id !== id));
  }, [conditions]);

  const handleUpdateCondition = useCallback(
    (id: string, key: 'field' | 'operator' | 'value', value: string) => {
      setConditions(
        conditions.map((c) =>
          c.id === id ? { ...c, [key]: value } : c
        )
      );
    },
    [conditions]
  );

  const handleNext = () => {
    if (currentStep < 5) {
      setCurrentStep((currentStep + 1) as Step);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep((currentStep - 1) as Step);
    }
  };

  const handleGoToStep = (step: Step) => {
    setCurrentStep(step);
  };

  const handleSave = async (asDraft: boolean) => {
    if (!selectedTrigger || !selectedAction || !name.trim()) {
      alert('אנא מלא את כל השדות הנדרשים');
      return;
    }

    setIsSaving(true);
    try {
      const payload = {
        name,
        description,
        trigger: selectedTrigger,
        action: selectedAction,
        conditions: conditions.length > 0 ? JSON.stringify(conditions) : '',
        approvalMode,
        isActive: !asDraft,
      };

      const response = await fetch('/api/data/automation-rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) throw new Error('Failed to save automation');

      router.push('/automations');
    } catch (error) {
      console.error('Save failed:', error);
      alert('שגיאה בשמירת האוטומציה');
    } finally {
      setIsSaving(false);
    }
  };

  const isStepComplete = (step: Step): boolean => {
    switch (step) {
      case 1: return !!selectedTrigger;
      case 2: return true;
      case 3: return !!selectedAction;
      case 4: return true;
      case 5: return !!name.trim();
      default: return false;
    }
  };

  return (
    <div dir="rtl" className="min-h-screen pb-32" style={{ backgroundColor: 'var(--background)' }}>
      <div className="p-8">
        {/* Stepper */}
        <div className="mb-12 auto-stepper">
          <div className="flex items-center justify-between">
            {([1, 2, 3, 4, 5] as const).map((step) => (
              <div key={step} className="flex items-center flex-1">
                <button
                  onClick={() => handleGoToStep(step)}
                  className={`auto-step ${currentStep === step ? 'active' : ''} ${
                    isStepComplete(step) && currentStep !== step ? 'completed' : ''
                  }`}
                >
                  {isStepComplete(step) && currentStep > step ? (
                    <span className="text-white font-bold">✓</span>
                  ) : (
                    <span>{step}</span>
                  )}
                </button>
                {step < 5 && (
                  <div
                    className="auto-step-connector flex-1 mx-2"
                    style={{
                      backgroundColor:
                        isStepComplete(step) && currentStep > step
                          ? 'var(--accent)'
                          : 'var(--border)',
                    }}
                  />
                )}
              </div>
            ))}
          </div>
          <div className="mt-4 flex justify-between text-sm" style={{ color: 'var(--foreground-muted)' }}>
            <span>בחר טריגר</span>
            <span>הגדר תנאים</span>
            <span>בחר פעולה</span>
            <span>מצב אישור</span>
            <span>סיכום ושמירה</span>
          </div>
        </div>

        {/* Step Content */}
        <div key={currentStep} style={{ animation: 'auto-card-enter 0.3s ease-out both' }}>
          {currentStep === 1 && (
            <Step1Trigger
              selectedTrigger={selectedTrigger}
              onSelectTrigger={setSelectedTrigger}
            />
          )}
          {currentStep === 2 && (
            <Step2Conditions
              conditions={conditions}
              onAddCondition={handleAddCondition}
              onRemoveCondition={handleRemoveCondition}
              onUpdateCondition={handleUpdateCondition}
            />
          )}
          {currentStep === 3 && (
            <Step3Action
              selectedAction={selectedAction}
              onSelectAction={setSelectedAction}
            />
          )}
          {currentStep === 4 && (
            <Step4ApprovalMode
              approvalMode={approvalMode}
              onSelectApprovalMode={setApprovalMode}
            />
          )}
          {currentStep === 5 && (
            <Step5Review
              name={name}
              description={description}
              selectedTrigger={selectedTrigger}
              conditions={conditions}
              selectedAction={selectedAction}
              approvalMode={approvalMode}
              onNameChange={setName}
              onDescriptionChange={setDescription}
              onGoToStep={handleGoToStep}
            />
          )}
        </div>
      </div>

      {/* Footer */}
      <div
        className="auto-builder-footer fixed bottom-0 left-0 right-0 p-6 border-t"
        style={{
          backgroundColor: 'rgba(var(--surface-rgb), 0.9)',
          backdropFilter: 'blur(10px)',
          borderColor: 'var(--border)',
        }}
      >
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <button
            onClick={handleBack}
            disabled={currentStep === 1}
            className="px-6 py-3 rounded-lg font-medium transition-all"
            style={{
              backgroundColor: 'var(--surface)',
              color: 'var(--foreground)',
              border: '1px solid var(--border)',
              opacity: currentStep === 1 ? 0.5 : 1,
              cursor: currentStep === 1 ? 'not-allowed' : 'pointer',
            }}
          >
            חזור
          </button>

          <span style={{ color: 'var(--foreground-muted)' }}>
            שלב {currentStep} מתוך 5
          </span>

          <button
            onClick={() => {
              if (currentStep === 5) {
                handleSave(false);
              } else {
                handleNext();
              }
            }}
            disabled={!isStepComplete(currentStep) || isSaving}
            className="px-6 py-3 rounded-lg font-medium text-white transition-all"
            style={{
              backgroundColor: 'var(--accent)',
              opacity: !isStepComplete(currentStep) || isSaving ? 0.5 : 1,
              cursor: !isStepComplete(currentStep) || isSaving ? 'not-allowed' : 'pointer',
            }}
          >
            {currentStep === 5 ? 'סיים' : 'הבא'}
          </button>
        </div>
      </div>
    </div>
  );
}

interface Step1TriggerProps {
  selectedTrigger: TriggerType | null;
  onSelectTrigger: (trigger: TriggerType) => void;
}

function Step1Trigger({ selectedTrigger, onSelectTrigger }: Step1TriggerProps) {
  return (
    <div>
      <h2 className="text-3xl font-bold mb-2" style={{ color: 'var(--foreground)' }}>
        בחר טריגר
      </h2>
      <p className="mb-8" style={{ color: 'var(--foreground-muted)' }}>
        בחר את האירוע שיגרום להפעלת האוטומציה
      </p>

      <div className="space-y-8">
        {Object.entries(TRIGGER_CATEGORIES).map(([catKey, category]) => (
          <div key={catKey}>
            <h3
              className="text-lg font-semibold mb-4"
              style={{ color: 'var(--foreground)' }}
            >
              {category.label}
            </h3>
            <div className="grid grid-cols-2 gap-4">
              {Object.entries(category.triggers).map(([triggerKey, trigger]) => {
                const isSelected = selectedTrigger === triggerKey;
                return (
                  <button
                    key={triggerKey}
                    onClick={() => onSelectTrigger(triggerKey as TriggerType)}
                    className="auto-trigger-card p-6 rounded-lg text-right transition-all"
                    style={{
                      backgroundColor: 'var(--surface)',
                      borderColor: isSelected ? 'var(--accent)' : 'var(--border)',
                      border: isSelected ? '2px solid var(--accent)' : '1px solid var(--border)',
                      boxShadow: isSelected ? `0 0 0 4px rgba(var(--accent-rgb), 0.1)` : 'none',
                    }}
                  >
                    <div className="text-4xl mb-3">{trigger.icon}</div>
                    <h4 className="font-bold mb-1" style={{ color: 'var(--foreground)' }}>
                      {trigger.title}
                    </h4>
                    <p className="text-sm" style={{ color: 'var(--foreground-muted)' }}>
                      {trigger.desc}
                    </p>
                    {isSelected && (
                      <div className="mt-3 text-accent" style={{ color: 'var(--accent)' }}>
                        ✓ נבחר
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

interface Step2ConditionsProps {
  conditions: Condition[];
  onAddCondition: () => void;
  onRemoveCondition: (id: string) => void;
  onUpdateCondition: (id: string, key: 'field' | 'operator' | 'value', value: string) => void;
}

function Step2Conditions({
  conditions,
  onAddCondition,
  onRemoveCondition,
  onUpdateCondition,
}: Step2ConditionsProps) {
  return (
    <div>
      <h2 className="text-3xl font-bold mb-2" style={{ color: 'var(--foreground)' }}>
        הגדר תנאים
      </h2>
      <p className="mb-8" style={{ color: 'var(--foreground-muted)' }}>
        תנאים מאפשרים לסנן מתי האוטומציה תופעל
      </p>

      <div className="premium-card rounded-lg p-6 mb-6" style={{ backgroundColor: 'var(--surface)' }}>
        {conditions.length === 0 ? (
          <p className="text-center py-8" style={{ color: 'var(--foreground-muted)' }}>
            אין תנאים — האוטומציה תופעל תמיד
          </p>
        ) : (
          <div className="space-y-4">
            {conditions.map((condition) => (
              <div key={condition.id} className="flex gap-3 items-end">
                <select
                  value={condition.field}
                  onChange={(e) => onUpdateCondition(condition.id, 'field', e.target.value)}
                  className="flex-1 px-4 py-2 rounded-lg border"
                  style={{
                    backgroundColor: 'var(--background)',
                    borderColor: 'var(--border)',
                    color: 'var(--foreground)',
                  }}
                >
                  {CONDITION_FIELDS.map((field) => (
                    <option key={field} value={field}>
                      {field}
                    </option>
                  ))}
                </select>

                <select
                  value={condition.operator}
                  onChange={(e) => onUpdateCondition(condition.id, 'operator', e.target.value)}
                  className="flex-1 px-4 py-2 rounded-lg border"
                  style={{
                    backgroundColor: 'var(--background)',
                    borderColor: 'var(--border)',
                    color: 'var(--foreground)',
                  }}
                >
                  {OPERATORS.map((op) => (
                    <option key={op} value={op}>
                      {op}
                    </option>
                  ))}
                </select>

                <input
                  type="text"
                  value={condition.value}
                  onChange={(e) => onUpdateCondition(condition.id, 'value', e.target.value)}
                  placeholder="ערך"
                  className="flex-1 px-4 py-2 rounded-lg border"
                  style={{
                    backgroundColor: 'var(--background)',
                    borderColor: 'var(--border)',
                    color: 'var(--foreground)',
                  }}
                />

                <button
                  onClick={() => onRemoveCondition(condition.id)}
                  className="px-3 py-2 rounded-lg transition-all text-white"
                  style={{ backgroundColor: '#ef4444' }}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}

        <button
          onClick={onAddCondition}
          className="mt-6 px-4 py-2 rounded-lg font-medium transition-all"
          style={{
            backgroundColor: 'var(--background)',
            color: 'var(--accent)',
            border: '1px solid var(--accent)',
          }}
        >
          + הוסף תנאי
        </button>
      </div>
    </div>
  );
}

interface Step3ActionProps {
  selectedAction: ActionType | null;
  onSelectAction: (action: ActionType) => void;
}

function Step3Action({ selectedAction, onSelectAction }: Step3ActionProps) {
  return (
    <div>
      <h2 className="text-3xl font-bold mb-2" style={{ color: 'var(--foreground)' }}>
        בחר פעולה
      </h2>
      <p className="mb-8" style={{ color: 'var(--foreground-muted)' }}>
        בחר את הפעולה שתבוצע כאשר הטריגר מופעל
      </p>

      <div className="grid grid-cols-2 gap-4">
        {Object.entries(ACTIONS).map(([actionKey, action]) => {
          const isSelected = selectedAction === actionKey;
          return (
            <button
              key={actionKey}
              onClick={() => onSelectAction(actionKey as ActionType)}
              className="auto-action-card p-6 rounded-lg text-right transition-all"
              style={{
                backgroundColor: 'var(--surface)',
                borderColor: isSelected ? 'var(--accent)' : 'var(--border)',
                border: isSelected ? '2px solid var(--accent)' : '1px solid var(--border)',
                boxShadow: isSelected ? `0 0 0 4px rgba(var(--accent-rgb), 0.1)` : 'none',
              }}
            >
              <div className="text-4xl mb-3">{action.icon}</div>
              <h4 className="font-bold mb-1" style={{ color: 'var(--foreground)' }}>
                {action.title}
              </h4>
              <p className="text-sm" style={{ color: 'var(--foreground-muted)' }}>
                {action.desc}
              </p>
              {isSelected && (
                <div className="mt-3" style={{ color: 'var(--accent)' }}>
                  ✓ נבחר
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

interface Step4ApprovalModeProps {
  approvalMode: ApprovalMode;
  onSelectApprovalMode: (mode: ApprovalMode) => void;
}

function Step4ApprovalMode({
  approvalMode,
  onSelectApprovalMode,
}: Step4ApprovalModeProps) {
  return (
    <div>
      <h2 className="text-3xl font-bold mb-2" style={{ color: 'var(--foreground)' }}>
        מצב אישור
      </h2>
      <p className="mb-8" style={{ color: 'var(--foreground-muted)' }}>
        בחר כיצד יש להפעיל את הפעולה
      </p>

      <div className="space-y-4 max-w-2xl">
        {(Object.entries(APPROVAL_MODES) as Array<[ApprovalMode, typeof APPROVAL_MODES.auto_safe]>).map(
          ([modeKey, mode]) => {
            const isSelected = approvalMode === modeKey;
            return (
              <button
                key={modeKey}
                onClick={() => onSelectApprovalMode(modeKey)}
                className="premium-card rounded-lg p-6 text-right transition-all w-full"
                style={{
                  backgroundColor: 'var(--surface)',
                  borderColor: isSelected ? 'var(--accent)' : 'var(--border)',
                  border: isSelected ? '2px solid var(--accent)' : '1px solid var(--border)',
                }}
              >
                <div className="flex items-start gap-4">
                  <div
                    className="flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-2xl"
                    style={{ backgroundColor: 'var(--background)' }}
                  >
                    {mode.icon}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-2">
                      <h4
                        className="font-bold text-lg"
                        style={{ color: 'var(--foreground)' }}
                      >
                        {mode.title}
                      </h4>
                      {isSelected && (
                        <span style={{ color: 'var(--accent)' }}>✓</span>
                      )}
                    </div>
                    <p
                      className="text-sm mb-3"
                      style={{ color: 'var(--foreground-muted)' }}
                    >
                      {mode.desc}
                    </p>
                    <span
                      className="inline-block text-xs font-semibold px-3 py-1 rounded-full"
                      style={{
                        backgroundColor: 'var(--background)',
                        color: 'var(--foreground-muted)',
                      }}
                    >
                      {mode.badge}
                    </span>
                  </div>
                </div>
              </button>
            );
          }
        )}
      </div>
    </div>
  );
}

interface Step5ReviewProps {
  name: string;
  description: string;
  selectedTrigger: TriggerType | null;
  conditions: Condition[];
  selectedAction: ActionType | null;
  approvalMode: ApprovalMode;
  onNameChange: (name: string) => void;
  onDescriptionChange: (desc: string) => void;
  onGoToStep: (step: Step) => void;
}

function Step5Review({
  name,
  description,
  selectedTrigger,
  conditions,
  selectedAction,
  approvalMode,
  onNameChange,
  onDescriptionChange,
  onGoToStep,
}: Step5ReviewProps) {
  const router = useRouter();
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async (asDraft: boolean) => {
    if (!selectedTrigger || !selectedAction || !name.trim()) {
      alert('אנא מלא את כל השדות הנדרשים');
      return;
    }

    setIsSaving(true);
    try {
      const payload = {
        name,
        description,
        trigger: selectedTrigger,
        action: selectedAction,
        conditions: conditions.length > 0 ? JSON.stringify(conditions) : '',
        approvalMode,
        isActive: !asDraft,
      };

      const response = await fetch('/api/data/automation-rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) throw new Error('Failed to save automation');

      router.push('/automations');
    } catch (error) {
      console.error('Save failed:', error);
      alert('שגיאה בשמירת האוטומציה');
    } finally {
      setIsSaving(false);
    }
  };

  const getTriggerLabel = (): string => {
    for (const category of Object.values(TRIGGER_CATEGORIES)) {
      if (selectedTrigger && selectedTrigger in category.triggers) {
        return category.triggers[selectedTrigger as keyof typeof category.triggers].title;
      }
    }
    return selectedTrigger || '';
  };

  const getActionLabel = (): string => {
    return selectedAction ? ACTIONS[selectedAction].title : '';
  };

  const getApprovalLabel = (): string => {
    return APPROVAL_MODES[approvalMode].title;
  };

  return (
    <div>
      <h2 className="text-3xl font-bold mb-2" style={{ color: 'var(--foreground)' }}>
        סיכום ושמירה
      </h2>
      <p className="mb-8" style={{ color: 'var(--foreground-muted)' }}>
        בדוק את פרטי האוטומציה שלך
      </p>

      <div className="premium-card rounded-lg p-8 mb-8" style={{ backgroundColor: 'var(--surface)' }}>
        <div className="mb-8">
          <label className="block text-sm font-semibold mb-2" style={{ color: 'var(--foreground)' }}>
            שם האוטומציה
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => onNameChange(e.target.value)}
            placeholder="שם האוטומציה"
            className="w-full px-4 py-3 rounded-lg border text-lg"
            style={{
              backgroundColor: 'var(--background)',
              borderColor: 'var(--border)',
              color: 'var(--foreground)',
            }}
          />
        </div>

        <div className="mb-8">
          <label className="block text-sm font-semibold mb-2" style={{ color: 'var(--foreground)' }}>
            תיאור קצר
          </label>
          <textarea
            value={description}
            onChange={(e) => onDescriptionChange(e.target.value)}
            placeholder="תיאור קצר"
            rows={3}
            className="w-full px-4 py-3 rounded-lg border"
            style={{
              backgroundColor: 'var(--background)',
              borderColor: 'var(--border)',
              color: 'var(--foreground)',
            }}
          />
        </div>

        <div className="space-y-6 pt-6 border-t" style={{ borderColor: 'var(--border)' }}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold" style={{ color: 'var(--foreground-muted)' }}>
                טריגר
              </p>
              <p className="text-lg font-bold mt-1" style={{ color: 'var(--foreground)' }}>
                {getTriggerLabel()}
              </p>
            </div>
            <button
              onClick={() => onGoToStep(1)}
              className="text-sm font-medium"
              style={{ color: 'var(--accent)' }}
            >
              ערוך
            </button>
          </div>

          {conditions.length > 0 && (
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold" style={{ color: 'var(--foreground-muted)' }}>
                  תנאים
                </p>
                <p className="text-lg font-bold mt-1" style={{ color: 'var(--foreground)' }}>
                  {conditions.length} תנאי{conditions.length > 1 ? 'ים' : ''}
                </p>
              </div>
              <button
                onClick={() => onGoToStep(2)}
                className="text-sm font-medium"
                style={{ color: 'var(--accent)' }}
              >
                ערוך
              </button>
            </div>
          )}

          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold" style={{ color: 'var(--foreground-muted)' }}>
                פעולה
              </p>
              <p className="text-lg font-bold mt-1" style={{ color: 'var(--foreground)' }}>
                {getActionLabel()}
              </p>
            </div>
            <button
              onClick={() => onGoToStep(3)}
              className="text-sm font-medium"
              style={{ color: 'var(--accent)' }}
            >
              ערוך
            </button>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold" style={{ color: 'var(--foreground-muted)' }}>
                מצב אישור
              </p>
              <p className="text-lg font-bold mt-1" style={{ color: 'var(--foreground)' }}>
                {getApprovalLabel()}
              </p>
            </div>
            <button
              onClick={() => onGoToStep(4)}
              className="text-sm font-medium"
              style={{ color: 'var(--accent)' }}
            >
              ערוך
            </button>
          </div>
        </div>
      </div>

      <div className="flex gap-4">
        <button
          onClick={() => handleSave(true)}
          disabled={isSaving}
          className="flex-1 px-6 py-3 rounded-lg font-medium transition-all"
          style={{
            backgroundColor: 'var(--surface)',
            color: 'var(--foreground)',
            border: '1px solid var(--border)',
            opacity: isSaving ? 0.5 : 1,
            cursor: isSaving ? 'not-allowed' : 'pointer',
          }}
        >
          שמור כטיוטה
        </button>
        <button
          onClick={() => handleSave(false)}
          disabled={isSaving}
          className="flex-1 px-6 py-3 rounded-lg font-medium text-white transition-all"
          style={{
            backgroundColor: 'var(--accent)',
            opacity: isSaving ? 0.5 : 1,
            cursor: isSaving ? 'not-allowed' : 'pointer',
          }}
        >
          {isSaving ? 'שומר...' : 'הפעל אוטומציה'}
        </button>
      </div>
    </div>
  );
}
