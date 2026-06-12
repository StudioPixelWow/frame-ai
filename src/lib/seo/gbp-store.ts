/**
 * Persistent storage for Google Business Profile connections.
 * Replaces the previous in-memory-only Map so connections survive restarts and
 * are usable by the automation worker.
 */
import { getSupabase, ensureTable } from '@/lib/db/store';

export interface StoredGbpConnection {
  clientId: string;
  locationId: string;
  accountId?: string;
  refreshToken: string;
  status: 'connected' | 'disconnected' | 'expired';
  businessName?: string;
  connectedAt?: string;
}

async function ensure() {
  await ensureTable('gbp_connections', `
    CREATE TABLE IF NOT EXISTS public.gbp_connections (
      client_id text PRIMARY KEY,
      location_id text DEFAULT '',
      account_id text DEFAULT '',
      refresh_token text NOT NULL,
      status text DEFAULT 'connected',
      business_name text DEFAULT '',
      connected_at timestamptz DEFAULT now(),
      updated_at timestamptz DEFAULT now()
    );
  `);
}

export async function saveGbpConnection(c: StoredGbpConnection): Promise<void> {
  await ensure();
  const sb = getSupabase();
  await sb.from('gbp_connections').upsert({
    client_id: c.clientId,
    location_id: c.locationId || '',
    account_id: c.accountId || '',
    refresh_token: c.refreshToken,
    status: c.status || 'connected',
    business_name: c.businessName || '',
    connected_at: c.connectedAt || new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }, { onConflict: 'client_id' });
}

export async function loadGbpConnection(clientId: string): Promise<StoredGbpConnection | null> {
  try {
    await ensure();
    const sb = getSupabase();
    const { data } = await sb.from('gbp_connections').select('*').eq('client_id', clientId).maybeSingle();
    if (!data || !data.refresh_token) return null;
    return {
      clientId: data.client_id,
      locationId: data.location_id || '',
      accountId: data.account_id || '',
      refreshToken: data.refresh_token,
      status: (data.status as StoredGbpConnection['status']) || 'connected',
      businessName: data.business_name || '',
      connectedAt: data.connected_at || '',
    };
  } catch { return null; }
}

export async function setGbpStatus(clientId: string, status: StoredGbpConnection['status']): Promise<void> {
  try { await ensure(); await getSupabase().from('gbp_connections').update({ status, updated_at: new Date().toISOString() }).eq('client_id', clientId); } catch { /* */ }
}

export async function listGbpConnectedClients(): Promise<string[]> {
  try {
    await ensure();
    const { data } = await getSupabase().from('gbp_connections').select('client_id').eq('status', 'connected');
    return (data || []).map((r: any) => r.client_id);
  } catch { return []; }
}
