/**
 * GET /api/data/migrate-video-projects
 *
 * Idempotent migration: ensures the video_projects table has every column
 * the application code expects. Safe to call repeatedly.
 *
 * Strategy:
 *   1. Probe the table with a full SELECT of all expected columns.
 *   2. Parse which columns Supabase says are missing.
 *   3. For each missing column, attempt a Supabase `.rpc()` call to ALTER TABLE.
 *   4. If rpc isn't available, return the raw SQL for manual execution.
 *   5. Reload the PostgREST schema cache.
 *
 * Run once after deploy:  curl http://localhost:3000/api/data/migrate-video-projects
 */

import { NextResponse } from 'next/server';
import { getSupabase } from '@/lib/db/store';

export const dynamic = 'force-dynamic';

/* ── Authoritative column list ─────────────────────────────────────────── */

const COLUMNS: Array<{ name: string; type: string; defaultVal?: string }> = [
  { name: 'name',                type: 'TEXT',        defaultVal: "''" },
  { name: 'client_id',           type: 'TEXT' },
  { name: 'client_name',         type: 'TEXT',        defaultVal: "''" },
  { name: 'status',              type: 'TEXT',        defaultVal: "'draft'" },
  { name: 'description',         type: 'TEXT',        defaultVal: "''" },
  { name: 'project_type',        type: 'TEXT' },
  { name: 'format',              type: 'TEXT' },
  { name: 'preset',              type: 'TEXT' },
  { name: 'duration_sec',        type: 'INTEGER' },
  { name: 'duration',            type: 'INTEGER' },
  { name: 'segments',            type: 'JSONB' },
  { name: 'source_video_key',    type: 'TEXT' },
  { name: 'render_output_key',   type: 'TEXT' },
  { name: 'thumbnail_key',       type: 'TEXT' },
  { name: 'video_url',           type: 'TEXT' },
  { name: 'thumbnail_url',       type: 'TEXT' },
  { name: 'wizard_state',        type: 'JSONB' },
  { name: 'render_payload',      type: 'JSONB' },
  { name: 'start_date',          type: 'TEXT' },
  { name: 'end_date',            type: 'TEXT' },
  { name: 'assigned_manager_id', type: 'TEXT' },
  { name: 'created_at',          type: 'TIMESTAMPTZ', defaultVal: 'now()' },
  { name: 'updated_at',          type: 'TIMESTAMPTZ', defaultVal: 'now()' },
];

/* ── Build raw SQL ─────────────────────────────────────────────────────── */

function buildRawSql(): string {
  const lines = [
    '-- video_projects migration: run in Supabase SQL Editor',
    '-- Safe to run multiple times — every statement uses IF NOT EXISTS.',
    '',
  ];
  for (const col of COLUMNS) {
    const def = col.defaultVal ? ` DEFAULT ${col.defaultVal}` : '';
    lines.push(`ALTER TABLE public.video_projects ADD COLUMN IF NOT EXISTS ${col.name} ${col.type}${def};`);
  }
  lines.push('');
  lines.push("-- Reload PostgREST schema cache so the API sees the new columns:");
  lines.push("NOTIFY pgrst, 'reload schema';");
  return lines.join('\n');
}

/* ── Detect missing columns via probe SELECT ───────────────────────────── */

