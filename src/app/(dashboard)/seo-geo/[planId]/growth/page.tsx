'use client';

export const dynamic = 'force-dynamic';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ADV_MODULES, ADV_TABS } from '@/lib/seo/geo-authority/advanced-modules';

const C = {
  primary: '#00B5FE', primaryDark: '#0095D0', primaryLight: '#E6F7FF',
  bg: '#F7F9FC', card: '#FFFFFF', text: '#1A1A2E', textSecondary: '#5A5A7A', textMuted: '#9A9AB0',
  border: '#E8EAF0', borderLight: '#F0F2F5', success: '#10B981', warning: '#F59E0B', danger: '#EF4444', info: '#3B82F6',
};

const SCORE_LABELS: Record<string, string> = {
  ai_trust: 'AI Trust', geo_opportunity: 'GEO Opportunity', ai_recommendation: 'AI Recommendation',
  ai_influence: 'AI Influence', citation_probability: 'Citation Probability', featured_source: 'Featured Source',
  competitor_weakness: 'Competitor Weakness', citation_opportunity: 'Citation Opportunity', answer_simulation: 'Answer Simulation',
  reputation_risk: 'Reputation Risk', content_roi: 'Content ROI', knowledge_gap: 'Knowledge Gap', entity_gap: 'Entity Gap',
  brand_entity_authority: 'Brand Entity Authority', forecast_confidence: 'Forecast Confidence',
  content_brief_priority: 'Content Brief Priority', brand_memory_growth: 'Brand Memory Growth',
  conversation_path_opportunity: 'Conversation Path', ai_query_opportunity: 'AI Query Opportunity',
};
const STATUS: Record<string, { l: string; c: string }> = { ready: { l: 'פעיל', c: C.success }, partial: { l: 'חלקי', c: C.warning }, empty: { l: 'לא הופעל', c: C.textMuted } };
const sc = (n: number) => (n >= 75 ? C.success : n >= 50 ? C.warning : C.danger);

