'use client';

export const dynamic = 'force-dynamic';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

const C = {
  primary: '#00B5FE', primaryDark: '#0095D0', bg: '#F7F9FC', card: '#FFFFFF',
  text: '#1A1A2E', sub: '#5A5A7A', muted: '#9A9AB0', border: '#E8EAF0',
  high: '#EF4444', med: '#F59E0B', low: '#10B981',
};
const COMP_HE: Record<string, { l: string; c: string }> = {
  HIGH: { l: 'גבוהה', c: C.high }, MEDIUM: { l: 'בינונית', c: C.med }, LOW: { l: 'נמוכה', c: C.low },
};
const POT_C: Record<string, string> = { 'גבוה': C.low, 'בינוני': C.med, 'נמוך': C.muted };

interface Idea {
  keyword: string; volume: number; competition: string; competitionIndex: number;
  cpcLow: number; cpcHigh: number; potential: string; trend: { month: string; volume: number }[];
}

export default function KeywordResearchPage() {
  const router = useRouter();
  const [seed, setSeed] = useState('');
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [loading, setLoading] = useState(false);
  const [mock, setMock] = useState(false);
  const [mockReason, setMockReason] = useState('');
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [trendFor, setTrendFor] = useState<Idea | null>(null);
  const [questions, setQuestions] = useState<string[] | null>(null);
  const [qBusy, setQBusy] = useState(false);
  const [notice, setNotice] = useState('');

  const search = async () => {
    if (!seed.trim()) return;
    setLoading(true); setNotice(''); setQuestions(null);
    try {
      const r = await fetch('/api/seo/keyword-research', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'ideas', seed }) });
      const d = await r.json();
      if (!r.ok || !d.success) throw new Error(d.error || 'שגיאה');
      setIdeas(d.ideas || []); setMock(!!d.mock); setMockReason(d.reason || ''); setSel(new Set());
    } catch (e) { setNotice(e instanceof Error ? e.message : 'החיפוש נכשל'); }
    finally { setLoading(false); }
  };

  const toggle = (k: string) => setSel((p) => { const n = new Set(p); n.has(k) ? n.delete(k) : n.add(k); return n; });
  const allSel = ideas.length > 0 && sel.size === ideas.length;
  const toggleAll = () => setSel(allSel ? new Set() : new Set(ideas.map((i) => i.keyword)));

  const makeQuestions = async () => {
    const keywords = [...sel]; if (!keywords.length) { setNotice('בחר ביטויים תחילה'); return; }
    setQBusy(true); setNotice('');
    try {
      const r = await fetch('/api/seo/keyword-research', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'ai_questions', keywords }) });
      const d = await r.json();
      if (!r.ok || !d.success) throw new Error(d.error || 'שגיאה');
      setQuestions(d.questions || []);
    } catch (e) { setNotice(e instanceof Error ? e.message : 'יצירת השאלות נכשלה'); }
    finally { setQBusy(false); }
  };

  const copyAll = (lines: string[]) => { navigator.clipboard?.writeText(lines.join('\n')); setNotice('✓ הועתק ללוח'); };
  const maxVol = Math.max(1, ...ideas.map((i) => i.volume));

  return (
    <div dir="rtl" style={{ maxWidth: 1200, margin: '0 auto', padding: '1.5rem 1.25rem 4rem', color: C.text, background: C.bg, minHeight: '100vh' }}>
      <button onClick={() => router.push('/seo-geo/dashboard')} style={{ background: 'none', border: 'none', color: C.sub, fontSize: 13, cursor: 'pointer', marginBottom: 8 }}>← SEO/GEO</button>
      <div style={{ marginBottom: 18 }}>
        <div style={{ fontSize: 12, color: C.primary, letterSpacing: 2, fontWeight: 800 }}>KEYWORD RESEARCH</div>
        <h1 style={{ fontSize: 24, fontWeight: 900, margin: '2px 0' }}>🔑 מחקר ביטויים</h1>
        <p style={{ color: C.sub, fontSize: 13.5, margin: 0 }}>נפח חיפוש, תחרות, CPC וטרנד — והפיכת ביטויים לשאלות AI מנוטרות (GEO).</p>
      </div>

      {/* Search */}
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: '1rem 1.2rem', marginBottom: 16, display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        <input value={seed} onChange={(e) => setSeed(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') search(); }}
          placeholder="הזן ביטוי מקור, למשל: בושם לגבר" style={{ flex: 1, minWidth: 240, border: `1px solid ${C.border}`, borderRadius: 10, padding: '0.6rem 0.9rem', fontSize: 14 }} />
        <button onClick={search} disabled={loading || !seed.trim()} style={{ background: loading ? '#cbd5e1' : C.primary, color: '#fff', border: 'none', borderRadius: 10, padding: '0.6rem 1.4rem', fontWeight: 800, fontSize: 14, cursor: 'pointer' }}>
          {loading ? '⏳ מחפש…' : '🔍 חיפוש רעיונות'}
        </button>
      </div>

      {notice && <div style={{ marginBottom: 12, fontSize: 13, fontWeight: 600, color: notice.startsWith('✓') ? C.low : '#B45309' }}>{notice}</div>}
      {mock && ideas.length > 0 && (() => {
        const r = mockReason || '';
        const msg = r.startsWith('no_credentials') ? 'לא הוגדרו מפתחות DataForSEO (DATAFORSEO_LOGIN/PASSWORD) ב-Vercel.'
          : r.startsWith('auth_failed') ? '⚠ ההתחברות ל-DataForSEO נכשלה — שם המשתמש/סיסמת ה-API שגויים. בדוק את הערכים ב-Vercel.'
          : r.startsWith('payment_required') ? '⚠ חשבון ה-DataForSEO לא מאומת/ממומן — צריך לאמת ולהטעין יתרה בחשבון כדי לקבל נתונים אמיתיים.'
          : r.startsWith('task_error') || r.startsWith('api_error') ? `⚠ DataForSEO החזיר שגיאה: ${r.split(': ')[1] || r}`
          : r.startsWith('no_results') ? 'ℹ️ לא נמצאו נתוני נפח לזרע הזה ב-DataForSEO — מוצגת הערכה.'
          : r.startsWith('request_failed') ? `⚠ הבקשה ל-DataForSEO נכשלה: ${r.split(': ')[1] || ''}`
          : 'ℹ️ נתוני הערכה — חבר DataForSEO לנתוני נפח אמיתיים.';
        const isErr = msg.startsWith('⚠');
        return <div style={{ background: isErr ? '#FEF3F2' : '#EFF8FF', border: `1px solid ${isErr ? '#FDA29B' : '#B9E3FF'}`, borderRadius: 10, padding: '8px 12px', fontSize: 12.5, color: isErr ? '#B42318' : C.primaryDark, marginBottom: 12, fontWeight: 600 }}>{msg}</div>;
      })()}

      {/* Selection actions */}
      {ideas.length > 0 && (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 10, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 13, color: C.sub }}>נבחרו {sel.size} מתוך {ideas.length}</span>
          <button onClick={makeQuestions} disabled={qBusy || sel.size === 0} style={{ background: sel.size ? C.primaryDark : C.border, color: '#fff', border: 'none', borderRadius: 9, padding: '0.45rem 0.9rem', fontWeight: 700, fontSize: 12.5, cursor: 'pointer' }}>
            {qBusy ? '⏳ יוצר…' : '✨ צור שאלות AI מהביטויים'}
          </button>
          <button onClick={() => copyAll([...sel])} disabled={sel.size === 0} style={{ background: 'none', color: C.sub, border: `1px solid ${C.border}`, borderRadius: 9, padding: '0.45rem 0.9rem', fontWeight: 700, fontSize: 12.5, cursor: 'pointer' }}>📋 העתק נבחרים</button>
        </div>
      )}

      {/* AI questions result */}
      {questions && (
        <div style={{ background: C.card, border: `2px solid ${C.primary}`, borderRadius: 14, padding: '1rem 1.2rem', marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <div style={{ fontSize: 14, fontWeight: 800 }}>✨ שאלות AI מומלצות למעקב ({questions.length})</div>
            <button onClick={() => copyAll(questions)} style={{ background: C.primary, color: '#fff', border: 'none', borderRadius: 8, padding: '0.35rem 0.8rem', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>📋 העתק הכל</button>
          </div>
          {questions.map((q, i) => (
            <div key={i} style={{ fontSize: 13.5, color: C.text, padding: '6px 0', borderBottom: i < questions.length - 1 ? `1px dashed ${C.border}` : 'none' }}>• {q}</div>
          ))}
          <div style={{ fontSize: 11.5, color: C.muted, marginTop: 8 }}>הוסף אותן ב-AI Visibility Center כשאלות מנוטרות כדי לעקוב אם העסק מופיע בתשובות ה-AI.</div>
        </div>
      )}

      {/* Results table */}
      {ideas.length > 0 && (
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, overflow: 'hidden' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '34px 1fr 110px 110px 130px 90px 80px', gap: 8, padding: '10px 14px', borderBottom: `1px solid ${C.border}`, fontSize: 11.5, fontWeight: 800, color: C.sub, background: C.bg }}>
            <input type="checkbox" checked={allSel} onChange={toggleAll} />
            <div>ביטוי</div><div>נפח חודשי</div><div>תחרות</div><div>CPC (נמוך–גבוה)</div><div>פוטנציאל</div><div>טרנד</div>
          </div>
          {ideas.map((it) => {
            const comp = COMP_HE[it.competition] || COMP_HE.MEDIUM;
            return (
              <div key={it.keyword} style={{ display: 'grid', gridTemplateColumns: '34px 1fr 110px 110px 130px 90px 80px', gap: 8, padding: '10px 14px', borderBottom: `1px solid ${C.border}`, alignItems: 'center', fontSize: 13 }}>
                <input type="checkbox" checked={sel.has(it.keyword)} onChange={() => toggle(it.keyword)} />
                <div style={{ fontWeight: 700 }}>{it.keyword}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontWeight: 800 }}>{it.volume.toLocaleString('he-IL')}</span>
                  <div style={{ flex: 1, height: 5, background: C.bg, borderRadius: 9, overflow: 'hidden', maxWidth: 40 }}><div style={{ width: `${(it.volume / maxVol) * 100}%`, height: '100%', background: C.primary }} /></div>
                </div>
                <div style={{ color: comp.c, fontWeight: 700 }}>{comp.l} ({it.competitionIndex})</div>
                <div>₪{it.cpcLow} – ₪{it.cpcHigh}</div>
                <div><span style={{ background: `${POT_C[it.potential]}1A`, color: POT_C[it.potential], borderRadius: 6, fontSize: 11.5, fontWeight: 800, padding: '2px 8px' }}>{it.potential}</span></div>
                <div><button onClick={() => setTrendFor(it)} style={{ background: 'none', border: `1px solid ${C.border}`, borderRadius: 7, padding: '3px 8px', fontSize: 11.5, fontWeight: 700, color: C.primaryDark, cursor: 'pointer' }}>📈 טרנד</button></div>
              </div>
            );
          })}
        </div>
      )}

      {/* Trend popup */}
      {trendFor && (
        <div onClick={() => setTrendFor(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(16,24,40,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60, padding: 16 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 560, padding: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div style={{ fontSize: 16, fontWeight: 900 }}>טרנד חיפושים: {trendFor.keyword}</div>
              <button onClick={() => setTrendFor(null)} style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: C.sub }}>✕</button>
            </div>
            {(() => {
              const t = trendFor.trend; const max = Math.max(1, ...t.map((p) => p.volume));
              const W = 520, H = 180, pad = 30;
              const pts = t.map((p, i) => ({ x: pad + (i * (W - 2 * pad)) / (t.length - 1), y: H - pad - (p.volume / max) * (H - 2 * pad), v: p.volume, m: p.month }));
              const line = pts.map((p) => `${p.x},${p.y}`).join(' ');
              const avg = Math.round(t.reduce((s, p) => s + p.volume, 0) / t.length);
              const peak = t.reduce((a, b) => (b.volume > a.volume ? b : a), t[0]);
              return (<>
                <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
                  <div style={{ flex: 1, background: C.bg, borderRadius: 10, padding: '10px 12px', textAlign: 'center' }}><div style={{ fontSize: 11, color: C.sub }}>ממוצע חודשי</div><div style={{ fontSize: 18, fontWeight: 900, color: C.primary }}>{avg.toLocaleString('he-IL')}</div></div>
                  <div style={{ flex: 1, background: C.bg, borderRadius: 10, padding: '10px 12px', textAlign: 'center' }}><div style={{ fontSize: 11, color: C.sub }}>חודש שיא</div><div style={{ fontSize: 18, fontWeight: 900, color: C.text }}>{peak.month}</div></div>
                </div>
                <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto' }}>
                  <polyline points={line} fill="none" stroke={C.primary} strokeWidth="3" strokeLinejoin="round" />
                  {pts.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r="3.5" fill="#fff" stroke={C.primary} strokeWidth="2" />)}
                </svg>
                <div style={{ fontSize: 11, color: C.muted, marginTop: 8, textAlign: 'center' }}>הנתונים מבוססים על Google Ads Keyword Planner ועשויים להיות משוערים.</div>
              </>);
            })()}
          </div>
        </div>
      )}
    </div>
  );
}
