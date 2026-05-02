/**
 * Autopilot — Autonomous Growth System
 *
 * Barrel export for all autopilot modules.
 */

export * from './types';
export { runAutopilotLoop, getAutopilotDashboardData, getClientAutopilotData, updateAutopilotAction, upsertAutopilotSettings } from './autonomous-loop';
export { generateAutopilotActions, type DiagnosticResult } from './action-generator';
export { checkSafety, SAFETY_LIMITS } from './safety';
export { logActivity, ACTIVITY_TYPE_META, type LogActivityInput } from './activity-log';
