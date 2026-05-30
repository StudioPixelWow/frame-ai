'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect } from 'react';
import CampaignDashboard from '@/components/meta/campaign-dashboard';

const BRAND = '#00B5FE';

interface ClientOption {
  id: string;
  name: string;
  metaConnected: boolean;
}

function getRoleHeaders(): Record<string, string> {
  if (typeof window === 'undefined') return {};
  const role = localStorage.getItem('app_role') || 'admin';
  return { 'x-app-role': role };
}

export default function MetaCampaignsPage() {
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [selected, setSelected] = useState<string>('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/data/clients', { headers: getRoleHeaders() });
        const data = await res.json();
        const list = Array.isArray(data) ? data : data.clients || [];
        const mapped: ClientOption[] = list.map((c: any) => ({
          id: c.id,
          name: c.name || c.company || c.id,
          metaConnected:
            (c.metaConnectionStatus === 'connected' || c.meta_connection_status === 'connected') &&
            Boolean(c.metaAdAccountId || c.meta_ad_account_id),
        }));
        // Connected clients first
        mapped.sort((a, b) => Number(b.metaConnected) - Number(a.metaConnected));
        setClients(mapped);
        const firstConnected = mapped.find((c) => c.metaConnected) || mapped[0];
        if (firstConnected) setSelected(firstConnected.id);
      } catch {
        setClients([]);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const selectedClient = clients.find((c) => c.id === selected);

  return (
    <div dir="rtl" style={{ maxWidth: 1100, margin: '0 auto', padding: '2rem 1.5rem 4rem', color: 'var(--foreground, #1a1a2e)' }}>
      <h1 style={{ fontSize: 24, fontWeight: 800, marginBottom: 6 }}>קמפיינים — Meta Ads</h1>
      <p style={{ color: '#6b7280', fontSize: 14, marginBottom: 24 }}>
        ניהול ובקרה של הקמפיינים הסרוקים מתוך Meta Business Manager — השהיה, הפעלה, ועדכון תקציב.
      </p>

      {loading ? (
        <div style={{ color: '#6b7280' }}>טוען לקוחות...</div>
      ) : clients.length === 0 ? (
        <div style={{ color: '#6b7280' }}>לא נמצאו לקוחות.</div>
      ) : (
        <>
          <div style={{ marginBottom: 20 }}>
            <label style={{ fontSize: 13, fontWeight: 600, marginInlineEnd: 10 }}>בחר לקוח:</label>
            <select
              value={selected}
              onChange={(e) => setSelected(e.target.value)}
              style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 14, minWidth: 240, background: '#fff' }}
            >
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}{c.metaConnected ? ' ✓' : ' (לא מחובר)'}
                </option>
              ))}
            </select>
          </div>

          {selected && (
            <div style={{ background: 'var(--surface, #fff)', border: '1px solid var(--border, #e5e7eb)', borderRadius: 12, padding: 20 }}>
              <CampaignDashboard clientId={selected} clientName={selectedClient?.name} />
            </div>
          )}
        </>
      )}
    </div>
  );
}
