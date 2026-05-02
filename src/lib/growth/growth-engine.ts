/**
 * Growth Engine — Orchestrator
 *
 * Runs a full growth scan across all clients:
 * 1. Loads all data from BI modules
 * 2. Runs growth rules per client
 * 3. Generates growth actions from opportunities
 * 4. Routes actions to approval queue
 * 5. Persists everything
 *
 * Safety guardrails:
 * - Max actions per client per day
 * - No duplicate recommendations
 * - Skip low-data campaigns
 * - No live writes without approval
 * - Full logging
 */

import { createClient } from '@supabase/supabase-js';
import { campaigns, adSets, ads, leads, growthRuns, growthOpportunities, growthActions } from '@/lib/db';
import type {
  GrowthRun, GrowthOpportunity, GrowthAction,
  GrowthActionType, GrowthOpportunityType,
} from '@/lib/db/schema';
import { computeAllClientHealth, computeClientHealth } from '@/lib/bi/client-health';
import { computeAllProfitability } from '@/lib/bi/profitability';
import { analyzeContentIntelligence } from '@/lib/bi/content-intelligence';
import { detectEarlyWarnings } from '@/lib/bi/early-warnings';
import { comparePlatforms } from '@/lib/bi/platform-comparison';
import { runAllRules, type RawOpportunity, type ClientContext, GROWTH_THRESHOLDS } from './growth-rules';
import { generateActionExplanation, generateOpportunityExplanation } from './growth-explanation';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
);

// ── Safety limits ──

const SAFETY = {
  maxActionsPerClientPerDay: 8,
  maxActionsPerRun: 40,
  dedupeWindowHours: 24,
};

// ── Action mapping ──

const OPPORTUNITY_TO_ACTION: Record<GrowthOpportunityType, GrowthActionType[]> = {
  scale: ['suggest_budget_increase', 'duplicate_winning_ad'],
  creative_replacement: ['create_ad_variation', 'pause_weak_ad'],
  budget_waste: ['suggest_budget_reduction', 'pause_weak_ad'],
  platform_shift: ['suggest_budget_increase', 'suggest_budget_reduction'],
  audience_expansion: ['create_new_adset'],
  funnel_leak: ['create_followup_task', 'create_report'],
  content_to_campaign: ['create_campaign_from_content', 'duplicate_winning_ad'],
  client_risk: ['create_followup_task', 'create_report'],
};

const ACTION_RISK: Record<GrowthActionType, 'low' | 'medium' | 'high'> = {
  create_ad_variation: 'low',
  duplicate_winning_ad: 'low',
  create_new_adset: 'medium',
  suggest_budget_increase: 'medium',
  suggest_budget_reduction: 'medium',
  pause_weak_ad: 'medium',
  create_campaign_from_content: 'medium',
  create_campaign_from_podcast: 'medium',
  create_retargeting_campaign: 'high',
  create_report: 'low',
  create_followup_task: 'low',
};

// ── Main scan ──

export interface GrowthScanOptions {
  clientId?: string;
  triggeredBy?: 'manual' | 'scheduled' | 'system';
  dryRun?: boolean;
}

export interface GrowthScanResult {
  run: GrowthRun;
  opportunities: GrowthOpportunity[];
  actions: GrowthAction[];
}

