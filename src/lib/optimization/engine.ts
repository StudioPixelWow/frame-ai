/**
 * Optimization Engine — rules-based campaign performance analysis
 *
 * Analyzes Campaign → AdSet → Ad data and generates actionable recommendations.
 * Structured so real AI can replace/enhance the rules later.
 */

import type { Campaign, AdSet, Ad } from '@/lib/db/schema';

// ── Types ──────────────────────────────────────────────────────────────

export type RecommendationType =
  | 'scale_opportunity'
  | 'creative_fatigue'
  | 'budget_waste'
  | 'audience_issue'
  | 'best_performer'
  | 'tracking_issue';

export type RecommendationSeverity = 'low' | 'medium' | 'high';

export type RecommendationObjectType = 'campaign' | 'adset' | 'ad';

export type RecommendationAction =
  | 'create_variation'   // צור וריאציה
  | 'mark_for_review'    // סמן לבדיקה
  | 'send_to_approval'   // העבר לאישור
  | 'ignore';            // התעלם

export interface Recommendation {
  id: string;
  type: RecommendationType;
  severity: RecommendationSeverity;
  objectType: RecommendationObjectType;
  objectId: string;
  objectName: string;
  campaignId: string;
  campaignName: string;
  title: string;
  reason: string;
  expectedImpact: string;
  recommendedAction: string;
  confidence: number;        // 0–100
  createdAt: string;
  actions: RecommendationAction[];
}

// ── Configuration / Thresholds ─────────────────────────────────────────
// Structured as a config object so thresholds can be tuned or loaded from DB

export const THRESHOLDS = {
  // CPL thresholds (in local currency)
  cplGood: 40,
  cplBad: 120,

  // CTR thresholds (percentage)
  ctrLow: 0.8,
  ctrGood: 2.0,

  // Frequency thresholds
  frequencyHigh: 4.0,
  frequencyCritical: 6.0,

  // Minimum spend to evaluate (avoid noise on tiny budgets)
  minSpendToEvaluate: 50,

  // Minimum impressions for meaningful analysis
  minImpressions: 500,

  // Performance score ratio for best/worst comparisons
  performanceGap: 2.0,
};

// ── UI Metadata ────────────────────────────────────────────────────────

export const RECOMMENDATION_TYPE_META: Record<
  RecommendationType,
  { icon: string; label: string; color: string; bgColor: string }
> = {
  scale_opportunity: { icon: '📈', label: 'הזדמנות להרחבה', color: '#22c55e', bgColor: 'rgba(34,197,94,0.1)' },
  creative_fatigue: { icon: '🎨', label: 'שחיקת קריאייטיב', color: '#f59e0b', bgColor: 'rgba(245,158,11,0.1)' },
  budget_waste: { icon: '💸', label: 'בזבוז תקציב', color: '#ef4444', bgColor: 'rgba(239,68,68,0.1)' },
  audience_issue: { icon: '🎯', label: 'בעיית קהל', color: '#f97316', bgColor: 'rgba(249,115,22,0.1)' },
  best_performer: { icon: '🏆', label: 'ביצועים מובילים', color: '#3b82f6', bgColor: 'rgba(59,130,246,0.1)' },
  tracking_issue: { icon: '🔍', label: 'בעיית מדידה', color: '#8b5cf6', bgColor: 'rgba(139,92,246,0.1)' },
};

export const SEVERITY_META: Record<RecommendationSeverity, { label: string; color: string; bgColor: string }> = {
  low: { label: 'נמוכה', color: '#3b82f6', bgColor: 'rgba(59,130,246,0.1)' },
  medium: { label: 'בינונית', color: '#f59e0b', bgColor: 'rgba(245,158,11,0.1)' },
  high: { label: 'גבוהה', color: '#ef4444', bgColor: 'rgba(239,68,68,0.1)' },
};

