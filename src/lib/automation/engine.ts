/**
 * PixelManageAI — Automation Engine v2
 *
 * Real rule execution engine with:
 * - Extended trigger → event mapping
 * - approval_mode branching (auto_safe / requires_approval / recommendation_only)
 * - Client scope filtering
 * - Persistent automation_runs
 * - AI decision integration
 * - Loop protection & safe fallbacks
 */

import type { SystemEvent } from '../events/types';
import type { AutomationRule, AutomationRun } from '../db/schema';
import { logAudit } from '../audit/logger';
import { analyzeLeadQuality, selectBestRep } from '../ai/decisions';

// ── Loop protection ─────────────────────────────────────────────────────
const _recentExecutions = new Map<string, number>(); // ruleId → last exec timestamp
const LOOP_COOLDOWN_MS = 5000; // min 5s between same rule firing
const MAX_RULES_PER_EVENT = 10; // safety cap

// ── Trigger → event type mapping (comprehensive) ────────────────────────
const TRIGGER_EVENT_MAP: Record<string, string[]> = {
  // Lead triggers
  lead_status_changed: ['lead_status_changed', 'lead_created', 'deal_closed', 'deal_lost'],
  proposal_sent: ['lead_status_changed'],

  // Task triggers
  task_created: ['task_created'],
  task_status_changed: ['task_completed'],

  // Payment triggers
  payment_due: ['payment_overdue'],
  payment_overdue: ['payment_overdue'],

  // Project triggers
  project_created: ['client_created'],
  project_status_changed: ['client_created'],

  // Campaign triggers
  gantt_created: ['task_created'],
  gantt_approved: ['task_completed'],

  // Podcast triggers
  podcast_session_booked: ['client_created'],
  podcast_session_completed: ['task_completed'],

  // File triggers
  file_uploaded_to_task: ['task_created'],

  // Client triggers
  client_missing_monthly_gantt: ['client_inactive'],
  client_less_than_2_weekly_posts: ['client_inactive'],

  // Schedule triggers
  weekly_client_email_day: ['manual_trigger'],
  employee_task_due_today: ['task_created'],

  // Gantt triggers
  gantt_sent_to_client: ['lead_status_changed'],
};

// ── Condition evaluator ──────────────────────────────────────────────────
function evaluateConditions(conditions: string, event: SystemEvent): boolean {
  if (!conditions || conditions === '{}' || conditions === '') return true;
  try {
    const parsed = JSON.parse(conditions) as Record<string, unknown>;
    for (const [key, expected] of Object.entries(parsed)) {
      const actual = event.payload[key];
      // Support operators: { "amount__gt": 5000 }
      if (key.endsWith('__gt')) {
        const field = key.replace('__gt', '');
        if (Number(event.payload[field]) <= Number(expected)) return false;
      } else if (key.endsWith('__lt')) {
        const field = key.replace('__lt', '');
        if (Number(event.payload[field]) >= Number(expected)) return false;
      } else if (key.endsWith('__in')) {
        const field = key.replace('__in', '');
        const allowed = Array.isArray(expected) ? expected : [expected];
        if (!allowed.includes(event.payload[field])) return false;
      } else {
        if (actual !== expected) return false;
      }
    }
    return true;
  } catch {
    return true; // Invalid conditions = no filter
  }
}

// ── AI Decision Layer ───────────────────────────────────────────────────
interface AIDecision {
  recommendation: string;
  confidence: number;
  factors: string[];
  suggestedAction: string;
}

function getAIDecision(rule: AutomationRule, event: SystemEvent): AIDecision | null {
  try {
    // Lead-related AI decisions
    if (event.entityType === 'lead' && event.payload) {
      const leadData = event.payload as Record<string, unknown>;
      const analysis = analyzeLeadQuality(leadData as any);

      if (rule.action === 'assign_employee') {
        return {
          recommendation: analysis.level === 'high' ? 'auto_execute' : 'review_recommended',
          confidence: analysis.score,
          factors: analysis.factors,
          suggestedAction: analysis.suggestedAction,
        };
      }

      if (rule.action === 'create_task') {
        return {
          recommendation: analysis.urgency === 'immediate' ? 'auto_execute' : 'schedule',
          confidence: analysis.score,
          factors: analysis.factors,
          suggestedAction: `יצירת משימה: ${analysis.suggestedAction}`,
        };
      }
    }

    // Campaign-related AI decisions
    if (event.entityType === 'campaign') {
      return {
        recommendation: 'review_recommended',
        confidence: 60,
        factors: ['נדרש בדיקה ידנית של נתוני קמפיין'],
        suggestedAction: 'בדוק ביצועי קמפיין לפני פעולה',
      };
    }

    return null;
  } catch {
    return null;
  }
}

