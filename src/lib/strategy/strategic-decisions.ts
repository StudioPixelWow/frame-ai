/**
 * Strategic Decision Engine
 *
 * Analyzes a StrategicContext and produces typed decisions.
 * Each decision has: title, reasoning, confidence, urgency, expected impact.
 *
 * Decision types:
 * - scale_campaigns — increase budget on winning campaigns
 * - change_creatives — replace underperforming ads
 * - launch_campaign — create new campaign for untapped potential
 * - shift_platform — move budget to better-performing platform
 * - content_strategy — develop new content angles
 * - fix_funnel — address lead quality / conversion issues
 * - increase_volume — expand reach on successful ads
 * - reduce_waste — cut spending on non-performers
 *
 * No AI API calls. All decisions are rule-based and explainable.
 */

import type { StrategicContext } from './strategic-context';

// ── Types ──

export type StrategicDecisionType =
  | 'scale_campaigns'
  | 'change_creatives'
  | 'launch_campaign'
  | 'shift_platform'
  | 'content_strategy'
  | 'fix_funnel'
  | 'increase_volume'
  | 'reduce_waste';

export type UrgencyLevel = 'critical' | 'high' | 'medium' | 'low';
export type ImpactLevel = 'very_high' | 'high' | 'medium' | 'low';

export interface StrategicDecision {
  id: string;
  type: StrategicDecisionType;
  title: string;
  reasoning: string;
  dataPoints: string[];
  confidence: number; // 0-100
  urgency: UrgencyLevel;
  expectedImpact: ImpactLevel;
  estimatedTimeframe: string;
  linkedCampaignIds: string[];
  suggestedActions: SuggestedAction[];
}

export interface SuggestedAction {
  type: string;
  description: string;
  priority: number; // 1 = highest
}

// ── Main decision generator ──

export function generateDecisions(ctx: StrategicContext): StrategicDecision[] {
  if (ctx.dataQuality === 'insufficient') return [];

  const decisions: StrategicDecision[] = [];
  let idCounter = 1;

  const makeId = () => `dec_${Date.now()}_${idCounter++}`;

  // 1. Scale campaigns — when performance is strong
  const scaleDecision = evaluateScale(ctx, makeId);
  if (scaleDecision) decisions.push(scaleDecision);

  // 2. Change creatives — when ads underperform
  const creativeDecision = evaluateCreatives(ctx, makeId);
  if (creativeDecision) decisions.push(creativeDecision);

  // 3. Launch new campaign — when there's untapped potential
  const launchDecision = evaluateLaunch(ctx, makeId);
  if (launchDecision) decisions.push(launchDecision);

  // 4. Shift platform — when one platform outperforms
  const platformDecision = evaluatePlatformShift(ctx, makeId);
  if (platformDecision) decisions.push(platformDecision);

  // 5. Content strategy — when variety is low or angles exhausted
  const contentDecision = evaluateContent(ctx, makeId);
  if (contentDecision) decisions.push(contentDecision);

  // 6. Fix funnel — when conversion is low
  const funnelDecision = evaluateFunnel(ctx, makeId);
  if (funnelDecision) decisions.push(funnelDecision);

  // 7. Increase volume — when CPL is good and scale is possible
  const volumeDecision = evaluateVolume(ctx, makeId);
  if (volumeDecision) decisions.push(volumeDecision);

  // 8. Reduce waste — when spend is inefficient
  const wasteDecision = evaluateWaste(ctx, makeId);
  if (wasteDecision) decisions.push(wasteDecision);

  // Sort by urgency then confidence
  const urgencyOrder: Record<UrgencyLevel, number> = { critical: 0, high: 1, medium: 2, low: 3 };
  decisions.sort((a, b) => {
    const uDiff = urgencyOrder[a.urgency] - urgencyOrder[b.urgency];
    return uDiff !== 0 ? uDiff : b.confidence - a.confidence;
  });

  return decisions;
}

// ── Decision evaluators ──

