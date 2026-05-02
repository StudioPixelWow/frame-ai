/**
 * Platform Comparison BI Module
 *
 * Compares performance across Meta, TikTok, and Google Ads:
 * - Best platform per client (by CPL, CTR, ROAS)
 * - Cross-platform trends
 * - Platform-specific insights
 *
 * Uses real data only. Returns empty when insufficient.
 */

import type { Campaign, Ad } from '@/lib/db/schema';

// ── Types ──

export type ComparablePlatform = 'facebook' | 'instagram' | 'tiktok' | 'google' | 'multi_platform';

export interface PlatformMetrics {
  platform: ComparablePlatform;
  label: string;
  campaignCount: number;
  adCount: number;
  totalSpend: number;
  totalImpressions: number;
  totalClicks: number;
  totalConversions: number;
  avgCtr: number;
  avgCpc: number;
  avgCpm: number;
  avgCpl: number;
}

export interface PlatformComparisonResult {
  /** Per-platform aggregated metrics */
  platforms: PlatformMetrics[];
  /** Best platform per metric */
  bestBy: {
    ctr: ComparablePlatform | null;
    cpc: ComparablePlatform | null;
    cpm: ComparablePlatform | null;
    cpl: ComparablePlatform | null;
    conversions: ComparablePlatform | null;
  };
  /** Platform-level insights in Hebrew */
  insights: PlatformInsight[];
  /** Has enough data for comparison? */
  hasSufficientData: boolean;
}

export interface PlatformInsight {
  id: string;
  type: 'winner' | 'trend' | 'warning' | 'recommendation';
  title: string;
  detail: string;
  platform?: ComparablePlatform;
}

export interface ClientPlatformComparison {
  clientId: string;
  clientName: string;
  platforms: PlatformMetrics[];
  bestPlatform: ComparablePlatform | null;
  bestPlatformReason: string;
}

// ── Helpers ──

const PLATFORM_LABELS: Record<ComparablePlatform, string> = {
  facebook: 'Facebook',
  instagram: 'Instagram',
  tiktok: 'TikTok',
  google: 'Google Ads',
  multi_platform: 'מולטי-פלטפורמה',
};

function aggregatePlatformMetrics(
  campaigns: Campaign[],
  ads: Ad[],
  platform: ComparablePlatform,
): PlatformMetrics | null {
  const platformCampaigns = campaigns.filter(c => (c.platform || 'facebook') === platform);
  if (platformCampaigns.length === 0) return null;

  const campaignIds = new Set(platformCampaigns.map(c => c.id));
  const platformAds = ads.filter(a => campaignIds.has(a.campaignId || ''));

  let totalSpend = 0;
  let totalImpressions = 0;
  let totalClicks = 0;
  let totalConversions = 0;

  for (const ad of platformAds) {
    totalSpend += Number(ad.spend) || 0;
    totalImpressions += Number(ad.impressions) || 0;
    totalClicks += Number(ad.clicks) || 0;
    totalConversions += Number(ad.conversions) || 0;
  }

  return {
    platform,
    label: PLATFORM_LABELS[platform],
    campaignCount: platformCampaigns.length,
    adCount: platformAds.length,
    totalSpend,
    totalImpressions,
    totalClicks,
    totalConversions,
    avgCtr: totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0,
    avgCpc: totalClicks > 0 ? totalSpend / totalClicks : 0,
    avgCpm: totalImpressions > 0 ? (totalSpend / totalImpressions) * 1000 : 0,
    avgCpl: totalConversions > 0 ? totalSpend / totalConversions : 0,
  };
}

// ── Main Functions ──

/**
 * Compare performance across all platforms (global view).
 */
