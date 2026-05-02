/**
 * Admin Control Panel
 *
 * Provides:
 * - Pause/resume autopilot globally or per client
 * - Retry failed actions
 * - Retry failed syncs
 * - Resolve errors
 * - System-wide controls
 */

import { createClient } from '@supabase/supabase-js';
import { trackError } from './error-tracker';
import { createAlert } from './alert-system';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
);

// ── Pause Autopilot Globally ──

export async function pauseAutopilotGlobally(): Promise<{ affected: number }> {
  try {
    const { data } = await supabase.from('autopilot_settings')
      .update({ is_paused: true, updated_at: new Date().toISOString() })
      .eq('is_active', true)
      .eq('is_paused', false)
      .select('id');

    await createAlert({
      type: 'autopilot_shutdown',
      title: 'אוטופיילוט הופסק גלובלית',
      message: `מנהל השהה את כל האוטופיילוטים (${data?.length || 0} לקוחות)`,
      severity: 'medium',
      source: 'autopilot',
    });

    return { affected: data?.length || 0 };
  } catch {
    return { affected: 0 };
  }
}

// ── Resume Autopilot Globally ──

export async function resumeAutopilotGlobally(): Promise<{ affected: number }> {
  try {
    const { data } = await supabase.from('autopilot_settings')
      .update({ is_paused: false, updated_at: new Date().toISOString() })
      .eq('is_paused', true)
      .select('id');
    return { affected: data?.length || 0 };
  } catch {
    return { affected: 0 };
  }
}

// ── Pause/Resume Per Client ──

export async function pauseAutopilotForClient(clientId: string): Promise<boolean> {
  try {
    await supabase.from('autopilot_settings')
      .update({ is_paused: true, updated_at: new Date().toISOString() })
      .eq('client_id', clientId);
    return true;
  } catch {
    return false;
  }
}

export async function resumeAutopilotForClient(clientId: string): Promise<boolean> {
  try {
    await supabase.from('autopilot_settings')
      .update({ is_paused: false, consecutive_failures: 0, updated_at: new Date().toISOString() })
      .eq('client_id', clientId);
    return true;
  } catch {
    return false;
  }
}

// ── Retry Failed Actions ──

export async function retryFailedActions(clientId?: string): Promise<{ retried: number }> {
  try {
    let query = supabase.from('autopilot_actions')
      .update({ status: 'pending_approval', failed_reason: null, updated_at: new Date().toISOString() })
      .eq('status', 'failed');
    if (clientId) query = query.eq('client_id', clientId);

    const { data } = await query.select('id');
    return { retried: data?.length || 0 };
  } catch {
    return { retried: 0 };
  }
}

// ── Reset Consecutive Failures ──

export async function resetClientFailures(clientId: string): Promise<boolean> {
  try {
    await supabase.from('autopilot_settings')
      .update({ consecutive_failures: 0, is_paused: false, updated_at: new Date().toISOString() })
      .eq('client_id', clientId);
    return true;
  } catch {
    return false;
  }
}

// ── Get Admin Summary ──

export async function getAdminSummary(): Promise<{
  autopilotActive: number;
  autopilotPaused: number;
  failedActions: number;
  unresolvedErrors: number;
  activeAlerts: number;
}> {
  try {
    const [
      { count: active },
      { count: paused },
      { count: failed },
      { count: unresolved },
      { count: alerts },
    ] = await Promise.all([
      supabase.from('autopilot_settings').select('id', { count: 'exact', head: true }).eq('is_active', true).eq('is_paused', false),
      supabase.from('autopilot_settings').select('id', { count: 'exact', head: true }).eq('is_paused', true),
      supabase.from('autopilot_actions').select('id', { count: 'exact', head: true }).eq('status', 'failed'),
      supabase.from('system_errors').select('id', { count: 'exact', head: true }).eq('resolved', false),
      supabase.from('system_alerts').select('id', { count: 'exact', head: true }).eq('acknowledged', false),
    ]);
    return {
      autopilotActive: active || 0,
      autopilotPaused: paused || 0,
      failedActions: failed || 0,
      unresolvedErrors: unresolved || 0,
      activeAlerts: alerts || 0,
    };
  } catch {
    return { autopilotActive: 0, autopilotPaused: 0, failedActions: 0, unresolvedErrors: 0, activeAlerts: 0 };
  }
}
