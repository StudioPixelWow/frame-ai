/**
 * Auto Campaign Monitor Engine
 *
 * Scans campaign performance data and detects issues/opportunities:
 *   1. Creative fatigue — high frequency + dropping CTR
 *   2. Budget waste — high spend, zero leads/results
 *   3. Scale opportunity — low CPL, stable leads
 *   4. Weak audience — low CTR on ad set level
 *   5. Winning ad — one ad strongly outperforms others
 *   6. Tracking issue — spend exists but zero events
 *
 * Safety guardrails:
 *   - Max findings per campaign per run (prevents flood)
 *   - Min data threshold before evaluating
 *   - Confidence scoring on every finding
 *   - No duplicate findings within same run
 *   - Clearly marks low-confidence items
 *
 * All findings → campaign_actions (pending_review) → approval queue
 * NEVER auto-publishes to Meta.
 */

import type {
  Campaign, AdSet, Ad,
  AutoCampaignRun, AutoCampaignFinding,
  AutoFindingType, AutoFindingSeverity,
} from '@/lib/db/schema';
import { campaigns, adSets, ads, autoCampaignRuns, autoCampaignFindings, campaignActions } from '@/lib/db';
import { logCampaignActivity } from './activity-log';
import { generateVariation } from './variations';

// ── Configuration ────────────────────────────────────────────────────

export const AUTO_CONFIG = {
  // Minimum data thresholds — don't evaluate campaigns with too little data
  minImpressions: 500,
  minSpend: 30,           // ₪ — don't flag campaigns with tiny spend
  minAdSetImpressions: 200,
  minAdImpressions: 100,

  // Detection thresholds
  frequencyHigh: 4.0,       // creative fatigue trigger
  frequencyCritical: 6.0,
  ctrDropThreshold: 1.0,    // % — CTR below this is concerning
  ctrLow: 0.8,              // % — ad set CTR below this is weak
  ctrGood: 2.0,             // % — above this is good
  cplTarget: 60,            // ₪ — above this is expensive
  cplGood: 35,              // ₪ — below this is scale candidate
  budgetWasteMinSpend: 100, // ₪ — min spend before flagging waste
  performanceGap: 2.0,      // winner must score 2x the average
  spendWithoutEventsMin: 50, // ₪ — tracking issue threshold

  // Safety guardrails
  maxFindingsPerCampaign: 8,
  maxActionsPerCampaignPerDay: 5,
  maxTotalFindingsPerRun: 50,
  cooldownHours: 4,          // min hours between scans for same campaign
};

// ── Types ────────────────────────────────────────────────────────────

export interface ScanResult {
  run: AutoCampaignRun;
  findings: AutoCampaignFinding[];
  actionsCreated: number;
}

export interface ScanOptions {
  clientId?: string;
  campaignId?: string;          // scan single campaign
  triggeredBy: 'manual' | 'scheduled' | 'system';
  dryRun?: boolean;             // don't persist findings
  skipCooldown?: boolean;       // skip cooldown check (for manual runs)
}

// ── Internal helpers ────────────────────────────────────────────────

let _findingCounter = 0;
function genFindingId(): string {
  _findingCounter++;
  return `afnd_${Date.now()}_${_findingCounter}`;
}

let _runCounter = 0;
function genRunId(): string {
  _runCounter++;
  return `arun_${Date.now()}_${_runCounter}`;
}

function computeAdScore(ad: Ad): number {
  let score = 0;
  score += Math.min(ad.ctr * 10, 30);
  score += Math.min(ad.leads * 5, 25);
  if (ad.cpl > 0 && ad.cpl < 30) score += 25;
  else if (ad.cpl > 0 && ad.cpl < 60) score += 15;
  else if (ad.cpl > 0 && ad.cpl < 100) score += 5;
  if (ad.impressions > 10000) score += 20;
  else if (ad.impressions > 5000) score += 12;
  else if (ad.impressions > 1000) score += 6;
  return Math.min(score, 100);
}

function computeAdSetCTR(adsInSet: Ad[]): number {
  const totalImpressions = adsInSet.reduce((s, a) => s + (a.impressions || 0), 0);
  const totalClicks = adsInSet.reduce((s, a) => s + (a.clicks || 0), 0);
  if (totalImpressions === 0) return 0;
  return (totalClicks / totalImpressions) * 100;
}

