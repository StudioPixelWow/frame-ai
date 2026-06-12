'use client';

export const dynamic = 'force-dynamic';

import { useState } from 'react';
import { PageHeader } from '@/components/ui/saas-kit';

const C = {
  primary: '#00B5FE', primaryDark: '#0095D0', bg: '#F7F9FC', card: '#FFFFFF',
  text: '#1A1A2E', sub: '#5A5A7A', muted: '#9A9AB0', border: '#E8EAF0',
  high: '#EF4444', med: '#F59E0B', low: '#9A9AB0', success: '#10B981',
};
const SEV: Record<string, { l: string; c: string }> = {
  high: { l: 'חמור', c: C.high }, medium: { l: 'בינוני', c: C.med }, low: { l: 'קל', c: C.low },
};

interface Issue { severity: string; type: string; detail: string }
interface Result { pass: boolean; score: number; issues: Issue[]; improved: string; summary: string }

export default function QualityCheckPage() {
  const [text, setText] = useState('');
  const [clientName, setClientName] = useState('');
  const [res, setRes] = useState<Result | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const run = async () => {
    if (!text.trim()) return;
    setBusy(true); setErr(''); setRes(null);
    try {
      const r = await fetch('/api/quality/check', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text, clientName }) });
      const d = await r.json();
      if (!r.ok || !d.success) throw new Error(d.error || 'שגיאה');
      setRes(d.result);
    } catch (e) { setErr(e instanceof Error ? e.message : 'שגיאה'); }
    finally { setBusy(false); }
  };

  const scoreColor = res ? (res.score >= 80 ? C.success : res.score >= 60 ? C.med : C.high) : C.muted;

  return (
    <div dir="rtl" style={{ maxWidth: 920, margin: '0 auto', padding: '1.5rem 1.25rem 4rem', color: C.text, background: C.bg, minHeight: '100vh' }}>
      <PageHeader
        title="✅ בקרת איכות AI"
        subtitle="בדוק כל תוכן ללקוח לפני שליחה — עברית, טון, מותג, שלמות — וקבל גרסה משופרת."
      />

      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: '1rem 1.2rem', marginBottom: 16 }}>
        <input value={clientName} onChange={(e) => setClientName(e.target.value)} placeholder="שם הלקוח (אופציונלי)" style={{ width: '100%', border: `1px solid ${C.border}`, borderRadius: 10, padding: '0.55rem 0.8rem', fontSize: 13.5, marginBottom: 10 }} />
        <textarea value={text} onChange={(e) => setText(e.target.value)} rows={7} placeholder="הדבק כאן את התוכן לבדיקה (פוסט, קאפשן, מייל, תקציר דוח…)" style={{ width: '100%', border: `1px solid ${C.border}`, borderRadius: 10, padding: '0.7rem 0.9rem', fontSize: 14, resize: 'vertical', fontFamily: 'inherit' }} />
        <button onClick={run} disabled={busy || !text.trim()} style={{ marginTop: 10, background: busy ? '#cbd5e1' : C.primary, color: '#fff', border: 'none', borderRadius: 10, padding: '0.65rem 1.4rem', fontWeight: 800, fontSize: 14, cursor: 'pointer' }}>
          {busy ? '⏳ בודק…' : '🔎 בדוק איכות'}
        </button>
        {err && <div style={{ marginTop: 10, color: '#B45309', fontSize: 13, fontWeight: 600 }}>{err}</div>}
      </div>

      {res && (
        <>
          <div style={{ display: 'flex', gap: 14, alignItems: 'center', background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: '1rem 1.2rem', marginBottom: 14 }}>
            <div style={{ width: 64, height: 64, borderRadius: 14, background: `${scoreColor}1A`, color: scoreColor, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: 22 }}>{res.score}</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 16, fontWeight: 900, color: res.pass ? C.success : C.med }}>{res.pass ? '✓ מוכן לשליחה' : '⚠️ דורש תיקונים לפני שליחה'}</div>
              <div style={{ fontSize: 13, color: C.sub, marginTop: 2 }}>{res.summary}</div>
            </div>
          </div>

          {res.issues.length > 0 && (
            <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: '1rem 1.2rem', marginBottom: 14 }}>
              <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 10 }}>הערות ({res.issues.length})</div>
              {res.issues.map((i, idx) => {
                const s = SEV[i.severity] || SEV.low;
                return (
                  <div key={idx} style={{ display: 'flex', gap: 10, padding: '8px 0', borderBottom: idx < res.issues.length - 1 ? `1px dashed ${C.border}` : 'none' }}>
                    <span style={{ background: `${s.c}1A`, color: s.c, borderRadius: 6, fontSize: 11, fontWeight: 800, padding: '2px 8px', height: 'fit-content', whiteSpace: 'nowrap' }}>{s.l}</span>
                    <div><span style={{ fontWeight: 700, fontSize: 13 }}>{i.type}</span><div style={{ fontSize: 13, color: C.sub, lineHeight: 1.6 }}>{i.detail}</div></div>
                  </div>
                );
              })}
            </div>
          )}

          {res.improved && (
            <div style={{ background: C.card, border: `2px solid ${C.primary}`, borderRadius: 14, padding: '1rem 1.2rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <div style={{ fontSize: 14, fontWeight: 800 }}>✨ גרסה משופרת מוכנה לשליחה</div>
                <button onClick={() => { navigator.clipboard?.writeText(res.improved); }} style={{ background: C.primary, color: '#fff', border: 'none', borderRadius: 8, padding: '0.35rem 0.8rem', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>📋 העתק</button>
              </div>
              <div style={{ fontSize: 14, lineHeight: 1.8, whiteSpace: 'pre-wrap', color: C.text }}>{res.improved}</div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
