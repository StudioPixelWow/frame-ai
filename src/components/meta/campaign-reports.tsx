'use client';

import { useState, useEffect, useCallback } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const BRAND = '#00B5FE';

const fmt = (n: number, d = 0) => (n || 0).toLocaleString('he-IL', { minimumFractionDigits: d, maximumFractionDigits: d });

/**
 * Daily-report history + trend chart for a client (spend / leads / CPL over time),
 * latest health score, and recent optimizer actions.
 */
export default function CampaignReports({ clientId }: { clientId: string }) {
  const [reports, setReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/meta-business/daily-reports?clientId=${encodeURIComponent(clientId)}`);
      const data = await res.json();
      setReports(Array.isArray(data) ? data : []);
    } catch {
      setReports([]);
    } finally {
      setLoading(false);
    }
  }, [clientId]);

  useEffect(() => { if (clientId) load(); }, [clientId, load]);

  if (loading) return <div style={{ color: '#6b7280', padding: 16 }}>טוען דוחות...</div>;
  if (reports.length === 0) return <div style={{ color: '#6b7280', padding: 16 }}>אין עדיין דוחות יומיים — הם נוצרים בכל הרצת אופטימייזר.</div>;

  // newest-first → chronological for the chart
  const chrono = [...reports].reverse();
  const chartData = chrono.map((r) => ({
    date: (r.date || '').slice(5),
    הוצאה: Math.round(r.summary?.totalSpend || 0),
    לידים: r.summary?.totalLeads || 0,
    CPL: Math.round(r.summary?.avgCpl || 0),
  }));
  const latest = reports[0];

  const tooltipStyle = { background: 'var(--surface,#fff)', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 12 };

  return (
    <div dir="rtl">
      {/* Latest summary */}
      {latest?.summary && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(120px,1fr))', gap: 10, marginBottom: 16 }}>
          {[
            { label: 'בריאות', value: `${latest.summary.healthScore ?? '—'}` },
            { label: 'הוצאה', value: `₪${fmt(latest.summary.totalSpend)}` },
            { label: 'לידים', value: fmt(latest.summary.totalLeads) },
            { label: 'CPL', value: `₪${fmt(latest.summary.avgCpl, 1)}` },
            { label: 'מגמה', value: latest.summary.cplTrend === 'improving' ? 'משתפר' : latest.summary.cplTrend === 'worsening' ? 'מחמיר' : 'יציב' },
          ].map((m) => (
            <div key={m.label} style={{ background: '#f8fafc', border: '1px solid #e5e7eb', borderRadius: 8, padding: 12, textAlign: 'center' }}>
              <div style={{ fontSize: 19, fontWeight: 800, color: BRAND }}>{m.value}</div>
              <div style={{ fontSize: 11, color: '#6b7280' }}>{m.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Trend chart */}
      <div style={{ fontWeight: 700, marginBottom: 8, fontSize: 14 }}>מגמת ביצועים</div>
      <ResponsiveContainer width="100%" height={260}>
        <LineChart data={chartData} margin={{ top: 8, right: 12, left: -16, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#6b7280' }} />
          <YAxis tick={{ fontSize: 11, fill: '#6b7280' }} />
          <Tooltip contentStyle={tooltipStyle} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Line type="monotone" dataKey="CPL" stroke="#ef4444" strokeWidth={2} dot={false} />
          <Line type="monotone" dataKey="לידים" stroke="#22c55e" strokeWidth={2} dot={false} />
          <Line type="monotone" dataKey="הוצאה" stroke={BRAND} strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>

      {/* Recent actions */}
      {latest?.actions?.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <div style={{ fontWeight: 700, marginBottom: 6, fontSize: 14 }}>פעולות אחרונות ({latest.date})</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {latest.actions.slice(0, 12).map((a: any, i: number) => (
              <div key={i} style={{ fontSize: 12.5, color: a.success ? '#16a34a' : '#6b7280', padding: '3px 0', borderBottom: '1px solid #f0f0f0' }}>
                {a.success ? '✅' : '•'} {a.description}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
