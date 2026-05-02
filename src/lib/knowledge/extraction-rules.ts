/**
 * Knowledge Extraction Rules
 *
 * Deterministic rules that analyze real data and extract structured knowledge items.
 * No AI API calls. All pattern detection is rule-based.
 *
 * Rules:
 * 1. Hook patterns — ads with similar opening text that perform well
 * 2. CTA effectiveness — which CTAs drive clicks/conversions
 * 3. Visual patterns — media types/formats that outperform
 * 4. Audience patterns — targeting combos that produce results
 * 5. Content angles — themes/topics that generate leads
 * 6. Platform winners — which platforms work for which industries
 * 7. Failure detection — repeated underperformers
 * 8. Cross-client patterns — what works across similar clients
 */

import type { Campaign, Ad, AdSet, Lead, KnowledgeItemType, KnowledgeSourceType } from '@/lib/db/schema';

// ── Extracted knowledge shape (pre-persistence) ──

export interface RawKnowledge {
  type: KnowledgeItemType;
  industry: string;
  clientId: string | null;
  clientName: string | null;
  sourceType: KnowledgeSourceType;
  sourceId: string | null;
  title: string;
  summary: string;
  evidenceData: Record<string, unknown>;
  performanceMetrics: Record<string, number>;
  confidenceScore: number;
  tags: string[];
  platform: string | null;
}

// ── Config ──

export const EXTRACTION_THRESHOLDS = {
  minAdsForPattern: 3,
  minImpressionsForAd: 500,
  minLeadsForSignificance: 2,
  goodCtrPercent: 2.0,
  poorCtrPercent: 0.8,
  goodCplMax: 50,
  poorCplMin: 100,
  minClicksForCta: 10,
  hookSimilarityMinAds: 2,
  crossClientMinClients: 2,
};

// ── Client data context ──

export interface ExtractionContext {
  clientId: string;
  clientName: string;
  industry: string;
  campaigns: Campaign[];
  adSets: AdSet[];
  ads: Ad[];
  leads: Lead[];
}

// ── Main extraction runner ──

export function extractAllKnowledge(contexts: ExtractionContext[]): RawKnowledge[] {
  const all: RawKnowledge[] = [];

  // Per-client extraction
  for (const ctx of contexts) {
    all.push(...extractHookPatterns(ctx));
    all.push(...extractCTAEffectiveness(ctx));
    all.push(...extractAudiencePatterns(ctx));
    all.push(...extractContentAngles(ctx));
    all.push(...extractPlatformWinners(ctx));
    all.push(...extractFailurePatterns(ctx));
  }

  // Cross-client extraction
  all.push(...extractCrossClientPatterns(contexts));

  return all;
}

// ── 1. Hook Patterns ──

function extractHookPatterns(ctx: ExtractionContext): RawKnowledge[] {
  const results: RawKnowledge[] = [];
  const performingAds = ctx.ads.filter(a => {
    const imp = Number(a.impressions) || 0;
    const clicks = Number(a.clicks) || 0;
    const ctr = imp > 0 ? (clicks / imp) * 100 : 0;
    return imp >= EXTRACTION_THRESHOLDS.minImpressionsForAd && ctr >= EXTRACTION_THRESHOLDS.goodCtrPercent;
  });

  if (performingAds.length < EXTRACTION_THRESHOLDS.minAdsForPattern) return results;

  // Group by first ~50 chars of primaryText to detect similar hooks
  const hookGroups: Record<string, Ad[]> = {};
  for (const ad of performingAds) {
    const text = ((ad as any).primaryText || '').trim();
    if (!text) continue;
    const hookKey = text.substring(0, 50).toLowerCase().replace(/[^א-תa-z0-9\s]/g, '');
    if (!hookKey) continue;
    if (!hookGroups[hookKey]) hookGroups[hookKey] = [];
    hookGroups[hookKey].push(ad);
  }

  for (const [hook, ads] of Object.entries(hookGroups)) {
    if (ads.length < EXTRACTION_THRESHOLDS.hookSimilarityMinAds) continue;

    const avgCtr = ads.reduce((s, a) => s + ((Number(a.clicks) || 0) / Math.max(Number(a.impressions) || 1, 1)) * 100, 0) / ads.length;
    const totalLeads = ads.reduce((s, a) => s + (Number(a.leads) || Number(a.conversions) || 0), 0);
    const sampleText = ((ads[0] as any).primaryText || '').substring(0, 100);

    results.push({
      type: 'hook',
      industry: ctx.industry,
      clientId: ctx.clientId,
      clientName: ctx.clientName,
      sourceType: 'ad_performance',
      sourceId: ads[0].id,
      title: `הוק מנצח: "${sampleText}..."`,
      summary: `${ads.length} מודעות עם הוק דומה הגיעו ל-CTR ממוצע ${avgCtr.toFixed(2)}%`,
      evidenceData: { adIds: ads.map(a => a.id), sampleText, adCount: ads.length },
      performanceMetrics: { avgCtr, totalLeads, adCount: ads.length },
      confidenceScore: Math.min(90, 40 + ads.length * 10 + Math.floor(avgCtr * 5)),
      tags: ['hook', ctx.industry],
      platform: null,
    });
  }

  return results;
}

