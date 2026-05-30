'use client';

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

const BRAND = '#00B5FE';
const GOOD = '#22c55e';
const WARN = '#f97316';
const BAD = '#ef4444';

const cplColor = (cpl: number, avg: number) => {
  if (!avg || !cpl) return BRAND;
  if (cpl <= avg * 0.85) return GOOD;
  if (cpl >= avg * 1.15) return BAD;
  return WARN;
};

interface Row { name: string; leads: number; cpl: number; spend: number }

/**
 * Visual comparison of ad sets within a campaign: leads (bar) and CPL (bar,
 * color-coded vs. the campaign average). Pure visual, no controls.
 */
export default function CampaignCharts({ rows }: { rows: Row[] }) {
  const withData = rows.filter((r) => r.leads > 0 || r.spend > 0);
  if (withData.length === 0) {
    return <div style={{ fontSize: 12, color: '#9ca3af', padding: '8px 0' }}>אין מספיק נתונים לגרף (אין הוצאה/לידים בטווח שנבחר).</div>;
  }

  const totalSpend = withData.reduce((s, r) => s + r.spend, 0);
  const totalLeads = withData.reduce((s, r) => s + r.leads, 0);
  const avgCpl = totalLeads > 0 ? totalSpend / totalLeads : 0;

  const short = (n: string) => (n.length > 16 ? n.slice(0, 15) + '…' : n);
  const data = withData.map((r) => ({ name: short(r.name), leads: r.leads, cpl: Math.round(r.cpl) }));

  const tip = { background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 12 } as React.CSSProperties;

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))', gap: 16, padding: '8px 0' }}>
      <div>
        <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 4 }}>לידים לפי Ad Set</div>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={data} margin={{ top: 6, right: 6, left: -20, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#eef0f3" />
            <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#6b7280' }} interval={0} />
            <YAxis tick={{ fontSize: 10, fill: '#6b7280' }} allowDecimals={false} />
            <Tooltip contentStyle={tip} />
            <Bar dataKey="leads" name="לידים" fill={BRAND} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div>
        <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 4 }}>
          עלות לליד (CPL) · ממוצע ₪{Math.round(avgCpl)}
        </div>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={data} margin={{ top: 6, right: 6, left: -20, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#eef0f3" />
            <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#6b7280' }} interval={0} />
            <YAxis tick={{ fontSize: 10, fill: '#6b7280' }} />
            <Tooltip contentStyle={tip} formatter={(v: number) => [`₪${v}`, 'CPL']} />
            <Bar dataKey="cpl" name="CPL" radius={[4, 4, 0, 0]}>
              {data.map((d, i) => <Cell key={i} fill={cplColor(d.cpl, avgCpl)} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
