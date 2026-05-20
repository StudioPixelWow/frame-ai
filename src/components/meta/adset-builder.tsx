'use client';

import React, { useState, useCallback, useEffect } from 'react';

/* ═══════════════════════════════════════════════════════════════════════════
   Types
   ═══════════════════════════════════════════════════════════════════════════ */

export interface AdSetBuilderProps {
  isOpen: boolean;
  onClose: () => void;
  adAccountId: string;
  accessToken: string;
  campaignId: string;
  editAdSet?: any;
  onSuccess: (adSet: any) => void;
}

interface AdSetFormData {
  name: string;
  status: 'ACTIVE' | 'PAUSED';
  optimizationGoal: string;
  billingEvent: string;
  budgetType: 'daily' | 'lifetime';
  budgetAmount: string;
  startTime: string;
  endTime: string;
  bidStrategy: string;
  countries: string[];
  cities: string;
  ageMin: number;
  ageMax: number;
  gender: 'all' | 'male' | 'female';
  interests: string[];
  interestInput: string;
  customAudiences: string;
  excludedAudiences: string;
}

/* ═══════════════════════════════════════════════════════════════════════════
   Constants
   ═══════════════════════════════════════════════════════════════════════════ */

const OPTIMIZATION_GOALS = [
  { value: 'LINK_CLICKS', label: 'קליקים על קישור' },
  { value: 'IMPRESSIONS', label: 'חשיפות' },
  { value: 'REACH', label: 'טווח הגעה' },
  { value: 'CONVERSIONS', label: 'המרות' },
  { value: 'LANDING_PAGE_VIEWS', label: 'צפיות בדף נחיתה' },
  { value: 'LEAD_GENERATION', label: 'יצירת לידים' },
];

const BILLING_EVENTS = [
  { value: 'IMPRESSIONS', label: 'חשיפות (CPM)' },
  { value: 'LINK_CLICKS', label: 'קליקים (CPC)' },
];

const BID_STRATEGIES = [
  { value: 'LOWEST_COST_WITHOUT_CAP', label: 'עלות נמוכה ביותר (ללא מגבלה)' },
  { value: 'LOWEST_COST_WITH_BID_CAP', label: 'עלות נמוכה ביותר (עם תקרת הצעה)' },
  { value: 'COST_CAP', label: 'תקרת עלות' },
];

const COUNTRY_OPTIONS = [
  { value: 'IL', label: 'ישראל' },
  { value: 'US', label: 'ארצות הברית' },
  { value: 'GB', label: 'בריטניה' },
  { value: 'DE', label: 'גרמניה' },
  { value: 'FR', label: 'צרפת' },
  { value: 'CA', label: 'קנדה' },
  { value: 'AU', label: 'אוסטרליה' },
];

const STATUS_COLORS: Record<string, string> = {
  ACTIVE: '#22c55e',
  PAUSED: '#f59e0b',
};

const META_BLUE = '#1877f2';

/* ═══════════════════════════════════════════════════════════════════════════
   Styles
   ═══════════════════════════════════════════════════════════════════════════ */

const overlayStyle: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(0,0,0,0.5)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 9999,
  direction: 'rtl',
};

const modalStyle: React.CSSProperties = {
  background: 'var(--background, #fff)',
  borderRadius: 16,
  width: '95%',
  maxWidth: 720,
  maxHeight: '90vh',
  overflow: 'auto',
  boxShadow: '0 25px 50px rgba(0,0,0,0.15)',
  border: '1px solid var(--border, #e5e7eb)',
};

const headerStyle: React.CSSProperties = {
  padding: '20px 24px',
  borderBottom: '1px solid var(--border, #e5e7eb)',
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
};

const bodyStyle: React.CSSProperties = {
  padding: 24,
};

const tabBarStyle: React.CSSProperties = {
  display: 'flex',
  gap: 4,
  marginBottom: 24,
  background: 'var(--surface-raised, #f3f4f6)',
  borderRadius: 12,
  padding: 4,
};

