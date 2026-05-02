/**
 * Growth Rules Engine
 *
 * 8 rule categories that scan real data and detect growth opportunities:
 * 1. Scale — low CPL, stable leads, strong CTR
 * 2. Creative Replacement — fatigue, high frequency, CTR drop
 * 3. Budget Waste — spend without results, high CPL
 * 4. Platform Shift — one platform outperforming another
 * 5. Audience Expansion — ad set performing well, suggest broader
 * 6. Funnel Leak — leads coming in but low quality / no close
 * 7. Content-to-Campaign — strong content idea can become ad
 * 8. Client Risk — no activity, low results, delayed approvals
 *
 * All rules are deterministic. No AI API calls.
 * Returns GrowthOpportunity-shaped objects.
 */

import type {
  Campaign, Ad, AdSet, Lead,
  GrowthOpportunityType, GrowthOpportunitySeverity,
} from '@/lib/db/schema';
import type { ClientHealthScore } from '@/lib/bi/client-health';
import type { ClientProfitability } from '@/lib/bi/profitability';
import type { ContentIntelligenceResult } from '@/lib/bi/content-intelligence';
import type { EarlyWarning } from '@/lib/bi/early-warnings';
import type { PlatformComparisonResult } from '@/lib/bi/platform-comparison';

// ── Config ──

export const GROWTH_THRESHOLDS = {
  // Scale
  scaleCplMax: 40,
  scaleMinLeads: 5,
  scaleCtrMin: 1.5,
  scaleMinSpend: 100,

  // Creative fatigue
  fatigueFrequencyMin: 4.0,
  fatigueCtrDropPercent: 30,
  fatigueCtrMax: 1.0,
  fatigueMinImpressions: 1000,

  // Budget waste
  wasteMinSpend: 100,
  wasteCplMax: 120,
  wasteZeroLeadsMinSpend: 50,

  // Platform shift
  platformCplDiffPercent: 30,
  platformMinSpend: 50,

  // Audience expansion
  audienceCtrMin: 2.0,
  audienceMinLeads: 3,
  audienceMinImpressions: 500,

  // Funnel leak
  funnelMinLeads: 5,
  funnelLowQualityPercent: 60,

  // Client risk
  riskDaysInactive: 14,
  riskMinCampaigns: 1,

  // Safety
  minDataPoints: 3,
  maxOpportunitiesPerClient: 10,
  maxOpportunitiesPerRun: 80,
};

// ── Opportunity shape (pre-persistence) ──

export interface RawOpportunity {
  clientId: string;
  clientName: string;
  campaignId: string | null;
  campaignName: string | null;
  adSetId: string | null;
  adId: string | null;
  platform: string | null;
  type: GrowthOpportunityType;
  severity: GrowthOpportunitySeverity;
  confidence: number;
  title: string;
  reason: string;
  expectedImpact: string;
  metadata: Record<string, unknown>;
}

// ── Client context for rules ──

export interface ClientContext {
  clientId: string;
  clientName: string;
  campaigns: Campaign[];
  adSets: AdSet[];
  ads: Ad[];
  leads: Lead[];
  health?: ClientHealthScore;
  profitability?: ClientProfitability;
  content?: ContentIntelligenceResult;
  warnings?: EarlyWarning[];
  platformComparison?: PlatformComparisonResult;
}

// ── Rule runner ──

export function runAllRules(ctx: ClientContext): RawOpportunity[] {
  const opps: RawOpportunity[] = [];

  opps.push(...detectScaleOpportunities(ctx));
  opps.push(...detectCreativeReplacement(ctx));
  opps.push(...detectBudgetWaste(ctx));
  opps.push(...detectPlatformShift(ctx));
  opps.push(...detectAudienceExpansion(ctx));
  opps.push(...detectFunnelLeak(ctx));
  opps.push(...detectContentToCampaign(ctx));
  opps.push(...detectClientRisk(ctx));

  // Cap per client
  return opps
    .sort((a, b) => {
      const sevOrder = { critical: 0, high: 1, medium: 2, low: 3 };
      return (sevOrder[a.severity] - sevOrder[b.severity]) || (b.confidence - a.confidence);
    })
    .slice(0, GROWTH_THRESHOLDS.maxOpportunitiesPerClient);
}

