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
      name: 'autopilot_settings',
      sql: `CREATE TABLE IF NOT EXISTS autopilot_settings (
        id TEXT PRIMARY KEY,
        client_id TEXT NOT NULL UNIQUE,
        client_name TEXT NOT NULL DEFAULT '',
        mode TEXT NOT NULL DEFAULT 'approval_required',
        goals JSONB NOT NULL DEFAULT '[]',
        is_active BOOLEAN NOT NULL DEFAULT true,
        is_paused BOOLEAN NOT NULL DEFAULT false,
        max_actions_per_day INTEGER NOT NULL DEFAULT 8,
        last_scan_at TIMESTAMPTZ,
        last_scan_result TEXT,
        consecutive_failures INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );`,
    },
    {
      name: 'autopilot_runs',
      sql: `CREATE TABLE IF NOT EXISTS autopilot_runs (
        id TEXT PRIMARY KEY,
        client_id TEXT,
        status TEXT NOT NULL DEFAULT 'running',
        triggered_by TEXT NOT NULL DEFAULT 'manual',
        clients_scanned INTEGER NOT NULL DEFAULT 0,
        opportunities_found INTEGER NOT NULL DEFAULT 0,
        actions_created INTEGER NOT NULL DEFAULT 0,
        approvals_sent INTEGER NOT NULL DEFAULT 0,
        errors JSONB NOT NULL DEFAULT '[]',
        started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        finished_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );`,
    },
    {
      name: 'autopilot_actions',
      sql: `CREATE TABLE IF NOT EXISTS autopilot_actions (
        id TEXT PRIMARY KEY,
        run_id TEXT NOT NULL,
        client_id TEXT NOT NULL,
        client_name TEXT NOT NULL DEFAULT '',
        action_type TEXT NOT NULL,
        title TEXT NOT NULL DEFAULT '',
        reason TEXT NOT NULL DEFAULT '',
        expected_impact TEXT NOT NULL DEFAULT '',
        confidence INTEGER NOT NULL DEFAULT 0,
        risk_level TEXT NOT NULL DEFAULT 'low',
        approver TEXT NOT NULL DEFAULT 'admin',
        status TEXT NOT NULL DEFAULT 'draft',
        related_entity_type TEXT,
        related_entity_id TEXT,
        payload JSONB NOT NULL DEFAULT '{}',
        approved_by TEXT,
        approved_at TIMESTAMPTZ,
        rejected_by TEXT,
        rejected_at TIMESTAMPTZ,
        rejection_reason TEXT,
        executed_at TIMESTAMPTZ,
        failed_reason TEXT,
        before_metrics JSONB NOT NULL DEFAULT '{}',
        after_metrics JSONB NOT NULL DEFAULT '{}',
        outcome TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );`,
    },
    {
      name: 'autopilot_activity_log',
      sql: `CREATE TABLE IF NOT EXISTS autopilot_activity_log (
        id TEXT PRIMARY KEY,
        run_id TEXT,
        client_id TEXT,
        action_id TEXT,
        activity_type TEXT NOT NULL,
        title TEXT NOT NULL DEFAULT '',
        details TEXT NOT NULL DEFAULT '',
        metadata JSONB NOT NULL DEFAULT '{}',
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
