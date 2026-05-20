/**
 * POST /api/meta-business/daily-optimize
 *   Run daily optimization for all active clients (or a specific client).
 *   Body: { clientId?: string } — omit to run for all connected clients.
 *
 * GET /api/meta-business/daily-optimize
 *   Returns last run status
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/db/store';
import { runDailyOptimization, generateDailyReport, type DailyOptimizerResult, type DailyReport } from '@/lib/meta-ads/daily-optimizer';
import type { Client, Campaign, AdSet, Ad } from '@/lib/db/schema';

export const dynamic = 'force-dynamic';
export const maxDuration = 120; // 2 minutes for optimization

/* ── GET — last run status ── */

export async function GET() {
  try {
    const sb = getSupabase();
    const { data } = await sb
      .from('app_meta_daily_reports')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(10);

    return NextResponse.json(data ?? []);
  } catch (e) {
    // Table may not exist yet
    return NextResponse.json([]);
  }
}

/* ── POST — run optimization ── */

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const targetClientId = body.clientId || null;

    const sb = getSupabase();
    const results: { clientId: string; clientName: string; report: DailyReport; errors: string[] }[] = [];

    // Get all connected clients (or specific one)
    let clientQuery = sb
      .from('clients')
      .select('*')
      .eq('status', 'active');

    if (targetClientId) {
      clientQuery = clientQuery.eq('id', targetClientId);
    }

    const { data: clients, error: clientsError } = await clientQuery;
    if (clientsError || !clients) {
      return NextResponse.json({ error: 'שגיאה בטעינת לקוחות', details: clientsError?.message }, { status: 500 });
    }

    // Filter to clients with Meta connected
    const connectedClients = clients.filter((c: any) =>
      (c.meta_connection_status === 'connected' || c.metaConnectionStatus === 'connected') &&
      (c.meta_access_token || c.metaAccessToken) &&
      (c.meta_ad_account_id || c.metaAdAccountId)
    );

    if (connectedClients.length === 0) {
      // Try system-level BM token
      const { data: settings } = await sb
        .from('app_settings')
        .select('value')
        .eq('key', 'meta_business_token')
        .single();

      if (!settings?.value?.access_token) {
        return NextResponse.json({
          error: 'אין לקוחות עם חיבור מטא פעיל',
          clientsChecked: clients.length,
        }, { status: 400 });
      }
    }

    // Run optimization for each connected client
    for (const client of connectedClients) {
      try {
        const c = client as any;
        const accessToken = c.meta_access_token || c.metaAccessToken || '';
        const adAccountId = c.meta_ad_account_id || c.metaAdAccountId || '';

        if (!accessToken || !adAccountId) continue;

        // Load campaigns, adsets, ads for this client
        const { data: campaigns } = await sb
          .from('campaigns')
          .select('*')
          .eq('client_id', client.id);

        const { data: adSets } = await sb
          .from('ad_sets')
          .select('*')
          .eq('client_id', client.id);

        const { data: ads } = await sb
          .from('ads')
          .select('*')
          .eq('client_id', client.id);

        const creds = { adAccountId, accessToken };

        // Run optimizer
        const optimizerResult = await runDailyOptimization(
          client as Client,
          (campaigns || []) as Campaign[],
          (adSets || []) as AdSet[],
          (ads || []) as Ad[],
          creds,
        );

        // Generate report
        const report = generateDailyReport(
          optimizerResult,
          (campaigns || []) as Campaign[],
          (adSets || []) as AdSet[],
          (ads || []) as Ad[],
        );

        // Persist report to DB
        try {
          await sb.from('app_meta_daily_reports').insert({
            id: report.id,
            client_id: report.clientId,
            date: report.date,
            report_data: report,
            created_at: report.createdAt,
          });
        } catch (saveErr) {
          console.warn('[daily-optimize] Failed to save report:', saveErr);
          // Try JSONB fallback
          try {
            await sb.from('app_meta_daily_reports').upsert({
              id: report.id,
              data: report,
            });
          } catch {
            // Silently continue
          }
        }

        results.push({
          clientId: client.id,
          clientName: client.name || '',
          report,
          errors: optimizerResult.errors,
        });

        console.log(`[daily-optimize] Client "${client.name}": ${optimizerResult.actionsExecuted.length} actions, ${optimizerResult.newAdsCreated} new ads`);
      } catch (clientError) {
        console.error(`[daily-optimize] Error for client ${client.id}:`, clientError);
        results.push({
          clientId: client.id,
          clientName: client.name || '',
          report: null as any,
          errors: [String(clientError)],
        });
      }
    }

    return NextResponse.json({
      success: true,
      clientsProcessed: results.length,
      results: results.map(r => ({
        clientId: r.clientId,
        clientName: r.clientName,
        actionsCount: r.report?.actions?.length || 0,
        newAdsCreated: r.report?.summary?.newAdsCreated || 0,
        adsPaused: r.report?.summary?.adsPaused || 0,
        cplTrend: r.report?.summary?.cplTrend || 'unknown',
        healthScore: r.report?.summary?.healthScore || 0,
        errors: r.errors,
      })),
    });
  } catch (error) {
    console.error('[daily-optimize] Fatal error:', error);
    return NextResponse.json({ error: 'שגיאת מערכת', details: String(error) }, { status: 500 });
  }
}