export async function runGrowthScan(options: GrowthScanOptions = {}): Promise<GrowthScanResult> {
  const runId = `grn_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const startedAt = new Date().toISOString();

  // Create run record
  const run: GrowthRun = {
    id: runId,
    status: 'running',
    triggeredBy: options.triggeredBy || 'manual',
    clientsScanned: 0,
    campaignsScanned: 0,
    opportunitiesFound: 0,
    actionsGenerated: 0,
    summary: '',
    startedAt,
    finishedAt: null,
    createdAt: startedAt,
  };

  if (!options.dryRun) {
    await growthRuns.createAsync(run);
  }

  try {
    // Load all data
    const [clientsResult, allCampaigns, allAdSets, allAds, allLeads] = await Promise.all([
      supabase.from('clients').select('*'),
      campaigns.getAllAsync(),
      adSets.getAllAsync(),
      ads.getAllAsync(),
      leads.getAllAsync(),
    ]);

    const allClients = (clientsResult.data || []) as any[];
    const campaignsList = allCampaigns || [];
    const adSetsList = allAdSets || [];
    const adsList = allAds || [];
    const leadsList = allLeads || [];

    // Filter by client if specified
    const targetClients = options.clientId
      ? allClients.filter((c: any) => c.id === options.clientId)
      : allClients;

    // Compute BI data
    const healthScores = computeAllClientHealth(allClients as any, campaignsList as any, adsList as any, leadsList as any);
    const profitData = computeAllProfitability(allClients as any, campaignsList as any, adsList as any, leadsList as any);
    const platformData = comparePlatforms(campaignsList as any, adsList as any);
    const warningsData = detectEarlyWarnings(allClients as any, campaignsList as any, adsList as any, leadsList as any);

    // Load recent actions for dedup
    const recentActions = await growthActions.getAllAsync() || [];
    const recentActionKeys = new Set(
      recentActions
        .filter(a => {
          const ageHours = (Date.now() - new Date(a.createdAt).getTime()) / (1000 * 60 * 60);
          return ageHours < SAFETY.dedupeWindowHours;
        })
        .map(a => `${a.clientId}:${a.actionType}:${a.campaignId || ''}`)
    );

    const allOpportunities: GrowthOpportunity[] = [];
    const allActions: GrowthAction[] = [];
    let totalCampaignsScanned = 0;

    for (const client of targetClients) {
      const clientCampaigns = campaignsList.filter((c: any) => c.clientId === client.id);
      const clientAdSets = adSetsList.filter((a: any) => {
        const campaignIds = new Set(clientCampaigns.map((c: any) => c.id));
        return campaignIds.has(a.campaignId || '');
      });
      const clientAds = adsList.filter((a: any) => {
        const campaignIds = new Set(clientCampaigns.map((c: any) => c.id));
        return campaignIds.has(a.campaignId || '');
      });
      const clientLeads = leadsList.filter((l: any) => l.clientId === client.id);

      totalCampaignsScanned += clientCampaigns.length;

      const health = healthScores.find(h => h.clientId === client.id);
      const profit = profitData.find(p => p.clientId === client.id);
      const content = analyzeContentIntelligence(clientAds as any, client.id);
      const clientWarnings = warningsData.warnings.filter(w => w.clientId === client.id);

      const ctx: ClientContext = {
        clientId: client.id,
        clientName: client.name || client.contactName || client.id,
        campaigns: clientCampaigns as any,
        adSets: clientAdSets as any,
        ads: clientAds as any,
        leads: clientLeads as any,
        health,
        profitability: profit,
        content,
        warnings: clientWarnings,
        platformComparison: platformData,
      };

      // Run rules
      const rawOpps = runAllRules(ctx);

      // Convert to persisted opportunities
      for (const raw of rawOpps) {
        const oppId = `gop_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
        const opp: GrowthOpportunity = {
          id: oppId,
          runId,
          ...raw,
          status: 'new',
          createdAt: new Date().toISOString(),
        };
        allOpportunities.push(opp);

        // Generate actions for high-confidence opportunities
        if (raw.confidence >= 50) {
          const actionTypes = OPPORTUNITY_TO_ACTION[raw.type] || [];
          const primaryAction = actionTypes[0];

          if (primaryAction) {
            const actionKey = `${raw.clientId}:${primaryAction}:${raw.campaignId || ''}`;
            if (recentActionKeys.has(actionKey)) continue; // dedupe
            if (allActions.filter(a => a.clientId === raw.clientId).length >= SAFETY.maxActionsPerClientPerDay) continue;
            if (allActions.length >= SAFETY.maxActionsPerRun) continue;

            const actionId = `gac_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
            const explanation = generateActionExplanation(primaryAction, raw);

            const action: GrowthAction = {
              id: actionId,
              opportunityId: oppId,
              clientId: raw.clientId,
              clientName: raw.clientName,
              campaignId: raw.campaignId,
              campaignName: raw.campaignName,
              platform: raw.platform,
              actionType: primaryAction,
              title: explanation.title,
              reason: explanation.reason,
              expectedImpact: explanation.expectedImpact,
              confidenceScore: raw.confidence,
              riskLevel: ACTION_RISK[primaryAction] || 'medium',
              approvalMode: 'admin_approval',
              approvalStatus: 'pending_admin',
              executionStatus: 'not_started',
              payload: { ...raw.metadata, opportunityType: raw.type },
              suggestedNextStep: explanation.suggestedNextStep,
              approvedBy: null,
              approvedAt: null,
              rejectedBy: null,
              rejectedAt: null,
              rejectionReason: null,
              executedAt: null,
              failedReason: null,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            };

            allActions.push(action);
            recentActionKeys.add(actionKey);
          }
        }
      }
    }

    // Persist
    if (!options.dryRun) {
      for (const opp of allOpportunities) {
        await growthOpportunities.createAsync(opp);
      }
      for (const act of allActions) {
        await growthActions.createAsync(act);
      }
    }

    // Update run
    const summary = buildRunSummary(targetClients.length, totalCampaignsScanned, allOpportunities, allActions);
    run.status = 'completed';
    run.clientsScanned = targetClients.length;
    run.campaignsScanned = totalCampaignsScanned;
    run.opportunitiesFound = allOpportunities.length;
    run.actionsGenerated = allActions.length;
    run.summary = summary;
    run.finishedAt = new Date().toISOString();

    if (!options.dryRun) {
      await growthRuns.updateAsync(runId, run);
    }

    return { run, opportunities: allOpportunities, actions: allActions };
  } catch (error) {
    run.status = 'failed';
    run.summary = error instanceof Error ? error.message : 'Unknown error';
    run.finishedAt = new Date().toISOString();
    if (!options.dryRun) {
      await growthRuns.updateAsync(runId, run);
    }
    throw error;
  }
}

// ── Summary builder ──

function buildRunSummary(
  clients: number,
  campaigns: number,
  opps: GrowthOpportunity[],
  actions: GrowthAction[],
): string {
  const critical = opps.filter(o => o.severity === 'critical').length;
  const high = opps.filter(o => o.severity === 'high').length;

  const parts: string[] = [
    `נסרקו ${clients} לקוחות ו-${campaigns} קמפיינים.`,
    `זוהו ${opps.length} הזדמנויות צמיחה.`,
  ];

  if (critical > 0) parts.push(`${critical} קריטיות.`);
  if (high > 0) parts.push(`${high} בעדיפות גבוהה.`);
  if (actions.length > 0) parts.push(`הוכנו ${actions.length} פעולות לאישור.`);

  return parts.join(' ');
}

// ── Get scan data ──

export async function getGrowthDashboardData(clientId?: string) {
  const [runsAll, oppsAll, actionsAll] = await Promise.all([
    growthRuns.getAllAsync(),
    growthOpportunities.getAllAsync(),
    growthActions.getAllAsync(),
  ]);

  const runs = runsAll || [];
  let opps = oppsAll || [];
  let actions = actionsAll || [];

  if (clientId) {
    opps = opps.filter(o => o.clientId === clientId);
    actions = actions.filter(a => a.clientId === clientId);
  }

  // Sort by recency
  runs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  opps.sort((a, b) => {
    const sevOrder: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
    return (sevOrder[a.severity] || 3) - (sevOrder[b.severity] || 3);
  });
  actions.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const pendingApprovals = actions.filter(a => a.approvalStatus === 'pending_admin' || a.approvalStatus === 'pending_client');
  const highRiskClients = new Set(opps.filter(o => o.severity === 'critical' || o.type === 'client_risk').map(o => o.clientId));

  return {
    lastRun: runs[0] || null,
    runs: runs.slice(0, 10),
    opportunities: opps,
    actions,
    kpis: {
      opportunitiesFound: opps.filter(o => o.status === 'new').length,
      pendingApprovals: pendingApprovals.length,
      actionsPrepared: actions.filter(a => a.executionStatus === 'not_started').length,
      highRiskClients: highRiskClients.size,
      potentialImpact: opps.length > 0 ? `${opps.length} הזדמנויות זוהו` : 'אין הזדמנויות חדשות',
    },
  };
}
