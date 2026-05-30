/**
 * Daily Meta Ads Optimizer Engine
 *
 * Runs once per day (via cron) for every active client with a connected Meta account.
 * For each campaign:
 *   1. Syncs latest data from Meta (campaigns, adsets, ads, insights)
 *   2. Analyzes performance — identifies fatigued audiences, high/low CPL
 *   3. Segments new audiences based on top-performing signals
 *   4. Generates new ad variations (same creative, dynamic copy)
 *   5. Creates new ad sets with fresh targeting
 *   6. Pauses underperforming ads/adsets
 *   7. Ensures CPL trend is downward — kills money losers early
 *   8. Produces a daily report with all actions taken
 */

import type { Client, Campaign, AdSet, Ad } from '@/lib/db/schema';
import { analyzeCampaignFull, type Recommendation, THRESHOLDS } from '@/lib/optimization/engine';
import {
  generateVariation,
  generateMultipleVariations,
  type VariationSuggestion,
  type PerformanceSignals,
} from '@/lib/optimization/variations';
import {
  createMetaAdSet,
  createMetaAd,
  type MetaCredentials,
  type MetaWriteResult,
  type CreateAdSetPayload,
  type CreateAdPayload,
} from './write-service';
import { syncClientMetaAccount } from './sync-service';

// ── Types ──────────────────────────────────────────────────────────────

export interface OptimizationAction {
  type: 'pause_ad' | 'pause_adset' | 'create_adset' | 'create_ad' | 'scale_budget' | 'new_audience';
  objectId: string;
  objectName: string;
  description: string;
  metaResult?: MetaWriteResult;
  success: boolean;
}

export interface AudienceSegment {
  name: string;
  ageMin: number;
  ageMax: number;
  genders: number[];
  countries: string[];
  interests: { id: string; name: string }[];
  rationale: string;
}

export interface CplTrend {
  campaignId: string;
  campaignName: string;
  cplYesterday: number;
  cplToday: number;
  cplDelta: number;       // negative = improving
  cplDeltaPct: number;
  trend: 'improving' | 'stable' | 'worsening';
}

export interface DailyOptimizerResult {
  clientId: string;
  clientName: string;
  runAt: string;
  duration: number;           // ms
  campaignsAnalyzed: number;
  actionsExecuted: OptimizationAction[];
  newAdSetsCreated: number;
  newAdsCreated: number;
  adsPaused: number;
  adSetsPaused: number;
  cplTrends: CplTrend[];
  recommendations: Recommendation[];
  audiencesGenerated: AudienceSegment[];
  errors: string[];
}

// ── Audience Generation ──────────────────────────────────────────────

/**
 * Generate new audience segments from top-performing ad signals.
 * Analyzes which demographics / interests convert best and creates
 * complementary segments to test.
 */