// ── Action executor ──────────────────────────────────────────────────────
export interface ActionResult {
  success: boolean;
  action: string;
  details: string;
  data?: Record<string, unknown>;
}

export async function executeAction(rule: AutomationRule, event: SystemEvent): Promise<ActionResult> {
  const action = rule.action;

  switch (action) {
    case 'create_task': {
      try {
        const res = await fetch('/api/data/employee-tasks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: `[אוטומציה] ${rule.name}`,
            description: `נוצר אוטומטית על ידי כלל: ${rule.name}\nאירוע: ${event.type}\nפרטים: ${JSON.stringify(event.payload).slice(0, 200)}`,
            assignedEmployeeId: (event.payload.assigneeId as string) || '',
            clientId: (event.payload.clientId as string) || rule.clientId || null,
            clientName: (event.payload.clientName as string) || '',
            status: 'new',
            priority: event.payload.urgency === 'immediate' ? 'urgent' : 'medium',
            dueDate: new Date(Date.now() + 3 * 86400000).toISOString().split('T')[0],
          }),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const created = await res.json();
        return {
          success: true,
          action: 'create_task',
          details: `משימה נוצרה: "${rule.name}"`,
          data: { taskId: created?.id },
        };
      } catch (e) {
        return { success: false, action: 'create_task', details: `שגיאה ביצירת משימה: ${(e as Error).message}` };
      }
    }

    case 'assign_employee': {
      try {
        // Fetch employees and leads for AI-based assignment
        const [empRes, leadsRes] = await Promise.all([
          fetch('/api/data/employees'),
          fetch('/api/data/leads'),
        ]);

        if (!empRes.ok || !leadsRes.ok) {
          return { success: false, action: 'assign_employee', details: 'שגיאה בטעינת נתוני עובדים/לידים' };
        }

        const empData = await empRes.json();
        const leadsData = await leadsRes.json();
        const employees = (empData.data ?? empData) as any[];
        const leads = (leadsData.data ?? leadsData) as any[];

        const leadPayload = event.payload as any;
        const recommendation = selectBestRep(leadPayload, employees, leads);

        if (!recommendation) {
          return { success: false, action: 'assign_employee', details: 'לא נמצא נציג מתאים' };
        }

        // Update the lead with the assigned employee
        if (event.entityId) {
          await fetch(`/api/data/leads/${event.entityId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              assigneeId: recommendation.employeeId,
              status: 'assigned',
            }),
          });
        }

        return {
          success: true,
          action: 'assign_employee',
          details: `הוקצה לנציג: ${recommendation.employeeName} (ציון: ${recommendation.score})`,
          data: {
            employeeId: recommendation.employeeId,
            employeeName: recommendation.employeeName,
            score: recommendation.score,
            reasons: recommendation.reasons,
          },
        };
      } catch (e) {
        return { success: false, action: 'assign_employee', details: `שגיאה בהקצאת נציג: ${(e as Error).message}` };
      }
    }

    case 'send_email': {
      // Simulated — logs the intent and creates an activity record
      try {
        await fetch('/api/data/activities', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'ai',
            icon: '📧',
            title: `אימייל נשלח (סימולציה): ${rule.name}`,
            description: `נמען: ${rule.targetEmail || 'לא הוגדר'} | אירוע: ${event.type}`,
            entityId: event.entityId,
          }),
        });
      } catch { /* non-critical */ }
      return {
        success: true,
        action: 'send_email',
        details: `[סימולציה] אימייל ל-${rule.targetEmail}: ${rule.name}`,
        data: { simulated: true, targetEmail: rule.targetEmail },
      };
    }

    case 'send_whatsapp': {
      // Simulated — logs to whatsapp-messages collection
      try {
        await fetch('/api/data/whatsapp-messages', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            clientId: (event.payload.clientId as string) || '',
            clientName: (event.payload.clientName as string) || '',
            phone: rule.targetWhatsApp || '',
            templateName: rule.name,
            message: `[אוטומציה] ${rule.name} — ${event.type}`,
            status: 'pending',
            direction: 'outgoing',
            relatedEntityType: event.entityType,
            relatedEntityId: event.entityId || '',
          }),
        });
      } catch { /* non-critical */ }
      return {
        success: true,
        action: 'send_whatsapp',
        details: `[סימולציה] WhatsApp ל-${rule.targetWhatsApp}: ${rule.name}`,
        data: { simulated: true, targetWhatsApp: rule.targetWhatsApp },
      };
    }

    case 'create_notification': {
      try {
        const res = await fetch('/api/data/activities', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'ai',
            icon: '🤖',
            title: `אוטומציה: ${rule.name}`,
            description: `הופעל על ידי: ${event.type}`,
            entityId: event.entityId,
          }),
        });
        return { success: res.ok, action: 'create_notification', details: 'התראה נוצרה' };
      } catch {
        return { success: false, action: 'create_notification', details: 'שגיאה ביצירת התראה' };
      }
    }

    case 'push_to_approval_center': {
      try {
        const res = await fetch('/api/data/approvals', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'milestone',
            title: `[אוטומציה] ${rule.name}`,
            clientName: (event.payload.clientName as string) || '',
            status: 'pending_approval',
          }),
        });
        return { success: res.ok, action: 'push_to_approval_center', details: 'נשלח למרכז אישורים' };
      } catch {
        return { success: false, action: 'push_to_approval_center', details: 'שגיאה בשליחה למרכז אישורים' };
      }
    }

    case 'update_status': {
      if (event.entityId) {
        try {
          const entityMap: Record<string, string> = {
            lead: 'leads',
            task: 'employee-tasks',
            client: 'clients',
          };
          const endpoint = entityMap[event.entityType];
          if (endpoint) {
            const newStatus = (event.payload.targetStatus as string) || 'in_progress';
            await fetch(`/api/data/${endpoint}/${event.entityId}`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ status: newStatus }),
            });
            return { success: true, action: 'update_status', details: `סטטוס עודכן ל-${newStatus}` };
          }
        } catch { /* fallthrough */ }
      }
      return { success: false, action: 'update_status', details: 'לא ניתן לעדכן סטטוס — חסר entityId' };
    }

    case 'generate_pdf':
    case 'add_to_calendar': {
      // Stubs — not yet implemented
      return {
        success: true,
        action,
        details: `[בפיתוח] פעולה "${action}" תירשם אך לא תבוצע`,
        data: { stub: true },
      };
    }

    default:
      return { success: true, action, details: `פעולה "${action}" — אין מטפל מוגדר` };
  }
}

// ── Create automation run record ────────────────────────────────────────
async function createAutomationRun(
  rule: AutomationRule,
  event: SystemEvent,
  status: AutomationRun['status'],
  result: ActionResult | null,
  aiDecision: AIDecision | null,
): Promise<string | null> {
  try {
    const runData: Partial<AutomationRun> = {
      ruleId: rule.id,
      ruleName: rule.name,
      eventId: event.id,
      eventType: event.type,
      trigger: rule.trigger,
      action: rule.action,
      status,
      approvalMode: rule.approvalMode || 'auto_safe',
      result: result ? { success: result.success, action: result.action, details: result.details, ...(result.data || {}) } : {},
      aiDecision: aiDecision ? { recommendation: aiDecision.recommendation, confidence: aiDecision.confidence, factors: aiDecision.factors, suggestedAction: aiDecision.suggestedAction } : null,
      clientId: rule.clientId || (event.payload.clientId as string) || null,
      entityType: event.entityType,
      entityId: event.entityId,
      executedAt: status === 'success' || status === 'failed' ? new Date().toISOString() : null,
    };

    const res = await fetch('/api/data/automation-runs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(runData),
    });
    if (res.ok) {
      const created = await res.json();
      return created?.id || null;
    }
    return null;
  } catch {
    return null;
  }
}

// ── Create approval queue item ──────────────────────────────────────────
async function createApprovalItem(
  rule: AutomationRule,
  event: SystemEvent,
  runId: string,
  aiDecision: AIDecision | null,
): Promise<void> {
  try {
    await fetch('/api/data/approval-queue', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        automationRunId: runId,
        ruleId: rule.id,
        ruleName: rule.name,
        action: rule.action,
        eventType: event.type,
        eventPayload: event.payload,
        clientId: rule.clientId || (event.payload.clientId as string) || null,
        clientName: (event.payload.clientName as string) || '',
        entityType: event.entityType,
        entityId: event.entityId,
        aiRecommendation: aiDecision?.recommendation || null,
        aiConfidence: aiDecision?.confidence || null,
        status: 'pending',
        decidedBy: null,
        decidedAt: null,
        decisionNotes: null,
      }),
    });
  } catch (e) {
    console.error('[Engine] Failed to create approval item:', e);
  }
}

// ── Main execution pipeline ──────────────────────────────────────────────
export async function executeAutomation(event: SystemEvent): Promise<void> {
  // Safety: don't process automation-generated events to prevent loops
  if (event.source === 'automation') {
    console.log('[Engine] Skipping automation-sourced event to prevent loops:', event.type);
    return;
  }

  // Fetch active rules
  let rules: AutomationRule[] = [];
  try {
    const res = await fetch('/api/data/automation-rules');
    if (res.ok) {
      const data = await res.json();
      rules = (data.data ?? data) as AutomationRule[];
    }
  } catch (e) {
    console.error('[Engine] Failed to fetch rules:', e);
    return;
  }

  const activeRules = rules.filter(r => r.isActive);
  let executedCount = 0;

  for (const rule of activeRules) {
    // Safety cap
    if (executedCount >= MAX_RULES_PER_EVENT) {
      console.warn(`[Engine] Hit max rules cap (${MAX_RULES_PER_EVENT}) for event ${event.type}`);
      break;
    }

    // Check if the rule's trigger matches this event
    const matchingEvents = TRIGGER_EVENT_MAP[rule.trigger] ?? [rule.trigger];
    if (!matchingEvents.includes(event.type)) continue;

    // Client scope filtering
    if (rule.clientId && event.payload.clientId && rule.clientId !== event.payload.clientId) {
      continue; // Rule is scoped to a specific client that doesn't match
    }

    // Evaluate conditions
    if (!evaluateConditions(rule.conditions, event)) continue;

    // Loop protection — cooldown per rule
    const lastExec = _recentExecutions.get(rule.id) || 0;
    if (Date.now() - lastExec < LOOP_COOLDOWN_MS) {
      console.warn(`[Engine] Cooldown active for rule ${rule.id}, skipping`);
      continue;
    }
    _recentExecutions.set(rule.id, Date.now());

    // AI Decision layer
    const aiDecision = getAIDecision(rule, event);

    // Determine approval mode
    const approvalMode = rule.approvalMode || 'auto_safe';

    let result: ActionResult | null = null;
    let runStatus: AutomationRun['status'];

    switch (approvalMode) {
      case 'auto_safe': {
        // Execute immediately
        result = await executeAction(rule, event);
        runStatus = result.success ? 'success' : 'failed';
        break;
      }

      case 'requires_approval': {
        // Create pending run + approval item — don't execute yet
        runStatus = 'pending_approval';
        break;
      }

      case 'recommendation_only': {
        // Log the recommendation but don't execute
        runStatus = 'skipped';
        result = {
          success: true,
          action: rule.action,
          details: `[המלצה בלבד] ${aiDecision?.suggestedAction || rule.name}`,
          data: { recommendationOnly: true },
        };
        break;
      }

      default:
        runStatus = 'failed';
        result = { success: false, action: rule.action, details: 'Unknown approval mode' };
    }

    // Persist automation run
    const runId = await createAutomationRun(rule, event, runStatus, result, aiDecision);

    // If requires_approval, create approval queue item
    if (approvalMode === 'requires_approval' && runId) {
      await createApprovalItem(rule, event, runId, aiDecision);
    }

    // Update rule stats
    try {
      await fetch(`/api/data/automation-rules/${rule.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lastTriggeredAt: new Date().toISOString(),
          triggerCount: (rule.triggerCount || 0) + 1,
        }),
      });
    } catch { /* non-critical */ }

    // Audit log
    await logAudit({
      action: approvalMode === 'requires_approval' ? 'automation_pending_approval' : 'automation_executed',
      entityType: event.entityType,
      entityId: event.entityId,
      details: {
        ruleId: rule.id,
        ruleName: rule.name,
        trigger: rule.trigger,
        actionType: rule.action,
        approvalMode,
        runId,
        result: result ? { success: result.success, details: result.details } : null,
        aiDecision: aiDecision ? { recommendation: aiDecision.recommendation, confidence: aiDecision.confidence } : null,
        eventType: event.type,
      },
      source: 'automation',
    });

    // Create activity feed entry for executed automations
    if (runStatus === 'success' || runStatus === 'pending_approval') {
      try {
        await fetch('/api/data/activities', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'ai',
            icon: runStatus === 'pending_approval' ? '⏳' : '⚡',
            title: runStatus === 'pending_approval'
              ? `ממתין לאישור: ${rule.name}`
              : `אוטומציה בוצעה: ${rule.name}`,
            description: result?.details || `${rule.action} — ${event.type}`,
            entityId: event.entityId,
          }),
        });
      } catch { /* non-critical */ }
    }

    executedCount++;
  }

  // Cleanup old cooldown entries (older than 1 min)
  const now = Date.now();
  for (const [key, ts] of _recentExecutions) {
    if (now - ts > 60000) _recentExecutions.delete(key);
  }
}

