/**
 * Strategic Engine — Main Orchestrator
 *
 * Flow:
 * 1. Build strategic context (all client data)
 * 2. Generate decisions (rule-based analysis)
 * 3. Build full strategy document
 * 4. Persist to DB
 * 5. Return structured output
 *
 * No AI API calls. Fully deterministic.
 */

import { createClient } from '@supabase/supabase-js';
import { buildStrategicContext, buildAllClientsContext } from './strategic-context';
import { generateDecisions } from './strategic-decisions';
import { generateFullStrategy, type FullStrategy } from './strategy-generator';
import { formatStrategySummary, type StrategySummary } from './strategy-formatter';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
);

// ── Types ──

export interface StrategyGenerationOptions {
  clientId?: string;     // single client, or all if omitted
  triggeredBy: string;   // 'manual' | 'scheduled' | 'growth_run'
}

export interface StrategyGenerationResult {
  status: 'completed' | 'failed' | 'insufficient_data';
  strategies: FullStrategy[];
  summaries: StrategySummary[];
  totalDecisions: number;
  totalActions: number;
  errors: string[];
  durationMs: number;
}

// ── Main strategy generation ──

export async function generateStrategy(
  options: StrategyGenerationOptions
): Promise<StrategyGenerationResult> {
  const startTime = Date.now();
  const errors: string[] = [];
  const strategies: FullStrategy[] = [];

  try {
    // Build context
    let contexts;
    if (options.clientId) {
      const ctx = await buildStrategicContext(options.clientId);
      contexts = ctx ? [ctx] : [];
    } else {
      contexts = await buildAllClientsContext();
    }

    if (contexts.length === 0) {
      return {
        status: 'insufficient_data',
        strategies: [],
        summaries: [],
        totalDecisions: 0,
        totalActions: 0,
        errors: ['אין נתוני לקוחות להפקת אסטרטגיה'],
        durationMs: Date.now() - startTime,
      };
    }

    // Generate strategy per client
    for (const ctx of contexts) {
      try {
        if (ctx.dataQuality === 'insufficient') {
          errors.push(`${ctx.client.name}: אין מספיק נתונים`);
          continue;
        }

        const decisions = generateDecisions(ctx);
        const strategy = generateFullStrategy(ctx, decisions);
        strategies.push(strategy);

        // Persist
        await persistStrategy(strategy);
      } catch (err) {
        errors.push(`${ctx.client.name}: ${(err as Error).message}`);
      }
    }

    const summaries = strategies.map(s => formatStrategySummary(s));
    const totalDecisions = strategies.reduce((s, st) => s + st.decisions.length, 0);
    const totalActions = strategies.reduce((s, st) => s + st.actionPlan.length, 0);

    return {
      status: strategies.length > 0 ? 'completed' : 'insufficient_data',
      strategies,
      summaries,
      totalDecisions,
      totalActions,
      errors,
      durationMs: Date.now() - startTime,
    };
  } catch (err) {
    return {
      status: 'failed',
      strategies: [],
      summaries: [],
      totalDecisions: 0,
      totalActions: 0,
      errors: [`Fatal strategy error: ${(err as Error).message}`],
      durationMs: Date.now() - startTime,
    };
  }
}

// ── Dashboard data ──