export const ACTION_LABELS: Record<RecommendationAction, string> = {
  create_variation: 'צור וריאציה',
  mark_for_review: 'סמן לבדיקה',
  send_to_approval: 'העבר לאישור',
  ignore: 'התעלם',
};

// ── Helper ──────────────────────────────────────────────────────────────

let _idCounter = 0;
function genId(): string {
  _idCounter++;
  return `rec_${Date.now()}_${_idCounter}`;
}

function hasPerformanceData(ads: Ad[]): boolean {
  return ads.some(a => a.impressions > 0 || a.spend > 0 || a.leads > 0);
}

function adScore(ad: Ad): number {
  let s = 0;
  if (ad.ctr > 0) s += Math.min(ad.ctr * 15, 30);
  if (ad.leads > 0) s += Math.min(ad.leads * 5, 25);
  if (ad.cpl > 0 && ad.cpl < THRESHOLDS.cplGood) s += 25;
  else if (ad.cpl > 0 && ad.cpl < THRESHOLDS.cplBad) s += 10;
  if (ad.impressions > 10000) s += 20;
  else if (ad.impressions > 3000) s += 10;
  return Math.min(s, 100);
}

// ── Campaign-Level Rules ───────────────────────────────────────────────

function analyzeCampaign(
  campaign: Campaign,
  adSets: AdSet[],
  ads: Ad[],
): Recommendation[] {
  const recs: Recommendation[] = [];
  const now = new Date().toISOString();

  const totalSpend = ads.reduce((s, a) => s + (a.spend || 0), 0);
  const totalLeads = ads.reduce((s, a) => s + (a.leads || 0), 0);
  const totalImpressions = ads.reduce((s, a) => s + (a.impressions || 0), 0);
  const totalClicks = ads.reduce((s, a) => s + (a.clicks || 0), 0);
  const cpl = totalLeads > 0 ? totalSpend / totalLeads : 0;
  const ctr = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;

  if (totalSpend < THRESHOLDS.minSpendToEvaluate) return recs;

  // Rule: High spend + zero leads = Budget Waste
  if (totalSpend > THRESHOLDS.minSpendToEvaluate * 2 && totalLeads === 0) {
    recs.push({
      id: genId(),
      type: 'budget_waste',
      severity: 'high',
      objectType: 'campaign',
      objectId: campaign.id,
      objectName: campaign.campaignName,
      campaignId: campaign.id,
      campaignName: campaign.campaignName,
      title: 'הוצאה ללא תוצאות',
      reason: `הקמפיין הוציא ₪${Math.round(totalSpend)} ללא ליד אחד. ייתכן שיש בעיית קהל, קריאייטיב, או מדידה.`,
      expectedImpact: 'חיסכון בתקציב או שיפור תוצאות לאחר תיקון',
      recommendedAction: 'מומלץ לבדוק את הקהל, הקריאייטיב, ומדידת ההמרות',
      confidence: 90,
      createdAt: now,
      actions: ['mark_for_review', 'send_to_approval', 'ignore'],
    });
  }

  // Rule: Good CPL = Scale Opportunity
  if (totalLeads >= 3 && cpl > 0 && cpl < THRESHOLDS.cplGood) {
    recs.push({
      id: genId(),
      type: 'scale_opportunity',
      severity: 'low',
      objectType: 'campaign',
      objectId: campaign.id,
      objectName: campaign.campaignName,
      campaignId: campaign.id,
      campaignName: campaign.campaignName,
      title: 'הזדמנות להגדלת תקציב',
      reason: `הקמפיין מציג CPL של ₪${Math.round(cpl)} שהוא נמוך מהיעד — ביצועים טובים.`,
      expectedImpact: 'הגדלת כמות הלידים בעלות אפקטיבית',
      recommendedAction: 'מומלץ לשקול הגדלת תקציב ב-20-30%',
      confidence: 75,
      createdAt: now,
      actions: ['send_to_approval', 'ignore'],
    });
  }

  // Rule: Spend + impressions but no clicks = tracking/audience issue
  if (totalSpend > THRESHOLDS.minSpendToEvaluate && totalImpressions > THRESHOLDS.minImpressions && totalClicks === 0) {
    recs.push({
      id: genId(),
      type: 'tracking_issue',
      severity: 'high',
      objectType: 'campaign',
      objectId: campaign.id,
      objectName: campaign.campaignName,
      campaignId: campaign.id,
      campaignName: campaign.campaignName,
      title: 'חשיפות ללא קליקים',
      reason: `${totalImpressions.toLocaleString()} חשיפות אך 0 קליקים — ייתכן שהמודעה לא מושכת או שיש בעיית מדידה.`,
      expectedImpact: 'זיהוי בעיית מדידה או שיפור קריאייטיב',
      recommendedAction: 'בדוק מדידה, לינקים, ואת המודעה עצמה',
      confidence: 80,
      createdAt: now,
      actions: ['mark_for_review', 'ignore'],
    });
  }

  // Rule: Low CTR at campaign level
  if (totalImpressions > THRESHOLDS.minImpressions * 2 && ctr > 0 && ctr < THRESHOLDS.ctrLow) {
    recs.push({
      id: genId(),
      type: 'audience_issue',
      severity: 'medium',
      objectType: 'campaign',
      objectId: campaign.id,
      objectName: campaign.campaignName,
      campaignId: campaign.id,
      campaignName: campaign.campaignName,
      title: 'CTR נמוך ברמת הקמפיין',
      reason: `CTR של ${ctr.toFixed(2)}% — נמוך מהמינימום המומלץ (${THRESHOLDS.ctrLow}%). ייתכן שהקהל לא מדויק.`,
      expectedImpact: 'שיפור CTR ישפר גם CPL ותוצאות',
      recommendedAction: 'מומלץ לבדוק הגדרות קהל ותחומי עניין',
      confidence: 70,
      createdAt: now,
      actions: ['mark_for_review', 'ignore'],
    });
  }

  return recs;
}