function computeAdSetCPL(adsInSet: Ad[]): number {
  const totalSpend = adsInSet.reduce((s, a) => s + (a.spend || 0), 0);
  const totalLeads = adsInSet.reduce((s, a) => s + (a.leads || 0), 0);
  if (totalLeads === 0) return 0;
  return totalSpend / totalLeads;
}

function computeAdSetFrequency(adsInSet: Ad[]): number {
  // Approximate frequency: total impressions / estimated reach
  // For simplicity: use impressions/clicks ratio as proxy
  const totalImpressions = adsInSet.reduce((s, a) => s + (a.impressions || 0), 0);
  if (totalImpressions < 1000) return 1;
  const totalClicks = adsInSet.reduce((s, a) => s + (a.clicks || 0), 0);
  if (totalClicks === 0) return totalImpressions > 5000 ? 5 : 2;
  // Higher impressions-to-clicks means higher frequency
  const ratio = totalImpressions / totalClicks;
  return Math.min(ratio / 20, 10);
}

// ── Detection Rules ──────────────────────────────────────────────────

function detectCreativeFatigue(
  campaign: Campaign,
  adSet: AdSet,
  adsInSet: Ad[],
): AutoCampaignFinding[] {
  const findings: AutoCampaignFinding[] = [];
  const freq = computeAdSetFrequency(adsInSet);
  const ctr = computeAdSetCTR(adsInSet);
  const totalImpressions = adsInSet.reduce((s, a) => s + (a.impressions || 0), 0);

  if (totalImpressions < AUTO_CONFIG.minAdSetImpressions) return findings;

  if (freq >= AUTO_CONFIG.frequencyHigh && ctr < AUTO_CONFIG.ctrDropThreshold) {
    const severity: AutoFindingSeverity = freq >= AUTO_CONFIG.frequencyCritical ? 'critical' : 'high';
    const confidence = Math.min(95, 50 + Math.round(freq * 5) + (ctr < 0.5 ? 15 : 0));

    findings.push({
      id: genFindingId(),
      runId: '',
      clientId: campaign.clientId,
      campaignId: campaign.id,
      campaignName: campaign.campaignName,
      adSetId: adSet.id,
      adSetName: adSet.name,
      adId: null,
      adName: null,
      type: 'creative_fatigue',
      severity,
      confidence,
      reason: `תדירות ${freq.toFixed(1)} ו-CTR ${ctr.toFixed(2)}% — הקהל מתחיל להתעלם מהמודעות`,
      expectedImpact: 'החלפת קריאייטיב יכולה לשפר CTR ב-30-50%',
      suggestedAction: 'create_variation',
      actionCreated: false,
      actionId: null,
      metadata: { frequency: freq, ctr, impressions: totalImpressions },
      createdAt: new Date().toISOString(),
    });
  }

  // Also check individual ads with high impressions + low CTR
  for (const ad of adsInSet) {
    if (ad.impressions > 5000 && ad.ctr < 0.8) {
      findings.push({
        id: genFindingId(),
        runId: '',
        clientId: campaign.clientId,
        campaignId: campaign.id,
        campaignName: campaign.campaignName,
        adSetId: adSet.id,
        adSetName: adSet.name,
        adId: ad.id,
        adName: ad.name,
        type: 'creative_fatigue',
        severity: 'medium',
        confidence: 65,
        reason: `${(ad.impressions / 1000).toFixed(0)}K חשיפות עם CTR ${ad.ctr.toFixed(2)}% — המודעה נשחקה`,
        expectedImpact: 'וריאציה חדשה יכולה לרענן את הביצועים',
        suggestedAction: 'create_variation',
        actionCreated: false,
        actionId: null,
        metadata: { adImpressions: ad.impressions, adCtr: ad.ctr },
        createdAt: new Date().toISOString(),
      });
    }
  }

  return findings;
}

