/**
 * Content Intelligence Engine
 *
 * Analyzes all ads to detect:
 * - Top performing creatives
 * - Top performing hooks
 * - Best CTA
 * - Weak patterns
 *
 * Output: "מה עובד" / "מה לא עובד"
 *
 * Uses REAL ad data — returns "אין מספיק נתונים" when insufficient.
 */

import type { Ad } from '@/lib/db/schema';

// ── Types ──

export interface ContentInsight {
  type: 'positive' | 'negative';
  category: 'creative' | 'hook' | 'cta' | 'text' | 'pattern';
  title: string;
  detail: string;
  confidence: 'high' | 'medium' | 'low';
  relatedAds: string[]; // ad IDs
}

export interface ContentIntelligenceResult {
  working: ContentInsight[];      // מה עובד
  notWorking: ContentInsight[];   // מה לא עובד
  topCreatives: AdPerformanceSummary[];
  topHooks: { hook: string; avgCtr: number; count: number }[];
  bestCta: { cta: string; avgCtr: number; leads: number } | null;
  weakPatterns: string[];
  hasEnoughData: boolean;
  totalAdsAnalyzed: number;
}

export interface AdPerformanceSummary {
  adId: string;
  adName: string;
  headline: string;
  ctr: number;
  cpl: number;
  leads: number;
  spend: number;
  impressions: number;
  score: number; // composite score
}

// ── Core ──