// ── Ad Set Level Rules ─────────────────────────────────────────────────

function analyzeAdSet(
  adSet: AdSet,
  ads: Ad[],
  campaign: Campaign,
): Recommendation[] {
  const recs: Recommendation[] = [];
  const now = new Date().toISOString();

  const totalSpend = ads.reduce((s, a) => s + (a.spend || 0), 0);
  const totalLeads = ads.reduce((s, a) => s + (a.leads || 0), 0);
  const totalImpressions = ads.reduce((s, a) => s + (a.impressions || 0), 0);
  const totalClicks = ads.reduce((s, a) => s + (a.clicks || 0), 0);
  const cpl = totalLeads > 0 ? totalSpend / totalLeads : 0;
  const ctr = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;
  const avgFrequency = ads.length > 0 ? ads.reduce((s, a) => s + (a.frequency || 0), 0) / ads.length : 0;

  if (totalSpend < THRESHOLDS.minSpendToEvaluate / 2) return recs;

  // Rule: High frequency = Creative Fatigue at ad set level
  if (avgFrequency >= THRESHOLDS.frequencyHigh) {
    recs.push({
      id: genId(),
      type: 'creative_fatigue',
      severity: avgFrequency >= THRESHOLDS.frequencyCritical ? 'high' : 'medium',
      objectType: 'adset',
      objectId: adSet.id,
      objectName: adSet.name,
      campaignId: campaign.id,
      campaignName: campaign.campaignName,
      title: 'תדירות גבוהה — סדרת מודעות',
      reason: `תדירות ממוצעת ${avgFrequency.toFixed(1)} — הקהל רואה את המודעות יותר מדי פעמים.`,
      expectedImpact: 'הפחתת שחיקת קהל ושיפור ביצועים',
      recommendedAction: 'מומלץ להרחיב את הקהל או ליצור קריאייטיבים חדשים',
      confidence: 80,
      createdAt: now,
      actions: ['create_variation', 'mark_for_review', 'ignore'],
    });
  }

  // Rule: Low CTR in ad set = audience mismatch
  if (totalImpressions > THRESHOLDS.minImpressions && ctr > 0 && ctr < THRESHOLDS.ctrLow) {
    recs.push({
      id: genId(),
      type: 'audience_issue',
      severity: 'medium',
      objectType: 'adset',
      objectId: adSet.id,
      objectName: adSet.name,
      campaignId: campaign.id,
      campaignName: campaign.campaignName,
      title: 'CTR נמוך — ייתכן שהקהל לא מדויק',
      reason: `סדרת המודעות "${adSet.name}" מציגה CTR של ${ctr.toFixed(2)}% — מתחת לסף (${THRESHOLDS.ctrLow}%).`,
      expectedImpact: 'שיפור טרגוט יגדיל CTR וישפר תוצאות',
      recommendedAction: 'מומלץ לבדוק תחומי עניין, גיאוגרפיה, וגילאים',
      confidence: 65,
      createdAt: now,
      actions: ['mark_for_review', 'ignore'],
    });
  }

  // Rule: High spend, no leads in ad set
  if (totalSpend > THRESHOLDS.minSpendToEvaluate && totalLeads === 0 && totalImpressions > THRESHOLDS.minImpressions) {
    recs.push({
      id: genId(),
      type: 'budget_waste',
      severity: 'high',
      objectType: 'adset',
      objectId: adSet.id,
      objectName: adSet.name,
      campaignId: campaign.id,
      campaignName: campaign.campaignName,
      title: 'הוצאה ללא לידים — סדרת מודעות',
      reason: `₪${Math.round(totalSpend)} הוצאו ב-"${adSet.name}" ללא ליד אחד.`,
      expectedImpact: 'חיסכון בתקציב או הפניה לקבוצה אפקטיבית יותר',
      recommendedAction: 'מומלץ לשקול עצירת הסדרה או שינוי קהל',
      confidence: 85,
      createdAt: now,
      actions: ['send_to_approval', 'mark_for_review', 'ignore'],
    });
  }

  return recs;
}

