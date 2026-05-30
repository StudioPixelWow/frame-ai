/**
 * Resolve all ad accounts a client owns (many-to-many) with legacy fallback.
 * Source of truth: app_client_ad_accounts. Falls back to the single
 * clients.meta_ad_account_id when the link table is empty/missing.
 */

import { getSupabase } from '@/lib/db/store';

export async function getClientAdAccounts(clientId: string): Promise<string[]> {
  const ids = new Set<string>();
  try {
    const sb = getSupabase();
    const { data } = await sb
      .from('app_client_ad_accounts')
      .select('ad_account_id')
      .eq('client_id', clientId);
    for (const r of (data || []) as any[]) if (r.ad_account_id) ids.add(r.ad_account_id);
  } catch { /* link table optional */ }

  // Legacy single account (primary) — always include if present.
  try {
    const sb = getSupabase();
    const { data: c } = await sb.from('clients').select('meta_ad_account_id').eq('id', clientId).maybeSingle();
    const legacy = (c as any)?.meta_ad_account_id;
    if (legacy) ids.add(legacy);
  } catch { /* ignore */ }

  return [...ids];
}

/** Map ad_account_id → clientId[] for ALL links (used by accounts list UI). */
export async function getAllAccountAssignments(): Promise<Map<string, { clientId: string; clientName: string }[]>> {
  const map = new Map<string, { clientId: string; clientName: string }[]>();
  const sb = getSupabase();

  // Link table
  try {
    const { data } = await sb.from('app_client_ad_accounts').select('client_id, account_name, ad_account_id');
    const { data: clients } = await sb.from('clients').select('id, name');
    const nameById = new Map((clients || []).map((c: any) => [c.id, c.name || '']));
    for (const r of (data || []) as any[]) {
      if (!r.ad_account_id || !r.client_id) continue;
      const list = map.get(r.ad_account_id) || [];
      if (!list.some((x) => x.clientId === r.client_id)) {
        list.push({ clientId: r.client_id, clientName: nameById.get(r.client_id) || '' });
      }
      map.set(r.ad_account_id, list);
    }
  } catch { /* ignore */ }

  // Legacy single field
  try {
    const { data: clients } = await sb.from('clients').select('id, name, meta_ad_account_id').not('meta_ad_account_id', 'is', null);
    for (const c of (clients || []) as any[]) {
      const acct = c.meta_ad_account_id;
      if (!acct) continue;
      const list = map.get(acct) || [];
      if (!list.some((x) => x.clientId === c.id)) list.push({ clientId: c.id, clientName: c.name || '' });
      map.set(acct, list);
    }
  } catch { /* ignore */ }

  return map;
}
