'use client';

import { useState, useEffect, useCallback } from 'react';

const BRAND = '#00B5FE';

interface CampaignSummary {
  id: string;
  metaCampaignId: string;
  name: string;
  status: string;
  objective: string;
  budget: number;
  spend: number;
  leads: number;
  cpl: number;
  ctr: number;
  impressions: number;
  clicks: number;
  adSetsCount: number;
  adsCount: number;
  lastSyncedAt: string | null;
}

interface Totals {
  spend: number;
  leads: number;
  impressions: number;
  clicks: number;
  cpl: number;
  ctr: number;
  count: number;
}

const fmt = (n: number, d = 0) =>
  (n || 0).toLocaleString('he-IL', { minimumFractionDigits: d, maximumFractionDigits: d });

const isActive = (s: string) => /active|in_progress/i.test(s);

function statusBadge(status: string): React.CSSProperties {
  const active = isActive(status);
  return {
    display: 'inline-block',
    padding: '2px 10px',
    borderRadius: 9999,
    fontSize: 12,
    fontWeight: 600,
    background: active ? 'rgba(34,197,94,0.15)' : 'rgba(107,114,128,0.15)',
    color: active ? '#16a34a' : '#6b7280',
  };
}

const cellStyle: React.CSSProperties = { padding: '10px 12px', fontSize: 13, borderBottom: '1px solid var(--border, #e5e7eb)', verticalAlign: 'middle' };
const thStyle: React.CSSProperties = { ...cellStyle, textAlign: 'right', color: '#6b7280', fontWeight: 600, fontSize: 12, background: '#f0f9ff' };