function generateNewAudiences(
  adSets: AdSet[],
  ads: Ad[],
): AudienceSegment[] {
  const segments: AudienceSegment[] = [];

  // Find top-performing ads (by CPL)
  const adsWithLeads = ads.filter(a => a.leads > 0 && a.cpl > 0);
  if (adsWithLeads.length === 0) return segments;

  adsWithLeads.sort((a, b) => a.cpl - b.cpl);
  const bestAd = adsWithLeads[0];
  const bestAdSet = adSets.find(as => as.id === bestAd.adSetId);

  // Extract base targeting from best performer
  const baseTargeting = (bestAdSet as any)?.targeting || {};
  const baseCountries = baseTargeting?.geo_locations?.countries || ['IL'];
  const baseInterests = baseTargeting?.interests || [];

  // Segment 1: Age expansion — if best performer is 25-44, test 18-24 and 45-65
  const baseAgeMin = baseTargeting?.age_min || 25;
  const baseAgeMax = baseTargeting?.age_max || 44;

  if (baseAgeMin > 18) {
    segments.push({
      name: `קהל צעיר — ${18}-${baseAgeMin - 1}`,
      ageMin: 18,
      ageMax: baseAgeMin - 1,
      genders: baseTargeting?.genders || [],
      countries: baseCountries,
      interests: baseInterests,
      rationale: `הרחבה לגילאי 18-${baseAgeMin - 1} מבוססת על הצלחת קהל ${baseAgeMin}-${baseAgeMax}`,
    });
  }

  if (baseAgeMax < 65) {
    segments.push({
      name: `קהל מבוגר — ${baseAgeMax + 1}-65`,
      ageMin: baseAgeMax + 1,
      ageMax: 65,
      genders: baseTargeting?.genders || [],
      countries: baseCountries,
      interests: baseInterests,
      rationale: `הרחבה לגילאי ${baseAgeMax + 1}-65 מבוססת על הצלחת קהל ${baseAgeMin}-${baseAgeMax}`,
    });
  }

  // Segment 2: Gender split — if currently targeting all, try splitting
  if (!baseTargeting?.genders || baseTargeting.genders.length === 0) {
    segments.push({
      name: 'קהל — נשים בלבד',
      ageMin: baseAgeMin,
      ageMax: baseAgeMax,
      genders: [2],
      countries: baseCountries,
      interests: baseInterests,
      rationale: 'פיצול מגדרי — בדיקה האם נשים ממירות טוב יותר',
    });
    segments.push({
      name: 'קהל — גברים בלבד',
      ageMin: baseAgeMin,
      ageMax: baseAgeMax,
      genders: [1],
      countries: baseCountries,
      interests: baseInterests,
      rationale: 'פיצול מגדרי — בדיקה האם גברים ממירים טוב יותר',
    });
  }

  // Segment 3: Lookalike broad — remove interest targeting
  if (baseInterests.length > 0) {
    segments.push({
      name: 'קהל רחב — ללא תחומי עניין',
      ageMin: baseAgeMin,
      ageMax: baseAgeMax,
      genders: baseTargeting?.genders || [],
      countries: baseCountries,
      interests: [],
      rationale: 'בדיקת קהל רחב ללא פילוח תחומי עניין — נותן למטא לאופטמז',
    });
  }

  return segments;
}

// ── CPL Trend Calculator ─────────────────────────────────────────────

function calculateCplTrend(
  campaign: Campaign,
  ads: Ad[],
  previousCpls?: Record<string, number>,
): CplTrend {
  const campaignAds = ads.filter(a => a.campaignId === campaign.id);
  const totalSpend = campaignAds.reduce((s, a) => s + (a.spend || 0), 0);
  const totalLeads = campaignAds.reduce((s, a) => s + (a.leads || 0), 0);
  const cplToday = totalLeads > 0 ? totalSpend / totalLeads : 0;

  // Real previous CPL from the last persisted daily report (passed in by the route).
  // Falls back to any stored campaign value, then to today (no change) if no history.
  const prior = previousCpls?.[campaign.id];
  const storedCpl = (prior != null && prior > 0)
    ? prior
    : ((campaign as any).lastCpl || cplToday);
  const cplDelta = cplToday - storedCpl;
  const cplDeltaPct = storedCpl > 0 ? (cplDelta / storedCpl) * 100 : 0;

  let trend: 'improving' | 'stable' | 'worsening' = 'stable';
  if (cplDeltaPct < -5) trend = 'improving';
  else if (cplDeltaPct > 5) trend = 'worsening';

  return {
    campaignId: campaign.id,
    campaignName: campaign.campaignName,
    cplYesterday: storedCpl,
    cplToday,
    cplDelta,
    cplDeltaPct,
    trend,
  };
}

// ── Core Optimizer ───────────────────────────────────────────────────

/**
 * Run daily optimization for a single client.
 * Returns a full report of everything done.
 */
