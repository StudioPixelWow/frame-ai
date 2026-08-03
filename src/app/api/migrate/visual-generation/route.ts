/**
 * GET /api/migrate/visual-generation
 *
 * Creates the ai_generation_sessions and ai_generation_versions tables
 * in Supabase. Safe to run multiple times — all DDL uses IF NOT EXISTS.
 *
 * If exec_sql RPC is not available, returns the full SQL for manual
 * execution in the Supabase SQL Editor.
 */

import { NextResponse } from 'next/server';
import { getSupabase } from '@/lib/db/store';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const DDL_BLOCKS: Array<{ name: string; sql: string }> = [
  {
    name: 'ai_generation_sessions',
    sql: `
      CREATE TABLE IF NOT EXISTS public.ai_generation_sessions (
        id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        client_id         TEXT NOT NULL,
        gantt_item_id     TEXT NOT NULL,
        status            TEXT NOT NULL DEFAULT 'active',
        context_snapshot  JSONB NOT NULL DEFAULT '{}',
        system_prompt     TEXT NOT NULL DEFAULT '',
        size_preset       JSONB NOT NULL DEFAULT '{}',
        active_version_id TEXT,
        version_count     INTEGER NOT NULL DEFAULT 0,
        created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_ags_client ON public.ai_generation_sessions(client_id);
      CREATE INDEX IF NOT EXISTS idx_ags_gantt  ON public.ai_generation_sessions(gantt_item_id);
    `,
  },
  {
    name: 'ai_generation_versions',
    sql: `
      CREATE TABLE IF NOT EXISTS public.ai_generation_versions (
        id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        session_id           TEXT NOT NULL,
        client_id            TEXT NOT NULL,
        gantt_item_id        TEXT NOT NULL,
        version_number       INTEGER NOT NULL DEFAULT 1,
        status               TEXT NOT NULL DEFAULT 'generating',
        user_instruction     TEXT NOT NULL DEFAULT '',
        full_prompt          TEXT NOT NULL DEFAULT '',
        model                TEXT NOT NULL DEFAULT 'gpt-image-2',
        quality              TEXT NOT NULL DEFAULT 'high',
        width                INTEGER NOT NULL DEFAULT 1024,
        height               INTEGER NOT NULL DEFAULT 1024,
        image_url            TEXT,
        thumbnail_base64     TEXT,
        revised_prompt       TEXT,
        reference_image_urls JSONB NOT NULL DEFAULT '[]',
        cost                 JSONB,
        error_message        TEXT,
        duration_ms          INTEGER,
        created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_agv_session ON public.ai_generation_versions(session_id);
      CREATE INDEX IF NOT EXISTS idx_agv_client  ON public.ai_generation_versions(client_id);
    `,
  },
];

async function runSQL(
  sb: ReturnType<typeof getSupabase>,
  sql: string,
  supabaseUrl: string,
  serviceRoleKey: string,
): Promise<{ ok: boolean; error?: string; method?: string }> {
  // Method 1: exec_sql RPC
  try {
    const { error } = await sb.rpc('exec_sql', { query: sql });
    if (!error) return { ok: true, method: 'rpc' };
    if (
      !error.message.includes('function') &&
      !error.message.includes('does not exist') &&
      !error.message.includes('could not find')
    ) {
      if (error.message.includes('already exists')) return { ok: true, method: 'rpc_exists' };
      return { ok: false, error: error.message, method: 'rpc' };
    }
  } catch { /* RPC not available, try next */ }

  // Method 2: REST RPC
  try {
    const res = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': serviceRoleKey,
        'Authorization': `Bearer ${serviceRoleKey}`,
        'Prefer': 'return=minimal',
      },
      body: JSON.stringify({ query: sql }),
    });
    if (res.ok) return { ok: true, method: 'rest_rpc' };
  } catch { /* not available */ }

  return { ok: false, error: 'No SQL execution method available', method: 'none' };
}

async function migrate() {
  const sb = getSupabase();
  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.SUPABASE_URL ||
    '';
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

  const results: Array<{ table: string; status: string; error?: string; method?: string }> = [];

  for (const block of DDL_BLOCKS) {
    // Check if table already exists
    const { error: selectErr } = await sb.from(block.name).select('id').limit(0);
    if (!selectErr) {
      results.push({ table: block.name, status: 'exists', method: 'select' });
      continue;
    }

    // Table doesn't exist — try to create it
    const r = await runSQL(sb, block.sql, supabaseUrl, serviceRoleKey);
    if (r.ok) {
      results.push({ table: block.name, status: 'created', method: r.method });
    } else {
      results.push({ table: block.name, status: 'missing', error: r.error, method: r.method });
    }
  }

  // Refresh PostgREST schema cache
  try {
    await sb.rpc('exec_sql', { query: "NOTIFY pgrst, 'reload schema'" });
  } catch { /* non-fatal */ }

  const created = results.filter(r => r.status === 'created').length;
  const existing = results.filter(r => r.status === 'exists').length;
  const missing = results.filter(r => r.status === 'missing').length;

  const missingNames = new Set(results.filter(r => r.status === 'missing').map(r => r.table));
  const manualSQL =
    missingNames.size > 0
      ? DDL_BLOCKS.filter(b => missingNames.has(b.name))
          .map(b => `-- ${b.name}\n${b.sql.trim()}`)
          .join('\n\n') + "\n\nNOTIFY pgrst, 'reload schema';"
      : null;

  return {
    summary: `${created} created, ${existing} already exist, ${missing} missing (need manual SQL)`,
    tables: results,
    manualSQL,
    instructions: manualSQL
      ? 'Some tables could not be auto-created. Copy the manualSQL field and run it in the Supabase SQL Editor → New Query → Run.'
      : 'Visual generation tables are ready.',
  };
}

export async function GET() {
  return NextResponse.json(await migrate());
}