const tabStyle = (active: boolean): React.CSSProperties => ({
  flex: 1,
  padding: '10px 8px',
  borderRadius: 8,
  border: 'none',
  background: active ? 'var(--background, #fff)' : 'transparent',
  color: active ? META_BLUE : 'var(--foreground, #374151)',
  fontWeight: active ? 700 : 500,
  fontSize: 13,
  cursor: 'pointer',
  transition: 'all 0.2s',
  boxShadow: active ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
});

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 13,
  fontWeight: 600,
  color: 'var(--foreground, #374151)',
  marginBottom: 6,
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '10px 14px',
  borderRadius: 10,
  border: '1px solid var(--border, #d1d5db)',
  background: 'var(--background, #fff)',
  color: 'var(--foreground, #1f2937)',
  fontSize: 14,
  outline: 'none',
  boxSizing: 'border-box',
  direction: 'rtl',
};

const selectStyle: React.CSSProperties = {
  ...inputStyle,
  appearance: 'none' as const,
  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%236b7280' d='M6 8L1 3h10z'/%3E%3C/svg%3E")`,
  backgroundRepeat: 'no-repeat',
  backgroundPosition: 'left 12px center',
  paddingLeft: 32,
};

const fieldGroupStyle: React.CSSProperties = {
  marginBottom: 18,
};

const rowStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: 16,
};

const radioGroupStyle: React.CSSProperties = {
  display: 'flex',
  gap: 12,
};

const radioLabelStyle = (selected: boolean): React.CSSProperties => ({
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  padding: '8px 16px',
  borderRadius: 10,
  border: `2px solid ${selected ? META_BLUE : 'var(--border, #d1d5db)'}`,
  background: selected ? `${META_BLUE}10` : 'var(--background, #fff)',
  cursor: 'pointer',
  fontSize: 14,
  fontWeight: selected ? 600 : 400,
  transition: 'all 0.2s',
});

const tagStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  padding: '4px 10px',
  borderRadius: 8,
  background: `${META_BLUE}15`,
  color: META_BLUE,
  fontSize: 13,
  fontWeight: 500,
};

const tagRemoveStyle: React.CSSProperties = {
  background: 'none',
  border: 'none',
  color: META_BLUE,
  cursor: 'pointer',
  fontSize: 16,
  padding: 0,
  lineHeight: 1,
};

const primaryBtnStyle: React.CSSProperties = {
  padding: '12px 28px',
  borderRadius: 12,
  border: 'none',
  background: META_BLUE,
  color: '#fff',
  fontSize: 15,
  fontWeight: 600,
  cursor: 'pointer',
  transition: 'opacity 0.2s',
};

const secondaryBtnStyle: React.CSSProperties = {
  padding: '12px 28px',
  borderRadius: 12,
  border: `1px solid var(--border, #d1d5db)`,
  background: 'var(--background, #fff)',
  color: 'var(--foreground, #374151)',
  fontSize: 15,
  fontWeight: 500,
  cursor: 'pointer',
  transition: 'opacity 0.2s',
};

const footerStyle: React.CSSProperties = {
  padding: '16px 24px',
  borderTop: '1px solid var(--border, #e5e7eb)',
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: 12,
};

const summaryRowStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  padding: '10px 0',
  borderBottom: '1px solid var(--border, #e5e7eb)',
  fontSize: 14,
};

const summaryLabelStyle: React.CSSProperties = {
  color: 'var(--foreground, #6b7280)',
  fontWeight: 500,
};

const summaryValueStyle: React.CSSProperties = {
  color: 'var(--foreground, #1f2937)',
  fontWeight: 600,
};

const errorBannerStyle: React.CSSProperties = {
  padding: '10px 14px',
  borderRadius: 10,
  background: '#fef2f2',
  border: '1px solid #fca5a5',
  color: '#dc2626',
  fontSize: 13,
  marginBottom: 16,
};

const sliderContainerStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 12,
};

const rangeStyle: React.CSSProperties = {
  flex: 1,
  accentColor: META_BLUE,
};

