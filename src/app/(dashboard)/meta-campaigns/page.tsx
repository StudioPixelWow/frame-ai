'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect } from 'react';
import CampaignDashboard from '@/components/meta/campaign-dashboard';
import CampaignAssigner from '@/components/meta/campaign-assigner';
import CampaignReports from '@/components/meta/campaign-reports';
import MetaCommandCenter from '@/components/meta/meta-command-center';

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
  const [tab, setTab] = useState<'dashboard' | 'assign' | 'reports'>('dashboard');
  // Command-center drill-in: null = overview, else the client whose live dashboard is open.
  const [drill, setDrill] = useState<{ id: string; name: string } | null>(null);

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

  return (
    <div dir="rtl" style={{ maxWidth: 1320, margin: '0 auto', padding: '2rem 1.75rem 4rem', color: 'var(--foreground, #1a1a2e)' }}>
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
          {/* Tabs */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 24, borderBottom: '1px solid #e5e7eb' }}>
            {([['dashboard', 'מרכז פיקוד'], ['reports', 'דוחות יומיים'], ['assign', 'שיוך קמפיינים ללקוחות']] as const).map(([id, label]) => (
              <button
                key={id}
                onClick={() => { setTab(id); setDrill(null); }}
                style={{
                  padding: '8px 16px', border: 'none', background: 'none', cursor: 'pointer',
                  fontSize: 14, fontWeight: 700,
                  color: tab === id ? BRAND : '#6b7280',
                  borderBottom: tab === id ? `2px solid ${BRAND}` : '2px solid transparent',
                }}
              >
                {label}
              </button>
            ))}
          </div>

          {tab === 'assign' ? (
            <div style={{ background: 'var(--surface, #fff)', border: '1px solid var(--border, #e5e7eb)', borderRadius: 12, padding: 20 }}>
              <p style={{ color: '#6b7280', fontSize: 13, marginTop: 0, marginBottom: 16 }}>
                בחר חשבון מודעות, וראה את הקמפיינים שבתוכו. שייך כל קמפיין ללקוח — חשבון אחד יכול לשרת כמה לקוחות.
              </p>
              <CampaignAssigner clients={clients.map((c) => ({ id: c.id, name: c.name }))} />
            </div>
          ) : tab === 'dashboard' ? (
            drill ? (
              <div>
                <button
                  onClick={() => setDrill(null)}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: 18, padding: '7px 14px', borderRadius: 10, border: '1px solid var(--border,#e5e7eb)', background: 'var(--surface-raised,#fff)', color: BRAND, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
                >
                  → חזרה למרכז הפיקוד
                </button>
                <h2 style={{ fontSize: 20, fontWeight: 800, marginBottom: 16 }}>{drill.name}</h2>
                <CampaignDashboard clientId={drill.id} clientName={drill.name} />
              </div>
            ) : (
              <MetaCommandCenter onOpenClient={(id, name) => setDrill({ id, name })} />
            )
          ) : (
            // reports tab — keep a client selector
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
                  <CampaignReports clientId={selected} />
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}
