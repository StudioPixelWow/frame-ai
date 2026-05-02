/**
 * Autonomous Growth Loop — Core Orchestrator
 *
 * Flow:
 * 1. Scan — collect all client data
 * 2. Diagnose — find issues and opportunities
 * 3. Decide — strategy direction per goal
 * 4. Generate actions
 * 5. Route to approval
 * 6. Execute approved actions
 * 7. Measure results
 * 8. Update knowledge
 *
 * Safety:
 * - Max actions per client per day
 * - No duplicate actions
 * - No execution without approval
 * - Skip low-data campaigns
 * - Stop autopilot on repeated failures
 * - Full audit log
 *
 * No AI API calls. Deterministic.
 */

import { createClient } from '@supabase/supabase-js';
import { campaigns, adSets, ads, leads, growthOpportunities, growthActions } from '@/lib/db/collections';
import type { AutopilotSettings, AutopilotRun, AutopilotAction, AutopilotActionType, AutopilotActivityLog, AutonomyMode } from './types';
import { ACTION_TYPE_META } from './types';
import { generateAutopilotActions, type DiagnosticResult } from './action-generator';
import { logActivity } from './activity-log';
import { checkSafety, SAFETY_LIMITS } from './safety';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
);

// ── Run Options ──

export interface AutopilotRunOptions {
  clientId?: string;     // single client or all
  triggeredBy: 'manual' | 'scheduled' | 'system';
}

export interface AutopilotRunResult {
  status: 'completed' | 'failed';
  runId: string;
  clientsScanned: number;
  opportunitiesFound: number;
  actionsCreated: number;
  approvalsSent: number;
  errors: string[];
  durationMs: number;
}

// ── Main Loop ──

