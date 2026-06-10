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
  { id: 'overview', label: 'סקירה', icon: '📊' }, { id: 'sov', label: 'נתח קול', icon: '🥇' }, { id: 'alerts', label: 'התראות', icon: '🔔' },
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
  // Drill-down drawer state
  const [detail, setDetail] = useState<any>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailErr, setDetailErr] = useState('');
  const [openEngine, setOpenEngine] = useState<string | null>(null);
  const [execBusy, setExecBusy] = useState('');
  const [execResult, setExecResult] = useState<any>(null);

  const openDetail = useCallback(async (queryId: string) => {
    setDetail(null); setDetailErr(''); setDetailLoading(true); setOpenEngine(null); setExecResult(null);
    try {
      const r = await fetch(`/api/seo-geo-plans/${planId}/visibility`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'query_detail', queryId }) });
      const d = await r.json(); if (!r.ok) throw new Error(d.error || 'שגיאה');
      setDetail((d.data || d).detail);
    } catch (e) { setDetailErr(e instanceof Error ? e.message : 'שגיאה'); } finally { setDetailLoading(false); }
  }, [planId]);

  const runExecute = useCallback(async (queryId: string, imp: any) => {
    setExecBusy(imp.actionType + imp.title); setExecResult(null); setDetailErr('');
    try {
      const r = await fetch(`/api/seo-geo-plans/${planId}/visibility`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'query_execute', queryId, actionType: imp.actionType, title: imp.title, detail: imp.detail }) });
      const d = await r.json(); if (!r.ok) throw new Error(d.error || 'שגיאה');
      setExecResult((d.data || d).draft);
    } catch (e) { setDetailErr(e instanceof Error ? e.message : 'שגיאה'); } finally { setExecBusy(''); }
  }, [planId]);

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
          <button onClick={() => window.open(`/api/seo-geo-plans/${planId}/visibility/report?format=progress`, '_blank')} style={{ background: C.primary, color: '#fff', border: 'none', borderRadius: 12, padding: '0.6rem 0.9rem', fontWeight: 800, fontSize: 13, cursor: 'pointer' }}>📈 דוח צמיחה</button>
          <button onClick={() => window.open(`/api/seo-geo-plans/${planId}/visibility/report?format=html`, '_blank')} style={{ background: C.card, color: C.text, border: `1px solid ${C.border}`, borderRadius: 12, padding: '0.6rem 0.9rem', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>📄 דוח (PDF)</button>
          <button onClick={() => window.open(`/api/seo-geo-plans/${planId}/visibility/report?format=csv`, '_blank')} style={{ background: C.card, color: C.text, border: `1px solid ${C.border}`, borderRadius: 12, padding: '0.6rem 0.9rem', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>⬇ CSV</button>
          <button onClick={() => window.open(`/api/seo-geo-plans/${planId}/visibility/report?format=xlsx`, '_blank')} style={{ background: C.card, color: '#107C41', border: `1px solid ${C.border}`, borderRadius: 12, padding: '0.6rem 0.9rem', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>📊 Excel</button>
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
              {/* ── PIXEL Score: unified SEO + GEO + Authority ── */}
              {s.pixelScore && (
                <div style={{ ...card, marginBottom: 14, background: 'linear-gradient(135deg, #00B5FE08, #0095D012)', border: `1px solid ${C.primary}30` }}>
                  <div style={{ display: 'flex', gap: 18, alignItems: 'center', flexWrap: 'wrap' }}>
                    <div style={{ textAlign: 'center', minWidth: 120 }}>
                      <div style={{ fontSize: 10.5, fontWeight: 800, color: C.primary, letterSpacing: 1 }}>PIXEL SCORE</div>
                      <div style={{ fontSize: 52, fontWeight: 900, color: sc(s.pixelScore.overall || 0), lineHeight: 1.05 }}>{s.pixelScore.overall ?? 0}</div>
                      <div style={{ fontSize: 11, fontWeight: 800, color: s.pixelScore.band === 'strong' ? C.success : s.pixelScore.band === 'building' ? C.warning : C.danger }}>{s.pixelScore.band === 'strong' ? 'חזק' : s.pixelScore.band === 'building' ? 'בבנייה' : 'דורש חיזוק'}</div>
                    </div>
                    <div style={{ flex: 1, minWidth: 260 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>ציון מאוחד: אורגני + נראות AI + סמכות</div>
                      {(s.pixelScore.pillars || []).map((p: any) => (
                        <div key={p.key} style={{ marginBottom: 7, opacity: p.measured ? 1 : 0.45 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5 }}>
                            <span>{p.label} {p.measured ? <span style={{ color: C.textMuted }}>· {Math.round(p.weight * 100)}% משקל</span> : <span style={{ color: C.textMuted }}>· אין נתונים</span>}</span>
                            <b style={{ color: sc(p.score) }}>{p.measured ? p.score : '—'}</b>
                          </div>
                          <div style={{ height: 6, borderRadius: 999, background: C.borderLight, overflow: 'hidden' }}><div style={{ width: `${p.measured ? p.score : 0}%`, height: '100%', background: sc(p.score) }} /></div>
                          {p.measured && <div style={{ fontSize: 10.5, color: C.textMuted, marginTop: 2 }}>{p.note}</div>}
                        </div>
                      ))}
                      <div style={{ fontSize: 11.5, color: C.textSecondary, marginTop: 6, lineHeight: 1.6 }}>{s.pixelScore.story}</div>
                    </div>
                  </div>
                </div>
              )}

              {/* ── Sentiment of mentions ── */}
              {s.sentiment && s.sentiment.total > 0 && (() => {
                const { positive, neutral, negative } = s.sentiment.counts; const t = s.sentiment.total || 1;
                const seg = (n: number, col: string) => n > 0 ? <div style={{ width: `${(n / t) * 100}%`, background: col }} title={`${n}`} /> : null;
                return (
                  <div style={{ ...card, marginBottom: 14 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                      <div style={{ fontWeight: 800, fontSize: 13.5 }}>איך מדברים עלינו (סנטימנט אזכורים)</div>
                      <div style={{ fontSize: 11.5, color: C.textSecondary }}>{positive} חיובי · {neutral} נייטרלי · {negative} שלילי</div>
                    </div>
                    <div style={{ display: 'flex', height: 12, borderRadius: 999, overflow: 'hidden', background: C.borderLight }}>{seg(positive, C.success)}{seg(neutral, C.textMuted)}{seg(negative, C.danger)}</div>
                    {negative > 0 && <div style={{ fontSize: 11, color: C.danger, marginTop: 6 }}>⚠ זוהו אזכורים שליליים/לא מדויקים — שווה לתקן את המידע במקור.</div>}
                  </div>
                );
              })()}

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
                <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 10 }}>נראות לפי מנוע AI</div>
                {(() => {
                  const counts: Record<string, number> = {};
                  for (const m of (s.mentions || [])) counts[m.ai_engine] = (counts[m.ai_engine] || 0) + 1;
                  const maxC = Math.max(1, ...Object.values(counts));
                  return (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px,1fr))', gap: 10 }}>
                      {(s.engines || []).map((e: any) => {
                        const c = counts[e.id] || 0;
                        return (
                          <div key={e.id} style={{ border: `1px solid ${C.border}`, borderRadius: 10, padding: '0.6rem 0.7rem', background: e.available ? C.card : C.bg }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <span style={{ fontSize: 12, fontWeight: 700 }}>{e.id}</span>
                              <span style={{ fontSize: 9.5, fontWeight: 800, color: e.available ? C.success : C.textMuted, background: e.available ? `${C.success}15` : C.borderLight, borderRadius: 5, padding: '1px 6px' }}>{e.available ? 'חי' : 'דמו'}</span>
                            </div>
                            <div style={{ fontSize: 22, fontWeight: 900, color: c ? C.primaryDark : C.textMuted, margin: '4px 0 2px' }}>{c}</div>
                            <div style={{ height: 5, borderRadius: 999, background: C.borderLight, overflow: 'hidden' }}><div style={{ width: `${(c / maxC) * 100}%`, height: '100%', background: C.primary }} /></div>
                            <div style={{ fontSize: 10, color: C.textMuted, marginTop: 3 }}>אזכורים</div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}
              </div>
            </>
          )}

          {tab === 'sov' && (() => {
            const sov = s.shareOfVoice || {};
            const breakdown = sov.breakdown || [];
            const maxB = Math.max(1, ...breakdown.map((b: any) => b.count));
            const trend = sov.trend || [];
            return (
              <div style={{ display: 'grid', gap: 14 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: 14 }}>
                  <div style={{ ...card, textAlign: 'center' }}>
                    <div style={{ fontSize: 12, color: C.textSecondary, fontWeight: 700 }}>נתח הקול שלנו ב-AI<Tag kind="measured" /></div>
                    <div style={{ fontSize: 52, fontWeight: 900, color: sc(sov.now || 0), lineHeight: 1.1, margin: '6px 0' }}>{sov.now ?? 0}%</div>
                    <div style={{ fontSize: 12, color: C.textMuted }}>{sov.us ?? 0} אזכורים שלנו · {sov.competitors ?? 0} של מתחרים</div>
                  </div>
                  <div style={card}>
                    <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 10 }}>אנחנו מול מתחרים (אזכורים בתשובות)</div>
                    {breakdown.length === 0 ? <div style={{ color: C.textMuted, fontSize: 13 }}>אין נתונים עדיין — הרץ בדיקה והוסף מתחרים.</div> :
                      breakdown.map((b: any) => (
                        <div key={b.name} style={{ marginBottom: 8 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5 }}><span style={{ fontWeight: b.isUs ? 800 : 600, color: b.isUs ? C.primaryDark : C.text }}>{b.isUs ? '★ ' : ''}{b.name}</span><b>{b.count}</b></div>
                          <div style={{ height: 8, borderRadius: 999, background: C.borderLight, overflow: 'hidden' }}><div style={{ width: `${(b.count / maxB) * 100}%`, height: '100%', background: b.isUs ? C.primary : C.warning }} /></div>
                        </div>
                      ))}
                  </div>
                </div>

                <div style={card}>
                  <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 10 }}>מגמת נתח קול לאורך זמן</div>
                  {trend.length === 0 ? <div style={{ color: C.textMuted, fontSize: 13 }}>צריך לפחות חודש אחד של נתונים.</div> : (
                    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 130 }}>
                      {trend.map((t: any) => (
                        <div key={t.month} style={{ flex: 1, textAlign: 'center' }}>
                          <div style={{ fontSize: 10, fontWeight: 700 }}>{t.sov}%</div>
                          <div style={{ height: `${t.sov * 0.9}px`, background: sc(t.sov), borderRadius: '4px 4px 0 0', minHeight: 2 }} title={`${t.sov}% · ${t.us} אזכורים`} />
                          <div style={{ fontSize: 9.5, color: C.textMuted, marginTop: 4 }}>{(t.month || '').slice(5)}</div>
                        </div>
                      ))}
                    </div>
                  )}
                  <div style={{ fontSize: 11, color: C.textMuted, marginTop: 8 }}>יתרון על המתחרה: לא רק תצלום רגעי — מגמת נתח-קול חודשית מול המתחרים.</div>
                </div>

                {(sov.topComps || []).length > 0 && (sov.competitorTrend || []).length > 0 && (
                  <div style={card}>
                    <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 10 }}>אזכורי מתחרים לפי חודש</div>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}><thead><tr><Th>חודש</Th>{(sov.topComps || []).map((n: string) => <Th key={n}>{n}</Th>)}</tr></thead><tbody>
                      {(sov.competitorTrend || []).map((rowm: any) => <tr key={rowm.month}><Td>{rowm.month}</Td>{(sov.topComps || []).map((n: string) => <Td key={n}>{rowm[n] || 0}</Td>)}</tr>)}
                    </tbody></table>
                  </div>
                )}
              </div>
            );
          })()}

          {tab === 'queries' && (
            <div style={card}>
              <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                <input value={newQ} onChange={(e) => setNewQ(e.target.value)} placeholder="הוסף שאילתה…" style={{ flex: 1, fontSize: 13, padding: '0.5rem 0.7rem', border: `1px solid ${C.border}`, borderRadius: 9 }} />
                <button onClick={() => { if (newQ.trim()) { post({ action: 'add_query', query_text: newQ.trim() }, 'aq'); setNewQ(''); } }} disabled={!!busy} style={{ background: C.primary, color: '#fff', border: 'none', borderRadius: 9, padding: '0.5rem 1rem', fontWeight: 800, fontSize: 12.5, cursor: 'pointer' }}>+ הוסף</button>
                <button onClick={() => post({ action: 'gen_queries' }, 'gq')} disabled={!!busy} style={{ background: C.card, color: C.text, border: `1px solid ${C.border}`, borderRadius: 9, padding: '0.5rem 1rem', fontWeight: 700, fontSize: 12.5, cursor: 'pointer' }}>{busy === 'gq' ? '⏳' : '✨ צור אוטומטית מהאתר'}</button>
              </div>
              <div style={{ fontSize: 12, color: C.textSecondary, marginBottom: 6 }}>{s.queryCount} שאילתות פעילות · לחץ על שאילתה לניתוח מלא «למה» + «מה לשפר»</div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}><thead><tr><Th>שאילתה</Th><Th>תחום</Th><Th>סטטוס</Th><Th>אזכורים</Th><Th></Th></tr></thead><tbody>
                {(s.allQueries || s.opportunities || []).map((q: any) => (
                  <tr key={q.id} onClick={() => openDetail(q.id)} style={{ cursor: 'pointer' }} title="פתח ניתוח מלא">
                    <Td>{q.query}</Td><Td>{q.topic}</Td>
                    <Td>{q.appeared ? <span style={{ color: C.success, fontWeight: 700 }}>● הופיע</span> : <span style={{ color: C.textMuted, fontWeight: 700 }}>○ לא הופיע</span>}</Td>
                    <Td>{q.mentions ?? '—'}</Td>
                    <Td><span style={{ color: C.primary, fontWeight: 800, fontSize: 12 }}>ניתוח ←</span></Td>
                  </tr>
                ))}
                {(s.allQueries || []).length === 0 && (s.opportunities || []).length === 0 && <tr><td colSpan={5} style={{ textAlign: 'center', color: C.textMuted, padding: '1.5rem' }}>אין שאילתות — הוסף או צור אוטומטית.</td></tr>}
              </tbody></table>
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

      {/* ── Per-query drill-down drawer ── */}
      {(detailLoading || detail || detailErr) && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)', zIndex: 60, display: 'flex', justifyContent: 'flex-start' }} onClick={() => { setDetail(null); setDetailErr(''); }}>
          <div dir="rtl" onClick={(e) => e.stopPropagation()} style={{ width: 'min(640px, 96vw)', height: '100%', background: C.bg, overflowY: 'auto', boxShadow: '4px 0 24px rgba(0,0,0,.18)', padding: '1.2rem 1.25rem 3rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <div style={{ fontSize: 12, fontWeight: 800, color: C.primary, letterSpacing: 1 }}>QUERY DRILL-DOWN</div>
              <button onClick={() => { setDetail(null); setDetailErr(''); }} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, padding: '0.3rem 0.7rem', cursor: 'pointer', fontWeight: 700 }}>✕ סגור</button>
            </div>

            {detailLoading && <div style={{ textAlign: 'center', padding: '3rem', color: C.textMuted }}>מנתח שאילתה…</div>}
            {detailErr && <div style={{ background: '#FEF2F2', border: `1px solid ${C.danger}40`, color: C.danger, borderRadius: 10, padding: '0.6rem 0.9rem', fontSize: 13, fontWeight: 600 }}>⚠ {detailErr}</div>}

            {detail && (
              <>
                <h2 style={{ fontSize: 18, fontWeight: 900, margin: '2px 0 4px' }}>{detail.query?.text}</h2>
                <div style={{ fontSize: 12, color: C.textSecondary, marginBottom: 12 }}>{detail.query?.topic}{detail.query?.intent ? ` · ${detail.query.intent}` : ''}</div>

                {/* Coverage */}
                <div style={{ ...card, display: 'flex', alignItems: 'center', gap: 14, marginBottom: 12 }}>
                  <div style={{ width: 58, height: 58, borderRadius: 12, background: `${sc(detail.coverage?.rate || 0)}18`, color: sc(detail.coverage?.rate || 0), display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: 18 }}>{detail.coverage?.rate ?? 0}%</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 800, fontSize: 14 }}>הופענו ב-{detail.coverage?.appeared ?? 0} מתוך {detail.coverage?.tested ?? 0} מנועים</div>
                    <div style={{ fontSize: 12, color: C.textSecondary }}>{detail.measured ? 'מבוסס על הריצה האחרונה' : 'עדיין לא בוצעה בדיקה — הרץ בדיקה.'}</div>
                  </div>
                </div>

                {/* Per-engine */}
                <div style={{ ...card, marginBottom: 12 }}>
                  <div style={{ fontWeight: 800, fontSize: 13.5, marginBottom: 8 }}>פעילות סריקה לפי מנוע</div>
                  {(detail.engines || []).length === 0 && <div style={{ color: C.textMuted, fontSize: 12.5 }}>אין נתוני מנוע עדיין.</div>}
                  {(detail.engines || []).map((e: any) => (
                    <div key={e.engine} style={{ borderTop: `1px solid ${C.borderLight}`, padding: '8px 0' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: e.answerText ? 'pointer' : 'default' }} onClick={() => e.answerText && setOpenEngine(openEngine === e.engine ? null : e.engine)}>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                          <span style={{ fontSize: 12.5, fontWeight: 700 }}>{e.engine}</span>
                          <span style={{ fontSize: 11, fontWeight: 800, color: e.found ? C.success : C.textMuted, background: e.found ? `${C.success}15` : C.borderLight, borderRadius: 6, padding: '1px 7px' }}>{e.found ? `הוזכר${e.position ? ` · מיקום ${e.position}` : ''}` : 'לא הוזכר'}</span>
                        </div>
                        {e.answerText && <span style={{ fontSize: 11, color: C.primary, fontWeight: 700 }}>{openEngine === e.engine ? 'הסתר תשובה ▲' : 'תשובת AI ▼'}</span>}
                      </div>
                      {openEngine === e.engine && e.answerText && (
                        <div style={{ marginTop: 6, fontSize: 12.5, lineHeight: 1.7, color: C.text, background: C.bg, border: `1px solid ${C.border}`, borderRadius: 8, padding: '0.6rem 0.8rem', whiteSpace: 'pre-wrap', maxHeight: 220, overflow: 'auto' }}>{e.answerText}</div>
                      )}
                      {(e.citations || []).length > 0 && (
                        <div style={{ marginTop: 6, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                          {e.citations.slice(0, 6).map((c: any, i: number) => <span key={i} style={{ fontSize: 10.5, fontWeight: 700, borderRadius: 5, padding: '1px 6px', color: c.isOwn ? C.success : c.isCompetitor ? C.danger : C.textSecondary, background: c.isOwn ? `${C.success}12` : c.isCompetitor ? `${C.danger}10` : C.borderLight }}>{c.isOwn ? '★ ' : c.isCompetitor ? '⚔ ' : ''}{c.domain}</span>)}
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {/* Why */}
                <div style={{ ...card, marginBottom: 12, borderInlineStart: `3px solid ${C.primary}` }}>
                  <div style={{ fontWeight: 800, fontSize: 13.5, marginBottom: 6 }}>🧠 ניתוח: למה?</div>
                  <div style={{ fontSize: 13, lineHeight: 1.8, color: C.text }}>{detail.why}</div>
                </div>

                {/* Improvements with "execute now" */}
                <div style={{ ...card, marginBottom: 12 }}>
                  <div style={{ fontWeight: 800, fontSize: 13.5, marginBottom: 8 }}>🚀 מה לשפר — ולחיצה אחת לביצוע</div>
                  {(detail.improvements || []).map((imp: any, idx: number) => {
                    const col = imp.impact === 'high' ? C.danger : imp.impact === 'medium' ? C.warning : C.textMuted;
                    const busyKey = imp.actionType + imp.title;
                    return (
                      <div key={idx} style={{ borderTop: `1px solid ${C.borderLight}`, padding: '10px 0' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'flex-start' }}>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 13, fontWeight: 700 }}>{imp.title} <span style={{ fontSize: 9.5, fontWeight: 800, color: col, background: `${col}15`, borderRadius: 5, padding: '1px 6px' }}>{imp.impact === 'high' ? 'השפעה גבוהה' : imp.impact === 'medium' ? 'בינונית' : 'נמוכה'}</span></div>
                            <div style={{ fontSize: 12, color: C.textSecondary, lineHeight: 1.6, marginTop: 2 }}>{imp.detail}</div>
                          </div>
                          <button onClick={() => runExecute(detail.query.id, imp)} disabled={!!execBusy} style={{ flexShrink: 0, background: C.primary, color: '#fff', border: 'none', borderRadius: 9, padding: '0.45rem 0.9rem', fontWeight: 800, fontSize: 12, cursor: 'pointer' }}>{execBusy === busyKey ? '⏳ מייצר…' : '⚡ בצע עכשיו'}</button>
                        </div>
                      </div>
                    );
                  })}
                  {(detail.improvements || []).length === 0 && <div style={{ color: C.textMuted, fontSize: 12.5 }}>—</div>}
                </div>

                {/* Execute result (generated draft) */}
                {execResult && (
                  <div style={{ ...card, marginBottom: 12, border: `2px solid ${C.primary}` }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                      <div style={{ fontWeight: 800, fontSize: 13.5 }}>✨ טיוטה נוצרה: {execResult.title}</div>
                      <button onClick={() => { navigator.clipboard?.writeText(execResult.text || execResult.html || ''); }} style={{ background: C.primary, color: '#fff', border: 'none', borderRadius: 8, padding: '0.3rem 0.7rem', fontSize: 11.5, fontWeight: 700, cursor: 'pointer' }}>📋 העתק</button>
                    </div>
                    <div style={{ fontSize: 12.5, lineHeight: 1.75, color: C.text, whiteSpace: 'pre-wrap', maxHeight: 260, overflow: 'auto', background: C.bg, border: `1px solid ${C.border}`, borderRadius: 8, padding: '0.6rem 0.8rem' }}>{execResult.text || '—'}</div>
                    <div style={{ fontSize: 11, color: C.textSecondary, marginTop: 6 }}>💾 {execResult.note}</div>
                  </div>
                )}

                {/* Cited sources + competitors */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
                  <div style={card}>
                    <div style={{ fontWeight: 800, fontSize: 12.5, marginBottom: 6 }}>מקורות שצוטטו</div>
                    {(detail.citedDomains || []).slice(0, 10).map((d: any) => <div key={d.domain} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5, padding: '3px 0' }}><span style={{ color: d.isOwn ? C.success : d.isCompetitor ? C.danger : C.text }}>{d.isOwn ? '★ ' : d.isCompetitor ? '⚔ ' : ''}{d.domain}</span><b>{d.count}</b></div>)}
                    {(detail.citedDomains || []).length === 0 && <div style={{ color: C.textMuted, fontSize: 11.5 }}>—</div>}
                  </div>
                  <div style={card}>
                    <div style={{ fontWeight: 800, fontSize: 12.5, marginBottom: 6 }}>מתחרים בתשובות</div>
                    {(detail.competitors || []).slice(0, 10).map((c: any) => <div key={c.name} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5, padding: '3px 0' }}><span>{c.name}</span><b>{c.count}</b></div>)}
                    {(detail.competitors || []).length === 0 && <div style={{ color: C.textMuted, fontSize: 11.5 }}>אין</div>}
                  </div>
                </div>

                {/* Change log for this query */}
                {(detail.changes || []).length > 0 && (
                  <div style={card}>
                    <div style={{ fontWeight: 800, fontSize: 12.5, marginBottom: 6 }}>📝 שינויים אחרונים בתשובות</div>
                    {detail.changes.map((c: any, i: number) => <div key={i} style={{ fontSize: 11.5, padding: '4px 0', borderTop: i ? `1px solid ${C.borderLight}` : 'none' }}><b>{c.engine}</b> · {c.type} {c.date ? `· ${new Date(c.date).toLocaleDateString('he-IL')}` : ''}<div style={{ color: C.textSecondary }}>{c.explanation}</div></div>)}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
