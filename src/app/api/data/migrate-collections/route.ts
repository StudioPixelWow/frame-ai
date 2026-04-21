/**
 * GET /api/data/migrate-collections
 *
 * Creates all 13 Supabase tables needed for the SupabaseCrud migration.
 * Each table uses the generic (id TEXT, data JSONB) pattern.
 *
 * Run this ONCE after deploy to create the tables, then optionally
 * run NOTIFY pgrst, 'reload schema' to refresh PostgREST cache.
 *
 * Safe to run multiple times — uses CREATE TABLE IF NOT EXISTS.
 */

import { NextResponse } from 'next/server';
import { getSupabase } from '@/lib/db/store';

export const dynamic = 'force-dynamic';

const TABLES = [
  'app_leads',
  'app_campaigns',
  'app_client_gantt_items',
  'app_client_tasks',
  'app_employee_tasks',
  'app_approvals',
  'app_client_files',
  'app_payments',
  'app_mailings',
  'app_whatsapp_messages',
  'app_podcast_sessions',
  'app_meetings',
  'app_follow_up_reminders',
  'app_creative_dna',
  'app_client_knowledge',
  'app_client_insights',
  'app_accountant_documents',
];

export async function GET() {
  const sb = getSupabase();
  const results: Array<{ table: string; status: string; error?: string }> = [];

  for (const table of TABLES) {
    const ddl = `
      CREATE TABLE IF NOT EXISTS public.${table} (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        data JSONB NOT NULL DEFAULT '{}',
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `;

    try {
      const { error } = await sb.rpc('exec_sql', { query: ddl });
      if (error) {
        // Try direct SQL if rpc not available
        if (error.message.includes('function') || error.message.includes('does not exist')) {
          results.push({ table, status: 'skip_no_rpc', error: 'exec_sql RPC not available — create tables manually' });
        } else if (error.message.includes('already exists')) {
          results.push({ table, status: 'exists' });
        } else {
          results.push({ table, status: 'error', error: error.message });
        }
      } else {
        results.push({ table, status: 'created' });
      }
    } catch (err) {
      results.push({ table, status: 'error', error: err instanceof Error ? err.message : 'Unknown' });
    }
  }

  // Refresh PostgREST schema cache
  try {
    await sb.rpc('exec_sql', { query: "NOTIFY pgrst, 'reload schema'" });
  } catch {
    // non-fatal
  }

  const created = results.filter(r => r.status === 'created').length;
  const existing = results.filter(r => r.status === 'exists').length;
  const errors = results.filter(r => r.status === 'error').length;

  return NextResponse.json({
    summary: `${created} created, ${existing} already exist, ${errors} errors`,
    tables: results,
    manualDDL: errors > 0 || results.some(r => r.status === 'skip_no_rpc')
      ? TABLES.map(t => `CREATE TABLE IF NOT EXISTS public.${t} (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), data JSONB NOT NULL DEFAULT '{}', created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW());`).join('\n')
      : null,
  });
}
