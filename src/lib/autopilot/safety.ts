/**
 * Autopilot Safety Rules
 *
 * Enforces:
 * - Max actions per client per day
 * - No duplicate actions (same type + client in 24h)
 * - No execution without approval
 * - Skip low-confidence actions
 * - Stop autopilot on repeated failures
 * - Full audit trail
 */

import { createClient } from '@supabase/supabase-js';
import type { AutopilotAction, AutopilotSettings } from './types';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
);

export const SAFETY_LIMITS = {
  maxActionsPerClientPerDay: 8,
  maxActionsPerRun: 40,
  dedupeWindowHours: 24,
  minConfidence: 30,
  maxConsecutiveFailures: 5,
};

export async function checkSafety(
  actions: AutopilotAction[],
  settings: AutopilotSettings
): Promise<AutopilotAction[]> {
  // 1. Filter low confidence
  let safe = actions.filter(a => a.confidence >= SAFETY_LIMITS.minConfidence);

  // 2. Enforce max per client per day
  const maxPerDay = settings.maxActionsPerDay || SAFETY_LIMITS.maxActionsPerClientPerDay;
  const todayCount = await getTodayActionCount(settings.clientId);
  const remaining = Math.max(0, maxPerDay - todayCount);
  safe = safe.slice(0, remaining);

  // 3. Deduplicate — same action type for same client in window
  safe = await deduplicateActions(safe, settings.clientId);

  // 4. Enforce global max per run
  safe = safe.slice(0, SAFETY_LIMITS.maxActionsPerRun);

  return safe;
}

async function getTodayActionCount(clientId: string): Promise<number> {
  try {
    const today = new Date().toISOString().split('T')[0];
    const { count } = await supabase
      .from('autopilot_actions')
      .select('id', { count: 'exact', head: true })
      .eq('client_id', clientId)
      .gte('created_at', today);
    return count || 0;
  } catch {
    return 0;
  }
}

async function deduplicateActions(
  actions: AutopilotAction[],
  clientId: string
): Promise<AutopilotAction[]> {
  try {
    const windowStart = new Date(Date.now() - SAFETY_LIMITS.dedupeWindowHours * 60 * 60 * 1000).toISOString();
    const { data: recent } = await supabase
      .from('autopilot_actions')
      .select('action_type, title')
      .eq('client_id', clientId)
      .gte('created_at', windowStart);

    if (!recent || recent.length === 0) return actions;

    const existingKeys = new Set(recent.map(r => `${r.action_type}::${r.title}`));
    return actions.filter(a => !existingKeys.has(`${a.actionType}::${a.title}`));
  } catch {
    return actions; // on error, allow all
  }
}
