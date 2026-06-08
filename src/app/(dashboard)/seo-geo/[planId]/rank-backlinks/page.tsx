'use client';

export const dynamic = 'force-dynamic';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';

const C = { primary: '#00B5FE', primaryDark: '#0095D0', bg: '#F7F9FC', card: '#FFFFFF', text: '#1A1A2E', sub: '#5A5A7A', muted: '#9A9AB0', border: '#E8EAF0', success: '#10B981', warning: '#F59E0B', danger: '#EF4444' };

export default function RankBacklinksPage() {
  const { planId } = useParams<{ planId: string }>();
  const router = useRouter();
  const [s, setS] = useState<any>(null);
  const [tab, setTab] = useState<'keywords' | 'backlinks'>('keywords');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [err, setErr] = useState('');
  const [newKw, setNewKw] = useState('');

  const load = useCallback(async () => {
    setLoading(true); setErr('');
    try { const r = await fetch(`/api/seo-geo-plans/${planId}/rank-backlinks`, { cache: 'no-store' }); const d = await r.json(); if (!r.ok) throw new Error(d.error || 'שגיאה'); setS(d.data || d); }
    catch (e) { setErr(e instanceof Error ? e.message : 'שגיאה'); } finally { setLoading(false); }
  }, [planId]);
  useEffect(() => { load(); }, [load]);

  const post = async (payload: any, key: string) => {
    setBusy(key); setErr('');
    try { const r = await fetch(`/api/seo-geo-plans/${planId}/rank-backlinks`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }); const d = await r.json(); if (!r.ok) throw new Error(d.error || 'שגיאה'); const next = d.data?.state || d.data || d.state; if (next?.counts) setS(next); else await load(); }
    catch (e) { setErr(e instanceof Error ? e.message : 'שגיאה'); } finally { setBusy(''); }
  };

  const card: React.CSSProperties = { background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: '1.1rem 1.25rem' };
  const a = s?.authority;
  const cnt = s?.counts || {};
  const rankColor = (n: number) => (n <= 3 ? C.success : n <= 10 ? C.warning : C.muted);
  const Th = ({ children }: any) => <th style={{ textAlign: 'right', padding: '7px 8px', color: C.sub, fontWeight: 700, borderBottom: `1px solid ${C.border}`, whiteSpace: 'nowrap' }}>{children}</th>;
  const Td = ({ children, w }: any) => <td style={{ padding: '7px 8px', borderBottom: `1px solid ${C.border}55`, maxWidth: w || 260, overflow: 'hidden', textOverflow: 'ellipsis' }}>{children}</td>;
  const metric = (val: any, label: string, color?: string) => <div style={{ textAlign: 'center' }}><div style={{ fontSize: 26, fontWeight: 900, color: color || C.text }}>{typeof val === 'number' ? val.toLocaleString() : (val ?? '—')}</div><div style={{ fontSize: 12, color: C.sub }}>{label}</div></div>;

  return (
    <div dir="rtl" style={{ maxWidth: 1180, margin: '0 auto', padding: '1.5rem 1.25rem 4rem', color: C.text, background: C.bg, minHeight: '100vh' }}>
      <button onClick={() => router.push(`/seo-geo/${planId}/authority`)} style={{ background: 'none', border: 'none', color: C.sub, fontSize: 13, cursor: 'pointer', marginBottom: 8 }}>← Authority Center</button>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 800, margin: 0 }}>📈 דירוגים וקישורים</h1>
          <p style={{ color: C.sub, fontSize: 13.5, margin: '4px 0 0' }}>מעקב 150 מילות מפתח + ניטור 500 קישורים ורמת סמכות האתר.</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => post({ action: 'gen_keywords' }, 'gen')} disabled={!!busy} style={{ background: C.card, color: C.text, border: `1px solid ${C.border}`, borderRadius: 12, padding: '0.6rem 1rem', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>{busy === 'gen' ? '⏳' : '✨ צור 150 מילות מפתח'}</button>
          <button onClick={() => post({ action: 'scan_ranks' }, 'sr')} disabled={!!busy} style={{ background: C.primary, color: '#fff', border: 'none', borderRadius: 12, padding: '0.6rem 1rem', fontWeight: 800, fontSize: 13, cursor: 'pointer' }}>{busy === 'sr' ? '⏳ סורק…' : '🔎 סרוק דירוגים'}</button>
          <button onClick={() => post({ action: 'scan_backlinks' }, 'sb')} disabled={!!busy} style={{ background: '#0a2540', color: '#fff', border: 'none', borderRadius: 12, padding: '0.6rem 1rem', fontWeight: 800, fontSize: 13, cursor: 'pointer' }}>{busy === 'sb' ? '⏳ סורק…' : '🔗 סרוק קישורים'}</button>
        </div>
      </div>

      {err && <div style={{ background: '#FEF2F2', border: `1px solid ${C.danger}40`, color: C.danger, borderRadius: 10, padding: '0.6rem 0.9rem', fontSize: 13, fontWeight: 600, margin: '10px 0' }}>⚠ {err}</div>}
      {s && !s.providers?.rank && <div style={{ background: '#FFFBEB', border: `1px solid ${C.warning}40`, color: '#92610A', borderRadius: 10, padding: '0.5rem 0.8rem', fontSize: 11.5, margin: '10px 0' }}>ℹ️ הנתונים הם אומדן עד שתחובר ספק: <b>SERP_API_KEY</b> (דירוגים), <b>DATAFORSEO_LOGIN/PASSWORD</b> (קישורים).</div>}

      {loading ? <div style={{ textAlign: 'center', padding: '4rem', color: C.muted }}>טוען…</div> : !s ? null : (
        <>
          {/* Authority panel — like the reference screenshot */}
          <div style={{ ...card, margin: '14px 0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <span style={{ fontSize: 15, fontWeight: 800, background: '#E6F7FF', color: C.primaryDark, padding: '3px 12px', borderRadius: 8 }}>רמת סמכות האתר</span>
              {a?.computed_at && <span style={{ fontSize: 11.5, color: C.muted }}>עודכן: {new Date(a.computed_at).toLocaleDateString('he-IL')}{a.source === 'estimated' ? ' · אומדן' : ' · נמדד'}</span>}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px 12px' }}>
              {metric(a?.dr, 'DR', C.primary)}
              {metric(a?.ur, 'UR', C.primary)}
              {metric(a?.total_links, 'קישורים')}
              {metric(a?.dofollow_domains, 'DF דומיינים')}
              {metric(a?.referring_domains, 'דומיינים')}
              {metric(a?.dofollow_links, 'DF קישורים')}
            </div>
            {!a && <div style={{ color: C.muted, fontSize: 13, textAlign: 'center', marginTop: 10 }}>אין עדיין נתונים — לחץ "🔗 סרוק קישורים".</div>}
          </div>

          {/* KPI row */}
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 14 }}>
            {[['מילות מפתח', cnt.keywords, C.text], ['Top 3', cnt.top3, C.success], ['Top 10', cnt.top10, C.warning], ['דירוג ממוצע', cnt.avgRank ?? '—', C.primary], ['קישורים', cnt.backlinks, C.text], ['קישורים שאבדו', cnt.lostBacklinks, C.danger]].map(([l, v, col]: any) => (
              <div key={l} style={{ ...card, flex: 1, minWidth: 130, textAlign: 'center', padding: '0.8rem' }}>{metric(v, l, col)}</div>
            ))}
          </div>

          {/* Tabs */}
          <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
            {([['keywords', '🔤 מילות מפתח'], ['backlinks', '🔗 קישורים']] as const).map(([id, lbl]) => (
              <button key={id} onClick={() => setTab(id)} style={{ border: 'none', borderRadius: 10, padding: '0.45rem 0.9rem', fontSize: 12.5, fontWeight: tab === id ? 800 : 600, cursor: 'pointer', background: tab === id ? C.primary : C.card, color: tab === id ? '#fff' : C.sub, boxShadow: tab === id ? 'none' : `inset 0 0 0 1px ${C.border}` }}>{lbl}</button>
            ))}
          </div>

          {tab === 'keywords' && (
            <div style={card}>
              <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                <input value={newKw} onChange={(e) => setNewKw(e.target.value)} placeholder="הוסף מילת מפתח…" style={{ flex: 1, fontSize: 13, padding: '0.5rem 0.7rem', border: `1px solid ${C.border}`, borderRadius: 9 }} />
                <button onClick={() => { if (newKw.trim()) { post({ action: 'add_keyword', keyword: newKw.trim() }, 'ak'); setNewKw(''); } }} disabled={!!busy} style={{ background: C.primary, color: '#fff', border: 'none', borderRadius: 9, padding: '0.5rem 1rem', fontWeight: 800, fontSize: 12.5, cursor: 'pointer' }}>+ הוסף</button>
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}><thead><tr><Th>מילת מפתח</Th><Th>דירוג</Th><Th>שינוי</Th><Th>הכי טוב</Th><Th>נפח</Th><Th>קושי</Th><Th>נבדק</Th></tr></thead><tbody>
                  {(s.keywords || []).map((k: any) => { const chg = (k.previous_rank != null && k.current_rank != null) ? k.previous_rank - k.current_rank : null; return (
                    <tr key={k.id}>
                      <Td w={300}>{k.keyword}</Td>
                      <Td><b style={{ color: k.current_rank ? rankColor(k.current_rank) : C.muted }}>{k.current_rank ?? '—'}</b></Td>
                      <Td>{chg == null || chg === 0 ? '—' : <span style={{ color: chg > 0 ? C.success : C.danger, fontWeight: 700 }}>{chg > 0 ? `▲${chg}` : `▼${-chg}`}</span>}</Td>
                      <Td>{k.best_rank ?? '—'}</Td>
                      <Td>{k.search_volume ?? '—'}</Td>
                      <Td>{k.difficulty ?? '—'}</Td>
                      <Td>{k.last_checked ? new Date(k.last_checked).toLocaleDateString('he-IL') : '—'}</Td>
                    </tr>
                  ); })}
                  {(s.keywords || []).length === 0 && <tr><td colSpan={7} style={{ textAlign: 'center', color: C.muted, padding: '1.5rem' }}>אין מילות מפתח — לחץ "צור 150 מילות מפתח".</td></tr>}
                </tbody></table>
              </div>
            </div>
          )}

          {tab === 'backlinks' && (
            <div style={card}>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}><thead><tr><Th>דומיין מקור</Th><Th>Anchor</Th><Th>סוג</Th><Th>DR</Th><Th>סטטוס</Th></tr></thead><tbody>
                  {(s.backlinks || []).map((b: any) => (
                    <tr key={b.id}>
                      <Td w={260}><a href={b.source_url} target="_blank" rel="noopener noreferrer" style={{ color: C.primary }}>{b.source_domain}</a></Td>
                      <Td w={200}>{b.anchor || '—'}</Td>
                      <Td>{b.dofollow ? 'Dofollow' : 'Nofollow'}</Td>
                      <Td>{b.domain_rating ?? '—'}</Td>
                      <Td><span style={{ color: b.status === 'lost' ? C.danger : b.status === 'new' ? C.primary : C.success, fontWeight: 700 }}>{b.status === 'lost' ? 'אבד' : b.status === 'new' ? 'חדש' : 'פעיל'}</span></Td>
                    </tr>
                  ))}
                  {(s.backlinks || []).length === 0 && <tr><td colSpan={5} style={{ textAlign: 'center', color: C.muted, padding: '1.5rem' }}>אין קישורים — לחץ "סרוק קישורים".</td></tr>}
                </tbody></table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