export default function CampaignDashboard({ clientId, clientName }: { clientId: string; clientName?: string }) {
  const [campaigns, setCampaigns] = useState<CampaignSummary[]>([]);
  const [totals, setTotals] = useState<Totals | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/meta-business/campaigns?clientId=${encodeURIComponent(clientId)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'שגיאה בטעינת קמפיינים');
      setCampaigns(data.campaigns || []);
      setTotals(data.totals || null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'שגיאה לא צפויה');
    } finally {
      setLoading(false);
    }
  }, [clientId]);

  useEffect(() => { if (clientId) load(); }, [clientId, load]);

  const manage = async (c: CampaignSummary, payload: Record<string, unknown>, successMsg: string) => {
    setBusyId(c.id);
    setNotice(null);
    try {
      const res = await fetch(`/api/meta-business/campaigns/${encodeURIComponent(c.metaCampaignId)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId, ...payload }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'הפעולה נכשלה');
      setNotice(successMsg);
      await load();
    } catch (e) {
      setNotice(e instanceof Error ? e.message : 'הפעולה נכשלה');
    } finally {
      setBusyId(null);
    }
  };

  const toggleStatus = (c: CampaignSummary) =>
    manage(c, { status: isActive(c.status) ? 'PAUSED' : 'ACTIVE' },
      isActive(c.status) ? 'הקמפיין הושהה' : 'הקמפיין הופעל');

  const editBudget = (c: CampaignSummary) => {
    const input = window.prompt(`תקציב יומי חדש לקמפיין "${c.name}" (₪):`, String(Math.round(c.budget || 0)));
    if (input == null) return;
    const shekels = parseFloat(input);
    if (isNaN(shekels) || shekels <= 0) { setNotice('סכום לא תקין'); return; }
    manage(c, { dailyBudget: Math.round(shekels * 100) }, `התקציב עודכן ל-₪${fmt(shekels)}`);
  };

  if (loading) return <div style={{ padding: 24, color: '#6b7280' }}>טוען קמפיינים...</div>;

  if (error) {
    return (
      <div style={{ padding: 20, background: 'rgba(239,68,68,0.08)', borderRadius: 8, color: '#ef4444' }}>
        {error}
        <button onClick={load} style={{ marginInlineStart: 12, color: BRAND, background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}>נסה שוב</button>
      </div>
    );
  }

  if (campaigns.length === 0) {
    return (
      <div style={{ padding: 24, textAlign: 'center', color: '#6b7280' }}>
        לא נמצאו קמפיינים מסונכרנים עבור {clientName || 'הלקוח'}.<br />
        ודא שהלקוח מחובר ל-Meta והרץ סנכרון.
      </div>
    );
  }

  return (
    <div dir="rtl">
      {notice && (
        <div style={{ marginBottom: 12, padding: '8px 12px', borderRadius: 8, background: 'rgba(0,181,254,0.1)', color: BRAND, fontSize: 13 }}>
          {notice}
        </div>
      )}

      {/* Totals */}
      {totals && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 10, marginBottom: 16 }}>
          {[
            { label: 'קמפיינים', value: fmt(totals.count) },
            { label: 'הוצאה', value: `₪${fmt(totals.spend)}` },
            { label: 'לידים', value: fmt(totals.leads) },
            { label: 'CPL ממוצע', value: `₪${fmt(totals.cpl, 1)}` },
            { label: 'CTR ממוצע', value: `${fmt(totals.ctr, 2)}%` },
          ].map((m) => (
            <div key={m.label} style={{ background: '#f8fafc', border: '1px solid #e5e7eb', borderRadius: 8, padding: 12, textAlign: 'center' }}>
              <div style={{ fontSize: 20, fontWeight: 800, color: BRAND }}>{m.value}</div>
              <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>{m.label}</div>
            </div>
          ))}
        </div>
      )}

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={thStyle}>קמפיין</th>
              <th style={thStyle}>סטטוס</th>
              <th style={thStyle}>תקציב יומי</th>
              <th style={thStyle}>הוצאה</th>
              <th style={thStyle}>לידים</th>
              <th style={thStyle}>CPL</th>
              <th style={thStyle}>CTR</th>
              <th style={thStyle}>Ad Sets / מודעות</th>
              <th style={thStyle}>פעולות</th>
            </tr>
          </thead>
          <tbody>
            {campaigns.map((c) => (
              <tr key={c.id}>
                <td style={{ ...cellStyle, fontWeight: 600, maxWidth: 240 }}>
                  {c.name}
                  {c.objective && <div style={{ fontSize: 11, color: '#9ca3af', fontWeight: 400 }}>{c.objective}</div>}
                </td>
                <td style={cellStyle}><span style={statusBadge(c.status)}>{isActive(c.status) ? 'פעיל' : 'מושהה'}</span></td>
                <td style={cellStyle}>{c.budget ? `₪${fmt(c.budget)}` : '—'}</td>
                <td style={cellStyle}>₪{fmt(c.spend)}</td>
                <td style={cellStyle}>{fmt(c.leads)}</td>
                <td style={{ ...cellStyle, fontWeight: 600 }}>{c.leads > 0 ? `₪${fmt(c.cpl, 1)}` : '—'}</td>
                <td style={cellStyle}>{fmt(c.ctr, 2)}%</td>
                <td style={cellStyle}>{c.adSetsCount} / {c.adsCount}</td>
                <td style={cellStyle}>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button
                      onClick={() => toggleStatus(c)}
                      disabled={busyId === c.id}
                      style={{
                        padding: '4px 10px', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                        border: '1px solid', borderColor: isActive(c.status) ? '#ef4444' : '#22c55e',
                        color: isActive(c.status) ? '#ef4444' : '#16a34a', background: 'transparent',
                        opacity: busyId === c.id ? 0.5 : 1,
                      }}
                    >
                      {isActive(c.status) ? 'השהה' : 'הפעל'}
                    </button>
                    <button
                      onClick={() => editBudget(c)}
                      disabled={busyId === c.id}
                      style={{
                        padding: '4px 10px', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                        border: `1px solid ${BRAND}`, color: BRAND, background: 'transparent',
                        opacity: busyId === c.id ? 0.5 : 1,
                      }}
                    >
                      תקציב
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <button onClick={load} style={{ marginTop: 14, padding: '8px 16px', borderRadius: 8, border: '1px solid #e5e7eb', background: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
        רענן נתונים
      </button>
    </div>
  );
}