// ── 1. Scale Opportunities ──

function detectScaleOpportunities(ctx: ClientContext): RawOpportunity[] {
  const opps: RawOpportunity[] = [];
  const activeCampaigns = ctx.campaigns.filter(c => c.status === 'active');

  for (const campaign of activeCampaigns) {
    const campaignAds = ctx.ads.filter(a => a.campaignId === campaign.id);
    const campaignLeads = ctx.leads.filter(l => l.campaignId === campaign.id);
    const totalSpend = campaignAds.reduce((s, a) => s + (Number(a.spend) || 0), 0);
    const totalClicks = campaignAds.reduce((s, a) => s + (Number(a.clicks) || 0), 0);
    const totalImpressions = campaignAds.reduce((s, a) => s + (Number(a.impressions) || 0), 0);
    const cpl = campaignLeads.length > 0 ? totalSpend / campaignLeads.length : 0;
    const ctr = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;

    if (
      totalSpend >= GROWTH_THRESHOLDS.scaleMinSpend &&
      campaignLeads.length >= GROWTH_THRESHOLDS.scaleMinLeads &&
      cpl > 0 && cpl <= GROWTH_THRESHOLDS.scaleCplMax &&
      ctr >= GROWTH_THRESHOLDS.scaleCtrMin
    ) {
      const confidence = Math.min(95, 60 + Math.floor((GROWTH_THRESHOLDS.scaleCplMax - cpl) / 2));
      opps.push({
        clientId: ctx.clientId,
        clientName: ctx.clientName,
        campaignId: campaign.id,
        campaignName: campaign.campaignName || campaign.id,
        adSetId: null,
        adId: null,
        platform: campaign.platform || null,
        type: 'scale',
        severity: cpl < 20 ? 'high' : 'medium',
        confidence,
        title: `הזדמנות להגדלת תקציב — ${campaign.campaignName || 'קמפיין'}`,
        reason: `CPL נמוך (₪${cpl.toFixed(0)}), CTR חזק (${ctr.toFixed(2)}%), ${campaignLeads.length} לידים`,
        expectedImpact: `הגדלת תקציב ב-20-50% עשויה להניב עוד ${Math.ceil(campaignLeads.length * 0.3)} לידים`,
        metadata: { cpl, ctr, leads: campaignLeads.length, spend: totalSpend },
      });
    }
  }

  return opps;
}

// ── 2. Creative Replacement ──

function detectCreativeReplacement(ctx: ClientContext): RawOpportunity[] {
  const opps: RawOpportunity[] = [];

  for (const ad of ctx.ads) {
    if (ad.status !== 'active') continue;
    const impressions = Number(ad.impressions) || 0;
    const clicks = Number(ad.clicks) || 0;
    const ctr = impressions > 0 ? (clicks / impressions) * 100 : 0;
    const frequency = Number((ad as any).frequency) || 0;

    if (impressions < GROWTH_THRESHOLDS.fatigueMinImpressions) continue;

    const isFatigued = frequency >= GROWTH_THRESHOLDS.fatigueFrequencyMin;
    const lowCtr = ctr < GROWTH_THRESHOLDS.fatigueCtrMax && impressions > 2000;

    if (isFatigued || lowCtr) {
      const campaign = ctx.campaigns.find(c => c.id === ad.campaignId);
      const severity: GrowthOpportunitySeverity = frequency >= 6 ? 'high' : 'medium';
      const confidence = Math.min(90, 50 + (isFatigued ? 20 : 0) + (lowCtr ? 20 : 0));

      opps.push({
        clientId: ctx.clientId,
        clientName: ctx.clientName,
        campaignId: ad.campaignId || null,
        campaignName: campaign?.campaignName || null,
        adSetId: ad.adSetId || null,
        adId: ad.id,
        platform: campaign?.platform || null,
        type: 'creative_replacement',
        severity,
        confidence,
        title: `קריאייטיב עייף — ${ad.name || 'מודעה'}`,
        reason: isFatigued
          ? `תדירות גבוהה (${frequency.toFixed(1)}) — הקהל רואה את המודעה יותר מדי`
          : `CTR נמוך (${ctr.toFixed(2)}%) לאחר ${impressions.toLocaleString()} חשיפות`,
        expectedImpact: 'החלפת קריאייטיב עשויה לשפר CTR ב-30-50%',
        metadata: { frequency, ctr, impressions, adName: ad.name },
      });
    }
  }

  return opps;
}