// ── Ad-Level Rules ─────────────────────────────────────────────────────

function analyzeAd(
  ad: Ad,
  allAdsInSet: Ad[],
  campaign: Campaign,
): Recommendation[] {
  const recs: Recommendation[] = [];
  const now = new Date().toISOString();

  if (ad.impressions < THRESHOLDS.minImpressions / 2) return recs;

  const adName = ad.headline || ad.name;

  // Rule: High frequency on single ad = Creative Fatigue
  if (ad.frequency >= THRESHOLDS.frequencyHigh) {
    recs.push({
      id: genId(),
      type: 'creative_fatigue',
      severity: ad.frequency >= THRESHOLDS.frequencyCritical ? 'high' : 'medium',
      objectType: 'ad',
      objectId: ad.id,
      objectName: adName,
      campaignId: campaign.id,
      campaignName: campaign.campaignName,
      title: 'המודעה מתחילה להישחק',
      reason: `תדירות ${ad.frequency.toFixed(1)} — המודעה "${adName}" נצפתה יותר מדי פעמים.`,
      expectedImpact: 'מודעה חדשה תשפר מעורבות וביצועים',
      recommendedAction: 'מומלץ ליצור וריאציה חדשה',
      confidence: 80,
      createdAt: now,
      actions: ['create_variation', 'ignore'],
    });
  }

  // Rule: High CPL
  if (ad.cpl > THRESHOLDS.cplBad && ad.leads > 0) {
    recs.push({
      id: genId(),
      type: 'budget_waste',
      severity: 'medium',
      objectType: 'ad',
      objectId: ad.id,
      objectName: adName,
      campaignId: campaign.id,
      campaignName: campaign.campaignName,
      title: 'עלות לליד גבוהה',
      reason: `CPL של ₪${Math.round(ad.cpl)} — גבוה משמעותית מהיעד (₪${THRESHOLDS.cplBad}).`,
      expectedImpact: 'חיסכון בתקציב על ידי שיפור או החלפת המודעה',
      recommendedAction: 'מומלץ לבדוק את המודעה, הקריאייטיב, ודף הנחיתה',
      confidence: 70,
      createdAt: now,
      actions: ['mark_for_review', 'create_variation', 'ignore'],
    });
  }

  // Rule: Spend but zero leads
  if (ad.spend > THRESHOLDS.minSpendToEvaluate && ad.leads === 0 && ad.impressions > THRESHOLDS.minImpressions) {
    recs.push({
      id: genId(),
      type: 'tracking_issue',
      severity: 'medium',
      objectType: 'ad',
      objectId: ad.id,
      objectName: adName,
      campaignId: campaign.id,
      campaignName: campaign.campaignName,
      title: 'הוצאה ללא המרות',
      reason: `₪${Math.round(ad.spend)} הוצאו ו-${ad.impressions.toLocaleString()} חשיפות — אך אין ליד אחד. ייתכן שיש בעיית מדידה.`,
      expectedImpact: 'זיהוי בעיית tracking או שיפור קריאייטיב',
      recommendedAction: 'מומלץ לבדוק פיקסל, דף נחיתה, ולינק CTA',
      confidence: 75,
      createdAt: now,
      actions: ['mark_for_review', 'ignore'],
    });
  }

  // Rule: Low CTR on ad
  if (ad.impressions > THRESHOLDS.minImpressions && ad.ctr > 0 && ad.ctr * 100 < THRESHOLDS.ctrLow) {
    // Only if there's not already a budget waste rec for this ad
    if (!recs.some(r => r.objectId === ad.id && r.type === 'budget_waste')) {
      recs.push({
        id: genId(),
        type: 'audience_issue',
        severity: 'low',
        objectType: 'ad',
        objectId: ad.id,
        objectName: adName,
        campaignId: campaign.id,
        campaignName: campaign.campaignName,
        title: 'CTR נמוך',
        reason: `CTR של ${(ad.ctr * 100).toFixed(2)}% — מתחת לסף המינימלי.`,
        expectedImpact: 'שיפור הקריאייטיב יגדיל מעורבות',
        recommendedAction: 'מומלץ לשפר את הכותרת או התמונה',
        confidence: 60,
        createdAt: now,
        actions: ['create_variation', 'ignore'],
      });
    }
  }

  // Rule: Best performer (compared to siblings in same ad set)
  if (allAdsInSet.length >= 2) {
    const scores = allAdsInSet
      .filter(a => a.impressions >= THRESHOLDS.minImpressions / 2)
      .map(a => ({ id: a.id, score: adScore(a) }));

    if (scores.length >= 2) {
      const sorted = [...scores].sort((a, b) => b.score - a.score);
      const best = sorted[0];
      const secondBest = sorted[1];

      if (best.id === ad.id && best.score > 0 && (secondBest.score === 0 || best.score / Math.max(secondBest.score, 1) >= THRESHOLDS.performanceGap)) {
        recs.push({
          id: genId(),
          type: 'best_performer',
          severity: 'low',
          objectType: 'ad',
          objectId: ad.id,
          objectName: adName,
          campaignId: campaign.id,
          campaignName: campaign.campaignName,
          title: 'מודעה מובילה בביצועים',
          reason: `"${adName}" מובילה בציון ${Math.round(best.score)} מתוך 100 — עדיפה משמעותית על יתר המודעות.`,
          expectedImpact: 'שכפול הגישה עשוי לשפר ביצועים כוללים',
          recommendedAction: 'מומלץ לשכפל את המודעה עם וריאציות קטנות',
          confidence: 70,
          createdAt: now,
          actions: ['create_variation', 'ignore'],
        });
      }
    }
  }

  return recs;
}