export function analyzeContentIntelligence(
  ads: Ad[],
  clientId?: string,
): ContentIntelligenceResult {
  // Filter to ads with real performance data
  const relevantAds = ads.filter(a => {
    if (clientId) {
      // We'd need campaign mapping — skip filter if no clientId match possible
    }
    return (a.impressions || 0) > 0 || (a.spend || 0) > 0;
  });

  if (relevantAds.length < 2) {
    return {
      working: [],
      notWorking: [],
      topCreatives: [],
      topHooks: [],
      bestCta: null,
      weakPatterns: [],
      hasEnoughData: false,
      totalAdsAnalyzed: 0,
    };
  }

  // ── Score each ad ──
  const scored = relevantAds.map(a => ({
    adId: a.id,
    adName: a.name || '',
    headline: a.headline || '',
    primaryText: a.primaryText || '',
    ctaType: a.ctaType || '',
    ctr: a.ctr || ((a.impressions || 0) > 0 ? ((a.clicks || 0) / a.impressions) * 100 : 0),
    cpl: a.cpl || ((a.leads || 0) > 0 ? (a.spend || 0) / a.leads : 0),
    leads: a.leads || 0,
    spend: a.spend || 0,
    impressions: a.impressions || 0,
    clicks: a.clicks || 0,
    score: computeAdScore(a),
  }));

  scored.sort((a, b) => b.score - a.score);

  // ── Top creatives ──
  const topCreatives: AdPerformanceSummary[] = scored.slice(0, 5).map(s => ({
    adId: s.adId,
    adName: s.adName,
    headline: s.headline,
    ctr: s.ctr,
    cpl: s.cpl,
    leads: s.leads,
    spend: s.spend,
    impressions: s.impressions,
    score: s.score,
  }));

  // ── Hook analysis ──
  const hookMap = new Map<string, { totalCtr: number; count: number }>();
  for (const a of scored) {
    // Use first 50 chars of primary text as "hook"
    const hook = (a.primaryText || '').slice(0, 50).trim();
    if (!hook || a.impressions === 0) continue;
    const existing = hookMap.get(hook) || { totalCtr: 0, count: 0 };
    existing.totalCtr += a.ctr;
    existing.count += 1;
    hookMap.set(hook, existing);
  }

  const topHooks = Array.from(hookMap.entries())
    .map(([hook, data]) => ({ hook, avgCtr: data.totalCtr / data.count, count: data.count }))
    .filter(h => h.count >= 1)
    .sort((a, b) => b.avgCtr - a.avgCtr)
    .slice(0, 5);

  // ── Best CTA ──
  const ctaMap = new Map<string, { totalCtr: number; totalLeads: number; count: number }>();
  for (const a of scored) {
    const cta = a.ctaType || 'unknown';
    const existing = ctaMap.get(cta) || { totalCtr: 0, totalLeads: 0, count: 0 };
    existing.totalCtr += a.ctr;
    existing.totalLeads += a.leads;
    existing.count += 1;
    ctaMap.set(cta, existing);
  }

  const ctaEntries = Array.from(ctaMap.entries())
    .filter(([k]) => k !== 'unknown')
    .map(([cta, d]) => ({ cta, avgCtr: d.totalCtr / d.count, leads: d.totalLeads }))
    .sort((a, b) => b.avgCtr - a.avgCtr);

  const bestCta = ctaEntries.length > 0 ? ctaEntries[0] : null;

  // ── Working / Not working insights ──
  const working: ContentInsight[] = [];
  const notWorking: ContentInsight[] = [];
  const weakPatterns: string[] = [];

  // High CTR ads
  const highCtr = scored.filter(a => a.ctr >= 2 && a.impressions >= 100);
  if (highCtr.length > 0) {
    working.push({
      type: 'positive',
      category: 'creative',
      title: `${highCtr.length} מודעות עם CTR גבוה`,
      detail: `CTR ממוצע ${(highCtr.reduce((s, a) => s + a.ctr, 0) / highCtr.length).toFixed(1)}% — ביצועים מצוינים`,
      confidence: highCtr.length >= 3 ? 'high' : 'medium',
      relatedAds: highCtr.map(a => a.adId),
    });
  }

  // Good CPL ads
  const goodCpl = scored.filter(a => a.cpl > 0 && a.cpl <= 50 && a.leads >= 2);
  if (goodCpl.length > 0) {
    working.push({
      type: 'positive',
      category: 'creative',
      title: `${goodCpl.length} מודעות עם עלות לליד נמוכה`,
      detail: `CPL ממוצע ₪${(goodCpl.reduce((s, a) => s + a.cpl, 0) / goodCpl.length).toFixed(0)} — מביאות לידים ביעילות`,
      confidence: goodCpl.length >= 2 ? 'high' : 'medium',
      relatedAds: goodCpl.map(a => a.adId),
    });
  }

  // Best CTA insight
  if (bestCta && bestCta.avgCtr > 1) {
    working.push({
      type: 'positive',
      category: 'cta',
      title: `CTA מנצח: ${bestCta.cta}`,
      detail: `CTR ${bestCta.avgCtr.toFixed(1)}%, ${bestCta.leads} לידים — הכי אפקטיבי`,
      confidence: 'medium',
      relatedAds: [],
    });
  }

  // Low CTR ads
  const lowCtr = scored.filter(a => a.ctr < 0.5 && a.impressions >= 200);
  if (lowCtr.length > 0) {
    notWorking.push({
      type: 'negative',
      category: 'creative',
      title: `${lowCtr.length} מודעות עם CTR נמוך מאוד`,
      detail: `CTR מתחת ל-0.5% — הקהל לא מגיב, שקלו להחליף קריאייטיב`,
      confidence: lowCtr.length >= 3 ? 'high' : 'medium',
      relatedAds: lowCtr.map(a => a.adId),
    });
    weakPatterns.push('CTR נמוך — חוסר עניין בקריאייטיב');
  }

  // High CPL ads
  const highCpl = scored.filter(a => a.cpl > 150 && a.leads >= 1);
  if (highCpl.length > 0) {
    notWorking.push({
      type: 'negative',
      category: 'creative',
      title: `${highCpl.length} מודעות עם עלות לליד גבוהה`,
      detail: `CPL מעל ₪150 — שורפות תקציב`,
      confidence: 'high',
      relatedAds: highCpl.map(a => a.adId),
    });
    weakPatterns.push('CPL גבוה — טירגוט או קריאייטיב לא מתאימים');
  }

  // Spend without leads
  const noLeadsSpend = scored.filter(a => a.spend > 50 && a.leads === 0);
  if (noLeadsSpend.length > 0) {
    const totalWasted = noLeadsSpend.reduce((s, a) => s + a.spend, 0);
    notWorking.push({
      type: 'negative',
      category: 'pattern',
      title: `₪${totalWasted.toLocaleString('he-IL')} הוצאה ללא לידים`,
      detail: `${noLeadsSpend.length} מודעות שמוציאות תקציב בלי תוצאות`,
      confidence: 'high',
      relatedAds: noLeadsSpend.map(a => a.adId),
    });
    weakPatterns.push('הוצאה ללא המרות — שקלו לעצור מודעות אלו');
  }

  return {
    working,
    notWorking,
    topCreatives,
    topHooks,
    bestCta,
    weakPatterns,
    hasEnoughData: true,
    totalAdsAnalyzed: relevantAds.length,
  };
}

// ── Ad score ──

function computeAdScore(ad: Ad): number {
  let score = 0;
  const impressions = ad.impressions || 0;
  const clicks = ad.clicks || 0;
  const leads = ad.leads || 0;
  const spend = ad.spend || 0;
  const ctr = impressions > 0 ? (clicks / impressions) * 100 : 0;
  const cpl = leads > 0 ? spend / leads : 0;

  // CTR weight
  if (ctr >= 3) score += 40;
  else if (ctr >= 2) score += 30;
  else if (ctr >= 1) score += 20;
  else if (ctr > 0) score += 10;

  // Leads weight
  if (leads >= 10) score += 30;
  else if (leads >= 5) score += 25;
  else if (leads >= 1) score += 15;

  // CPL efficiency
  if (cpl > 0 && cpl <= 30) score += 20;
  else if (cpl > 0 && cpl <= 80) score += 10;

  // Volume bonus
  if (impressions >= 10000) score += 10;
  else if (impressions >= 1000) score += 5;

  return score;
}
