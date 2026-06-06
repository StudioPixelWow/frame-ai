/** Competitor research tables — auto-created via ensureTable (exec_sql). */

import { ensureTable } from '@/lib/db/store';

export const DDL_COMPETITORS = `
  CREATE TABLE IF NOT EXISTS public.client_competitors (
    id text PRIMARY KEY,
    client_id text NOT NULL,
    name text NOT NULL,
    page_id text,
    country text DEFAULT 'IL',
    notes text,
    created_at timestamptz DEFAULT now()
  );`;

export const DDL_ADS = `
  CREATE TABLE IF NOT EXISTS public.competitor_ads (
    id text PRIMARY KEY,
    client_id text NOT NULL,
    competitor_id text NOT NULL,
    ad_id text NOT NULL,
    page_name text,
    body text,
    title text,
    snapshot_url text,
    platforms jsonb,
    start_time text,
    active boolean DEFAULT true,
    first_seen timestamptz DEFAULT now(),
    last_seen timestamptz DEFAULT now(),
    raw jsonb
  );`;

let _done = false;
export async function ensureCompetitorTables(): Promise<void> {
  if (_done) return;
  try { await ensureTable('client_competitors', DDL_COMPETITORS); } catch { /* fallback SQL */ }
  try { await ensureTable('competitor_ads', DDL_ADS); } catch { /* fallback SQL */ }
  _done = true;
}

export function cmpId(p = 'cmp'): string {
  return `${p}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}
