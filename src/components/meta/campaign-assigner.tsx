'use client';

import { useState, useEffect, useCallback } from 'react';

const BRAND = '#00B5FE';

interface ClientOption { id: string; name: string; }
interface AdAccount { id: string; name: string; businessName?: string; }
interface AccountCampaign {
  metaCampaignId: string;
  name: string;
  status: string;
  objective: string;
  assignedClientId: string | null;
  assignedClientName: string | null;
}

const isActive = (s: string) => /active/i.test(s);

/**
 * Assign individual campaigns (inside one ad account) to different clients.
 * Lets a shared ad account serve multiple clients — each campaign → one client.
 */
export default function CampaignAssigner({ clients }: { clients: ClientOption[] }) {
  const [accounts, setAccounts] = useState<AdAccount[]>([]);
  const [accountId, setAccountId] = useState('');
  const [campaigns, setCampaigns] = useState<AccountCampaign[]>([]);
  const [loadingAccts, setLoadingAccts] = useState(true);
  const [loadingCamps, setLoadingCamps] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [picks, setPicks] = useState<Record<string, string>>({}); // metaCampaignId → clientId being chosen

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/meta-business/accounts');
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'שגיאה בטעינת חשבונות');
        setAccounts(data.accounts || []);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'שגיאה');
      } finally {
        setLoadingAccts(false);
      }
    })();
  }, []);

  const loadCampaigns = useCallback(async (acctId: string) => {
    if (!acctId) return;
    setLoadingCamps(true);
    setError(null);
    try {
      const res = await fetch(`/api/meta-business/account-campaigns?adAccountId=${encodeURIComponent(acctId)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'שגיאה בטעינת קמפיינים');
      setCampaigns(data.campaigns || []);
      const initialPicks: Record<string, string> = {};
      for (const c of data.campaigns || []) if (c.assignedClientId) initialPicks[c.metaCampaignId] = c.assignedClientId;
      setPicks(initialPicks);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'שגיאה');
      setCampaigns([]);
    } finally {
      setLoadingCamps(false);
    }
  }, []);

  const assign = async (c: AccountCampaign, clientId: string) => {
    setBusyId(c.metaCampaignId);
    try {
      const client = clients.find((cl) => cl.id === clientId);
      const res = await fetch('/api/meta-business/assign-campaign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          metaCampaignId: c.metaCampaignId,
          adAccountId: accountId,
          campaignName: c.name,
          clientId: clientId || null,
          clientName: client?.name || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'הפעולה נכשלה');
      setCampaigns((prev) => prev.map((x) => x.metaCampaignId === c.metaCampaignId
        ? { ...x, assignedClientId: clientId || null, assignedClientName: client?.name || null }
        : x));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'הפעולה נכשלה');
    } finally {
      setBusyId(null);
    }
  };

  const selectStyle: React.CSSProperties = { padding: '6px 10px', borderRadius: 6, border: '1px solid var(--border, #e5e7eb)', fontSize: 13, background: '#fff', minWidth: 160 };

  return (
    <div dir="rtl">
      <div style={{ marginBottom: 16 }}>
        <label style={{ fontSize: 13, fontWeight: 600, marginInlineEnd: 10 }}>בחר חשבון מודעות:</label>
        {loadingAccts ? (
          <span style={{ color: '#6b7280', fontSize: 13 }}>טוען חשבונות...</span>
        ) : (
          <select value={accountId} onChange={(e) => { setAccountId(e.target.value); loadCampaigns(e.target.value); }} style={{ ...selectStyle, minWidth: 280 }}>
            <option value="">— בחר —</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>{a.name}{a.businessName ? ` · ${a.businessName}` : ''}</option>
            ))}
          </select>
        )}
      </div>

      {error && (
        <div style={{ marginBottom: 12, padding: '8px 12px', borderRadius: 8, background: 'rgba(239,68,68,0.08)', color: '#ef4444', fontSize: 13 }}>{error}</div>
      )}

      {loadingCamps && <div style={{ color: '#6b7280' }}>טוען קמפיינים...</div>}

      {!loadingCamps && accountId && campaigns.length === 0 && !error && (
        <div style={{ color: '#6b7280', padding: 16 }}>לא נמצאו קמפיינים בחשבון זה.</div>
      )}

      {campaigns.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {campaigns.map((c) => (
            <div key={c.metaCampaignId} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', borderRadius: 8, border: '1px solid var(--border, #e5e7eb)', background: c.assignedClientId ? `${BRAND}06` : '#fff', flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: 200 }}>
                <div style={{ fontWeight: 600, fontSize: 13.5 }}>{c.name}</div>
                <div style={{ fontSize: 11.5, color: '#6b7280' }}>
                  <span style={{ color: isActive(c.status) ? '#16a34a' : '#6b7280' }}>{isActive(c.status) ? 'פעיל' : c.status}</span>
                  {c.objective ? ` · ${c.objective}` : ''}
                  {c.assignedClientName ? ` · משויך ל: ${c.assignedClientName}` : ''}
                </div>
              </div>
              <select
                value={picks[c.metaCampaignId] ?? c.assignedClientId ?? ''}
                onChange={(e) => setPicks((p) => ({ ...p, [c.metaCampaignId]: e.target.value }))}
                style={selectStyle}
              >
                <option value="">— ללא שיוך —</option>
                {clients.map((cl) => <option key={cl.id} value={cl.id}>{cl.name}</option>)}
              </select>
              <button
                onClick={() => assign(c, picks[c.metaCampaignId] ?? c.assignedClientId ?? '')}
                disabled={busyId === c.metaCampaignId}
                style={{ padding: '6px 14px', borderRadius: 6, border: 'none', background: BRAND, color: '#fff', fontWeight: 600, fontSize: 13, cursor: 'pointer', opacity: busyId === c.metaCampaignId ? 0.6 : 1 }}
              >
                שייך
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
