/**
 * Strategy Generator
 *
 * Takes a StrategicContext + decisions and builds a full strategy document
 * with 6 sections: situation, problems, opportunities, direction, actions, outcomes.
 *
 * No AI API calls. All content is template-based and data-driven.
 */

import type { StrategicContext } from './strategic-context';
import type { StrategicDecision, UrgencyLevel } from './strategic-decisions';

// ── Full Strategy shape ──

export interface FullStrategy {
  id: string;
  clientId: string;
  clientName: string;
  generatedAt: string;
  dataQuality: string;
  sections: StrategySections;
  decisions: StrategicDecision[];
  actionPlan: ActionPlanItem[];
  overallConfidence: number;
  overallUrgency: UrgencyLevel;
}

export interface StrategySections {
  currentSituation: StrategySection;
  keyProblems: StrategySection;
  opportunities: StrategySection;
  strategicDirection: StrategySection;
  recommendedActions: StrategySection;
  expectedOutcomes: StrategySection;
}

export interface StrategySection {
  title: string;
  items: StrategySectionItem[];
  summary: string;
}

export interface StrategySectionItem {
  text: string;
  importance: 'high' | 'medium' | 'low';
  dataSource: string;
}

export interface ActionPlanItem {
  id: string;
  title: string;
  description: string;
  type: string; // maps to system action
  priority: number;
  linkedDecisionId: string;
  estimatedTime: string;
  status: 'proposed' | 'approved' | 'rejected' | 'executed';
}

// ── Main generator ──

export function generateFullStrategy(
  ctx: StrategicContext,
  decisions: StrategicDecision[],
): FullStrategy {
  const sections = buildSections(ctx, decisions);
  const actionPlan = buildActionPlan(decisions);

  // Overall confidence = weighted average of decision confidences
  const overallConfidence = decisions.length > 0
    ? Math.round(decisions.reduce((s, d) => s + d.confidence, 0) / decisions.length)
    : 0;

  // Overall urgency = highest urgency among decisions
  const urgencyRank: Record<UrgencyLevel, number> = { critical: 3, high: 2, medium: 1, low: 0 };
  const overallUrgency = decisions.length > 0
    ? decisions.reduce((best, d) => urgencyRank[d.urgency] > urgencyRank[best] ? d.urgency : best, 'low' as UrgencyLevel)
    : 'low';

  return {
    id: `str_${Date.now()}`,
    clientId: ctx.client.id,
    clientName: ctx.client.name,
    generatedAt: new Date().toISOString(),
    dataQuality: ctx.dataQuality,
    sections,
    decisions,
    actionPlan,
    overallConfidence,
    overallUrgency,
  };
}

// ── Section builders ──

function buildSections(ctx: StrategicContext, decisions: StrategicDecision[]): StrategySections {
  return {
    currentSituation: buildSituation(ctx),
    keyProblems: buildProblems(ctx),
    opportunities: buildOpportunities(ctx, decisions),
    strategicDirection: buildDirection(ctx, decisions),
    recommendedActions: buildRecommendations(decisions),
    expectedOutcomes: buildOutcomes(ctx, decisions),
  };
}

function buildSituation(ctx: StrategicContext): StrategySection {
  const items: StrategySectionItem[] = [];

  items.push({
    text: `${ctx.campaigns.active} קמפיינים פעילים מתוך ${ctx.campaigns.total} סה"כ`,
    importance: ctx.campaigns.active > 0 ? 'medium' : 'high',
    dataSource: 'campaigns',
  });

  if (ctx.performance.totalLeads > 0) {
    items.push({
      text: `${ctx.performance.totalLeads} לידים, CPL ממוצע ₪${ctx.performance.avgCpl}, CTR ${ctx.performance.avgCtr}%`,
      importance: 'high',
      dataSource: 'performance',
    });
  }

  items.push({
    text: `${ctx.leads.thisMonth} לידים החודש${ctx.leads.trend === 'growing' ? ' (מגמת עלייה)' : ctx.leads.trend === 'declining' ? ' (מגמת ירידה)' : ''}`,
    importance: 'high',
    dataSource: 'leads',
  });

  if (ctx.campaigns.platforms.length > 0) {
    items.push({
      text: `פלטפורמות פעילות: ${ctx.campaigns.platforms.join(', ')}`,
      importance: 'medium',
      dataSource: 'platforms',
    });
  }

  items.push({
    text: `${ctx.content.activeCampaignAds} מודעות פעילות, ${ctx.content.highPerformingAds} בביצועים גבוהים`,
    importance: 'medium',
    dataSource: 'content',
  });

  const summary = ctx.campaigns.active > 0
    ? `הלקוח פעיל עם ${ctx.campaigns.active} קמפיינים ו-${ctx.leads.thisMonth} לידים החודש`
    : 'אין קמפיינים פעילים כרגע';

  return { title: 'מצב נוכחי', items, summary };
}

function buildProblems(ctx: StrategicContext): StrategySection {
  const items: StrategySectionItem[] = ctx.risks.map(risk => ({
    text: risk,
    importance: risk.includes('אין קמפיינים') || risk.includes('ירידה') ? 'high' as const : 'medium' as const,
    dataSource: 'analysis',
  }));

  if (ctx.approvals.pendingCount > 3) {
    items.push({
      text: `${ctx.approvals.pendingCount} אישורים ממתינים — עיכוב בביצוע`,
      importance: 'medium',
      dataSource: 'approvals',
    });
  }

  const summary = items.length > 0
    ? `זוהו ${items.length} בעיות שדורשות טיפול`
    : 'לא זוהו בעיות משמעותיות';

  return { title: 'בעיות מרכזיות', items, summary };
}

