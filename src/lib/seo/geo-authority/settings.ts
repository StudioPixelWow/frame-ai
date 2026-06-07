/**
 * GEO publish-mode setting (app_settings key 'geo_publish_mode').
 *
 * 'auto'   → approved/created drafts of SAFE additive kinds (schema, faq,
 *            internal_link) are applied automatically to WordPress-connected
 *            sites, with full logging. Nothing happens on sites without a
 *            WordPress connection.
 * 'draft'  → everything waits for manual approval (the original behavior).
 *
 * Default is 'auto' per the account owner's explicit request.
 */

import { getSupabase } from '@/lib/db/store';

export type GeoPublishMode = 'auto' | 'draft';
const AUTO_APPLY_KINDS = new Set(['schema', 'faq', 'internal_link']);

export function isAutoApplicableKind(kind: string): boolean {
  return AUTO_APPLY_KINDS.has(kind);
}

export async function getGeoPublishMode(): Promise<GeoPublishMode> {
  try {
    const sb = getSupabase();
    const { data } = await sb.from('app_settings').select('value').eq('key', 'geo_publish_mode').maybeSingle();
    const v: any = data?.value;
    const mode = typeof v === 'string' ? v : v?.mode;
    return mode === 'draft' ? 'draft' : 'auto'; // default 'auto'
  } catch {
    return 'auto';
  }
}

export async function setGeoPublishMode(mode: GeoPublishMode): Promise<void> {
  const sb = getSupabase();
  await sb.from('app_settings').upsert({ key: 'geo_publish_mode', value: { mode } }, { onConflict: 'key' });
}
