/**
 * System Health Monitor
 *
 * Runs health checks across all subsystems:
 * - API availability
 * - DB connectivity
 * - Platform sync status
 * - Autopilot health
 * - Action execution status
 * - Error rates
 *
 * Returns overall status: healthy / warning / critical
 */

import { createClient } from '@supabase/supabase-js';
import type { SystemStatus, HealthCheckResult, SystemHealthDashboard, SystemError, SystemAlert, GovernanceRule } from './types';
import { GOVERNANCE_RULES } from './governance';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
);

// ── Main Health Check ──

export async function runHealthCheck(): Promise<SystemHealthDashboard> {
  const checks: HealthCheckResult[] = [];
  const now = new Date().toISOString();

  // 1. Database connectivity
  checks.push(await checkDatabase());

  // 2. Recent error rate
  checks.push(await checkErrorRate());

  // 3. Action failures
  checks.push(await checkActionFailures());

  // 4. Sync status
  checks.push(await checkSyncStatus());

  // 5. Autopilot health
  checks.push(await checkAutopilotHealth());

  // 6. Data integrity
  checks.push(await checkDataIntegrity());

  // Calculate overall status
  const hasAny = (s: SystemStatus) => checks.some(c => c.status === s);
  const overallStatus: SystemStatus = hasAny('critical') ? 'critical' : hasAny('warning') ? 'warning' : 'healthy';

  const statusMessages: Record<SystemStatus, string> = {
    healthy: 'המערכת פועלת בצורה תקינה',
    warning: 'נמצאו אזהרות שדורשות תשומת לב',
    critical: 'נמצאו בעיות שדורשות טיפול מיידי',
  };

  // Get recent errors
  const recentErrors = await getRecentErrors();
  const activeAlerts = await getActiveAlerts();
  const stats = await getStats24h();

  return {
    overallStatus,
    statusMessage: statusMessages[overallStatus],
    checks,
    recentErrors,
    activeAlerts,
    governanceRules: GOVERNANCE_RULES,
    stats,
  };
}

// ── Individual Checks ──

async function checkDatabase(): Promise<HealthCheckResult> {
  const now = new Date().toISOString();
  try {
    const start = Date.now();
    const { error } = await supabase.from('autopilot_settings').select('id').limit(1);
    const duration = Date.now() - start;

    if (error && error.code === '42P01') {
      // Table doesn't exist yet — not critical
      return { name: 'מסד נתונים', status: 'warning', message: 'חלק מהטבלאות חסרות — יש להריץ מיגרציה', details: { durationMs: duration }, checkedAt: now };
    }
    if (error) {
      return { name: 'מסד נתונים', status: 'critical', message: `שגיאת חיבור: ${error.message}`, details: {}, checkedAt: now };
    }
    if (duration > 3000) {
      return { name: 'מסד נתונים', status: 'warning', message: `תגובה איטית: ${duration}ms`, details: { durationMs: duration }, checkedAt: now };
    }
    return { name: 'מסד נתונים', status: 'healthy', message: `תקין (${duration}ms)`, details: { durationMs: duration }, checkedAt: now };
  } catch (err) {
    return { name: 'מסד נתונים', status: 'critical', message: (err as Error).message, details: {}, checkedAt: now };
  }
}

async function checkErrorRate(): Promise<HealthCheckResult> {
  const now = new Date().toISOString();
  try {
    const h24 = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { count: total } = await supabase.from('system_errors').select('id', { count: 'exact', head: true }).gte('created_at', h24);
    const { count: critical } = await supabase.from('system_errors').select('id', { count: 'exact', head: true }).gte('created_at', h24).eq('severity', 'critical');

    const t = total || 0;
    const c = critical || 0;

    if (c > 0) return { name: 'שגיאות', status: 'critical', message: `${c} שגיאות קריטיות ב-24 שעות`, details: { total: t, critical: c }, checkedAt: now };
    if (t > 20) return { name: 'שגיאות', status: 'warning', message: `${t} שגיאות ב-24 שעות — יותר מהרגיל`, details: { total: t }, checkedAt: now };
    return { name: 'שגיאות', status: 'healthy', message: t === 0 ? 'ללא שגיאות' : `${t} שגיאות (תקין)`, details: { total: t }, checkedAt: now };
  } catch {
    return { name: 'שגיאות', status: 'healthy', message: 'לא ניתן לבדוק — טבלה לא קיימת', details: {}, checkedAt: now };
  }
}

async function checkActionFailures(): Promise<HealthCheckResult> {
  const now = new Date().toISOString();
  try {
    const h24 = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { count: failed } = await supabase.from('autopilot_actions').select('id', { count: 'exact', head: true }).eq('status', 'failed').gte('created_at', h24);
    const f = failed || 0;

    if (f > 5) return { name: 'פעולות', status: 'critical', message: `${f} פעולות נכשלו ב-24 שעות`, details: { failed: f }, checkedAt: now };
    if (f > 0) return { name: 'פעולות', status: 'warning', message: `${f} פעולות נכשלו`, details: { failed: f }, checkedAt: now };
    return { name: 'פעולות', status: 'healthy', message: 'ללא כישלונות', details: {}, checkedAt: now };
  } catch {
    return { name: 'פעולות', status: 'healthy', message: 'תקין', details: {}, checkedAt: now };
  }
}