// ── Approval execution — called when an approval is approved ────────────
export async function executeApprovedAutomation(
  runId: string,
  decidedBy: string,
): Promise<ActionResult> {
  // Fetch the automation run
  let run: AutomationRun | null = null;
  try {
    const res = await fetch(`/api/data/automation-runs/${runId}`);
    if (!res.ok) return { success: false, action: 'unknown', details: 'Automation run not found' };
    run = await res.json();
  } catch {
    return { success: false, action: 'unknown', details: 'Failed to fetch automation run' };
  }

  if (!run) return { success: false, action: 'unknown', details: 'Run is null' };

  // Fetch the rule
  let rule: AutomationRule | null = null;
  try {
    const res = await fetch(`/api/data/automation-rules/${run.ruleId}`);
    if (res.ok) rule = await res.json();
  } catch { /* fallthrough */ }

  if (!rule) return { success: false, action: run.action, details: 'Rule not found — may have been deleted' };

  // Reconstruct the event from the run data
  const syntheticEvent: SystemEvent = {
    id: run.eventId,
    type: run.eventType as any,
    payload: {},
    entityType: run.entityType as any,
    entityId: run.entityId,
    source: 'automation',
    processed: true,
    createdAt: run.createdAt,
  };

  // Execute the action
  const result = await executeAction(rule, syntheticEvent);

  // Update the automation run
  try {
    await fetch(`/api/data/automation-runs/${runId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        status: result.success ? 'approved' : 'failed',
        result: { success: result.success, action: result.action, details: result.details, ...(result.data || {}) },
        executedAt: new Date().toISOString(),
      }),
    });
  } catch { /* non-critical */ }

  // Audit
  await logAudit({
    action: 'automation_approved',
    entityType: run.entityType,
    entityId: run.entityId,
    details: { runId, ruleId: run.ruleId, ruleName: run.ruleName, decidedBy, result },
    source: 'user',
    userId: decidedBy,
  });

  return result;
}

// ── Rejection handler ───────────────────────────────────────────────────
export async function rejectAutomation(
  runId: string,
  decidedBy: string,
  notes?: string,
): Promise<void> {
  // Update the run
  try {
    await fetch(`/api/data/automation-runs/${runId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        status: 'rejected',
        executedAt: new Date().toISOString(),
      }),
    });
  } catch { /* non-critical */ }

  // Audit
  await logAudit({
    action: 'automation_rejected',
    entityType: 'automation',
    entityId: runId,
    details: { runId, decidedBy, notes },
    source: 'user',
    userId: decidedBy,
  });
}