export async function getStrategyDashboardData(clientId?: string) {
  const { data: strategiesData } = await supabase
    .from('strategic_plans')
    .select('*')
    .order('created_at', { ascending: false });

  const allStrategies: FullStrategy[] = (strategiesData || []).map((row: any) => ({
    id: row.id,
    clientId: row.client_id,
    clientName: row.client_name,
    generatedAt: row.created_at,
    dataQuality: row.data_quality || 'moderate',
    sections: row.sections || {},
    decisions: row.decisions || [],
    actionPlan: row.action_plan || [],
    overallConfidence: row.overall_confidence || 0,
    overallUrgency: row.overall_urgency || 'low',
  }));

  const filtered = clientId
    ? allStrategies.filter(s => s.clientId === clientId)
    : allStrategies;

  // Latest per client
  const latestByClient: Record<string, FullStrategy> = {};
  for (const s of filtered) {
    if (!latestByClient[s.clientId] || new Date(s.generatedAt) > new Date(latestByClient[s.clientId].generatedAt)) {
      latestByClient[s.clientId] = s;
    }
  }

  const latest = Object.values(latestByClient);
  const summaries = latest.map(s => formatStrategySummary(s));

  // Cross-client top actions
  const allActions = latest.flatMap(s =>
    s.actionPlan
      .filter(a => a.status === 'proposed')
      .map(a => ({ ...a, clientName: s.clientName, clientId: s.clientId }))
  );
  allActions.sort((a, b) => a.priority - b.priority);

  // KPIs
  const totalStrategies = latest.length;
  const avgConfidence = totalStrategies > 0
    ? Math.round(latest.reduce((s, st) => s + st.overallConfidence, 0) / totalStrategies)
    : 0;
  const totalDecisions = latest.reduce((s, st) => s + st.decisions.length, 0);
  const pendingActions = allActions.filter(a => a.status === 'proposed').length;
  const criticalCount = latest.filter(s => s.overallUrgency === 'critical').length;

  // Learning data
  const { data: learningData } = await supabase
    .from('strategy_results')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(50);

  const results = learningData || [];
  const accepted = results.filter((r: any) => r.outcome === 'accepted').length;
  const rejected = results.filter((r: any) => r.outcome === 'rejected').length;
  const executed = results.filter((r: any) => r.outcome === 'executed').length;

  return {
    kpis: {
      totalStrategies,
      avgConfidence,
      totalDecisions,
      pendingActions,
      criticalCount,
    },
    summaries,
    strategies: latest,
    topActions: allActions.slice(0, 10),
    learning: {
      total: results.length,
      accepted,
      rejected,
      executed,
      acceptanceRate: results.length > 0 ? Math.round((accepted / results.length) * 100) : 0,
    },
  };
}

// ── Persistence ──

async function persistStrategy(strategy: FullStrategy): Promise<void> {
  try {
    await supabase.from('strategic_plans').upsert({
      id: strategy.id,
      client_id: strategy.clientId,
      client_name: strategy.clientName,
      data_quality: strategy.dataQuality,
      sections: strategy.sections,
      decisions: strategy.decisions,
      action_plan: strategy.actionPlan,
      overall_confidence: strategy.overallConfidence,
      overall_urgency: strategy.overallUrgency,
      created_at: strategy.generatedAt,
    });
  } catch (err) {
    console.error('[strategy] persist error:', (err as Error).message);
  }
}

// ── Action updates ──

export async function updateActionStatus(
  strategyId: string,
  actionId: string,
  newStatus: 'approved' | 'rejected' | 'executed',
): Promise<boolean> {
  try {
    // Load strategy
    const { data } = await supabase.from('strategic_plans').select('*').eq('id', strategyId).single();
    if (!data) return false;

    const actionPlan = (data.action_plan || []).map((a: any) =>
      a.id === actionId ? { ...a, status: newStatus } : a
    );

    await supabase.from('strategic_plans').update({ action_plan: actionPlan }).eq('id', strategyId);

    // Record for learning
    const action = actionPlan.find((a: any) => a.id === actionId);
    if (action) {
      await supabase.from('strategy_results').insert({
        strategy_id: strategyId,
        action_id: actionId,
        action_type: action.type,
        outcome: newStatus === 'approved' ? 'accepted' : newStatus === 'rejected' ? 'rejected' : 'executed',
        created_at: new Date().toISOString(),
      });
    }

    return true;
  } catch (err) {
    console.error('[strategy] updateAction error:', (err as Error).message);
    return false;
  }
}