// ── 3. Budget Waste ──

function detectBudgetWaste(ctx: ClientContext): RawOpportunity[] {
  const opps: RawOpportunity[] = [];

  // Campaign-level waste
  for (const campaign of ctx.campaigns.filter(c => c.status === 'active')) {
    const campaignAds = ctx.ads.filter(a => a.campaignId === campaign.id);
    const campaignLeads = ctx.leads.filter(l => l.campaignId === campaign.id);
    const totalSpend = campaignAds.reduce((s, a) => s + (Number(a.spend) || 0), 0);

    if (totalSpend < GROWTH_THRESHOLDS.wasteMinSpend) continue;

    if (campaignLeads.length === 0 && totalSpend >= GROWTH_THRESHOLDS.wasteZeroLeadsMinSpend) {
      opps.push({
        clientId: ctx.clientId,
        clientName: ctx.clientName,
        campaignId: campaign.id,
        campaignName: campaign.campaignName || null,
        adSetId: null, adId: null,
        platform: campaign.platform || null,
        type: 'budget_waste',
        severity: totalSpend > 300 ? 'critical' : 'high',
        confidence: Math.min(90, 60 + Math.floor(totalSpend / 50)),
        title: `תקציב ללא תוצאות — ${campaign.campaignName || 'קמפיין'}`,
        reason: `הוצאה של ₪${totalSpend.toFixed(0)} ללא לידים`,
        expectedImpact: `הפסקת בזבוז עשויה לחסוך ₪${totalSpend.toFixed(0)} או להפנות לקמפיין אחר`,
        metadata: { spend: totalSpend, leads: 0 },
      });
    } else if (campaignLeads.length > 0) {
      const cpl = totalSpend / campaignLeads.length;
      if (cpl > GROWTH_THRESHOLDS.wasteCplMax) {
        opps.push({
          clientId: ctx.clientId,
          clientName: ctx.clientName,
          campaignId: campaign.id,
          campaignName: campaign.campaignName || null,
          adSetId: null, adId: null,
          platform: campaign.platform || null,
          type: 'budget_waste',
          severity: cpl > 200 ? 'high' : 'medium',
          confidence: Math.min(85, 50 + Math.floor((cpl - GROWTH_THRESHOLDS.wasteCplMax) / 10)),
          title: `עלות ליד גבוהה — ${campaign.campaignName || 'קמפיין'}`,
          reason: `CPL של ₪${cpl.toFixed(0)} — גבוה מהסף (₪${GROWTH_THRESHOLDS.wasteCplMax})`,
          expectedImpact: 'שיפור טרגוט או קריאייטיב עשוי להוריד CPL ב-30%+',
          metadata: { spend: totalSpend, leads: campaignLeads.length, cpl },
        });
      }
    }
  }

  return opps;
}

// ── 4. Platform Shift ──

function detectPlatformShift(ctx: ClientContext): RawOpportunity[] {
  const opps: RawOpportunity[] = [];
  if (!ctx.platformComparison?.hasSufficientData) return opps;

  const platforms = ctx.platformComparison.platforms.filter(p => p.totalSpend >= GROWTH_THRESHOLDS.platformMinSpend);
  if (platforms.length < 2) return opps;

  const withConversions = platforms.filter(p => p.totalConversions > 0);
  if (withConversions.length < 2) return opps;

  const sorted = [...withConversions].sort((a, b) => a.avgCpl - b.avgCpl);
  const best = sorted[0];
  const worst = sorted[sorted.length - 1];

  if (worst.avgCpl > 0 && best.avgCpl > 0) {
    const diff = ((worst.avgCpl - best.avgCpl) / worst.avgCpl) * 100;
    if (diff >= GROWTH_THRESHOLDS.platformCplDiffPercent) {
      opps.push({
        clientId: ctx.clientId,
        clientName: ctx.clientName,
        campaignId: null,
        campaignName: null,
        adSetId: null, adId: null,
        platform: best.platform,
        type: 'platform_shift',
        severity: diff > 50 ? 'high' : 'medium',
        confidence: Math.min(85, 55 + Math.floor(diff / 5)),
        title: `${best.label} מביא תוצאות טובות יותר מ-${worst.label}`,
        reason: `CPL ב-${best.label}: ₪${best.avgCpl.toFixed(0)} vs ₪${worst.avgCpl.toFixed(0)} ב-${worst.label} (הפרש ${diff.toFixed(0)}%)`,
        expectedImpact: `העברת תקציב ל-${best.label} עשויה להוריד CPL ממוצע`,
        metadata: { bestPlatform: best.platform, worstPlatform: worst.platform, bestCpl: best.avgCpl, worstCpl: worst.avgCpl, diffPercent: diff },
      });
    }
  }

  return opps;
}

