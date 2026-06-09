/**
 * Insights engine — turns raw Google Ads data into a small set of positive,
 * client-ready insights and practical recommendations (Hebrew). It compares the
 * current period to the previous equal period and never frames anything as a
 * failure: weaker metrics become clear "optimization opportunities".
 */

import type { AdsData } from './provider';
import type { GoogleAdsReportInsight, GoogleAdsReportRecommendation } from './db';

const pct = (cur: number, prev: number): number => {
  if (!prev) return cur > 0 ? 100 : 0;
  return Math.round(((cur - prev) / prev) * 100);
};
const fmtPct = (n: number) => `${n >= 0 ? '+' : ''}${n}%`;

export interface AnalysisResult {
  insights: GoogleAdsReportInsight[];
  recommendations: GoogleAdsReportRecommendation[];
  deltas: Record<string, number>;
}

export function analyze(data: AdsData): AnalysisResult {
  const c = data.current, p = data.previous;
  const deltas = {
    impressions: pct(c.impressions, p.impressions),
    clicks: pct(c.clicks, p.clicks),
    ctr: pct(c.ctr, p.ctr),
    conversions: pct(c.conversions, p.conversions),
    costPerConv: pct(c.costPerConv, p.costPerConv),
    convRate: pct(c.convRate, p.convRate),
    cost: pct(c.cost, p.cost),
  };

  const insights: GoogleAdsReportInsight[] = [];

  // 1. Leading campaign
  const topCampaign = [...data.campaigns].sort((a, b) => b.conversions - a.conversions)[0];
  if (topCampaign) {
    insights.push({
      insightType: 'leading_campaign',
      title: 'קמפיין מוביל',
      description: `הקמפיין «${topCampaign.name}» הוביל את הביצועים עם ${Math.round(topCampaign.conversions)} המרות ו-${topCampaign.clicks.toLocaleString('he-IL')} קליקים, ומהווה עוגן יציב להמשך.`,
      metricName: 'המרות', metricValue: `${Math.round(topCampaign.conversions)}`, trend: 'up', priority: 1,
    });
  }

  // 2. Period improvement (pick the strongest positive delta)
  const positives: { k: string; label: string; v: number }[] = [
    { k: 'clicks', label: 'התנועה (קליקים)', v: deltas.clicks },
    { k: 'conversions', label: 'ההמרות', v: deltas.conversions },
    { k: 'ctr', label: 'אחוז ההקלקה (CTR)', v: deltas.ctr },
    { k: 'convRate', label: 'אחוז ההמרה', v: deltas.convRate },
  ].sort((a, b) => b.v - a.v);
  if (positives[0] && positives[0].v > 0) {
    insights.push({
      insightType: 'period_improvement',
      title: 'מגמת התקדמות חיובית',
      description: `${positives[0].label} הציגו צמיחה של ${fmtPct(positives[0].v)} לעומת התקופה הקודמת — אינדיקציה ברורה לכיוון פעולה נכון.`,
      metricName: positives[0].k, metricValue: fmtPct(positives[0].v), comparisonValue: 'תקופה קודמת', trend: 'up', priority: 2,
    });
  }

  // 3. Strong device
  const topDevice = [...data.devices].sort((a, b) => b.conversions - a.conversions)[0];
  if (topDevice) {
    insights.push({
      insightType: 'strong_device',
      title: 'מכשיר מוביל',
      description: `מרבית ההמרות הגיעו ממכשיר ${topDevice.label} — נתון שמאפשר חידוד נוסף של החוויה וההצעות לקהל הזה.`,
      metricName: 'מכשיר', metricValue: topDevice.label, trend: 'up', priority: 3,
    });
  }

  // 4. Strong region
  const topLoc = [...data.locations].sort((a, b) => b.conversions - a.conversions)[0];
  if (topLoc) {
    insights.push({
      insightType: 'strong_region',
      title: 'אזור חזק',
      description: `${topLoc.label} בלט כאזור עם ביקוש גבוה — בסיס מצוין להרחבת נוכחות ותקציב ממוקד.`,
      metricName: 'אזור', metricValue: topLoc.label, trend: 'up', priority: 4,
    });
  }

  // 5. Quality search terms
  const topTerm = [...data.searchTerms].sort((a, b) => b.conversions - a.conversions)[0];
  if (topTerm) {
    insights.push({
      insightType: 'quality_terms',
      title: 'ביטויי חיפוש איכותיים',
      description: `ביטויים כמו «${topTerm.term}» הניבו תנועה איכותית וממירה — הזדמנות להרחבה ולחיזוק הכיסוי סביבם.`,
      metricName: 'ביטוי מוביל', metricValue: topTerm.term, trend: 'up', priority: 5,
    });
  }

  // ── Recommendations (always practical, always positive framing) ──
  const recommendations: GoogleAdsReportRecommendation[] = [];
  if (topCampaign) recommendations.push({
    title: 'לחזק את הקמפיין המוביל', actionType: 'strengthen', priority: 1,
    description: `מומלץ להגדיל בהדרגה את הנפח של «${topCampaign.name}» — הקמפיין מציג ביצועים יציבים ויש בו פוטנציאל צמיחה ברור.`,
  });
  if (topTerm) recommendations.push({
    title: 'להרחיב ביטויים איכותיים', actionType: 'expand', priority: 2,
    description: `כדאי להרחיב את הכיסוי סביב ביטויים מובילים כמו «${topTerm.term}» ולהוסיף וריאציות קרובות כדי לתפוס ביקוש נוסף.`,
  });
  if (topLoc || topDevice) recommendations.push({
    title: 'לחדד קהלים ואזורים', actionType: 'refine', priority: 3,
    description: `מומלץ למקד תקציב נוסף ב${topLoc ? topLoc.label : 'אזורים החזקים'} וב${topDevice ? `מכשירי ${topDevice.label}` : 'מכשירים המובילים'} כדי למקסם תשואה.`,
  });
  if (deltas.ctr <= 0) recommendations.push({
    title: 'לחזק את המסר הקריאייטיבי', actionType: 'creative', priority: 4,
    description: 'יש מקום לחיזוק המסר הקריאייטיבי במודעות כדי להגדיל מעורבות ואחוז הקלקה — הזדמנות לשיפור איכות התנועה.',
  });
  if (deltas.costPerConv >= 0 || deltas.convRate <= 0) recommendations.push({
    title: 'לחזק את נקודת ההמרה', actionType: 'landing', priority: 5,
    description: 'קיים פוטנציאל לייעול עלות הליד באמצעות חידוד דף הנחיתה והתאמת ההצעה — מהלך שיממש טוב יותר את נפח התנועה שנוצר.',
  });
  recommendations.push({
    title: 'ניסויי קריאייטיב והצעות', actionType: 'creative', priority: 6,
    description: 'מומלץ להריץ ניסוי A/B של קריאייטיב והצעות מחיר כדי לזהות את השילוב המנצח ולהאיץ את הצמיחה.',
  });

  return {
    insights: insights.slice(0, 5),
    recommendations: recommendations.sort((a, b) => a.priority - b.priority).slice(0, 5),
    deltas,
  };
}