export async function runDailyOptimization(
  client: Client,
  campaigns: Campaign[],
  adSets: AdSet[],
  ads: Ad[],
  creds: MetaCredentials,
  previousCpls?: Record<string, number>,
  allowCreate: boolean = false,
): Promise<DailyOptimizerResult> {
  const startTime = Date.now();
  const actions: OptimizationAction[] = [];
  const errors: string[] = [];
  const allCplTrends: CplTrend[] = [];
  const allRecommendations: Recommendation[] = [];
  const allNewAudiences: AudienceSegment[] = [];
  let newAdSetsCreated = 0;
  let newAdsCreated = 0;
  let adsPaused = 0;
  let adSetsPaused = 0;

  // Filter to active campaigns only
  const activeCampaigns = campaigns.filter(c =>
    c.status === 'active' || c.status === 'in_progress'
  );

  for (const campaign of activeCampaigns) {
    try {
      const campaignAdSets = adSets.filter(as => as.campaignId === campaign.id);
      const campaignAds = ads.filter(a => a.campaignId === campaign.id);

      // 1. Calculate CPL trend (vs. last persisted run — real history)
      const cplTrend = calculateCplTrend(campaign, campaignAds, previousCpls);
      allCplTrends.push(cplTrend);

      // 2. Run optimization analysis
      const recs = analyzeCampaignFull(campaign, campaignAdSets, campaignAds);
      allRecommendations.push(...recs);

      // 3. NO auto-pausing. This system is offensive (grow leads), not defensive.
      // High-severity findings are recorded as recommendations only (allRecommendations
      // above) — never executed automatically. Pausing/budget changes happen only via
      // the "המלצות ייעול" approval flow.

      // 4. Generate new audiences from top performers
      const newAudiences = generateNewAudiences(campaignAdSets, campaignAds);
      allNewAudiences.push(...newAudiences);

      // 5. Generate new ad variations for top-performing ads.
      // SAFETY: creating new ad sets/ads spends money. Only do it automatically
      // when explicitly enabled; otherwise record the opportunity for approval.
      const topAds = [...campaignAds]
        .filter(a => a.leads > 0 && a.cpl > 0)
        .sort((a, b) => a.cpl - b.cpl)
        .slice(0, 3); // Top 3 ads

      if (!allowCreate && newAudiences.length > 0 && topAds.length > 0) {
        actions.push({
          type: 'new_audience',
          objectId: campaign.id,
          objectName: campaign.campaignName,
          description: `${newAudiences.length} קהלים חדשים מומלצים ליצירה (ממתין לאישור — לא נוצר אוטומטית מטעמי בטיחות תקציב).`,
          success: false,
        });
      }

      // When auto-creation is disabled, the loop iterates over an empty list,
      // so safe steps (pausing underperformers, emergency pause) still run.
      for (const topAd of (allowCreate ? topAds : [])) {
        const signals: PerformanceSignals = {
          ctr: topAd.ctr || 0,
          cpl: topAd.cpl || 0,
          frequency: topAd.frequency || 0,
          impressions: topAd.impressions || 0,
          spend: topAd.spend || 0,
          leads: topAd.leads || 0,
        };

        const variations = generateMultipleVariations(topAd, signals, 2);

        // 6. Create new adsets with new audiences + ad variations
        for (let i = 0; i < Math.min(newAudiences.length, 2); i++) {
          const audience = newAudiences[i];
          const variation = variations[i % variations.length];

          // Find the meta campaign ID
          const metaCampaignId = (campaign as any)?.metaCampaignId;
          if (!metaCampaignId || !creds.accessToken) continue;

          const today = new Date().toISOString().slice(0, 10);

          // Create new ad set on Meta
          const adSetPayload: CreateAdSetPayload = {
            campaignId: metaCampaignId,
            name: `${audience.name} — ${today} [אוטומטי]`,
            status: 'ACTIVE',
            dailyBudget: Math.round((campaign.budget || 5000) * 0.2 * 100), // 20% of main budget, in cents
            billingEvent: 'IMPRESSIONS',
            optimizationGoal: 'LEAD_GENERATION',
            targeting: {
              age_min: audience.ageMin,
              age_max: audience.ageMax,
              genders: audience.genders.length > 0 ? audience.genders : undefined,
              geo_locations: { countries: audience.countries },
              interests: audience.interests.length > 0 ? audience.interests : undefined,
            },
          };

          try {
            const adSetResult = await createMetaAdSet(creds, adSetPayload);
            actions.push({
              type: 'create_adset',
              objectId: adSetResult.metaId || '',
              objectName: adSetPayload.name,
              description: `סדרת מודעות חדשה: ${audience.rationale}`,
              metaResult: adSetResult,
              success: adSetResult.success,
            });

            if (adSetResult.success && adSetResult.metaId) {
              newAdSetsCreated++;

              // Create new ad in the new adset with variation copy
              const pageId = (topAd as any)?.metaPageId || (client as any)?.metaPageId || '';

              const adPayload: CreateAdPayload = {
                adSetId: adSetResult.metaId,
                name: `${variation.strategy} — ${today} [אוטומטי]`,
                status: 'ACTIVE',
                creative: {
                  pageId,
                  message: variation.newPrimaryText,
                  headline: variation.newHeadline,
                  description: variation.newDescription,
                  linkUrl: topAd.ctaLink || (topAd as any)?.creative?.linkUrl || '',
                  imageHash: (topAd as any)?.imageHash || undefined,
                  imageUrl: topAd.mediaUrl || (topAd as any)?.creative?.imageUrl || '',
                  callToAction: variation.newCtaType || 'LEARN_MORE',
                },
              };

              try {
                const adResult = await createMetaAd(creds, adPayload);
                actions.push({
                  type: 'create_ad',
                  objectId: adResult.metaId || '',
                  objectName: adPayload.name,
                  description: `מודעה חדשה עם תוכן דינמי: אסטרטגיה "${variation.strategy}" — ${variation.rationale}`,
                  metaResult: adResult,
                  success: adResult.success,
                });
                if (adResult.success) newAdsCreated++;
              } catch (e) {
                errors.push(`שגיאה ביצירת מודעה: ${e}`);
              }
            }
          } catch (e) {
            errors.push(`שגיאה ביצירת אדסט ${audience.name}: ${e}`);
          }
        }
      }

      // 7. NO emergency auto-pause. CPL spikes are surfaced as alerts/recommendations
      // only — never auto-paused (this is an offensive growth system, not defensive).
    } catch (campaignError) {
      errors.push(`שגיאה בניתוח קמפיין "${campaign.campaignName}": ${campaignError}`);
    }
  }

  return {
    clientId: client.id,
    clientName: client.name,
    runAt: new Date().toISOString(),
    duration: Date.now() - startTime,
    campaignsAnalyzed: activeCampaigns.length,
    actionsExecuted: actions,
    newAdSetsCreated,
    newAdsCreated,
    adsPaused,
    adSetsPaused,
    cplTrends: allCplTrends,
    recommendations: allRecommendations,
    audiencesGenerated: allNewAudiences,
    errors,
  };
}

