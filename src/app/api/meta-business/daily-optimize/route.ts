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
import { getSystemMetaToken } from '@/lib/meta-ads/token';
import { campaigns as campaignsCol, adSets as adSetsCol, ads as adsCol } from '@/lib/db/collections';
import { runDailyOptimization, generateDailyReport, type DailyOptimizerResult, type DailyReport } from '@/lib/meta-ads/daily-optimizer';
import { syncClientMetaAccount } from '@/lib/meta-ads/sync-service';
import { sendOptimizerAlert } from '@/lib/meta-ads/alerts';
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
    // SAFETY: only auto-create new ad sets/ads (which spend money) when explicitly
    // requested. The daily cron sends an empty body → stays in safe mode.
    const allowCreate = body.allowCreate === true;

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

    // Central token — single source of truth. Clients that don't store their own
    // token fall back to this, so updating the token in one place is enough.
    const systemToken = await getSystemMetaToken();

    // A client is "connected" if it has a dedicated ad account AND a usable token.
    const connectedClients = clients.filter((c: any) =>
      (c.meta_connection_status === 'connected' || c.metaConnectionStatus === 'connected') &&
      (c.meta_ad_account_id || c.metaAdAccountId) &&
      (c.meta_access_token || c.metaAccessToken || systemToken)
    );

    // Campaign-level assignments — a shared ad account serving many clients.
    const assignsByClient = new Map<string, { adAccountIds: Set<string>; metaIds: Set<string> }>();
    try {
      const { data: allAssigns } = await sb.from('app_meta_campaign_assignments').select('*');
      for (const a of (allAssigns || []) as any[]) {
        if (!a.client_id || !a.meta_campaign_id) continue;
        if (targetClientId && a.client_id !== targetClientId) continue;
        if (!assignsByClient.has(a.client_id)) assignsByClient.set(a.client_id, { adAccountIds: new Set(), metaIds: new Set() });
        const g = assignsByClient.get(a.client_id)!;
        g.metaIds.add(a.meta_campaign_id);
        if (a.ad_account_id) g.adAccountIds.add(a.ad_account_id);
      }
    } catch { /* assignments table may not exist yet */ }

    // Targets = dedicated-account clients ∪ campaign-assignment clients.
    const targetById = new Map<string, any>();
    for (const c of connectedClients) targetById.set((c as any).id, c);
    const extraIds = [...assignsByClient.keys()].filter((id) => !targetById.has(id));
    if (extraIds.length > 0) {
      const { data: extra } = await sb.from('clients').select('*').in('id', extraIds);
      for (const c of (extra || []) as any[]) targetById.set(c.id, c);
    }
    const targets = [...targetById.values()];

    if (targets.length === 0) {
      return NextResponse.json({ error: 'אין לקוחות עם חיבור מטא פעיל', clientsChecked: clients.length }, { status: 400 });
    }

    // Sync each relevant ad account ONCE per run (dedup across clients).
    const syncedAccounts = new Set<string>();
    for (const client of targets) {
      const c = client as any;
      const token = c.meta_access_token || c.metaAccessToken || systemToken || '';
      if (!token) continue;
      const accts = new Set<string>();
      if (c.meta_ad_account_id || c.metaAdAccountId) accts.add(c.meta_ad_account_id || c.metaAdAccountId);
      const grp = assignsByClient.get(c.id);
      if (grp) for (const a of grp.adAccountIds) accts.add(a);
      for (const actId of accts) {
        if (!actId || syncedAccounts.has(actId)) continue;
        syncedAccounts.add(actId);
        try { await syncClientMetaAccount(c.id, c.name || '', actId, token); }
        catch (e) { console.warn('[daily-optimize] sync failed for', actId, e); }
      }
    }

    // Load ALL synced data once from the correct app_* tables (matches sync + dashboard).
    const [allCampaigns, allAdSets, allAds] = await Promise.all([
      campaignsCol.getAllAsync(),
      adSetsCol.getAllAsync(),
      adsCol.getAllAsync(),
    ]);

    // Run optimization for each target client
    for (const client of targets) {
      try {
        const c = client as any;
        const accessToken = c.meta_access_token || c.metaAccessToken || systemToken || '';
        const dedicatedAcct = c.meta_ad_account_id || c.metaAdAccountId || '';
        const grp = assignsByClient.get(c.id);
        if (!accessToken || (!dedicatedAcct && !grp)) continue;

        // Build this client's campaign subset from the preloaded synced data:
        //  - dedicated account → campaigns owned by the client
        //  - campaign assignment → campaigns whose Meta id is assigned to the client
        const campaigns = (allCampaigns as any[]).filter((cm) =>
          (dedicatedAcct && cm.clientId === c.id) ||
          (grp && cm.metaCampaignId && grp.metaIds.has(cm.metaCampaignId))
        );
        const campIds = new Set(campaigns.map((cm) => cm.id));
        const adSets = (allAdSets as any[]).filter((s) => campIds.has(s.campaignId));
        const ads = (allAds as any[]).filter((a) => campIds.has(a.campaignId));

        const creds = { adAccountId: dedicatedAcct || [...(grp?.adAccountIds || [])][0] || '', accessToken };

        // Load previous CPLs from the most recent persisted report — gives the
        // optimizer REAL history for trend calc (vs. the old synthetic fallback).
        const previousCpls: Record<string, number> = {};
        try {
          const { data: prevReports } = await sb
            .from('app_meta_daily_reports')
            .select('report_data, data, created_at')
            .eq('client_id', client.id)
            .order('created_at', { ascending: false })
            .limit(1);
          const prev: any = prevReports?.[0]?.report_data || prevReports?.[0]?.data;
          if (prev?.campaigns) {
            for (const c of prev.campaigns) {
              if (c.campaignId && c.cpl > 0) previousCpls[c.campaignId] = c.cpl;
            }
          }
        } catch { /* no history yet — first run */ }

        // Run optimizer
        const optimizerResult = await runDailyOptimization(
          client as Client,
          (campaigns || []) as Campaign[],
          (adSets || []) as AdSet[],
          (ads || []) as Ad[],
          creds,
          previousCpls,
          allowCreate,
        );

        // Generate report
        const report = generateDailyReport(
          optimizerResult,
          (campaigns || []) as Campaign[],
          (adSets || []) as AdSet[],
          (ads || []) as Ad[],
        );

        // ── Budget pacing (#7): 30-day spend vs ~monthly budget (daily×30) ──
        const overspend: { campaignName: string; spend: number; monthlyBudget: number }[] = [];
        for (const cm of campaigns) {
          const cAds = ads.filter((a: any) => a.campaignId === cm.id);
          const spend = cAds.reduce((s: number, a: any) => s + (a.spend || 0), 0);
          const monthlyBudget = (cm.budget || 0) * 30;
          if (monthlyBudget > 0 && spend > monthlyBudget * 1.2) {
            overspend.push({ campaignName: cm.campaignName || cm.name || '', spend, monthlyBudget });
          }
        }
        (report as any).overspend = overspend;

        // ── Alert (#2): notify the agency on actions / CPL spike / overspend ──
        try {
          await sendOptimizerAlert({
            clientName: c.name || '',
            pausedCount: (report.summary.adsPaused || 0) + (report.summary.adSetsPaused || 0),
            newAdsCreated: report.summary.newAdsCreated || 0,
            cplTrend: report.summary.cplTrend,
            cplDeltaPct: report.summary.cplDeltaPct || 0,
            overspend,
          });
        } catch { /* alerts are best-effort */ }

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
