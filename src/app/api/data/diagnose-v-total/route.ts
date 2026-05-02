/**
 * GET /api/data/diagnose-v-total
 *
 * Diagnostic route to find all references to "v_total" in the Supabase database.
 * Checks: views, functions, triggers, and dependencies.
 *
 * DELETE THIS FILE after the issue is resolved.
 */

import { NextResponse } from 'next/server';
import { getSupabase } from '@/lib/db/store';

export const dynamic = 'force-dynamic';

async function runQuery(sb: ReturnType<typeof getSupabase>, label: string, sql: string) {
  // Try via rpc('exec_sql') with different param names
  for (const paramName of ['sql_text', 'query', 'sql']) {
    const { data, error } = await sb.rpc('exec_sql', { [paramName]: sql });
    if (!error) return { label, data, error: null };
    // If the error is about the function not existing or wrong param, try next
    if (error.message?.includes('exec_sql') || error.message?.includes('param')) continue;
    return { label, data: null, error: error.message };
  }
  return { label, data: null, error: 'exec_sql RPC not available — run these queries in Supabase SQL Editor' };
}

export async function GET() {
  const sb = getSupabase();
  const results: Array<{ label: string; data: unknown; error: string | null }> = [];

  // 1. Check if v_total exists as a view or table
  results.push(await runQuery(sb, 'Check if v_total exists', `
    SELECT table_type, table_schema, table_name
    FROM information_schema.tables
    WHERE table_name = 'v_total';
  `));

  // 2. Find all views in public schema
  results.push(await runQuery(sb, 'All views in public schema', `
    SELECT table_name, view_definition
    FROM information_schema.views
    WHERE table_schema = 'public'
    ORDER BY table_name;
  `));

  // 3. Search for v_total in view definitions
  results.push(await runQuery(sb, 'Views referencing v_total', `
    SELECT table_name, view_definition
    FROM information_schema.views
    WHERE table_schema = 'public'
      AND view_definition ILIKE '%v_total%';
  `));

  // 4. Search for v_total in function bodies
  results.push(await runQuery(sb, 'Functions referencing v_total', `
    SELECT routine_name, routine_type, data_type
    FROM information_schema.routines
    WHERE routine_schema = 'public'
      AND routine_definition ILIKE '%v_total%';
  `));

  // 5. Search pg_proc for v_total references
  results.push(await runQuery(sb, 'pg_proc referencing v_total', `
    SELECT proname, prosrc
    FROM pg_proc
    WHERE pronamespace = 'public'::regnamespace
      AND prosrc ILIKE '%v_total%';
  `));

  // 6. Check pg_depend for dependencies on v_total
  results.push(await runQuery(sb, 'Dependencies involving v_total', `
    SELECT
      d.classid::regclass AS dependent_class,
      d.objid::regclass AS dependent_object,
      d.deptype
    FROM pg_depend d
    JOIN pg_class c ON c.oid = d.refobjid
    WHERE c.relname = 'v_total';
  `));

  // 7. Check triggers
  results.push(await runQuery(sb, 'Triggers referencing v_total', `
    SELECT trigger_name, event_object_table, action_statement
    FROM information_schema.triggers
    WHERE trigger_schema = 'public'
      AND action_statement ILIKE '%v_total%';
  `));

  // 8. Check RLS policies
  results.push(await runQuery(sb, 'Policies referencing v_total', `
    SELECT schemaname, tablename, policyname, qual, with_check
    FROM pg_policies
    WHERE schemaname = 'public'
      AND (qual ILIKE '%v_total%' OR with_check ILIKE '%v_total%');
  `));

  // Also provide the raw SQL for manual use in Supabase SQL Editor
  const manualSql = `
-- Run these queries in Supabase SQL Editor to diagnose v_total:

-- 1. Does v_total exist?
SELECT table_type, table_schema, table_name
FROM information_schema.tables
WHERE table_name = 'v_total';

-- 2. All views in public schema
SELECT table_name, LEFT(view_definition, 200) AS definition_preview
FROM information_schema.views
WHERE table_schema = 'public'
ORDER BY table_name;

-- 3. Any view referencing v_total
SELECT table_name, view_definition
FROM information_schema.views
WHERE table_schema = 'public'
  AND view_definition ILIKE '%v_total%';

-- 4. Any function referencing v_total
SELECT proname, LEFT(prosrc, 300) AS body_preview
FROM pg_proc
WHERE pronamespace = 'public'::regnamespace
  AND prosrc ILIKE '%v_total%';

-- 5. Any trigger referencing v_total
SELECT trigger_name, event_object_table, action_statement
FROM information_schema.triggers
WHERE trigger_schema = 'public'
  AND action_statement ILIKE '%v_total%';

-- 6. If v_total is a stale view, drop it:
-- DROP VIEW IF EXISTS public.v_total CASCADE;

-- 7. If something depends on v_total and you want to recreate it,
--    first check what it should contain. Common pattern:
-- CREATE OR REPLACE VIEW public.v_total AS
--   SELECT ... FROM ... ;
  `.trim();

  return NextResponse.json({ results, manualSql });
}