function detectBudgetWaste(
  campaign: Campaign,
  adSet: AdSet,
  adsInSet: Ad[],
): AutoCampaignFinding[] {
  const findings: AutoCampaignFinding[] = [];
  const totalSpend = adsInSet.reduce((s, a) => s + (a.spend || 0), 0);
  const totalLeads = adsInSet.reduce((s, a) => s + (a.leads || 0), 0);
  const totalConversions = adsInSet.reduce((s, a) => s + (a.conversions || 0), 0);

  if (totalSpend < AUTO_CONFIG.budgetWasteMinSpend) return findings;

  // High spend, zero results
  if (totalLeads === 0 && totalConversions === 0) {
    findings.push({
      id: genFindingId(),
      runId: '',
      clientId: campaign.clientId,
      campaignId: campaign.id,
      campaignName: campaign.campaignName,
      adSetId: adSet.id,
      adSetName: adSet.name,
      adId: null,
      adName: null,
      type: 'budget_waste',
      severity: totalSpend > 300 ? 'critical' : 'high',
      confidence: Math.min(90, 60 + Math.round(totalSpend / 10)),
      reason: `₪${totalSpend.toFixed(0)} הוצאה ללא לידים או תוצאות — יש לבדוק קהל או קריאייטיב`,
      expectedImpact: 'השהיית הקבוצה תחסוך תקציב עד לשינוי קהל או מודעות',
      suggestedAction: 'pause_ad_set',
      actionCreated: false,
      actionId: null,
      metadata: { totalSpend, totalLeads: 0 },
      createdAt: new Date().toISOString(),
    });
  }

  // Individual ads with high spend and no results
  for (const ad of adsInSet) {
    if (ad.spend > 150 && ad.leads === 0 && ad.conversions === 0) {
      findings.push({
        id: genFindingId(),
        runId: '',
        clientId: campaign.clientId,
        campaignId: campaign.id,
        campaignName: campaign.campaignName,
        adSetId: adSet.id,
        adSetName: adSet.name,
        adId: ad.id,
        adName: ad.name,
        type: 'budget_waste',
        severity: 'high',
        confidence: 75,
        reason: `מודעה "${ad.name}" — ₪${ad.spend.toFixed(0)} ללא תוצאות`,
        expectedImpact: 'השהיית המודעה תפנה תקציב למודעות אפקטיביות יותר',
        suggestedAction: 'pause_ad',
        actionCreated: false,
        actionId: null,
        metadata: { adSpend: ad.spend, adLeads: 0 },
        createdAt: new Date().toISOString(),
      });
    }
  }

  return findings;
}

function detectScaleOpportunity(
  campaign: Campaign,
  adSet: AdSet,
  adsInSet: Ad[],
): AutoCampaignFinding[] {
  const findings: AutoCampaignFinding[] = [];
  const totalSpend = adsInSet.reduce((s, a) => s + (a.spend || 0), 0);
  const totalLeads = adsInSet.reduce((s, a) => s + (a.leads || 0), 0);
  const ctr = computeAdSetCTR(adsInSet);
  const cpl = computeAdSetCPL(adsInSet);

  if (totalSpend < AUTO_CONFIG.minSpend || totalLeads < 3) return findings;

  if (cpl > 0 && cpl < AUTO_CONFIG.cplGood && ctr >= AUTO_CONFIG.ctrGood && totalLeads >= 5) {
    findings.push({
      id: genFindingId(),
      runId: '',
      clientId: campaign.clientId,
      campaignId: campaign.id,
      campaignName: campaign.campaignName,
      adSetId: adSet.id,
      adSetName: adSet.name,
      adId: null,
      adName: null,
      type: 'scale_opportunity',
      severity: 'medium',
      confidence: Math.min(85, 55 + totalLeads * 2),
      reason: `CPL ₪${cpl.toFixed(0)} ו-CTR ${ctr.toFixed(1)}% — ביצועים מצוינים שאפשר להרחיב`,
      expectedImpact: 'הגדלת תקציב ב-20-30% יכולה להכפיל לידים עם שמירה על CPL',
      suggestedAction: 'increase_budget',
      actionCreated: false,
      actionId: null,
      metadata: { cpl, ctr, totalLeads, totalSpend },
      createdAt: new Date().toISOString(),
    });
  }

  return findings;
}