export default function GrowthCenterPage() {
  const { planId } = useParams<{ planId: string }>();
  const router = useRouter();
  const [state, setState] = useState<any>(null);
  const [tab, setTab] = useState('overview');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [err, setErr] = useState('');
  const [briefTopic, setBriefTopic] = useState('');

  const load = useCallback(async () => {
    setLoading(true); setErr('');
    try {
      const r = await fetch(`/api/seo-geo-plans/${planId}/geo-advanced`, { cache: 'no-store' });
      const d = await r.json(); if (!r.ok) throw new Error(d.error || 'שגיאה');
      setState(d.data || d);
    } catch (e) { setErr(e instanceof Error ? e.message : 'שגיאה'); } finally { setLoading(false); }
  }, [planId]);
  useEffect(() => { load(); }, [load]);

  const post = async (payload: any, key: string) => {
    setBusy(key); setErr('');
    try {
      const r = await fetch(`/api/seo-geo-plans/${planId}/geo-advanced`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const d = await r.json(); if (!r.ok) throw new Error(d.error || 'שגיאה');
      const next = d.data?.state || d.data || d.state; if (next?.modules) setState(next); else await load();
      return d;
    } catch (e) { setErr(e instanceof Error ? e.message : 'שגיאה'); } finally { setBusy(''); }
  };

  const card: React.CSSProperties = { background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: '1rem 1.15rem' };
  const scores = state?.scores || {};
  const tables = state?.tables || {};
  const modulesInTab = (ADV_MODULES).filter((m) => m.tab === tab);

  const Table = ({ rows, cols }: { rows: any[]; cols: { k: string; l: string; w?: number }[] }) => (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
        <thead><tr>{cols.map((c2) => <th key={c2.k} style={{ textAlign: 'right', padding: '7px 8px', color: C.textSecondary, fontWeight: 700, borderBottom: `1px solid ${C.border}`, whiteSpace: 'nowrap' }}>{c2.l}</th>)}</tr></thead>
        <tbody>{rows.map((r, i) => <tr key={i}>{cols.map((c2) => <td key={c2.k} style={{ padding: '7px 8px', borderBottom: `1px solid ${C.borderLight}`, color: C.text, maxWidth: c2.w || 220, overflow: 'hidden', textOverflow: 'ellipsis' }}>{typeof r[c2.k] === 'boolean' ? (r[c2.k] ? '✓' : '—') : Array.isArray(r[c2.k]) ? r[c2.k].join(', ') : (r[c2.k] ?? '—')}</td>)}</tr>)}</tbody>
      </table>
      {rows.length === 0 && <div style={{ color: C.textMuted, fontSize: 13, padding: '1rem 0', textAlign: 'center' }}>אין נתונים — הפעל את המודול.</div>}
    </div>
  );

  return (
    <div dir="rtl" style={{ maxWidth: 1220, margin: '0 auto', padding: '1.5rem 1.25rem 4rem', color: C.text, background: C.bg, minHeight: '100vh' }}>
      <div style={{ display: 'flex', gap: 10, marginBottom: 8 }}>
        <button onClick={() => router.push(`/seo-geo/${planId}/authority`)} style={{ background: 'none', border: 'none', color: C.textSecondary, fontSize: 13, cursor: 'pointer' }}>← Authority Center</button>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 800, margin: 0 }}>🚀 Advanced GEO Growth Center</h1>
          <p style={{ color: C.textSecondary, fontSize: 13.5, margin: '4px 0 0' }}>25 מודולים מתקדמים, ניקוד מתקדם, הזדמנויות, סימולציות ותחזיות — הכל במצב המלצה/טיוטה בלבד.</p>
        </div>
        <button onClick={() => post({ action: 'recompute_scores' }, 'rc')} disabled={!!busy} style={{ background: C.primary, color: '#fff', border: 'none', borderRadius: 12, padding: '0.6rem 1.1rem', fontWeight: 800, fontSize: 13.5, cursor: 'pointer', opacity: busy ? 0.6 : 1 }}>{busy === 'rc' ? '⏳' : '↻ חשב ציונים'}</button>
      </div>

      {err && <div style={{ background: '#FEF2F2', border: `1px solid ${C.danger}40`, color: C.danger, borderRadius: 10, padding: '0.6rem 0.9rem', fontSize: 13, fontWeight: 600, margin: '10px 0' }}>⚠ {err}</div>}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', margin: '16px 0' }}>
        {ADV_TABS.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{ border: 'none', borderRadius: 10, padding: '0.45rem 0.85rem', fontSize: 12.5, fontWeight: tab === t.id ? 800 : 600, cursor: 'pointer', background: tab === t.id ? C.primary : C.card, color: tab === t.id ? '#fff' : C.textSecondary, boxShadow: tab === t.id ? 'none' : `inset 0 0 0 1px ${C.border}` }}>{t.icon} {t.label}</button>
        ))}
      </div>

      {loading ? <div style={{ textAlign: 'center', padding: '4rem', color: C.textMuted }}>טוען…</div> : !state ? null : (
        <>
          {/* Overview: all advanced scores */}
          {tab === 'overview' && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12, marginBottom: 18 }}>
              {Object.keys(SCORE_LABELS).map((k) => {
                const v = Math.round(scores[k]?.value ?? 0);
                return (
                  <div key={k} style={card}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                      <span style={{ fontSize: 12.5, fontWeight: 700, color: C.textSecondary }}>{SCORE_LABELS[k]}</span>
                      <span style={{ fontSize: 22, fontWeight: 900, color: sc(v) }}>{v}</span>
                    </div>
                    <div style={{ height: 6, borderRadius: 999, background: C.borderLight, overflow: 'hidden', margin: '6px 0' }}><div style={{ width: `${v}%`, height: '100%', background: sc(v) }} /></div>
                    <div style={{ fontSize: 10.5, color: C.textMuted, lineHeight: 1.4 }}>{scores[k]?.explanation || ''}</div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Module cards for this tab */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12, marginBottom: 18 }}>
            {modulesInTab.map((m: any) => {
              const live = state.modules.find((x: any) => x.id === m.id) || m;
              const st = STATUS[live.status] || STATUS.empty;
              const runnable = !!m.action;
              return (
                <div key={m.id} style={{ ...card, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 19 }}>{m.icon}</span>
                    <span style={{ fontSize: 10.5, fontWeight: 800, color: st.c, background: `${st.c}15`, borderRadius: 999, padding: '2px 9px' }}>{st.l}</span>
                  </div>
                  <div style={{ fontSize: 13.5, fontWeight: 800 }}>{m.num}. {m.nameHe}</div>
                  <div style={{ fontSize: 11.5, color: C.textSecondary, lineHeight: 1.5, flex: 1 }}>{m.descHe}</div>
                  {m.extends && <div style={{ fontSize: 10.5, color: C.info }}>↳ מרחיב: {m.extends}</div>}
                  <button onClick={() => post({ action: 'run_module', moduleId: m.id }, `m-${m.id}`)} disabled={!!busy}
                    style={{ background: runnable ? C.primaryLight : C.borderLight, color: runnable ? C.primaryDark : C.textMuted, border: `1px solid ${runnable ? C.primary + '30' : C.border}`, borderRadius: 9, padding: '0.45rem', fontSize: 12, fontWeight: 800, cursor: 'pointer', opacity: busy ? 0.6 : 1 }}>
                    {busy === `m-${m.id}` ? '⏳ מריץ…' : runnable ? '▶ הפעל מודול' : '↻ עדכן ציון'}
                  </button>
                </div>
              );
            })}
          </div>

          {/* Tab-specific result tables */}
          {tab === 'opportunities' && <div style={card}><Table rows={tables.geo_opportunities || []} cols={[{ k: 'title', l: 'הזדמנות', w: 300 }, { k: 'bucket', l: 'סוג' }, { k: 'roi', l: 'ROI' }, { k: 'difficulty', l: 'קושי' }, { k: 'score', l: 'ציון' }]} /></div>}
          {tab === 'queries' && <div style={{ display: 'grid', gap: 12 }}>
            <div style={card}><div style={{ fontWeight: 800, fontSize: 14, marginBottom: 8 }}>שאילתות AI</div><Table rows={tables.geo_query_discovery_sets || []} cols={[{ k: 'query', l: 'שאילתה', w: 320 }, { k: 'query_type', l: 'סוג' }, { k: 'topic', l: 'נושא' }, { k: 'priority', l: 'עדיפות' }, { k: 'est_volume', l: 'נפח' }]} /></div>
            <div style={card}><div style={{ fontWeight: 800, fontSize: 14, marginBottom: 8 }}>מסעות שיחה</div><Table rows={tables.geo_conversation_paths || []} cols={[{ k: 'seed', l: 'פתיחה' }, { k: 'path', l: 'מסע', w: 320 }, { k: 'funnel', l: 'שלב' }]} /></div>
          </div>}
          {tab === 'simulations' && <div style={card}><Table rows={tables.geo_answer_simulations || []} cols={[{ k: 'query', l: 'שאילתה', w: 260 }, { k: 'platform', l: 'מנוע' }, { k: 'brand_appeared', l: 'הופיע?' }, { k: 'was_cited', l: 'צוטט?' }, { k: 'missing', l: 'מה חסר', w: 260 }, { k: 'score', l: 'ציון' }]} /></div>}
          {tab === 'citations' && <div style={card}><Table rows={tables.geo_citation_opportunities || []} cols={[{ k: 'page', l: 'עמוד', w: 260 }, { k: 'source_type', l: 'סוג מקור' }, { k: 'gap', l: 'פער', w: 260 }, { k: 'probability', l: 'הסתברות' }]} /></div>}
          {tab === 'reputation' && <div style={card}><Table rows={tables.geo_reputation_checks || []} cols={[{ k: 'sentiment', l: 'טון' }, { k: 'risk_level', l: 'סיכון' }, { k: 'description', l: 'תיאור', w: 360 }, { k: 'score', l: 'ציון' }]} /></div>}
          {tab === 'forecast' && <div style={card}><pre style={{ fontSize: 12, whiteSpace: 'pre-wrap', color: C.text, margin: 0 }}>{JSON.stringify((tables.geo_forecasts || [])[0]?.payload || {}, null, 2)}</pre></div>}
          {tab === 'roadmap' && <div style={card}><pre style={{ fontSize: 12, whiteSpace: 'pre-wrap', color: C.text, margin: 0 }}>{JSON.stringify((tables.geo_roadmaps || [])[0]?.payload || {}, null, 2)}</pre></div>}
          {tab === 'briefs' && <div style={{ display: 'grid', gap: 12 }}>
            <div style={{ ...card, display: 'flex', gap: 8, alignItems: 'center' }}>
              <input value={briefTopic} onChange={(e) => setBriefTopic(e.target.value)} placeholder="נושא לבריף (אופציונלי)…" style={{ flex: 1, fontSize: 13, padding: '0.5rem 0.7rem', border: `1px solid ${C.border}`, borderRadius: 9 }} />
              <button onClick={() => post({ action: 'content_brief', topic: briefTopic || undefined }, 'brief')} disabled={!!busy} style={{ background: C.primary, color: '#fff', border: 'none', borderRadius: 9, padding: '0.5rem 1rem', fontWeight: 800, fontSize: 12.5, cursor: 'pointer' }}>{busy === 'brief' ? '⏳' : '+ צור בריף'}</button>
            </div>
            {(tables.geo_content_briefs || []).map((b: any) => (
              <div key={b.id} style={card}><div style={{ fontWeight: 800, fontSize: 14, marginBottom: 6 }}>📝 {b.title}</div><pre style={{ fontSize: 11.5, whiteSpace: 'pre-wrap', color: C.textSecondary, margin: 0 }}>{JSON.stringify(b.payload, null, 2)}</pre></div>
            ))}
          </div>}
          {tab === 'validator' && <div style={card}><Table rows={tables.geo_content_validations || []} cols={[{ k: 'target', l: 'יעד', w: 260 }, { k: 'score', l: 'ציון' }, { k: 'passed', l: 'עבר?' }]} /></div>}
          {(tab === 'competitors' || tab === 'entity' || tab === 'actions') && (
            <div style={{ ...card, color: C.textSecondary, fontSize: 13 }}>מודולים אלה מרחיבים מודולים קיימים — ראה את הלשוניות התואמות ב-Authority Center / בתוכנית. הציונים מתעדכנים כאן.</div>
          )}
        </>
      )}
    </div>
  );
}
