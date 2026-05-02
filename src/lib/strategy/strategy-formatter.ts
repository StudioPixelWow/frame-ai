/**
 * Strategy Output Formatter
 *
 * Hebrew display metadata, section labels, formatting utilities
 * for rendering strategies in the UI.
 */

import type { FullStrategy, StrategySection, ActionPlanItem } from './strategy-generator';
import type { UrgencyLevel, ImpactLevel } from './strategic-decisions';

// ── Section metadata ──

export const SECTION_META: Record<string, { label: string; icon: string; color: string }> = {
  currentSituation: { label: 'מצב נוכחי', icon: '📊', color: '#3B82F6' },
  keyProblems: { label: 'בעיות מרכזיות', icon: '⚠️', color: '#EF4444' },
  opportunities: { label: 'הזדמנויות', icon: '💡', color: '#10B981' },
  strategicDirection: { label: 'כיוון אסטרטגי', icon: '🧭', color: '#8B5CF6' },
  recommendedActions: { label: 'פעולות מומלצות', icon: '🎯', color: '#F59E0B' },
  expectedOutcomes: { label: 'תוצאות צפויות', icon: '📈', color: '#14B8A6' },
};

// ── Action status metadata ──

export const ACTION_STATUS_META: Record<string, { label: string; color: string; icon: string }> = {
  proposed: { label: 'מוצע', color: '#6B7280', icon: '⬜' },
  approved: { label: 'מאושר', color: '#10B981', icon: '✅' },
  rejected: { label: 'נדחה', color: '#EF4444', icon: '❌' },
  executed: { label: 'בוצע', color: '#3B82F6', icon: '🔵' },
};

// ── Data quality labels ──

export const DATA_QUALITY_META: Record<string, { label: string; color: string; description: string }> = {
  rich: { label: 'נתונים עשירים', color: '#10B981', description: 'מספיק נתונים לאסטרטגיה מלאה' },
  moderate: { label: 'נתונים בינוניים', color: '#3B82F6', description: 'אסטרטגיה מבוססת על נתונים חלקיים' },
  sparse: { label: 'נתונים דלים', color: '#F59E0B', description: 'אסטרטגיה בסיסית — נדרשים יותר נתונים' },
  insufficient: { label: 'אין מספיק נתונים', color: '#EF4444', description: 'אין מספיק נתונים לבניית אסטרטגיה' },
};

// ── Importance labels ──

export const IMPORTANCE_META: Record<string, { label: string; color: string }> = {
  high: { label: 'גבוהה', color: '#EF4444' },
  medium: { label: 'בינונית', color: '#F59E0B' },
  low: { label: 'נמוכה', color: '#6B7280' },
};

// ── Format strategy summary (for command center / cards) ──

export function formatStrategySummary(strategy: FullStrategy): StrategySummary {
  const topActions = strategy.actionPlan
    .filter(a => a.status === 'proposed')
    .slice(0, 3);

  const problemCount = strategy.sections.keyProblems.items.length;
  const opportunityCount = strategy.sections.opportunities.items.length;

  let headline = '';
  if (strategy.decisions.length === 0) {
    headline = 'אין מספיק נתונים לבניית אסטרטגיה';
  } else {
    const topDecision = strategy.decisions[0];
    headline = topDecision.title;
  }

  return {
    clientId: strategy.clientId,
    clientName: strategy.clientName,
    headline,
    confidence: strategy.overallConfidence,
    urgency: strategy.overallUrgency,
    problemCount,
    opportunityCount,
    actionCount: strategy.actionPlan.length,
    topActions: topActions.map(a => a.title),
    generatedAt: strategy.generatedAt,
    dataQuality: strategy.dataQuality,
  };
}

export interface StrategySummary {
  clientId: string;
  clientName: string;
  headline: string;
  confidence: number;
  urgency: UrgencyLevel;
  problemCount: number;
  opportunityCount: number;
  actionCount: number;
  topActions: string[];
  generatedAt: string;
  dataQuality: string;
}

// ── Format for client-facing view (simplified) ──

export function formatClientView(strategy: FullStrategy): ClientStrategyView {
  const situation = strategy.sections.currentSituation.summary;
  const direction = strategy.sections.strategicDirection.summary;
  const actions = strategy.actionPlan
    .filter(a => a.priority <= 2)
    .slice(0, 5)
    .map(a => a.title);

  const outcomes = strategy.sections.expectedOutcomes.items.map(i => i.text);

  return {
    clientName: strategy.clientName,
    situationSummary: situation,
    directionSummary: direction,
    nextSteps: actions,
    expectedResults: outcomes,
    confidence: strategy.overallConfidence,
    generatedAt: strategy.generatedAt,
  };
}

export interface ClientStrategyView {
  clientName: string;
  situationSummary: string;
  directionSummary: string;
  nextSteps: string[];
  expectedResults: string[];
  confidence: number;
  generatedAt: string;
}
