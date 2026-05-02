/**
 * POST /api/data/growth/migration
 *
 * Creates growth_runs, growth_opportunities, growth_actions, growth_action_results tables.
 */

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
);

export async function POST() {
  const results: Record<string, string> = {};

  const tables = [
    {
      name: 'growth_runs',
      sql: `CREATE TABLE IF NOT EXISTS growth_runs (
        id TEXT PRIMARY KEY,
        status TEXT DEFAULT 'running',
        "triggeredBy" TEXT DEFAULT 'manual',
        "clientsScanned" INTEGER DEFAULT 0,
        "campaignsScanned" INTEGER DEFAULT 0,
        "opportunitiesFound" INTEGER DEFAULT 0,
        "actionsGenerated" INTEGER DEFAULT 0,
        summary TEXT DEFAULT '',
        "startedAt" TEXT,
        "finishedAt" TEXT,
        "createdAt" TEXT DEFAULT (datetime('now'))
      )`,
    },
    {
      name: 'growth_opportunities',
      sql: `CREATE TABLE IF NOT EXISTS growth_opportunities (
        id TEXT PRIMARY KEY,
        "runId" TEXT,
        "clientId" TEXT,
        "clientName" TEXT,
        "campaignId" TEXT,
        "campaignName" TEXT,
        "adSetId" TEXT,
        "adId" TEXT,
        platform TEXT,
        type TEXT,
        severity TEXT DEFAULT 'medium',
        confidence INTEGER DEFAULT 50,
        title TEXT,
        reason TEXT,
        "expectedImpact" TEXT,
        status TEXT DEFAULT 'new',
        metadata JSONB DEFAULT '{}',
        "createdAt" TEXT DEFAULT (datetime('now'))
      )`,
    },
    {
      name: 'growth_actions',
      sql: `CREATE TABLE IF NOT EXISTS growth_actions (
        id TEXT PRIMARY KEY,
        "opportunityId" TEXT,
        "clientId" TEXT,
        "clientName" TEXT,
        "campaignId" TEXT,
        "campaignName" TEXT,
        platform TEXT,
        "actionType" TEXT,
        title TEXT,
        reason TEXT,
        "expectedImpact" TEXT,
        "confidenceScore" INTEGER DEFAULT 50,
        "riskLevel" TEXT DEFAULT 'medium',
        "approvalMode" TEXT DEFAULT 'admin_approval',
        "approvalStatus" TEXT DEFAULT 'pending_admin',
        "executionStatus" TEXT DEFAULT 'not_started',
        payload JSONB DEFAULT '{}',
        "suggestedNextStep" TEXT,
        "approvedBy" TEXT,
        "approvedAt" TEXT,
        "rejectedBy" TEXT,
        "rejectedAt" TEXT,
        "rejectionReason" TEXT,
        "executedAt" TEXT,
        "failedReason" TEXT,
        "createdAt" TEXT DEFAULT (datetime('now')),
        "updatedAt" TEXT DEFAULT (datetime('now'))
      )`,
    },
    {
      name: 'growth_action_results',
      sql: `CREATE TABLE IF NOT EXISTS growth_action_results (
        id TEXT PRIMARY KEY,
        "actionId" TEXT,
        "clientId" TEXT,
        "beforeMetrics" JSONB DEFAULT '{}',
        "afterMetrics" JSONB DEFAULT '{}',
        outcome TEXT DEFAULT 'unknown',
        "impactSummary" TEXT,
        notes TEXT DEFAULT '',
        "measuredAt" TEXT,
        "createdAt" TEXT DEFAULT (datetime('now'))
      )`,
    },
  ];

  for (const table of tables) {
    try {
      const { error } = await supabase.rpc('exec_sql', { sql: table.sql });
      if (error) {
        // Try raw query as fallback
        const { error: err2 } = await supabase.from(table.name).select('id').limit(1);
        results[table.name] = err2 ? `migration_error: ${error.message}` : 'already_exists';
      } else {
        results[table.name] = 'created';
      }
    } catch (e) {
      results[table.name] = `error: ${e instanceof Error ? e.message : 'unknown'}`;
    }
  }

  return NextResponse.json({ success: true, tables: results });
}
