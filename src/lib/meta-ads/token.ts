/**
 * Central Meta token resolver — single source of truth.
 *
 * The system-level Business Manager token is stored once in app_settings
 * (key 'meta_business_token'). All Meta operations should resolve their token
 * through here so that updating the token in ONE place propagates everywhere.
 *
 * A client's own token (e.g. from a per-client OAuth connection) takes priority
 * when present; otherwise we fall back to the central system token.
 */

import { getSupabase } from '@/lib/db/store';

export async function getSystemMetaToken(): Promise<string | null> {
  try {
    const sb = getSupabase();
    const { data } = await sb
      .from('app_settings')
      .select('value')
      .eq('key', 'meta_business_token')
      .maybeSingle();
    const v: any = data?.value;
    if (v) return typeof v === 'string' ? v : v.access_token || null;

    // Legacy fallback table
    const { data: m } = await sb.from('app_meta_business').select('config').maybeSingle();
    return (m?.config as any)?.access_token || null;
  } catch {
    return null;
  }
}

/** Resolve the token to use for a client: their own token if set, else the central one. */
export async function resolveMetaToken(clientToken?: string | null): Promise<string | null> {
  if (clientToken) return clientToken;
  return getSystemMetaToken();
}