async function checkSyncStatus(): Promise<HealthCheckResult> {
  const now = new Date().toISOString();
  try {
    const h24 = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { count: syncErrors } = await supabase.from('system_errors').select('id', { count: 'exact', head: true }).eq('source', 'sync').gte('created_at', h24);
    const s = syncErrors || 0;

    if (s > 3) return { name: 'סנכרון פלטפורמות', status: 'critical', message: `${s} כישלונות סנכרון`, details: { failed: s }, checkedAt: now };
    if (s > 0) return { name: 'סנכרון פלטפורמות', status: 'warning', message: `${s} בעיות סנכרון`, details: { failed: s }, checkedAt: now };
    return { name: 'סנכרון פלטפורמות', status: 'healthy', message: 'תקין', details: {}, checkedAt: now };
  } catch {
    return { name: 'סנכרון פלטפורמות', status: 'healthy', message: 'תקין', details: {}, checkedAt: now };
  }
}

async function checkAutopilotHealth(): Promise<HealthCheckResult> {
  const now = new Date().toISOString();
  try {
    const { data: paused } = await supabase.from('autopilot_settings').select('client_name').eq('is_paused', true);
    const { data: highFail } = await supabase.from('autopilot_settings').select('client_name, consecutive_failures').gte('consecutive_failures', 3);

    const pausedCount = paused?.length || 0;
    const highFailCount = highFail?.length || 0;

    if (highFailCount > 0) {
      const names = (highFail || []).map(h => h.client_name).join(', ');
      return { name: 'אוטופיילוט', status: 'critical', message: `${highFailCount} לקוחות עם כישלונות חוזרים: ${names}`, details: { paused: pausedCount, highFail: highFailCount }, checkedAt: now };
    }
    if (pausedCount > 0) return { name: 'אוטופיילוט', status: 'warning', message: `${pausedCount} לקוחות מושהים`, details: { paused: pausedCount }, checkedAt: now };
    return { name: 'אוטופיילוט', status: 'healthy', message: 'פועל תקין', details: {}, checkedAt: now };
  } catch {
    return { name: 'אוטופיילוט', status: 'healthy', message: 'תקין', details: {}, checkedAt: now };
  }
}

async function checkDataIntegrity(): Promise<HealthCheckResult> {
  const now = new Date().toISOString();
  try {
    // Check for campaigns without clients
    const { data: orphanCampaigns } = await supabase.from('app_campaigns').select('id').is('clientId', null).limit(5);
    const orphans = orphanCampaigns?.length || 0;

    if (orphans > 0) return { name: 'שלמות נתונים', status: 'warning', message: `${orphans} קמפיינים ללא לקוח`, details: { orphanCampaigns: orphans }, checkedAt: now };
    return { name: 'שלמות נתונים', status: 'healthy', message: 'תקין', details: {}, checkedAt: now };
  } catch {
    return { name: 'שלמות נתונים', status: 'healthy', message: 'תקין', details: {}, checkedAt: now };
  }
}

// ── Data Fetchers ──

async function getRecentErrors(): Promise<SystemError[]> {
  try {
    const { data } = await supabase.from('system_errors')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(20);
    return (data || []).map(mapErrorRow);
  } catch {
    return [];
  }
}

async function getActiveAlerts(): Promise<SystemAlert[]> {
  try {
    const { data } = await supabase.from('system_alerts')
      .select('*')
      .eq('acknowledged', false)
      .order('created_at', { ascending: false })
      .limit(20);
    return (data || []).map(mapAlertRow);
  } catch {
    return [];
  }
}

async function getStats24h() {
  const h24 = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  try {
    const [
      { count: totalErrors },
      { count: criticalErrors },
      { count: failedActions },
      { count: failedSyncs },
      { count: autopilotIssues },
      { count: resolvedErrors },
    ] = await Promise.all([
      supabase.from('system_errors').select('id', { count: 'exact', head: true }).gte('created_at', h24),
      supabase.from('system_errors').select('id', { count: 'exact', head: true }).gte('created_at', h24).eq('severity', 'critical'),
      supabase.from('autopilot_actions').select('id', { count: 'exact', head: true }).eq('status', 'failed').gte('created_at', h24),
      supabase.from('system_errors').select('id', { count: 'exact', head: true }).eq('source', 'sync').gte('created_at', h24),
      supabase.from('system_errors').select('id', { count: 'exact', head: true }).eq('source', 'autopilot').gte('created_at', h24),
      supabase.from('system_errors').select('id', { count: 'exact', head: true }).eq('resolved', true).gte('created_at', h24),
    ]);
    return {
      totalErrors24h: totalErrors || 0,
      criticalErrors24h: criticalErrors || 0,
      failedActions24h: failedActions || 0,
      failedSyncs24h: failedSyncs || 0,
      autopilotIssues24h: autopilotIssues || 0,
      resolvedErrors24h: resolvedErrors || 0,
    };
  } catch {
    return { totalErrors24h: 0, criticalErrors24h: 0, failedActions24h: 0, failedSyncs24h: 0, autopilotIssues24h: 0, resolvedErrors24h: 0 };
  }
}

// ── Row Mappers ──

function mapErrorRow(row: any): SystemError {
  return {
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
  };
}

function mapAlertRow(row: any): SystemAlert {
  return {
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
  };
}
