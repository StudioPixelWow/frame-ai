/**
 * Auto-add missing columns to business_projects table.
 * Runs once per process lifetime — safe to call from multiple routes.
 */

import { getSupabase } from './store';

const TABLE = 'business_projects';
let _done = false;

export async function ensureBusinessProjectColumns() {
  if (_done) return;
  _done = true;
  try {
    const sb = getSupabase();
    // Quick probe — if total_price exists, nothing to do
    const { error } = await sb.from(TABLE).select('total_price').limit(1);
    if (!error) return;

    console.warn(`[ensureColumns] column probe failed: ${error.message} — attempting ALTER TABLE`);

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '';
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
    if (!supabaseUrl || !serviceKey) {
      console.warn('[ensureColumns] no credentials — cannot auto-add columns');
      return;
    }

    const columns = [
      { name: 'total_price', def: 'NUMERIC DEFAULT 0' },
      { name: 'progress', def: 'NUMERIC DEFAULT 0' },
      { name: 'contract_signed', def: 'BOOLEAN DEFAULT false' },
      { name: 'contract_signed_at', def: 'TIMESTAMPTZ' },
    ];

    for (const col of columns) {
      const sql = `ALTER TABLE ${TABLE} ADD COLUMN IF NOT EXISTS ${col.name} ${col.def}`;
      // Try Supabase management API / pg_net / exec_sql RPC
      let ok = false;
      for (const rpcName of ['exec_sql', 'run_sql', '']) {
        const url = rpcName
          ? `${supabaseUrl}/rest/v1/rpc/${rpcName}`
          : `${supabaseUrl}/rest/v1/rpc/`;
        try {
          const resp = await fetch(url, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              apikey: serviceKey,
              Authorization: `Bearer ${serviceKey}`,
              Prefer: 'return=minimal',
            },
            body: JSON.stringify(rpcName ? { sql } : { query: sql }),
          });
          if (resp.ok || resp.status === 204) { ok = true; break; }
        } catch { /* try next */ }
      }
      if (!ok) {
        console.warn(`[ensureColumns] auto-add failed for ${col.name}. Run manually:\n  ALTER TABLE ${TABLE} ADD COLUMN IF NOT EXISTS ${col.name} ${col.def};`);
      }
    }

    // Verify
    const { error: err2 } = await sb.from(TABLE).select('total_price').limit(1);
    if (err2) {
      console.error(`[ensureColumns] STILL missing columns after migration attempt. Run manually:\n  ALTER TABLE ${TABLE} ADD COLUMN IF NOT EXISTS total_price NUMERIC DEFAULT 0;\n  ALTER TABLE ${TABLE} ADD COLUMN IF NOT EXISTS progress NUMERIC DEFAULT 0;`);
      // Reset so we try again next request
      _done = false;
    } else {
      console.log('[ensureColumns] columns verified for', TABLE);
    }
  } catch (err) {
    console.warn('[ensureColumns] unexpected error:', err);
    _done = false;
  }
}