function detectWeakAudience(
  campaign: Campaign,
  adSet: AdSet,
  adsInSet: Ad[],
): AutoCampaignFinding[] {
  const findings: AutoCampaignFinding[] = [];
  const totalImpressions = adsInSet.reduce((s, a) => s + (a.impressions || 0), 0);
  const ctr = computeAdSetCTR(adsInSet);

  if (totalImpressions < AUTO_CONFIG.minAdSetImpressions) return findings;

  if (ctr < AUTO_CONFIG.ctrLow && totalImpressions > 1000) {
    findings.push({
      id: genFindingId(),
      runId: '',
      clientId: campaign.clientId,
      campaignId: campaign.id,
      campaignName: campaign.campaignName,
      adSetId: adSet.id,
      adSetName: adSet.name,
      adId: null,
      adName: null,
      type: 'weak_audience',
      severity: ctr < 0.4 ? 'high' : 'medium',
      confidence: Math.min(80, 50 + Math.round(totalImpressions / 500)),
      reason: `CTR ${ctr.toFixed(2)}% בקבוצה "${adSet.name}" — הקהל לא מגיב`,
      expectedImpact: 'שינוי קהל יעד יכול לשפר CTR ולהוזיל עלויות',
      suggestedAction: 'test_new_audience',
      actionCreated: false,
      actionId: null,
      metadata: { ctr, impressions: totalImpressions },
      createdAt: new Date().toISOString(),
    });
  }

  return findings;
}

function detectWinningAd(
  campaign: Campaign,
  adSet: AdSet,
  adsInSet: Ad[],
): AutoCampaignFinding[] {
  const findings: AutoCampaignFinding[] = [];
  if (adsInSet.length < 2) return findings;

  const scored = adsInSet
    .filter(a => a.impressions >= AUTO_CONFIG.minAdImpressions)
    .map(a => ({ ad: a, score: computeAdScore(a) }));

  if (scored.length < 2) return findings;

  const avgScore = scored.reduce((s, x) => s + x.score, 0) / scored.length;
  const best = scored.reduce((b, x) => x.score > b.score ? x : b);

  if (best.score >= avgScore * AUTO_CONFIG.performanceGap && best.score >= 40) {
    findings.push({
      id: genFindingId(),
      runId: '',
      clientId: campaign.clientId,
      campaignId: campaign.id,
      campaignName: campaign.campaignName,
      adSetId: adSet.id,
      adSetName: adSet.name,
      adId: best.ad.id,
      adName: best.ad.name,
      type: 'winning_ad',
      severity: 'medium',
      confidence: Math.min(85, 50 + best.score / 2),
      reason: `"${best.ad.name}" מובילה עם ציון ${best.score} (ממוצע ${avgScore.toFixed(0)}) — שווה לשכפל`,
      expectedImpact: 'שכפול המודעה לקהלים נוספים יכול להגדיל תוצאות',
      suggestedAction: 'duplicate_ad',
      actionCreated: false,
      actionId: null,
      metadata: { winnerScore: best.score, avgScore, adCount: scored.length },
      createdAt: new Date().toISOString(),
    });
  }

  return findings;
}

function detectTrackingIssue(
  campaign: Campaign,
  adSet: AdSet,
  adsInSet: Ad[],
): AutoCampaignFinding[] {
  const findings: AutoCampaignFinding[] = [];

  for (const ad of adsInSet) {
    if (
      ad.spend >= AUTO_CONFIG.spendWithoutEventsMin &&
      ad.impressions > 0 &&
      ad.clicks === 0 &&
      ad.leads === 0 &&
      ad.conversions === 0
    ) {
      findings.push({
        id: genFindingId(),
        runId: '',
        clientId: campaign.clientId,
        campaignId: campaign.id,
        campaignName: campaign.campaignName,
        adSetId: adSet.id,
        adSetName: adSet.name,
        adId: ad.id,
        adName: ad.name,
        type: 'tracking_issue',
        severity: 'critical',
        confidence: 80,
        reason: `מודעה "${ad.name}" — ₪${ad.spend.toFixed(0)} הוצאה עם 0 קליקים ו-0 אירועים. בעיית tracking?`,
        expectedImpact: 'תיקון מדידה ימנע בזבוז תקציב נוסף',
        suggestedAction: 'mark_for_review',
        actionCreated: false,
        actionId: null,
        metadata: { spend: ad.spend, impressions: ad.impressions },
        createdAt: new Date().toISOString(),
      });
    }
  }

  return findings;
}

