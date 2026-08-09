'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect, useCallback, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useToast } from '@/components/ui/toast';
import { LoadingState } from '@/components/ui/saas-kit';
import type {
  Proposal,
  ProposalSection,
  ProposalItem,
  ProposalTemplate,
  ProposalPricingType,
  ProposalDiscountType,
  ProposalStatus,
} from '@/lib/db/schema';

/* ═══════════════════════════════════════════════════════
   CONSTANTS
   ═══════════════════════════════════════════════════════ */

const STEPS = [
  { num: 1, label: 'לקוח' },
  { num: 2, label: 'שירותים' },
  { num: 3, label: 'מחיר ותנאים' },
  { num: 4, label: 'תצוגה מקדימה' },
  { num: 5, label: 'פרסום' },
];

/* ═══════════════════════════════════════════════════════
   TYPES
   ═══════════════════════════════════════════════════════ */

interface ClientInfo {
  id: string;
  name: string;
  company: string;
  status: string;
}

interface WizardData {
  clientId: string;
  clientName: string;
  clientEmail: string;
  clientPhone: string;
  clientContactPerson: string;
  clientBusinessName: string;
  isNewClient: boolean;
  title: string;
  templateId: string;
  intro: string;
  sections: ProposalSection[];
  pricingType: ProposalPricingType;
  price: number;
  discount: number;
  discountType: ProposalDiscountType;
  vatRate: number;
  includeVat: boolean;
  paymentTerms: string;
  customPaymentTerms: string;
  contractPeriod: string;
  generalTerms: string[];
  notes: string;
}

const DEFAULT_DATA: WizardData = {
  clientId: '',
  clientName: '',
  clientEmail: '',
  clientPhone: '',
  clientContactPerson: '',
  clientBusinessName: '',
  isNewClient: false,
  title: '',
  templateId: '',
  intro: '',
  sections: [],
  pricingType: 'retainer',
  price: 0,
  discount: 0,
  discountType: 'percent',
  vatRate: 18,
  includeVat: false,
  paymentTerms: '',
  customPaymentTerms: '',
  contractPeriod:
    'כל צד רשאי להביא את ההתקשרות לסיומה בהודעה מוקדמת של 30 ימים.',
  generalTerms: [],
  notes: '',
};

/* ═══════════════════════════════════════════════════════
   HELPERS
   ═══════════════════════════════════════════════════════ */

function uid(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

/* ═══════════════════════════════════════════════════════
   SHARED STYLES
   ═══════════════════════════════════════════════════════ */

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '0.65rem 0.9rem',
  borderRadius: 10,
  border: '1px solid var(--border)',
  background: 'var(--surface)',
  color: 'var(--foreground)',
  fontSize: '0.9rem',
  fontFamily: 'inherit',
  outline: 'none',
  transition: 'border-color 0.2s',
  boxSizing: 'border-box',
};

const cardStyle: React.CSSProperties = {
  background: 'var(--surface-raised)',
  border: '1px solid var(--border)',
  borderRadius: 16,
  padding: '1.25rem',
};

const labelStyle: React.CSSProperties = {
  fontSize: '0.82rem',
  fontWeight: 700,
  color: 'var(--foreground-muted)',
  marginBottom: 6,
  display: 'block',
};

const ghostBtnStyle: React.CSSProperties = {
  padding: '0.6rem 1.5rem',
  borderRadius: 10,
  border: '1px solid var(--border)',
  background: 'transparent',
  color: 'var(--foreground)',
  fontSize: '0.9rem',
  fontWeight: 600,
  cursor: 'pointer',
  fontFamily: 'inherit',
};

const primaryBtnStyle: React.CSSProperties = {
  padding: '0.6rem 1.5rem',
  borderRadius: 10,
  border: 'none',
  background: 'var(--accent)',
  color: '#fff',
  fontSize: '0.9rem',
  fontWeight: 700,
  cursor: 'pointer',
  fontFamily: 'inherit',
};

/* ═══════════════════════════════════════════════════════
   INNER WIZARD (uses useSearchParams — needs Suspense)
   ═══════════════════════════════════════════════════════ */

function ProposalWizardInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const toast = useToast();
  const editId = searchParams.get('id');

  /* ── State ──────────────────────────────────────────────── */
  const [step, setStep] = useState(1);
  const [data, setData] = useState<WizardData>({ ...DEFAULT_DATA });
  const [clients, setClients] = useState<ClientInfo[]>([]);
  const [templates, setTemplates] = useState<ProposalTemplate[]>([]);
  const [proposalId, setProposalId] = useState<string | null>(null);
  const [publicToken, setPublicToken] = useState('');
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [isReadOnly, setIsReadOnly] = useState(false);
  const [published, setPublished] = useState(false);
  const [loading, setLoading] = useState(true);
  const [clientSearch, setClientSearch] = useState('');
  const [showDiscount, setShowDiscount] = useState(false);
  const savingRef = useRef(false);

  /* ── Fetch initial data ─────────────────────────────────── */
  useEffect(() => {
    let cancelled = false;
    async function init() {
      try {
        const [clientsRes, templatesRes] = await Promise.all([
          fetch('/api/data/clients'),
          fetch('/api/data/proposal-templates'),
        ]);
        const clientsJson = await clientsRes.json();
        const templatesJson = await templatesRes.json();

        if (cancelled) return;
        setClients(Array.isArray(clientsJson) ? clientsJson : []);
        setTemplates(Array.isArray(templatesJson) ? templatesJson : []);

        /* Edit mode — load existing proposal */
        if (editId) {
          const allRes = await fetch('/api/data/proposals');
          const allProposals: Proposal[] = await allRes.json();
          const existing = allProposals.find((p) => p.id === editId);

          if (existing && !cancelled) {
            setProposalId(existing.id);
            setPublicToken(existing.publicToken ?? '');
            setData({
              clientId: existing.clientId ?? '',
              clientName: existing.clientName ?? '',
              clientEmail: existing.clientEmail ?? '',
              clientPhone: existing.clientPhone ?? '',
              clientContactPerson: existing.clientContactPerson ?? '',
              clientBusinessName: existing.clientBusinessName ?? '',
              isNewClient: !existing.clientId || existing.clientId === '__new__',
              title: existing.title ?? '',
              templateId: existing.templateId ?? '',
              intro: existing.intro ?? '',
              sections: existing.sections ?? [],
              pricingType: existing.pricingType ?? 'retainer',
              price: existing.price ?? 0,
              discount: existing.discount ?? 0,
              discountType: existing.discountType ?? 'percent',
              vatRate: existing.vatRate ?? 18,
              includeVat: existing.includeVat ?? false,
              paymentTerms: existing.paymentTerms ?? '',
              customPaymentTerms: existing.customPaymentTerms ?? '',
              contractPeriod: existing.contractPeriod ?? DEFAULT_DATA.contractPeriod,
              generalTerms: existing.generalTerms ?? [],
              notes: existing.notes ?? '',
            });
            if ((existing.discount ?? 0) > 0) setShowDiscount(true);
            if (existing.status === 'approved') setIsReadOnly(true);
            if (existing.status === 'published' || existing.status === 'viewed') {
              setPublished(true);
            }
          }
        }
      } catch (e) {
        console.error('[ProposalWizard] init error:', e);
        if (!cancelled) toast('שגיאה בטעינת נתונים', 'error');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    init();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editId]);

  /* ── Update helper ──────────────────────────────────────── */
  const updateData = useCallback(
    (partial: Partial<WizardData>) => setData((prev) => ({ ...prev, ...partial })),
    [],
  );

  /* ── Autosave ───────────────────────────────────────────── */
  const saveProposal = useCallback(
    async (d: WizardData, id: string | null): Promise<string | null> => {
      if (savingRef.current || isReadOnly) return id;
      savingRef.current = true;
      setSaving(true);
      try {
        const payload: Record<string, unknown> = { ...d };
        if (id) payload.id = id;
        const method = id ? 'PUT' : 'POST';
        const res = await fetch('/api/data/proposals', {
          method,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error('Save failed');
        const result = await res.json();
        if (!id && result.id) {
          setProposalId(result.id);
          setPublicToken(result.publicToken ?? '');
        }
        setLastSaved(new Date());
        return result.id ?? id;
      } catch {
        toast('שגיאה בשמירת הטיוטה', 'error');
        return id;
      } finally {
        setSaving(false);
        savingRef.current = false;
      }
    },
    [isReadOnly, toast],
  );

  /* ── Validation ─────────────────────────────────────────── */
  const validateStep = (s: number): boolean => {
    switch (s) {
      case 1:
        if (data.isNewClient) {
          if (!data.clientName.trim()) {
            toast('יש להזין שם לקוח', 'warning');
            return false;
          }
        } else {
          if (!data.clientId) {
            toast('יש לבחור לקוח', 'warning');
            return false;
          }
        }
        if (!data.title.trim()) {
          toast('יש להזין כותרת להצעה', 'warning');
          return false;
        }
        return true;
      case 2:
        if (data.sections.length === 0) {
          toast('יש להוסיף לפחות קבוצת שירות אחת', 'warning');
          return false;
        }
        return true;
      case 3:
        if (data.price <= 0) {
          toast('יש להזין מחיר', 'warning');
          return false;
        }
        return true;
      case 4:
        return true;
      default:
        return true;
    }
  };

  /* ── Navigation ─────────────────────────────────────────── */
  const goNext = async () => {
    if (!validateStep(step)) return;
    const newId = await saveProposal(data, proposalId);
    if (newId) setProposalId(newId);
    setStep((prev) => Math.min(prev + 1, 5));
  };

  const goBack = () => setStep((prev) => Math.max(prev - 1, 1));

  const goToStep = async (target: number) => {
    /* Only allow jumping to completed steps */
    if (target >= step) return;
    setStep(target);
  };

  /* ── Publish ────────────────────────────────────────────── */
  const handlePublish = async () => {
    let currentId = proposalId;
    if (!currentId) {
      currentId = await saveProposal(data, null);
      if (!currentId) {
        toast('יש לשמור את ההצעה לפני הפרסום', 'warning');
        return;
      }
    } else {
      await saveProposal(data, currentId);
    }
    try {
      const res = await fetch('/api/proposals/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ proposalId: currentId }),
      });
      if (!res.ok) throw new Error();
      const result = await res.json();
      setPublicToken(result.publicToken ?? publicToken);
      setPublished(true);
      toast('ההצעה פורסמה בהצלחה!', 'success');
    } catch {
      toast('שגיאה בפרסום ההצעה', 'error');
    }
  };

  const handleSaveDraft = async () => {
    const newId = await saveProposal(data, proposalId);
    if (newId) {
      setProposalId(newId);
      toast('הטיוטה נשמרה בהצלחה', 'success');
    }
  };

  /* ── Template selection ─────────────────────────────────── */
  const selectTemplate = (t: ProposalTemplate) => {
    const sections: ProposalSection[] = t.sections.map((s, si) => ({
      id: uid(),
      title: s.title,
      order: si,
      items: s.items.map((text, ii) => ({
        id: uid(),
        text,
        included: true,
        order: ii,
      })),
    }));
    const intro = t.intro.replace(
      /\[שם הלקוח\]/g,
      data.clientName || '___',
    );
    updateData({
      templateId: t.id,
      intro,
      sections,
      pricingType: t.category,
      paymentTerms: t.paymentTermsTemplate ?? '',
      generalTerms: t.generalTerms ?? [],
    });
  };

  /* ── Section / Item editing ─────────────────────────────── */
  const updateSection = (sectionId: string, updates: Partial<ProposalSection>) => {
    updateData({
      sections: data.sections.map((s) =>
        s.id === sectionId ? { ...s, ...updates } : s,
      ),
    });
  };

  const deleteSection = (sectionId: string) => {
    updateData({
      sections: data.sections
        .filter((s) => s.id !== sectionId)
        .map((s, i) => ({ ...s, order: i })),
    });
  };

  const addSection = () => {
    updateData({
      sections: [
        ...data.sections,
        {
          id: uid(),
          title: 'קבוצת שירות חדשה',
          items: [],
          order: data.sections.length,
        },
      ],
    });
  };

  const updateItem = (
    sectionId: string,
    itemId: string,
    updates: Partial<ProposalItem>,
  ) => {
    updateData({
      sections: data.sections.map((s) => {
        if (s.id !== sectionId) return s;
        return {
          ...s,
          items: s.items.map((it) =>
            it.id === itemId ? { ...it, ...updates } : it,
          ),
        };
      }),
    });
  };

  const deleteItem = (sectionId: string, itemId: string) => {
    updateData({
      sections: data.sections.map((s) => {
        if (s.id !== sectionId) return s;
        return {
          ...s,
          items: s.items
            .filter((it) => it.id !== itemId)
            .map((it, i) => ({ ...it, order: i })),
        };
      }),
    });
  };

  const addItem = (sectionId: string) => {
    const section = data.sections.find((s) => s.id === sectionId);
    if (!section) return;
    updateSection(sectionId, {
      items: [
        ...section.items,
        { id: uid(), text: '', included: true, order: section.items.length },
      ],
    });
  };

  const moveItem = (
    sectionId: string,
    itemId: string,
    dir: 'up' | 'down',
  ) => {
    const section = data.sections.find((s) => s.id === sectionId);
    if (!section) return;
    const idx = section.items.findIndex((it) => it.id === itemId);
    if (idx < 0) return;
    const target = dir === 'up' ? idx - 1 : idx + 1;
    if (target < 0 || target >= section.items.length) return;
    const items = [...section.items];
    [items[idx], items[target]] = [items[target], items[idx]];
    items.forEach((it, i) => (it.order = i));
    updateSection(sectionId, { items });
  };

  /* ── Price calculations ─────────────────────────────────── */
  const calcDiscount = (): number => {
    if (data.discount <= 0) return 0;
    return data.discountType === 'percent'
      ? data.price * (data.discount / 100)
      : data.discount;
  };

  const priceAfterDiscount = Math.max(data.price - calcDiscount(), 0);
  const vatAmount = data.includeVat
    ? 0
    : priceAfterDiscount * (data.vatRate / 100);
  const totalPrice = priceAfterDiscount + vatAmount;

  /* ── Computed values ────────────────────────────────────── */
  const proposalUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}/proposal/${publicToken}`
      : `/proposal/${publicToken}`;

  /* ═══════════════════════════════════════════════════════
     RENDER: STEP INDICATOR
     ═══════════════════════════════════════════════════════ */

  const renderStepIndicator = () => (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 0,
        marginBottom: '2rem',
        padding: '1.5rem 1rem',
        background: 'var(--surface-raised)',
        borderRadius: 16,
        border: '1px solid var(--border)',
        overflowX: 'auto',
      }}
    >
      {STEPS.map((s, i) => {
        const isActive = step === s.num;
        const isCompleted = step > s.num;

        const circleBackground = isActive
          ? 'var(--accent)'
          : isCompleted
            ? '#22c55e'
            : 'var(--border)';
        const textColor = isActive
          ? 'var(--accent)'
          : isCompleted
            ? '#22c55e'
            : 'var(--foreground-muted)';
        const lineColor = isCompleted ? '#22c55e' : 'var(--border)';

        return (
          <div key={s.num} style={{ display: 'flex', alignItems: 'center' }}>
            {/* Connector line (not before first) */}
            {i > 0 && (
              <div
                style={{
                  width: 48,
                  height: 2,
                  background: lineColor,
                  transition: 'background 0.3s',
                  flexShrink: 0,
                }}
              />
            )}

            {/* Circle + label */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 6,
                cursor: isCompleted ? 'pointer' : 'default',
                flexShrink: 0,
              }}
              onClick={() => {
                if (isCompleted) goToStep(s.num);
              }}
            >
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: '50%',
                  background: circleBackground,
                  color:
                    isActive || isCompleted ? '#fff' : 'var(--foreground-muted)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '0.85rem',
                  fontWeight: 700,
                  transition: 'all 0.3s',
                  boxShadow: isActive
                    ? '0 0 0 4px rgba(0,181,254,0.2)'
                    : 'none',
                }}
              >
                {isCompleted ? '✓' : s.num}
              </div>
              <span
                style={{
                  fontSize: '0.73rem',
                  fontWeight: 600,
                  color: textColor,
                  whiteSpace: 'nowrap',
                  transition: 'color 0.3s',
                }}
              >
                {s.label}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );

  /* ═══════════════════════════════════════════════════════
     RENDER: STEP 1 — CLIENT
     ═══════════════════════════════════════════════════════ */

  const renderStep1 = () => {
    const filtered = clients.filter((c) => {
      if (!clientSearch.trim()) return true;
      const q = clientSearch.trim().toLowerCase();
      return (
        (c.name ?? '').toLowerCase().includes(q) ||
        (c.company ?? '').toLowerCase().includes(q)
      );
    });

    const tabBtnStyle = (active: boolean): React.CSSProperties => ({
      flex: 1,
      padding: '0.7rem 1rem',
      borderRadius: 10,
      border: 'none',
      background: active ? 'var(--accent)' : 'transparent',
      color: active ? '#fff' : 'var(--foreground-muted)',
      fontSize: '0.9rem',
      fontWeight: 700,
      cursor: isReadOnly ? 'default' : 'pointer',
      fontFamily: 'inherit',
      transition: 'all 0.2s',
    });

    const showTitleField = data.isNewClient ? data.clientName.trim() : data.clientId;

    return (
      <div>
        <h2
          style={{
            fontSize: '1.3rem',
            fontWeight: 700,
            color: 'var(--foreground)',
            marginBottom: '1rem',
          }}
        >
          פרטי לקוח
        </h2>

        {/* Toggle: New / Existing */}
        <div
          style={{
            display: 'flex',
            gap: 4,
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 12,
            padding: 4,
            marginBottom: '1.25rem',
          }}
        >
          <button
            type="button"
            style={tabBtnStyle(data.isNewClient)}
            onClick={() => {
              if (isReadOnly) return;
              updateData({
                isNewClient: true,
                clientId: '__new__',
              });
            }}
          >
            + לקוח חדש
          </button>
          <button
            type="button"
            style={tabBtnStyle(!data.isNewClient)}
            onClick={() => {
              if (isReadOnly) return;
              updateData({
                isNewClient: false,
                clientId: '',
                clientName: '',
                clientEmail: '',
                clientPhone: '',
                clientContactPerson: '',
                clientBusinessName: '',
              });
            }}
          >
            לקוח קיים
          </button>
        </div>

        {/* ── New client form ─────────────────────────── */}
        {data.isNewClient && (
          <div style={{ ...cardStyle, marginBottom: '1.25rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <div>
                <label style={labelStyle}>שם איש קשר *</label>
                <input
                  type="text"
                  placeholder="ישראל ישראלי"
                  value={data.clientContactPerson}
                  onChange={(e) => {
                    const v = e.target.value;
                    updateData({
                      clientContactPerson: v,
                      clientName: v || data.clientBusinessName,
                    });
                  }}
                  style={inputStyle}
                  readOnly={isReadOnly}
                />
              </div>
              <div>
                <label style={labelStyle}>שם העסק</label>
                <input
                  type="text"
                  placeholder="שם החברה / העסק"
                  value={data.clientBusinessName}
                  onChange={(e) => {
                    const v = e.target.value;
                    updateData({
                      clientBusinessName: v,
                      clientName: v || data.clientContactPerson,
                      title: data.title || (v ? `הצעת מחיר — ${v}` : ''),
                    });
                  }}
                  style={inputStyle}
                  readOnly={isReadOnly}
                />
              </div>
              <div>
                <label style={labelStyle}>אימייל</label>
                <input
                  type="email"
                  placeholder="email@example.com"
                  value={data.clientEmail}
                  onChange={(e) => updateData({ clientEmail: e.target.value })}
                  style={{ ...inputStyle, direction: 'ltr', textAlign: 'right' }}
                  readOnly={isReadOnly}
                />
              </div>
              <div>
                <label style={labelStyle}>טלפון</label>
                <input
                  type="tel"
                  placeholder="050-0000000"
                  value={data.clientPhone}
                  onChange={(e) => updateData({ clientPhone: e.target.value })}
                  style={{ ...inputStyle, direction: 'ltr', textAlign: 'right' }}
                  readOnly={isReadOnly}
                />
              </div>
            </div>
          </div>
        )}

        {/* ── Existing client selection ───────────────── */}
        {!data.isNewClient && (
          <>
            <input
              type="text"
              placeholder="חיפוש לקוח..."
              value={clientSearch}
              onChange={(e) => setClientSearch(e.target.value)}
              style={{ ...inputStyle, marginBottom: '1rem' }}
            />

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
                gap: 12,
              }}
            >
              {filtered.map((c) => {
                const isSelected = data.clientId === c.id;
                return (
                  <div
                    key={c.id}
                    onClick={() => {
                      if (isReadOnly) return;
                      const name = c.name || c.company || '';
                      updateData({
                        clientId: c.id,
                        clientName: name,
                        clientBusinessName: c.company || '',
                        clientContactPerson: c.name || '',
                        title: data.title || `הצעת מחיר — ${name}`,
                      });
                    }}
                    style={{
                      ...cardStyle,
                      cursor: isReadOnly ? 'default' : 'pointer',
                      borderColor: isSelected ? 'var(--accent)' : 'var(--border)',
                      boxShadow: isSelected
                        ? '0 0 0 2px rgba(0,181,254,0.25)'
                        : 'none',
                      transition: 'all 0.2s',
                    }}
                    onMouseEnter={(e) => {
                      if (!isSelected)
                        e.currentTarget.style.borderColor = 'var(--accent)';
                    }}
                    onMouseLeave={(e) => {
                      if (!isSelected)
                        e.currentTarget.style.borderColor = 'var(--border)';
                    }}
                  >
                    <div
                      style={{
                        fontWeight: 700,
                        fontSize: '0.95rem',
                        color: 'var(--foreground)',
                      }}
                    >
                      {c.name || 'ללא שם'}
                    </div>
                    {c.company && (
                      <div
                        style={{
                          fontSize: '0.82rem',
                          color: 'var(--foreground-muted)',
                          marginTop: 2,
                        }}
                      >
                        {c.company}
                      </div>
                    )}
                    {isSelected && (
                      <div
                        style={{
                          marginTop: 6,
                          fontSize: '0.75rem',
                          color: 'var(--accent)',
                          fontWeight: 700,
                        }}
                      >
                        ✓ נבחר
                      </div>
                    )}
                  </div>
                );
              })}

              {filtered.length === 0 && (
                <div
                  style={{
                    gridColumn: '1 / -1',
                    textAlign: 'center',
                    padding: '2rem',
                    color: 'var(--foreground-muted)',
                  }}
                >
                  לא נמצאו לקוחות
                </div>
              )}
            </div>
          </>
        )}

        {/* Title field */}
        {showTitleField && (
          <div style={{ marginTop: '1.5rem' }}>
            <label style={labelStyle}>כותרת ההצעה</label>
            <input
              type="text"
              value={data.title}
              onChange={(e) => updateData({ title: e.target.value })}
              style={inputStyle}
              readOnly={isReadOnly}
            />
          </div>
        )}
      </div>
    );
  };

  /* ═══════════════════════════════════════════════════════
     RENDER: STEP 2 — SERVICES
     ═══════════════════════════════════════════════════════ */

  const renderStep2 = () => (
    <div>
      <h2
        style={{
          fontSize: '1.3rem',
          fontWeight: 700,
          color: 'var(--foreground)',
          marginBottom: '1rem',
        }}
      >
        בחירת תבנית
        ועריכת שירותים
      </h2>

      {/* Template grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
          gap: 12,
          marginBottom: '2rem',
        }}
      >
        {templates.map((t) => {
          const isSelected = data.templateId === t.id;
          return (
            <div
              key={t.id}
              onClick={() => {
                if (!isReadOnly) selectTemplate(t);
              }}
              style={{
                ...cardStyle,
                cursor: isReadOnly ? 'default' : 'pointer',
                borderColor: isSelected ? 'var(--accent)' : 'var(--border)',
                boxShadow: isSelected
                  ? '0 0 0 2px rgba(0,181,254,0.25)'
                  : 'none',
                transition: 'all 0.2s',
              }}
              onMouseEnter={(e) => {
                if (!isSelected)
                  e.currentTarget.style.borderColor = 'var(--accent)';
              }}
              onMouseLeave={(e) => {
                if (!isSelected)
                  e.currentTarget.style.borderColor = 'var(--border)';
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: 6,
                }}
              >
                <span
                  style={{
                    fontSize: '0.75rem',
                    color: 'var(--foreground-muted)',
                    fontWeight: 600,
                  }}
                >
                  #{t.code}
                </span>
                <span
                  style={{
                    fontSize: '0.7rem',
                    fontWeight: 700,
                    padding: '3px 10px',
                    borderRadius: 20,
                    background:
                      t.category === 'retainer'
                        ? 'rgba(0,181,254,0.12)'
                        : 'rgba(240,255,2,0.15)',
                    color:
                      t.category === 'retainer' ? 'var(--accent)' : '#b8a900',
                    border: `1px solid ${
                      t.category === 'retainer'
                        ? 'rgba(0,181,254,0.3)'
                        : 'rgba(240,255,2,0.4)'
                    }`,
                  }}
                >
                  {t.category === 'retainer'
                    ? 'ריטיינר'
                    : 'פרויקט'}
                </span>
              </div>
              <div
                style={{
                  fontWeight: 700,
                  fontSize: '0.92rem',
                  color: 'var(--foreground)',
                }}
              >
                {t.name}
              </div>
              {isSelected && (
                <div
                  style={{
                    marginTop: 8,
                    fontSize: '0.75rem',
                    color: 'var(--accent)',
                    fontWeight: 700,
                  }}
                >
                  ✓ נבחרה
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Intro text */}
      {data.templateId && (
        <div style={{ marginBottom: '1.5rem' }}>
          <label style={labelStyle}>
            טקסט פתיחה
          </label>
          <textarea
            value={data.intro}
            onChange={(e) => updateData({ intro: e.target.value })}
            rows={4}
            style={{ ...inputStyle, resize: 'vertical' }}
            readOnly={isReadOnly}
          />
        </div>
      )}

      {/* Editable sections */}
      {data.sections.map((section, si) => (
        <div key={section.id} style={{ ...cardStyle, marginBottom: 16 }}>
          {/* Section header */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              marginBottom: 12,
            }}
          >
            <input
              type="text"
              value={section.title}
              onChange={(e) =>
                updateSection(section.id, { title: e.target.value })
              }
              style={{
                ...inputStyle,
                fontWeight: 700,
                fontSize: '1rem',
                flex: 1,
              }}
              readOnly={isReadOnly}
            />
            {!isReadOnly && (
              <button
                onClick={() => deleteSection(section.id)}
                style={{
                  ...ghostBtnStyle,
                  color: '#ef4444',
                  borderColor: '#fecaca',
                  padding: '0.4rem 0.8rem',
                  fontSize: '0.8rem',
                }}
              >
                מחיקה
              </button>
            )}
          </div>

          {/* Items */}
          {section.items.map((item, ii) => (
            <div
              key={item.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '0.45rem 0.6rem',
                borderRadius: 8,
                background: item.included ? 'transparent' : 'var(--surface)',
                marginBottom: 4,
                opacity: item.included ? 1 : 0.5,
                transition: 'opacity 0.2s',
              }}
            >
              <input
                type="checkbox"
                checked={item.included}
                onChange={(e) =>
                  updateItem(section.id, item.id, {
                    included: e.target.checked,
                  })
                }
                disabled={isReadOnly}
                style={{
                  accentColor: 'var(--accent)',
                  width: 18,
                  height: 18,
                  cursor: isReadOnly ? 'default' : 'pointer',
                  flexShrink: 0,
                }}
              />
              <input
                type="text"
                value={item.text}
                onChange={(e) =>
                  updateItem(section.id, item.id, { text: e.target.value })
                }
                placeholder="הזינו טקסט..."
                style={{
                  ...inputStyle,
                  flex: 1,
                  border: 'none',
                  background: 'transparent',
                  padding: '0.35rem 0.5rem',
                  textDecoration: item.included ? 'none' : 'line-through',
                }}
                readOnly={isReadOnly}
              />
              {!isReadOnly && (
                <>
                  <button
                    onClick={() => moveItem(section.id, item.id, 'up')}
                    disabled={ii === 0}
                    style={{
                      ...ghostBtnStyle,
                      padding: '0.2rem 0.45rem',
                      fontSize: '0.7rem',
                      opacity: ii === 0 ? 0.3 : 1,
                      cursor: ii === 0 ? 'default' : 'pointer',
                    }}
                    title="העלה"
                  >
                    ▲
                  </button>
                  <button
                    onClick={() => moveItem(section.id, item.id, 'down')}
                    disabled={ii === section.items.length - 1}
                    style={{
                      ...ghostBtnStyle,
                      padding: '0.2rem 0.45rem',
                      fontSize: '0.7rem',
                      opacity: ii === section.items.length - 1 ? 0.3 : 1,
                      cursor:
                        ii === section.items.length - 1
                          ? 'default'
                          : 'pointer',
                    }}
                    title="הורדה"
                  >
                    ▼
                  </button>
                  <button
                    onClick={() => deleteItem(section.id, item.id)}
                    style={{
                      ...ghostBtnStyle,
                      padding: '0.2rem 0.45rem',
                      fontSize: '0.7rem',
                      color: '#ef4444',
                      borderColor: '#fecaca',
                    }}
                    title="מחיקה"
                  >
                    ✕
                  </button>
                </>
              )}
            </div>
          ))}

          {/* Add item button */}
          {!isReadOnly && (
            <button
              onClick={() => addItem(section.id)}
              style={{
                ...ghostBtnStyle,
                marginTop: 8,
                fontSize: '0.82rem',
                color: 'var(--accent)',
                borderColor: 'var(--accent)',
                padding: '0.4rem 1rem',
              }}
            >
              + הוסף פריט
            </button>
          )}
        </div>
      ))}

      {/* Add section button */}
      {!isReadOnly && (
        <button
          onClick={addSection}
          style={{
            ...primaryBtnStyle,
            width: '100%',
            padding: '0.75rem',
            background: 'transparent',
            color: 'var(--accent)',
            border: '2px dashed var(--accent)',
          }}
        >
          + הוסף קבוצת
          שירות
        </button>
      )}
    </div>
  );

  /* ═══════════════════════════════════════════════════════
     RENDER: STEP 3 — PRICE & TERMS
     ═══════════════════════════════════════════════════════ */

  const renderStep3 = () => (
    <div>
      <h2
        style={{
          fontSize: '1.3rem',
          fontWeight: 700,
          color: 'var(--foreground)',
          marginBottom: '1.5rem',
        }}
      >
        מחיר ותנאים
      </h2>

      {/* Pricing type radio cards */}
      <label style={labelStyle}>
        סוג תמחור
      </label>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 12,
          marginBottom: '1.5rem',
        }}
      >
        {(
          [
            {
              value: 'retainer' as const,
              label:
                'ריטיינר חודשי',
            },
            {
              value: 'project' as const,
              label: 'פרויקט',
            },
          ] as const
        ).map((opt) => {
          const isSelected = data.pricingType === opt.value;
          return (
            <div
              key={opt.value}
              onClick={() => {
                if (!isReadOnly) updateData({ pricingType: opt.value });
              }}
              style={{
                ...cardStyle,
                cursor: isReadOnly ? 'default' : 'pointer',
                textAlign: 'center',
                fontWeight: 700,
                fontSize: '0.95rem',
                borderColor: isSelected ? 'var(--accent)' : 'var(--border)',
                background: isSelected
                  ? 'rgba(0,181,254,0.08)'
                  : 'var(--surface-raised)',
                color: isSelected ? 'var(--accent)' : 'var(--foreground)',
                transition: 'all 0.2s',
              }}
            >
              {opt.label}
            </div>
          );
        })}
      </div>

      {/* Price input */}
      <div style={{ marginBottom: '1.25rem' }}>
        <label style={labelStyle}>
          מחיר (₪)
        </label>
        <input
          type="number"
          value={data.price || ''}
          onChange={(e) =>
            updateData({ price: Number(e.target.value) || 0 })
          }
          placeholder="0"
          style={{ ...inputStyle, fontSize: '1.1rem', fontWeight: 700 }}
          readOnly={isReadOnly}
          min={0}
        />
      </div>

      {/* Discount section */}
      <div style={{ marginBottom: '1.25rem' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            marginBottom: 8,
          }}
        >
          <label style={{ ...labelStyle, marginBottom: 0 }}>
            הנחה
          </label>
          {!isReadOnly && (
            <button
              onClick={() => {
                const next = !showDiscount;
                setShowDiscount(next);
                if (!next) updateData({ discount: 0 });
              }}
              style={{
                ...ghostBtnStyle,
                padding: '0.25rem 0.7rem',
                fontSize: '0.75rem',
                color: showDiscount ? '#ef4444' : 'var(--accent)',
                borderColor: showDiscount ? '#fecaca' : 'var(--accent)',
              }}
            >
              {showDiscount
                ? 'ביטול הנחה'
                : 'הוסף הנחה'}
            </button>
          )}
        </div>

        {showDiscount && (
          <div style={{ display: 'flex', gap: 10 }}>
            <input
              type="number"
              value={data.discount || ''}
              onChange={(e) =>
                updateData({ discount: Number(e.target.value) || 0 })
              }
              style={{ ...inputStyle, flex: 1 }}
              readOnly={isReadOnly}
              min={0}
            />
            <select
              value={data.discountType}
              onChange={(e) =>
                updateData({
                  discountType: e.target.value as ProposalDiscountType,
                })
              }
              disabled={isReadOnly}
              style={{
                ...inputStyle,
                width: 130,
                cursor: isReadOnly ? 'default' : 'pointer',
              }}
            >
              <option value="percent">
                אחוז (%)
              </option>
              <option value="amount">
                סכום (₪)
              </option>
            </select>
          </div>
        )}
      </div>

      {/* VAT */}
      <div
        style={{
          marginBottom: '1.25rem',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
        }}
      >
        <label style={{ ...labelStyle, marginBottom: 0 }}>
          מע״מ ({data.vatRate}%)
        </label>
        <label
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            fontSize: '0.85rem',
            color: 'var(--foreground-muted)',
            cursor: isReadOnly ? 'default' : 'pointer',
          }}
        >
          <input
            type="checkbox"
            checked={data.includeVat}
            onChange={(e) => updateData({ includeVat: e.target.checked })}
            disabled={isReadOnly}
            style={{ accentColor: 'var(--accent)' }}
          />
          המחיר כולל
          מע״מ
        </label>
      </div>

      {/* Contract period */}
      <div style={{ marginBottom: '1.25rem' }}>
        <label style={labelStyle}>
          תקופת
          התקשרות
        </label>
        <input
          type="text"
          value={data.contractPeriod}
          onChange={(e) => updateData({ contractPeriod: e.target.value })}
          style={inputStyle}
          readOnly={isReadOnly}
        />
      </div>

      {/* Payment terms */}
      <div style={{ marginBottom: '1.25rem' }}>
        <label style={labelStyle}>
          תנאי תשלום
        </label>
        <textarea
          value={data.paymentTerms}
          onChange={(e) => updateData({ paymentTerms: e.target.value })}
          rows={3}
          style={{ ...inputStyle, resize: 'vertical' }}
          readOnly={isReadOnly}
        />
      </div>

      {/* Custom payment notes */}
      <div style={{ marginBottom: '1.5rem' }}>
        <label style={labelStyle}>
          הערות תשלום
          נוספות
        </label>
        <textarea
          value={data.customPaymentTerms}
          onChange={(e) =>
            updateData({ customPaymentTerms: e.target.value })
          }
          rows={2}
          style={{ ...inputStyle, resize: 'vertical' }}
          readOnly={isReadOnly}
          placeholder="הערות נוספות לתנאי התשלום..."
        />
      </div>

      {/* Live price summary card */}
      <div
        style={{
          ...cardStyle,
          background: 'var(--surface)',
          border: '2px solid var(--accent)',
        }}
      >
        <h3
          style={{
            fontSize: '1rem',
            fontWeight: 700,
            color: 'var(--foreground)',
            marginBottom: 14,
          }}
        >
          סיכום מחיר
        </h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {/* Base price */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              fontSize: '0.9rem',
            }}
          >
            <span style={{ color: 'var(--foreground-muted)' }}>
              מחיר בסיס
            </span>
            <span style={{ fontWeight: 600 }}>
              ₪{data.price.toLocaleString()}
            </span>
          </div>

          {/* Discount */}
          {calcDiscount() > 0 && (
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: '0.9rem',
                color: '#22c55e',
              }}
            >
              <span>
                הנחה
                {data.discountType === 'percent'
                  ? ` (${data.discount}%)`
                  : ''}
              </span>
              <span style={{ fontWeight: 600 }}>
                -₪{calcDiscount().toLocaleString()}
              </span>
            </div>
          )}

          {/* Price after discount */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              fontSize: '0.9rem',
            }}
          >
            <span style={{ color: 'var(--foreground-muted)' }}>
              מחיר לאחר
              הנחה
            </span>
            <span style={{ fontWeight: 600 }}>
              ₪{priceAfterDiscount.toLocaleString()}
            </span>
          </div>

          {/* VAT */}
          {!data.includeVat && (
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: '0.9rem',
              }}
            >
              <span style={{ color: 'var(--foreground-muted)' }}>
                מע״מ ({data.vatRate}%)
              </span>
              <span style={{ fontWeight: 600 }}>
                ₪{vatAmount.toLocaleString()}
              </span>
            </div>
          )}

          {/* Total */}
          <div
            style={{
              borderTop: '1px solid var(--border)',
              paddingTop: 10,
              marginTop: 4,
              display: 'flex',
              justifyContent: 'space-between',
              fontSize: '1.05rem',
            }}
          >
            <span
              style={{ fontWeight: 700, color: 'var(--foreground)' }}
            >
              סה״כ
            </span>
            <span
              style={{
                fontWeight: 700,
                color: 'var(--accent)',
                fontSize: '1.15rem',
              }}
            >
              ₪{totalPrice.toLocaleString()}
              {data.includeVat && (
                <span
                  style={{
                    fontSize: '0.75rem',
                    marginRight: 4,
                    color: 'var(--foreground-muted)',
                  }}
                >
                  (כולל מע״מ)
                </span>
              )}
            </span>
          </div>
        </div>
      </div>
    </div>
  );

  /* ═══════════════════════════════════════════════════════
     RENDER: STEP 4 — PREVIEW
     ═══════════════════════════════════════════════════════ */

  const renderStep4 = () => {
    const includedSections = data.sections
      .map((s) => ({
        ...s,
        items: s.items.filter((it) => it.included),
      }))
      .filter((s) => s.items.length > 0);

    return (
      <div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '1.5rem',
          }}
        >
          <h2
            style={{
              fontSize: '1.3rem',
              fontWeight: 700,
              color: 'var(--foreground)',
            }}
          >
            תצוגה מקדימה
          </h2>
          <button
            onClick={goBack}
            style={{ ...ghostBtnStyle, fontSize: '0.85rem' }}
          >
            חזור לעריכה
          </button>
        </div>

        {/* ── Document preview ────────────────────────── */}
        <div
          dir="rtl"
          style={{
            background: '#fff',
            borderRadius: 16,
            padding: '3rem 2.5rem',
            color: '#1a1a2e',
            maxWidth: 800,
            margin: '0 auto',
            boxShadow: '0 4px 24px rgba(0,0,0,0.08)',
            border: '1px solid #e5e7eb',
          }}
        >
          {/* Studio header */}
          <div
            style={{
              textAlign: 'center',
              borderBottom: '3px solid #00B5FE',
              paddingBottom: '1.5rem',
              marginBottom: '2rem',
            }}
          >
            <div
              style={{
                fontSize: '1.5rem',
                fontWeight: 800,
                color: '#1a1a2e',
                letterSpacing: '-0.02em',
              }}
            >
              Studio Pixel
            </div>
            <div
              style={{
                fontSize: '0.85rem',
                color: '#6b7280',
                marginTop: 4,
              }}
            >
              פתרונות שיווק
              דיגיטלי
            </div>
          </div>

          {/* Title */}
          <h1
            style={{
              fontSize: '1.6rem',
              fontWeight: 800,
              color: '#1a1a2e',
              marginBottom: 8,
              textAlign: 'center',
            }}
          >
            {data.title}
          </h1>
          <div
            style={{
              textAlign: 'center',
              fontSize: '0.9rem',
              color: '#6b7280',
              marginBottom: '2rem',
            }}
          >
            עבור: {data.clientName}
          </div>

          {/* Intro */}
          {data.intro && (
            <div
              style={{
                fontSize: '0.95rem',
                lineHeight: 1.7,
                color: '#374151',
                marginBottom: '2rem',
                whiteSpace: 'pre-wrap',
              }}
            >
              {data.intro}
            </div>
          )}

          {/* Sections */}
          {includedSections.map((section) => (
            <div key={section.id} style={{ marginBottom: '1.5rem' }}>
              <h3
                style={{
                  fontSize: '1.1rem',
                  fontWeight: 700,
                  color: '#1a1a2e',
                  borderRight: '4px solid #00B5FE',
                  paddingRight: 12,
                  marginBottom: 10,
                }}
              >
                {section.title}
              </h3>
              <ul
                style={{
                  margin: 0,
                  padding: '0 20px 0 0',
                  listStyleType: 'none',
                }}
              >
                {section.items.map((item) => (
                  <li
                    key={item.id}
                    style={{
                      fontSize: '0.9rem',
                      lineHeight: 1.8,
                      color: '#374151',
                      position: 'relative',
                      paddingRight: 16,
                    }}
                  >
                    <span
                      style={{
                        position: 'absolute',
                        right: 0,
                        top: '50%',
                        transform: 'translateY(-50%)',
                        width: 6,
                        height: 6,
                        borderRadius: '50%',
                        background: '#00B5FE',
                      }}
                    />
                    {item.text}
                  </li>
                ))}
              </ul>
            </div>
          ))}

          {/* Pricing summary */}
          <div
            style={{
              background: '#f8fafc',
              borderRadius: 12,
              padding: '1.5rem',
              marginTop: '2rem',
              marginBottom: '2rem',
              border: '1px solid #e5e7eb',
            }}
          >
            <h3
              style={{
                fontSize: '1.1rem',
                fontWeight: 700,
                color: '#1a1a2e',
                marginBottom: 16,
              }}
            >
              תמחור
            </h3>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                marginBottom: 8,
                fontSize: '0.9rem',
                color: '#374151',
              }}
            >
              <span>סוג:</span>
              <span style={{ fontWeight: 600 }}>
                {data.pricingType === 'retainer'
                  ? 'ריטיינר חודשי'
                  : 'פרויקט'}
              </span>
            </div>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                marginBottom: 8,
                fontSize: '0.9rem',
                color: '#374151',
              }}
            >
              <span>מחיר:</span>
              <span style={{ fontWeight: 600 }}>
                ₪{data.price.toLocaleString()}
              </span>
            </div>
            {calcDiscount() > 0 && (
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  marginBottom: 8,
                  fontSize: '0.9rem',
                  color: '#22c55e',
                }}
              >
                <span>הנחה:</span>
                <span style={{ fontWeight: 600 }}>
                  -₪{calcDiscount().toLocaleString()}
                </span>
              </div>
            )}
            {!data.includeVat && (
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  marginBottom: 8,
                  fontSize: '0.9rem',
                  color: '#374151',
                }}
              >
                <span>
                  מע״מ ({data.vatRate}%):
                </span>
                <span style={{ fontWeight: 600 }}>
                  ₪{vatAmount.toLocaleString()}
                </span>
              </div>
            )}
            <div
              style={{
                borderTop: '2px solid #00B5FE',
                paddingTop: 12,
                marginTop: 8,
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: '1.15rem',
              }}
            >
              <span style={{ fontWeight: 700 }}>
                סה״כ:
              </span>
              <span style={{ fontWeight: 800, color: '#00B5FE' }}>
                ₪{totalPrice.toLocaleString()}
                {data.includeVat && (
                  <span
                    style={{
                      fontSize: '0.75rem',
                      marginRight: 4,
                      color: '#6b7280',
                    }}
                  >
                    (כולל מע״מ)
                  </span>
                )}
              </span>
            </div>
          </div>

          {/* Payment terms */}
          {data.paymentTerms && (
            <div style={{ marginBottom: '1.5rem' }}>
              <h3
                style={{
                  fontSize: '1rem',
                  fontWeight: 700,
                  color: '#1a1a2e',
                  marginBottom: 8,
                }}
              >
                תנאי תשלום
              </h3>
              <p
                style={{
                  fontSize: '0.88rem',
                  lineHeight: 1.7,
                  color: '#374151',
                  whiteSpace: 'pre-wrap',
                  margin: 0,
                }}
              >
                {data.paymentTerms}
              </p>
            </div>
          )}

          {/* Contract period */}
          {data.contractPeriod && (
            <div style={{ marginBottom: '1.5rem' }}>
              <h3
                style={{
                  fontSize: '1rem',
                  fontWeight: 700,
                  color: '#1a1a2e',
                  marginBottom: 8,
                }}
              >
                תקופת
                התקשרות
              </h3>
              <p
                style={{
                  fontSize: '0.88rem',
                  lineHeight: 1.7,
                  color: '#374151',
                  margin: 0,
                }}
              >
                {data.contractPeriod}
              </p>
            </div>
          )}

          {/* General terms */}
          {data.generalTerms.length > 0 && (
            <div style={{ marginBottom: '2rem' }}>
              <h3
                style={{
                  fontSize: '1rem',
                  fontWeight: 700,
                  color: '#1a1a2e',
                  marginBottom: 8,
                }}
              >
                תנאים
                כלליים
              </h3>
              <ol
                style={{
                  padding: '0 22px 0 0',
                  margin: 0,
                }}
              >
                {data.generalTerms.map((term, i) => (
                  <li
                    key={i}
                    style={{
                      fontSize: '0.85rem',
                      lineHeight: 1.8,
                      color: '#374151',
                      marginBottom: 4,
                    }}
                  >
                    {term}
                  </li>
                ))}
              </ol>
            </div>
          )}

          {/* Approval placeholder */}
          <div
            style={{
              background: '#f0f9ff',
              borderRadius: 12,
              padding: '1.5rem',
              textAlign: 'center',
              border: '1px dashed #00B5FE',
            }}
          >
            <div
              style={{
                fontSize: '0.9rem',
                fontWeight: 600,
                color: '#00B5FE',
                marginBottom: 4,
              }}
            >
              אזור אישור
              הלקוח
            </div>
            <div style={{ fontSize: '0.8rem', color: '#6b7280' }}>
              הלקוח יוכל
              לאשר את ההצעה
              ולחתום כאן
            </div>
          </div>
        </div>
      </div>
    );
  };

  /* ═══════════════════════════════════════════════════════
     RENDER: STEP 5 — PUBLISH
     ═══════════════════════════════════════════════════════ */

  const renderStep5 = () => {
    const copyLink = () => {
      navigator.clipboard
        .writeText(proposalUrl)
        .then(() =>
          toast(
            'הקישור הועתק',
            'success',
          ),
        )
        .catch(() =>
          toast(
            'שגיאה בהעתקת הקישור',
            'error',
          ),
        );
    };

    const shareWhatsApp = () => {
      const text = encodeURIComponent(
        `היי, הנה הצעת המחיר שלך: ${proposalUrl}`,
      );
      window.open(`https://wa.me/?text=${text}`, '_blank');
    };

    const sendEmail = () => {
      toast(
        'שליחת מייל תהיה זמינה בקרוב',
        'info',
      );
    };

    return (
      <div>
        <h2
          style={{
            fontSize: '1.3rem',
            fontWeight: 700,
            color: 'var(--foreground)',
            marginBottom: '1.5rem',
          }}
        >
          פרסום ושיתוף
        </h2>

        {published ? (
          /* ── Published success state ───────────────── */
          <div
            style={{
              ...cardStyle,
              textAlign: 'center',
              padding: '3rem 2rem',
            }}
          >
            {/* Animated checkmark */}
            <div
              className="ux-pop"
              style={{
                width: 80,
                height: 80,
                borderRadius: '50%',
                background: '#22c55e',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 1.5rem',
                fontSize: '2.5rem',
                color: '#fff',
              }}
            >
              ✓
            </div>
            <h3
              style={{
                fontSize: '1.3rem',
                fontWeight: 700,
                color: 'var(--foreground)',
                marginBottom: 8,
              }}
            >
              ההצעה פורסמה
              בהצלחה!
            </h3>
            <p
              style={{
                color: 'var(--foreground-muted)',
                fontSize: '0.9rem',
                marginBottom: '1.5rem',
              }}
            >
              ההצעה זמינה
              כעת בקישור
              הציבורי
            </p>

            {/* Public URL box */}
            <div
              style={{
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: 10,
                padding: '0.75rem 1rem',
                fontSize: '0.85rem',
                color: 'var(--accent)',
                wordBreak: 'break-all',
                marginBottom: '1.5rem',
                direction: 'ltr',
                textAlign: 'center',
                userSelect: 'all',
              }}
            >
              {proposalUrl}
            </div>

            {/* Action buttons */}
            <div
              style={{
                display: 'flex',
                gap: 10,
                justifyContent: 'center',
                flexWrap: 'wrap',
              }}
            >
              <button onClick={copyLink} style={{ ...primaryBtnStyle }}>
                העתק קישור
              </button>
              <button
                onClick={shareWhatsApp}
                style={{ ...primaryBtnStyle, background: '#25D366' }}
              >
                שתף ב-WhatsApp
              </button>
              <button onClick={sendEmail} style={{ ...ghostBtnStyle }}>
                שלח במייל
              </button>
            </div>

            <button
              onClick={() => router.push('/proposals')}
              style={{ ...ghostBtnStyle, marginTop: '1.5rem' }}
            >
              חזרה לרשימת
              ההצעות
            </button>
          </div>
        ) : (
          /* ── Pre-publish state ─────────────────────── */
          <div
            style={{
              ...cardStyle,
              textAlign: 'center',
              padding: '2.5rem 2rem',
            }}
          >
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>
              📄
            </div>
            <h3
              style={{
                fontSize: '1.2rem',
                fontWeight: 700,
                color: 'var(--foreground)',
                marginBottom: 8,
              }}
            >
              ההצעה מוכנה
              לפרסום
            </h3>
            <p
              style={{
                color: 'var(--foreground-muted)',
                fontSize: '0.9rem',
                marginBottom: 6,
              }}
            >
              {data.title}
            </p>
            <p
              style={{
                color: 'var(--foreground-muted)',
                fontSize: '0.85rem',
                marginBottom: '2rem',
              }}
            >
              לקוח: {data.clientName} |{' '}
              מחיר: ₪
              {totalPrice.toLocaleString()}
            </p>

            {publicToken && (
              <div
                style={{
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  borderRadius: 10,
                  padding: '0.75rem 1rem',
                  fontSize: '0.85rem',
                  color: 'var(--foreground-muted)',
                  marginBottom: '1.5rem',
                  direction: 'ltr',
                  textAlign: 'center',
                  wordBreak: 'break-all',
                }}
              >
                {proposalUrl}
              </div>
            )}

            <div
              style={{
                display: 'flex',
                gap: 12,
                justifyContent: 'center',
                flexWrap: 'wrap',
              }}
            >
              <button onClick={handleSaveDraft} style={ghostBtnStyle}>
                שמור טיוטה
              </button>
              <button
                onClick={handlePublish}
                style={{
                  ...primaryBtnStyle,
                  fontSize: '1rem',
                  padding: '0.7rem 2rem',
                }}
              >
                פרסם הצעה
              </button>
            </div>
          </div>
        )}
      </div>
    );
  };

  /* ═══════════════════════════════════════════════════════
     MAIN RENDER
     ═══════════════════════════════════════════════════════ */

  if (loading) {
    return (
      <div
        dir="rtl"
        style={{
          maxWidth: 900,
          margin: '0 auto',
          padding: '2rem 1.25rem',
          minHeight: '100vh',
        }}
      >
        <LoadingState label="טוען..." />
      </div>
    );
  }

  return (
    <div
      dir="rtl"
      style={{
        maxWidth: 900,
        margin: '0 auto',
        padding: '1.5rem 1.25rem 6rem',
        minHeight: '100vh',
      }}
    >
      {/* ── Page header + autosave indicator ──────────── */}
      <div
        style={{
          marginBottom: '1rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <h1
          style={{
            fontSize: '1.5rem',
            fontWeight: 800,
            color: 'var(--foreground)',
            margin: 0,
          }}
        >
          {editId
            ? 'עריכת הצעת מחיר'
            : 'הצעת מחיר חדשה'}
        </h1>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            fontSize: '0.78rem',
            color: 'var(--foreground-muted)',
          }}
        >
          {saving ? (
            <>
              <div
                className="ux-fade-in"
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  background: '#f59e0b',
                }}
              />
              <span>
                שומר...
              </span>
            </>
          ) : lastSaved ? (
            <>
              <div
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  background: '#22c55e',
                }}
              />
              <span>
                נשמר
              </span>
            </>
          ) : null}
        </div>
      </div>

      {/* ── Read-only banner (approved proposals) ────── */}
      {isReadOnly && (
        <div
          style={{
            background: '#fef3c7',
            border: '1px solid #fbbf24',
            borderRadius: 12,
            padding: '0.85rem 1.25rem',
            marginBottom: '1rem',
            fontSize: '0.88rem',
            fontWeight: 600,
            color: '#92400e',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <span>⚠️</span>
          <span>
            הצעה זו אושרה
            ולא ניתן לערוך
            אותה
          </span>
        </div>
      )}

      {/* ── Step indicator ────────────────────────────── */}
      {renderStepIndicator()}

      {/* ── Step content ──────────────────────────────── */}
      <div className="ux-fade-in" key={step}>
        {step === 1 && renderStep1()}
        {step === 2 && renderStep2()}
        {step === 3 && renderStep3()}
        {step === 4 && renderStep4()}
        {step === 5 && renderStep5()}
      </div>

      {/* ── Bottom navigation bar ─────────────────────── */}
      {step < 5 && (
        <div
          style={{
            position: 'fixed',
            bottom: 0,
            left: 0,
            right: 0,
            background: 'var(--surface-raised)',
            borderTop: '1px solid var(--border)',
            padding: '0.85rem 1.5rem',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            zIndex: 100,
          }}
        >
          <button
            onClick={goBack}
            disabled={step === 1}
            style={{
              ...ghostBtnStyle,
              opacity: step === 1 ? 0.4 : 1,
              cursor: step === 1 ? 'default' : 'pointer',
            }}
          >
            הקודם
          </button>
          <button onClick={goNext} style={primaryBtnStyle}>
            הבא
          </button>
        </div>
      )}

      {step === 5 && !published && (
        <div
          style={{
            position: 'fixed',
            bottom: 0,
            left: 0,
            right: 0,
            background: 'var(--surface-raised)',
            borderTop: '1px solid var(--border)',
            padding: '0.85rem 1.5rem',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            zIndex: 100,
          }}
        >
          <button onClick={goBack} style={ghostBtnStyle}>
            הקודם
          </button>
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={handleSaveDraft} style={ghostBtnStyle}>
              שמור טיוטה
            </button>
            <button onClick={handlePublish} style={primaryBtnStyle}>
              פרסם הצעה
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   PAGE EXPORT (Suspense boundary for useSearchParams)
   ═══════════════════════════════════════════════════════ */

export default function ProposalWizardPage() {
  return (
    <Suspense
      fallback={
        <div
          dir="rtl"
          style={{
            maxWidth: 900,
            margin: '0 auto',
            padding: '2rem 1.25rem',
          }}
        >
          <LoadingState label="טוען..." />
        </div>
      }
    >
      <ProposalWizardInner />
    </Suspense>
  );
}
