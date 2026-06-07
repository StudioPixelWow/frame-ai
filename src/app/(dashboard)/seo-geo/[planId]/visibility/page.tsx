'use client';

export const dynamic = 'force-dynamic';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';

const C = {
  primary: '#00B5FE', primaryDark: '#0095D0', primaryLight: '#E6F7FF',
  bg: '#F7F9FC', card: '#FFFFFF', text: '#1A1A2E', textSecondary: '#5A5A7A', textMuted: '#9A9AB0',
  border: '#E8EAF0', borderLight: '#F0F2F5', success: '#10B981', warning: '#F59E0B', danger: '#EF4444', info: '#3B82F6',
};
const TABS = [
  { id: 'overview', label: 'סקירה', icon: '📊' }, { id: 'alerts', label: 'התראות', icon: '🔔' },
  { id: 'queries', label: 'שאילתות', icon: '🔤' }, { id: 'prompts', label: 'Prompts', icon: '🧭' }, { id: 'runs', label: 'ריצות', icon: '⚡' },
  { id: 'mentions', label: 'אזכורים', icon: '💬' }, { id: 'citations', label: 'ציטוטים', icon: '🔗' },
  { id: 'timeline', label: 'Citation Timeline', icon: '📈' }, { id: 'changelog', label: 'Change Log', icon: '📝' },
  { id: 'diffs', label: 'Diffs', icon: '🔀' }, { id: 'competitors', label: 'מתחרים', icon: '🥊' },
  { id: 'topics', label: 'תחומים', icon: '🗂️' }, { id: 'global', label: 'Global Index', icon: '🌐' },
  { id: 'settings', label: 'הגדרות', icon: '⚙️' },
];
const sc = (n: number) => (n >= 75 ? C.success : n >= 50 ? C.warning : C.danger);
const Tag = ({ kind }: { kind: string }) => {
  const map: any = { measured: ['נמדד', C.success], estimated: ['אומדן', C.warning], mock: ['דמו', C.textMuted], simulated: ['סימולציה', C.info] };
  const [l, col] = map[kind] || ['—', C.textMuted];
  return <span title="Measured vs Estimated" style={{ fontSize: 9.5, fontWeight: 800, color: col, background: `${col}18`, borderRadius: 5, padding: '1px 5px', marginInlineStart: 5 }}>{l}</span>;
};