export function comparePlatforms(
  campaigns: Campaign[],
  ads: Ad[],
): PlatformComparisonResult {
  const allPlatforms: ComparablePlatform[] = ['facebook', 'instagram', 'tiktok', 'google', 'multi_platform'];
  const metrics: PlatformMetrics[] = [];

  for (const p of allPlatforms) {
    const m = aggregatePlatformMetrics(campaigns, ads, p);
    if (m && m.campaignCount > 0) metrics.push(m);
  }

  const hasSufficientData = metrics.length >= 2 && metrics.some(m => m.totalSpend > 0);

  // Find best by each metric (lower is better for cost metrics)
  const withSpend = metrics.filter(m => m.totalSpend > 0);
  const withClicks = metrics.filter(m => m.totalClicks > 0);
  const withConversions = metrics.filter(m => m.totalConversions > 0);

  const bestCtr = withClicks.length > 0
    ? withClicks.reduce((best, m) => m.avgCtr > best.avgCtr ? m : best).platform
    : null;
  const bestCpc = withClicks.length > 0
    ? withClicks.reduce((best, m) => m.avgCpc < best.avgCpc ? m : best).platform
    : null;
  const bestCpm = withSpend.length > 0
    ? withSpend.reduce((best, m) => m.avgCpm < best.avgCpm ? m : best).platform
    : null;
  const bestCpl = withConversions.length > 0
    ? withConversions.reduce((best, m) => m.avgCpl < best.avgCpl ? m : best).platform
    : null;
  const bestConversions = withConversions.length > 0
    ? withConversions.reduce((best, m) => m.totalConversions > best.totalConversions ? m : best).platform
    : null;

  // Generate insights
  const insights: PlatformInsight[] = [];

  if (hasSufficientData) {
    // Winner insight
    if (bestCpl) {
      const bestM = metrics.find(m => m.platform === bestCpl)!;
      insights.push({
        id: 'best-cpl-platform',
        type: 'winner',
        title: `${PLATFORM_LABELS[bestCpl]} — הפלטפורמה הכי חסכונית`,
        detail: `עלות ממוצעת לליד: ₪${bestM.avgCpl.toFixed(0)} — הנמוכה ביותר מבין כל הפלטפורמות`,
        platform: bestCpl,
      });
    }

    if (bestCtr) {
      const bestM = metrics.find(m => m.platform === bestCtr)!;
      insights.push({
        id: 'best-ctr-platform',
        type: 'winner',
        title: `${PLATFORM_LABELS[bestCtr]} — שיעור הקלקה הגבוה ביותר`,
        detail: `CTR ממוצע: ${bestM.avgCtr.toFixed(2)}% — אנשים מגיבים יותר למודעות בפלטפורמה זו`,
        platform: bestCtr,
      });
    }

    // Spend distribution warning
    const totalSpend = metrics.reduce((s, m) => s + m.totalSpend, 0);
    for (const m of metrics) {
      const share = totalSpend > 0 ? (m.totalSpend / totalSpend) * 100 : 0;
      if (share > 80 && metrics.length >= 2) {
        insights.push({
          id: `spend-concentration-${m.platform}`,
          type: 'warning',
          title: `ריכוז תקציב ב-${m.label}`,
          detail: `${share.toFixed(0)}% מהתקציב מופנה לפלטפורמה אחת — שקלו לפזר לפלטפורמות נוספות`,
          platform: m.platform,
        });
      }
    }

    // Platform with zero conversions but spend
    for (const m of metrics) {
      if (m.totalSpend > 50 && m.totalConversions === 0) {
        insights.push({
          id: `no-conversions-${m.platform}`,
          type: 'warning',
          title: `${m.label} — תקציב ללא המרות`,
          detail: `הוצאתם ₪${m.totalSpend.toFixed(0)} ב-${m.label} ללא המרות — בדקו טרגוט ויעדים`,
          platform: m.platform,
        });
      }
    }

    // Recommendation: scale winner
    if (bestCpl && totalSpend > 0) {
      const bestM = metrics.find(m => m.platform === bestCpl)!;
      const share = (bestM.totalSpend / totalSpend) * 100;
      if (share < 50) {
        insights.push({
          id: 'scale-winner',
          type: 'recommendation',
          title: `הגדילו תקציב ב-${PLATFORM_LABELS[bestCpl]}`,
          detail: `הפלטפורמה עם ה-CPL הנמוך ביותר מקבלת רק ${share.toFixed(0)}% מהתקציב — שקלו להגדיל`,
          platform: bestCpl,
        });
      }
    }
  }

  if (!hasSufficientData && metrics.length < 2) {
    insights.push({
      id: 'insufficient-data',
      type: 'recommendation',
      title: 'אין מספיק נתונים להשוואה',
      detail: 'חברו פלטפורמת פרסום נוספת כדי לאפשר השוואה בין פלטפורמות',
    });
  }

  return {
    platforms: metrics,
    bestBy: {
      ctr: bestCtr,
      cpc: bestCpc,
      cpm: bestCpm,
      cpl: bestCpl,
      conversions: bestConversions,
    },
    insights,
    hasSufficientData,
  };
}

/**
 * Compare platforms per client — detect best platform for each client.
 */
export function compareClientPlatforms(
  clientId: string,
  clientName: string,
  campaigns: Campaign[],
  ads: Ad[],
): ClientPlatformComparison {
  const clientCampaigns = campaigns.filter(c => c.clientId === clientId);
  const result = comparePlatforms(clientCampaigns, ads);

  let bestPlatform: ComparablePlatform | null = null;
  let bestPlatformReason = '';

  if (result.bestBy.cpl) {
    bestPlatform = result.bestBy.cpl;
    const m = result.platforms.find(p => p.platform === bestPlatform);
    bestPlatformReason = m ? `CPL הנמוך ביותר: ₪${m.avgCpl.toFixed(0)}` : '';
  } else if (result.bestBy.ctr) {
    bestPlatform = result.bestBy.ctr;
    const m = result.platforms.find(p => p.platform === bestPlatform);
    bestPlatformReason = m ? `CTR הגבוה ביותר: ${m.avgCtr.toFixed(2)}%` : '';
  }

  return {
    clientId,
    clientName,
    platforms: result.platforms,
    bestPlatform,
    bestPlatformReason,
  };
}
