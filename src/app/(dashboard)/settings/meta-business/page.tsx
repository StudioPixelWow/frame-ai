'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';

/* ── Types ── */

interface AdAccount {
  id: string;
  name: string;
  accountStatus: number;
  accountStatusLabel: string;
  businessName: string;
  currency: string;
  timezone: string;
  assignedClientId: string | null;
  assignedClientName: string | null;
}

interface ClientOption {
  id: string;
  name: string;
}

interface ConnectionStatus {
  connected: boolean;
  status: string;
  businessName: string | null;
  businessId: string | null;
  connectedAt?: string | null;
  error?: string;
}

/* ── Helpers ── */

function getRoleHeaders(): Record<string, string> {
  if (typeof window === 'undefined') return {};
  const role = localStorage.getItem('app_role') || 'admin';
  const headers: Record<string, string> = { 'x-app-role': role };
  return headers;
}

function statusBadgeStyle(status: string): React.CSSProperties {
  const colors: Record<string, { bg: string; text: string }> = {
    connected: { bg: 'rgba(34,197,94,0.15)', text: '#22c55e' },
    token_expired: { bg: 'rgba(239,68,68,0.15)', text: '#ef4444' },
    not_connected: { bg: 'rgba(107,114,128,0.15)', text: '#6b7280' },
    no_token: { bg: 'rgba(107,114,128,0.15)', text: '#6b7280' },
    error: { bg: 'rgba(239,68,68,0.15)', text: '#ef4444' },
  };
  const c = colors[status] || colors.not_connected;
  return {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '4px 12px',
    borderRadius: 9999,
    fontSize: 13,
    fontWeight: 600,
    background: c.bg,
    color: c.text,
  };
}

function statusLabel(status: string): string {
  const map: Record<string, string> = {
    connected: 'מחובר',
    token_expired: 'אסימון פג תוקף',
    not_connected: 'לא מחובר',
    no_token: 'לא מחובר',
    error: 'שגיאה',
  };
  return map[status] || status;
}

function accountStatusColor(status: number): string {
  if (status === 1) return '#22c55e'; // active
  if (status === 2) return '#ef4444'; // disabled
  return '#f59e0b'; // other
}

function accountStatusLabel(status: number): string {
  const map: Record<number, string> = {
    1: 'פעיל',
    2: 'מושבת',
    3: 'לא מסולק',
    7: 'ממתין לבדיקה',
    8: 'ממתין לסילוק',
    9: 'תקופת חסד',
    100: 'ממתין לסגירה',
    101: 'סגור',
  };
  return map[status] || 'לא ידוע';
}

/* ── Component ── */

