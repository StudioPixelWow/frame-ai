import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
);

export async function POST() {
  const results: string[] = [];
  const errors: string[] = [];

  const tables = [
    {
      name: 'strategic_plans',
      sql: `CREATE TABLE IF NOT EXISTS strategic_plans (
        id TEXT PRIMARY KEY,
        client_id TEXT NOT NULL,
        client_name TEXT NOT NULL DEFAULT '',
        data_quality TEXT NOT NULL DEFAULT 'moderate',
        sections JSONB NOT NULL DEFAULT '{}',
        decisions JSONB NOT NULL DEFAULT '[]',
        action_plan JSONB NOT NULL DEFAULT '[]',
        overall_confidence INTEGER NOT NULL DEFAULT 0,
        overall_urgency TEXT NOT NULL DEFAULT 'low',
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );`,
    },
    {
      name: 'strategy_results',
      sql: `CREATE TABLE IF NOT EXISTS strategy_results (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        strategy_id TEXT NOT NULL,
        action_id TEXT NOT NULL,
        action_type TEXT NOT NULL DEFAULT 'unknown',
        outcome TEXT NOT NULL DEFAULT 'ignored',
        notes TEXT DEFAULT '',
        performance_before JSONB NOT NULL DEFAULT '{}',
        performance_after JSONB NOT NULL DEFAULT '{}',
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );`,
    },
  ];

  for (const table of tables) {
    try {
      const { error } = await supabase.rpc('exec_sql', { sql: table.sql });
      if (error) {
        const { error: directErr } = await supabase.from(table.name).select('id').limit(1);
        if (directErr && directErr.code === '42P01') {
          errors.push(`${table.name}: table does not exist and exec_sql unavailable`);
        } else {
          results.push(`${table.name}: already exists`);
        }
      } else {
        results.push(`${table.name}: created`);
      }
    } catch (err) {
      errors.push(`${table.name}: ${(err as Error).message}`);
    }
  }

  return NextResponse.json({ results, errors });
}