/* ═══════════════════════════════════════════════════════════════════════════
   Component
   ═══════════════════════════════════════════════════════════════════════════ */

const TABS = [
  { key: 'basic', label: 'בסיסי' },
  { key: 'budget', label: 'תקציב ולו״ז' },
  { key: 'targeting', label: 'קהל יעד' },
  { key: 'summary', label: 'סיכום' },
] as const;

type TabKey = (typeof TABS)[number]['key'];

function getDefaultForm(editAdSet?: any): AdSetFormData {
  if (editAdSet) {
    const targeting = editAdSet.targeting || {};
    const geoCountries = targeting.geo_locations?.countries || [];
    const genders = targeting.genders || [];
    const interests = (targeting.interests || []).map((i: any) => i.name || i.id || '');
    const cities = (targeting.geo_locations?.cities || []).map((c: any) => c.name || c.key || '').join(', ');
    const customAudiences = (targeting.custom_audiences || []).map((a: any) => a.id || '').join(', ');
    const excludedAudiences = (targeting.excluded_custom_audiences || []).map((a: any) => a.id || '').join(', ');

    let gender: 'all' | 'male' | 'female' = 'all';
    if (genders.length === 1 && genders[0] === 1) gender = 'male';
    else if (genders.length === 1 && genders[0] === 2) gender = 'female';

    return {
      name: editAdSet.name || '',
      status: editAdSet.status || 'PAUSED',
      optimizationGoal: editAdSet.optimization_goal || 'LINK_CLICKS',
      billingEvent: editAdSet.billing_event || 'IMPRESSIONS',
      budgetType: editAdSet.lifetime_budget ? 'lifetime' : 'daily',
      budgetAmount: editAdSet.daily_budget
        ? String(parseInt(editAdSet.daily_budget, 10) / 100)
        : editAdSet.lifetime_budget
        ? String(parseInt(editAdSet.lifetime_budget, 10) / 100)
        : '',
      startTime: editAdSet.start_time ? editAdSet.start_time.slice(0, 16) : '',
      endTime: editAdSet.end_time ? editAdSet.end_time.slice(0, 16) : '',
      bidStrategy: editAdSet.bid_strategy || 'LOWEST_COST_WITHOUT_CAP',
      countries: geoCountries.length > 0 ? geoCountries : ['IL'],
      cities,
      ageMin: targeting.age_min || 18,
      ageMax: targeting.age_max || 65,
      gender,
      interests,
      interestInput: '',
      customAudiences,
      excludedAudiences,
    };
  }

  return {
    name: '',
    status: 'PAUSED',
    optimizationGoal: 'LINK_CLICKS',
    billingEvent: 'IMPRESSIONS',
    budgetType: 'daily',
    budgetAmount: '',
    startTime: '',
    endTime: '',
    bidStrategy: 'LOWEST_COST_WITHOUT_CAP',
    countries: ['IL'],
    cities: '',
    ageMin: 18,
    ageMax: 65,
    gender: 'all',
    interests: [],
    interestInput: '',
    customAudiences: '',
    excludedAudiences: '',
  };
}

