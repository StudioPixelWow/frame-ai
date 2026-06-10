'use client';

export const dynamic = 'force-dynamic';

import { useCallback, useEffect, useRef, useState } from 'react';

const C = {
  primary: '#00B5FE', primaryDark: '#0095D0', bg: '#F7F9FC', card: '#FFFFFF',
  text: '#1A1A2E', sub: '#5A5A7A', muted: '#9A9AB0', border: '#E8EAF0', success: '#10B981', warn: '#F59E0B',
};

interface Brief { headline: string; priorities: string[]; risks: string[]; opportunity: string }
interface Risk { clientId: string; clientName: string; score: number; level: 'high' | 'medium' | 'low'; reasons: string[] }
interface Msg { role: 'user' | 'ai'; text: string }

const SUGGESTED = [
  'כמה משימות באיחור יש לנו?',
  'מה הכי דחוף היום?',
  'כמה לקוחות ריטיינר פעילים ומה צפי ההכנסה?',
  'אילו לקוחות לא קיבלו דוח Google Ads החודש?',
];

export default function AiCeoPage() {
  const [brief, setBrief] = useState<Brief | null>(null);
  const [risk, setRisk] = useState<Risk[]>([]);
  const [snap, setSnap] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [q, setQ] = useState('');
  const [asking, setAsking] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch('/api/agency-brain', { cache: 'no-store' });
      const d = await r.json();
      setBrief(d.brief || null); setSnap(d.snapshot || null); setRisk(d.risk || []);
    } catch { /* ok */ } finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [msgs]);

  const ask = async (question: string) => {
    if (!question.trim()) return;
    setMsgs((m) => [...m, { role: 'user', text: question }]); setQ(''); setAsking(true);
    try {
      const r = await fetch('/api/agency-brain', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ question }) });
      const d = await r.json();
      setMsgs((m) => [...m, { role: 'ai', text: d.answer || d.error || 'אין תשובה' }]);
    } catch { setMsgs((m) => [...m, { role: 'ai', text: 'שגיאה בעיבוד' }]); }
    finally { setAsking(false); }
  };

  const kpi = (label: string, value: any, color = C.text) => (
    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: '0.9rem 1.1rem', textAlign: 'center', flex: 1, minWidth: 120 }}>
      <div style={{ fontSize: 24, fontWeight: 900, color }}>{value ?? '—'}</div>
      <div style={{ fontSize: 11.5, color: C.sub, fontWeight: 600 }}>{label}</div>
    </div>
  );

  return (
    <div dir="rtl" style={{ maxWidth: 1000, margin: '0 auto', padding: '1.5rem 1.25rem 4rem', color: C.text, background: C.bg, minHeight: '100vh' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 12, marginBottom: 18 }}>
        <div>
          <div style={{ fontSize: 12, color: C.primary, letterSpacing: 2, fontWeight: 800 }}>AI CEO</div>
          <h1 style={{ fontSize: 24, fontWeight: 900, margin: '2px 0' }}>🧠 מנכ״ל AI</h1>
          <p style={{ color: C.sub, fontSize: 13.5, margin: 0 }}>תדריך בוקר חכם ושאל-את-הנתונים בשפה חופשית — מבוסס על מצב הסוכנות בזמן אמת.</p>
        </div>
        <button onClick={load} disabled={loading} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: '0.55rem 1rem', fontWeight: 700, fontSize: 13, cursor: 'pointer', color: C.text }}>{loading ? '⏳' : '↻ רענן'}</button>
      </div>

      {/* KPIs */}
      {snap && (
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16 }}>
          {kpi('לקוחות פעילים', snap.clients?.active, C.primary)}
          {kpi('משימות להיום', snap.tasks?.dueToday)}
          {kpi('באיחור', snap.tasks?.overdue, snap.tasks?.overdue ? C.warn : C.success)}
          {kpi('לא בוצעו', snap.tasks?.missed, snap.tasks?.missed ? '#EF4444' : C.success)}
          {kpi('צפי ריטיינר חודשי', snap.collections?.estMonthlyRetainer ? `₪${snap.collections.estMonthlyRetainer.toLocaleString('he-IL')}` : '—', C.success)}
        </div>
      )}

      {/* Daily brief */}
      <div style={{ background: `linear-gradient(135deg, ${C.primary}, ${C.primaryDark})`, color: '#fff', borderRadius: 18, padding: '20px 24px', marginBottom: 18, boxShadow: '0 10px 30px rgba(0,0,0,.12)' }}>
        <div style={{ fontSize: 12, opacity: 0.85, fontWeight: 800, letterSpacing: 1 }}>תדריך בוקר</div>
        {loading ? <div style={{ marginTop: 6, opacity: 0.9 }}>טוען…</div> : brief ? (
          <>
            <div style={{ fontSize: 19, fontWeight: 900, margin: '6px 0 12px' }}>{brief.headline}</div>
            {brief.priorities.length > 0 && (
              <div style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 12.5, fontWeight: 800, opacity: 0.9, marginBottom: 4 }}>🎯 עדיפויות היום</div>
                {brief.priorities.map((p, i) => <div key={i} style={{ fontSize: 14, lineHeight: 1.7 }}>• {p}</div>)}
              </div>
            )}
            {brief.risks.length > 0 && (
              <div style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 12.5, fontWeight: 800, opacity: 0.9, marginBottom: 4 }}>⚠️ דורש תשומת לב</div>
                {brief.risks.map((p, i) => <div key={i} style={{ fontSize: 14, lineHeight: 1.7 }}>• {p}</div>)}
              </div>
            )}
            {brief.opportunity && <div style={{ background: 'rgba(255,255,255,.15)', borderRadius: 10, padding: '8px 12px', fontSize: 13.5, marginTop: 6 }}>💡 {brief.opportunity}</div>}
          </>
        ) : <div style={{ marginTop: 6, opacity: 0.9 }}>אין נתונים זמינים.</div>}
      </div>

      {/* At-risk clients (Churn radar) */}
      {risk.length > 0 && (
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 18, padding: '1rem 1.2rem', marginBottom: 18 }}>
          <div style={{ fontSize: 15, fontWeight: 900, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8 }}>🚨 לקוחות בסיכון <span style={{ fontSize: 12, fontWeight: 700, color: C.muted }}>({risk.length})</span></div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {risk.map((c) => {
              const col = c.level === 'high' ? '#EF4444' : c.level === 'medium' ? C.warn : C.muted;
              return (
                <div key={c.clientId} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '9px 12px', border: `1px solid ${C.border}`, borderRadius: 10, background: C.bg }}>
                  <div style={{ width: 42, height: 42, borderRadius: 10, background: `${col}1A`, color: col, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: 15, flex: '0 0 auto' }}>{c.score}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <a href={`/clients/${c.clientId}`} style={{ fontWeight: 800, fontSize: 14, color: C.text, textDecoration: 'none' }}>{c.clientName}</a>
                    <div style={{ fontSize: 12, color: C.sub }}>{c.reasons.join(' · ')}</div>
                  </div>
                  <span style={{ fontSize: 11.5, fontWeight: 800, color: col, whiteSpace: 'nowrap' }}>{c.level === 'high' ? 'סיכון גבוה' : c.level === 'medium' ? 'סיכון בינוני' : 'מעקב'}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Ask the data */}
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 18, padding: '1rem 1.2rem' }}>
        <div style={{ fontSize: 15, fontWeight: 900, marginBottom: 10 }}>💬 שאל את הנתונים</div>
        {msgs.length === 0 && (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
            {SUGGESTED.map((s) => (
              <button key={s} onClick={() => ask(s)} style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 99, padding: '6px 12px', fontSize: 12.5, color: C.sub, cursor: 'pointer' }}>{s}</button>
            ))}
          </div>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 380, overflowY: 'auto', marginBottom: 12 }}>
          {msgs.map((m, i) => (
            <div key={i} style={{ alignSelf: m.role === 'user' ? 'flex-start' : 'flex-end', maxWidth: '85%', background: m.role === 'user' ? C.bg : 'rgba(0,181,254,0.08)', border: `1px solid ${m.role === 'user' ? C.border : 'rgba(0,181,254,0.3)'}`, borderRadius: 12, padding: '9px 13px', fontSize: 13.5, lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{m.text}</div>
          ))}
          {asking && <div style={{ alignSelf: 'flex-end', color: C.muted, fontSize: 13 }}>⏳ חושב…</div>}
          <div ref={endRef} />
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') ask(q); }}
            placeholder="שאל כל דבר על הסוכנות…" style={{ flex: 1, border: `1px solid ${C.border}`, borderRadius: 10, padding: '0.6rem 0.9rem', fontSize: 14 }} />
          <button onClick={() => ask(q)} disabled={asking || !q.trim()} style={{ background: q.trim() ? C.primary : C.border, color: '#fff', border: 'none', borderRadius: 10, padding: '0.6rem 1.2rem', fontWeight: 800, fontSize: 14, cursor: 'pointer' }}>שאל</button>
        </div>
      </div>
    </div>
  );
}
