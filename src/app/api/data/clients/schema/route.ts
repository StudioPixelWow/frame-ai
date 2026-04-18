/**
 * GET /api/data/clients/schema — One-shot migration: ensure all extra columns
 * exist on public.clients, then reload the PostgREST schema cache.
 *
 * Safe to call repeatedly (uses ADD COLUMN IF NOT EXISTS).
 * DELETE THIS FILE after migration is confirmed.
 */

import { NextResponse } from 'next/server';
import { getSupabase } from '@/lib/db/store';

const COLUMNS_TO_ENSURE = [
  'website',
  'facebook',
  'instagram',
  'tiktok',
  'linkedin',
  'youtube',
  'marketing_goals',
  'key_marketing_messages',
  'logo_url',
];

export async function GET() {
  const sb = getSupabase();
  const log: string[] = [];
  const errors: string[] = [];

  // Step 1: Probe existing columns via SELECT * LIMIT 1
  const { data: probe, error: probeErr } = await sb
    .from('clients')
    .select('*')
    .limit(1)
    .maybeSingle();

  const existingCols = probe ? Object.keys(probe) : [];
  log.push(`Existing columns (${existingCols.length}): ${existingCols.join(', ')}`);
  if (probeErr) log.push(`Probe warning: ${probeErr.message}`);

  const alreadyExist: string[] = [];
  const needCreation: string[] = [];
  for (const col of COLUMNS_TO_ENSURE) {
    if (existingCols.includes(col)) {
      alreadyExist.push(col);
    } else {
      needCreation.push(col);
    }
  }
  log.push(`Already in schema cache: ${alreadyExist.join(', ') || '(none)'}`);
  log.push(`Not in schema cache (will ADD): ${needCreation.join(', ') || '(none)'}`);

  // Step 2: ADD COLUMN IF NOT EXISTS for each missing column
  for (const col of COLUMNS_TO_ENSURE) {
    const ddl = `ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS ${col} text DEFAULT '';`;
    const { error } = await sb.rpc('exec_sql', { query: ddl });
    if (error) {
      errors.push(`${col}: ${error.message}`);
      log.push(`ADD COLUMN ${col}: FAILED — ${error.message}`);
    } else {
      log.push(`ADD COLUMN ${col}: OK`);
    }
  }

  // Step 3: Also ensure client_research table exists
  const clientResearchDDL = `
    CREATE TABLE IF NOT EXISTS public.client_research (
      id text PRIMARY KEY,
      client_id text NOT NULL,
      summary text DEFAULT '',
      customer_profile text DEFAULT '',
      trend_engine text DEFAULT '',
      competitor_analysis text DEFAULT '',
      brand_weakness text DEFAULT '',
      client_brain text DEFAULT '',
      created_at timestamptz DEFAULT now(),
      updated_at timestamptz DEFAULT now()
    );
  `;
  const { error: crErr } = await sb.rpc('exec_sql', { query: clientResearchDDL });
  if (crErr) {
    log.push(`client_research table: ${crErr.message}`);
  } else {
    log.push('client_research table: OK');
  }

  // Step 4: Reload PostgREST schema cache
  const { error: notifyErr } = await sb.rpc('exec_sql', {
    query: "NOTIFY pgrst, 'reload schema';",
  });
  if (notifyErr) {
    log.push(`Schema cache reload: FAILED — ${notifyErr.message}`);
    errors.push(`NOTIFY: ${notifyErr.message}`);
  } else {
    log.push('Schema cache reload: NOTIFY pgrst sent');
  }

  // Step 5: Verify — re-probe after migration
  const { data: verify } = await sb
    .from('clients')
    .select('*')
    .limit(1)
    .maybeSingle();
  const finalCols = verify ? Object.keys(verify) : [];
  log.push(`Post-migration columns (${finalCols.length}): ${finalCols.join(', ')}`);

  const stillMissing = COLUMNS_TO_ENSURE.filter((c) => !finalCols.includes(c));
  if (stillMissing.length > 0) {
    log.push(`⚠️ Still missing from schema cache: ${stillMissing.join(', ')} — may need a few seconds for cache reload`);
  } else {
    log.push('✅ All 9 columns confirmed in schema cache');
  }

  return NextResponse.json({
    success: errors.length === 0,
    alreadyExisted: alreadyExist,
    created: needCreation,
    errors,
    log,
    finalColumns: finalCols,
  });
}
