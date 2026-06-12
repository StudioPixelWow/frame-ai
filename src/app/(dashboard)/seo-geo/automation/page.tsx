'use client';

export const dynamic = 'force-dynamic';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { PageHeader } from '@/components/ui/saas-kit';

const C = {
  primary: '#00B5FE', primaryDark: '#0095D0', primaryLight: '#E6F7FF',
  bg: '#F7F9FC', card: '#FFFFFF', text: '#1A1A2E', textSecondary: '#5A5A7A', textMuted: '#9A9AB0',
  border: '#E8EAF0', borderLight: '#F0F2F5', success: '#10B981', warning: '#F59E0B', danger: '#EF4444', info: '#3B82F6',
};
const ST: Record<string, { l: string; c: string }> = {
  active: { l: 'פעיל', c: C.success }, running: { l: 'רץ', c: C.info }, completed: { l: 'הושלם', c: C.success },
  failed: { l: 'נכשל', c: C.danger }, partially_failed: { l: 'כשל חלקי', c: C.warning },
  waiting_for_budget: { l: 'ממתין לתקציב', c: C.warning }, waiting_for_api_key: { l: 'חסר API', c: C.warning },
  paused: { l: 'מושהה', c: C.textMuted }, disabled: { l: 'כבוי', c: C.textMuted },
};
const fmt = (d?: string) => (d ? new Date(d).toLocaleString('he-IL', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—');

export default function AutomationCenterPage() {
  const router = useRouter();
  const [state, setState] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [err, setErr] = useState('');

  const load = useCallback(async () => {
    setLoading(true); setErr('');
    try { const r = await fetch('/api/seo-geo-plans/automation', { cache: 'no-store' }); const d = await r.json(); if (!r.ok) throw new Error(d.error || 'שגיאה'); setState(d.data || d); }
    catch (e) { setErr(e instanceof Error ? e.message : 'שגיאה'); } finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const post = async (payload: any, key: string) => {
    setBusy(key); setErr('');
    try { const r = await fetch('/api/seo-geo-plans/automation', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }); const d = await r.json(); if (!r.ok) throw new Error(d.error || 'שגיאה'); const next = d.data?.state || d.data || d.state; if (next?.clients) setState(next); else await load(); }
    catch (e) { setErr(e instanceof Error ? e.message : 'שגיאה'); } finally { setBusy(''); }
  };

  const card: React.CSSProperties = { background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: '1rem 1.15rem' };
  const c = state?.counts || {};
  const Kpi = ({ label, value, color }: { label: string; value: any; color?: string }) => (
    <div style={{ ...card, textAlign: 'center', padding: '0.8rem' }}><div style={{ fontSize: 26, fontWeight: 900, color: color || C.text }}>{value ?? 0}</div><div style={{ fontSize: 11.5, color: C.textSecondary, fontWeight: 600 }}>{label}</div></div>
  );

  return (
    <div dir="rtl" style={{ maxWidth: 1280, margin: '0 auto', padding: '1.5rem 1.25rem 4rem', color: C.text, background: C.bg, minHeight: '100vh' }}>
      <button onClick={() => router.push('/seo-geo')} style={{ background: 'none', border: 'none', color: C.textSecondary, fontSize: 13, cursor: 'pointer', marginBottom: 8 }}>← SEO/GEO</button>
      <PageHeader
        title="⚙️ GEO Automation Control Center"
        subtitle="כל לקוח פעיל רץ אוטומטית לפי תדירות — queue, retries, logs, סטטוס, ובקרת עלות."
        secondaryActions={[{ label: busy === 'enroll' ? '⏳' : '↻ רישום לקוחות', onClick: () => { if (!busy) post({ action: 'enroll' }, 'enroll'); } }]}
        primaryAction={{ label: busy === 'tick' ? '⏳ מריץ…' : '▶ הרץ עכשיו (Tick)', onClick: () => { if (!busy) post({ action: 'tick' }, 'tick'); } }}
      />

      {err && <div style={{ background: '#FEF2F2', border: `1px solid ${C.danger}40`, color: C.danger, borderRadius: 10, padding: '0.6rem 0.9rem', fontSize: 13, fontWeight: 600, margin: '10px 0' }}>⚠ {err}</div>}

      {loading ? <div style={{ textAlign: 'center', padding: '4rem', color: C.textMuted }}>טוען…</div> : !state ? null : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 10, margin: '16px 0' }}>
            <Kpi label="לקוחות" value={c.clients} />
            <Kpi label="מופעלים" value={c.enabled} color={C.success} />
            <Kpi label="בריצה" value={c.in_flight} color={C.info} />
            <Kpi label="בתור" value={c.queued} color={C.warning} />
            <Kpi label="נכשלו" value={c.failed} color={C.danger} />
            <Kpi label="ממתין לתקציב" value={c.waiting_budget} color={C.warning} />
          </div>

          {/* Clients table */}
          <div style={{ ...card, marginBottom: 16, overflowX: 'auto' }}>
            <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 10 }}>לקוחות באוטומציה</div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
              <thead><tr>{['לקוח', 'סטטוס', 'תדירות', 'ריצה אחרונה', 'ריצה הבאה', 'כשלים', 'שימוש (₪)', 'מופעל', 'פעולות'].map((h) => <th key={h} style={{ textAlign: 'right', padding: '7px 8px', color: C.textSecondary, fontWeight: 700, borderBottom: `1px solid ${C.border}`, whiteSpace: 'nowrap' }}>{h}</th>)}</tr></thead>
              <tbody>
                {(state.clients || []).map((cl: any) => {
                  const st = ST[cl.current_status] || { l: cl.current_status, c: C.textMuted };
                  return (
                    <tr key={cl.plan_id}>
                      <td style={{ padding: '7px 8px', borderBottom: `1px solid ${C.borderLight}`, maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis' }}>{cl.client_name || cl.plan_id}</td>
                      <td style={{ padding: '7px 8px', borderBottom: `1px solid ${C.borderLight}` }}><span style={{ fontSize: 11, fontWeight: 800, color: st.c, background: `${st.c}15`, borderRadius: 999, padding: '2px 8px' }}>{st.l}</span></td>
                      <td style={{ padding: '7px 8px', borderBottom: `1px solid ${C.borderLight}` }}>
                        <select value={cl.run_frequency} onChange={(e) => post({ action: 'set', planId: cl.plan_id, patch: { run_frequency: e.target.value } }, `f-${cl.plan_id}`)} style={{ fontSize: 11.5, border: `1px solid ${C.border}`, borderRadius: 6, padding: '1px 4px' }}>
                          <option value="daily">יומי</option><option value="weekly">שבועי</option><option value="monthly">חודשי</option>
                        </select>
                      </td>
                      <td style={{ padding: '7px 8px', borderBottom: `1px solid ${C.borderLight}`, color: C.textSecondary, whiteSpace: 'nowrap' }}>{fmt(cl.last_run_at)}{cl.last_failure_at && !cl.last_success_at ? ' ⚠' : ''}</td>
                      <td style={{ padding: '7px 8px', borderBottom: `1px solid ${C.borderLight}`, color: C.textSecondary, whiteSpace: 'nowrap' }}>{fmt(cl.next_run_at)}</td>
                      <td style={{ padding: '7px 8px', borderBottom: `1px solid ${C.borderLight}`, color: cl.failure_count > 0 ? C.danger : C.textMuted, textAlign: 'center' }}>{cl.failure_count || 0}</td>
                      <td style={{ padding: '7px 8px', borderBottom: `1px solid ${C.borderLight}`, color: C.textSecondary }}>{((cl.monthly_usage_cents || 0) / 100).toFixed(2)}{cl.monthly_budget_cents ? ` / ${(cl.monthly_budget_cents / 100).toFixed(0)}` : ''}</td>
                      <td style={{ padding: '7px 8px', borderBottom: `1px solid ${C.borderLight}` }}>
                        <input type="checkbox" checked={!!cl.automation_enabled} onChange={(e) => post({ action: 'set', planId: cl.plan_id, patch: { automation_enabled: e.target.checked, current_status: e.target.checked ? 'active' : 'disabled' } }, `e-${cl.plan_id}`)} />
                      </td>
                      <td style={{ padding: '7px 8px', borderBottom: `1px solid ${C.borderLight}` }}>
                        <button onClick={() => post({ action: 'run_now', planId: cl.plan_id, clientId: cl.client_id }, `r-${cl.plan_id}`)} disabled={!!busy} style={{ fontSize: 11, fontWeight: 700, color: C.primaryDark, background: C.primaryLight, border: `1px solid ${C.primary}30`, borderRadius: 7, padding: '0.25rem 0.55rem', cursor: 'pointer', whiteSpace: 'nowrap' }}>{busy === `r-${cl.plan_id}` ? '⏳' : '▶ הרץ'}</button>
                      </td>
                    </tr>
                  );
                })}
                {(state.clients || []).length === 0 && <tr><td colSpan={9} style={{ textAlign: 'center', color: C.textMuted, padding: '1.5rem' }}>אין לקוחות רשומים — לחץ "רישום לקוחות".</td></tr>}
              </tbody>
            </table>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div style={card}>
              <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 10 }}>❌ Jobs שנכשלו</div>
              {(state.failedJobs || []).length === 0 ? <div style={{ color: C.textMuted, fontSize: 13 }}>אין כשלים 🎉</div> :
                (state.failedJobs || []).map((j: any) => (
                  <div key={j.id} style={{ borderTop: `1px solid ${C.borderLight}`, padding: '0.55rem 0', display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 12.5, fontWeight: 700 }}>{j.job_type} · {j.plan_id}</div>
                      <div style={{ fontSize: 11, color: C.danger }}>{(j.error || '').slice(0, 120)}</div>
                    </div>
                    <button onClick={() => post({ action: 'retry', jobId: j.id }, `rt-${j.id}`)} disabled={!!busy} style={{ fontSize: 11, fontWeight: 700, color: C.info, background: `${C.info}12`, border: 'none', borderRadius: 7, padding: '0.25rem 0.6rem', cursor: 'pointer' }}>retry</button>
                  </div>
                ))}
            </div>
            <div style={card}>
              <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 10 }}>🕒 ריצות אחרונות</div>
              {(state.runs || []).slice(0, 14).map((r: any) => (
                <div key={r.id} style={{ borderTop: `1px solid ${C.borderLight}`, padding: '0.5rem 0', display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                  <span style={{ color: C.textSecondary }}>{r.job_type} · {r.plan_id?.slice(0, 14)}</span>
                  <span style={{ color: r.status === 'completed' ? C.success : r.status === 'failed' ? C.danger : C.warning, fontWeight: 700 }}>{r.status}{r.duration_ms ? ` · ${(r.duration_ms / 1000).toFixed(1)}s` : ''}</span>
                </div>
              ))}
              {(state.runs || []).length === 0 && <div style={{ color: C.textMuted, fontSize: 13 }}>עדיין אין ריצות.</div>}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
