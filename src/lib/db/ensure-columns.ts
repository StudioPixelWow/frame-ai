/**
 * Auto-add missing columns to business_projects table.
 * Uses the same sb.rpc('exec_sql') pattern as ensureTable() in store.ts.
 * Runs once per process lifetime — safe to call from multiple routes.
 */

import { getSupabase } from './store';

const TABLE = 'business_projects';
let _done = false;

const REQUIRED_COLUMNS = [
  { name: 'total_price', def: 'NUMERIC DEFAULT 0' },
  { name: 'progress', def: 'NUMERIC DEFAULT 0' },
  { name: 'contract_signed', def: 'BOOLEAN DEFAULT false' },
  { name: 'contract_signed_at', def: 'TIMESTAMPTZ' },
];

export async function ensureBusinessProjectColumns() {
  if (_done) return;
  _done = true;

  try {
    const sb = getSupabase();

    // Quick probe — if total_price exists, all columns likely exist
    const { error } = await sb.from(TABLE).select('total_price').limit(1);
    if (!error) return; // column exists, nothing to do

    console.warn(`[ensureColumns] "${TABLE}.total_price" missing — adding columns via exec_sql`);

    // Build a single ALTER TABLE statement with all columns
    const alterClauses = REQUIRED_COLUMNS
      .map(col => `ADD COLUMN IF NOT EXISTS ${col.name} ${col.def}`)
      .join(', ');
    const ddl = `ALTER TABLE ${TABLE} ${alterClauses};`;

    // Use the same rpc('exec_sql') that ensureTable() uses in store.ts
    const { error: rpcErr } = await sb.rpc('exec_sql', { query: ddl });

    if (rpcErr) {
      // If combined ALTER fails, try columns one by one
      console.warn('[ensureColumns] combined ALTER failed:', rpcErr.message, '— trying individually');
      for (const col of REQUIRED_COLUMNS) {
        const singleDdl = `ALTER TABLE ${TABLE} ADD COLUMN IF NOT EXISTS ${col.name} ${col.def};`;
        const { error: singleErr } = await sb.rpc('exec_sql', { query: singleDdl });
        if (singleErr && !singleErr.message.includes('already exists')) {
          console.warn(`[ensureColumns] failed to add ${col.name}:`, singleErr.message);
        }
      }
    }

    // Verify the column now exists
    const { error: verifyErr } = await sb.from(TABLE).select('total_price').limit(1);
    if (verifyErr) {
      console.error(
        `[ensureColumns] STILL cannot access total_price after migration.\n` +
        `Run this SQL manually in Supabase SQL Editor:\n\n` +
        REQUIRED_COLUMNS.map(c => `  ALTER TABLE ${TABLE} ADD COLUMN IF NOT EXISTS ${c.name} ${c.def};`).join('\n') +
        '\n'
      );
      _done = false; // retry on next request
    } else {
      console.log('[ensureColumns] ✓ columns verified for', TABLE);
    }
  } catch (err) {
    console.warn('[ensureColumns] unexpected error:', err);
    _done = false;
  }
}