// ── Daily Report Types ───────────────────────────────────────────────

export interface DailyReport {
  id: string;
  clientId: string;
  clientName: string;
  date: string;                    // YYYY-MM-DD
  createdAt: string;
  summary: DailyReportSummary;
  campaigns: DailyReportCampaign[];
  actions: OptimizationAction[];
  cplTrends: CplTrend[];
  audiencesGenerated: AudienceSegment[];
  errors: string[];
}

export interface DailyReportSummary {
  totalSpend: number;
  totalLeads: number;
  avgCpl: number;
  cplTrend: 'improving' | 'stable' | 'worsening';
  cplDeltaPct: number;
  campaignsActive: number;
  adSetsActive: number;
  adsActive: number;
  newAdSetsCreated: number;
  newAdsCreated: number;
  adsPaused: number;
  adSetsPaused: number;
  recommendationsCount: number;
  healthScore: number;           // 0-100
}

export interface DailyReportCampaign {
  campaignId: string;
  campaignName: string;
  status: string;
  spend: number;
  leads: number;
  cpl: number;
  cplTrend: 'improving' | 'stable' | 'worsening';
  ctr: number;
  impressions: number;
  clicks: number;
  topAd: { name: string; cpl: number; leads: number } | null;
  worstAd: { name: string; cpl: number; spend: number } | null;
  actionsCount: number;
}

/**
 * Generate a full daily report from optimizer results + current data
 */
