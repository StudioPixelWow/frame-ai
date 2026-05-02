/**
 * POST /api/data/meta-sync/migrate
 *
 * Adds Meta connection columns to clients table and meta sync columns
 * to campaigns, ad sets, and ads tables. Idempotent — safe to call multiple times.
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/api-guard';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
);

const MIGRATIONS = [
  // Client Meta connection fields
  `ALTER TABLE clients ADD COLUMN IF NOT EXISTS meta_business_id text DEFAULT ''`,
  `ALTER TABLE clients ADD COLUMN IF NOT EXISTS meta_ad_account_id text DEFAULT ''`,
  `ALTER TABLE clients ADD COLUMN IF NOT EXISTS meta_access_token text DEFAULT ''`,
  `ALTER TABLE clients ADD COLUMN IF NOT EXISTS meta_page_id text DEFAULT ''`,
  `ALTER TABLE clients ADD COLUMN IF NOT EXISTS meta_instagram_account_id text DEFAULT ''`,
  `ALTER TABLE clients ADD COLUMN IF NOT EXISTS meta_pixel_id text DEFAULT ''`,
  `ALTER TABLE clients ADD COLUMN IF NOT EXISTS meta_connection_status text DEFAULT 'not_connected'`,
  `ALTER TABLE clients ADD COLUMN IF NOT EXISTS meta_last_synced_at timestamptz`,
  `ALTER TABLE clients ADD COLUMN IF NOT EXISTS meta_last_sync_error text DEFAULT ''`,

  // Campaign Meta sync fields
  `ALTER TABLE app_campaigns ADD COLUMN IF NOT EXISTS meta_campaign_id text DEFAULT ''`,
  `ALTER TABLE app_campaigns ADD COLUMN IF NOT EXISTS meta_sync_source text DEFAULT 'local'`,
  `ALTER TABLE app_campaigns ADD COLUMN IF NOT EXISTS last_synced_at timestamptz`,

  // Ad Set Meta sync fields
  `ALTER TABLE app_ad_sets ADD COLUMN IF NOT EXISTS meta_ad_set_id text DEFAULT ''`,
  `ALTER TABLE app_ad_sets ADD COLUMN IF NOT EXISTS last_synced_at timestamptz`,

  // Ad Meta sync fields + extra metrics
  `ALTER TABLE app_ads ADD COLUMN IF NOT EXISTS meta_ad_id text DEFAULT ''`,
  `ALTER TABLE app_ads ADD COLUMN IF NOT EXISTS last_synced_at timestamptz`,
  `ALTER TABLE app_ads ADD COLUMN IF NOT EXISTS reach integer DEFAULT 0`,
  `ALTER TABLE app_ads ADD COLUMN IF NOT EXISTS frequency numeric DEFAULT 0`,
  `ALTER TABLE app_ads ADD COLUMN IF NOT EXISTS cpm numeric DEFAULT 0`,

  // Index for fast meta ID lookups (upsert by meta ID)
  `CREATE INDEX IF NOT EXISTS idx_campaigns_meta_id ON app_campaigns (meta_campaign_id) WHERE meta_campaign_id != ''`,
  `CREATE INDEX IF NOT EXISTS idx_ad_sets_meta_id ON app_ad_sets (meta_ad_set_id) WHERE meta_ad_set_id != ''`,
  `CREATE INDEX IF NOT EXISTS idx_ads_meta_id ON app_ads (meta_ad_id) WHERE meta_ad_id != ''`,
];

export async function POST(req: NextRequest) {
  const roleErr = requireRole(req, 'admin');
  if (roleErr) return roleErr;

  const results: { sql: string; status: 'ok' | 'error'; error?: string }[] = [];

  for (const sql of MIGRATIONS) {
    try {
      const { error } = await supabase.rpc('exec_sql', { query: sql });
      if (error) {
        // Try raw query as fallback
        const { error: rawErr } = await supabase.from('_migrations_log').select('id').limit(0);
        // If exec_sql isn't available, log the SQL for manual execution
        results.push({ sql: sql.substring(0, 80) + '...', status: 'error', error: error.message });
      } else {
        results.push({ sql: sql.substring(0, 80) + '...', status: 'ok' });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown';
      results.push({ sql: sql.substring(0, 80) + '...', status: 'error', error: msg });
    }
  }

  const successCount = results.filter(r => r.status === 'ok').length;
  const errorCount = results.filter(r => r.status === 'error').length;

  return NextResponse.json({
    success: errorCount === 0,
    message: `${successCount} migrations succeeded, ${errorCount} failed`,
    results,
  });
}
