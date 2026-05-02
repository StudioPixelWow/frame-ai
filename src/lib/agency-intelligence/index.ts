/**
 * Agency Intelligence — Barrel Export
 *
 * Internal intelligence layer:
 * - Calibration: performance thresholds, scaling rules
 * - Playbooks: industry-specific strategy (hooks, CTAs, angles)
 * - Templates: reusable campaign/ad/content structures
 * - Injection: combine all for Campaign Builder, Gantt, Podcast, Strategy
 * - Learning: auto-suggest playbook updates from performance data
 */

// Types
export type {
  AgencyCalibration,
  ScalingRule,
  AgencyPlaybook,
  PlaybookHook,
  PlaybookCTA,
  CampaignTemplate,
  AdSetPreset,
  AdTemplate,
  ContentTemplate,
  PlaybookInjection,
  LearningSuggestion,
} from './types';

// Calibration
export {
  DEFAULT_CALIBRATION,
  getCalibration,
  saveCalibration,
  evaluatePerformance,
} from './calibration';
export type { PerformanceEvaluation } from './calibration';

// Playbooks
export {
  DEFAULT_PLAYBOOKS,
  getPlaybooks,
  getPlaybook,
  savePlaybook,
  seedDefaultPlaybooks,
} from './playbooks';

// Templates
export {
  DEFAULT_CAMPAIGN_TEMPLATES,
  DEFAULT_AD_TEMPLATES,
  DEFAULT_CONTENT_TEMPLATES,
  getCampaignTemplates,
  saveCampaignTemplate,
  getAdTemplates,
  saveAdTemplate,
  getContentTemplates,
  saveContentTemplate,
  seedDefaultTemplates,
} from './templates';

// Playbook Injection
export {
  getPlaybookInjection,
  injectForCampaignBuilder,
  injectForGantt,
  injectForPodcast,
  injectForStrategy,
} from './playbook-injection';

// Learning Loop
export {
  analyzeAndSuggest,
  getSuggestions,
  updateSuggestionStatus,
} from './learning-loop';