async function detectMissing(sb: ReturnType<typeof getSupabase>): Promise<string[]> {
  const allCols = COLUMNS.map((c) => c.name);
  let selectList = ['id', ...allCols].join(', ');
  const missing: string[] = [];

  for (let attempt = 0; attempt < allCols.length; attempt++) {
    const { error } = await sb.from('video_projects').select(selectList).limit(0);
    if (!error) break; // all columns exist

    const m = error.message.match(
      /column .*?['"]?([a-z_]+)['"]? does not exist|Could not find the '([^']+)' column/i,
    );
    const bad = m?.[1] || m?.[2];
    if (!bad) break; // unknown error shape — stop probing

    missing.push(bad);
    selectList = selectList
      .split(',')
      .map((s) => s.trim())
      .filter((c) => c !== bad)
      .join(', ');
  }

  return missing;
}

/* ── Try to run an ALTER via Supabase RPC ──────────────────────────────── */

async function tryAlter(
  sb: ReturnType<typeof getSupabase>,
  col: (typeof COLUMNS)[number],
): Promise<{ ok: boolean; error?: string }> {
  const def = col.defaultVal ? ` DEFAULT ${col.defaultVal}` : '';
  const sql = `ALTER TABLE public.video_projects ADD COLUMN IF NOT EXISTS ${col.name} ${col.type}${def};`;

  // Try common RPC param names
  for (const param of ['sql_text', 'query', 'sql']) {
    const { error } = await sb.rpc('exec_sql', { [param]: sql });
    if (!error) return { ok: true };
    // If the error is about the column already existing, that's fine
    if (error.message?.includes('already exists')) return { ok: true };
    // If the error is about the RPC itself (wrong param name), try next
    if (error.message?.includes('argument') || error.message?.includes('param')) continue;
    // Some other error — report it
    return { ok: false, error: error.message };
  }
  return { ok: false, error: 'exec_sql RPC not available — run the SQL manually in Supabase SQL Editor' };
}

/* ── Reload schema cache ───────────────────────────────────────────────── */

async function reloadSchemaCache(sb: ReturnType<typeof getSupabase>): Promise<string> {
  for (const param of ['sql_text', 'query', 'sql']) {
    const { error } = await sb.rpc('exec_sql', { [param]: "NOTIFY pgrst, 'reload schema';" });
    if (!error) return 'ok';
  }
  return 'rpc_unavailable — run: NOTIFY pgrst, \'reload schema\'; in SQL Editor';
}

/* ── Route handler ─────────────────────────────────────────────────────── */

export async function GET() {
  const sb = getSupabase();
  const tag = '[migrate-video-projects]';

  // Step 1: detect which columns are missing
  console.log(`${tag} Step 1: detecting missing columns…`);
  const missing = await detectMissing(sb);
  console.log(`${tag} Missing columns: ${missing.length === 0 ? 'none' : missing.join(', ')}`);

  if (missing.length === 0) {
    return NextResponse.json({
      message: 'All columns already exist. No migration needed.',
      missing: [],
      results: [],
      schemaReload: 'skipped',
      rawSql: buildRawSql(),
    });
  }

  // Step 2: try to add each missing column via RPC
  console.log(`${tag} Step 2: adding ${missing.length} missing columns…`);
  const results: Array<{ column: string; status: string }> = [];
  let rpcWorked = true;

  for (const colName of missing) {
    const colDef = COLUMNS.find((c) => c.name === colName);
    if (!colDef) {
      results.push({ column: colName, status: 'unknown_column — not in COLUMNS list' });
      continue;
    }

    const { ok, error } = await tryAlter(sb, colDef);
    if (ok) {
      console.log(`${tag}   ✅ ${colName}: added`);
      results.push({ column: colName, status: 'added' });
    } else {
      console.warn(`${tag}   ❌ ${colName}: ${error}`);
      results.push({ column: colName, status: `error: ${error}` });
      rpcWorked = false;
    }
  }

  // Step 3: reload schema cache
  let schemaReload = 'skipped';
  if (rpcWorked && results.some((r) => r.status === 'added')) {
    console.log(`${tag} Step 3: reloading PostgREST schema cache…`);
    schemaReload = await reloadSchemaCache(sb);
    console.log(`${tag} Schema reload: ${schemaReload}`);
  }

  // Step 4: verify — probe again
  const stillMissing = await detectMissing(sb);
  const allFixed = stillMissing.length === 0;
  console.log(`${tag} Step 4: verify — ${allFixed ? '✅ all columns present' : `❌ still missing: ${stillMissing.join(', ')}`}`);

  return NextResponse.json({
    message: allFixed
      ? `Migration complete. Added ${results.filter((r) => r.status === 'added').length} columns.`
      : `Migration partial. ${stillMissing.length} columns still missing. Run the rawSql in Supabase SQL Editor.`,
    missing,
    stillMissing,
    results,
    schemaReload,
    rawSql: buildRawSql(),
  });
}
