/**
 * GET /api/seo/migrate
 *
 * Creates all 14 SEO/GEO tables + indexes in Supabase.
 * Safe to run multiple times — all DDL uses IF NOT EXISTS.
 *
 * If exec_sql RPC is not available, returns the full SQL for manual execution
 * in the Supabase SQL Editor.
 */

import { NextResponse } from 'next/server';
import { getSupabase } from '@/lib/db/store';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// Each entry is a named DDL block. We run them sequentially so FK references resolve.
const DDL_BLOCKS: Array<{ name: string; sql: string }> = [
  // ── SupabaseCrud JSONB tables (used by /api/data/seo-plans etc.) ───
  {
    name: 'app_seo_plans',
    sql: `
      CREATE TABLE IF NOT EXISTS public.app_seo_plans (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        data JSONB NOT NULL DEFAULT '{}',
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `,
  },
  {
    name: 'app_seo_websites',
    sql: `
      CREATE TABLE IF NOT EXISTS public.app_seo_websites (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        data JSONB NOT NULL DEFAULT '{}',
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `,
  },
  {
    name: 'app_seo_growth_tasks',
    sql: `
      CREATE TABLE IF NOT EXISTS public.app_seo_growth_tasks (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        data JSONB NOT NULL DEFAULT '{}',
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `,
  },
  // ── Relational tables ─────────────────────────────────────────────
  {
    name: 'seo_client_websites',
    sql: `
      CREATE TABLE IF NOT EXISTS public.seo_client_websites (
        id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        client_id       TEXT NOT NULL,
        url             TEXT NOT NULL,
        domain          TEXT,
        label           TEXT DEFAULT '',
        is_primary      BOOLEAN DEFAULT false,
        status          TEXT DEFAULT 'active',
        verified_at     TIMESTAMPTZ,
        metadata        JSONB DEFAULT '{}',
        created_at      TIMESTAMPTZ DEFAULT now(),
        updated_at      TIMESTAMPTZ DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS idx_seo_client_websites_client ON public.seo_client_websites (client_id);
      CREATE INDEX IF NOT EXISTS idx_seo_client_websites_domain ON public.seo_client_websites (domain);
    `,
  },
  {
    name: 'seo_geo_plans',
    sql: `
      CREATE TABLE IF NOT EXISTS public.seo_geo_plans (
        id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        client_id       TEXT NOT NULL,
        website_id      UUID,
        website_url     TEXT NOT NULL,
        plan_name       TEXT DEFAULT '',
        status          TEXT DEFAULT 'draft',
        plan_type       TEXT DEFAULT 'seo_geo',
        duration_days   INTEGER DEFAULT 60,
        overall_score       INTEGER DEFAULT 0,
        technical_score     INTEGER DEFAULT 0,
        content_score       INTEGER DEFAULT 0,
        visibility_score    INTEGER DEFAULT 0,
        local_score         INTEGER DEFAULT 0,
        total_tasks         INTEGER DEFAULT 0,
        completed_tasks     INTEGER DEFAULT 0,
        target_market       TEXT DEFAULT 'IL',
        target_languages    TEXT[] DEFAULT ARRAY['he'],
        industry            TEXT DEFAULT '',
        budget_monthly      NUMERIC(12,2) DEFAULT 0,
        assigned_manager_id TEXT,
        started_at      TIMESTAMPTZ,
        completed_at    TIMESTAMPTZ,
        archived_at     TIMESTAMPTZ,
        created_at      TIMESTAMPTZ DEFAULT now(),
        updated_at      TIMESTAMPTZ DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS idx_seo_geo_plans_client ON public.seo_geo_plans (client_id);
      CREATE INDEX IF NOT EXISTS idx_seo_geo_plans_website ON public.seo_geo_plans (website_id);
      CREATE INDEX IF NOT EXISTS idx_seo_geo_plans_status ON public.seo_geo_plans (status);
      CREATE INDEX IF NOT EXISTS idx_seo_geo_plans_manager ON public.seo_geo_plans (assigned_manager_id);
    `,
  },
  {
    name: 'seo_plan_goals',
    sql: `
      CREATE TABLE IF NOT EXISTS public.seo_plan_goals (
        id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        plan_id         UUID NOT NULL REFERENCES public.seo_geo_plans(id) ON DELETE CASCADE,
        goal_type       TEXT NOT NULL,
        label           TEXT NOT NULL,
        description     TEXT DEFAULT '',
        target_metric   TEXT DEFAULT '',
        current_value   NUMERIC(14,2) DEFAULT 0,
        target_value    NUMERIC(14,2) DEFAULT 0,
        priority        TEXT DEFAULT 'medium',
        achieved        BOOLEAN DEFAULT false,
        achieved_at     TIMESTAMPTZ,
        created_at      TIMESTAMPTZ DEFAULT now(),
        updated_at      TIMESTAMPTZ DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS idx_seo_plan_goals_plan ON public.seo_plan_goals (plan_id);
    `,
  },
  {
    name: 'seo_website_scans',
    sql: `
      CREATE TABLE IF NOT EXISTS public.seo_website_scans (
        id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        plan_id         UUID REFERENCES public.seo_geo_plans(id) ON DELETE SET NULL,
        website_id      UUID REFERENCES public.seo_client_websites(id) ON DELETE SET NULL,
        url             TEXT NOT NULL,
        scan_status     TEXT DEFAULT 'pending',
        has_ssl         BOOLEAN DEFAULT false,
        load_time_ms    INTEGER DEFAULT 0,
        mobile_score    INTEGER DEFAULT 0,
        desktop_score   INTEGER DEFAULT 0,
        accessibility_score INTEGER DEFAULT 0,
        seo_score       INTEGER DEFAULT 0,
        meta_title      TEXT DEFAULT '',
        meta_description TEXT DEFAULT '',
        canonical_url   TEXT,
        total_pages     INTEGER DEFAULT 0,
        indexed_pages   INTEGER DEFAULT 0,
        broken_links    INTEGER DEFAULT 0,
        total_images    INTEGER DEFAULT 0,
        images_without_alt INTEGER DEFAULT 0,
        has_robots_txt  BOOLEAN DEFAULT false,
        has_sitemap     BOOLEAN DEFAULT false,
        has_structured_data BOOLEAN DEFAULT false,
        has_open_graph  BOOLEAN DEFAULT false,
        has_canonical_tags BOOLEAN DEFAULT false,
        has_hreflang    BOOLEAN DEFAULT false,
        domain_authority INTEGER DEFAULT 0,
        page_authority   INTEGER DEFAULT 0,
        backlink_count   INTEGER DEFAULT 0,
        referring_domains INTEGER DEFAULT 0,
        h1_tags         JSONB DEFAULT '[]',
        tech_stack      JSONB DEFAULT '[]',
        cms_detected    TEXT DEFAULT '',
        issues          JSONB DEFAULT '[]',
        raw_data        JSONB DEFAULT '{}',
        scan_started_at TIMESTAMPTZ,
        scan_completed_at TIMESTAMPTZ,
        scan_duration_ms INTEGER DEFAULT 0,
        created_at      TIMESTAMPTZ DEFAULT now(),
        updated_at      TIMESTAMPTZ DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS idx_seo_website_scans_plan ON public.seo_website_scans (plan_id);
      CREATE INDEX IF NOT EXISTS idx_seo_website_scans_website ON public.seo_website_scans (website_id);
      CREATE INDEX IF NOT EXISTS idx_seo_website_scans_status ON public.seo_website_scans (scan_status);
    `,
  },
  {
    name: 'seo_scanned_pages',
    sql: `
      CREATE TABLE IF NOT EXISTS public.seo_scanned_pages (
        id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        scan_id         UUID NOT NULL REFERENCES public.seo_website_scans(id) ON DELETE CASCADE,
        url             TEXT NOT NULL,
        path            TEXT DEFAULT '/',
        http_status     INTEGER DEFAULT 200,
        page_title      TEXT DEFAULT '',
        meta_description TEXT DEFAULT '',
        h1              TEXT DEFAULT '',
        word_count      INTEGER DEFAULT 0,
        load_time_ms    INTEGER DEFAULT 0,
        seo_score       INTEGER DEFAULT 0,
        content_score   INTEGER DEFAULT 0,
        has_canonical   BOOLEAN DEFAULT false,
        has_schema      BOOLEAN DEFAULT false,
        is_indexed      BOOLEAN DEFAULT true,
        issues          JSONB DEFAULT '[]',
        internal_links_in  INTEGER DEFAULT 0,
        internal_links_out INTEGER DEFAULT 0,
        external_links_out INTEGER DEFAULT 0,
        created_at      TIMESTAMPTZ DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS idx_seo_scanned_pages_scan ON public.seo_scanned_pages (scan_id);
      CREATE INDEX IF NOT EXISTS idx_seo_scanned_pages_status ON public.seo_scanned_pages (http_status);
    `,
  },
  {
    name: 'seo_ai_questions',
    sql: `
      CREATE TABLE IF NOT EXISTS public.seo_ai_questions (
        id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        plan_id         UUID NOT NULL REFERENCES public.seo_geo_plans(id) ON DELETE CASCADE,
        query_text      TEXT NOT NULL,
        category        TEXT DEFAULT 'general',
        intent          TEXT DEFAULT 'informational',
        importance      TEXT DEFAULT 'medium',
        source          TEXT DEFAULT 'manual',
        is_active       BOOLEAN DEFAULT true,
        sort_order      INTEGER DEFAULT 0,
        created_at      TIMESTAMPTZ DEFAULT now(),
        updated_at      TIMESTAMPTZ DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS idx_seo_ai_questions_plan ON public.seo_ai_questions (plan_id);
    `,
  },
  {
    name: 'seo_ai_visibility_results',
    sql: `
      CREATE TABLE IF NOT EXISTS public.seo_ai_visibility_results (
        id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        plan_id         UUID NOT NULL REFERENCES public.seo_geo_plans(id) ON DELETE CASCADE,
        question_id     UUID NOT NULL REFERENCES public.seo_ai_questions(id) ON DELETE CASCADE,
        scan_run_id     UUID,
        engine          TEXT NOT NULL,
        mentioned       BOOLEAN DEFAULT false,
        mention_position INTEGER,
        mention_context TEXT DEFAULT '',
        sentiment       TEXT DEFAULT 'not_mentioned',
        competitors_mentioned JSONB DEFAULT '[]',
        our_rank_vs_competitors INTEGER,
        response_length INTEGER DEFAULT 0,
        response_hash   TEXT,
        raw_response    JSONB DEFAULT '{}',
        scanned_at      TIMESTAMPTZ DEFAULT now(),
        latency_ms      INTEGER DEFAULT 0,
        created_at      TIMESTAMPTZ DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS idx_seo_ai_visibility_plan ON public.seo_ai_visibility_results (plan_id);
      CREATE INDEX IF NOT EXISTS idx_seo_ai_visibility_question ON public.seo_ai_visibility_results (question_id);
      CREATE INDEX IF NOT EXISTS idx_seo_ai_visibility_engine ON public.seo_ai_visibility_results (engine);
      CREATE INDEX IF NOT EXISTS idx_seo_ai_visibility_scan_run ON public.seo_ai_visibility_results (scan_run_id);
    `,
  },
  {
    name: 'seo_competitors',
    sql: `
      CREATE TABLE IF NOT EXISTS public.seo_competitors (
        id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        plan_id         UUID NOT NULL REFERENCES public.seo_geo_plans(id) ON DELETE CASCADE,
        name            TEXT NOT NULL,
        website_url     TEXT NOT NULL,
        domain          TEXT,
        domain_authority INTEGER DEFAULT 0,
        estimated_traffic INTEGER DEFAULT 0,
        keyword_overlap  INTEGER DEFAULT 0,
        content_score    INTEGER DEFAULT 0,
        ai_visibility_score INTEGER DEFAULT 0,
        strengths       JSONB DEFAULT '[]',
        weaknesses      JSONB DEFAULT '[]',
        notes           TEXT DEFAULT '',
        is_active       BOOLEAN DEFAULT true,
        created_at      TIMESTAMPTZ DEFAULT now(),
        updated_at      TIMESTAMPTZ DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS idx_seo_competitors_plan ON public.seo_competitors (plan_id);
    `,
  },
  {
    name: 'seo_content_gaps',
    sql: `
      CREATE TABLE IF NOT EXISTS public.seo_content_gaps (
        id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        plan_id         UUID NOT NULL REFERENCES public.seo_geo_plans(id) ON DELETE CASCADE,
        keyword         TEXT NOT NULL,
        search_volume   INTEGER DEFAULT 0,
        difficulty      INTEGER DEFAULT 0,
        current_position INTEGER,
        gap_type        TEXT DEFAULT 'missing',
        category        TEXT DEFAULT 'general',
        estimated_traffic INTEGER DEFAULT 0,
        priority        TEXT DEFAULT 'medium',
        suggested_content_type TEXT DEFAULT 'article',
        suggested_title TEXT DEFAULT '',
        suggested_outline JSONB DEFAULT '[]',
        competitor_urls JSONB DEFAULT '[]',
        status          TEXT DEFAULT 'identified',
        task_id         UUID,
        created_at      TIMESTAMPTZ DEFAULT now(),
        updated_at      TIMESTAMPTZ DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS idx_seo_content_gaps_plan ON public.seo_content_gaps (plan_id);
      CREATE INDEX IF NOT EXISTS idx_seo_content_gaps_status ON public.seo_content_gaps (status);
      CREATE INDEX IF NOT EXISTS idx_seo_content_gaps_priority ON public.seo_content_gaps (priority);
    `,
  },
  {
    name: 'seo_growth_plan_days',
    sql: `
      CREATE TABLE IF NOT EXISTS public.seo_growth_plan_days (
        id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        plan_id         UUID NOT NULL REFERENCES public.seo_geo_plans(id) ON DELETE CASCADE,
        day_number      INTEGER NOT NULL,
        week_number     INTEGER NOT NULL,
        calendar_date   DATE,
        theme           TEXT DEFAULT '',
        focus           TEXT DEFAULT '',
        status          TEXT DEFAULT 'pending',
        notes           TEXT DEFAULT '',
        completed_at    TIMESTAMPTZ,
        created_at      TIMESTAMPTZ DEFAULT now(),
        updated_at      TIMESTAMPTZ DEFAULT now(),
        UNIQUE (plan_id, day_number)
      );
      CREATE INDEX IF NOT EXISTS idx_seo_growth_plan_days_plan ON public.seo_growth_plan_days (plan_id);
      CREATE INDEX IF NOT EXISTS idx_seo_growth_plan_days_date ON public.seo_growth_plan_days (calendar_date);
      CREATE INDEX IF NOT EXISTS idx_seo_growth_plan_days_status ON public.seo_growth_plan_days (status);
    `,
  },
  {
    name: 'seo_growth_tasks',
    sql: `
      CREATE TABLE IF NOT EXISTS public.seo_growth_tasks (
        id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        plan_id         UUID NOT NULL REFERENCES public.seo_geo_plans(id) ON DELETE CASCADE,
        day_id          UUID REFERENCES public.seo_growth_plan_days(id) ON DELETE SET NULL,
        day_number      INTEGER NOT NULL,
        sort_order      INTEGER DEFAULT 0,
        title           TEXT NOT NULL,
        description     TEXT DEFAULT '',
        category        TEXT DEFAULT 'general',
        priority        TEXT DEFAULT 'medium',
        estimated_hours NUMERIC(5,2) DEFAULT 1,
        actual_hours    NUMERIC(5,2),
        assigned_to     TEXT,
        assigned_at     TIMESTAMPTZ,
        status          TEXT DEFAULT 'pending',
        blocked_reason  TEXT,
        deliverable     TEXT DEFAULT '',
        kpi_target      TEXT DEFAULT '',
        kpi_actual      TEXT,
        content_gap_id  UUID,
        related_url     TEXT,
        attachments     JSONB DEFAULT '[]',
        completed_at    TIMESTAMPTZ,
        completed_by    TEXT,
        completion_notes TEXT DEFAULT '',
        is_recurring    BOOLEAN DEFAULT false,
        recurrence_rule TEXT,
        created_at      TIMESTAMPTZ DEFAULT now(),
        updated_at      TIMESTAMPTZ DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS idx_seo_growth_tasks_plan ON public.seo_growth_tasks (plan_id);
      CREATE INDEX IF NOT EXISTS idx_seo_growth_tasks_day ON public.seo_growth_tasks (day_id);
      CREATE INDEX IF NOT EXISTS idx_seo_growth_tasks_status ON public.seo_growth_tasks (status);
      CREATE INDEX IF NOT EXISTS idx_seo_growth_tasks_assigned ON public.seo_growth_tasks (assigned_to);
      CREATE INDEX IF NOT EXISTS idx_seo_growth_tasks_category ON public.seo_growth_tasks (category);
      CREATE INDEX IF NOT EXISTS idx_seo_growth_tasks_day_number ON public.seo_growth_tasks (plan_id, day_number);
    `,
  },
  {
    name: 'seo_ai_reports',
    sql: `
      CREATE TABLE IF NOT EXISTS public.seo_ai_reports (
        id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        plan_id         UUID NOT NULL REFERENCES public.seo_geo_plans(id) ON DELETE CASCADE,
        client_id       TEXT NOT NULL,
        report_type     TEXT NOT NULL,
        title           TEXT NOT NULL,
        description     TEXT DEFAULT '',
        summary         TEXT DEFAULT '',
        sections        JSONB DEFAULT '[]',
        key_metrics     JSONB DEFAULT '{}',
        recommendations JSONB DEFAULT '[]',
        period_start    DATE,
        period_end      DATE,
        pdf_url         TEXT,
        pdf_storage_key TEXT,
        pdf_generated_at TIMESTAMPTZ,
        status          TEXT DEFAULT 'draft',
        sent_to         JSONB DEFAULT '[]',
        generated_by    TEXT DEFAULT 'system',
        language        TEXT DEFAULT 'he',
        created_at      TIMESTAMPTZ DEFAULT now(),
        updated_at      TIMESTAMPTZ DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS idx_seo_ai_reports_plan ON public.seo_ai_reports (plan_id);
      CREATE INDEX IF NOT EXISTS idx_seo_ai_reports_client ON public.seo_ai_reports (client_id);
      CREATE INDEX IF NOT EXISTS idx_seo_ai_reports_type ON public.seo_ai_reports (report_type);
      CREATE INDEX IF NOT EXISTS idx_seo_ai_reports_status ON public.seo_ai_reports (status);
    `,
  },
  {
    name: 'seo_activity_logs',
    sql: `
      CREATE TABLE IF NOT EXISTS public.seo_activity_logs (
        id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        plan_id         UUID REFERENCES public.seo_geo_plans(id) ON DELETE SET NULL,
        client_id       TEXT,
        action          TEXT NOT NULL,
        entity_type     TEXT,
        entity_id       UUID,
        description     TEXT DEFAULT '',
        old_value       JSONB,
        new_value       JSONB,
        metadata        JSONB DEFAULT '{}',
        performed_by    TEXT,
        performed_by_name TEXT DEFAULT '',
        ip_address      TEXT,
        created_at      TIMESTAMPTZ DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS idx_seo_activity_logs_plan ON public.seo_activity_logs (plan_id);
      CREATE INDEX IF NOT EXISTS idx_seo_activity_logs_client ON public.seo_activity_logs (client_id);
      CREATE INDEX IF NOT EXISTS idx_seo_activity_logs_action ON public.seo_activity_logs (action);
      CREATE INDEX IF NOT EXISTS idx_seo_activity_logs_created ON public.seo_activity_logs (created_at DESC);
    `,
  },
  {
    name: 'seo_scheduled_scans',
    sql: `
      CREATE TABLE IF NOT EXISTS public.seo_scheduled_scans (
        id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        plan_id         UUID REFERENCES public.seo_geo_plans(id) ON DELETE CASCADE,
        website_id      UUID REFERENCES public.seo_client_websites(id) ON DELETE CASCADE,
        scan_type       TEXT NOT NULL,
        frequency       TEXT DEFAULT 'weekly',
        next_run_at     TIMESTAMPTZ,
        last_run_at     TIMESTAMPTZ,
        last_scan_id    UUID,
        is_active       BOOLEAN DEFAULT true,
        run_count       INTEGER DEFAULT 0,
        max_runs        INTEGER,
        notify_on_complete BOOLEAN DEFAULT true,
        notify_emails   JSONB DEFAULT '[]',
        config          JSONB DEFAULT '{}',
        created_at      TIMESTAMPTZ DEFAULT now(),
        updated_at      TIMESTAMPTZ DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS idx_seo_scheduled_scans_plan ON public.seo_scheduled_scans (plan_id);
      CREATE INDEX IF NOT EXISTS idx_seo_scheduled_scans_next_run ON public.seo_scheduled_scans (next_run_at) WHERE is_active = true;
    `,
  },
];