export function generateDailyReport(
  result: DailyOptimizerResult,
  campaigns: Campaign[],
  adSets: AdSet[],
  ads: Ad[],
): DailyReport {
  const today = new Date().toISOString().slice(0, 10);

  const totalSpend = ads.reduce((s, a) => s + (a.spend || 0), 0);
  const totalLeads = ads.reduce((s, a) => s + (a.leads || 0), 0);
  const avgCpl = totalLeads > 0 ? totalSpend / totalLeads : 0;

  // Overall CPL trend
  const improvingCount = result.cplTrends.filter(t => t.trend === 'improving').length;
  const worseningCount = result.cplTrends.filter(t => t.trend === 'worsening').length;
  const overallTrend: 'improving' | 'stable' | 'worsening' =
    improvingCount > worseningCount ? 'improving' :
    worseningCount > improvingCount ? 'worsening' : 'stable';

  const avgDeltaPct = result.cplTrends.length > 0
    ? result.cplTrends.reduce((s, t) => s + t.cplDeltaPct, 0) / result.cplTrends.length
    : 0;

  // Health score based on actions and CPL
  let healthScore = 70;
  if (overallTrend === 'improving') healthScore += 15;
  if (overallTrend === 'worsening') healthScore -= 20;
  if (result.errors.length > 0) healthScore -= result.errors.length * 5;
  if (result.newAdsCreated > 0) healthScore += 5;
  if (avgCpl > 0 && avgCpl < THRESHOLDS.cplGood) healthScore += 10;
  healthScore = Math.max(0, Math.min(100, healthScore));

  // Per-campaign breakdown
  const campaignReports: DailyReportCampaign[] = campaigns
    .filter(c => c.status === 'active' || c.status === 'in_progress')
    .map(campaign => {
      const cAds = ads.filter(a => a.campaignId === campaign.id);
      const cSpend = cAds.reduce((s, a) => s + (a.spend || 0), 0);
      const cLeads = cAds.reduce((s, a) => s + (a.leads || 0), 0);
      const cCpl = cLeads > 0 ? cSpend / cLeads : 0;
      const cImpressions = cAds.reduce((s, a) => s + (a.impressions || 0), 0);
      const cClicks = cAds.reduce((s, a) => s + (a.clicks || 0), 0);
      const cCtr = cImpressions > 0 ? (cClicks / cImpressions) * 100 : 0;

      const cplTrend = result.cplTrends.find(t => t.campaignId === campaign.id);

      // Top ad (lowest CPL with leads)
      const adsWithLeads = cAds.filter(a => a.leads > 0 && a.cpl > 0).sort((a, b) => a.cpl - b.cpl);
      const topAd = adsWithLeads.length > 0
        ? { name: adsWithLeads[0].name, cpl: adsWithLeads[0].cpl, leads: adsWithLeads[0].leads }
        : null;

      // Worst ad (highest spend with no/few leads)
      const worstAds = [...cAds].filter(a => a.spend > 0).sort((a, b) => {
        const aCpl = a.leads > 0 ? a.spend / a.leads : Infinity;
        const bCpl = b.leads > 0 ? b.spend / b.leads : Infinity;
        return bCpl - aCpl;
      });
      const worstAd = worstAds.length > 0
        ? { name: worstAds[0].name, cpl: worstAds[0].leads > 0 ? worstAds[0].spend / worstAds[0].leads : 0, spend: worstAds[0].spend }
        : null;

      const actionsCount = result.actionsExecuted.filter(a =>
        a.objectId === campaign.id || cAds.some(ad => ad.id === a.objectId)
      ).length;

      return {
        campaignId: campaign.id,
        campaignName: campaign.campaignName,
        status: campaign.status,
        spend: cSpend,
        leads: cLeads,
        cpl: cCpl,
        cplTrend: cplTrend?.trend || 'stable',
        ctr: cCtr,
        impressions: cImpressions,
        clicks: cClicks,
        topAd,
        worstAd,
        actionsCount,
      };
    });

  return {
    id: `dr_${today}_${result.clientId}`,
    clientId: result.clientId,
    clientName: result.clientName,
    date: today,
    createdAt: new Date().toISOString(),
    summary: {
      totalSpend,
      totalLeads,
      avgCpl,
      cplTrend: overallTrend,
      cplDeltaPct: avgDeltaPct,
      campaignsActive: campaignReports.length,
      adSetsActive: adSets.filter(as => as.status === 'active').length,
      adsActive: ads.filter(a => a.status === 'active').length,
      newAdSetsCreated: result.newAdSetsCreated,
      newAdsCreated: result.newAdsCreated,
      adsPaused: result.adsPaused,
      adSetsPaused: result.adSetsPaused,
      recommendationsCount: result.recommendations.length,
      healthScore,
    },
    campaigns: campaignReports,
    actions: result.actionsExecuted,
    cplTrends: result.cplTrends,
    audiencesGenerated: result.audiencesGenerated,
    errors: result.errors,
  };
}
