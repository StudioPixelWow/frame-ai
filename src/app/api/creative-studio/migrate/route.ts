/**
 * GET /api/creative-studio/migrate  (also accepts POST for backward compat)
 *
 * Creates all 14 PIXEL Creative Studio JSONB tables in Supabase.
 * Safe to run multiple times — all DDL uses IF NOT EXISTS.
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
    name: 'app_brand_assets',
    sql: `
      CREATE TABLE IF NOT EXISTS public.app_brand_assets (
        id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        data        JSONB NOT NULL DEFAULT '{}',
        created_at  TIMESTAMPTZ DEFAULT NOW(),
        updated_at  TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_app_brand_assets_client
        ON public.app_brand_assets ((data->>'clientId'));
      CREATE INDEX IF NOT EXISTS idx_app_brand_assets_type
        ON public.app_brand_assets ((data->>'assetType'));
    `,
  },
  {
    name: 'app_brand_style_profiles',
    sql: `
      CREATE TABLE IF NOT EXISTS public.app_brand_style_profiles (
        id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        data        JSONB NOT NULL DEFAULT '{}',
        created_at  TIMESTAMPTZ DEFAULT NOW(),
        updated_at  TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_app_brand_style_profiles_client
        ON public.app_brand_style_profiles ((data->>'clientId'));
      CREATE INDEX IF NOT EXISTS idx_app_brand_style_profiles_status
        ON public.app_brand_style_profiles ((data->>'profileStatus'));
    `,
  },
  {
    name: 'app_creative_feedback',
    sql: `
      CREATE TABLE IF NOT EXISTS public.app_creative_feedback (
        id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        data        JSONB NOT NULL DEFAULT '{}',
        created_at  TIMESTAMPTZ DEFAULT NOW(),
        updated_at  TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_app_creative_feedback_client
        ON public.app_creative_feedback ((data->>'clientId'));
      CREATE INDEX IF NOT EXISTS idx_app_creative_feedback_asset
        ON public.app_creative_feedback ((data->>'assetId'));
      CREATE INDEX IF NOT EXISTS idx_app_creative_feedback_type
        ON public.app_creative_feedback ((data->>'feedbackType'));
    `,
  },
  {
    name: 'app_creative_briefs',
    sql: `
      CREATE TABLE IF NOT EXISTS public.app_creative_briefs (
        id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        data        JSONB NOT NULL DEFAULT '{}',
        created_at  TIMESTAMPTZ DEFAULT NOW(),
        updated_at  TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_app_creative_briefs_client
        ON public.app_creative_briefs ((data->>'clientId'));
      CREATE INDEX IF NOT EXISTS idx_app_creative_briefs_status
        ON public.app_creative_briefs ((data->>'status'));
    `,
  },
  {
    name: 'app_creative_outputs',
    sql: `
      CREATE TABLE IF NOT EXISTS public.app_creative_outputs (
        id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        data        JSONB NOT NULL DEFAULT '{}',
        created_at  TIMESTAMPTZ DEFAULT NOW(),
        updated_at  TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_app_creative_outputs_client
        ON public.app_creative_outputs ((data->>'clientId'));
      CREATE INDEX IF NOT EXISTS idx_app_creative_outputs_brief
        ON public.app_creative_outputs ((data->>'briefId'));
      CREATE INDEX IF NOT EXISTS idx_app_creative_outputs_status
        ON public.app_creative_outputs ((data->>'status'));
    `,
  },
  {
    name: 'app_brand_analysis_jobs',
    sql: `
      CREATE TABLE IF NOT EXISTS public.app_brand_analysis_jobs (
        id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        data        JSONB NOT NULL DEFAULT '{}',
        created_at  TIMESTAMPTZ DEFAULT NOW(),
        updated_at  TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_app_brand_analysis_jobs_client
        ON public.app_brand_analysis_jobs ((data->>'clientId'));
      CREATE INDEX IF NOT EXISTS idx_app_brand_analysis_jobs_status
        ON public.app_brand_analysis_jobs ((data->>'status'));
    `,
  },
  {
    name: 'app_creative_concepts',
    sql: `
      CREATE TABLE IF NOT EXISTS public.app_creative_concepts (
        id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        data        JSONB NOT NULL DEFAULT '{}',
        created_at  TIMESTAMPTZ DEFAULT NOW(),
        updated_at  TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_app_creative_concepts_entity
        ON public.app_creative_concepts ((data->>'entityId'));
      CREATE INDEX IF NOT EXISTS idx_app_creative_concepts_type
        ON public.app_creative_concepts ((data->>'conceptType'));
      CREATE INDEX IF NOT EXISTS idx_app_creative_concepts_approved
        ON public.app_creative_concepts ((data->>'isApproved'));
    `,
  },
  {
    name: 'app_design_sets',
    sql: `
      CREATE TABLE IF NOT EXISTS public.app_design_sets (
        id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        data        JSONB NOT NULL DEFAULT '{}',
        created_at  TIMESTAMPTZ DEFAULT NOW(),
        updated_at  TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_app_design_sets_client
        ON public.app_design_sets ((data->>'clientId'));
      CREATE INDEX IF NOT EXISTS idx_app_design_sets_entity
        ON public.app_design_sets ((data->>'entityId'));
      CREATE INDEX IF NOT EXISTS idx_app_design_sets_concept
        ON public.app_design_sets ((data->>'conceptId'));
      CREATE INDEX IF NOT EXISTS idx_app_design_sets_status
        ON public.app_design_sets ((data->>'status'));
    `,
  },
  {
    name: 'app_design_variants',
    sql: `
      CREATE TABLE IF NOT EXISTS public.app_design_variants (
        id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        data        JSONB NOT NULL DEFAULT '{}',
        created_at  TIMESTAMPTZ DEFAULT NOW(),
        updated_at  TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_app_design_variants_set
        ON public.app_design_variants ((data->>'designSetId'));
      CREATE INDEX IF NOT EXISTS idx_app_design_variants_approved
        ON public.app_design_variants ((data->>'isApproved'));
    `,
  },
  {
    name: 'app_client_visual_assets',
    sql: `
      CREATE TABLE IF NOT EXISTS public.app_client_visual_assets (
        id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        data        JSONB NOT NULL DEFAULT '{}',
        created_at  TIMESTAMPTZ DEFAULT NOW(),
        updated_at  TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_app_client_visual_assets_client
        ON public.app_client_visual_assets ((data->>'clientId'));
      CREATE INDEX IF NOT EXISTS idx_app_client_visual_assets_concept
        ON public.app_client_visual_assets ((data->>'conceptId'));
      CREATE INDEX IF NOT EXISTS idx_app_client_visual_assets_design_set
        ON public.app_client_visual_assets ((data->>'designSetId'));
      CREATE INDEX IF NOT EXISTS idx_app_client_visual_assets_status
        ON public.app_client_visual_assets ((data->>'status'));
      CREATE INDEX IF NOT EXISTS idx_app_client_visual_assets_type
        ON public.app_client_visual_assets ((data->>'assetType'));
    `,
  },
  {
    name: 'app_client_visual_generation_jobs',
    sql: `
      CREATE TABLE IF NOT EXISTS public.app_client_visual_generation_jobs (
        id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        data        JSONB NOT NULL DEFAULT '{}',
        created_at  TIMESTAMPTZ DEFAULT NOW(),
        updated_at  TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_app_client_visual_gen_jobs_client
        ON public.app_client_visual_generation_jobs ((data->>'clientId'));
      CREATE INDEX IF NOT EXISTS idx_app_client_visual_gen_jobs_status
        ON public.app_client_visual_generation_jobs ((data->>'status'));
    `,
  },
  {
    name: 'app_campaign_factory_campaigns',
    sql: `
      CREATE TABLE IF NOT EXISTS public.app_campaign_factory_campaigns (
        id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        data        JSONB NOT NULL DEFAULT '{}',
        created_at  TIMESTAMPTZ DEFAULT NOW(),
        updated_at  TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_app_cf_campaigns_client
        ON public.app_campaign_factory_campaigns ((data->>'clientId'));
      CREATE INDEX IF NOT EXISTS idx_app_cf_campaigns_status
        ON public.app_campaign_factory_campaigns ((data->>'status'));
      CREATE INDEX IF NOT EXISTS idx_app_cf_campaigns_type
        ON public.app_campaign_factory_campaigns ((data->>'campaignType'));
    `,
  },
  {
    name: 'app_campaign_factory_assets',
    sql: `
      CREATE TABLE IF NOT EXISTS public.app_campaign_factory_assets (
        id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        data        JSONB NOT NULL DEFAULT '{}',
        created_at  TIMESTAMPTZ DEFAULT NOW(),
        updated_at  TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_app_cf_assets_campaign
        ON public.app_campaign_factory_assets ((data->>'campaignId'));
      CREATE INDEX IF NOT EXISTS idx_app_cf_assets_client
        ON public.app_campaign_factory_assets ((data->>'clientId'));
      CREATE INDEX IF NOT EXISTS idx_app_cf_assets_status
        ON public.app_campaign_factory_assets ((data->>'status'));
      CREATE INDEX IF NOT EXISTS idx_app_cf_assets_format
        ON public.app_campaign_factory_assets ((data->>'format'));
    `,
  },
  {
    name: 'app_campaign_copy_sets',
    sql: `
      CREATE TABLE IF NOT EXISTS public.app_campaign_copy_sets (
        id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        data        JSONB NOT NULL DEFAULT '{}',
        created_at  TIMESTAMPTZ DEFAULT NOW(),
        updated_at  TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_app_copy_sets_campaign
        ON public.app_campaign_copy_sets ((data->>'campaignId'));
      CREATE INDEX IF NOT EXISTS idx_app_copy_sets_client
        ON public.app_campaign_copy_sets ((data->>'clientId'));
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
      : 'All PIXEL Creative Studio tables are ready.',
  };
}

export async function GET() {
  return NextResponse.json(await migrate());
}

// Keep POST for backward compatibility with the original stub
export async function POST() {
  return NextResponse.json(await migrate());
}
