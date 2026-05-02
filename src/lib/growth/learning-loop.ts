/**
 * Growth Learning Loop
 *
 * Tracks outcomes of growth actions:
 * - What was the state before the action?
 * - What changed after execution?
 * - Was the outcome positive, negative, or neutral?
 *
 * Uses this data to improve future recommendations.
 * All deterministic — no AI API calls.
 */

import { growthActions, growthActionResults } from '@/lib/db';
import type { GrowthAction, GrowthActionResult, GrowthActionOutcome } from '@/lib/db/schema';

// ── Record a result ──

export interface RecordResultInput {
  actionId: string;
  beforeMetrics: Record<string, number>;
  afterMetrics: Record<string, number>;
  notes?: string;
}

export async function recordActionResult(input: RecordResultInput): Promise<GrowthActionResult> {
  const action = await growthActions.getByIdAsync(input.actionId);
  if (!action) throw new Error('Action not found');

  const outcome = evaluateOutcome(input.beforeMetrics, input.afterMetrics);
  const impactSummary = buildImpactSummary(input.beforeMetrics, input.afterMetrics, outcome);

  const result: GrowthActionResult = {
    id: `gar_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    actionId: input.actionId,
    clientId: action.clientId,
    beforeMetrics: input.beforeMetrics,
    afterMetrics: input.afterMetrics,
    outcome,
    impactSummary,
    notes: input.notes || '',
    measuredAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
  };

  await growthActionResults.createAsync(result);
  return result;
}

// ── Evaluate outcome ──

function evaluateOutcome(
  before: Record<string, number>,
  after: Record<string, number>,
): GrowthActionOutcome {
  // Compare key metrics
  const cplBefore = before.cpl || 0;
  const cplAfter = after.cpl || 0;
  const leadsBefore = before.leads || 0;
  const leadsAfter = after.leads || 0;
  const ctrBefore = before.ctr || 0;
  const ctrAfter = after.ctr || 0;

  // Check if we have enough data
  if (cplAfter === 0 && leadsAfter === 0 && ctrAfter === 0) return 'too_early';

  let positiveSignals = 0;
  let negativeSignals = 0;

  // CPL improved (lower is better)
  if (cplBefore > 0 && cplAfter > 0) {
    if (cplAfter < cplBefore * 0.9) positiveSignals++;
    if (cplAfter > cplBefore * 1.1) negativeSignals++;
  }

  // Leads improved (higher is better)
  if (leadsBefore > 0) {
    if (leadsAfter > leadsBefore * 1.1) positiveSignals++;
    if (leadsAfter < leadsBefore * 0.9) negativeSignals++;
  }

  // CTR improved (higher is better)
  if (ctrBefore > 0) {
    if (ctrAfter > ctrBefore * 1.1) positiveSignals++;
    if (ctrAfter < ctrBefore * 0.9) negativeSignals++;
  }

  if (positiveSignals > negativeSignals) return 'improved';
  if (negativeSignals > positiveSignals) return 'declined';
  return 'no_change';
}

// ── Impact summary ──

function buildImpactSummary(
  before: Record<string, number>,
  after: Record<string, number>,
  outcome: GrowthActionOutcome,
): string {
  const parts: string[] = [];

  if (outcome === 'too_early') return 'עדיין מוקדם מדי למדוד תוצאות';

  if (before.cpl && after.cpl) {
    const change = ((after.cpl - before.cpl) / before.cpl) * 100;
    parts.push(`CPL: ₪${before.cpl.toFixed(0)} → ₪${after.cpl.toFixed(0)} (${change > 0 ? '+' : ''}${change.toFixed(0)}%)`);
  }

  if (before.leads !== undefined && after.leads !== undefined) {
    parts.push(`לידים: ${before.leads} → ${after.leads}`);
  }

  if (before.ctr && after.ctr) {
    parts.push(`CTR: ${before.ctr.toFixed(2)}% → ${after.ctr.toFixed(2)}%`);
  }

  if (parts.length === 0) return outcome === 'improved' ? 'שיפור' : outcome === 'declined' ? 'ירידה' : 'ללא שינוי';
  return parts.join(' | ');
}

// ── Get learning data ──

export async function getLearningData(clientId?: string) {
  const allResults = await growthActionResults.getAllAsync() || [];
  const allActions = await growthActions.getAllAsync() || [];

  const results = clientId ? allResults.filter(r => r.clientId === clientId) : allResults;

  const improved = results.filter(r => r.outcome === 'improved').length;
  const declined = results.filter(r => r.outcome === 'declined').length;
  const noChange = results.filter(r => r.outcome === 'no_change').length;
  const tooEarly = results.filter(r => r.outcome === 'too_early').length;

  // Action type success rates
  const actionTypeStats: Record<string, { total: number; improved: number; declined: number }> = {};
  for (const result of results) {
    const action = allActions.find(a => a.id === result.actionId);
    if (!action) continue;
    const type = action.actionType;
    if (!actionTypeStats[type]) actionTypeStats[type] = { total: 0, improved: 0, declined: 0 };
    actionTypeStats[type].total++;
    if (result.outcome === 'improved') actionTypeStats[type].improved++;
    if (result.outcome === 'declined') actionTypeStats[type].declined++;
  }

  return {
    totalResults: results.length,
    outcomes: { improved, declined, noChange, tooEarly },
    successRate: results.length > 0 ? Math.round((improved / results.length) * 100) : 0,
    actionTypeStats,
    recentResults: results
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 20),
  };
}

// ── Outcome labels ──

export const OUTCOME_META: Record<GrowthActionOutcome, { label: string; color: string; icon: string }> = {
  improved: { label: 'השתפר', color: '#22c55e', icon: '📈' },
  no_change: { label: 'ללא שינוי', color: '#6b7280', icon: '➡️' },
  declined: { label: 'ירד', color: '#ef4444', icon: '📉' },
  too_early: { label: 'מוקדם למדוד', color: '#f59e0b', icon: '⏳' },
  unknown: { label: 'לא ידוע', color: '#9ca3af', icon: '❓' },
};