// ── 2. CTA Effectiveness ──

function extractCTAEffectiveness(ctx: ExtractionContext): RawKnowledge[] {
  const results: RawKnowledge[] = [];
  const ctaGroups: Record<string, { ads: Ad[]; totalClicks: number; totalImpressions: number; totalLeads: number }> = {};

  for (const ad of ctx.ads) {
    const cta = (ad as any).ctaType || (ad as any).cta || '';
    if (!cta) continue;
    const imp = Number(ad.impressions) || 0;
    if (imp < EXTRACTION_THRESHOLDS.minImpressionsForAd) continue;

    if (!ctaGroups[cta]) ctaGroups[cta] = { ads: [], totalClicks: 0, totalImpressions: 0, totalLeads: 0 };
    ctaGroups[cta].ads.push(ad);
    ctaGroups[cta].totalClicks += Number(ad.clicks) || 0;
    ctaGroups[cta].totalImpressions += imp;
    ctaGroups[cta].totalLeads += Number(ad.leads) || Number(ad.conversions) || 0;
  }

  for (const [cta, data] of Object.entries(ctaGroups)) {
    if (data.ads.length < 2) continue;
    const ctr = data.totalImpressions > 0 ? (data.totalClicks / data.totalImpressions) * 100 : 0;

    if (ctr >= EXTRACTION_THRESHOLDS.goodCtrPercent) {
      results.push({
        type: 'cta',
        industry: ctx.industry,
        clientId: ctx.clientId,
        clientName: ctx.clientName,
        sourceType: 'ad_performance',
        sourceId: null,
        title: `CTA מצליח: "${cta}"`,
        summary: `${data.ads.length} מודעות עם CTA זה, CTR ממוצע ${ctr.toFixed(2)}%, ${data.totalLeads} לידים`,
        evidenceData: { cta, adIds: data.ads.map(a => a.id) },
        performanceMetrics: { ctr, leads: data.totalLeads, adCount: data.ads.length },
        confidenceScore: Math.min(85, 40 + data.ads.length * 8 + Math.floor(ctr * 5)),
        tags: ['cta', cta, ctx.industry],
        platform: null,
      });
    } else if (ctr < EXTRACTION_THRESHOLDS.poorCtrPercent && data.totalClicks >= EXTRACTION_THRESHOLDS.minClicksForCta) {
      results.push({
        type: 'failure',
        industry: ctx.industry,
        clientId: ctx.clientId,
        clientName: ctx.clientName,
        sourceType: 'ad_performance',
        sourceId: null,
        title: `CTA חלש: "${cta}"`,
        summary: `CTR נמוך (${ctr.toFixed(2)}%) ב-${data.ads.length} מודעות — שקלו להחליף`,
        evidenceData: { cta, adIds: data.ads.map(a => a.id) },
        performanceMetrics: { ctr, leads: data.totalLeads, adCount: data.ads.length },
        confidenceScore: Math.min(80, 35 + data.ads.length * 8),
        tags: ['failure', 'cta', ctx.industry],
        platform: null,
      });
    }
  }

  return results;
}

