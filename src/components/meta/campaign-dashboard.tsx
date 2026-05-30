'use client';

import { useState, useEffect, useCallback, Fragment } from 'react';

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
  const [connectionStatus, setConnectionStatus] = useState<string>("connected");
  const [totals, setTotals] = useState<Totals | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [action, setAction] = useState<string | null>(null); // 'sync' | 'optimize' | 'create'
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: '', objective: 'OUTCOME_LEADS', dailyBudget: '' });
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<Record<string, { adSets: any[]; ads: any[] }>>({});
  const [detailLoading, setDetailLoading] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/meta-business/campaigns?clientId=${encodeURIComponent(clientId)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'שגיאה בטעינת קמפיינים');
      setCampaigns(data.campaigns || []);
      setConnectionStatus(data.connectionStatus || "connected");
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

  const runAction = async (kind: string, url: string, payload: Record<string, unknown>, okMsg: string) => {
    setAction(kind);
    setNotice(null);
    try {
      const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const data = await res.json();
      if (!res.ok || data.success === false) throw new Error(data.error || 'הפעולה נכשלה');
      setNotice(okMsg);
      await load();
    } catch (e) {
      setNotice(e instanceof Error ? e.message : 'הפעולה נכשלה');
    } finally {
      setAction(null);
    }
  };

  const doSync = () => runAction('sync', '/api/meta-business/sync', { clientId }, 'הסנכרון הושלם — הנתונים עודכנו');
  const doOptimize = () => runAction('optimize', '/api/meta-business/daily-optimize', { clientId, allowCreate: true }, 'האופטימיזציה רצה (כולל יצירה)');
  const doCreate = () => {
    if (!form.name.trim()) { setNotice('יש להזין שם קמפיין'); return; }
    runAction('create', '/api/meta-business/create-campaign', {
      clientId, name: form.name.trim(), objective: form.objective,
      dailyBudget: form.dailyBudget ? parseFloat(form.dailyBudget) : undefined,
    }, 'הקמפיין נוצר (מושהה) — בנה לו Ad Set ומודעה כדי להפעיל').then(() => {
      setShowCreate(false);
      setForm({ name: '', objective: 'OUTCOME_LEADS', dailyBudget: '' });
    });
  };

  const toggleDetail = async (c: CampaignSummary) => {
    if (expandedId === c.id) { setExpandedId(null); return; }
    setExpandedId(c.id);
    if (!detail[c.id]) {
      setDetailLoading(c.id);
      try {
        const res = await fetch(`/api/meta-business/campaign-detail?campaignId=${encodeURIComponent(c.id)}`);
        const data = await res.json();
        if (res.ok) setDetail((prev) => ({ ...prev, [c.id]: { adSets: data.adSets || [], ads: data.ads || [] } }));
      } catch { /* ignore */ } finally { setDetailLoading(null); }
    }
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
    if (connectionStatus === 'token_expired') {
      return (
        <div style={{ padding: 20, background: 'rgba(239,68,68,0.08)', borderRadius: 8, color: '#ef4444', textAlign: 'center' }}>
          <strong>אסימון ה-Meta של {clientName || 'הלקוח'} פג תוקף.</strong><br />
          יש לחבר מחדש את החשבון (הדבק System User Token חדש בהגדרות Meta Business).
        </div>
      );
    }
    if (connectionStatus === 'not_connected') {
      return (
        <div style={{ padding: 24, textAlign: 'center', color: '#6b7280' }}>
          {clientName || 'הלקוח'} אינו מחובר ל-Meta.<br />
          חבר את חשבון המודעות שלו ושייך אותו ללקוח כדי לראות קמפיינים.
        </div>
      );
    }
    return (
      <div style={{ padding: 24, textAlign: 'center', color: '#6b7280' }}>
        לא נמצאו קמפיינים מסונכרנים עבור {clientName || 'הלקוח'}.<br />
        החשבון מחובר — לחץ &quot;סנכרן עכשיו&quot; כדי למשוך את הקמפיינים מ-Meta.
        <div style={{ marginTop: 14 }}>
          <button onClick={doSync} disabled={!!action} style={{ padding: '8px 18px', borderRadius: 8, border: 'none', background: BRAND, color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer', opacity: action ? 0.6 : 1 }}>
            {action === 'sync' ? 'מסנכרן...' : '🔄 סנכרן עכשיו'}
          </button>
        </div>
        {notice && <div style={{ marginTop: 10, fontSize: 13, color: BRAND }}>{notice}</div>}
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

      {connectionStatus === 'token_expired' && (
        <div style={{ marginBottom: 12, padding: '8px 12px', borderRadius: 8, background: 'rgba(239,68,68,0.1)', color: '#ef4444', fontSize: 13, fontWeight: 600 }}>
          ⚠️ אסימון ה-Meta פג תוקף — חבר מחדש בהגדרות כדי שהפעולות ימשיכו לעבוד.
        </div>
      )}

      {/* Toolbar */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
        <button onClick={doSync} disabled={!!action} style={{ padding: '7px 14px', borderRadius: 8, border: `1px solid ${BRAND}`, background: '#fff', color: BRAND, fontWeight: 600, fontSize: 13, cursor: 'pointer', opacity: action ? 0.6 : 1 }}>
          {action === 'sync' ? 'מסנכרן...' : '🔄 סנכרן עכשיו'}
        </button>
        <button onClick={doOptimize} disabled={!!action} style={{ padding: '7px 14px', borderRadius: 8, border: '1px solid #22c55e', background: '#fff', color: '#16a34a', fontWeight: 600, fontSize: 13, cursor: 'pointer', opacity: action ? 0.6 : 1 }}>
          {action === 'optimize' ? 'מריץ...' : '⚡ הרץ אופטימיזציה + יצירה'}
        </button>
        <button onClick={() => setShowCreate((s) => !s)} disabled={!!action} style={{ padding: '7px 14px', borderRadius: 8, border: '1px solid var(--border, #e5e7eb)', background: '#fff', color: 'var(--foreground, #1a1a2e)', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
          ➕ צור קמפיין
        </button>
      </div>

      {/* Create campaign form */}
      {showCreate && (
        <div style={{ marginBottom: 16, padding: 14, borderRadius: 8, border: '1px solid var(--border, #e5e7eb)', background: '#f8fafc', display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'end' }}>
          <div>
            <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 3 }}>שם הקמפיין</div>
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="שם..." style={{ padding: '7px 10px', borderRadius: 6, border: '1px solid #e5e7eb', fontSize: 13, minWidth: 200 }} />
          </div>
          <div>
            <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 3 }}>מטרה</div>
            <select value={form.objective} onChange={(e) => setForm({ ...form, objective: e.target.value })} style={{ padding: '7px 10px', borderRadius: 6, border: '1px solid #e5e7eb', fontSize: 13 }}>
              <option value="OUTCOME_LEADS">לידים</option>
              <option value="OUTCOME_TRAFFIC">תנועה</option>
              <option value="OUTCOME_SALES">מכירות</option>
              <option value="OUTCOME_ENGAGEMENT">מעורבות</option>
              <option value="OUTCOME_AWARENESS">מודעות</option>
            </select>
          </div>
          <div>
            <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 3 }}>תקציב יומי (₪)</div>
            <input value={form.dailyBudget} onChange={(e) => setForm({ ...form, dailyBudget: e.target.value })} placeholder="לדוגמה 100" type="number" style={{ padding: '7px 10px', borderRadius: 6, border: '1px solid #e5e7eb', fontSize: 13, width: 120 }} />
          </div>
          <button onClick={doCreate} disabled={action === 'create'} style={{ padding: '8px 16px', borderRadius: 6, border: 'none', background: BRAND, color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer', opacity: action === 'create' ? 0.6 : 1 }}>
            {action === 'create' ? 'יוצר...' : 'צור (מושהה)'}
          </button>
          <div style={{ fontSize: 11, color: '#6b7280', width: '100%' }}>הקמפיין ייווצר במצב מושהה. כדי להפעילו צריך להוסיף לו Ad Set ומודעה.</div>
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
              <Fragment key={c.id}>
              <tr>
                <td style={{ ...cellStyle, fontWeight: 600, maxWidth: 240, cursor: 'pointer' }} onClick={() => toggleDetail(c)}>
                  <span style={{ color: BRAND, marginInlineEnd: 4 }}>{expandedId === c.id ? '▾' : '▸'}</span>
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
              {expandedId === c.id && (
                <tr>
                  <td colSpan={9} style={{ padding: '0 12px 12px', background: '#f8fafc' }}>
                    {detailLoading === c.id ? (
                      <div style={{ padding: 12, color: '#6b7280', fontSize: 12 }}>טוען פירוט...</div>
                    ) : !detail[c.id] || (detail[c.id].adSets.length === 0 && detail[c.id].ads.length === 0) ? (
                      <div style={{ padding: 12, color: '#6b7280', fontSize: 12 }}>אין נתוני Ad Sets/מודעות מסונכרנים — הרץ סנכרון.</div>
                    ) : (
                      <div style={{ padding: '10px 4px', fontSize: 12 }}>
                        <div style={{ fontWeight: 700, margin: '4px 0' }}>Ad Sets ({detail[c.id].adSets.length})</div>
                        {detail[c.id].adSets.map((s) => (
                          <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 8px', borderBottom: '1px solid #eef0f3' }}>
                            <span>{isActive(s.status) ? '🟢' : '⚪'} {s.name}</span>
                            <span style={{ color: '#6b7280' }}>₪{fmt(s.spend)} · {fmt(s.leads)} לידים · CPL ₪{fmt(s.cpl, 1)} · {s.adsCount} מודעות</span>
                          </div>
                        ))}
                        <div style={{ fontWeight: 700, margin: '10px 0 4px' }}>מודעות ({detail[c.id].ads.length})</div>
                        {detail[c.id].ads.map((a) => (
                          <div key={a.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 8px', borderBottom: '1px solid #eef0f3' }}>
                            <span>{isActive(a.status) ? '🟢' : '⚪'} {a.name}</span>
                            <span style={{ color: '#6b7280' }}>₪{fmt(a.spend)} · {fmt(a.leads)} לידים · CTR {fmt(a.ctr, 2)}%</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </td>
                </tr>
              )}
              </Fragment>
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
