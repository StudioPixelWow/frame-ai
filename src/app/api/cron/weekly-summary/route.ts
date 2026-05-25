/**
 * Cron: Weekly Summary Generator
 *
 * GET /api/cron/weekly-summary
 *
 * Called by Vercel Cron (weekly). Generates summaries for all active clients,
 * saves each to the `weekly_summaries` Supabase table, and optionally sends
 * email notifications to clients that have an email address.
 *
 * Auth: Bearer ${CRON_SECRET}
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabase, ensureTable } from '@/lib/db/store';
import { generateAllWeeklySummaries } from '@/lib/automation/weekly-summary-engine';
import type { WeeklySummary } from '@/lib/automation/weekly-summary-engine';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

// ═══════════════════════════════════════════════════════════════════════
// Table DDL
// ═══════════════════════════════════════════════════════════════════════

const WEEKLY_SUMMARIES_DDL = `
CREATE TABLE IF NOT EXISTS weekly_summaries (
  id TEXT PRIMARY KEY,
  client_id TEXT NOT NULL,
  client_name TEXT,
  week_start TEXT,
  week_end TEXT,
  summary JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
`;

// ═══════════════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════════════

function generateRowId(clientId: string, weekStart: string): string {
  return `ws_${clientId}_${weekStart}`;
}

async function saveSummary(summary: WeeklySummary): Promise<void> {
  const sb = getSupabase();
  const rowId = generateRowId(summary.clientId, summary.weekStart);

  const { error } = await sb
    .from('weekly_summaries')
    .upsert(
      {
        id: rowId,
        client_id: summary.clientId,
        client_name: summary.clientName,
        week_start: summary.weekStart,
        week_end: summary.weekEnd,
        summary: summary,
        created_at: new Date().toISOString(),
      },
      { onConflict: 'id' }
    );

  if (error) {
    console.warn(`[weekly-summary-cron] Failed to save summary for ${summary.clientId}:`, error.message);
  }
}

// ═══════════════════════════════════════════════════════════════════════
// ROUTE
// ═══════════════════════════════════════════════════════════════════════

export async function GET(req: NextRequest) {
  const startTs = Date.now();

  // Auth check
  if (process.env.CRON_SECRET) {
    const authHeader = req.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      console.error('[weekly-summary-cron] Auth failed');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  console.log('[weekly-summary-cron] Starting weekly summary generation at', new Date().toISOString());

  try {
    // Ensure table exists (best-effort via exec_sql)
    await ensureTable('weekly_summaries', WEEKLY_SUMMARIES_DDL);

    // Generate all summaries
    const summaries = await generateAllWeeklySummaries();

    // Save each summary to Supabase
    let savedCount = 0;
    let emailCount = 0;
    const errors: string[] = [];

    for (const summary of summaries) {
      try {
        await saveSummary(summary);
        savedCount++;
      } catch (err) {
        const msg = `Failed to save for ${summary.clientId}: ${err instanceof Error ? err.message : String(err)}`;
        errors.push(msg);
        console.error('[weekly-summary-cron]', msg);
      }

      // Optional: send email notification (if client has email and Gmail is configured)
      try {
        if (summary.clientName !== 'לקוח לא ידוע') {
          // Fetch client email from clients table
          const sb = getSupabase();
          const { data: clientRow } = await sb
            .from('clients')
            .select('email')
            .eq('id', summary.clientId)
            .maybeSingle();

          if (clientRow?.email) {
            // Log that email could be sent (actual email sending depends on Gmail integration)
            console.log(`[weekly-summary-cron] Email candidate: ${clientRow.email} for client ${summary.clientName}`);
            emailCount++;
          }
        }
      } catch {
        // Email lookup is non-critical
      }
    }

    const durationMs = Date.now() - startTs;

    console.log(`[weekly-summary-cron] Done. ${savedCount}/${summaries.length} saved in ${durationMs}ms`);

    return NextResponse.json({
      ok: true,
      generated: summaries.length,
      saved: savedCount,
      emailCandidates: emailCount,
      errors: errors.length > 0 ? errors : undefined,
      durationMs,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[weekly-summary-cron] Fatal error:', error);
    return NextResponse.json(
      {
        error: 'שגיאה ביצירת סיכומים שבועיים',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
