// Strategy Layer — barrel export
export { buildStrategicContext, buildAllClientsContext } from './strategic-context';
export type { StrategicContext, ClientSnapshot, CampaignSnapshot, PerformanceSnapshot, LeadSnapshot } from './strategic-context';

export { generateDecisions, DECISION_TYPE_META, URGENCY_META, IMPACT_META } from './strategic-decisions';
export type { StrategicDecision, StrategicDecisionType, UrgencyLevel, ImpactLevel, SuggestedAction } from './strategic-decisions';

export { generateFullStrategy } from './strategy-generator';
export type { FullStrategy, StrategySections, StrategySection, ActionPlanItem } from './strategy-generator';

export { formatStrategySummary, formatClientView, SECTION_META, ACTION_STATUS_META, DATA_QUALITY_META, IMPORTANCE_META } from './strategy-formatter';
export type { StrategySummary, ClientStrategyView } from './strategy-formatter';

export { generateStrategy, getStrategyDashboardData, updateActionStatus } from './strategic-engine';
export type { StrategyGenerationOptions, StrategyGenerationResult } from './strategic-engine';

export { recordStrategyResult, getLearningData, OUTCOME_META } from './learning-loop';
export type { StrategyResult, StrategyOutcome } from './learning-loop';
