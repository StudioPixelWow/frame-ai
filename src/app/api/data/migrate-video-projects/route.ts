/**
 * GET /api/data/migrate-video-projects
 *
 * Returns the exact SQL needed to bring video_projects up to date.
 * Also attempts to run it via exec_sql RPC if available.
 *
 * The DEFINITIVE expected schema is defined here — this is the single
 * source of truth for what video_projects must look like.
 *
 * Usage:
 *   1. Visit this endpoint in your browser
 *   2. Copy the SQL from the response
 *   3. Paste into Supabase Dashboard → SQL Editor → Run
 *   4. The API auto-adapts immediately after columns exist
 */

import { NextResponse } from 'next/server';
import { getSupabase } from '@/lib/db/store';

export const dynamic = 'force-dynamic';

/* ── Single source of truth: every column the app expects ──────────────── */

export const VIDEO_PROJECTS_COLUMNS: Array<{
  name: string;
  type: string;
  defaultVal?: string;
  comment: string;
}> = [
  { name: 'name',                type: 'TEXT',        defaultVal: "''",      comment: 'project display name' },
  { name: 'client_id',           type: 'TEXT',                               comment: 'FK to clients' },
  { name: 'client_name',         type: 'TEXT',        defaultVal: "''",      comment: 'denormalized client name' },
  { name: 'status',              type: 'TEXT',        defaultVal: "'draft'", comment: 'draft|analysing|approved|rendering|complete|failed|sent_to_client' },
  { name: 'description',         type: 'TEXT',        defaultVal: "''",      comment: 'project description' },
  { name: 'project_type',        type: 'TEXT',                               comment: 'general|ugc|podcast|…' },
  { name: 'format',              type: 'TEXT',                               comment: '9:16|16:9|1:1|4:5' },
  { name: 'preset',              type: 'TEXT',                               comment: 'render preset name' },
  { name: 'duration_sec',        type: 'INTEGER',                            comment: 'video duration in seconds' },
  { name: 'duration',            type: 'INTEGER',                            comment: 'alias for duration_sec' },
  { name: 'segments',            type: 'JSONB',                              comment: 'transcription segments array' },
  { name: 'source_video_key',    type: 'TEXT',                               comment: 'storage key of source video' },
  { name: 'render_output_key',   type: 'TEXT',                               comment: 'storage key of rendered output' },
  { name: 'thumbnail_key',       type: 'TEXT',                               comment: 'storage key of thumbnail' },
  { name: 'video_url',           type: 'TEXT',                               comment: 'public URL of rendered video' },
  { name: 'thumbnail_url',       type: 'TEXT',                               comment: 'public URL of thumbnail' },
  { name: 'wizard_state',        type: 'JSONB',                              comment: 'full wizard form state' },
  { name: 'render_payload',      type: 'JSONB',                              comment: 'Remotion render input props' },
  { name: 'start_date',          type: 'TEXT',                               comment: 'project start date' },
  { name: 'end_date',            type: 'TEXT',                               comment: 'project end date' },
  { name: 'assigned_manager_id', type: 'TEXT',                               comment: 'FK to employees' },
  { name: 'created_at',          type: 'TIMESTAMPTZ', defaultVal: 'now()',   comment: 'row creation time' },
  { name: 'updated_at',          type: 'TIMESTAMPTZ', defaultVal: 'now()',   comment: 'last update time' },
];

/* ── Build the migration SQL ───────────────────────────────────────────── */

function buildMigrationSql(): string {
  const lines = [
    '-- ╔══════════════════════════════════════════════════════════════════╗',
    '-- ║  video_projects — complete column migration                     ║',
    '-- ║  Run in: Supabase Dashboard → SQL Editor → New query → Run     ║',
    '-- ║  Safe to run multiple times (IF NOT EXISTS on every statement)  ║',
    '-- ╚══════════════════════════════════════════════════════════════════╝',
    '',
  ];

  for (const col of VIDEO_PROJECTS_COLUMNS) {
    const def = col.defaultVal ? ` DEFAULT ${col.defaultVal}` : '';
    lines.push(`ALTER TABLE public.video_projects ADD COLUMN IF NOT EXISTS ${col.name} ${col.type}${def};  -- ${col.comment}`);
  }

  lines.push('');
  lines.push('-- Reload PostgREST schema cache (required for Supabase API to see new columns):');
  lines.push("NOTIFY pgrst, 'reload schema';");

  return lines.join('\n');
}

