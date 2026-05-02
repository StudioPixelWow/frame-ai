/**
 * Error Tracking System
 *
 * Structured error logging with:
 * - Source classification (API/campaign/sync/autopilot/action/db/validation/system)
 * - Severity levels (low/medium/high/critical)
 * - Related entity tracking
 * - Auto-alert generation for critical/repeated errors
 * - Resolution tracking
 */

import { createClient } from '@supabase/supabase-js';
import type { ErrorSeverity, ErrorSource, SystemError, AlertType } from './types';
import { createAlert } from './alert-system';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
);

// ── Track Error ──

export interface TrackErrorInput {
  type: string;
  source: ErrorSource;
  message: string;
  stack?: string;
  severity: ErrorSeverity;
  clientId?: string;
  relatedEntityType?: string;
  relatedEntityId?: string;
}

export async function trackError(input: TrackErrorInput): Promise<string | null> {
  try {
    const id = `err_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    await supabase.from('system_errors').insert({
      id,
      type: input.type,
      source: input.source,
      message: input.message,
      stack: input.stack || null,
      severity: input.severity,
      client_id: input.clientId || null,
      related_entity_type: input.relatedEntityType || null,
      related_entity_id: input.relatedEntityId || null,
      resolved: false,
      created_at: new Date().toISOString(),
    });

    // Auto-generate alert for critical errors
    if (input.severity === 'critical') {
      await createAlert({
        type: 'system_error',
        title: `שגיאה קריטית: ${input.type}`,
        message: input.message,
        severity: 'critical',
        source: input.source,
        clientId: input.clientId,
      });
    }

    // Check for repeated failures — alert if >5 from same source in 1h
    await checkRepeatedFailures(input.source);

    return id;
  } catch {
    // Don't throw — error tracking itself must never crash the system
    return null;
  }
}

// ── Resolve Error ──

export async function resolveError(errorId: string, resolvedBy: string = 'admin'): Promise<boolean> {
  try {
    await supabase.from('system_errors').update({
      resolved: true,
      resolved_at: new Date().toISOString(),
      resolved_by: resolvedBy,
    }).eq('id', errorId);
    return true;
  } catch {
    return false;
  }
}

// ── Resolve All by Source ──

export async function resolveAllBySource(source: ErrorSource): Promise<number> {
  try {
    const { data } = await supabase.from('system_errors')
      .update({ resolved: true, resolved_at: new Date().toISOString(), resolved_by: 'admin' })
      .eq('source', source)
      .eq('resolved', false)
      .select('id');
    return data?.length || 0;
  } catch {
    return 0;
  }
}

// ── Get Errors ──

export async function getErrors(options?: {
  source?: ErrorSource;
  severity?: ErrorSeverity;
  resolved?: boolean;
  clientId?: string;
  limit?: number;
}): Promise<SystemError[]> {
  try {
    let query = supabase.from('system_errors').select('*').order('created_at', { ascending: false });
    if (options?.source) query = query.eq('source', options.source);
    if (options?.severity) query = query.eq('severity', options.severity);
    if (options?.resolved !== undefined) query = query.eq('resolved', options.resolved);
    if (options?.clientId) query = query.eq('client_id', options.clientId);
    query = query.limit(options?.limit || 50);

    const { data } = await query;
    return (data || []).map(row => ({
      id: row.id,
      type: row.type || '',
      source: row.source || 'system',
      message: row.message || '',
      stack: row.stack || null,
      severity: row.severity || 'low',
      clientId: row.client_id || null,
      relatedEntityType: row.related_entity_type || null,
      relatedEntityId: row.related_entity_id || null,
      resolved: row.resolved ?? false,
      resolvedAt: row.resolved_at || null,
      resolvedBy: row.resolved_by || null,
      createdAt: row.created_at || '',
    }));
  } catch {
    return [];
  }
}

// ── Repeated Failure Detection ──

async function checkRepeatedFailures(source: ErrorSource): Promise<void> {
  try {
    const h1 = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { count } = await supabase.from('system_errors')
      .select('id', { count: 'exact', head: true })
      .eq('source', source)
      .gte('created_at', h1);

    if ((count || 0) >= 5) {
      await createAlert({
        type: 'repeated_failures',
        title: `כישלונות חוזרים: ${source}`,
        message: `${count} שגיאות ממקור ${source} בשעה האחרונה`,
        severity: 'high',
        source,
      });
    }
  } catch {
    // silent
  }
}

// ── Track Action Failure ──

export async function trackActionFailure(
  actionId: string,
  actionType: string,
  reason: string,
  clientId?: string
): Promise<void> {
  await trackError({
    type: 'action_failure',
    source: 'action',
    message: `פעולה נכשלה: ${actionType} — ${reason}`,
    severity: 'medium',
    clientId,
    relatedEntityType: 'action',
    relatedEntityId: actionId,
  });
}

// ── Track Sync Failure ──

export async function trackSyncFailure(
  platform: string,
  reason: string,
  clientId?: string
): Promise<void> {
  // Classify sync failure reason
  let details = reason;
  if (reason.includes('token') || reason.includes('auth')) {
    details = 'טוקן פג תוקף — נדרש חיבור מחדש';
  } else if (reason.includes('permission')) {
    details = 'הרשאות חסרות — יש לבדוק הגדרות';
  } else if (reason.includes('rate') || reason.includes('limit')) {
    details = 'מגבלת קריאות API — יש לנסות שוב מאוחר יותר';
  }

  await trackError({
    type: 'sync_failure',
    source: 'sync',
    message: `סנכרון ${platform} נכשל: ${details}`,
    severity: 'high',
    clientId,
    relatedEntityType: 'platform',
    relatedEntityId: platform,
  });

  await createAlert({
    type: 'sync_broken',
    title: `סנכרון ${platform} שבור`,
    message: details,
    severity: 'high',
    source: 'sync',
    clientId,
  });
}