// ── 5. Audience Expansion ──

function detectAudienceExpansion(ctx: ClientContext): RawOpportunity[] {
  const opps: RawOpportunity[] = [];

  for (const adSet of ctx.adSets) {
    if (adSet.status !== 'active') continue;
    const adSetAds = ctx.ads.filter(a => a.adSetId === adSet.id);
    const totalImpressions = adSetAds.reduce((s, a) => s + (Number(a.impressions) || 0), 0);
    const totalClicks = adSetAds.reduce((s, a) => s + (Number(a.clicks) || 0), 0);
    const totalLeads = adSetAds.reduce((s, a) => s + (Number(a.leads) || Number(a.conversions) || 0), 0);
    const ctr = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;

    if (
      totalImpressions >= GROWTH_THRESHOLDS.audienceMinImpressions &&
      ctr >= GROWTH_THRESHOLDS.audienceCtrMin &&
      totalLeads >= GROWTH_THRESHOLDS.audienceMinLeads
    ) {
      const campaign = ctx.campaigns.find(c => c.id === adSet.campaignId);
      opps.push({
        clientId: ctx.clientId,
        clientName: ctx.clientName,
        campaignId: adSet.campaignId || null,
        campaignName: campaign?.campaignName || null,
        adSetId: adSet.id,
        adId: null,
        platform: campaign?.platform || null,
        type: 'audience_expansion',
        severity: 'medium',
        confidence: Math.min(80, 50 + Math.floor(ctr * 5)),
        title: `הרחבת קהל — ${adSet.name || 'קבוצת מודעות'}`,
        reason: `CTR של ${ctr.toFixed(2)}% ו-${totalLeads} לידים — קהל מגיב היטב`,
        expectedImpact: 'יצירת Lookalike או הרחבת טווח גיל/מיקום יכולה להכפיל לידים',
        metadata: { ctr, leads: totalLeads, impressions: totalImpressions, adSetName: adSet.name },
      });
    }
  }

  return opps;
}

// ── 6. Funnel Leak ──

function detectFunnelLeak(ctx: ClientContext): RawOpportunity[] {
  const opps: RawOpportunity[] = [];

  if (ctx.leads.length < GROWTH_THRESHOLDS.funnelMinLeads) return opps;

  const lowQuality = ctx.leads.filter(l => {
    const status = (l as any).qualityScore || (l as any).status;
    return status === 'junk' || status === 'not_interested' || status === 'spam' || status === 'low';
  });

  const lowPct = (lowQuality.length / ctx.leads.length) * 100;

  if (lowPct >= GROWTH_THRESHOLDS.funnelLowQualityPercent) {
    opps.push({
      clientId: ctx.clientId,
      clientName: ctx.clientName,
      campaignId: null,
      campaignName: null,
      adSetId: null, adId: null,
      platform: null,
      type: 'funnel_leak',
      severity: lowPct > 80 ? 'critical' : 'high',
      confidence: Math.min(85, 55 + Math.floor(lowPct / 5)),
      title: `בעיית איכות לידים — ${ctx.clientName}`,
      reason: `${lowPct.toFixed(0)}% מהלידים באיכות נמוכה (${lowQuality.length} מתוך ${ctx.leads.length})`,
      expectedImpact: 'שיפור טרגוט ו-Copy עשוי לשפר את איכות הלידים',
      metadata: { totalLeads: ctx.leads.length, lowQualityCount: lowQuality.length, lowQualityPercent: lowPct },
    });
  }

  return opps;
}