/** Run a single SQL block — tries exec_sql RPC first, then raw fetch to /sql endpoint */
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
    if (!error.message.includes('function') && !error.message.includes('does not exist') && !error.message.includes('could not find')) {
      if (error.message.includes('already exists')) return { ok: true, method: 'rpc_exists' };
      return { ok: false, error: error.message, method: 'rpc' };
    }
  } catch { /* RPC not available, try next */ }

  // Method 2: Direct SQL via Supabase REST (service_role key)
  // Supabase exposes /rest/v1/ for PostgREST, but we can POST raw SQL to the
  // /pg endpoint (available in Supabase platform) or use the raw PostgreSQL HTTP.
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
  } catch { /* not available, try next */ }

  // Method 3: Try creating the table by inserting a dummy row and letting Supabase auto-create
  // (This only works for the simple JSONB tables, not the relational ones)

  return { ok: false, error: 'No SQL execution method available', method: 'none' };
}

export async function GET() {
  const sb = getSupabase();
  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.SUPABASE_URL ||
    'https://uaruggdabeyiuppcvbbi.supabase.co';
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

  const results: Array<{ table: string; status: string; error?: string; method?: string }> = [];

  // ── First, try to create the critical JSONB tables (app_seo_plans etc.) ──
  // These are simple tables — try direct PostgREST insert to see if they exist
  const jsonbTables = DDL_BLOCKS.filter(b => b.name.startsWith('app_'));
  const relationalTables = DDL_BLOCKS.filter(b => !b.name.startsWith('app_'));

  // For JSONB tables: check if accessible, if not try to create via SQL
  for (const block of jsonbTables) {
    // Check if table already exists by trying a SELECT
    const { error: selectErr } = await sb.from(block.name).select('id').limit(0);
    if (!selectErr) {
      results.push({ table: block.name, status: 'exists', method: 'select' });
      continue;
    }

    // Table doesn't exist — try SQL methods
    const r = await runSQL(sb, block.sql, supabaseUrl, serviceRoleKey);
    if (r.ok) {
      results.push({ table: block.name, status: 'created', method: r.method });
    } else {
      results.push({ table: block.name, status: 'missing', error: r.error, method: r.method });
    }
  }

  // For relational tables: same approach
  for (const block of relationalTables) {
    const { error: selectErr } = await sb.from(block.name).select('id').limit(0);
    if (!selectErr) {
      results.push({ table: block.name, status: 'exists', method: 'select' });
      continue;
    }

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

  // Generate manual DDL for missing tables only
  const missingNames = new Set(results.filter(r => r.status === 'missing').map(r => r.table));
  const manualSQL = missingNames.size > 0
    ? DDL_BLOCKS
        .filter(b => missingNames.has(b.name))
        .map(b => `-- ${b.name}\n${b.sql.trim()}`)
        .join('\n\n') + "\n\nNOTIFY pgrst, 'reload schema';"
    : null;

  return NextResponse.json({
    summary: `${created} created, ${existing} already exist, ${missing} missing (need manual SQL)`,
    tables: results,
    manualSQL,
    instructions: manualSQL
      ? 'הטבלאות החסרות לא ניתנות ליצירה אוטומטית. העתק את שדה manualSQL והרץ אותו ב-Supabase SQL Editor → New Query → Run.'
      : 'כל הטבלאות קיימות ✅',
  });
}