// ── Public API ──────────────────────────────────────────────────────────

export interface AnalysisInput {
  campaigns: Campaign[];
  adSets: AdSet[];
  ads: Ad[];
}

/**
 * Analyze all campaigns for a client and generate recommendations.
 * Returns recommendations sorted by severity (high first) then confidence.
 */
export function analyzeClient(input: AnalysisInput): Recommendation[] {
  const { campaigns, adSets, ads } = input;
  const allRecs: Recommendation[] = [];

  for (const campaign of campaigns) {
    if (campaign.status === 'draft' || campaign.status === 'completed') continue;

    const cmpAdSets = adSets.filter(as => as.campaignId === campaign.id);
    const cmpAds = ads.filter(a => a.campaignId === campaign.id);

    // Skip if no performance data at all
    if (!hasPerformanceData(cmpAds)) continue;

    // Campaign-level analysis
    allRecs.push(...analyzeCampaign(campaign, cmpAdSets, cmpAds));

    // Ad Set level analysis
    for (const adSet of cmpAdSets) {
      const asAds = cmpAds.filter(a => a.adSetId === adSet.id);
      if (!hasPerformanceData(asAds)) continue;
      allRecs.push(...analyzeAdSet(adSet, asAds, campaign));

      // Ad-level analysis
      for (const ad of asAds) {
        allRecs.push(...analyzeAd(ad, asAds, campaign));
      }
    }
  }

  // Sort: high severity first, then by confidence desc
  const severityOrder: Record<RecommendationSeverity, number> = { high: 0, medium: 1, low: 2 };
  allRecs.sort((a, b) => {
    const sevDiff = severityOrder[a.severity] - severityOrder[b.severity];
    if (sevDiff !== 0) return sevDiff;
    return b.confidence - a.confidence;
  });

  return allRecs;
}