export async function runAutopilotLoop(
  options: AutopilotRunOptions
): Promise<AutopilotRunResult> {
  const startTime = Date.now();
  const errors: string[] = [];
  let totalOpportunities = 0;
  let totalActions = 0;
  let totalApprovals = 0;

  // Create run record
  const runId = `apr_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  const run: AutopilotRun = {
    id: runId,
    clientId: options.clientId || null,
    status: 'running',
    triggeredBy: options.triggeredBy,
    clientsScanned: 0,
    opportunitiesFound: 0,
    actionsCreated: 0,
    approvalsSent: 0,
    errors: [],
    startedAt: new Date().toISOString(),
    finishedAt: null,
    createdAt: new Date().toISOString(),
  };

  await persistRun(run);
  await logActivity({
    runId,
    clientId: options.clientId || null,
    actionId: null,
    activityType: 'scan_started',
    title: 'סריקה אוטונומית החלה',
    details: options.clientId ? `סריקת לקוח בודד` : 'סריקת כל הלקוחות',
    metadata: { triggeredBy: options.triggeredBy },
  });

  try {
    // Step 1: Get active client settings
    const clientSettings = await getActiveSettings(options.clientId);
    if (clientSettings.length === 0) {
      errors.push('אין לקוחות פעילים באוטופיילוט');
      await finishRun(runId, 'completed', 0, 0, 0, 0, errors);
      return { status: 'completed', runId, clientsScanned: 0, opportunitiesFound: 0, actionsCreated: 0, approvalsSent: 0, errors, durationMs: Date.now() - startTime };
    }

    // Step 2: Process each client
    for (const settings of clientSettings) {
      if (settings.isPaused) continue;
      if (settings.mode === 'full_auto') continue; // locked mode

      try {
        // Check safety — stop if too many failures
        if (settings.consecutiveFailures >= SAFETY_LIMITS.maxConsecutiveFailures) {
          await logActivity({
            runId, clientId: settings.clientId, actionId: null,
            activityType: 'autopilot_paused',
            title: 'אוטופיילוט הושהה',
            details: `${settings.consecutiveFailures} כישלונות רצופים — המערכת השהתה את הפעולות`,
            metadata: {},
          });
          continue;
        }

        // Step 2a: Scan — collect client data
        const clientData = await scanClientData(settings.clientId);
        if (!clientData || clientData.dataQuality === 'insufficient') {
          await logActivity({
            runId, clientId: settings.clientId, actionId: null,
            activityType: 'scan_completed',
            title: 'אין מספיק נתונים',
            details: 'הסריקה הושלמה — אין מספיק נתונים לפעולה',
            metadata: {},
          });
          continue;
        }

        // Step 2b: Diagnose — find issues/opportunities
        const diagnostics = diagnose(clientData, settings);
        totalOpportunities += diagnostics.length;

        for (const diag of diagnostics) {
          await logActivity({
            runId, clientId: settings.clientId, actionId: null,
            activityType: 'opportunity_detected',
            title: diag.title,
            details: diag.reason,
            metadata: { type: diag.type, confidence: diag.confidence },
          });
        }

        // Step 2c: Generate actions aligned with goals
        const actions = generateAutopilotActions(diagnostics, settings);

        // Step 2d: Apply safety checks
        const safeActions = await checkSafety(actions, settings);

        // Step 2e: Route to approval based on mode
        const routedActions = routeActions(safeActions, settings.mode);

        // Step 2f: Persist actions
        for (const action of routedActions) {
          const actionRecord: AutopilotAction = {
            ...action,
            runId,
            clientId: settings.clientId,
            clientName: settings.clientName,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };

          await persistAction(actionRecord);
          totalActions++;

          if (actionRecord.status === 'pending_approval') {
            totalApprovals++;
            await logActivity({
              runId, clientId: settings.clientId, actionId: actionRecord.id,
              activityType: 'approval_requested',
              title: 'נשלחה בקשת אישור',
              details: `${ACTION_TYPE_META[actionRecord.actionType]?.label || actionRecord.actionType}: ${actionRecord.title}`,
              metadata: { approver: actionRecord.approver },
            });
          } else if (actionRecord.status === 'executed') {
            await logActivity({
              runId, clientId: settings.clientId, actionId: actionRecord.id,
              activityType: 'executed',
              title: 'פעולה בוצעה אוטומטית',
              details: actionRecord.title,
              metadata: {},
            });
          }
        }

        // Update last scan
        await updateSettings(settings.clientId, {
          lastScanAt: new Date().toISOString(),
          lastScanResult: `נמצאו ${diagnostics.length} הזדמנויות, ${routedActions.length} פעולות`,
          consecutiveFailures: 0,
        });

      } catch (clientErr) {
        const msg = `${settings.clientName}: ${(clientErr as Error).message}`;
        errors.push(msg);
        await updateSettings(settings.clientId, {
          consecutiveFailures: settings.consecutiveFailures + 1,
        });
      }
    }

    run.clientsScanned = clientSettings.filter(s => !s.isPaused).length;
    await finishRun(runId, 'completed', run.clientsScanned, totalOpportunities, totalActions, totalApprovals, errors);

    await logActivity({
      runId, clientId: null, actionId: null,
      activityType: 'scan_completed',
      title: 'הסריקה הושלמה',
      details: `${run.clientsScanned} לקוחות, ${totalOpportunities} הזדמנויות, ${totalActions} פעולות`,
      metadata: { errors: errors.length },
    });

  } catch (err) {
    errors.push((err as Error).message);
    await finishRun(runId, 'failed', 0, 0, 0, 0, errors);
  }

  return {
    status: errors.length > 0 && totalActions === 0 ? 'failed' : 'completed',
    runId,
    clientsScanned: run.clientsScanned,
    opportunitiesFound: totalOpportunities,
    actionsCreated: totalActions,
    approvalsSent: totalApprovals,
    errors,
    durationMs: Date.now() - startTime,
  };
}

// ── Scan Client Data ──

interface ClientScanData {
  clientId: string;
  campaignCount: number;
  adSetCount: number;
  adCount: number;
  leadCount: number;
  totalSpend: number;
  avgCTR: number;
  avgCPL: number;
  leadsTrend: 'up' | 'down' | 'stable';
  topCampaigns: Array<{ id: string; name: string; spend: number; leads: number; ctr: number }>;
  weakAds: Array<{ id: string; name: string; ctr: number; spend: number }>;
  winningAds: Array<{ id: string; name: string; ctr: number; leads: number }>;
  dataQuality: 'rich' | 'moderate' | 'sparse' | 'insufficient';
}

async function scanClientData(clientId: string): Promise<ClientScanData | null> {
  try {
    const [allCampaigns, allAdSets, allAds, allLeads] = await Promise.all([
      campaigns.getAll(),
      adSets.getAll(),
      ads.getAll(),
      leads.getAll(),
    ]);

    const clientCampaigns = allCampaigns.filter((c: any) => c.clientId === clientId);
    const campaignIds = clientCampaigns.map((c: any) => c.id);
    const clientAdSets = allAdSets.filter((a: any) => campaignIds.includes(a.campaignId));
    const adSetIds = clientAdSets.map((a: any) => a.id);
    const clientAds = allAds.filter((a: any) => adSetIds.includes(a.adSetId) || campaignIds.includes(a.campaignId));
    const clientLeads = allLeads.filter((l: any) => l.clientId === clientId);

    const campaignCount = clientCampaigns.length;
    const adSetCount = clientAdSets.length;
    const adCount = clientAds.length;
    const leadCount = clientLeads.length;

    if (campaignCount === 0) {
      return { clientId, campaignCount: 0, adSetCount: 0, adCount: 0, leadCount: 0, totalSpend: 0, avgCTR: 0, avgCPL: 0, leadsTrend: 'stable', topCampaigns: [], weakAds: [], winningAds: [], dataQuality: 'insufficient' };
    }

    const totalSpend = clientCampaigns.reduce((s: number, c: any) => s + (c.budget || c.spend || 0), 0);
    const avgCTR = clientAds.length > 0
      ? clientAds.reduce((s: number, a: any) => s + (a.ctr || 0), 0) / clientAds.length
      : 0;
    const avgCPL = leadCount > 0 && totalSpend > 0 ? totalSpend / leadCount : 0;

    // Determine trend (simplified — compare recent vs older leads)
    const now = Date.now();
    const recentLeads = clientLeads.filter((l: any) => {
      const d = new Date(l.createdAt || l.date || 0).getTime();
      return now - d < 7 * 24 * 60 * 60 * 1000;
    }).length;
    const olderLeads = clientLeads.filter((l: any) => {
      const d = new Date(l.createdAt || l.date || 0).getTime();
      return now - d >= 7 * 24 * 60 * 60 * 1000 && now - d < 14 * 24 * 60 * 60 * 1000;
    }).length;

    const leadsTrend: 'up' | 'down' | 'stable' = recentLeads > olderLeads * 1.15 ? 'up' : recentLeads < olderLeads * 0.85 ? 'down' : 'stable';

    // Top campaigns by leads
    const topCampaigns = clientCampaigns
      .map((c: any) => {
        const cLeads = clientLeads.filter((l: any) => l.campaignId === c.id).length;
        return { id: c.id, name: c.name || c.campaignName || '', spend: c.budget || c.spend || 0, leads: cLeads, ctr: c.ctr || 0 };
      })
      .sort((a: any, b: any) => b.leads - a.leads)
      .slice(0, 5);

    // Weak ads (low CTR, high spend)
    const weakAds = clientAds
      .filter((a: any) => (a.ctr || 0) < 1.0 && (a.spend || 0) > 50)
      .map((a: any) => ({ id: a.id, name: a.name || a.adName || '', ctr: a.ctr || 0, spend: a.spend || 0 }))
      .sort((a: any, b: any) => a.ctr - b.ctr)
      .slice(0, 5);

    // Winning ads (high CTR)
    const winningAds = clientAds
      .filter((a: any) => (a.ctr || 0) > 2.5)
      .map((a: any) => ({ id: a.id, name: a.name || a.adName || '', ctr: a.ctr || 0, leads: clientLeads.filter((l: any) => l.adId === a.id).length }))
      .sort((a: any, b: any) => b.ctr - a.ctr)
      .slice(0, 5);

    const dataQuality: ClientScanData['dataQuality'] =
      campaignCount >= 3 && adCount >= 5 && leadCount >= 20 ? 'rich' :
      campaignCount >= 1 && adCount >= 2 && leadCount >= 5 ? 'moderate' :
      campaignCount >= 1 ? 'sparse' : 'insufficient';

    return {
      clientId, campaignCount, adSetCount, adCount, leadCount,
      totalSpend, avgCTR, avgCPL, leadsTrend,
      topCampaigns, weakAds, winningAds, dataQuality,
    };
  } catch {
    return null;
  }
}

// ── Diagnose ──

function diagnose(data: ClientScanData, settings: AutopilotSettings): DiagnosticResult[] {
  const results: DiagnosticResult[] = [];
  const goals = settings.goals;

  // Rule 1: Weak ads need replacement
  if (data.weakAds.length > 0) {
    results.push({
      type: 'weak_creative',
      title: `${data.weakAds.length} מודעות עם ביצועים חלשים`,
      reason: `נמצאו מודעות עם CTR נמוך מ-1% וצריכת תקציב גבוהה`,
      confidence: Math.min(85, 50 + data.weakAds.length * 10),
      severity: data.weakAds.length >= 3 ? 'high' : 'medium',
      relatedEntities: data.weakAds.map(a => ({ type: 'ad', id: a.id, name: a.name })),
      alignedGoals: ['reduce_cpl', 'improve_quality'],
    });
  }

  // Rule 2: Winning ads can be scaled
  if (data.winningAds.length > 0 && goals.includes('increase_leads')) {
    results.push({
      type: 'scalable_winner',
      title: `${data.winningAds.length} מודעות מנצחות לשכפול`,
      reason: `מודעות עם CTR מעל 2.5% — ניתן לשכפל או להרחיב`,
      confidence: Math.min(90, 60 + data.winningAds.length * 10),
      severity: 'medium',
      relatedEntities: data.winningAds.map(a => ({ type: 'ad', id: a.id, name: a.name })),
      alignedGoals: ['increase_leads'],
    });
  }

  // Rule 3: Lead decline
  if (data.leadsTrend === 'down') {
    results.push({
      type: 'lead_decline',
      title: 'ירידה בכמות לידים',
      reason: 'מספר הלידים בשבוע האחרון נמוך ב-15% או יותר מהשבוע שלפניו',
      confidence: 70,
      severity: 'high',
      relatedEntities: [],
      alignedGoals: ['increase_leads', 'improve_stability'],
    });
  }

  // Rule 4: High CPL
  if (data.avgCPL > 200 && goals.includes('reduce_cpl')) {
    results.push({
      type: 'high_cpl',
      title: `עלות ליד גבוהה: ₪${Math.round(data.avgCPL)}`,
      reason: `עלות ממוצעת ללד מעל ₪200 — יש מקום לייעול`,
      confidence: 75,
      severity: data.avgCPL > 400 ? 'critical' : 'high',
      relatedEntities: [],
      alignedGoals: ['reduce_cpl'],
    });
  }

  // Rule 5: Low content diversity
  if (data.adCount < 3 && data.campaignCount >= 1 && goals.includes('increase_content')) {
    results.push({
      type: 'low_content',
      title: 'מיעוט תוכן פרסומי',
      reason: `רק ${data.adCount} מודעות פעילות — מומלץ להגדיל את מגוון התוכן`,
      confidence: 65,
      severity: 'medium',
      relatedEntities: [],
      alignedGoals: ['increase_content'],
    });
  }

  // Rule 6: No active campaigns
  if (data.campaignCount === 0) {
    results.push({
      type: 'no_campaigns',
      title: 'אין קמפיינים פעילים',
      reason: 'לא נמצאו קמפיינים פעילים — יש לשקול השקת קמפיין חדש',
      confidence: 90,
      severity: 'critical',
      relatedEntities: [],
      alignedGoals: ['increase_leads', 'increase_content'],
    });
  }

  // Rule 7: Spend without leads
  if (data.totalSpend > 500 && data.leadCount === 0) {
    results.push({
      type: 'spend_no_leads',
      title: 'תקציב ללא לידים',
      reason: `הוצאו ₪${Math.round(data.totalSpend)} ללא ליד אחד — בעיית מעקב אפשרית`,
      confidence: 85,
      severity: 'critical',
      relatedEntities: [],
      alignedGoals: ['reduce_cpl', 'improve_stability'],
    });
  }

  // Rule 8: Good performance — suggest report
  if (data.leadsTrend === 'up' && data.leadCount > 10) {
    results.push({
      type: 'positive_trend',
      title: 'מגמת צמיחה חיובית',
      reason: 'מספר הלידים בעלייה — זה הזמן לשתף דוח עם הלקוח',
      confidence: 80,
      severity: 'low',
      relatedEntities: [],
      alignedGoals: ['increase_leads', 'improve_quality'],
    });
  }

  return results;
}

// ── Route Actions ──

function routeActions(actions: AutopilotAction[], mode: AutonomyMode): AutopilotAction[] {
  return actions.map(action => {
    const meta = ACTION_TYPE_META[action.actionType];

    switch (mode) {
      case 'recommend_only':
        return { ...action, status: 'draft' as const };

      case 'approval_required':
        return { ...action, status: 'pending_approval' as const };

      case 'safe_internal':
        if (meta?.isInternal && action.approver === 'internal_auto') {
          return { ...action, status: 'executed' as const, executedAt: new Date().toISOString() };
        }
        return { ...action, status: 'pending_approval' as const };

      default: // full_auto is locked
        return { ...action, status: 'draft' as const };
    }
  });
}

// ── Persistence Helpers ──

async function persistRun(run: AutopilotRun) {
  try {
    await supabase.from('autopilot_runs').upsert({
      id: run.id,
      client_id: run.clientId,
      status: run.status,
      triggered_by: run.triggeredBy,
      clients_scanned: run.clientsScanned,
      opportunities_found: run.opportunitiesFound,
      actions_created: run.actionsCreated,
      approvals_sent: run.approvalsSent,
      errors: JSON.stringify(run.errors),
      started_at: run.startedAt,
      finished_at: run.finishedAt,
      created_at: run.createdAt,
    });
  } catch { /* best effort */ }
}

async function finishRun(
  runId: string, status: string,
  clientsScanned: number, opportunities: number, actions: number, approvals: number,
  errors: string[]
) {
  try {
    await supabase.from('autopilot_runs').update({
      status,
      clients_scanned: clientsScanned,
      opportunities_found: opportunities,
      actions_created: actions,
      approvals_sent: approvals,
      errors: JSON.stringify(errors),
      finished_at: new Date().toISOString(),
    }).eq('id', runId);
  } catch { /* best effort */ }
}

async function persistAction(action: AutopilotAction) {
  try {
    await supabase.from('autopilot_actions').upsert({
      id: action.id,
      run_id: action.runId,
      client_id: action.clientId,
      client_name: action.clientName,
      action_type: action.actionType,
      title: action.title,
      reason: action.reason,
      expected_impact: action.expectedImpact,
      confidence: action.confidence,
      risk_level: action.riskLevel,
      approver: action.approver,
      status: action.status,
      related_entity_type: action.relatedEntityType,
      related_entity_id: action.relatedEntityId,
      payload: action.payload,
      approved_by: action.approvedBy,
      approved_at: action.approvedAt,
      rejected_by: action.rejectedBy,
      rejected_at: action.rejectedAt,
      rejection_reason: action.rejectionReason,
      executed_at: action.executedAt,
      failed_reason: action.failedReason,
      before_metrics: action.beforeMetrics,
      after_metrics: action.afterMetrics,
      outcome: action.outcome,
      created_at: action.createdAt,
      updated_at: action.updatedAt,
    });
  } catch { /* best effort */ }
}

async function getActiveSettings(clientId?: string): Promise<AutopilotSettings[]> {
  try {
    let query = supabase.from('autopilot_settings').select('*').eq('is_active', true);
    if (clientId) query = query.eq('client_id', clientId);
    const { data } = await query;
    if (!data) return [];
    return data.map(mapSettingsRow);
  } catch {
    return [];
  }
}

async function updateSettings(clientId: string, updates: Partial<Record<string, unknown>>) {
  try {
    const mapped: Record<string, unknown> = {};
    if ('lastScanAt' in updates) mapped.last_scan_at = updates.lastScanAt;
    if ('lastScanResult' in updates) mapped.last_scan_result = updates.lastScanResult;
    if ('consecutiveFailures' in updates) mapped.consecutive_failures = updates.consecutiveFailures;
    mapped.updated_at = new Date().toISOString();
    await supabase.from('autopilot_settings').update(mapped).eq('client_id', clientId);
  } catch { /* best effort */ }
}

function mapSettingsRow(row: any): AutopilotSettings {
  return {
    id: row.id,
    clientId: row.client_id,
    clientName: row.client_name || '',
    mode: row.mode || 'approval_required',
    goals: (() => { try { return typeof row.goals === 'string' ? JSON.parse(row.goals) : row.goals || []; } catch { return []; } })(),
    isActive: row.is_active ?? true,
    isPaused: row.is_paused ?? false,
    maxActionsPerDay: row.max_actions_per_day ?? 8,
    lastScanAt: row.last_scan_at,
    lastScanResult: row.last_scan_result,
    consecutiveFailures: row.consecutive_failures ?? 0,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// ── Public API ──

export async function getAutopilotDashboardData(clientId?: string): Promise<any> {
  try {
    // Get settings
    const { data: settingsData } = await supabase.from('autopilot_settings').select('*');
    const settings = (settingsData || []).map(mapSettingsRow);

    // Get actions
    let actionsQuery = supabase.from('autopilot_actions').select('*').order('created_at', { ascending: false }).limit(50);
    if (clientId) actionsQuery = actionsQuery.eq('client_id', clientId);
    const { data: actionsData } = await actionsQuery;
    const actions: AutopilotAction[] = (actionsData || []).map(mapActionRow);

    // Get activity log
    let logQuery = supabase.from('autopilot_activity_log').select('*').order('created_at', { ascending: false }).limit(30);
    if (clientId) logQuery = logQuery.eq('client_id', clientId);
    const { data: logData } = await logQuery;
    const activityLog: AutopilotActivityLog[] = (logData || []).map(mapActivityRow);

    const pendingApprovals = actions.filter(a => a.status === 'pending_approval');
    const today = new Date().toISOString().split('T')[0];
    const actionsToday = actions.filter(a => a.createdAt?.startsWith(today)).length;
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const executedThisWeek = actions.filter(a => a.status === 'executed' && a.executedAt && a.executedAt >= weekAgo).length;
    const executedTotal = actions.filter(a => a.status === 'executed').length;
    const withOutcome = actions.filter(a => a.outcome && a.outcome !== 'too_early');
    const successRate = withOutcome.length > 0
      ? Math.round(withOutcome.filter(a => a.outcome === 'improved').length / withOutcome.length * 100)
      : 0;

    // High-risk: clients with consecutive failures or critical actions
    const highRiskClients = settings
      .filter(s => s.consecutiveFailures >= 2)
      .map(s => ({
        clientId: s.clientId,
        clientName: s.clientName,
        reason: `${s.consecutiveFailures} כישלונות רצופים`,
        severity: s.consecutiveFailures >= 4 ? 'critical' : 'high',
      }));

    const clientSummaries = settings.map(s => {
      const clientActions = actions.filter(a => a.clientId === s.clientId);
      return {
        clientId: s.clientId,
        clientName: s.clientName,
        mode: s.mode,
        isActive: s.isActive,
        isPaused: s.isPaused,
        lastScanAt: s.lastScanAt,
        pendingActions: clientActions.filter(a => a.status === 'pending_approval').length,
        totalActions: clientActions.length,
      };
    });

    return {
      kpis: {
        clientsMonitored: settings.filter(s => s.isActive).length,
        actionsToday,
        approvalsPending: pendingApprovals.length,
        executedThisWeek,
        successRate,
      },
      highRiskClients,
      recentActions: actions.slice(0, 10),
      pendingApprovals,
      recentActivity: activityLog,
      clientSummaries,
    };
  } catch {
    return {
      kpis: { clientsMonitored: 0, actionsToday: 0, approvalsPending: 0, executedThisWeek: 0, successRate: 0 },
      highRiskClients: [],
      recentActions: [],
      pendingApprovals: [],
      recentActivity: [],
      clientSummaries: [],
    };
  }
}

export async function getClientAutopilotData(clientId: string): Promise<any> {
  try {
    const { data: settingsRow } = await supabase.from('autopilot_settings').select('*').eq('client_id', clientId).single();
    const settings = settingsRow ? mapSettingsRow(settingsRow) : null;

    const { data: actionsData } = await supabase.from('autopilot_actions')
      .select('*').eq('client_id', clientId).order('created_at', { ascending: false }).limit(20);
    const actions = (actionsData || []).map(mapActionRow);

    const { data: logData } = await supabase.from('autopilot_activity_log')
      .select('*').eq('client_id', clientId).order('created_at', { ascending: false }).limit(15);
    const activityLog = (logData || []).map(mapActivityRow);

    const executed = actions.filter(a => a.status === 'executed');
    const withOutcome = executed.filter(a => a.outcome && a.outcome !== 'too_early');
    const successRate = withOutcome.length > 0
      ? Math.round(withOutcome.filter(a => a.outcome === 'improved').length / withOutcome.length * 100)
      : 0;

    return {
      settings,
      recentActions: actions,
      pendingApprovals: actions.filter(a => a.status === 'pending_approval'),
      recentActivity: activityLog,
      opportunities: actions.length,
      executedCount: executed.length,
      successRate,
    };
  } catch {
    return { settings: null, recentActions: [], pendingApprovals: [], recentActivity: [], opportunities: 0, executedCount: 0, successRate: 0 };
  }
}

export async function updateAutopilotAction(
  actionId: string,
  update: { status: AutopilotAction['status']; approvedBy?: string; rejectedBy?: string; rejectionReason?: string; failedReason?: string }
) {
  try {
    const mapped: Record<string, unknown> = { status: update.status, updated_at: new Date().toISOString() };
    if (update.status === 'approved') {
      mapped.approved_by = update.approvedBy || 'admin';
      mapped.approved_at = new Date().toISOString();
    }
    if (update.status === 'executed') {
      mapped.executed_at = new Date().toISOString();
    }
    if (update.rejectedBy) mapped.rejected_by = update.rejectedBy;
    if (update.rejectionReason) mapped.rejection_reason = update.rejectionReason;
    if (update.rejectedBy) mapped.rejected_at = new Date().toISOString();
    if (update.failedReason) mapped.failed_reason = update.failedReason;

    await supabase.from('autopilot_actions').update(mapped).eq('id', actionId);

    // Log activity
    const typeMap: Record<string, string> = {
      approved: 'approved',
      executed: 'executed',
      failed: 'execution_failed',
    };
    if (update.status === 'approved' || update.status === 'executed' || update.status === 'failed') {
      const { data: actionRow } = await supabase.from('autopilot_actions').select('*').eq('id', actionId).single();
      if (actionRow) {
        await logActivity({
          runId: actionRow.run_id,
          clientId: actionRow.client_id,
          actionId,
          activityType: (typeMap[update.status] || update.status) as any,
          title: update.status === 'approved' ? 'פעולה אושרה' : update.status === 'executed' ? 'פעולה בוצעה' : 'ביצוע נכשל',
          details: actionRow.title,
          metadata: {},
        });
      }
    }

    return true;
  } catch {
    return false;
  }
}

export async function upsertAutopilotSettings(settings: Partial<AutopilotSettings> & { clientId: string }) {
  try {
    const now = new Date().toISOString();
    const row: Record<string, unknown> = {
      client_id: settings.clientId,
      updated_at: now,
    };
    if (settings.clientName) row.client_name = settings.clientName;
    if (settings.mode) row.mode = settings.mode;
    if (settings.goals) row.goals = JSON.stringify(settings.goals);
    if (settings.isActive !== undefined) row.is_active = settings.isActive;
    if (settings.isPaused !== undefined) row.is_paused = settings.isPaused;
    if (settings.maxActionsPerDay) row.max_actions_per_day = settings.maxActionsPerDay;

    // Check if exists
    const { data: existing } = await supabase.from('autopilot_settings').select('id').eq('client_id', settings.clientId).single();
    if (existing) {
      await supabase.from('autopilot_settings').update(row).eq('client_id', settings.clientId);
    } else {
      row.id = `aps_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      row.created_at = now;
      if (!row.mode) row.mode = 'approval_required';
      if (!row.goals) row.goals = '[]';
      if (row.is_active === undefined) row.is_active = true;
      if (row.is_paused === undefined) row.is_paused = false;
      if (!row.max_actions_per_day) row.max_actions_per_day = 8;
      row.consecutive_failures = 0;
      await supabase.from('autopilot_settings').insert(row);
    }
    return true;
  } catch {
    return false;
  }
}

