'use client';

export const dynamic = 'force-dynamic';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';

const C = {
  primary: '#00B5FE', primaryDark: '#0095D0', primaryLight: '#E6F7FF',
  bg: '#F7F9FC', card: '#FFFFFF',
  text: '#1A1A2E', textSecondary: '#5A5A7A', textMuted: '#9A9AB0',
  border: '#E8EAF0', borderLight: '#F0F2F5',
  success: '#10B981', warning: '#F59E0B', danger: '#EF4444', info: '#3B82F6',
};

const SUB_LABELS: Record<string, string> = {
  topical: 'Topical Authority', contentDepth: 'Content Depth', aiReadiness: 'AI Readiness',
  entity: 'Entity Coverage', internalLinking: 'Internal Linking', citation: 'Citation Potential',
  brand: 'Brand Presence', schema: 'Schema Quality', eeat: 'E-E-A-T',
};

const STATUS_META: Record<string, { label: string; color: string }> = {
  ready: { label: 'פעיל', color: C.success },
  partial: { label: 'חלקי', color: C.warning },
  empty: { label: 'לא הופעל', color: C.textMuted },
};

const scoreColor = (n: number) => (n >= 75 ? C.success : n >= 50 ? C.warning : C.danger);

export default function AuthorityCenterPage() {
  const params = useParams();
  const router = useRouter();
  const planId = String(params.planId || '');
  const [state, setState] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string>('');
  const [err, setErr] = useState('');
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    setLoading(true); setErr('');
    try {
      const r = await fetch(`/api/seo-geo-plans/${planId}/authority`, { cache: 'no-store' });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'שגיאה');
      setState(d.data || d);
    } catch (e) { setErr(e instanceof Error ? e.message : 'שגיאה'); } finally { setLoading(false); }
  }, [planId]);

  useEffect(() => { load(); }, [load]);

  const post = async (payload: any, busyKey: string) => {
    setBusy(busyKey); setErr('');
    try {
      const r = await fetch(`/api/seo-geo-plans/${planId}/authority`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'שגיאה');
      const next = d.data?.state || d.data || d.state || d;
      if (next?.modules) setState(next);
      else await load();
      return d;
    } catch (e) { setErr(e instanceof Error ? e.message : 'שגיאה'); }
    finally { setBusy(''); }
  };

  const card: React.CSSProperties = { background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: '1.1rem 1.25rem' };
  const subScores = state?.subScores || {};
  const overall = state?.overall || 0;

  return (
    <div dir="rtl" style={{ maxWidth: 1180, margin: '0 auto', padding: '1.5rem 1.25rem 4rem', color: C.text, background: C.bg, minHeight: '100vh' }}>
      <button onClick={() => router.push(`/seo-geo/${planId}`)} style={{ background: 'none', border: 'none', color: C.textSecondary, fontSize: 13, cursor: 'pointer', marginBottom: 12 }}>← חזרה לתוכנית</button>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 6 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 800, margin: 0 }}>🏆 SEO GEO Authority Center</h1>
          <p style={{ color: C.textSecondary, fontSize: 13.5, margin: '4px 0 0' }}>ציון סמכות, 15 מודולים, המלצות → משימות, וטיוטות — שום שינוי לא מתפרסם ללא אישור.</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => router.push(`/seo-geo/${planId}/growth`)}
            style={{ background: '#1A1A2E', color: '#fff', border: 'none', borderRadius: 12, padding: '0.6rem 1.1rem', fontWeight: 800, fontSize: 13.5, cursor: 'pointer' }}>
            🚀 Advanced Growth
          </button>
          <button onClick={() => post({ action: 'recompute' }, 'recompute')} disabled={!!busy}
            style={{ background: C.primary, color: '#fff', border: 'none', borderRadius: 12, padding: '0.6rem 1.1rem', fontWeight: 800, fontSize: 13.5, cursor: 'pointer', opacity: busy ? 0.6 : 1 }}>
            {busy === 'recompute' ? '⏳ מחשב…' : '↻ חשב מחדש'}
          </button>
        </div>
      </div>

      {err && <div style={{ background: '#FEF2F2', border: `1px solid ${C.danger}40`, color: C.danger, borderRadius: 10, padding: '0.6rem 0.9rem', fontSize: 13, fontWeight: 600, margin: '10px 0' }}>⚠ {err}</div>}
      {notice && <div style={{ background: `${C.info}10`, border: `1px solid ${C.info}40`, color: C.info, borderRadius: 10, padding: '0.6rem 0.9rem', fontSize: 13, fontWeight: 600, margin: '10px 0', display: 'flex', justifyContent: 'space-between', gap: 8 }}><span>ℹ {notice}</span><span style={{ cursor: 'pointer' }} onClick={() => setNotice('')}>✕</span></div>}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '4rem', color: C.textMuted }}>טוען…</div>
      ) : !state ? null : (
        <>
          {/* Score hero */}
          <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr', gap: 16, margin: '14px 0 18px' }}>
            <div style={{ ...card, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ position: 'relative', width: 130, height: 130 }}>
                <svg viewBox="0 0 120 120" style={{ width: '100%', height: '100%', transform: 'rotate(-90deg)' }}>
                  <circle cx="60" cy="60" r="52" fill="none" stroke={C.borderLight} strokeWidth="12" />
                  <circle cx="60" cy="60" r="52" fill="none" stroke={scoreColor(overall)} strokeWidth="12" strokeLinecap="round"
                    strokeDasharray={`${(overall / 100) * 2 * Math.PI * 52} ${2 * Math.PI * 52}`} />
                </svg>
                <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                  <div style={{ fontSize: 34, fontWeight: 900, color: scoreColor(overall) }}>{overall}</div>
                  <div style={{ fontSize: 11, color: C.textMuted, fontWeight: 700 }}>/ 100</div>
                </div>
              </div>
              <div style={{ fontSize: 13, fontWeight: 800, marginTop: 8 }}>Authority Score</div>
            </div>
            <div style={{ ...card }}>
              <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 12 }}>8 ממדי סמכות</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 24px' }}>
                {Object.keys(SUB_LABELS).map((k) => {
                  const v = Math.round(subScores[k] || 0);
                  return (
                    <div key={k}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5, marginBottom: 3 }}>
                        <span style={{ color: C.textSecondary, fontWeight: 600 }}>{SUB_LABELS[k]}</span>
                        <span style={{ fontWeight: 800, color: scoreColor(v) }}>{v}</span>
                      </div>
                      <div style={{ height: 7, borderRadius: 999, background: C.borderLight, overflow: 'hidden' }}>
                        <div style={{ width: `${v}%`, height: '100%', background: scoreColor(v) }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* 15 modules */}
          <div style={{ fontSize: 16, fontWeight: 800, margin: '6px 0 10px' }}>🧩 15 מודולי הסמכות</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(270px, 1fr))', gap: 12, marginBottom: 22 }}>
            {(state.modules || []).map((m: any) => {
              const sm = STATUS_META[m.status] || STATUS_META.empty;
              return (
                <div key={m.id} style={{ ...card, padding: '0.9rem 1rem', display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 20 }}>{m.icon}</span>
                    <span style={{ fontSize: 10.5, fontWeight: 800, color: sm.color, background: `${sm.color}15`, borderRadius: 999, padding: '2px 9px' }}>{sm.label}</span>
                  </div>
                  <div style={{ fontSize: 13.5, fontWeight: 800, lineHeight: 1.3 }}>{m.num}. {m.nameHe}</div>
                  <div style={{ fontSize: 11.5, color: C.textSecondary, lineHeight: 1.5, flex: 1 }}>{m.descHe}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, color: C.textMuted }}>
                    {m.openRecs > 0 && <span style={{ color: C.warning, fontWeight: 700 }}>{m.openRecs} המלצות</span>}
                    {m.drafts > 0 && <span style={{ color: C.info, fontWeight: 700 }}>{m.drafts} טיוטות</span>}
                  </div>
                  <button onClick={() => post({ action: 'run_module', moduleId: m.id }, `mod-${m.id}`)} disabled={!!busy}
                    style={{ background: C.primaryLight, color: C.primaryDark, border: `1px solid ${C.primary}30`, borderRadius: 9, padding: '0.45rem', fontSize: 12, fontWeight: 800, cursor: 'pointer', opacity: busy ? 0.6 : 1 }}>
                    {busy === `mod-${m.id}` ? '⏳ מריץ…' : '▶ הפעל מודול'}
                  </button>
                </div>
              );
            })}
          </div>

          {/* Recommendations → tasks */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, alignItems: 'start' }}>
            <div style={card}>
              <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 10 }}>💡 המלצות פעולה</div>
              {(state.recommendations || []).filter((r: any) => r.status === 'open').length === 0 ? (
                <div style={{ color: C.textMuted, fontSize: 13, padding: '1rem 0' }}>אין המלצות פתוחות — חשב מחדש כדי לרענן.</div>
              ) : (
                (state.recommendations || []).filter((r: any) => r.status === 'open').map((r: any) => {
                  const pc = r.priority === 'high' ? C.danger : r.priority === 'medium' ? C.warning : C.textMuted;
                  return (
                    <div key={r.id} style={{ borderTop: `1px solid ${C.borderLight}`, padding: '0.7rem 0', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: pc, marginTop: 6, flexShrink: 0 }} />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 700 }}>{r.title}</div>
                        {r.description && <div style={{ fontSize: 11.5, color: C.textSecondary, marginTop: 2 }}>{r.description}</div>}
                        {r.estimated_impact && <div style={{ fontSize: 11, color: C.success, fontWeight: 700, marginTop: 3 }}>📈 {r.estimated_impact}</div>}
                      </div>
                      <button onClick={() => post({ action: 'create_task', recId: r.id }, `rec-${r.id}`)} disabled={!!busy}
                        style={{ background: C.primary, color: '#fff', border: 'none', borderRadius: 8, padding: '0.35rem 0.7rem', fontSize: 11.5, fontWeight: 800, cursor: 'pointer', whiteSpace: 'nowrap', opacity: busy ? 0.6 : 1 }}>
                        + משימה
                      </button>
                    </div>
                  );
                })
              )}
            </div>

            {/* Tasks + Drafts */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={card}>
                <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 10 }}>✅ משימות ({(state.tasks || []).length})</div>
                {(state.tasks || []).length === 0 ? (
                  <div style={{ color: C.textMuted, fontSize: 13, padding: '0.5rem 0' }}>אין משימות. אשר המלצה כדי ליצור משימה.</div>
                ) : (
                  (state.tasks || []).map((t: any) => (
                    <div key={t.id} style={{ borderTop: `1px solid ${C.borderLight}`, padding: '0.55rem 0', display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ flex: 1, fontSize: 12.5, fontWeight: 600, textDecoration: t.status === 'done' ? 'line-through' : 'none', color: t.status === 'done' ? C.textMuted : C.text }}>{t.title}</div>
                      <select value={t.status} onChange={(e) => post({ action: 'task_status', taskId: t.id, status: e.target.value }, `task-${t.id}`)} disabled={!!busy}
                        style={{ fontSize: 11.5, border: `1px solid ${C.border}`, borderRadius: 7, padding: '2px 6px', color: C.textSecondary }}>
                        <option value="todo">לביצוע</option>
                        <option value="in_progress">בעבודה</option>
                        <option value="done">בוצע</option>
                      </select>
                    </div>
                  ))
                )}
              </div>

              <div style={card}>
                <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 4 }}>📝 טיוטות ({(state.drafts || []).length})</div>
                <div style={{ fontSize: 11, color: C.textMuted, marginBottom: 8 }}>נוצרות ע״י המודולים. אישור → החלה ידנית בלבד (לא מתפרסם אוטומטית).</div>
                {(state.drafts || []).length === 0 ? (
                  <div style={{ color: C.textMuted, fontSize: 13, padding: '0.5rem 0' }}>אין טיוטות עדיין.</div>
                ) : (
                  (state.drafts || []).slice(0, 20).map((d: any) => {
                    const sc = d.status === 'applied' ? C.success : d.status === 'approved' ? C.info : d.status === 'rejected' ? C.danger : C.textMuted;
                    return (
                      <div key={d.id} style={{ borderTop: `1px solid ${C.borderLight}`, padding: '0.55rem 0' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontSize: 10, fontWeight: 800, color: sc, background: `${sc}15`, borderRadius: 6, padding: '1px 7px' }}>{d.kind}</span>
                          <div style={{ flex: 1, fontSize: 12.5, fontWeight: 600 }}>{d.title || d.target_page || '—'}</div>
                        </div>
                        {d.status === 'draft' && (
                          <div style={{ display: 'flex', gap: 6, marginTop: 5 }}>
                            <button onClick={() => post({ action: 'draft_status', draftId: d.id, status: 'approved' }, `dr-${d.id}`)} disabled={!!busy} style={{ fontSize: 11, fontWeight: 700, color: C.info, background: `${C.info}12`, border: 'none', borderRadius: 7, padding: '0.25rem 0.6rem', cursor: 'pointer' }}>אשר</button>
                            <button onClick={() => post({ action: 'draft_status', draftId: d.id, status: 'rejected' }, `dr-${d.id}`)} disabled={!!busy} style={{ fontSize: 11, fontWeight: 700, color: C.danger, background: `${C.danger}10`, border: 'none', borderRadius: 7, padding: '0.25rem 0.6rem', cursor: 'pointer' }}>דחה</button>
                          </div>
                        )}
                        {d.status === 'approved' && (
                          <button onClick={async () => { const r = await post({ action: 'draft_status', draftId: d.id, status: 'applied' }, `dr-${d.id}`); const a = r?.data?.apply; if (a?.detail) setNotice(a.detail); }} disabled={!!busy} style={{ marginTop: 5, fontSize: 11, fontWeight: 700, color: C.success, background: `${C.success}12`, border: 'none', borderRadius: 7, padding: '0.25rem 0.6rem', cursor: 'pointer' }}>החל באתר</button>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