/* ── Detect which columns are actually missing ─────────────────────────── */

async function detectMissingColumns(sb: ReturnType<typeof getSupabase>): Promise<string[]> {
  const allCols = VIDEO_PROJECTS_COLUMNS.map((c) => c.name);
  let selectList = ['id', ...allCols].join(', ');
  const missing: string[] = [];

  // Probe with .limit(0) — no data transferred, just schema validation
  for (let i = 0; i < allCols.length + 2; i++) {
    const { error } = await sb.from('video_projects').select(selectList).limit(0);
    if (!error) break;

    const m = error.message.match(
      /column .*?['"]?([a-z_]+)['"]? does not exist|Could not find the '([^']+)' column/i,
    );
    const bad = m?.[1] || m?.[2];
    if (!bad) break;

    missing.push(bad);
    selectList = selectList
      .split(',')
      .map((s) => s.trim())
      .filter((c) => c !== bad)
      .join(', ');
  }

  return missing;
}

/* ── Try to run SQL via exec_sql RPC ───────────────────────────────────── */

async function tryRunSql(
  sb: ReturnType<typeof getSupabase>,
  sql: string,
): Promise<{ ok: boolean; error?: string }> {
  for (const param of ['sql_text', 'query', 'sql']) {
    const { error } = await sb.rpc('exec_sql', { [param]: sql });
    if (!error) return { ok: true };
    if (error.message?.includes('already exists')) return { ok: true };
    if (error.message?.includes('argument') || error.message?.includes('Could not find')) continue;
    return { ok: false, error: error.message };
  }
  return { ok: false, error: 'exec_sql RPC not available' };
}

/* ── GET handler ───────────────────────────────────────────────────────── */

export async function GET() {
  const sb = getSupabase();
  const migrationSql = buildMigrationSql();

  // 1. Detect missing
  const missing = await detectMissingColumns(sb);
  console.log(`[migrate] Missing columns: ${missing.length === 0 ? 'none' : missing.join(', ')}`);

  if (missing.length === 0) {
    return NextResponse.json({
      status: 'ok',
      message: 'All 23 columns already exist. No migration needed.',
      missing: [],
      migrationSql,
    });
  }

  // 2. Try to add each missing column via RPC
  const results: Array<{ column: string; result: string }> = [];
  let anyAdded = false;

  for (const colName of missing) {
    const colDef = VIDEO_PROJECTS_COLUMNS.find((c) => c.name === colName);
    if (!colDef) {
      results.push({ column: colName, result: 'skipped — not in expected schema' });
      continue;
    }
    const def = colDef.defaultVal ? ` DEFAULT ${colDef.defaultVal}` : '';
    const sql = `ALTER TABLE public.video_projects ADD COLUMN IF NOT EXISTS ${colName} ${colDef.type}${def};`;
    const { ok, error } = await tryRunSql(sb, sql);
    results.push({ column: colName, result: ok ? 'added' : `failed: ${error}` });
    if (ok) anyAdded = true;
  }

  // 3. Reload schema cache if anything was added
  let schemaReload = 'skipped';
  if (anyAdded) {
    const { ok } = await tryRunSql(sb, "NOTIFY pgrst, 'reload schema';");
    schemaReload = ok ? 'ok' : 'failed — run manually';
  }

  // 4. Verify
  const stillMissing = await detectMissingColumns(sb);

  const rpcFailed = results.some((r) => r.result.startsWith('failed'));

  return NextResponse.json({
    status: stillMissing.length === 0 ? 'ok' : rpcFailed ? 'manual_migration_required' : 'partial',
    message: stillMissing.length === 0
      ? `Migration complete. Added ${results.filter((r) => r.result === 'added').length} columns.`
      : `⚠️ ${stillMissing.length} columns still missing. Copy the SQL below, paste into Supabase SQL Editor, and run it.`,
    missing,
    stillMissing,
    results,
    schemaReload,
    migrationSql,
  });
}