function evaluateScale(ctx: StrategicContext, makeId: () => string): StrategicDecision | null {
  const { performance, campaigns: c, leads } = ctx;
  if (performance.avgCpl === 0 || performance.avgCpl > 50) return null;
  if (c.active < 1) return null;
  if (leads.trend === 'declining') return null;

  const confidence = Math.min(85, 40 + Math.floor((50 - performance.avgCpl) * 0.8) + (leads.trend === 'growing' ? 15 : 0));
  if (confidence < 40) return null;

  return {
    id: makeId(),
    type: 'scale_campaigns',
    title: 'הגדלת תקציב בקמפיינים מנצחים',
    reasoning: `עלות ליד של ₪${performance.avgCpl} נמוכה מהממוצע. ${leads.thisMonth} לידים החודש${leads.trend === 'growing' ? ' עם מגמת עלייה' : ''}. יש מקום להגדיל תקציב ולהשיג יותר.`,
    dataPoints: [
      `CPL: ₪${performance.avgCpl}`,
      `לידים החודש: ${leads.thisMonth}`,
      `קמפיינים פעילים: ${c.active}`,
    ],
    confidence,
    urgency: performance.avgCpl < 30 ? 'high' : 'medium',
    expectedImpact: 'high',
    estimatedTimeframe: '1-2 שבועות',
    linkedCampaignIds: performance.bestCampaignId ? [performance.bestCampaignId] : [],
    suggestedActions: [
      { type: 'increase_budget', description: 'הגדלת תקציב ב-20-30% בקמפיין המוביל', priority: 1 },
      { type: 'duplicate_campaign', description: 'שכפול קמפיין מנצח עם קהל דומה', priority: 2 },
    ],
  };
}

function evaluateCreatives(ctx: StrategicContext, makeId: () => string): StrategicDecision | null {
  const { content, performance } = ctx;
  if (content.activeCampaignAds < 3) return null;
  if (content.lowPerformingAds < 2) return null;

  const ratio = content.lowPerformingAds / Math.max(content.activeCampaignAds, 1);
  if (ratio < 0.3) return null;

  const confidence = Math.min(80, 35 + Math.floor(ratio * 50) + (performance.avgCtr < 1.5 ? 10 : 0));

  return {
    id: makeId(),
    type: 'change_creatives',
    title: 'החלפת קריאייטיב בביצועים נמוכים',
    reasoning: `${content.lowPerformingAds} מתוך ${content.activeCampaignAds} מודעות עם ביצועים נמוכים (${Math.round(ratio * 100)}%). CTR ממוצע ${performance.avgCtr}% — צריך תוכן חדש.`,
    dataPoints: [
      `מודעות חלשות: ${content.lowPerformingAds}`,
      `מודעות חזקות: ${content.highPerformingAds}`,
      `CTR ממוצע: ${performance.avgCtr}%`,
    ],
    confidence,
    urgency: ratio > 0.6 ? 'critical' : 'high',
    expectedImpact: 'high',
    estimatedTimeframe: '3-5 ימים',
    linkedCampaignIds: [],
    suggestedActions: [
      { type: 'create_ad_variations', description: 'יצירת 3-5 וריאציות למודעות מובילות', priority: 1 },
      { type: 'pause_ads', description: 'השהיית מודעות עם CTR מתחת ל-0.8%', priority: 2 },
      { type: 'test_hooks', description: 'בדיקת הוקים חדשים מבסיס הידע', priority: 3 },
    ],
  };
}

function evaluateLaunch(ctx: StrategicContext, makeId: () => string): StrategicDecision | null {
  const { campaigns: c, platforms, knowledge } = ctx;
  if (c.active >= 5) return null; // already has enough campaigns
  if (platforms.unusedRecommended.length === 0 && c.active >= 2) return null;

  const hasKnowledge = knowledge.highConfidenceItems > 2;
  const confidence = Math.min(75, 30 + (hasKnowledge ? 20 : 0) + (platforms.unusedRecommended.length * 10));

  if (confidence < 35) return null;

  const platform = platforms.unusedRecommended[0] || 'facebook';

  return {
    id: makeId(),
    type: 'launch_campaign',
    title: c.active === 0 ? 'השקת קמפיין ראשון' : `השקת קמפיין חדש ב-${platform}`,
    reasoning: c.active === 0
      ? 'אין קמפיינים פעילים כרגע. חובה להתחיל לפרסם.'
      : `${platforms.unusedRecommended.length} פלטפורמות לא מנוצלות. ${hasKnowledge ? 'יש ידע מצטבר שתומך בכיוון.' : 'כדאי לגוון.'}`,
    dataPoints: [
      `קמפיינים פעילים: ${c.active}`,
      `פלטפורמות בשימוש: ${c.platforms.join(', ') || 'אין'}`,
      `פלטפורמות מומלצות: ${platforms.unusedRecommended.join(', ') || 'אין'}`,
    ],
    confidence,
    urgency: c.active === 0 ? 'critical' : 'medium',
    expectedImpact: c.active === 0 ? 'very_high' : 'medium',
    estimatedTimeframe: '1 שבוע',
    linkedCampaignIds: [],
    suggestedActions: [
      { type: 'create_campaign', description: `יצירת קמפיין חדש ב-${platform}`, priority: 1 },
      { type: 'use_knowledge', description: 'שימוש בהוקים מנצחים מבסיס הידע', priority: 2 },
    ],
  };
}