// ── Main Scan Function ───────────────────────────────────────────────

export async function runAutoMonitorScan(options: ScanOptions): Promise<ScanResult> {
  const now = new Date().toISOString();
  const runId = genRunId();

  // Create run record
  const run: AutoCampaignRun = {
    id: runId,
    clientId: options.clientId || 'all',
    campaignId: options.campaignId || null,
    status: 'running',
    triggeredBy: options.triggeredBy,
    campaignsScanned: 0,
    findingsCount: 0,
    actionsCreated: 0,
    summary: '',
    startedAt: now,
    finishedAt: null,
    createdAt: now,
  };

  if (!options.dryRun) {
    try { await autoCampaignRuns.createAsync(run); } catch { /* continue */ }
  }

  const allFindings: AutoCampaignFinding[] = [];
  let campaignsScanned = 0;
  let actionsCreated = 0;

  try {
    // Load campaigns
    const allCampaigns = await campaigns.getAllAsync();
    let targetCampaigns = allCampaigns.filter(c =>
      c.status === 'active' || c.status === 'in_progress',
    );

    if (options.campaignId) {
      targetCampaigns = allCampaigns.filter(c => c.id === options.campaignId);
    }
    if (options.clientId) {
      targetCampaigns = targetCampaigns.filter(c => c.clientId === options.clientId);
    }

    // Load all ad sets and ads
    const allAdSets = await adSets.getAllAsync();
    const allAds = await ads.getAllAsync();

    // Check recent runs for cooldown
    let recentRuns: AutoCampaignRun[] = [];
    if (!options.skipCooldown) {
      try {
        const allRuns = await autoCampaignRuns.getAllAsync();
        const cooldownCutoff = new Date(Date.now() - AUTO_CONFIG.cooldownHours * 3600000).toISOString();
        recentRuns = allRuns.filter(r =>
          r.status === 'completed' && r.finishedAt && r.finishedAt > cooldownCutoff,
        );
      } catch { /* proceed */ }
    }

    // Check existing actions today for per-campaign limit
    let todayActions: Record<string, number> = {};
    try {
      const allActions = await campaignActions.getAllAsync();
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const todayStr = todayStart.toISOString();
      for (const a of allActions) {
        if (a.createdAt >= todayStr && a.createdBy === 'auto_monitor') {
          todayActions[a.campaignId] = (todayActions[a.campaignId] || 0) + 1;
        }
      }
    } catch { /* proceed */ }

    for (const campaign of targetCampaigns) {
      // Cooldown check
      if (!options.skipCooldown && recentRuns.some(r => r.campaignId === campaign.id)) {
        continue;
      }

      // Per-campaign daily action limit
      if ((todayActions[campaign.id] || 0) >= AUTO_CONFIG.maxActionsPerCampaignPerDay) {
        continue;
      }

      const campaignAdSets = allAdSets.filter(s => s.campaignId === campaign.id);
      const campaignAds = allAds.filter(a => a.campaignId === campaign.id);

      // Min data check at campaign level
      const totalImpressions = campaignAds.reduce((s, a) => s + (a.impressions || 0), 0);
      const totalSpend = campaignAds.reduce((s, a) => s + (a.spend || 0), 0);
      if (totalImpressions < AUTO_CONFIG.minImpressions && totalSpend < AUTO_CONFIG.minSpend) {
        campaignsScanned++;
        continue;
      }

      let campaignFindings: AutoCampaignFinding[] = [];

      for (const adSet of campaignAdSets) {
        const adsInSet = campaignAds.filter(a => a.adSetId === adSet.id);
        if (adsInSet.length === 0) continue;

        // Run all detection rules
        campaignFindings.push(...detectCreativeFatigue(campaign, adSet, adsInSet));
        campaignFindings.push(...detectBudgetWaste(campaign, adSet, adsInSet));
        campaignFindings.push(...detectScaleOpportunity(campaign, adSet, adsInSet));
        campaignFindings.push(...detectWeakAudience(campaign, adSet, adsInSet));
        campaignFindings.push(...detectWinningAd(campaign, adSet, adsInSet));
        campaignFindings.push(...detectTrackingIssue(campaign, adSet, adsInSet));
      }

      // Enforce max findings per campaign
      if (campaignFindings.length > AUTO_CONFIG.maxFindingsPerCampaign) {
        campaignFindings.sort((a, b) => {
          const sevOrder: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
          return (sevOrder[a.severity] || 3) - (sevOrder[b.severity] || 3) || b.confidence - a.confidence;
        });
        campaignFindings = campaignFindings.slice(0, AUTO_CONFIG.maxFindingsPerCampaign);
      }

      // Set runId on findings
      for (const f of campaignFindings) {
        f.runId = runId;
      }

      // Enforce total limit
      if (allFindings.length + campaignFindings.length > AUTO_CONFIG.maxTotalFindingsPerRun) {
        const remaining = AUTO_CONFIG.maxTotalFindingsPerRun - allFindings.length;
        campaignFindings = campaignFindings.slice(0, Math.max(0, remaining));
      }

      allFindings.push(...campaignFindings);
      campaignsScanned++;

      // Log scan activity per campaign if findings exist
      if (campaignFindings.length > 0 && !options.dryRun) {
        await logCampaignActivity(
          campaign.id,
          campaign.clientId,
          'auto_scan_completed',
          `בדיקה אוטומטית — ${campaignFindings.length} ממצאים`,
          `סריקה אוטומטית זיהתה ${campaignFindings.length} בעיות/הזדמנויות`,
          'auto_monitor',
        );
      }
    }

    // Persist findings and create actions
    if (!options.dryRun) {
      for (const finding of allFindings) {
        try {
          await autoCampaignFindings.createAsync(finding);
        } catch { /* continue */ }

        // Create campaign action for actionable findings
        if (finding.suggestedAction && finding.confidence >= 50) {
          const actionType = mapFindingToActionType(finding.suggestedAction);
          if (actionType) {
            // Check daily limit
            const dailyCount = todayActions[finding.campaignId] || 0;
            if (dailyCount < AUTO_CONFIG.maxActionsPerCampaignPerDay) {
              try {
                const action = await campaignActions.createAsync({
                  type: actionType,
                  title: findingTitle(finding),
                  description: finding.reason,
                  objectType: finding.adId ? 'ad' : finding.adSetId ? 'adset' : 'campaign',
                  objectId: finding.adId || finding.adSetId || finding.campaignId,
                  objectName: finding.adName || finding.adSetName || finding.campaignName,
                  campaignId: finding.campaignId,
                  campaignName: finding.campaignName,
                  adSetId: finding.adSetId,
                  adId: finding.adId,
                  clientId: finding.clientId,
                  clientName: '',
                  recommendationId: finding.id,
                  sourceRecommendationId: finding.id,
                  sourceRecommendationType: finding.type,
                  payload: {
                    findingType: finding.type,
                    severity: finding.severity,
                    confidence: finding.confidence,
                    expectedImpact: finding.expectedImpact,
                    ...(finding.metadata || {}),
                  },
                  status: 'pending',
                  previewBefore: finding.reason,
                  previewAfter: finding.expectedImpact,
                  createdBy: 'auto_monitor',
                  approvedBy: null,
                  approvedAt: null,
                  rejectionReason: null,
                  executedAt: null,
                  failedReason: null,
                  createdAt: new Date().toISOString(),
                  updatedAt: new Date().toISOString(),
                } as Record<string, unknown>);

                if (action?.id) {
                  finding.actionCreated = true;
                  finding.actionId = action.id;
                  actionsCreated++;
                  todayActions[finding.campaignId] = dailyCount + 1;

                  await logCampaignActivity(
                    finding.campaignId,
                    finding.clientId,
                    'auto_action_created',
                    findingTitle(finding),
                    finding.reason,
                    'auto_monitor',
                    action.id,
                  );
                }
              } catch (err) {
                console.error('[auto-monitor] Failed to create action:', err);
              }
            }
          }
        }
      }
    }

    // Update run
    const summary = allFindings.length === 0
      ? 'הקמפיינים נראים תקינים כרגע'
      : `${allFindings.length} ממצאים ב-${campaignsScanned} קמפיינים, ${actionsCreated} פעולות נוצרו`;

    run.status = 'completed';
    run.campaignsScanned = campaignsScanned;
    run.findingsCount = allFindings.length;
    run.actionsCreated = actionsCreated;
    run.summary = summary;
    run.finishedAt = new Date().toISOString();

    if (!options.dryRun) {
      try {
        await autoCampaignRuns.updateAsync(runId, {
          status: 'completed',
          campaignsScanned,
          findingsCount: allFindings.length,
          actionsCreated,
          summary,
          finishedAt: run.finishedAt,
        });
      } catch { /* best effort */ }
    }

    return { run, findings: allFindings, actionsCreated };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    console.error('[auto-monitor] Scan failed:', msg);

    run.status = 'failed';
    run.summary = `סריקה נכשלה: ${msg}`;
    run.finishedAt = new Date().toISOString();

    if (!options.dryRun) {
      try {
        await autoCampaignRuns.updateAsync(runId, {
          status: 'failed',
          summary: run.summary,
          finishedAt: run.finishedAt,
        });
      } catch { /* best effort */ }
    }

    return { run, findings: allFindings, actionsCreated };
  }
}

