/**
 * Growth Explanation Service
 *
 * Generates Hebrew explanations for growth actions and opportunities.
 * Currently rule-based — future-ready for LLM enhancement.
 *
 * No AI API calls. All deterministic.
 */

import type { GrowthActionType, GrowthOpportunityType } from '@/lib/db/schema';
import type { RawOpportunity } from './growth-rules';

// ── Action explanations ──

export interface ActionExplanation {
  title: string;
  reason: string;
  expectedImpact: string;
  suggestedNextStep: string;
}

export function generateActionExplanation(
  actionType: GrowthActionType,
  opportunity: RawOpportunity,
): ActionExplanation {
  const templates = ACTION_TEMPLATES[actionType];
  if (!templates) {
    return {
      title: `פעולה מוצעת — ${opportunity.clientName}`,
      reason: opportunity.reason,
      expectedImpact: opportunity.expectedImpact,
      suggestedNextStep: 'בדקו את הנתונים ואשרו את הפעולה',
    };
  }

  return {
    title: templates.title(opportunity),
    reason: templates.reason(opportunity),
    expectedImpact: templates.impact(opportunity),
    suggestedNextStep: templates.nextStep(opportunity),
  };
}

interface ActionTemplate {
  title: (o: RawOpportunity) => string;
  reason: (o: RawOpportunity) => string;
  impact: (o: RawOpportunity) => string;
  nextStep: (o: RawOpportunity) => string;
}

const ACTION_TEMPLATES: Record<GrowthActionType, ActionTemplate> = {
  create_ad_variation: {
    title: (o) => `יצירת וריאציה חדשה — ${o.campaignName || o.clientName}`,
    reason: (o) => o.reason,
    impact: () => 'וריאציה חדשה עשויה לשפר CTR ב-30-50% ולהפחית שחיקה',
    nextStep: () => 'אשרו כדי ליצור טיוטת מודעה חדשה עם טקסט מעודכן',
  },
  duplicate_winning_ad: {
    title: (o) => `שכפול מודעה מנצחת — ${o.campaignName || o.clientName}`,
    reason: (o) => o.reason,
    impact: () => 'שכפול מודעה שעובדת לקהל חדש עשוי להכפיל תוצאות',
    nextStep: () => 'אשרו כדי ליצור עותק של המודעה בקבוצת מודעות חדשה',
  },
  create_new_adset: {
    title: (o) => `קבוצת מודעות חדשה — ${o.campaignName || o.clientName}`,
    reason: (o) => o.reason,
    impact: () => 'הרחבת קהל עשויה להגדיל את כמות הלידים ב-20-40%',
    nextStep: () => 'אשרו כדי ליצור קבוצת מודעות עם טרגוט מורחב',
  },
  suggest_budget_increase: {
    title: (o) => `הגדלת תקציב — ${o.campaignName || o.clientName}`,
    reason: (o) => o.reason,
    impact: (o) => {
      const cpl = Number(o.metadata?.cpl) || 0;
      return cpl > 0
        ? `עם CPL של ₪${cpl.toFixed(0)}, הגדלת תקציב ב-30% עשויה להניב לידים נוספים`
        : 'הגדלת תקציב מבוקרת עשויה להגדיל את כמות הלידים';
    },
    nextStep: () => 'אשרו כדי לעדכן את ההמלצה — השינוי יבוצע ידנית בפלטפורמה',
  },
  suggest_budget_reduction: {
    title: (o) => `הפחתת תקציב — ${o.campaignName || o.clientName}`,
    reason: (o) => o.reason,
    impact: (o) => {
      const spend = Number(o.metadata?.spend) || 0;
      return spend > 0
        ? `חיסכון פוטנציאלי של ₪${Math.floor(spend * 0.3)} בחודש`
        : 'הפחתת תקציב בקמפיינים חלשים תפנה משאבים לקמפיינים חזקים';
    },
    nextStep: () => 'אשרו כדי לעדכן את ההמלצה — השינוי יבוצע ידנית בפלטפורמה',
  },
  pause_weak_ad: {
    title: (o) => `השהיית מודעה חלשה — ${o.campaignName || o.clientName}`,
    reason: (o) => o.reason,
    impact: () => 'השהיית מודעות שלא עובדות מפנה תקציב למודעות חזקות',
    nextStep: () => 'אשרו כדי להשהות את המודעה — ניתן להפעיל מחדש בכל עת',
  },
  create_campaign_from_content: {
    title: (o) => `קמפיין חדש מתוכן קיים — ${o.clientName}`,
    reason: (o) => o.reason,
    impact: () => 'שימוש בתוכן שכבר הוכח כמוצלח מגדיל את סיכויי ההצלחה',
    nextStep: () => 'אשרו כדי ליצור טיוטת קמפיין על בסיס התוכן המנצח',
  },
  create_campaign_from_podcast: {
    title: (o) => `קמפיין מקליפ פודקאסט — ${o.clientName}`,
    reason: (o) => o.reason,
    impact: () => 'קליפים מפודקאסט מספקים תוכן אותנטי שמגיב היטב ברשתות',
    nextStep: () => 'אשרו כדי ליצור טיוטת קמפיין עם הקליפ',
  },
  create_retargeting_campaign: {
    title: (o) => `קמפיין ריטרגטינג — ${o.clientName}`,
    reason: (o) => o.reason,
    impact: () => 'ריטרגטינג מגדיל סיכויי המרה ב-70% בממוצע',
    nextStep: () => 'אשרו כדי ליצור קמפיין ריטרגטינג ממוקד',
  },
  create_report: {
    title: (o) => `דוח מצב — ${o.clientName}`,
    reason: (o) => o.reason,
    impact: () => 'דוח ללקוח מחזק את האמון ומאפשר קבלת החלטות מושכלת',
    nextStep: () => 'אשרו כדי ליצור דוח ביצועים מעודכן',
  },
  create_followup_task: {
    title: (o) => `משימת מעקב — ${o.clientName}`,
    reason: (o) => o.reason,
    impact: () => 'מעקב אקטיבי מבטיח שבעיות מטופלות בזמן',
    nextStep: () => 'אשרו כדי ליצור משימת מעקב בלוח המשימות',
  },
};