function evaluatePlatformShift(ctx: StrategicContext, makeId: () => string): StrategicDecision | null {
  const { platforms, campaigns: c } = ctx;
  if (c.platforms.length < 2) return null;
  if (!platforms.bestPerforming || !platforms.worstPerforming) return null;
  if (platforms.bestPerforming === platforms.worstPerforming) return null;

  return {
    id: makeId(),
    type: 'shift_platform',
    title: `העברת תקציב ל-${platforms.bestPerforming}`,
    reasoning: `${platforms.bestPerforming} מביאה תוצאות טובות יותר מ-${platforms.worstPerforming}. כדאי להעביר חלק מהתקציב.`,
    dataPoints: [
      `פלטפורמה חזקה: ${platforms.bestPerforming}`,
      `פלטפורמה חלשה: ${platforms.worstPerforming}`,
    ],
    confidence: 55,
    urgency: 'medium',
    expectedImpact: 'medium',
    estimatedTimeframe: '1-2 שבועות',
    linkedCampaignIds: [],
    suggestedActions: [
      { type: 'shift_budget', description: `העברת 20-30% מתקציב ${platforms.worstPerforming} ל-${platforms.bestPerforming}`, priority: 1 },
    ],
  };
}

function evaluateContent(ctx: StrategicContext, makeId: () => string): StrategicDecision | null {
  const { content, knowledge } = ctx;
  if (content.adVariety !== 'stale') return null;

  const confidence = Math.min(70, 35 + (knowledge.totalItems > 0 ? 15 : 0) + (knowledge.industryPlaybookExists ? 15 : 0));

  return {
    id: makeId(),
    type: 'content_strategy',
    title: 'בניית אסטרטגיית תוכן חדשה',
    reasoning: `מגוון הקריאייטיב נמוך (${content.activeCampaignAds} מודעות). ${knowledge.industryPlaybookExists ? 'יש פלייבוק תעשייתי שיכול לעזור.' : 'צריך לפתח זוויות חדשות.'}`,
    dataPoints: [
      `מודעות פעילות: ${content.activeCampaignAds}`,
      `מגוון: ${content.adVariety}`,
    ],
    confidence,
    urgency: content.activeCampaignAds < 2 ? 'high' : 'medium',
    expectedImpact: 'medium',
    estimatedTimeframe: '1 שבוע',
    linkedCampaignIds: [],
    suggestedActions: [
      { type: 'create_content', description: 'יצירת 5 מודעות חדשות עם זוויות שונות', priority: 1 },
      { type: 'use_playbook', description: 'שימוש בפלייבוק תעשייתי לזוויות תוכן', priority: 2 },
    ],
  };
}

function evaluateFunnel(ctx: StrategicContext, makeId: () => string): StrategicDecision | null {
  const { leads, performance } = ctx;
  if (leads.total < 10) return null;
  if (leads.conversionRate >= 15) return null;
  if (leads.avgQuality >= 70) return null;

  const confidence = Math.min(75, 40 + Math.floor((100 - leads.avgQuality) * 0.3));

  return {
    id: makeId(),
    type: 'fix_funnel',
    title: 'תיקון משפך — שיפור איכות לידים',
    reasoning: `שיעור המרה ${leads.conversionRate}% ואיכות ממוצעת ${leads.avgQuality}/100. ${leads.total} לידים סה"כ — יש בסיס לשפר את הטרגוט.`,
    dataPoints: [
      `שיעור המרה: ${leads.conversionRate}%`,
      `איכות ממוצעת: ${leads.avgQuality}`,
      `סה"כ לידים: ${leads.total}`,
    ],
    confidence,
    urgency: leads.conversionRate < 5 ? 'high' : 'medium',
    expectedImpact: 'high',
    estimatedTimeframe: '2-3 שבועות',
    linkedCampaignIds: [],
    suggestedActions: [
      { type: 'refine_targeting', description: 'חידוד טרגוט — הוספת תחומי עניין רלוונטיים', priority: 1 },
      { type: 'update_landing', description: 'עדכון דף נחיתה / טופס ליד', priority: 2 },
      { type: 'qualify_leads', description: 'הוספת שאלות מסננות לטופס', priority: 3 },
    ],
  };
}

