'use client';

import { useState, useEffect } from 'react';

const BRAND = '#00B5FE';

interface Check { id: string; label: string; ok: boolean; detail: string; fix?: string }
interface DiagResult { ok: boolean; writeCapable: boolean; account?: string; checks: Check[]; summary: string; raw?: any }

/**
 * One-click Meta connection diagnostic. Runs a real no-op write test against the
 * account and shows exactly what's blocking optimization (token / permission /
 * account / rate-tier) — so you don't have to guess that "the business isn't verified".
 */
export default function MetaDiagnostic({ clientId }: { clientId?: string }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [res, setRes] = useState<DiagResult | null>(null);
  const [err, setErr] = useState('');
  const [mode, setMode] = useState<'recommend' | 'auto' | null>(null);

  useEffect(() => {
    fetch('/api/meta-business/write-mode').then((r) => r.json()).then((j) => setMode(j.mode)).catch(() => {});
  }, []);

  const changeMode = async (m: 'recommend' | 'auto') => {
    setMode(m);
    try { await fetch('/api/meta-business/write-mode', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mode: m }) }); } catch {}
  };

  const run = async () => {
    setLoading(true); setErr(''); setRes(null); setOpen(true);
    try {
      const role = typeof window !== 'undefined' ? (localStorage.getItem('app_role') || 'admin') : 'admin';
      const q = clientId ? `?clientId=${encodeURIComponent(clientId)}` : '';
      const r = await fetch(`/api/meta-business/diagnose${q}`, { headers: { 'x-app-role': role } });
      const j = await r.json();
      setRes(j);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'שגיאה בבדיקה');
    } finally { setLoading(false); }
  };

  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <button
          onClick={run}
          disabled={loading}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '9px 16px', borderRadius: 10, border: `1px solid ${BRAND}`, background: loading ? '#eef' : 'rgba(0,181,254,0.08)', color: BRAND, fontSize: 13.5, fontWeight: 800, cursor: loading ? 'wait' : 'pointer' }}
        >
          {loading ? '⏳ בודק חיבור ל-Meta…' : '🔍 בדיקת חיבור ואבחון אופטימיזציה'}
        </button>

        {/* Write mode toggle */}
        {mode && (
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12.5 }}>
            <span style={{ color: '#6b7280', fontWeight: 600 }}>מצב אופטימיזציה:</span>
            <div style={{ display: 'inline-flex', border: '1px solid var(--border,#e5e7eb)', borderRadius: 8, overflow: 'hidden' }}>
              <button onClick={() => changeMode('recommend')} title="המנוע יחשב שינויים וישלח אותם לאישור — בלי לגעת ב-Meta"
                style={{ padding: '6px 12px', border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 12, background: mode === 'recommend' ? '#10b981' : 'transparent', color: mode === 'recommend' ? '#fff' : '#6b7280' }}>
                המלצה + אישור
              </button>
              <button onClick={() => changeMode('auto')} title="המנוע יבצע שינויים ישירות ב-Meta (רק כשהכתיבה מאומתת)"
                style={{ padding: '6px 12px', border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 12, background: mode === 'auto' ? BRAND : 'transparent', color: mode === 'auto' ? '#fff' : '#6b7280' }}>
                אוטומטי
              </button>
            </div>
          </div>
        )}
      </div>
      {mode === 'recommend' && (
        <div style={{ marginTop: 6, fontSize: 11.5, color: '#6b7280' }}>
          במצב זה כל פעולה מומלצת נשמרת בתור האישורים (בעמוד אישורים → פעולות קמפיין) ואתה מאשר בקליק — שום שינוי לא נשלח ל-Meta אוטומטית.
        </div>
      )}

      {open && (res || err) && (
        <div style={{ marginTop: 12, border: '1px solid var(--border,#e5e7eb)', borderRadius: 12, padding: 16, background: 'var(--surface,#fff)' }}>
          {err && <div style={{ color: '#dc2626', fontWeight: 700 }}>{err}</div>}
          {res && (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <span style={{ fontSize: 18 }}>{res.writeCapable ? '✅' : '⚠️'}</span>
                <span style={{ fontWeight: 800, fontSize: 14, color: res.writeCapable ? '#16a34a' : '#b45309' }}>
                  {res.writeCapable ? 'כתיבה ל-Meta עובדת' : 'כתיבה ל-Meta חסומה'}
                </span>
                {res.account && <span style={{ fontSize: 11.5, color: '#6b7280' }}>· {res.account}</span>}
              </div>
              <div style={{ fontSize: 12.5, color: 'var(--foreground)', marginBottom: 12, lineHeight: 1.6 }}>{res.summary}</div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {res.checks.map((c) => (
                  <div key={c.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '8px 10px', borderRadius: 8, background: c.ok ? 'rgba(34,197,94,0.06)' : 'rgba(239,68,68,0.06)', border: `1px solid ${c.ok ? 'rgba(34,197,94,0.25)' : 'rgba(239,68,68,0.25)'}` }}>
                    <span style={{ fontSize: 14, lineHeight: 1.4 }}>{c.ok ? '✓' : '✕'}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--foreground)' }}>{c.label}</div>
                      <div style={{ fontSize: 12, color: 'var(--foreground-muted,#6b7280)', lineHeight: 1.55 }}>{c.detail}</div>
                      {!c.ok && c.fix && <div style={{ fontSize: 11.5, color: '#b45309', marginTop: 3 }}>🛠 {c.fix}</div>}
                    </div>
                  </div>
                ))}
              </div>

              {res.raw && (
                <details style={{ marginTop: 10 }}>
                  <summary style={{ fontSize: 11.5, color: '#6b7280', cursor: 'pointer' }}>שגיאת Graph API גולמית</summary>
                  <pre style={{ fontSize: 11, background: 'var(--surface-raised,#f8fafc)', padding: 10, borderRadius: 8, overflow: 'auto', direction: 'ltr', textAlign: 'left' }}>{JSON.stringify(res.raw, null, 2)}</pre>
                </details>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