// ── Opportunity type labels ──

export const OPPORTUNITY_TYPE_META: Record<GrowthOpportunityType, { icon: string; label: string; color: string; bgColor: string }> = {
  scale: { icon: '📈', label: 'הזדמנות להרחבה', color: '#22c55e', bgColor: '#f0fdf4' },
  creative_replacement: { icon: '🎨', label: 'החלפת קריאייטיב', color: '#f59e0b', bgColor: '#fffbeb' },
  budget_waste: { icon: '💸', label: 'בזבוז תקציב', color: '#ef4444', bgColor: '#fef2f2' },
  platform_shift: { icon: '🔄', label: 'שינוי פלטפורמה', color: '#8b5cf6', bgColor: '#f5f3ff' },
  audience_expansion: { icon: '🎯', label: 'הרחבת קהל', color: '#3b82f6', bgColor: '#eff6ff' },
  funnel_leak: { icon: '🔍', label: 'דליפה במשפך', color: '#f97316', bgColor: '#fff7ed' },
  content_to_campaign: { icon: '✨', label: 'תוכן לקמפיין', color: '#06b6d4', bgColor: '#ecfeff' },
  client_risk: { icon: '⚠️', label: 'סיכון לקוח', color: '#dc2626', bgColor: '#fef2f2' },
};

export const SEVERITY_META: Record<string, { label: string; color: string; bgColor: string }> = {
  low: { label: 'נמוכה', color: '#6b7280', bgColor: '#f3f4f6' },
  medium: { label: 'בינונית', color: '#f59e0b', bgColor: '#fffbeb' },
  high: { label: 'גבוהה', color: '#ef4444', bgColor: '#fef2f2' },
  critical: { label: 'קריטית', color: '#dc2626', bgColor: '#fef2f2' },
};

export const ACTION_TYPE_META: Record<GrowthActionType, { icon: string; label: string; color: string }> = {
  create_ad_variation: { icon: '🎨', label: 'יצירת וריאציה', color: '#f59e0b' },
  duplicate_winning_ad: { icon: '📋', label: 'שכפול מודעה מנצחת', color: '#22c55e' },
  create_new_adset: { icon: '🎯', label: 'קבוצת מודעות חדשה', color: '#3b82f6' },
  suggest_budget_increase: { icon: '📈', label: 'הגדלת תקציב', color: '#22c55e' },
  suggest_budget_reduction: { icon: '📉', label: 'הפחתת תקציב', color: '#ef4444' },
  pause_weak_ad: { icon: '⏸️', label: 'השהיית מודעה', color: '#6b7280' },
  create_campaign_from_content: { icon: '✨', label: 'קמפיין מתוכן', color: '#8b5cf6' },
  create_campaign_from_podcast: { icon: '🎙️', label: 'קמפיין מפודקאסט', color: '#06b6d4' },
  create_retargeting_campaign: { icon: '🔄', label: 'ריטרגטינג', color: '#f97316' },
  create_report: { icon: '📊', label: 'יצירת דוח', color: '#3b82f6' },
  create_followup_task: { icon: '📌', label: 'משימת מעקב', color: '#6b7280' },
};

export const APPROVAL_STATUS_META: Record<string, { label: string; color: string; bgColor: string }> = {
  draft: { label: 'טיוטה', color: '#6b7280', bgColor: '#f3f4f6' },
  pending_admin: { label: 'ממתין לאישור מנהל', color: '#f59e0b', bgColor: '#fffbeb' },
  pending_client: { label: 'ממתין לאישור לקוח', color: '#3b82f6', bgColor: '#eff6ff' },
  approved: { label: 'אושר', color: '#22c55e', bgColor: '#f0fdf4' },
  rejected: { label: 'נדחה', color: '#ef4444', bgColor: '#fef2f2' },
};

// ── Opportunity explanation ──

export function generateOpportunityExplanation(type: GrowthOpportunityType): string {
  const explanations: Record<GrowthOpportunityType, string> = {
    scale: 'הקמפיין מציג ביצועים חזקים — CPL נמוך, CTR גבוה ולידים יציבים. יש מקום להגדיל.',
    creative_replacement: 'הקריאייטיב הנוכחי מראה סימני עייפות — תדירות גבוהה או CTR יורד. זה הזמן להחליף.',
    budget_waste: 'יש הוצאה שלא מחזירה תוצאות. תקציב זה יכול לעבוד טוב יותר במקום אחר.',
    platform_shift: 'ישנה פלטפורמה שמניבה תוצאות טובות יותר. שקלו להעביר תקציב.',
    audience_expansion: 'הקהל הנוכחי מגיב היטב — הרחבה עשויה להכפיל תוצאות.',
    funnel_leak: 'לידים נכנסים אבל לא בונים לסגירה. בדקו את איכות הלידים ותהליך המכירה.',
    content_to_campaign: 'יש תוכן מנצח שיכול להפוך לקמפיין פרסומי אפקטיבי.',
    client_risk: 'ישנם סימני אזהרה שדורשים תשומת לב — חוסר פעילות, ביצועים ירודים, או תקלות.',
  };
  return explanations[type] || '';
}