// ── 3. Audience Patterns ──

function extractAudiencePatterns(ctx: ExtractionContext): RawKnowledge[] {
  const results: RawKnowledge[] = [];

  for (const adSet of ctx.adSets) {
    if (adSet.status !== 'active') continue;
    const adSetAds = ctx.ads.filter(a => a.adSetId === adSet.id);
    const totalImp = adSetAds.reduce((s, a) => s + (Number(a.impressions) || 0), 0);
    const totalClicks = adSetAds.reduce((s, a) => s + (Number(a.clicks) || 0), 0);
    const totalLeads = adSetAds.reduce((s, a) => s + (Number(a.leads) || Number(a.conversions) || 0), 0);
    const ctr = totalImp > 0 ? (totalClicks / totalImp) * 100 : 0;

    if (totalImp < 1000 || totalLeads < EXTRACTION_THRESHOLDS.minLeadsForSignificance) continue;

    const interests = (adSet as any).interests || [];
    const geoLocations = (adSet as any).geoLocations || [];
    const ageMin = (adSet as any).ageMin;
    const ageMax = (adSet as any).ageMax;

    if (ctr >= EXTRACTION_THRESHOLDS.goodCtrPercent && totalLeads >= 3) {
      const targeting = [
        interests.length > 0 ? `תחומי עניין: ${interests.join(', ')}` : '',
        geoLocations.length > 0 ? `מיקום: ${geoLocations.join(', ')}` : '',
        ageMin && ageMax ? `גיל: ${ageMin}-${ageMax}` : '',
      ].filter(Boolean).join(' | ');

      results.push({
        type: 'audience',
        industry: ctx.industry,
        clientId: ctx.clientId,
        clientName: ctx.clientName,
        sourceType: 'ad_performance',
        sourceId: adSet.id,
        title: `קהל מנצח: ${adSet.name || 'קבוצת מודעות'}`,
        summary: `${targeting || 'טרגוט כללי'} — CTR ${ctr.toFixed(2)}%, ${totalLeads} לידים`,
        evidenceData: { adSetId: adSet.id, interests, geoLocations, ageMin, ageMax },
        performanceMetrics: { ctr, leads: totalLeads, impressions: totalImp },
        confidenceScore: Math.min(80, 40 + totalLeads * 5 + Math.floor(ctr * 3)),
        tags: ['audience', ctx.industry],
        platform: null,
      });
    }
  }

  return results;
}

// ── 4. Content Angles ──

function extractContentAngles(ctx: ExtractionContext): RawKnowledge[] {
  const results: RawKnowledge[] = [];
  const performingAds = ctx.ads.filter(a => {
    const leads = Number(a.leads) || Number(a.conversions) || 0;
    return leads >= EXTRACTION_THRESHOLDS.minLeadsForSignificance;
  });

  if (performingAds.length < 2) return results;

  // Group by headline patterns
  const headlineGroups: Record<string, Ad[]> = {};
  for (const ad of performingAds) {
    const headline = ((ad as any).headline || '').trim();
    if (!headline || headline.length < 5) continue;
    // Normalize: lowercase first 30 chars
    const key = headline.substring(0, 30).toLowerCase();
    if (!headlineGroups[key]) headlineGroups[key] = [];
    headlineGroups[key].push(ad);
  }

  for (const [key, ads] of Object.entries(headlineGroups)) {
    if (ads.length < 2) continue;
    const totalLeads = ads.reduce((s, a) => s + (Number(a.leads) || Number(a.conversions) || 0), 0);
    const sampleHeadline = (ads[0] as any).headline || key;

    results.push({
      type: 'content_angle',
      industry: ctx.industry,
      clientId: ctx.clientId,
      clientName: ctx.clientName,
      sourceType: 'ad_performance',
      sourceId: ads[0].id,
      title: `זווית תוכן מנצחת: "${sampleHeadline}"`,
      summary: `${ads.length} מודעות עם כותרת דומה הניבו ${totalLeads} לידים`,
      evidenceData: { headline: sampleHeadline, adIds: ads.map(a => a.id) },
      performanceMetrics: { leads: totalLeads, adCount: ads.length },
      confidenceScore: Math.min(80, 35 + totalLeads * 5 + ads.length * 5),
      tags: ['content_angle', ctx.industry],
      platform: null,
    });
  }

  return results;
}

