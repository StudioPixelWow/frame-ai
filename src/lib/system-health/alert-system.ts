/**
 * Alert System
 *
 * Triggers alerts for:
 * - Repeated failures
 * - System errors
 * - Broken sync
 * - High-risk clients
 * - Autopilot shutdown
 * - Governance violations
 *
 * Alerts are stored and displayed in dashboard + notification center.
 */

import { createClient } from '@supabase/supabase-js';
import type { AlertType, ErrorSeverity, ErrorSource, SystemAlert } from './types';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
);

// ── Create Alert ──

export interface CreateAlertInput {
  type: AlertType;
  title: string;
  message: string;
  severity: ErrorSeverity;
  source: ErrorSource;
  clientId?: string;
}

export async function createAlert(input: CreateAlertInput): Promise<string | null> {
  try {
    // Deduplicate — don't create same alert type within 1 hour
    const h1 = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { count } = await supabase.from('system_alerts')
      .select('id', { count: 'exact', head: true })
      .eq('type', input.type)
      .eq('acknowledged', false)
      .gte('created_at', h1);

    if ((count || 0) > 0) return null; // already alerted

    const id = `alt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    await supabase.from('system_alerts').insert({
      id,
      type: input.type,
      title: input.title,
      message: input.message,
      severity: input.severity,
      source: input.source,
      client_id: input.clientId || null,
      acknowledged: false,
      created_at: new Date().toISOString(),
    });
    return id;
  } catch {
    return null;
  }
}

// ── Acknowledge Alert ──

export async function acknowledgeAlert(alertId: string, by: string = 'admin'): Promise<boolean> {
  try {
    await supabase.from('system_alerts').update({
      acknowledged: true,
      acknowledged_at: new Date().toISOString(),
      acknowledged_by: by,
    }).eq('id', alertId);
    return true;
  } catch {
    return false;
  }
}

// ── Acknowledge All ──

export async function acknowledgeAllAlerts(by: string = 'admin'): Promise<number> {
  try {
    const { data } = await supabase.from('system_alerts')
      .update({ acknowledged: true, acknowledged_at: new Date().toISOString(), acknowledged_by: by })
      .eq('acknowledged', false)
      .select('id');
    return data?.length || 0;
  } catch {
    return 0;
  }
}

// ── Get Active Alerts ──

export async function getActiveAlerts(options?: { source?: ErrorSource; severity?: ErrorSeverity; limit?: number }): Promise<SystemAlert[]> {
  try {
    let query = supabase.from('system_alerts')
      .select('*')
      .eq('acknowledged', false)
      .order('created_at', { ascending: false });
    if (options?.source) query = query.eq('source', options.source);
    if (options?.severity) query = query.eq('severity', options.severity);
    query = query.limit(options?.limit || 30);

    const { data } = await query;
    return (data || []).map(row => ({
      id: row.id,
      type: row.type || '',
      title: row.title || '',
      message: row.message || '',
      severity: row.severity || 'low',
      source: row.source || 'system',
      clientId: row.client_id || null,
      acknowledged: row.acknowledged ?? false,
      acknowledgedAt: row.acknowledged_at || null,
      acknowledgedBy: row.acknowledged_by || null,
      createdAt: row.created_at || '',
    }));
  } catch {
    return [];
  }
}
