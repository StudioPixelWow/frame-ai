// Knowledge Layer — barrel export
export { extractAllKnowledge, EXTRACTION_THRESHOLDS } from './extraction-rules';
export type { RawKnowledge, ExtractionContext } from './extraction-rules';

export { runKnowledgeExtraction, getKnowledgeDashboardData } from './knowledge-engine';
export type { KnowledgeExtractionOptions, KnowledgeExtractionResult } from './knowledge-engine';

export { buildPlaybookForIndustry, getPlaybookSummary, PLAYBOOK_SECTION_META } from './industry-playbook';
export type { PlaybookSummary } from './industry-playbook';

export { findSimilarClients, getKnowledgeSuggestions } from './client-similarity';
export type { ClientSimilarityResult, SimilarClient, KnowledgeSuggestion } from './client-similarity';

export { applyDecay, effectiveConfidence, isItemActive, getFreshnessInfo, getConfidenceInfo, DECAY_CONFIG, KNOWLEDGE_TYPE_META } from './confidence-decay';
export type { FreshnessInfo, ConfidenceInfo } from './confidence-decay';
