'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';

const BRAND = '#00B5FE';
const fmt = (n: number, d = 0) => (n || 0).toLocaleString('he-IL', { minimumFractionDigits: d, maximumFractionDigits: d });
const isActive = (s: string) => /active|in_progress/i.test(s || '');

/**
 * Client-facing, READ-ONLY view of the client's Meta campaign performance.
 * No management controls — clients only see results.
 */
export default function CampaignsContent() {
  const params = useSearchParams();
  const clientId = params.get('clientId') || '';
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [totals, setTotals] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!clientId) { setLoading(false); return; }
    (async () => {
      try {
        const res = await fetch(`/api/meta-business/campaigns?clientId=${encodeURIComponent(clientId)}`);
        const data = await res.json();
        setCampaigns(data.campaigns || []);
        setTotals(data.totals || null);
      } catch { /* ignore */ } finally { setLoading(false); }
    })();
  }, [clientId]);

  const cell: React.CSSProperties = { padding: '10px 12px', fontSize: 13, borderBottom: '1px solid #e5e7eb' };
  const th: React.CSSProperties = { ...cell, textAlign: 'right', color: '#6b7280', fontWeight: 600, fontSize: 12, background: '#f0f9ff' };

  return (
    <div dir="rtl" style={{ maxWidth: 980, margin: '0 auto', padding: '2rem 1.25rem 4rem' }}>
      <h1 style={{ fontSize: 22, fontWeight: 800, marginBottom: 6 }}>ביצועי הקמפיינים שלך</h1>
      <p style={{ color: '#6b7280', fontSize: 14, marginBottom: 20 }}>נתוני הפרסום הממומן ב-Meta, מתעדכנים אוטומטית.</p>

      {loading ? (
        <div style={{ color: '#6b7280' }}>טוען...</div>
      ) : campaigns.length === 0 ? (
        <div style={{ color: '#6b7280', padding: 16 }}>אין כרגע נתוני קמפיינים להצגה.</div>
      ) : (
        <>
          {totals && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(120px,1fr))', gap: 10, marginBottom: 18 }}>
              {[
                { label: 'קמפיינים', value: fmt(totals.count) },
                { label: 'הוצאה', value: `₪${fmt(totals.spend)}` },
                { label: 'לידים', value: fmt(totals.leads) },
                { label: 'עלות לליד', value: `₪${fmt(totals.cpl, 1)}` },
              ].map((m) => (
                <div key={m.label} style={{ background: '#f8fafc', border: '1px solid #e5e7eb', borderRadius: 8, padding: 12, textAlign: 'center' }}>
                  <div style={{ fontSize: 20, fontWeight: 800, color: BRAND }}>{m.value}</div>
                  <div style={{ fontSize: 11, color: '#6b7280' }}>{m.label}</div>
                </div>
              ))}
            </div>
          )}
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><th style={th}>קמפיין</th><th style={th}>סטטוס</th><th style={th}>הוצאה</th><th style={th}>לידים</th><th style={th}>עלות לליד</th></tr></thead>
              <tbody>
                {campaigns.map((c) => (
                  <tr key={c.id}>
                    <td style={{ ...cell, fontWeight: 600 }}>{c.name}</td>
                    <td style={cell}><span style={{ color: isActive(c.status) ? '#16a34a' : '#6b7280' }}>{isActive(c.status) ? 'פעיל' : 'מושהה'}</span></td>
                    <td style={cell}>₪{fmt(c.spend)}</td>
                    <td style={cell}>{fmt(c.leads)}</td>
                    <td style={{ ...cell, fontWeight: 600 }}>{c.leads > 0 ? `₪${fmt(c.cpl, 1)}` : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