// ── Row Mappers ──

function mapActionRow(row: any): AutopilotAction {
  return {
    id: row.id,
    runId: row.run_id || '',
    clientId: row.client_id || '',
    clientName: row.client_name || '',
    actionType: row.action_type || 'create_internal_task',
    title: row.title || '',
    reason: row.reason || '',
    expectedImpact: row.expected_impact || '',
    confidence: row.confidence || 0,
    riskLevel: row.risk_level || 'low',
    approver: row.approver || 'admin',
    status: row.status || 'draft',
    relatedEntityType: row.related_entity_type,
    relatedEntityId: row.related_entity_id,
    payload: (() => { try { return typeof row.payload === 'string' ? JSON.parse(row.payload) : row.payload || {}; } catch { return {}; } })(),
    approvedBy: row.approved_by,
    approvedAt: row.approved_at,
    rejectedBy: row.rejected_by,
    rejectedAt: row.rejected_at,
    rejectionReason: row.rejection_reason,
    executedAt: row.executed_at,
    failedReason: row.failed_reason,
    beforeMetrics: (() => { try { return typeof row.before_metrics === 'string' ? JSON.parse(row.before_metrics) : row.before_metrics || {}; } catch { return {}; } })(),
    afterMetrics: (() => { try { return typeof row.after_metrics === 'string' ? JSON.parse(row.after_metrics) : row.after_metrics || {}; } catch { return {}; } })(),
    outcome: row.outcome || null,
    createdAt: row.created_at || '',
    updatedAt: row.updated_at || '',
  };
}

function mapActivityRow(row: any): AutopilotActivityLog {
  return {
    id: row.id,
    runId: row.run_id,
    clientId: row.client_id,
    actionId: row.action_id,
    activityType: row.activity_type,
    title: row.title || '',
    details: row.details || '',
    metadata: (() => { try { return typeof row.metadata === 'string' ? JSON.parse(row.metadata) : row.metadata || {}; } catch { return {}; } })(),
    createdAt: row.created_at || '',
  };
}