// ── 5. Platform Winners ──

function extractPlatformWinners(ctx: ExtractionContext): RawKnowledge[] {
  const results: RawKnowledge[] = [];
  const platformStats: Record<string, { spend: number; leads: number; clicks: number; impressions: number; campaigns: number }> = {};

  for (const campaign of ctx.campaigns) {
    const platform = campaign.platform || 'facebook';
    if (!platformStats[platform]) platformStats[platform] = { spend: 0, leads: 0, clicks: 0, impressions: 0, campaigns: 0 };
    platformStats[platform].campaigns++;

    const cAds = ctx.ads.filter(a => a.campaignId === campaign.id);
    for (const ad of cAds) {
      platformStats[platform].spend += Number(ad.spend) || 0;
      platformStats[platform].leads += Number(ad.leads) || Number(ad.conversions) || 0;
      platformStats[platform].clicks += Number(ad.clicks) || 0;
      platformStats[platform].impressions += Number(ad.impressions) || 0;
    }
  }

  const platforms = Object.entries(platformStats).filter(([, s]) => s.spend > 50 && s.leads > 0);
  if (platforms.length < 1) return results;

  for (const [platform, stats] of platforms) {
    const cpl = stats.leads > 0 ? stats.spend / stats.leads : 0;
    const ctr = stats.impressions > 0 ? (stats.clicks / stats.impressions) * 100 : 0;

    if (cpl > 0 && cpl <= EXTRACTION_THRESHOLDS.goodCplMax) {
      results.push({
        type: 'platform',
        industry: ctx.industry,
        clientId: ctx.clientId,
        clientName: ctx.clientName,
        sourceType: 'campaign_performance',
        sourceId: null,
        title: `${platform} — פלטפורמה חזקה (${ctx.industry})`,
        summary: `CPL: ₪${cpl.toFixed(0)}, CTR: ${ctr.toFixed(2)}%, ${stats.leads} לידים מ-${stats.campaigns} קמפיינים`,
        evidenceData: { platform, campaigns: stats.campaigns },
        performanceMetrics: { cpl, ctr, leads: stats.leads, spend: stats.spend },
        confidenceScore: Math.min(85, 40 + stats.leads * 3 + stats.campaigns * 5),
        tags: ['platform', platform, ctx.industry],
        platform,
      });
    }
  }

  return results;
}

// ── 6. Failure Patterns ──

function extractFailurePatterns(ctx: ExtractionContext): RawKnowledge[] {
  const results: RawKnowledge[] = [];

  // Ads with high spend but zero leads
  const wasteAds = ctx.ads.filter(a => {
    const spend = Number(a.spend) || 0;
    const leads = Number(a.leads) || Number(a.conversions) || 0;
    return spend > 100 && leads === 0;
  });

  if (wasteAds.length >= EXTRACTION_THRESHOLDS.minAdsForPattern) {
    const totalWaste = wasteAds.reduce((s, a) => s + (Number(a.spend) || 0), 0);
    results.push({
      type: 'failure',
      industry: ctx.industry,
      clientId: ctx.clientId,
      clientName: ctx.clientName,
      sourceType: 'ad_performance',
      sourceId: null,
      title: `תבנית כישלון: מודעות עם הוצאה ללא לידים`,
      summary: `${wasteAds.length} מודעות עם הוצאה כוללת ₪${totalWaste.toFixed(0)} ללא אף ליד`,
      evidenceData: { adIds: wasteAds.map(a => a.id), totalWaste },
      performanceMetrics: { wasteAds: wasteAds.length, totalWaste },
      confidenceScore: Math.min(85, 50 + wasteAds.length * 5),
      tags: ['failure', 'waste', ctx.industry],
      platform: null,
    });
  }

  // Ads with extremely low CTR
  const lowCtrAds = ctx.ads.filter(a => {
    const imp = Number(a.impressions) || 0;
    const clicks = Number(a.clicks) || 0;
    const ctr = imp > 0 ? (clicks / imp) * 100 : 0;
    return imp >= 2000 && ctr < 0.5;
  });

  if (lowCtrAds.length >= 3) {
    results.push({
      type: 'failure',
      industry: ctx.industry,
      clientId: ctx.clientId,
      clientName: ctx.clientName,
      sourceType: 'ad_performance',
      sourceId: null,
      title: `תבנית כישלון: CTR נמוך מאוד`,
      summary: `${lowCtrAds.length} מודעות עם CTR מתחת ל-0.5% — הקריאייטיב לא עובד`,
      evidenceData: { adIds: lowCtrAds.map(a => a.id) },
      performanceMetrics: { lowCtrAds: lowCtrAds.length },
      confidenceScore: Math.min(80, 40 + lowCtrAds.length * 5),
      tags: ['failure', 'low_ctr', ctx.industry],
      platform: null,
    });
  }

  return results;
}