export default function VisibilityCenterPage() {
  const { planId } = useParams<{ planId: string }>();
  const router = useRouter();
  const [s, setS] = useState<any>(null);
  const [tab, setTab] = useState('overview');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [err, setErr] = useState('');
  const [notice, setNotice] = useState('');
  const [preview, setPreview] = useState<any>(null);
  const [newQ, setNewQ] = useState(''); const [newComp, setNewComp] = useState(''); const [newPrompt, setNewPrompt] = useState('');
  const [brandEdits, setBrandEdits] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setLoading(true); setErr('');
    try { const r = await fetch(`/api/seo-geo-plans/${planId}/visibility`, { cache: 'no-store' }); const d = await r.json(); if (!r.ok) throw new Error(d.error || 'שגיאה'); setS(d.data || d); }
    catch (e) { setErr(e instanceof Error ? e.message : 'שגיאה'); } finally { setLoading(false); }
  }, [planId]);
  useEffect(() => { load(); }, [load]);

  const post = async (payload: any, key: string) => {
    setBusy(key); setErr('');
    try { const r = await fetch(`/api/seo-geo-plans/${planId}/visibility`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }); const d = await r.json(); if (!r.ok) throw new Error(d.error || 'שגיאה'); const next = d.data?.state || d.data?.run ? d.data.state : d.data; if (next?.engines) setS(next); else await load(); return d.data || d; }
    catch (e) { setErr(e instanceof Error ? e.message : 'שגיאה'); } finally { setBusy(''); }
  };

  const card: React.CSSProperties = { background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: '1rem 1.15rem' };
  const sum = s?.summary || {};
  const trend = s?.trend || [];
  const maxMen = Math.max(1, ...trend.map((t: any) => t.total_mentions || 0));

  const Th = ({ children }: any) => <th style={{ textAlign: 'right', padding: '7px 8px', color: C.textSecondary, fontWeight: 700, borderBottom: `1px solid ${C.border}`, whiteSpace: 'nowrap' }}>{children}</th>;
  const Td = ({ children, w }: any) => <td style={{ padding: '7px 8px', borderBottom: `1px solid ${C.borderLight}`, maxWidth: w || 240, overflow: 'hidden', textOverflow: 'ellipsis' }}>{children}</td>;

  return (
    <div dir="rtl" style={{ maxWidth: 1240, margin: '0 auto', padding: '1.5rem 1.25rem 4rem', color: C.text, background: C.bg, minHeight: '100vh' }}>
      <button onClick={() => router.push(`/seo-geo/${planId}/authority`)} style={{ background: 'none', border: 'none', color: C.textSecondary, fontSize: 13, cursor: 'pointer', marginBottom: 8 }}>← Authority Center</button>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 800, margin: 0 }}>📡 GEO AI Visibility Center</h1>
          <p style={{ color: C.textSecondary, fontSize: 13, margin: '4px 0 0' }}>ניטור מבוקר של נראות המותג במנועי AI לאורך זמן — אזכורים, ציטוטים, Share of AI Voice ומתחרים.</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={async () => { const d = await post({ action: 'cost_preview' }, 'prev'); if (d) setPreview(d); }} disabled={!!busy} style={{ background: C.card, color: C.text, border: `1px solid ${C.border}`, borderRadius: 12, padding: '0.6rem 1rem', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>{busy === 'prev' ? '⏳' : '⚡ הרץ בדיקה'}</button>
          <button onClick={() => window.open(`/api/seo-geo-plans/${planId}/visibility/report?format=progress`, '_blank')} style={{ background: '#0a2540', color: '#fff', border: 'none', borderRadius: 12, padding: '0.6rem 0.9rem', fontWeight: 800, fontSize: 13, cursor: 'pointer' }}>📈 דוח צמיחה</button>
          <button onClick={() => window.open(`/api/seo-geo-plans/${planId}/visibility/report?format=html`, '_blank')} style={{ background: C.card, color: C.text, border: `1px solid ${C.border}`, borderRadius: 12, padding: '0.6rem 0.9rem', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>📄 דוח (PDF)</button>
          <button onClick={() => window.open(`/api/seo-geo-plans/${planId}/visibility/report?format=csv`, '_blank')} style={{ background: C.card, color: C.text, border: `1px solid ${C.border}`, borderRadius: 12, padding: '0.6rem 0.9rem', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>⬇ CSV</button>
          <button onClick={async () => { setBusy('send'); setErr(''); try { const r = await fetch(`/api/seo-geo-plans/${planId}/visibility/report`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ channel: 'email' }) }); const j = await r.json(); if (!r.ok) throw new Error(j.error || 'שגיאה'); setNotice(`הדוח נשלח ל-${j.data?.to || 'לקוח'}`); } catch (e) { setErr(e instanceof Error ? e.message : 'שגיאה'); } finally { setBusy(''); } }} disabled={!!busy} style={{ background: C.card, color: C.text, border: `1px solid ${C.border}`, borderRadius: 12, padding: '0.6rem 0.9rem', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>{busy === 'send' ? '⏳' : '✉ שלח ללקוח'}</button>
          <button onClick={async () => { const d = await post({ action: 'enable_automation', frequency: 'weekly' }, 'auto'); if (d) setNotice('אוטומציה שבועית הופעלה'); }} disabled={!!busy} style={{ background: C.primary, color: '#fff', border: 'none', borderRadius: 12, padding: '0.6rem 1rem', fontWeight: 800, fontSize: 13, cursor: 'pointer' }}>{busy === 'auto' ? '⏳' : '🔁 אוטומציה'}</button>
        </div>
      </div>

      <div style={{ background: '#FFFBEB', border: `1px solid ${C.warning}40`, color: '#92610A', borderRadius: 10, padding: '0.5rem 0.8rem', fontSize: 11.5, margin: '10px 0' }}>ℹ️ המספרים מבוססים על שאילתות מנוטרות מול מנועי AI — לא נתון רשמי של שימוש בפועל. <b>אומדן</b> מסומן ככזה.</div>
      {err && <div style={{ background: '#FEF2F2', border: `1px solid ${C.danger}40`, color: C.danger, borderRadius: 10, padding: '0.6rem 0.9rem', fontSize: 13, fontWeight: 600, marginBottom: 8 }}>⚠ {err}</div>}
      {notice && <div style={{ background: `${C.info}10`, border: `1px solid ${C.info}40`, color: C.info, borderRadius: 10, padding: '0.6rem 0.9rem', fontSize: 13, fontWeight: 600, marginBottom: 8, display: 'flex', justifyContent: 'space-between' }}><span>ℹ {notice}</span><span style={{ cursor: 'pointer' }} onClick={() => setNotice('')}>✕</span></div>}

      {/* Cost preview modal */}
      {preview && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }} onClick={() => setPreview(null)}>
          <div style={{ ...card, maxWidth: 420, width: '90%' }} onClick={(e) => e.stopPropagation()}>
            <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 8 }}>אישור הרצת בדיקה</div>
            <div style={{ fontSize: 13, color: C.textSecondary, lineHeight: 1.8 }}>
              שאילתות: <b>{preview.queries}</b><br />מנועים: <b>{(preview.engines || []).join(', ')}</b><br />קריאות: <b>{preview.calls}</b><br />עלות משוערת: <b>{(preview.estCostCents / 100).toFixed(2)}₪</b><br />מצב: <b>{preview.live ? 'מנועים אמיתיים' : 'דמו (אין מפתחות API)'}</b>
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
              <button onClick={async () => { setPreview(null); await post({ action: 'run_now' }, 'run'); }} disabled={!!busy} style={{ flex: 1, background: C.primary, color: '#fff', border: 'none', borderRadius: 10, padding: '0.6rem', fontWeight: 800, cursor: 'pointer' }}>{busy === 'run' ? '⏳ רץ…' : '▶ אשר והרץ'}</button>
              <button onClick={() => setPreview(null)} style={{ background: C.borderLight, border: 'none', borderRadius: 10, padding: '0.6rem 1rem', cursor: 'pointer' }}>ביטול</button>
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', margin: '14px 0' }}>
        {TABS.map((t) => <button key={t.id} onClick={() => setTab(t.id)} style={{ border: 'none', borderRadius: 10, padding: '0.45rem 0.85rem', fontSize: 12.5, fontWeight: tab === t.id ? 800 : 600, cursor: 'pointer', background: tab === t.id ? C.primary : C.card, color: tab === t.id ? '#fff' : C.textSecondary, boxShadow: tab === t.id ? 'none' : `inset 0 0 0 1px ${C.border}` }}>{t.icon} {t.label}</button>)}
      </div>

      {loading ? <div style={{ textAlign: 'center', padding: '4rem', color: C.textMuted }}>טוען…</div> : !s ? null : (
        <>
          {tab === 'overview' && (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px,1fr))', gap: 10, marginBottom: 14 }}>
                {[
                  ['Visibility Score', sum.visibility_score ?? 0, 'measured', sc(sum.visibility_score || 0)],
                  ['AI Mentions (חודש)', sum.total_mentions ?? 0, 'measured'],
                  ['Share of AI Voice', `${Math.round((sum.share_of_ai_voice || 0) * 100)}%`, 'measured'],
                  ['Citations', sum.total_citations ?? 0, 'measured'],
                  ['Estimated AI Reach', sum.estimated_ai_reach ?? 0, 'estimated'],
                  ['Top Engine', sum.top_engine || '—', 'measured'],
                ].map(([l, v, k, col]: any) => (
                  <div key={l} style={{ ...card, padding: '0.8rem' }}>
                    <div style={{ fontSize: 11.5, color: C.textSecondary, fontWeight: 600 }}>{l}<Tag kind={k} /></div>
                    <div style={{ fontSize: 24, fontWeight: 900, color: col || C.text, marginTop: 4 }}>{v}</div>
                  </div>
                ))}
              </div>

              <div style={{ ...card, marginBottom: 14 }}>
                <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 10 }}>AI Mentions לאורך זמן</div>
                {trend.length === 0 ? <div style={{ color: C.textMuted, fontSize: 13 }}>אין עדיין נתונים — הרץ בדיקה.</div> : (
                  <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 120 }}>
                    {trend.map((t: any) => (
                      <div key={t.month} style={{ flex: 1, textAlign: 'center' }}>
                        <div style={{ height: `${(t.total_mentions / maxMen) * 90}px`, background: C.primary, borderRadius: '4px 4px 0 0', minHeight: 2 }} title={`${t.total_mentions} mentions`} />
                        <div style={{ fontSize: 9.5, color: C.textMuted, marginTop: 4 }}>{t.month?.slice(5)}</div>
                        <div style={{ fontSize: 10, fontWeight: 700 }}>{t.total_mentions}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <div style={card}>
                  <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 8 }}>🎯 הזדמנויות (שאילתות בלי אזכור)</div>
                  {(s.opportunities || []).slice(0, 12).map((o: any) => <div key={o.id} style={{ fontSize: 12.5, padding: '5px 0', borderTop: `1px solid ${C.borderLight}`, color: C.text }}>{o.query} <span style={{ color: C.textMuted, fontSize: 11 }}>· {o.topic}</span></div>)}
                  {(s.opportunities || []).length === 0 && <div style={{ color: C.textMuted, fontSize: 13 }}>—</div>}
                </div>
                <div style={card}>
                  <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 8 }}>🥊 מתחרים מובילים ב-AI</div>
                  {(s.competitorLeaderboard || []).slice(0, 12).map((c: any) => <div key={c.name} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, padding: '5px 0', borderTop: `1px solid ${C.borderLight}` }}><span>{c.name}</span><b>{c.count}</b></div>)}
                  {(s.competitorLeaderboard || []).length === 0 && <div style={{ color: C.textMuted, fontSize: 13 }}>אין נתוני מתחרים עדיין.</div>}
                </div>
              </div>

              <div style={{ ...card, marginTop: 14 }}>
                <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 8 }}>זמינות מנועים</div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {(s.engines || []).map((e: any) => <span key={e.id} style={{ fontSize: 12, fontWeight: 700, color: e.available ? C.success : C.textMuted, background: e.available ? `${C.success}15` : C.borderLight, borderRadius: 8, padding: '4px 10px' }}>{e.available ? '✓' : '○'} {e.id}{!e.available ? ' (דמו)' : ''}</span>)}
                </div>
              </div>
            </>
          )}

          {tab === 'queries' && (
            <div style={card}>
              <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                <input value={newQ} onChange={(e) => setNewQ(e.target.value)} placeholder="הוסף שאילתה…" style={{ flex: 1, fontSize: 13, padding: '0.5rem 0.7rem', border: `1px solid ${C.border}`, borderRadius: 9 }} />
                <button onClick={() => { if (newQ.trim()) { post({ action: 'add_query', query_text: newQ.trim() }, 'aq'); setNewQ(''); } }} disabled={!!busy} style={{ background: C.primary, color: '#fff', border: 'none', borderRadius: 9, padding: '0.5rem 1rem', fontWeight: 800, fontSize: 12.5, cursor: 'pointer' }}>+ הוסף</button>
                <button onClick={() => post({ action: 'gen_queries' }, 'gq')} disabled={!!busy} style={{ background: C.card, color: C.text, border: `1px solid ${C.border}`, borderRadius: 9, padding: '0.5rem 1rem', fontWeight: 700, fontSize: 12.5, cursor: 'pointer' }}>{busy === 'gq' ? '⏳' : '✨ צור אוטומטית מהאתר'}</button>
              </div>
              <div style={{ fontSize: 12, color: C.textSecondary, marginBottom: 6 }}>{s.queryCount} שאילתות פעילות</div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}><thead><tr><Th>שאילתה</Th><Th>תחום</Th><Th>Intent</Th><Th>עדיפות</Th></tr></thead><tbody>
                {(s.opportunities || []).map((q: any) => <tr key={q.id}><Td>{q.query}</Td><Td>{q.topic}</Td><Td>{q.intent || '—'}</Td><Td>{q.priority}</Td></tr>)}
              </tbody></table>
              <div style={{ fontSize: 11, color: C.textMuted, marginTop: 6 }}>* מוצגות שאילתות ללא אזכור (הזדמנויות). הרשימה המלאה זמינה דרך הריצות.</div>
            </div>
          )}

          {tab === 'prompts' && (
            <div style={card}>
              <div style={{ fontSize: 12, color: C.textSecondary, marginBottom: 10 }}>Prompts הם שאלות בסגנון שיחה (follow-up) שנמדדות בנוסף לשאילתות — לניטור Conversation Path Visibility.</div>
              <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                <input value={newPrompt} onChange={(e) => setNewPrompt(e.target.value)} placeholder="הוסף prompt בסגנון שיחה…" style={{ flex: 1, fontSize: 13, padding: '0.5rem 0.7rem', border: `1px solid ${C.border}`, borderRadius: 9 }} />
                <button onClick={() => { if (newPrompt.trim()) { post({ action: 'add_prompt', prompt_text: newPrompt.trim() }, 'ap'); setNewPrompt(''); } }} disabled={!!busy} style={{ background: C.primary, color: '#fff', border: 'none', borderRadius: 9, padding: '0.5rem 1rem', fontWeight: 800, fontSize: 12.5, cursor: 'pointer' }}>+ הוסף</button>
                <button onClick={() => post({ action: 'gen_followups' }, 'gf')} disabled={!!busy} style={{ background: C.card, color: C.text, border: `1px solid ${C.border}`, borderRadius: 9, padding: '0.5rem 1rem', fontWeight: 700, fontSize: 12.5, cursor: 'pointer' }}>{busy === 'gf' ? '⏳' : '✨ צור follow-ups'}</button>
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}><thead><tr><Th>Prompt</Th><Th>עומק</Th><Th>שלב כוונה</Th><Th>תחום</Th><Th></Th></tr></thead><tbody>
                {(s.prompts || []).map((p: any) => <tr key={p.id}><Td w={420}>{p.prompt_text}</Td><Td>{p.conversation_depth}</Td><Td>{p.intent_stage}</Td><Td>{p.topic}</Td><Td><button onClick={() => post({ action: 'delete_prompt', id: p.id }, `dp-${p.id}`)} style={{ background: 'none', border: 'none', color: C.danger, cursor: 'pointer', fontSize: 12 }}>מחק</button></Td></tr>)}
                {(s.prompts || []).length === 0 && <tr><td colSpan={5} style={{ textAlign: 'center', color: C.textMuted, padding: '1.5rem' }}>אין prompts — הוסף או צור follow-ups אוטומטית.</td></tr>}
              </tbody></table>
            </div>
          )}

          {tab === 'runs' && (
            <div style={card}><table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}><thead><tr><Th>תאריך</Th><Th>סוג</Th><Th>סטטוס</Th><Th>שאילתות</Th><Th>אזכורים</Th><Th>ציטוטים</Th><Th>ציון</Th><Th>עלות</Th></tr></thead><tbody>
              {(s.runs || []).map((r: any) => <tr key={r.id}><Td>{new Date(r.created_at).toLocaleString('he-IL', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</Td><Td>{r.run_type}</Td><Td><span style={{ color: r.status === 'completed' ? C.success : r.status === 'failed' ? C.danger : C.warning, fontWeight: 700 }}>{r.status}</span></Td><Td>{r.successful_queries}/{r.total_queries}</Td><Td>{r.mentions}</Td><Td>{r.citations}</Td><Td><b style={{ color: sc(r.visibility_score || 0) }}>{r.visibility_score ?? '—'}</b></Td><Td>{((r.cost_estimate_cents || 0) / 100).toFixed(2)}₪</Td></tr>)}
              {(s.runs || []).length === 0 && <tr><td colSpan={8} style={{ textAlign: 'center', color: C.textMuted, padding: '1.5rem' }}>אין ריצות. לחץ "הרץ בדיקה".</td></tr>}
            </tbody></table></div>
          )}

          {tab === 'mentions' && (
            <div style={card}><table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}><thead><tr><Th>מנוע</Th><Th>סוג</Th><Th>המלצה</Th><Th>מיקום</Th><Th>טקסט</Th></tr></thead><tbody>
              {(s.mentions || []).map((m: any) => <tr key={m.id}><Td>{m.ai_engine}</Td><Td>{m.mention_type}</Td><Td>{m.recommendation_level}</Td><Td>{m.position ?? '—'}</Td><Td w={360}>{m.mention_text}</Td></tr>)}
              {(s.mentions || []).length === 0 && <tr><td colSpan={5} style={{ textAlign: 'center', color: C.textMuted, padding: '1.5rem' }}>אין אזכורים עדיין.</td></tr>}
            </tbody></table></div>
          )}

          {tab === 'citations' && (
            <div style={{ display: 'grid', gap: 14 }}>
              <div style={card}><div style={{ fontWeight: 800, fontSize: 14, marginBottom: 8 }}>עמודים מצוטטים (האתר שלנו)</div>
                {(s.citationPages || []).map((p: any) => <div key={p.url} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, padding: '5px 0', borderTop: `1px solid ${C.borderLight}` }}><span style={{ overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 480 }}>{p.url}</span><b>{p.count}</b></div>)}
                {(s.citationPages || []).length === 0 && <div style={{ color: C.textMuted, fontSize: 13 }}>אין ציטוטים לאתר עדיין.</div>}
              </div>
              <div style={card}><table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}><thead><tr><Th>מנוע</Th><Th>דומיין</Th><Th>שלנו?</Th><Th>מתחרה?</Th><Th>מיקום</Th></tr></thead><tbody>
                {(s.citations || []).map((c: any) => <tr key={c.id}><Td>{c.ai_engine}</Td><Td>{c.cited_domain}</Td><Td>{c.is_own_site ? '✓' : '—'}</Td><Td>{c.is_competitor_site ? '✓' : '—'}</Td><Td>{c.citation_position}</Td></tr>)}
                {(s.citations || []).length === 0 && <tr><td colSpan={5} style={{ textAlign: 'center', color: C.textMuted, padding: '1.5rem' }}>—</td></tr>}
              </tbody></table></div>
            </div>
          )}

          {tab === 'competitors' && (
            <div style={card}>
              <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                <input value={newComp} onChange={(e) => setNewComp(e.target.value)} placeholder="שם מתחרה…" style={{ flex: 1, fontSize: 13, padding: '0.5rem 0.7rem', border: `1px solid ${C.border}`, borderRadius: 9 }} />
                <button onClick={() => { if (newComp.trim()) { post({ action: 'add_competitor', competitor_name: newComp.trim() }, 'ac'); setNewComp(''); } }} disabled={!!busy} style={{ background: C.primary, color: '#fff', border: 'none', borderRadius: 9, padding: '0.5rem 1rem', fontWeight: 800, fontSize: 12.5, cursor: 'pointer' }}>+ הוסף</button>
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}><thead><tr><Th>מתחרה</Th><Th>דומיין</Th><Th>אזכורים</Th><Th></Th></tr></thead><tbody>
                {(s.competitors || []).map((c: any) => { const lb = (s.competitorLeaderboard || []).find((x: any) => x.name === c.competitor_name); return <tr key={c.id}><Td>{c.competitor_name}</Td><Td>{c.competitor_domain || '—'}</Td><Td>{lb?.count || 0}</Td><Td><button onClick={() => post({ action: 'delete_competitor', id: c.id }, `dc-${c.id}`)} style={{ background: 'none', border: 'none', color: C.danger, cursor: 'pointer', fontSize: 12 }}>מחק</button></Td></tr>; })}
                {(s.competitors || []).length === 0 && <tr><td colSpan={4} style={{ textAlign: 'center', color: C.textMuted, padding: '1.5rem' }}>הוסף מתחרים למעקב.</td></tr>}
              </tbody></table>
            </div>
          )}

          {tab === 'topics' && (
            <div style={card}><table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}><thead><tr><Th>תחום</Th><Th>שאילתות</Th><Th>אזכורים</Th><Th>נראות</Th></tr></thead><tbody>
              {(s.topics || []).map((t: any) => <tr key={t.topic}><Td>{t.topic}</Td><Td>{t.queries}</Td><Td>{t.mentions}</Td><Td><b style={{ color: sc(t.rate) }}>{t.rate}%</b></Td></tr>)}
              {(s.topics || []).length === 0 && <tr><td colSpan={4} style={{ textAlign: 'center', color: C.textMuted, padding: '1.5rem' }}>—</td></tr>}
            </tbody></table></div>
          )}

          {tab === 'alerts' && (
            <div style={card}>
              <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 10 }}>🔔 התראות נראות ({(s.alertCounts?.new || 0)} חדשות)</div>
              {(s.alerts || []).length === 0 ? <div style={{ color: C.textMuted, fontSize: 13 }}>אין התראות. התראות נוצרות אוטומטית כשמשהו משתנה בין ריצות.</div> :
                (s.alerts || []).map((a: any) => {
                  const col = a.severity === 'high' ? C.danger : a.severity === 'medium' ? C.warning : C.info;
                  return (
                    <div key={a.id} style={{ borderTop: `1px solid ${C.borderLight}`, padding: '0.7rem 0', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: col, marginTop: 6, flexShrink: 0 }} />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 700 }}>{a.title} {a.status === 'new' && <span style={{ fontSize: 9.5, fontWeight: 800, color: C.danger, background: `${C.danger}15`, borderRadius: 5, padding: '1px 5px' }}>חדש</span>}</div>
                        <div style={{ fontSize: 11.5, color: C.textSecondary }}>{a.description}</div>
                        {a.action_recommendation && <div style={{ fontSize: 11, color: C.primaryDark, marginTop: 2 }}>💡 {a.action_recommendation}</div>}
                      </div>
                      <div style={{ display: 'flex', gap: 6 }}>
                        {a.status === 'new' && <button onClick={() => post({ action: 'alert_status', alertId: a.id, status: 'acknowledged' }, `ak-${a.id}`)} style={{ fontSize: 11, fontWeight: 700, color: C.info, background: `${C.info}12`, border: 'none', borderRadius: 7, padding: '0.25rem 0.6rem', cursor: 'pointer' }}>סמן נקרא</button>}
                        <button onClick={() => post({ action: 'alert_status', alertId: a.id, status: 'dismissed' }, `dm-${a.id}`)} style={{ fontSize: 11, fontWeight: 700, color: C.textMuted, background: C.borderLight, border: 'none', borderRadius: 7, padding: '0.25rem 0.6rem', cursor: 'pointer' }}>הסר</button>
                      </div>
                    </div>
                  );
                })}
            </div>
          )}

          {tab === 'timeline' && (
            <div style={card}><div style={{ fontWeight: 800, fontSize: 14, marginBottom: 8 }}>📈 Citation Timeline (עמודי האתר)</div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}><thead><tr><Th>URL</Th><Th>סטטוס</Th><Th>מגמה</Th><Th>נראה לראשונה</Th><Th>לאחרונה</Th><Th>פעמים</Th><Th>אובדנים</Th></tr></thead><tbody>
                {(s.citationHistory || []).filter((h: any) => h.is_own_site).map((h: any) => { const stc = h.current_visibility_status === 'lost' ? C.danger : h.current_visibility_status === 'regained' ? C.info : C.success; return <tr key={h.id}><Td w={320}>{h.cited_url}</Td><Td><span style={{ color: stc, fontWeight: 700 }}>{h.current_visibility_status}</span></Td><Td>{h.visibility_trend}</Td><Td>{h.first_seen_at ? new Date(h.first_seen_at).toLocaleDateString('he-IL') : '—'}</Td><Td>{h.last_seen_at ? new Date(h.last_seen_at).toLocaleDateString('he-IL') : '—'}</Td><Td>{h.total_times_seen}</Td><Td>{h.citation_loss_count || 0}</Td></tr>; })}
                {(s.citationHistory || []).filter((h: any) => h.is_own_site).length === 0 && <tr><td colSpan={7} style={{ textAlign: 'center', color: C.textMuted, padding: '1.5rem' }}>אין היסטוריית ציטוטים עדיין — צריך לפחות 2 ריצות.</td></tr>}
              </tbody></table>
            </div>
          )}

          {tab === 'changelog' && (
            <div style={card}><div style={{ fontWeight: 800, fontSize: 14, marginBottom: 8 }}>📝 AI Answer Change Log</div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}><thead><tr><Th>תאריך</Th><Th>מנוע</Th><Th>אירוע</Th><Th>חומרה</Th><Th>הסבר</Th></tr></thead><tbody>
                {(s.changeEvents || []).map((e: any) => { const col = e.severity === 'high' ? C.danger : e.severity === 'medium' ? C.warning : C.textMuted; return <tr key={e.id}><Td>{new Date(e.created_at).toLocaleDateString('he-IL')}</Td><Td>{e.ai_engine}</Td><Td><span style={{ color: col, fontWeight: 700 }}>{e.event_type}</span></Td><Td>{e.severity}</Td><Td w={360}>{e.explanation}</Td></tr>; })}
                {(s.changeEvents || []).length === 0 && <tr><td colSpan={5} style={{ textAlign: 'center', color: C.textMuted, padding: '1.5rem' }}>אין שינויים מתועדים עדיין.</td></tr>}
              </tbody></table>
            </div>
          )}

          {tab === 'diffs' && (
            <div style={card}><div style={{ fontWeight: 800, fontSize: 14, marginBottom: 8 }}>🔀 Citation Diffs (בין ריצות)</div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}><thead><tr><Th>תאריך</Th><Th>מנוע</Th><Th>סוג</Th><Th>קודם</Th><Th>נוכחי</Th><Th>השפעה</Th></tr></thead><tbody>
                {(s.diffs || []).map((d: any) => { const up = (d.impact_score || 0) >= 0; return <tr key={d.id}><Td>{new Date(d.created_at).toLocaleDateString('he-IL')}</Td><Td>{d.ai_engine}</Td><Td><span style={{ color: up ? C.success : C.danger, fontWeight: 700 }}>{d.diff_type}</span></Td><Td w={220}>{d.previous_value || '—'}</Td><Td w={220}>{d.current_value || '—'}</Td><Td style={{ color: up ? C.success : C.danger }}>{d.impact_score}</Td></tr>; })}
                {(s.diffs || []).length === 0 && <tr><td colSpan={6} style={{ textAlign: 'center', color: C.textMuted, padding: '1.5rem' }}>אין diffs עדיין — צריך לפחות 2 ריצות.</td></tr>}
              </tbody></table>
            </div>
          )}

          {tab === 'global' && (() => {
            const gi = s.globalInsights || {};
            const Bar = ({ items }: { items: any[] }) => (
              <div>{(items || []).slice(0, 8).map((it: any) => { const max = Math.max(1, ...(items || []).map((x: any) => x.value)); return (
                <div key={it.key} style={{ marginBottom: 6 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5 }}><span style={{ color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 240 }}>{it.key}</span><b>{it.value}</b></div>
                  <div style={{ height: 6, borderRadius: 999, background: C.borderLight, overflow: 'hidden' }}><div style={{ width: `${(it.value / max) * 100}%`, height: '100%', background: C.primary }} /></div>
                </div>
              ); })}{(items || []).length === 0 && <div style={{ color: C.textMuted, fontSize: 12 }}>—</div>}</div>
            );
            const srcLabel: any = { government: 'מקורות ממשלתיים', blog: 'בלוגים', service: 'עמודי שירות', reference: 'מקורות ידע (ויקי)', page: 'עמודים כלליים' };
            return (
              <div style={{ display: 'grid', gap: 14 }}>
                <div style={{ fontSize: 11.5, color: C.textMuted }}>🌐 נתונים אגרגטיביים ואנונימיים מכל הלקוחות (Data Moat). <Tag kind="measured" /> · {gi.totalRows || 0} רשומות אינדקס</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14 }}>
                  <div style={card}><div style={{ fontWeight: 800, fontSize: 13.5, marginBottom: 8 }}>דומיינים מצוטטים מובילים</div><Bar items={gi.mostCitedDomains} /></div>
                  <div style={card}><div style={{ fontWeight: 800, fontSize: 13.5, marginBottom: 8 }}>סוגי עמודים מועדפים</div><Bar items={gi.mostCitedPageTypes} /></div>
                  <div style={card}><div style={{ fontWeight: 800, fontSize: 13.5, marginBottom: 8 }}>פילוח לפי מנוע</div><Bar items={gi.byEngine} /></div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                  <div style={card}>
                    <div style={{ fontWeight: 800, fontSize: 13.5, marginBottom: 8 }}>מה AI מעדיף לכל תחום</div>
                    {(gi.topicPreference || []).map((t: any) => <div key={t.topic} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, padding: '4px 0', borderTop: `1px solid ${C.borderLight}` }}><span>{t.topic}</span><b style={{ color: C.primaryDark }}>{srcLabel[t.preferredSource] || t.preferredSource}</b></div>)}
                    {(gi.topicPreference || []).length === 0 && <div style={{ color: C.textMuted, fontSize: 12 }}>—</div>}
                  </div>
                  <div style={card}>
                    <div style={{ fontWeight: 800, fontSize: 13.5, marginBottom: 8 }}>תנודתיות/תחרותיות לפי תחום</div>
                    <div style={{ fontSize: 11, color: C.textMuted, marginBottom: 6 }}>יותר מקורות שונים = תחום תנודתי/תחרותי יותר</div>
                    {(gi.topicVolatility || []).map((t: any) => <div key={t.topic} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, padding: '4px 0', borderTop: `1px solid ${C.borderLight}` }}><span>{t.topic}</span><b style={{ color: t.distinctSources > 5 ? C.warning : C.textSecondary }}>{t.distinctSources} מקורות</b></div>)}
                    {(gi.topicVolatility || []).length === 0 && <div style={{ color: C.textMuted, fontSize: 12 }}>—</div>}
                  </div>
                </div>
                <details style={card}><summary style={{ cursor: 'pointer', fontWeight: 700, fontSize: 13 }}>טבלת אינדקס מלאה</summary>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5, marginTop: 10 }}><thead><tr><Th>דומיין</Th><Th>סוג עמוד</Th><Th>תחום</Th><Th>מנוע</Th><Th>תדירות</Th><Th>מיקום ממוצע</Th></tr></thead><tbody>
                    {(s.globalIndex || []).map((g: any) => <tr key={g.id}><Td>{g.cited_domain}</Td><Td>{g.page_type}</Td><Td>{g.topic}</Td><Td>{g.ai_engine}</Td><Td>{g.citation_frequency}</Td><Td>{Number(g.citation_position_avg).toFixed(1)}</Td></tr>)}
                  </tbody></table>
                </details>
              </div>
            );
          })()}

          {tab === 'settings' && (
            <div style={card}>
              <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 10 }}>פרופיל מותג (לזיהוי אזכורים)</div>
              {([
                ['brand_name', 'שם מותג', false], ['brand_aliases', 'שמות נרדפים (פסיקים)', true],
                ['owner_names', 'שמות בעלים', true], ['expert_names', 'שמות מומחים', true],
                ['domain', 'דומיין', false], ['location_names', 'מיקומים', true],
              ] as [string, string, boolean][]).map(([k, label, isArr]) => {
                const b = s.brand || {};
                const initial = Array.isArray(b[k]) ? (b[k] || []).join(', ') : (b[k] || '');
                const val = brandEdits[k] !== undefined ? brandEdits[k] : initial;
                return (
                  <div key={k} style={{ marginBottom: 10 }}>
                    <label style={{ fontSize: 12, fontWeight: 700, color: C.textSecondary, display: 'block', marginBottom: 4 }}>{label}</label>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <input value={val} onChange={(e) => setBrandEdits((p) => ({ ...p, [k]: e.target.value }))} style={{ flex: 1, fontSize: 13, padding: '0.45rem 0.6rem', border: `1px solid ${C.border}`, borderRadius: 8 }} />
                      <button onClick={() => post({ action: 'update_brand', patch: { [k]: isArr ? String(val).split(',').map((x) => x.trim()).filter(Boolean) : val } }, `b-${k}`)} style={{ background: C.primaryLight, color: C.primaryDark, border: `1px solid ${C.primary}30`, borderRadius: 8, padding: '0 0.8rem', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>שמור</button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
