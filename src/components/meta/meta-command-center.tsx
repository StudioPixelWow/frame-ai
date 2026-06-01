'use client';

import { useState, useEffect, useCallback } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import DateRangeSegment, { type DateRangeValue } from './date-range-segment';

const BRAND = '#00B5FE';
const GREEN = '#16a34a';
const AMBER = '#f59e0b';
const RED = '#ef4444';

const fmt = (n: number, d = 0) => (n || 0).toLocaleString('he-IL', { minimumFractionDigits: d, maximumFractionDigits: d });

interface ClientCard {
  id: string; name: string; connected: boolean;
  status: 'healthy' | 'warning' | 'critical';
  health: number; leads: number; spend: number; cpl: number; ctr: number;
  activeCampaigns: number; stale: boolean; lastDate: string | null;
  trend: { leads: number; spend: number; cpl: number; ctr: number };
}
interface Overview {
  kpis: { activeClients: number; activeCampaigns: number; leads: number; spend: number; avgCpl: number; avgCtr: number } | null;
  clients: ClientCard[];
  series: { date: string; leads: number; spend: number; cpl: number }[];
  insights: { severity: string; icon: string; title: string; detail: string; clientIds: string[] }[];
  attention: { clientId: string; name: string; severity: string; reason: string; metric: string }[];
  hasData: boolean;
}

const STATUS = {
  healthy: { label: 'תקין', color: GREEN, bg: 'rgba(22,163,74,0.10)' },
  warning: { label: 'דורש מעקב', color: AMBER, bg: 'rgba(245,158,11,0.12)' },
  critical: { label: 'קריטי', color: RED, bg: 'rgba(239,68,68,0.10)' },
};

/** colored ▲/▼ chip. goodWhenUp=false means an increase is bad (e.g. CPL). */
function TrendChip({ pct, goodWhenUp = true }: { pct: number; goodWhenUp?: boolean }) {
  if (!pct) return <span style={{ fontSize: 11, color: '#9ca3af' }}>—</span>;
  const up = pct > 0;
  const good = goodWhenUp ? up : !up;
  const color = good ? GREEN : RED;
  return (
    <span style={{ fontSize: 11, fontWeight: 700, color }}>
      {up ? '▲' : '▼'} {Math.abs(pct)}%
    </span>
  );
}