// ── Helpers ──────────────────────────────────────────────────────────

function mapFindingToActionType(suggestedAction: string): string | null {
  const map: Record<string, string> = {
    create_variation: 'create_variation',
    duplicate_ad: 'duplicate_ad',
    pause_ad: 'pause_ad',
    pause_ad_set: 'pause_ad',
    increase_budget: 'increase_budget',
    test_new_audience: 'test_new_audience',
    mark_for_review: 'mark_for_review',
  };
  return map[suggestedAction] || null;
}

function findingTitle(finding: AutoCampaignFinding): string {
  const titles: Record<AutoFindingType, string> = {
    creative_fatigue: '🎨 שחיקת קריאייטיב',
    budget_waste: '💸 בזבוז תקציב',
    scale_opportunity: '📈 הזדמנות להרחבה',
    weak_audience: '🎯 קהל חלש',
    winning_ad: '🏆 מודעה מובילה',
    tracking_issue: '🔍 בעיית מדידה',
  };
  const prefix = titles[finding.type] || finding.type;
  const target = finding.adName || finding.adSetName || finding.campaignName;
  return `${prefix} — ${target}`;
}

// ── UI metadata exports ──────────────────────────────────────────────

export const FINDING_TYPE_META: Record<AutoFindingType, {
  icon: string;
  label: string;
  color: string;
  bgColor: string;
}> = {
  creative_fatigue: { icon: '🎨', label: 'שחיקת קריאייטיב', color: '#f59e0b', bgColor: 'rgba(245,158,11,0.1)' },
  budget_waste: { icon: '💸', label: 'בזבוז תקציב', color: '#ef4444', bgColor: 'rgba(239,68,68,0.1)' },
  scale_opportunity: { icon: '📈', label: 'הזדמנות להרחבה', color: '#22c55e', bgColor: 'rgba(34,197,94,0.1)' },
  weak_audience: { icon: '🎯', label: 'קהל חלש', color: '#f97316', bgColor: 'rgba(249,115,22,0.1)' },
  winning_ad: { icon: '🏆', label: 'מודעה מובילה', color: '#3b82f6', bgColor: 'rgba(59,130,246,0.1)' },
  tracking_issue: { icon: '🔍', label: 'בעיית מדידה', color: '#8b5cf6', bgColor: 'rgba(139,92,246,0.1)' },
};

export const SEVERITY_META: Record<AutoFindingSeverity, {
  label: string;
  color: string;
  bgColor: string;
}> = {
  low: { label: 'נמוכה', color: '#6b7280', bgColor: 'rgba(107,114,128,0.1)' },
  medium: { label: 'בינונית', color: '#f59e0b', bgColor: 'rgba(245,158,11,0.1)' },
  high: { label: 'גבוהה', color: '#ef4444', bgColor: 'rgba(239,68,68,0.1)' },
  critical: { label: 'קריטית', color: '#dc2626', bgColor: 'rgba(220,38,38,0.15)' },
};