// ── 7. Content-to-Campaign ──

function detectContentToCampaign(ctx: ClientContext): RawOpportunity[] {
  const opps: RawOpportunity[] = [];
  if (!ctx.content?.hasEnoughData) return opps;

  // Strong top creatives that could be duplicated
  const topCreatives = ctx.content.topCreatives?.slice(0, 2) || [];
  for (const creative of topCreatives) {
    if (creative.score > 70 && creative.leads >= 3) {
      opps.push({
        clientId: ctx.clientId,
        clientName: ctx.clientName,
        campaignId: null,
        campaignName: null,
        adSetId: null, adId: creative.adId,
        platform: null,
        type: 'content_to_campaign',
        severity: 'medium',
        confidence: Math.min(75, 50 + Math.floor(creative.score / 5)),
        title: `קריאייטיב מנצח — "${creative.headline || creative.adName}"`,
        reason: `ציון ${creative.score}, ${creative.leads} לידים, CTR ${creative.ctr.toFixed(2)}%`,
        expectedImpact: 'שכפול הקריאייטיב לקמפיין חדש עם קהל אחר עשוי להגדיל לידים',
        metadata: { adId: creative.adId, score: creative.score, headline: creative.headline },
      });
    }
  }

  return opps;
}

// ── 8. Client Risk ──

function detectClientRisk(ctx: ClientContext): RawOpportunity[] {
  const opps: RawOpportunity[] = [];

  // No active campaigns
  const activeCampaigns = ctx.campaigns.filter(c => c.status === 'active');
  if (ctx.campaigns.length >= GROWTH_THRESHOLDS.riskMinCampaigns && activeCampaigns.length === 0) {
    opps.push({
      clientId: ctx.clientId,
      clientName: ctx.clientName,
      campaignId: null, campaignName: null,
      adSetId: null, adId: null, platform: null,
      type: 'client_risk',
      severity: 'high',
      confidence: 85,
      title: `אין קמפיינים פעילים — ${ctx.clientName}`,
      reason: `ללקוח ${ctx.campaigns.length} קמפיינים אבל אף אחד לא פעיל`,
      expectedImpact: 'הפעלת קמפיין מתאים עשויה להחזיר את הלקוח למסלול',
      metadata: { totalCampaigns: ctx.campaigns.length, activeCampaigns: 0 },
    });
  }

  // Health-based risk
  if (ctx.health && ctx.health.hasEnoughData && ctx.health.status === 'critical') {
    opps.push({
      clientId: ctx.clientId,
      clientName: ctx.clientName,
      campaignId: null, campaignName: null,
      adSetId: null, adId: null, platform: null,
      type: 'client_risk',
      severity: 'critical',
      confidence: 80,
      title: `לקוח במצב קריטי — ${ctx.clientName}`,
      reason: `ציון בריאות: ${ctx.health.score}/100 — ${ctx.health.statusLabel}`,
      expectedImpact: 'פעולה מיידית נדרשת — בדיקת קמפיינים, תקציב וטרגוט',
      metadata: { healthScore: ctx.health.score, healthStatus: ctx.health.status },
    });
  }

  // Zero leads recently
  if (ctx.leads.length === 0 && activeCampaigns.length > 0) {
    const totalSpend = ctx.ads.reduce((s, a) => s + (Number(a.spend) || 0), 0);
    if (totalSpend > 50) {
      opps.push({
        clientId: ctx.clientId,
        clientName: ctx.clientName,
        campaignId: null, campaignName: null,
        adSetId: null, adId: null, platform: null,
        type: 'client_risk',
        severity: 'high',
        confidence: 75,
        title: `אין לידים — ${ctx.clientName}`,
        reason: `${activeCampaigns.length} קמפיינים פעילים, הוצאה ₪${totalSpend.toFixed(0)}, 0 לידים`,
        expectedImpact: 'בדיקת קהל, קריאייטיב ותשתית מדידה עשויה לזהות את הבעיה',
        metadata: { activeCampaigns: activeCampaigns.length, totalSpend, leads: 0 },
      });
    }
  }

  return opps;
}
