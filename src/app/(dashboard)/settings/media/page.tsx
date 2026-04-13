'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/components/ui/toast';

/* ────────────────────────────────────────────────────────────────
   Types
   ──────────────────────────────────────────────────────────────── */

type ConnectionStatus = 'connected' | 'untested' | 'error';

interface ProviderState {
  apiKey: string;
  apiSecret?: string;          // Shutterstock only
  enabled: boolean;
  status: ConnectionStatus;
  testLoading: boolean;
  showKey: boolean;
  lastTestAt: string | null;
  lastError: string | null;
}

/* ────────────────────────────────────────────────────────────────
   Page
   ──────────────────────────────────────────────────────────────── */

export default function MediaSettingsPage() {
  const router = useRouter();
  const toast = useToast();

  /* ── Provider states ───────────────────────────────────────── */
  const [pexels, setPexels] = useState<ProviderState>({
    apiKey: '', enabled: false, status: 'untested',
    testLoading: false, showKey: false, lastTestAt: null, lastError: null,
  });
  const [pixabay, setPixabay] = useState<ProviderState>({
    apiKey: '', enabled: false, status: 'untested',
    testLoading: false, showKey: false, lastTestAt: null, lastError: null,
  });
  const [shutterstock, setShutterstock] = useState<ProviderState>({
    apiKey: '', apiSecret: '', enabled: false, status: 'untested',
    testLoading: false, showKey: false, lastTestAt: null, lastError: null,
  });

  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);

  /* ── Load saved settings on mount ──────────────────────────── */
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/stock-search/settings');
        const json = await res.json();
        if (json.pexels) {
          setPexels(prev => ({ ...prev, apiKey: json.pexels.apiKey || '', enabled: json.pexels.enabled ?? false }));
        }
        if (json.pixabay) {
          setPixabay(prev => ({ ...prev, apiKey: json.pixabay.apiKey || '', enabled: json.pixabay.enabled ?? false }));
        }
        if (json.shutterstock) {
          setShutterstock(prev => ({
            ...prev,
            apiKey: json.shutterstock.apiKey || '',
            apiSecret: json.shutterstock.apiSecret || '',
            enabled: json.shutterstock.enabled ?? false,
          }));
        }
      } catch { /* ignore */ }
      setLoaded(true);
    })();
  }, []);

  /* ── Check live connection status on mount ─────────────────── */
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/stock-search');
        const json = await res.json();
        if (json.pexels?.configured) setPexels(prev => ({ ...prev, status: 'connected' }));
        if (json.pixabay?.configured) setPixabay(prev => ({ ...prev, status: 'connected' }));
        if (json.shutterstock?.configured) setShutterstock(prev => ({ ...prev, status: 'connected' }));
      } catch { /* ignore */ }
    })();
  }, []);

  /* ── Save all settings ─────────────────────────────────────── */
  const handleSave = async () => {
    setSaving(true);
    try {
      await fetch('/api/stock-search/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pexels: { apiKey: pexels.apiKey, enabled: pexels.enabled },
          pixabay: { apiKey: pixabay.apiKey, enabled: pixabay.enabled },
          shutterstock: { apiKey: shutterstock.apiKey, apiSecret: shutterstock.apiSecret, enabled: shutterstock.enabled },
        }),
      });
      toast('הגדרות מדיה נשמרו בהצלחה', 'success');
    } catch {
      toast('שגיאה בשמירת הגדרות', 'error');
    }
    setSaving(false);
  };

  /* ── Test single provider ──────────────────────────────────── */
  const testProvider = async (
    provider: 'pexels' | 'pixabay' | 'shutterstock',
    state: ProviderState,
    setState: React.Dispatch<React.SetStateAction<ProviderState>>,
  ) => {
    setState(prev => ({ ...prev, testLoading: true, lastError: null }));

    // Save first so the backend has the key
    await fetch('/api/stock-search/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        [provider]: {
          apiKey: state.apiKey,
          ...(provider === 'shutterstock' ? { apiSecret: state.apiSecret } : {}),
          enabled: state.enabled,
        },
      }),
    });

    try {
      const res = await fetch('/api/stock-search/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider,
          apiKey: state.apiKey,
          ...(provider === 'shutterstock' ? { apiSecret: state.apiSecret } : {}),
        }),
      });
      const data = await res.json();
      const now = new Date().toLocaleTimeString('he-IL');
      if (data.connected) {
        setState(prev => ({ ...prev, status: 'connected', testLoading: false, lastTestAt: now, lastError: null }));
        toast(`${provider} מחובר בהצלחה`, 'success');
      } else {
        setState(prev => ({ ...prev, status: 'error', testLoading: false, lastTestAt: now, lastError: data.error || 'Unknown error' }));
        toast(`שגיאה ב-${provider}: ${data.error || 'Unknown error'}`, 'error');
      }
    } catch (err) {
      const now = new Date().toLocaleTimeString('he-IL');
      setState(prev => ({ ...prev, status: 'error', testLoading: false, lastTestAt: now, lastError: 'Network error' }));
      toast('שגיאה בבדיקת חיבור', 'error');
    }
  };

  /* ── Style constants (matching settings design language) ──── */
  const cardStyle: React.CSSProperties = {
    backgroundColor: 'var(--surface-raised)',
    border: '1px solid var(--border)',
    borderRadius: '12px',
    padding: '1.5rem',
    marginBottom: '1.5rem',
  };

  const labelStyle: React.CSSProperties = {
    display: 'block',
    fontSize: '0.875rem',
    fontWeight: 600,
    color: 'var(--foreground)',
    marginBottom: '0.5rem',
  };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '10px 14px',
    backgroundColor: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: '8px',
    color: 'var(--foreground)',
    fontSize: '0.875rem',
    fontFamily: 'inherit',
    boxSizing: 'border-box' as const,
  };

  const btnPrimary: React.CSSProperties = {
    padding: '10px 16px',
    backgroundColor: 'var(--accent)',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    fontSize: '0.875rem',
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'opacity 150ms ease',
  };

  const btnSecondary: React.CSSProperties = {
    padding: '10px 16px',
    backgroundColor: 'transparent',
    color: 'var(--foreground)',
    border: '1px solid var(--border)',
    borderRadius: '8px',
    fontSize: '0.875rem',
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'opacity 150ms ease',
  };

  const statusDot = (status: ConnectionStatus): React.CSSProperties => ({
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    backgroundColor: status === 'connected' ? '#22c55e' : status === 'error' ? '#ef4444' : '#94a3b8',
    display: 'inline-block',
  });

  const statusLabel = (status: ConnectionStatus) =>
    status === 'connected' ? 'מחובר' : status === 'error' ? 'שגיאה' : 'לא מחובר';

  const statusColor = (status: ConnectionStatus) =>
    status === 'connected' ? '#22c55e' : status === 'error' ? '#ef4444' : 'var(--foreground-muted)';

  /* ── Helper: render a single provider card ─────────────────── */
  const renderProviderCard = (
    provider: 'pexels' | 'pixabay' | 'shutterstock',
    label: string,
    description: string,
    state: ProviderState,
    setState: React.Dispatch<React.SetStateAction<ProviderState>>,
    helperText: string,
    externalUrl: string,
    externalLabel: string,
    disabled?: boolean,
  ) => (
    <div style={{ ...cardStyle, ...(disabled ? { opacity: 0.65, pointerEvents: 'none' as const } : {}) }} key={provider}>
      {/* Header row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
        <div>
          <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: 'var(--foreground)' }}>
            {label}
            {disabled && <span style={{ fontSize: '0.7rem', padding: '2px 8px', borderRadius: 8, background: 'rgba(0,181,254,0.15)', color: 'var(--accent)', fontWeight: 600, marginRight: '0.5rem' }}>בקרוב</span>}
          </h3>
          <p style={{ margin: '0.35rem 0 0', fontSize: '0.8rem', color: 'var(--foreground-muted)' }}>{description}</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <div style={statusDot(state.status)} />
          <span style={{ fontSize: '0.8rem', color: statusColor(state.status), fontWeight: 600 }}>{statusLabel(state.status)}</span>
        </div>
      </div>

      {/* API Key */}
      <div style={{ marginBottom: '1rem' }}>
        <label style={labelStyle}>מפתח API</label>
        <div style={{ position: 'relative' }}>
          <input
            type={state.showKey ? 'text' : 'password'}
            value={state.apiKey}
            onChange={(e) => setState(prev => ({ ...prev, apiKey: e.target.value, status: prev.apiKey !== e.target.value ? 'untested' : prev.status }))}
            style={{ ...inputStyle, paddingLeft: '44px' }}
            placeholder="הדבק את מפתח ה-API כאן..."
            disabled={disabled}
          />
          <button
            onClick={() => setState(prev => ({ ...prev, showKey: !prev.showKey }))}
            style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--foreground-muted)', fontSize: '0.9rem' }}
          >
            {state.showKey ? '🙈' : '👁'}
          </button>
        </div>
      </div>

      {/* API Secret (Shutterstock only) */}
      {provider === 'shutterstock' && (
        <div style={{ marginBottom: '1rem' }}>
          <label style={labelStyle}>API Secret</label>
          <input
            type="password"
            value={state.apiSecret || ''}
            onChange={(e) => setState(prev => ({ ...prev, apiSecret: e.target.value }))}
            style={inputStyle}
            placeholder="..."
            disabled={disabled}
          />
        </div>
      )}

      {/* Enable toggle */}
      <label style={{ ...labelStyle, display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', marginBottom: '1rem' }}>
        <input
          type="checkbox"
          checked={state.enabled}
          onChange={(e) => setState(prev => ({ ...prev, enabled: e.target.checked }))}
          disabled={disabled}
        />
        הפעל חיפוש {label} ב-B-Roll
      </label>

      {/* Helper text */}
      <div style={{
        padding: '0.75rem 1rem',
        background: 'var(--surface)',
        borderRadius: 8,
        border: '1px solid var(--border)',
        marginBottom: '1rem',
        fontSize: '0.78rem',
        color: 'var(--foreground-muted)',
        lineHeight: 1.6,
      }}>
        <div style={{ fontWeight: 600, marginBottom: '0.25rem', color: 'var(--foreground)' }}>איך להשיג מפתח API?</div>
        {helperText}
        <div style={{ marginTop: '0.5rem' }}>
          <a
            href={externalUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: 'var(--accent)', textDecoration: 'none', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}
          >
            {externalLabel}
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ marginTop: '1px' }}>
              <path d="M3.5 1.5H10.5V8.5M10.5 1.5L1.5 10.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </a>
        </div>
      </div>

      {/* Action buttons */}
      <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
        <button
          style={btnPrimary}
          onClick={() => testProvider(provider, state, setState)}
          disabled={state.testLoading || !state.apiKey}
        >
          {state.testLoading ? '⏳ בודק חיבור...' : 'בדוק חיבור'}
        </button>
        <button
          style={btnSecondary}
          onClick={() => {
            setState(prev => ({ ...prev, apiKey: '', apiSecret: '', enabled: false, status: 'untested', lastError: null, lastTestAt: null }));
          }}
        >
          נתק
        </button>
      </div>

      {/* Last test result */}
      {state.lastTestAt && (
        <div style={{ marginTop: '0.75rem', fontSize: '0.75rem', color: 'var(--foreground-muted)' }}>
          <span>בדיקה אחרונה: {state.lastTestAt}</span>
          {state.status === 'connected' && <span style={{ color: '#22c55e', marginRight: '0.5rem' }}> — מחובר בהצלחה</span>}
          {state.status === 'error' && state.lastError && (
            <span style={{ color: '#ef4444', marginRight: '0.5rem' }}> — שגיאה: {state.lastError}</span>
          )}
        </div>
      )}
    </div>
  );

  /* ── Render ─────────────────────────────────────────────────── */
  if (!loaded) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
        <span style={{ fontSize: '1.25rem', color: 'var(--foreground-muted)' }}>⏳ טוען הגדרות מדיה...</span>
      </div>
    );
  }

  const anyConnected = pexels.status === 'connected' || pixabay.status === 'connected' || shutterstock.status === 'connected';

  return (
    <div style={{ maxWidth: 780, margin: '0 auto', padding: '2rem 1.5rem 4rem' }}>
      {/* Back link */}
      <button
        onClick={() => router.push('/settings')}
        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent)', fontSize: '0.85rem', fontWeight: 600, marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}
      >
        ← חזרה להגדרות
      </button>

      {/* Page header */}
      <h1 style={{ fontSize: '1.875rem', fontWeight: 700, color: 'var(--foreground)', marginBottom: '0.5rem' }}>
        הגדרות מדיה
      </h1>
      <p style={{ fontSize: '0.88rem', color: 'var(--foreground-muted)', marginBottom: '2rem', lineHeight: 1.7 }}>
        חבר ספריות וידאו חיצוניות לחיפוש אוטומטי של קטעי B-Roll. המערכת תחפש לפי סדר עדיפות: ספריית לקוח → נכסים שהועלו → Pexels → Pixabay → Shutterstock.
      </p>

      {/* Connection summary */}
      <div style={{
        padding: '1rem 1.25rem',
        borderRadius: 10,
        marginBottom: '2rem',
        background: anyConnected ? 'rgba(34,197,94,0.08)' : 'rgba(251,191,36,0.08)',
        border: `1px solid ${anyConnected ? 'rgba(34,197,94,0.25)' : 'rgba(251,191,36,0.3)'}`,
        display: 'flex',
        alignItems: 'center',
        gap: '0.75rem',
      }}>
        <span style={{ fontSize: '1.2rem' }}>{anyConnected ? '✅' : '⚠️'}</span>
        <div>
          {anyConnected ? (
            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#22c55e' }}>
              {[
                pexels.status === 'connected' && 'Pexels',
                pixabay.status === 'connected' && 'Pixabay',
                shutterstock.status === 'connected' && 'Shutterstock',
              ].filter(Boolean).join(', ')} — מחובר. חיפוש B-Roll פעיל.
            </span>
          ) : (
            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#f59e0b' }}>
              אין כרגע מאגר סרטונים מחובר ל-B-Roll. יש לחבר מאגר בהגדרות מדיה.
            </span>
          )}
        </div>
      </div>

      {/* Provider cards */}
      {renderProviderCard(
        'pexels',
        'Pexels',
        'ספריית וידאו Stock חינמית — מעל 3 מיליון סרטונים באיכות גבוהה. ללא תשלום, ללא ייחוס חובה.',
        pexels,
        setPexels,
        'צור חשבון או התחבר לחשבון Pexels קיים, עבור לעמוד ה-API, לחץ על "Get Started" והעתק את מפתח ה-API שלך.',
        'https://www.pexels.com/api/',
        'פתח Pexels API',
      )}

      {renderProviderCard(
        'pixabay',
        'Pixabay',
        'ספריית מדיה חינמית — תמונות, וידאו ואילוסטרציות. שימוש חופשי גם למסחרי.',
        pixabay,
        setPixabay,
        'צור חשבון או התחבר לחשבון Pixabay קיים, פתח את אזור ה-API או עמוד המפתחות, צור מפתח API והעתק אותו.',
        'https://pixabay.com/api/docs/',
        'פתח Pixabay API',
      )}

      {renderProviderCard(
        'shutterstock',
        'Shutterstock',
        'ספריית Stock מקצועית — מעל 450 מיליון סרטונים ותמונות. דורש מנוי בתשלום.',
        shutterstock,
        setShutterstock,
        'Shutterstock יהיה זמין בקרוב. כשיתווסף, תוכל לחבר את חשבון ה-Shutterstock שלך באמצעות מפתח API ו-Secret.',
        'https://www.shutterstock.com/developers',
        'פתח Shutterstock Developers',
        true, // disabled
      )}

      {/* Save button */}
      <button
        style={{ ...btnPrimary, width: '100%', padding: '14px', fontSize: '1rem', marginTop: '0.5rem' }}
        onClick={handleSave}
        disabled={saving}
      >
        {saving ? '⏳ שומר...' : 'שמור הגדרות מדיה'}
      </button>

      {/* Search priority legend */}
      <div style={{
        marginTop: '2rem',
        padding: '1.25rem',
        background: 'var(--surface)',
        borderRadius: 10,
        border: '1px solid var(--border)',
      }}>
        <div style={{ fontWeight: 700, fontSize: '0.88rem', marginBottom: '0.75rem', color: 'var(--foreground)' }}>סדר עדיפות חיפוש B-Roll</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.82rem', color: 'var(--foreground-muted)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ width: 24, height: 24, borderRadius: 6, background: 'rgba(0,181,254,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', fontWeight: 700, color: 'var(--accent)', flexShrink: 0 }}>1</span>
            <span>ספריית מדיה של הלקוח (אם הועלו קטעים)</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ width: 24, height: 24, borderRadius: 6, background: 'rgba(0,181,254,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', fontWeight: 700, color: 'var(--accent)', flexShrink: 0 }}>2</span>
            <span>נכסים שהועלו למערכת</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ width: 24, height: 24, borderRadius: 6, background: pexels.status === 'connected' ? 'rgba(34,197,94,0.15)' : 'rgba(0,181,254,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', fontWeight: 700, color: pexels.status === 'connected' ? '#22c55e' : 'var(--accent)', flexShrink: 0 }}>3</span>
            <span>Pexels {pexels.status === 'connected' ? '✅' : '—'}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ width: 24, height: 24, borderRadius: 6, background: pixabay.status === 'connected' ? 'rgba(34,197,94,0.15)' : 'rgba(0,181,254,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', fontWeight: 700, color: pixabay.status === 'connected' ? '#22c55e' : 'var(--accent)', flexShrink: 0 }}>4</span>
            <span>Pixabay {pixabay.status === 'connected' ? '✅' : '—'}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ width: 24, height: 24, borderRadius: 6, background: 'rgba(0,181,254,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', fontWeight: 700, color: 'var(--foreground-muted)', flexShrink: 0 }}>5</span>
            <span style={{ opacity: 0.6 }}>Shutterstock (בקרוב)</span>
          </div>
        </div>
      </div>
    </div>
  );
}