export default function MetaCommandCenter({ onOpenClient }: { onOpenClient: (id: string, name: string) => void }) {
  const [range, setRange] = useState<DateRangeValue>({ preset: 'today' });
  const [data, setData] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);
  const [metric, setMetric] = useState<'leads' | 'spend' | 'cpl'>('leads');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams({ datePreset: range.preset });
      if (range.preset === 'custom' && range.from && range.to) { qs.set('from', range.from); qs.set('to', range.to); }
      const res = await fetch(`/api/meta-business/overview?${qs.toString()}`);
      setData(await res.json());
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [range]);

  useEffect(() => { load(); }, [load]);

  const kpis = data?.kpis;
  const metricMeta = {
    leads: { label: 'לידים', color: BRAND, fmt: (v: number) => fmt(v) },
    spend: { label: 'הוצאה', color: '#6366f1', fmt: (v: number) => `₪${fmt(v)}` },
    cpl: { label: 'CPL', color: RED, fmt: (v: number) => `₪${fmt(v, 1)}` },
  }[metric];

  const kpiCards = kpis ? [
    { label: 'לקוחות פעילים', value: fmt(kpis.activeClients), icon: '👥', tint: BRAND },
    { label: 'קמפיינים פעילים', value: fmt(kpis.activeCampaigns), icon: '🎯', tint: '#6366f1' },
    { label: 'לידים', value: fmt(kpis.leads), icon: '✨', tint: GREEN },
    { label: 'הוצאה', value: `₪${fmt(kpis.spend)}`, icon: '💸', tint: '#0ea5e9' },
    { label: 'CPL ממוצע', value: `₪${fmt(kpis.avgCpl, 1)}`, icon: '🎚️', tint: AMBER },
    { label: 'CTR ממוצע', value: `${fmt(kpis.avgCtr, 2)}%`, icon: '📊', tint: '#ec4899' },
  ] : [];

  return (
    <div dir="rtl" style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
      {/* Header + date control */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 style={{ fontSize: 22, fontWeight: 800, margin: 0, color: 'var(--foreground,#0f172a)' }}>מרכז פיקוד קמפיינים</h2>
          <p style={{ fontSize: 13, color: 'var(--foreground-muted,#6b7280)', margin: '4px 0 0' }}>תמונת-על חיה על כל הלקוחות — בריאות, ביצועים, והיכן צריך לפעול עכשיו.</p>
        </div>
        <DateRangeSegment value={range} onChange={setRange} />
      </div>

      {loading ? (
        <div style={{ padding: 48, textAlign: 'center', color: '#9ca3af' }}>טוען נתונים…</div>
      ) : !data?.hasData ? (
        <div style={{ padding: 40, textAlign: 'center', color: '#6b7280', background: 'var(--surface,#f8fafc)', borderRadius: 16, border: '1px dashed var(--border,#e5e7eb)' }}>
          לא נמצאו לקוחות מחוברים ל-Meta עם קמפיינים מסונכרנים.<br />
          חבר חשבון מודעות ושייך אותו ללקוח, או הרץ סנכרון — ואז הלקוחות יופיעו כאן.
        </div>
      ) : (
        <>
          {/* ── Global KPI cards ── */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 14 }}>
            {kpiCards.map((c) => (
              <div key={c.label} style={{
                background: 'var(--surface-raised,#fff)', borderRadius: 18, padding: '1.25rem 1.4rem',
                border: '1px solid var(--border,#eef1f5)', boxShadow: '0 1px 3px rgba(15,23,42,0.04)',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 22, lineHeight: 1 }}>{c.icon}</span>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: c.tint }} />
                </div>
                <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--foreground,#0f172a)', marginTop: 14, letterSpacing: '-0.02em' }}>{c.value}</div>
                <div style={{ fontSize: 12.5, color: 'var(--foreground-muted,#6b7280)', marginTop: 2 }}>{c.label}</div>
              </div>
            ))}
          </div>

          {/* ── Global performance chart (only when we have daily history) ── */}
          {data.series.length > 1 && (
          <div style={{ background: 'var(--surface-raised,#fff)', borderRadius: 20, padding: '1.4rem 1.5rem', border: '1px solid var(--border,#eef1f5)', boxShadow: '0 1px 3px rgba(15,23,42,0.04)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10, marginBottom: 14 }}>
              <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--foreground,#0f172a)' }}>ביצועים — 30 הימים האחרונים</div>
              <div style={{ display: 'inline-flex', gap: 2, padding: 4, borderRadius: 11, background: 'var(--surface,#f1f5f9)', border: '1px solid var(--border,#e5e7eb)' }}>
                {(['leads', 'spend', 'cpl'] as const).map((m) => {
                  const meta = { leads: 'לידים', spend: 'הוצאה', cpl: 'CPL' }[m];
                  const active = metric === m;
                  return (
                    <button key={m} onClick={() => setMetric(m)} style={{
                      padding: '0.35rem 0.85rem', fontSize: 12.5, fontWeight: 600, border: 'none', borderRadius: 8, cursor: 'pointer',
                      background: active ? '#fff' : 'transparent', color: active ? BRAND : '#6b7280',
                      boxShadow: active ? '0 1px 3px rgba(0,0,0,0.12)' : 'none', transition: 'all 140ms ease',
                    }}>{meta}</button>
                  );
                })}
              </div>
            </div>
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={data.series} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                <defs>
                  <linearGradient id="mccFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={metricMeta.color} stopOpacity={0.35} />
                    <stop offset="100%" stopColor={metricMeta.color} stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#eef1f5" vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#9ca3af' }} tickFormatter={(d) => String(d).slice(5)} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} tickLine={false} axisLine={false} width={48} />
                <Tooltip
                  contentStyle={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, fontSize: 12, boxShadow: '0 8px 24px rgba(0,0,0,0.08)' }}
                  formatter={(v: any) => [metricMeta.fmt(Number(v)), metricMeta.label]}
                  labelFormatter={(l) => `📅 ${l}`}
                />
                <Area type="monotone" dataKey={metric} stroke={metricMeta.color} strokeWidth={2.5} fill="url(#mccFill)" dot={false} activeDot={{ r: 4 }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          )}

          {/* ── AI Insights + Attention (two columns) ── */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16 }}>
            {/* AI insights */}
            <div style={{ background: 'var(--surface-raised,#fff)', borderRadius: 20, padding: '1.4rem 1.5rem', border: '1px solid var(--border,#eef1f5)', boxShadow: '0 1px 3px rgba(15,23,42,0.04)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                <span style={{ fontSize: 18 }}>🧠</span>
                <span style={{ fontSize: 15, fontWeight: 800, color: 'var(--foreground,#0f172a)' }}>תובנות AI</span>
              </div>
              {data.insights.length === 0 ? (
                <div style={{ fontSize: 13, color: '#9ca3af', padding: '0.5rem 0' }}>אין התראות — הכל נראה יציב 👌</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {data.insights.map((ins, i) => {
                    const c = ins.severity === 'critical' ? RED : ins.severity === 'positive' ? GREEN : AMBER;
                    return (
                      <div key={i} style={{ display: 'flex', gap: 10, padding: '0.7rem 0.85rem', borderRadius: 12, background: `${c}0d`, border: `1px solid ${c}26` }}>
                        <span style={{ fontSize: 18, lineHeight: 1.2 }}>{ins.icon}</span>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--foreground,#0f172a)' }}>{ins.title}</div>
                          {ins.detail && <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>{ins.detail}</div>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Attention center */}
            <div style={{ background: 'var(--surface-raised,#fff)', borderRadius: 20, padding: '1.4rem 1.5rem', border: '1px solid var(--border,#eef1f5)', boxShadow: '0 1px 3px rgba(15,23,42,0.04)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                <span style={{ fontSize: 18 }}>🚨</span>
                <span style={{ fontSize: 15, fontWeight: 800, color: 'var(--foreground,#0f172a)' }}>דורש התייחסות</span>
              </div>
              {data.attention.length === 0 ? (
                <div style={{ fontSize: 13, color: '#9ca3af', padding: '0.5rem 0' }}>אין משימות דחופות כרגע ✅</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {data.attention.slice(0, 8).map((a, i) => {
                    const c = a.severity === 'critical' ? RED : AMBER;
                    return (
                      <button key={i} onClick={() => onOpenClient(a.clientId, a.name)} style={{
                        display: 'flex', alignItems: 'center', gap: 10, padding: '0.6rem 0.75rem', borderRadius: 11, cursor: 'pointer',
                        background: 'transparent', border: '1px solid var(--border,#eef1f5)', textAlign: 'right', width: '100%',
                      }}>
                        <span style={{ width: 8, height: 8, borderRadius: '50%', background: c, flexShrink: 0 }} />
                        <span style={{ flex: 1, minWidth: 0 }}>
                          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--foreground,#0f172a)' }}>{a.name}</span>
                          <span style={{ display: 'block', fontSize: 11.5, color: '#6b7280' }}>{a.reason}</span>
                        </span>
                        <span style={{ fontSize: 11.5, fontWeight: 700, color: c, whiteSpace: 'nowrap' }}>{a.metric}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* ── Client cards ── */}
          <div>
            <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--foreground,#0f172a)', marginBottom: 12 }}>לקוחות ({data.clients.length})</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 14 }}>
              {data.clients.map((c) => {
                const st = STATUS[c.status];
                return (
                  <button key={c.id} onClick={() => onOpenClient(c.id, c.name)} style={{
                    textAlign: 'right', cursor: 'pointer', background: 'var(--surface-raised,#fff)', borderRadius: 18,
                    padding: '1.25rem 1.35rem', border: '1px solid var(--border,#eef1f5)', boxShadow: '0 1px 3px rgba(15,23,42,0.04)',
                    transition: 'transform 150ms ease, box-shadow 150ms ease', position: 'relative',
                  }}
                    onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = '0 10px 28px rgba(15,23,42,0.10)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '0 1px 3px rgba(15,23,42,0.04)'; }}
                  >
                    {/* header */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, marginBottom: 14 }}>
                      <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--foreground,#0f172a)', lineHeight: 1.3, minWidth: 0 }}>{c.name}</div>
                      <span style={{ fontSize: 11, fontWeight: 700, color: st.color, background: st.bg, padding: '3px 10px', borderRadius: 999, whiteSpace: 'nowrap' }}>{st.label}</span>
                    </div>

                    {/* health bar */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                      <div style={{ flex: 1, height: 6, borderRadius: 999, background: '#eef1f5', overflow: 'hidden' }}>
                        <div style={{ width: `${Math.max(4, c.health)}%`, height: '100%', background: st.color, borderRadius: 999 }} />
                      </div>
                      <span style={{ fontSize: 12, fontWeight: 700, color: st.color }}>{c.health}</span>
                    </div>

                    {/* metrics 2x2 */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                      {[
                        { l: 'לידים', v: fmt(c.leads), t: c.trend.leads, good: true },
                        { l: 'CPL', v: `₪${fmt(c.cpl, 1)}`, t: c.trend.cpl, good: false },
                        { l: 'CTR', v: `${fmt(c.ctr, 2)}%`, t: c.trend.ctr, good: true },
                        { l: 'הוצאה', v: `₪${fmt(c.spend)}`, t: c.trend.spend, good: true },
                      ].map((m) => (
                        <div key={m.l}>
                          <div style={{ fontSize: 11, color: '#9ca3af' }}>{m.l}</div>
                          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                            <span style={{ fontSize: 16, fontWeight: 800, color: 'var(--foreground,#0f172a)' }}>{m.v}</span>
                            <TrendChip pct={m.t} goodWhenUp={m.good} />
                          </div>
                        </div>
                      ))}
                    </div>

                    {c.stale && (
                      <div style={{ fontSize: 10.5, color: '#9ca3af', marginTop: 12 }}>
                        אין דוח לטווח הנבחר — מוצג הדוח האחרון{c.lastDate ? ` (${c.lastDate})` : ''}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
