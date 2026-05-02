/**
 * Strategy Learning Loop
 *
 * Tracks strategy outcomes:
 * - accepted vs rejected decisions
 * - executed vs skipped actions
 * - performance changes after execution
 *
 * Used to improve future strategy confidence scores.
 * No AI API calls. All tracking is deterministic.
 */

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
);

// ── Types ──

export type StrategyOutcome = 'accepted' | 'rejected' | 'executed' | 'ignored';

export interface StrategyResult {
  id?: string;
  strategyId: string;
  actionId: string;
  actionType: string;
  outcome: StrategyOutcome;
  notes: string;
  performanceBefore: Record<string, number>;
  performanceAfter: Record<string, number>;
  createdAt: string;
}

// ── Record a result ──

export async function recordStrategyResult(input: {
  strategyId: string;
  actionId: string;
  actionType: string;
  outcome: StrategyOutcome;
  notes?: string;
  performanceBefore?: Record<string, number>;
  performanceAfter?: Record<string, number>;
}): Promise<boolean> {
  try {
    await supabase.from('strategy_results').insert({
      strategy_id: input.strategyId,
      action_id: input.actionId,
      action_type: input.actionType,
      outcome: input.outcome,
      notes: input.notes || '',
      performance_before: input.performanceBefore || {},
      performance_after: input.performanceAfter || {},
      created_at: new Date().toISOString(),
    });
    return true;
  } catch (err) {
    console.error('[strategy-learning] record error:', (err as Error).message);
    return false;
  }
}

// ── Get learning data ──

export async function getLearningData(clientId?: string) {
  let query = supabase
    .from('strategy_results')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(200);

  const { data } = await query;
  const results = (data || []) as any[];

  // If clientId filter, load strategies to find matching ones
  let filtered = results;
  if (clientId) {
    const { data: strategies } = await supabase
      .from('strategic_plans')
      .select('id')
      .eq('client_id', clientId);
    const strategyIds = new Set((strategies || []).map((s: any) => s.id));
    filtered = results.filter(r => strategyIds.has(r.strategy_id));
  }

  // Aggregate
  const total = filtered.length;
  const accepted = filtered.filter(r => r.outcome === 'accepted').length;
  const rejected = filtered.filter(r => r.outcome === 'rejected').length;
  const executed = filtered.filter(r => r.outcome === 'executed').length;
  const ignored = filtered.filter(r => r.outcome === 'ignored').length;

  // Per action type stats
  const byType: Record<string, { total: number; accepted: number; executed: number }> = {};
  for (const r of filtered) {
    const t = r.action_type || 'unknown';
    if (!byType[t]) byType[t] = { total: 0, accepted: 0, executed: 0 };
    byType[t].total++;
    if (r.outcome === 'accepted') byType[t].accepted++;
    if (r.outcome === 'executed') byType[t].executed++;
  }

  return {
    total,
    accepted,
    rejected,
    executed,
    ignored,
    acceptanceRate: total > 0 ? Math.round((accepted / total) * 100) : 0,
    executionRate: total > 0 ? Math.round((executed / total) * 100) : 0,
    byType,
    recentResults: filtered.slice(0, 20),
  };
}

// ── Display metadata ──

export const OUTCOME_META: Record<StrategyOutcome, { label: string; color: string; icon: string }> = {
  accepted: { label: 'אושר', color: '#10B981', icon: '✅' },
  rejected: { label: 'נדחה', color: '#EF4444', icon: '❌' },
  executed: { label: 'בוצע', color: '#3B82F6', icon: '🔵' },
  ignored: { label: 'לא טופל', color: '#6B7280', icon: '⬜' },
};