function MetaBusinessSettingsContent() {
  const searchParams = useSearchParams();
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus | null>(null);
  const [accounts, setAccounts] = useState<AdAccount[]>([]);
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [accountsLoading, setAccountsLoading] = useState(false);
  const [manualToken, setManualToken] = useState('');
  const [tokenTesting, setTokenTesting] = useState(false);
  const [assigningId, setAssigningId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Check for OAuth redirect success
  useEffect(() => {
    if (searchParams.get('connected') === 'true') {
      setSuccessMessage('החיבור ל-Meta Business Manager בוצע בהצלחה!');
    }
    const error = searchParams.get('error');
    if (error) {
      const errorMessages: Record<string, string> = {
        meta_config: 'חסרות הגדרות META_APP_ID / META_APP_SECRET בשרת',
        meta_token_exchange: 'שגיאה בהחלפת אסימון — נסה שוב',
        meta_save: 'שגיאה בשמירת אסימון הגישה',
        meta_oauth_denied: 'המשתמש דחה את הרשאת OAuth',
      };
      setErrorMessage(errorMessages[error] || `שגיאת חיבור: ${error}`);
    }
  }, [searchParams]);

  // Fetch connection status
  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/meta-business/connect');
      const data = await res.json();
      setConnectionStatus(data);
    } catch {
      setConnectionStatus({ connected: false, status: 'error', businessName: null, businessId: null });
    }
  }, []);

  // Fetch clients list
  const fetchClients = useCallback(async () => {
    try {
      const res = await fetch('/api/data/clients', { headers: getRoleHeaders() });
      const data = await res.json();
      const list = Array.isArray(data) ? data : data.clients || [];
      setClients(list.map((c: any) => ({ id: c.id, name: c.name || c.company || c.id })));
    } catch {
      setClients([]);
    }
  }, []);

  // Fetch ad accounts
  const fetchAccounts = useCallback(async () => {
    setAccountsLoading(true);
    try {
      const res = await fetch('/api/meta-business/accounts');
      const data = await res.json();
      if (data.error) {
        setErrorMessage(data.error);
        setAccounts([]);
      } else {
        setAccounts(data.accounts || []);
      }
    } catch {
      setErrorMessage('שגיאה בטעינת חשבונות מודעות');
    } finally {
      setAccountsLoading(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    Promise.all([fetchStatus(), fetchClients()]).then(() => setLoading(false));
  }, [fetchStatus, fetchClients]);

  // Load accounts when connected
  useEffect(() => {
    if (connectionStatus?.connected) {
      fetchAccounts();
    }
  }, [connectionStatus?.connected, fetchAccounts]);

  // OAuth connect
  const handleOAuthConnect = async () => {
    try {
      const res = await fetch('/api/auth/meta/url?clientId=system');
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        setErrorMessage(data.error || 'לא ניתן ליצור קישור OAuth');
      }
    } catch {
      setErrorMessage('שגיאה ביצירת קישור OAuth');
    }
  };

  // Manual token connect
  const handleManualConnect = async () => {
    if (!manualToken.trim()) return;
    setTokenTesting(true);
    setErrorMessage(null);
    try {
      const res = await fetch('/api/meta-business/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accessToken: manualToken.trim() }),
      });
      const data = await res.json();
      if (data.success) {
        setSuccessMessage(`מחובר בהצלחה ל-${data.businessName || 'Meta Business Manager'}`);
        setManualToken('');
        await fetchStatus();
        await fetchAccounts();
      } else {
        setErrorMessage(data.error || 'שגיאה בחיבור');
      }
    } catch {
      setErrorMessage('שגיאה בבדיקת האסימון');
    } finally {
      setTokenTesting(false);
    }
  };

  // Assign account to client
  const handleAssign = async (adAccountId: string, clientId: string | null) => {
    setAssigningId(adAccountId);
    setErrorMessage(null);
    try {
      const res = await fetch('/api/meta-business/assign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adAccountId, clientId: clientId || null }),
      });
      const data = await res.json();
      if (data.success) {
        setSuccessMessage(clientId ? 'חשבון שויך ללקוח בהצלחה' : 'שיוך בוטל בהצלחה');
        await fetchAccounts();
      } else {
        setErrorMessage(data.error || 'שגיאה בשיוך');
      }
    } catch {
      setErrorMessage('שגיאה בשיוך חשבון');
    } finally {
      setAssigningId(null);
    }
  };

  // Stats
  const totalAccounts = accounts.length;
  const assignedCount = accounts.filter((a) => a.assignedClientId).length;
  const unassignedCount = totalAccounts - assignedCount;

  if (loading) {
    return (
      <div style={{ direction: 'rtl', padding: 40, textAlign: 'center', color: 'var(--foreground)' }}>
        <p>טוען...</p>
      </div>
    );
  }

  return (
    <div style={{ direction: 'rtl', padding: '24px 32px', maxWidth: 1200, margin: '0 auto', color: 'var(--foreground)' }}>
      {/* Messages */}
      {successMessage && (
        <div style={{
          padding: '12px 16px', marginBottom: 16, borderRadius: 8,
          background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)',
          color: '#22c55e', fontSize: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <span>{successMessage}</span>
          <button onClick={() => setSuccessMessage(null)} style={{ background: 'none', border: 'none', color: '#22c55e', cursor: 'pointer', fontSize: 18 }}>x</button>
        </div>
      )}
      {errorMessage && (
        <div style={{
          padding: '12px 16px', marginBottom: 16, borderRadius: 8,
          background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
          color: '#ef4444', fontSize: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <span>{errorMessage}</span>
          <button onClick={() => setErrorMessage(null)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: 18 }}>x</button>
        </div>
      )}

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>חיבור Meta Business Manager</h1>
          <p style={{ fontSize: 14, color: '#6b7280', marginTop: 4 }}>
            ניהול מרכזי של חשבונות פרסום ושיוך ללקוחות
          </p>
        </div>
        <div style={statusBadgeStyle(connectionStatus?.status || 'not_connected')}>
          <span style={{
            width: 8, height: 8, borderRadius: '50%',
            background: connectionStatus?.connected ? '#22c55e' : '#6b7280',
          }} />
          {statusLabel(connectionStatus?.status || 'not_connected')}
        </div>
      </div>

      {/* Connection Section */}
      <div style={{
        background: 'var(--surface-raised, var(--background))',
        border: '1px solid var(--border)',
        borderRadius: 12,
        padding: 24,
        marginBottom: 24,
      }}>
        <h2 style={{ fontSize: 18, fontWeight: 600, margin: '0 0 16px 0' }}>
          {connectionStatus?.connected ? 'פרטי חיבור' : 'התחברות'}
        </h2>

        {connectionStatus?.connected ? (
          <div style={{ display: 'flex', gap: 24, alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{
              width: 48, height: 48, borderRadius: 12, background: '#1877f2',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#fff', fontSize: 24, fontWeight: 700,
            }}>
              f
            </div>
            <div>
              <div style={{ fontSize: 16, fontWeight: 600 }}>{connectionStatus.businessName || 'Meta Business'}</div>
              <div style={{ fontSize: 13, color: '#6b7280' }}>ID: {connectionStatus.businessId}</div>
              {connectionStatus.connectedAt && (
                <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>
                  חובר: {new Date(connectionStatus.connectedAt).toLocaleDateString('he-IL')}
                </div>
              )}
            </div>
            <button
              onClick={() => { fetchStatus(); fetchAccounts(); }}
              style={{
                marginRight: 'auto',
                padding: '8px 16px', borderRadius: 8, border: '1px solid var(--border)',
                background: 'transparent', color: 'var(--foreground)', cursor: 'pointer', fontSize: 13,
              }}
            >
              רענן חיבור
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* OAuth button */}
            <button
              onClick={handleOAuthConnect}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                padding: '12px 24px', borderRadius: 8, border: 'none',
                background: '#1877f2', color: '#fff', fontSize: 15, fontWeight: 600,
                cursor: 'pointer', width: 'fit-content',
              }}
            >
              <span style={{ fontSize: 20 }}>f</span>
              התחבר עם Facebook
            </button>

            {/* Divider */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
              <span style={{ fontSize: 13, color: '#6b7280' }}>או</span>
              <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
            </div>

            {/* Manual token input */}
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input
                type="text"
                placeholder="הדבק אסימון גישה (Access Token) כאן..."
                value={manualToken}
                onChange={(e) => setManualToken(e.target.value)}
                style={{
                  flex: 1, padding: '10px 14px', borderRadius: 8,
                  border: '1px solid var(--border)', background: 'var(--background)',
                  color: 'var(--foreground)', fontSize: 14, direction: 'ltr', textAlign: 'left',
                }}
              />
              <button
                onClick={handleManualConnect}
                disabled={!manualToken.trim() || tokenTesting}
                style={{
                  padding: '10px 20px', borderRadius: 8, border: '1px solid var(--border)',
                  background: manualToken.trim() ? 'var(--foreground)' : 'transparent',
                  color: manualToken.trim() ? 'var(--background)' : '#6b7280',
                  fontSize: 14, fontWeight: 600, cursor: manualToken.trim() ? 'pointer' : 'default',
                  opacity: tokenTesting ? 0.6 : 1,
                  whiteSpace: 'nowrap',
                }}
              >
                {tokenTesting ? 'בודק...' : 'בדוק חיבור'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Summary Stats */}
      {connectionStatus?.connected && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 24 }}>
          <div style={{
            background: 'var(--surface-raised, var(--background))',
            border: '1px solid var(--border)', borderRadius: 12, padding: 20, textAlign: 'center',
          }}>
            <div style={{ fontSize: 32, fontWeight: 700 }}>{totalAccounts}</div>
            <div style={{ fontSize: 13, color: '#6b7280', marginTop: 4 }}>סה"כ חשבונות</div>
          </div>
          <div style={{
            background: 'var(--surface-raised, var(--background))',
            border: '1px solid var(--border)', borderRadius: 12, padding: 20, textAlign: 'center',
          }}>
            <div style={{ fontSize: 32, fontWeight: 700, color: '#22c55e' }}>{assignedCount}</div>
            <div style={{ fontSize: 13, color: '#6b7280', marginTop: 4 }}>משויכים</div>
          </div>
          <div style={{
            background: 'var(--surface-raised, var(--background))',
            border: '1px solid var(--border)', borderRadius: 12, padding: 20, textAlign: 'center',
          }}>
            <div style={{ fontSize: 32, fontWeight: 700, color: '#6b7280' }}>{unassignedCount}</div>
            <div style={{ fontSize: 13, color: '#6b7280', marginTop: 4 }}>לא משויכים</div>
          </div>
        </div>
      )}

      {/* Ad Accounts Grid */}
      {connectionStatus?.connected && (
        <div style={{
          background: 'var(--surface-raised, var(--background))',
          border: '1px solid var(--border)',
          borderRadius: 12,
          padding: 24,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h2 style={{ fontSize: 18, fontWeight: 600, margin: 0 }}>חשבונות מודעות</h2>
            <button
              onClick={fetchAccounts}
              disabled={accountsLoading}
              style={{
                padding: '6px 14px', borderRadius: 8, border: '1px solid var(--border)',
                background: 'transparent', color: 'var(--foreground)', cursor: 'pointer', fontSize: 13,
                opacity: accountsLoading ? 0.6 : 1,
              }}
            >
              {accountsLoading ? 'טוען...' : 'רענן'}
            </button>
          </div>

          {accountsLoading && accounts.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 40, color: '#6b7280' }}>
              טוען חשבונות מ-Meta...
            </div>
          ) : accounts.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 40, color: '#6b7280' }}>
              לא נמצאו חשבונות מודעות
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 16 }}>
              {accounts.map((account) => (
                <AccountCard
                  key={account.id}
                  account={account}
                  clients={clients}
                  assigning={assigningId === account.id}
                  onAssign={handleAssign}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ── Account Card Component ── */

function AccountCard({
  account,
  clients,
  assigning,
  onAssign,
}: {
  account: AdAccount;
  clients: ClientOption[];
  assigning: boolean;
  onAssign: (adAccountId: string, clientId: string | null) => void;
}) {
  const [selectedClient, setSelectedClient] = useState<string>(account.assignedClientId || '');
  const isAssigned = !!account.assignedClientId;

  return (
    <div style={{
      border: `1px solid ${isAssigned ? 'rgba(34,197,94,0.3)' : 'var(--border)'}`,
      borderRadius: 12,
      padding: 16,
      background: isAssigned ? 'rgba(34,197,94,0.04)' : 'var(--background)',
      transition: 'all 0.2s',
    }}>
      {/* Account header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {account.name}
          </div>
          <div style={{ fontSize: 12, color: '#6b7280', direction: 'ltr', textAlign: 'right', marginTop: 2 }}>
            {account.id}
          </div>
        </div>
        <span style={{
          padding: '2px 8px', borderRadius: 6, fontSize: 11, fontWeight: 600,
          background: `${accountStatusColor(account.accountStatus)}15`,
          color: accountStatusColor(account.accountStatus),
        }}>
          {accountStatusLabel(account.accountStatus)}
        </span>
      </div>

      {/* Account details */}
      <div style={{ display: 'flex', gap: 16, fontSize: 12, color: '#6b7280', marginBottom: 12, flexWrap: 'wrap' }}>
        {account.businessName && <span>BM: {account.businessName}</span>}
        {account.currency && <span>{account.currency}</span>}
        {account.timezone && <span>{account.timezone}</span>}
      </div>

      {/* Assignment */}
      <div style={{ borderTop: '1px solid var(--border)', paddingTop: 12 }}>
        {isAssigned ? (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontSize: 13 }}>
              <span style={{ color: '#22c55e', fontWeight: 600 }}>משויך: </span>
              <span>{account.assignedClientName}</span>
            </div>
            <button
              onClick={() => onAssign(account.id, null)}
              disabled={assigning}
              style={{
                padding: '4px 12px', borderRadius: 6, border: '1px solid rgba(239,68,68,0.3)',
                background: 'rgba(239,68,68,0.1)', color: '#ef4444', fontSize: 12,
                cursor: 'pointer', opacity: assigning ? 0.6 : 1,
              }}
            >
              {assigning ? '...' : 'בטל שיוך'}
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <select
              value={selectedClient}
              onChange={(e) => setSelectedClient(e.target.value)}
              style={{
                flex: 1, padding: '6px 10px', borderRadius: 6,
                border: '1px solid var(--border)', background: 'var(--background)',
                color: 'var(--foreground)', fontSize: 13,
              }}
            >
              <option value="">בחר לקוח...</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            <button
              onClick={() => { if (selectedClient) onAssign(account.id, selectedClient); }}
              disabled={!selectedClient || assigning}
              style={{
                padding: '6px 14px', borderRadius: 6, border: 'none',
                background: selectedClient ? '#1877f2' : '#6b7280',
                color: '#fff', fontSize: 13, fontWeight: 600,
                cursor: selectedClient ? 'pointer' : 'default',
                opacity: assigning ? 0.6 : 1, whiteSpace: 'nowrap',
              }}
            >
              {assigning ? '...' : 'שייך'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function MetaBusinessSettingsPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-gray-500">טוען...</div>}>
      <MetaBusinessSettingsContent />
    </Suspense>
  );
}
