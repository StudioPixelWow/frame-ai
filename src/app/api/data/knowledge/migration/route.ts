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
      name: 'agency_knowledge_items',
      sql: `CREATE TABLE IF NOT EXISTS agency_knowledge_items (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        type TEXT NOT NULL DEFAULT 'hook',
        industry TEXT NOT NULL DEFAULT 'general',
        "clientId" TEXT,
        "clientName" TEXT,
        "sourceType" TEXT NOT NULL DEFAULT 'ad_performance',
        "sourceId" TEXT,
        title TEXT NOT NULL DEFAULT '',
        summary TEXT NOT NULL DEFAULT '',
        "evidenceData" JSONB NOT NULL DEFAULT '{}',
        "performanceMetrics" JSONB NOT NULL DEFAULT '{}',
        "usageCount" INTEGER NOT NULL DEFAULT 0,
        "confidenceScore" INTEGER NOT NULL DEFAULT 50,
        "decayScore" INTEGER NOT NULL DEFAULT 0,
        tags JSONB NOT NULL DEFAULT '[]',
        platform TEXT,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
      );`,
    },
    {
      name: 'industry_playbooks',
      sql: `CREATE TABLE IF NOT EXISTS industry_playbooks (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        industry TEXT NOT NULL UNIQUE,
        "topHooks" JSONB NOT NULL DEFAULT '[]',
        "bestCTAs" JSONB NOT NULL DEFAULT '[]',
        "winningContentAngles" JSONB NOT NULL DEFAULT '[]',
        "bestVisualPatterns" JSONB NOT NULL DEFAULT '[]',
        "bestPlatforms" JSONB NOT NULL DEFAULT '[]',
        "audienceNotes" JSONB NOT NULL DEFAULT '[]',
        "failurePatterns" JSONB NOT NULL DEFAULT '[]',
        "clientCount" INTEGER NOT NULL DEFAULT 0,
        "campaignCount" INTEGER NOT NULL DEFAULT 0,
        "lastUpdated" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
      );`,
    },
  ];

  for (const table of tables) {
    try {
      const { error } = await supabase.rpc('exec_sql', { sql: table.sql });
      if (error) {
        // Try direct query if exec_sql not available
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