// ── 7. Cross-Client Patterns ──

function extractCrossClientPatterns(contexts: ExtractionContext[]): RawKnowledge[] {
  const results: RawKnowledge[] = [];
  if (contexts.length < EXTRACTION_THRESHOLDS.crossClientMinClients) return results;

  // Group by industry
  const industryGroups: Record<string, ExtractionContext[]> = {};
  for (const ctx of contexts) {
    if (!ctx.industry) continue;
    if (!industryGroups[ctx.industry]) industryGroups[ctx.industry] = [];
    industryGroups[ctx.industry].push(ctx);
  }

  for (const [industry, ctxs] of Object.entries(industryGroups)) {
    if (ctxs.length < EXTRACTION_THRESHOLDS.crossClientMinClients) continue;

    // Find hooks that work across clients
    const hookSuccess: Record<string, { clients: Set<string>; totalLeads: number; avgCtr: number; count: number }> = {};

    for (const ctx of ctxs) {
      const goodAds = ctx.ads.filter(a => {
        const imp = Number(a.impressions) || 0;
        const clicks = Number(a.clicks) || 0;
        const leads = Number(a.leads) || Number(a.conversions) || 0;
        return imp > 500 && (clicks / Math.max(imp, 1)) * 100 > 1.5 && leads > 0;
      });

      for (const ad of goodAds) {
        const text = ((ad as any).primaryText || '').substring(0, 40).toLowerCase().trim();
        if (!text || text.length < 10) continue;
        if (!hookSuccess[text]) hookSuccess[text] = { clients: new Set(), totalLeads: 0, avgCtr: 0, count: 0 };
        hookSuccess[text].clients.add(ctx.clientId);
        hookSuccess[text].totalLeads += Number(ad.leads) || Number(ad.conversions) || 0;
        hookSuccess[text].avgCtr += ((Number(ad.clicks) || 0) / Math.max(Number(ad.impressions) || 1, 1)) * 100;
        hookSuccess[text].count++;
      }
    }

    for (const [hook, data] of Object.entries(hookSuccess)) {
      if (data.clients.size < 2) continue;
      const avgCtr = data.count > 0 ? data.avgCtr / data.count : 0;

      results.push({
        type: 'pattern',
        industry,
        clientId: null,
        clientName: null,
        sourceType: 'ad_performance',
        sourceId: null,
        title: `תבנית חוצת-לקוחות: "${hook}..."`,
        summary: `הוק זה הצליח ב-${data.clients.size} לקוחות, ${data.totalLeads} לידים, CTR ממוצע ${avgCtr.toFixed(2)}%`,
        evidenceData: { clientCount: data.clients.size, hook },
        performanceMetrics: { clientCount: data.clients.size, totalLeads: data.totalLeads, avgCtr },
        confidenceScore: Math.min(90, 50 + data.clients.size * 10 + data.totalLeads * 2),
        tags: ['pattern', 'cross_client', industry],
        platform: null,
      });
    }
  }

  return results;
}
