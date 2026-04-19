/**
 * GET /api/data/migrate-video-projects
 *
 * Idempotent migration: ensures the video_projects table has all expected columns.
 * Safe to call repeatedly — uses IF NOT EXISTS semantics via individual ALTER TABLE
 * statements wrapped in DO blocks.
 *
 * Run once after deploy:  curl http://localhost:3000/api/data/migrate-video-projects
 */

import { NextResponse } from 'next/server';
import { getSupabase } from '@/lib/db/store';

const COLUMNS: Array<{ name: string; type: string; defaultVal?: string }> = [
  { name: 'name', type: 'TEXT', defaultVal: "''" },
  { name: 'client_id', type: 'TEXT' },
  { name: 'client_name', type: 'TEXT', defaultVal: "''" },
  { name: 'status', type: 'TEXT', defaultVal: "'draft'" },
  { name: 'description', type: 'TEXT', defaultVal: "''" },
  { name: 'project_type', type: 'TEXT' },
  { name: 'format', type: 'TEXT' },
  { name: 'preset', type: 'TEXT' },
  { name: 'duration_sec', type: 'INTEGER' },
  { name: 'segments', type: 'JSONB' },
  { name: 'source_video_key', type: 'TEXT' },
  { name: 'render_output_key', type: 'TEXT' },
  { name: 'thumbnail_key', type: 'TEXT' },
  { name: 'wizard_state', type: 'JSONB' },
  { name: 'render_payload', type: 'JSONB' },
  { name: 'start_date', type: 'TEXT' },
  { name: 'end_date', type: 'TEXT' },
  { name: 'assigned_manager_id', type: 'TEXT' },
  { name: 'created_at', type: 'TIMESTAMPTZ', defaultVal: 'now()' },
  { name: 'updated_at', type: 'TIMESTAMPTZ', defaultVal: 'now()' },
];

export async function GET() {
  const sb = getSupabase();
  const results: Array<{ column: string; status: string }> = [];

  for (const col of COLUMNS) {
    const defaultClause = col.defaultVal ? ` DEFAULT ${col.defaultVal}` : '';
    const sql = `
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = 'video_projects'
            AND column_name = '${col.name}'
        ) THEN
          ALTER TABLE public.video_projects ADD COLUMN ${col.name} ${col.type}${defaultClause};
        END IF;
      END $$;
    `;

    const { error } = await sb.rpc('exec_sql', { sql_text: sql }).single();

    if (error) {
      // If exec_sql RPC doesn't exist, fall back to raw ALTER (will fail silently if column exists)
      const fallbackSql = `ALTER TABLE public.video_projects ADD COLUMN IF NOT EXISTS ${col.name} ${col.type}${defaultClause};`;
      const { error: fallbackErr } = await sb.rpc('exec_sql', { sql_text: fallbackSql }).single();
      results.push({
        column: col.name,
        status: fallbackErr ? `error: ${fallbackErr.message}` : 'added_or_exists',
      });
    } else {
      results.push({ column: col.name, status: 'added_or_exists' });
    }
  }

  // Reload PostgREST schema cache so new columns are immediately visible
  let schemaReload = 'skipped';
  for (const paramName of ['sql_text', 'query', 'sql']) {
    const { error } = await sb.rpc('exec_sql', { [paramName]: "NOTIFY pgrst, 'reload schema';" });
    if (!error) { schemaReload = 'ok'; break; }
  }

  // Also provide raw SQL the user can run in the Supabase SQL Editor
  const rawSql = [
    '-- Run in Supabase SQL Editor:',
    ...COLUMNS.map((col) => {
      const defaultClause = col.defaultVal ? ` DEFAULT ${col.defaultVal}` : '';
      return `ALTER TABLE public.video_projects ADD COLUMN IF NOT EXISTS ${col.name} ${col.type}${defaultClause};`;
    }),
    '',
    "-- Reload schema cache:",
    "NOTIFY pgrst, 'reload schema';",
  ].join('\n');

  return NextResponse.json({
    message: 'Migration complete. Results below. If RPC errors, run the raw SQL in Supabase SQL Editor.',
    results,
    schemaReload,
    rawSql,
  });
}
