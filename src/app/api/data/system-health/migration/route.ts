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
      name: 'system_errors',
      sql: `CREATE TABLE IF NOT EXISTS system_errors (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL DEFAULT '',
        source TEXT NOT NULL DEFAULT 'system',
        message TEXT NOT NULL DEFAULT '',
        stack TEXT,
        severity TEXT NOT NULL DEFAULT 'low',
        client_id TEXT,
        related_entity_type TEXT,
        related_entity_id TEXT,
        resolved BOOLEAN NOT NULL DEFAULT false,
        resolved_at TIMESTAMPTZ,
        resolved_by TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );`,
    },
    {
      name: 'system_alerts',
      sql: `CREATE TABLE IF NOT EXISTS system_alerts (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL DEFAULT '',
        title TEXT NOT NULL DEFAULT '',
        message TEXT NOT NULL DEFAULT '',
        severity TEXT NOT NULL DEFAULT 'low',
        source TEXT NOT NULL DEFAULT 'system',
        client_id TEXT,
        acknowledged BOOLEAN NOT NULL DEFAULT false,
        acknowledged_at TIMESTAMPTZ,
        acknowledged_by TEXT,
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
