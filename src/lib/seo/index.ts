/**
 * PIXEL SEO/GEO — Main Export Barrel
 *
 * All engines, services, and types for the SEO/GEO system.
 */

// Core data layer
export * from './gsc-api';
export * from './serp-api';
export * from './crawler';

// Analysis engines
export * from './gap-analysis';
export * from './why-engine';
export * from './plan-generator';

// Infrastructure
export * from './scan-orchestrator';
export * from './scan-logs';
export * from './validation-gate';

// Existing modules
export * from './website-facts';
export * from './platform-apis';
// Note: scan-pipeline re-exports omit PlatformId and ScanLogEntry to avoid duplicates with platform-apis and scan-logs
export { PLATFORMS, getScanConfig, getJob, getAllJobs, parseHtml, startScan } from './scan-pipeline';
export type { ScanType, PlatformStatus, ScanStageId, StageProgress, ScanValidation, ScanMetrics, ScanJob, ParsedPage, ScannedPageInfo, ScanIssue, AIQueryResult, Competitor, ScanResult } from './scan-pipeline';
export * from './visibility-engine';
export * from './translations';