export default function AdSetBuilder({
  isOpen,
  onClose,
  adAccountId,
  accessToken,
  campaignId,
  editAdSet,
  onSuccess,
}: AdSetBuilderProps) {
  const [activeTab, setActiveTab] = useState<TabKey>('basic');
  const [form, setForm] = useState<AdSetFormData>(() => getDefaultForm(editAdSet));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const isEditMode = Boolean(editAdSet?.id);

  useEffect(() => {
    if (isOpen) {
      setForm(getDefaultForm(editAdSet));
      setActiveTab('basic');
      setError('');
    }
  }, [isOpen, editAdSet]);

  const updateField = useCallback(<K extends keyof AdSetFormData>(key: K, value: AdSetFormData[K]) => {
    setForm(prev => ({ ...prev, [key]: value }));
  }, []);

  const addInterest = useCallback(() => {
    const val = form.interestInput.trim();
    if (val && !form.interests.includes(val)) {
      setForm(prev => ({
        ...prev,
        interests: [...prev.interests, val],
        interestInput: '',
      }));
    }
  }, [form.interestInput, form.interests]);

  const removeInterest = useCallback((interest: string) => {
    setForm(prev => ({
      ...prev,
      interests: prev.interests.filter(i => i !== interest),
    }));
  }, []);

  const toggleCountry = useCallback((code: string) => {
    setForm(prev => {
      const has = prev.countries.includes(code);
      return {
        ...prev,
        countries: has
          ? prev.countries.filter(c => c !== code)
          : [...prev.countries, code],
      };
    });
  }, []);

  const buildTargeting = useCallback(() => {
    const targeting: Record<string, unknown> = {
      geo_locations: { countries: form.countries.length > 0 ? form.countries : ['IL'] },
      age_min: form.ageMin,
      age_max: form.ageMax,
    };

    if (form.gender === 'male') targeting.genders = [1];
    else if (form.gender === 'female') targeting.genders = [2];

    if (form.interests.length > 0) {
      targeting.interests = form.interests.map(name => ({ id: name, name }));
    }

    if (form.customAudiences.trim()) {
      targeting.custom_audiences = form.customAudiences
        .split(',')
        .map(s => s.trim())
        .filter(Boolean)
        .map(id => ({ id }));
    }

    if (form.excludedAudiences.trim()) {
      targeting.excluded_custom_audiences = form.excludedAudiences
        .split(',')
        .map(s => s.trim())
        .filter(Boolean)
        .map(id => ({ id }));
    }

    return targeting;
  }, [form]);

  const handleSaveDraft = useCallback(async () => {
    // Save locally only
    try {
      setSaving(true);
      setError('');
      const targeting = buildTargeting();
      const res = await fetch('/api/data/ad-sets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          campaignId,
          name: form.name || 'טיוטת קבוצת מודעות',
          status: 'draft',
          ageMin: form.ageMin,
          ageMax: form.ageMax,
          genders: form.gender === 'all' ? ['all'] : [form.gender],
          geoLocations: form.countries,
          interests: form.interests,
          customAudiences: form.customAudiences.split(',').map(s => s.trim()).filter(Boolean),
          excludedAudiences: form.excludedAudiences.split(',').map(s => s.trim()).filter(Boolean),
          placements: [],
          dailyBudget: form.budgetType === 'daily' && form.budgetAmount ? parseFloat(form.budgetAmount) : null,
          lifetimeBudget: form.budgetType === 'lifetime' && form.budgetAmount ? parseFloat(form.budgetAmount) : null,
          startDate: form.startTime || null,
          endDate: form.endTime || null,
          bidStrategy: null,
          bidAmount: null,
          metaAdSetId: '',
          lastSyncedAt: null,
          notes: '',
        }),
      });
      if (!res.ok) throw new Error('Failed to save draft');
      const data = await res.json();
      onSuccess(data);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'שגיאה בשמירה');
    } finally {
      setSaving(false);
    }
  }, [form, campaignId, buildTargeting, onSuccess, onClose]);

  const handleCreateOnMeta = useCallback(async () => {
    if (!form.name.trim()) {
      setError('שם קבוצת המודעות הוא שדה חובה');
      return;
    }
    if (!form.budgetAmount || parseFloat(form.budgetAmount) <= 0) {
      setError('יש להגדיר תקציב');
      return;
    }

    try {
      setSaving(true);
      setError('');

      const targeting = buildTargeting();
      const budgetCents = Math.round(parseFloat(form.budgetAmount) * 100);

      const payload: Record<string, unknown> = {
        adAccountId,
        accessToken,
        campaignId,
        name: form.name,
        targeting,
        optimizationGoal: form.optimizationGoal,
        billingEvent: form.billingEvent,
        status: form.status,
      };

      if (form.budgetType === 'daily') {
        payload.dailyBudget = budgetCents;
      } else {
        payload.lifetimeBudget = budgetCents;
      }

      if (form.startTime) payload.startTime = new Date(form.startTime).toISOString();
      if (form.endTime) payload.endTime = new Date(form.endTime).toISOString();
      if (form.bidStrategy !== 'LOWEST_COST_WITHOUT_CAP') {
        payload.bidStrategy = form.bidStrategy;
      }

      const res = await fetch('/api/meta-business/adsets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'שגיאה ביצירת קבוצת מודעות');
      }

      onSuccess(data);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'שגיאה ביצירה');
    } finally {
      setSaving(false);
    }
  }, [form, adAccountId, accessToken, campaignId, buildTargeting, onSuccess, onClose]);

  const handleUpdateOnMeta = useCallback(async () => {
    if (!editAdSet?.id) return;

    try {
      setSaving(true);
      setError('');

      const targeting = buildTargeting();
      const budgetCents = form.budgetAmount ? Math.round(parseFloat(form.budgetAmount) * 100) : undefined;

      const payload: Record<string, unknown> = {
        accessToken,
        name: form.name,
        targeting,
        optimizationGoal: form.optimizationGoal,
        billingEvent: form.billingEvent,
        status: form.status,
      };

      if (form.budgetType === 'daily' && budgetCents) {
        payload.dailyBudget = budgetCents;
      } else if (budgetCents) {
        payload.lifetimeBudget = budgetCents;
      }

      if (form.startTime) payload.startTime = new Date(form.startTime).toISOString();
      if (form.endTime) payload.endTime = new Date(form.endTime).toISOString();
      if (form.bidStrategy !== 'LOWEST_COST_WITHOUT_CAP') {
        payload.bidStrategy = form.bidStrategy;
      }

      const res = await fetch(`/api/meta-business/adsets/${editAdSet.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'שגיאה בעדכון קבוצת מודעות');
      }

      onSuccess(data);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'שגיאה בעדכון');
    } finally {
      setSaving(false);
    }
  }, [form, editAdSet, accessToken, buildTargeting, onSuccess, onClose]);

  if (!isOpen) return null;

  /* ── Tab: Basic ── */
  const renderBasicTab = () => (
    <div>
      <div style={fieldGroupStyle}>
        <label style={labelStyle}>שם קבוצת מודעות *</label>
        <input
          style={inputStyle}
          value={form.name}
          onChange={e => updateField('name', e.target.value)}
          placeholder="למשל: קהל חדש — גילאי 25-45"
        />
      </div>

      <div style={fieldGroupStyle}>
        <label style={labelStyle}>סטטוס</label>
        <div style={radioGroupStyle}>
          {(['PAUSED', 'ACTIVE'] as const).map(s => (
            <label key={s} style={radioLabelStyle(form.status === s)}>
              <input
                type="radio"
                name="status"
                value={s}
                checked={form.status === s}
                onChange={() => updateField('status', s)}
                style={{ display: 'none' }}
              />
              <span style={{
                width: 10,
                height: 10,
                borderRadius: '50%',
                background: STATUS_COLORS[s],
                display: 'inline-block',
              }} />
              {s === 'ACTIVE' ? 'פעיל' : 'מושהה'}
            </label>
          ))}
        </div>
      </div>

      <div style={fieldGroupStyle}>
        <label style={labelStyle}>מטרת אופטימיזציה</label>
        <select
          style={selectStyle}
          value={form.optimizationGoal}
          onChange={e => updateField('optimizationGoal', e.target.value)}
        >
          {OPTIMIZATION_GOALS.map(o => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>

      <div style={fieldGroupStyle}>
        <label style={labelStyle}>אירוע חיוב</label>
        <select
          style={selectStyle}
          value={form.billingEvent}
          onChange={e => updateField('billingEvent', e.target.value)}
        >
          {BILLING_EVENTS.map(b => (
            <option key={b.value} value={b.value}>{b.label}</option>
          ))}
        </select>
      </div>
    </div>
  );

  /* ── Tab: Budget & Schedule ── */
  const renderBudgetTab = () => (
    <div>
      <div style={fieldGroupStyle}>
        <label style={labelStyle}>סוג תקציב</label>
        <div style={radioGroupStyle}>
          <label style={radioLabelStyle(form.budgetType === 'daily')}>
            <input
              type="radio"
              name="budgetType"
              value="daily"
              checked={form.budgetType === 'daily'}
              onChange={() => updateField('budgetType', 'daily')}
              style={{ display: 'none' }}
            />
            יומי
          </label>
          <label style={radioLabelStyle(form.budgetType === 'lifetime')}>
            <input
              type="radio"
              name="budgetType"
              value="lifetime"
              checked={form.budgetType === 'lifetime'}
              onChange={() => updateField('budgetType', 'lifetime')}
              style={{ display: 'none' }}
            />
            כולל
          </label>
        </div>
      </div>

      <div style={fieldGroupStyle}>
        <label style={labelStyle}>
          סכום תקציב ({form.budgetType === 'daily' ? 'יומי' : 'כולל'}) *
        </label>
        <div style={{ position: 'relative' }}>
          <input
            style={{ ...inputStyle, paddingRight: 40 }}
            type="number"
            min="1"
            step="1"
            value={form.budgetAmount}
            onChange={e => updateField('budgetAmount', e.target.value)}
            placeholder="0"
          />
          <span style={{
            position: 'absolute',
            right: 14,
            top: '50%',
            transform: 'translateY(-50%)',
            color: '#6b7280',
            fontSize: 14,
          }}>
            ₪
          </span>
        </div>
        <div style={{ fontSize: 12, color: '#6b7280', marginTop: 4 }}>
          הערך נשלח ל-Meta באגורות (x100)
        </div>
      </div>

      <div style={rowStyle}>
        <div style={fieldGroupStyle}>
          <label style={labelStyle}>תאריך התחלה</label>
          <input
            style={inputStyle}
            type="datetime-local"
            value={form.startTime}
            onChange={e => updateField('startTime', e.target.value)}
          />
        </div>
        <div style={fieldGroupStyle}>
          <label style={labelStyle}>תאריך סיום {form.budgetType === 'lifetime' ? '*' : '(אופציונלי)'}</label>
          <input
            style={inputStyle}
            type="datetime-local"
            value={form.endTime}
            onChange={e => updateField('endTime', e.target.value)}
          />
        </div>
      </div>

      <div style={fieldGroupStyle}>
        <label style={labelStyle}>אסטרטגיית הצעת מחיר</label>
        <select
          style={selectStyle}
          value={form.bidStrategy}
          onChange={e => updateField('bidStrategy', e.target.value)}
        >
          {BID_STRATEGIES.map(b => (
            <option key={b.value} value={b.value}>{b.label}</option>
          ))}
        </select>
      </div>
    </div>
  );

  /* ── Tab: Targeting ── */
  const renderTargetingTab = () => (
    <div>
      <div style={fieldGroupStyle}>
        <label style={labelStyle}>מדינות</label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {COUNTRY_OPTIONS.map(c => (
            <label
              key={c.value}
              style={{
                ...radioLabelStyle(form.countries.includes(c.value)),
                fontSize: 13,
                padding: '6px 12px',
              }}
            >
              <input
                type="checkbox"
                checked={form.countries.includes(c.value)}
                onChange={() => toggleCountry(c.value)}
                style={{ display: 'none' }}
              />
              {c.label}
            </label>
          ))}
        </div>
      </div>

      <div style={fieldGroupStyle}>
        <label style={labelStyle}>ערים (מופרדות בפסיק)</label>
        <input
          style={inputStyle}
          value={form.cities}
          onChange={e => updateField('cities', e.target.value)}
          placeholder="תל אביב, ירושלים, חיפה..."
        />
      </div>

      <div style={fieldGroupStyle}>
        <label style={labelStyle}>טווח גילאים: {form.ageMin} — {form.ageMax === 65 ? '65+' : form.ageMax}</label>
        <div style={sliderContainerStyle}>
          <span style={{ fontSize: 13, color: '#6b7280' }}>13</span>
          <input
            style={rangeStyle}
            type="range"
            min={13}
            max={65}
            value={form.ageMin}
            onChange={e => {
              const v = parseInt(e.target.value, 10);
              if (v < form.ageMax) updateField('ageMin', v);
            }}
          />
          <input
            style={rangeStyle}
            type="range"
            min={13}
            max={65}
            value={form.ageMax}
            onChange={e => {
              const v = parseInt(e.target.value, 10);
              if (v > form.ageMin) updateField('ageMax', v);
            }}
          />
          <span style={{ fontSize: 13, color: '#6b7280' }}>65+</span>
        </div>
      </div>

      <div style={fieldGroupStyle}>
        <label style={labelStyle}>מגדר</label>
        <div style={radioGroupStyle}>
          {([
            { value: 'all', label: 'כולם' },
            { value: 'male', label: 'גברים' },
            { value: 'female', label: 'נשים' },
          ] as const).map(g => (
            <label key={g.value} style={radioLabelStyle(form.gender === g.value)}>
              <input
                type="radio"
                name="gender"
                value={g.value}
                checked={form.gender === g.value}
                onChange={() => updateField('gender', g.value)}
                style={{ display: 'none' }}
              />
              {g.label}
            </label>
          ))}
        </div>
      </div>

      <div style={fieldGroupStyle}>
        <label style={labelStyle}>תחומי עניין</label>
        <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
          <input
            style={{ ...inputStyle, flex: 1 }}
            value={form.interestInput}
            onChange={e => updateField('interestInput', e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addInterest(); } }}
            placeholder="הקלד ולחץ Enter להוספה"
          />
          <button
            type="button"
            onClick={addInterest}
            style={{
              ...primaryBtnStyle,
              padding: '10px 16px',
              fontSize: 13,
            }}
          >
            הוסף
          </button>
        </div>
        {form.interests.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {form.interests.map(interest => (
              <span key={interest} style={tagStyle}>
                {interest}
                <button style={tagRemoveStyle} onClick={() => removeInterest(interest)}>×</button>
              </span>
            ))}
          </div>
        )}
      </div>

      <div style={fieldGroupStyle}>
        <label style={labelStyle}>Custom Audiences (מזהי קהלים, מופרדים בפסיק)</label>
        <input
          style={inputStyle}
          value={form.customAudiences}
          onChange={e => updateField('customAudiences', e.target.value)}
          placeholder="123456, 789012..."
        />
      </div>

      <div style={fieldGroupStyle}>
        <label style={labelStyle}>Excluded Audiences (מזהי קהלים להחרגה)</label>
        <input
          style={inputStyle}
          value={form.excludedAudiences}
          onChange={e => updateField('excludedAudiences', e.target.value)}
          placeholder="123456, 789012..."
        />
      </div>
    </div>
  );

  /* ── Tab: Summary ── */
  const renderSummaryTab = () => {
    const goalLabel = OPTIMIZATION_GOALS.find(o => o.value === form.optimizationGoal)?.label || form.optimizationGoal;
    const billingLabel = BILLING_EVENTS.find(b => b.value === form.billingEvent)?.label || form.billingEvent;
    const bidLabel = BID_STRATEGIES.find(b => b.value === form.bidStrategy)?.label || form.bidStrategy;
    const countryLabels = form.countries.map(c => COUNTRY_OPTIONS.find(o => o.value === c)?.label || c).join(', ');
    const genderLabel = form.gender === 'all' ? 'כולם' : form.gender === 'male' ? 'גברים' : 'נשים';

    const summaryItems: [string, string][] = [
      ['שם', form.name || '(לא הוגדר)'],
      ['סטטוס', form.status === 'ACTIVE' ? 'פעיל' : 'מושהה'],
      ['מטרת אופטימיזציה', goalLabel],
      ['אירוע חיוב', billingLabel],
      ['סוג תקציב', form.budgetType === 'daily' ? 'יומי' : 'כולל'],
      ['סכום', form.budgetAmount ? `₪${form.budgetAmount}` : '(לא הוגדר)'],
      ['תאריך התחלה', form.startTime || '(לא הוגדר)'],
      ['תאריך סיום', form.endTime || '(לא הוגדר)'],
      ['אסטרטגיית הצעה', bidLabel],
      ['מדינות', countryLabels || 'ישראל'],
      ['גילאים', `${form.ageMin} — ${form.ageMax === 65 ? '65+' : form.ageMax}`],
      ['מגדר', genderLabel],
      ['תחומי עניין', form.interests.length > 0 ? form.interests.join(', ') : '(ללא)'],
    ];

    return (
      <div>
        <div style={{
          padding: '12px 16px',
          borderRadius: 10,
          background: `${META_BLUE}08`,
          border: `1px solid ${META_BLUE}20`,
          marginBottom: 20,
          fontSize: 13,
          color: META_BLUE,
          fontWeight: 500,
        }}>
          סיכום הגדרות קבוצת המודעות — בדוק לפני שליחה
        </div>

        {summaryItems.map(([label, value]) => (
          <div key={label} style={summaryRowStyle}>
            <span style={summaryLabelStyle}>{label}</span>
            <span style={summaryValueStyle}>{value}</span>
          </div>
        ))}

        <div style={{ display: 'flex', gap: 12, marginTop: 24, flexWrap: 'wrap' }}>
          {!isEditMode && (
            <button
              style={secondaryBtnStyle}
              onClick={handleSaveDraft}
              disabled={saving}
            >
              {saving ? '...שומר' : 'שמור טיוטה'}
            </button>
          )}
          {isEditMode ? (
            <button
              style={{ ...primaryBtnStyle, background: META_BLUE }}
              onClick={handleUpdateOnMeta}
              disabled={saving}
            >
              {saving ? '...מעדכן' : 'עדכן ב-Meta'}
            </button>
          ) : (
            <button
              style={{ ...primaryBtnStyle, background: META_BLUE }}
              onClick={handleCreateOnMeta}
              disabled={saving}
            >
              {saving ? '...יוצר' : 'צור ב-Meta'}
            </button>
          )}
        </div>
      </div>
    );
  };

  const tabRenderers: Record<TabKey, () => React.ReactNode> = {
    basic: renderBasicTab,
    budget: renderBudgetTab,
    targeting: renderTargetingTab,
    summary: renderSummaryTab,
  };

  return (
    <div style={overlayStyle} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={modalStyle}>
        {/* Header */}
        <div style={headerStyle}>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: 'var(--foreground, #1f2937)' }}>
            {isEditMode ? 'עריכת קבוצת מודעות' : 'יצירת קבוצת מודעות חדשה'}
          </h2>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              fontSize: 22,
              cursor: 'pointer',
              color: 'var(--foreground, #6b7280)',
              padding: 4,
            }}
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div style={bodyStyle}>
          {/* Tab Bar */}
          <div style={tabBarStyle}>
            {TABS.map((tab, idx) => (
              <button
                key={tab.key}
                style={tabStyle(activeTab === tab.key)}
                onClick={() => setActiveTab(tab.key)}
              >
                {idx + 1}. {tab.label}
              </button>
            ))}
          </div>

          {/* Error */}
          {error && <div style={errorBannerStyle}>{error}</div>}

          {/* Tab Content */}
          {tabRenderers[activeTab]()}
        </div>

        {/* Footer */}
        {activeTab !== 'summary' && (
          <div style={footerStyle}>
            <button
              style={secondaryBtnStyle}
              onClick={() => {
                const idx = TABS.findIndex(t => t.key === activeTab);
                if (idx > 0) setActiveTab(TABS[idx - 1].key);
              }}
              disabled={activeTab === 'basic'}
            >
              הקודם
            </button>
            <button
              style={primaryBtnStyle}
              onClick={() => {
                const idx = TABS.findIndex(t => t.key === activeTab);
                if (idx < TABS.length - 1) setActiveTab(TABS[idx + 1].key);
              }}
            >
              הבא
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