function evaluateVolume(ctx: StrategicContext, makeId: () => string): StrategicDecision | null {
  const { performance, campaigns: c, leads } = ctx;
  if (performance.avgCpl === 0 || performance.avgCpl > 40) return null;
  if (c.active < 1) return null;
  if (leads.thisMonth < 5) return null;

  const confidence = Math.min(80, 45 + Math.floor((40 - performance.avgCpl) * 0.5) + (leads.trend === 'growing' ? 10 : 0));

  return {
    id: makeId(),
    type: 'increase_volume',
    title: 'הגדלת נפח — הזדמנות לעוד לידים',
    reasoning: `CPL של ₪${performance.avgCpl} ו-${leads.thisMonth} לידים החודש. יש מרווח לגדול בלי לפגוע ביעילות.`,
    dataPoints: [
      `CPL: ₪${performance.avgCpl}`,
      `לידים החודש: ${leads.thisMonth}`,
      `תקציב נוכחי: ₪${c.totalBudget}`,
    ],
    confidence,
    urgency: 'medium',
    expectedImpact: 'high',
    estimatedTimeframe: '1-2 שבועות',
    linkedCampaignIds: performance.bestCampaignId ? [performance.bestCampaignId] : [],
    suggestedActions: [
      { type: 'increase_budget', description: 'הגדלת תקציב כללי ב-25%', priority: 1 },
      { type: 'expand_audience', description: 'הרחבת קהל יעד עם לוקאלייק', priority: 2 },
    ],
  };
}

function evaluateWaste(ctx: StrategicContext, makeId: () => string): StrategicDecision | null {
  const { performance, content, campaigns: c } = ctx;
  if (c.totalSpend < 200) return null;

  const hasWaste = content.lowPerformingAds >= 3 || (performance.avgCpl > 80 && performance.totalLeads > 0);
  if (!hasWaste) return null;

  const wasteAmount = content.lowPerformingAds > 0
    ? Math.round(c.totalSpend * (content.lowPerformingAds / Math.max(content.activeCampaignAds, 1)) * 0.5)
    : 0;

  return {
    id: makeId(),
    type: 'reduce_waste',
    title: 'צמצום בזבוז תקציב',
    reasoning: `${content.lowPerformingAds} מודעות בביצועים נמוכים. הערכה: ~₪${wasteAmount} הוצאה לא יעילה. CPL ממוצע ₪${performance.avgCpl}.`,
    dataPoints: [
      `מודעות חלשות: ${content.lowPerformingAds}`,
      `הוצאה כוללת: ₪${Math.round(c.totalSpend)}`,
      `בזבוז משוער: ~₪${wasteAmount}`,
    ],
    confidence: Math.min(75, 40 + content.lowPerformingAds * 5),
    urgency: wasteAmount > 500 ? 'high' : 'medium',
    expectedImpact: 'medium',
    estimatedTimeframe: 'מיידי',
    linkedCampaignIds: [],
    suggestedActions: [
      { type: 'pause_ads', description: 'השהיית מודעות עם ביצועים נמוכים', priority: 1 },
      { type: 'reallocate_budget', description: 'העברת תקציב למודעות מנצחות', priority: 2 },
    ],
  };
}

// ── Display metadata ──

export const DECISION_TYPE_META: Record<StrategicDecisionType, { label: string; icon: string; color: string; bgColor: string }> = {
  scale_campaigns: { label: 'הגדלת קמפיינים', icon: '📈', color: '#10B981', bgColor: '#D1FAE5' },
  change_creatives: { label: 'החלפת קריאייטיב', icon: '🎨', color: '#F59E0B', bgColor: '#FEF3C7' },
  launch_campaign: { label: 'השקת קמפיין', icon: '🚀', color: '#3B82F6', bgColor: '#DBEAFE' },
  shift_platform: { label: 'שינוי פלטפורמה', icon: '🔄', color: '#8B5CF6', bgColor: '#EDE9FE' },
  content_strategy: { label: 'אסטרטגיית תוכן', icon: '📝', color: '#6366F1', bgColor: '#E0E7FF' },
  fix_funnel: { label: 'תיקון משפך', icon: '🔧', color: '#EF4444', bgColor: '#FEE2E2' },
  increase_volume: { label: 'הגדלת נפח', icon: '📊', color: '#14B8A6', bgColor: '#CCFBF1' },
  reduce_waste: { label: 'צמצום בזבוז', icon: '✂️', color: '#EC4899', bgColor: '#FCE7F3' },
};

export const URGENCY_META: Record<UrgencyLevel, { label: string; color: string; icon: string }> = {
  critical: { label: 'קריטי', color: '#DC2626', icon: '🔴' },
  high: { label: 'גבוהה', color: '#F59E0B', icon: '🟠' },
  medium: { label: 'בינונית', color: '#3B82F6', icon: '🔵' },
  low: { label: 'נמוכה', color: '#6B7280', icon: '⚪' },
};

export const IMPACT_META: Record<ImpactLevel, { label: string; color: string }> = {
  very_high: { label: 'גבוהה מאוד', color: '#10B981' },
  high: { label: 'גבוהה', color: '#3B82F6' },
  medium: { label: 'בינונית', color: '#F59E0B' },
  low: { label: 'נמוכה', color: '#6B7280' },
};