function buildOpportunities(ctx: StrategicContext, decisions: StrategicDecision[]): StrategySection {
  const items: StrategySectionItem[] = [];

  // From strengths
  for (const strength of ctx.strengths) {
    items.push({ text: strength, importance: 'medium', dataSource: 'analysis' });
  }

  // From decisions
  for (const dec of decisions.filter(d => d.type === 'scale_campaigns' || d.type === 'increase_volume' || d.type === 'launch_campaign')) {
    items.push({ text: dec.title, importance: 'high', dataSource: 'decisions' });
  }

  // From growth engine
  if (ctx.growth.pendingOpportunities > 0) {
    items.push({
      text: `${ctx.growth.pendingOpportunities} הזדמנויות צמיחה ממתינות (מנוע צמיחה)`,
      importance: 'medium',
      dataSource: 'growth',
    });
  }

  // From knowledge
  if (ctx.knowledge.topInsight) {
    items.push({
      text: `תובנה מבסיס הידע: ${ctx.knowledge.topInsight}`,
      importance: 'medium',
      dataSource: 'knowledge',
    });
  }

  const summary = items.length > 0
    ? `${items.length} הזדמנויות זוהו`
    : 'נדרש יותר נתונים לזיהוי הזדמנויות';

  return { title: 'הזדמנויות', items, summary };
}

function buildDirection(ctx: StrategicContext, decisions: StrategicDecision[]): StrategySection {
  const items: StrategySectionItem[] = [];

  // Primary direction based on top decisions
  const topDecision = decisions[0];
  if (topDecision) {
    items.push({
      text: `כיוון ראשי: ${topDecision.title}`,
      importance: 'high',
      dataSource: 'decisions',
    });
    items.push({
      text: topDecision.reasoning,
      importance: 'high',
      dataSource: 'decisions',
    });
  }

  // Secondary directions
  for (const dec of decisions.slice(1, 3)) {
    items.push({
      text: `כיוון משני: ${dec.title}`,
      importance: 'medium',
      dataSource: 'decisions',
    });
  }

  // Platform recommendation
  if (ctx.platforms.unusedRecommended.length > 0) {
    items.push({
      text: `שקלו פלטפורמות נוספות: ${ctx.platforms.unusedRecommended.join(', ')}`,
      importance: 'low',
      dataSource: 'platforms',
    });
  }

  const summary = topDecision
    ? `הכיוון האסטרטגי: ${topDecision.title}`
    : 'לא ניתן לגבש כיוון אסטרטגי — חסרים נתונים';

  return { title: 'כיוון אסטרטגי', items, summary };
}

function buildRecommendations(decisions: StrategicDecision[]): StrategySection {
  const items: StrategySectionItem[] = [];

  for (const dec of decisions) {
    for (const action of dec.suggestedActions) {
      items.push({
        text: action.description,
        importance: action.priority === 1 ? 'high' : action.priority === 2 ? 'medium' : 'low',
        dataSource: `decision:${dec.type}`,
      });
    }
  }

  const summary = items.length > 0
    ? `${items.length} פעולות מומלצות, ${items.filter(i => i.importance === 'high').length} בעדיפות גבוהה`
    : 'אין המלצות ספציפיות';

  return { title: 'פעולות מומלצות', items, summary };
}

function buildOutcomes(ctx: StrategicContext, decisions: StrategicDecision[]): StrategySection {
  const items: StrategySectionItem[] = [];

  // Project outcomes based on decisions
  const hasScale = decisions.some(d => d.type === 'scale_campaigns' || d.type === 'increase_volume');
  const hasCreative = decisions.some(d => d.type === 'change_creatives' || d.type === 'content_strategy');
  const hasWaste = decisions.some(d => d.type === 'reduce_waste');
  const hasFunnel = decisions.some(d => d.type === 'fix_funnel');

  if (hasScale) {
    const projectedLeads = Math.round(ctx.leads.thisMonth * 1.3);
    items.push({
      text: `צפי: עלייה ל-${projectedLeads} לידים/חודש (+30%)`,
      importance: 'high',
      dataSource: 'projection',
    });
  }

  if (hasCreative) {
    items.push({
      text: 'צפי: שיפור CTR ב-15-25% עם קריאייטיב חדש',
      importance: 'medium',
      dataSource: 'projection',
    });
  }

  if (hasWaste) {
    items.push({
      text: 'צפי: חיסכון של 15-20% מתקציב הפרסום',
      importance: 'medium',
      dataSource: 'projection',
    });
  }

  if (hasFunnel) {
    items.push({
      text: 'צפי: שיפור שיעור המרה ב-10-20%',
      importance: 'medium',
      dataSource: 'projection',
    });
  }

  const summary = items.length > 0
    ? 'תוצאות צפויות ביישום מלא של האסטרטגיה'
    : 'אין תחזיות ספציפיות';

  return { title: 'תוצאות צפויות', items, summary };
}

// ── Action plan builder ──

function buildActionPlan(decisions: StrategicDecision[]): ActionPlanItem[] {
  const plan: ActionPlanItem[] = [];
  let counter = 1;

  for (const dec of decisions) {
    for (const action of dec.suggestedActions) {
      plan.push({
        id: `act_${Date.now()}_${counter++}`,
        title: action.description,
        description: `${dec.title}: ${action.description}`,
        type: action.type,
        priority: action.priority,
        linkedDecisionId: dec.id,
        estimatedTime: dec.estimatedTimeframe,
        status: 'proposed',
      });
    }
  }

  plan.sort((a, b) => a.priority - b.priority);
  return plan;
}