/**
 * Get recommendations for a single campaign.
 */
export function analyzeCampaignFull(
  campaign: Campaign,
  adSets: AdSet[],
  ads: Ad[],
): Recommendation[] {
  return analyzeClient({ campaigns: [campaign], adSets, ads });
}

/**
 * Get a summary recommendation line for a campaign (for card display).
 * Returns null if no recommendations exist or no performance data.
 */
export function getCampaignSummaryRec(
  campaign: Campaign,
  adSets: AdSet[],
  ads: Ad[],
): { text: string; severity: RecommendationSeverity; type: RecommendationType } | null {
  const cmpAds = ads.filter(a => a.campaignId === campaign.id);
  if (!hasPerformanceData(cmpAds)) return null;

  const recs = analyzeCampaignFull(campaign, adSets, ads);
  if (recs.length === 0) return null;

  // Return the highest-priority recommendation
  const top = recs[0];
  return {
    text: top.title,
    severity: top.severity,
    type: top.type,
  };
}

/**
 * Get the single most important recommendation for an ad (for inline display).
 */
export function getAdNote(
  ad: Ad,
  allAdsInSet: Ad[],
  campaign: Campaign,
): Recommendation | null {
  if (ad.impressions < THRESHOLDS.minImpressions / 2) return null;
  const recs = analyzeAd(ad, allAdsInSet, campaign);
  return recs.length > 0 ? recs[0] : null;
}

/**
 * Get the single most important recommendation for an ad set (for badge display).
 */
export function getAdSetBadge(
  adSet: AdSet,
  ads: Ad[],
  campaign: Campaign,
): Recommendation | null {
  const asAds = ads.filter(a => a.adSetId === adSet.id);
  if (!hasPerformanceData(asAds)) return null;
  const recs = analyzeAdSet(adSet, asAds, campaign);
  return recs.length > 0 ? recs[0] : null;
}
