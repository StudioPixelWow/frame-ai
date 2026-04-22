/**
 * PixelManageAI — Automation Engine
 *
 * Matches system events to active automation rules,
 * evaluates conditions, and executes actions.
 */

import type { SystemEvent } from '../events/types';
import type { AutomationRule } from '../db/schema';
import { logAudit } from '../audit/logger';

// ── Trigger → event type mapping ─────────────────────────────────────────
const TRIGGER_EVENT_MAP: Record<string, string[]> = {
  lead_status_changed: ['lead_status_changed', 'lead_created', 'deal_closed', 'deal_lost'],
  task_created: ['task_created'],
  task_status_changed: ['task_completed'],
  payment_overdue: ['payment_overdue'],
  project_created: ['client_created'],
  proposal_sent: ['lead_status_changed'],
};

// ── Condition evaluator ──────────────────────────────────────────────────
function evaluateConditions(conditions: string, event: SystemEvent): boolean {
  if (!conditions || conditions === '{}' || conditions === '') return true;
  try {
    const parsed = JSON.parse(conditions) as Record<string, unknown>;
    // Check each condition key against the event payload
    for (const [key, expected] of Object.entries(parsed)) {
      const actual = event.payload[key];
      if (actual !== expected) return false;
    }
    return true;
  } catch {
    return true; // Invalid conditions = no filter
  }
}

// ── Action executor ──────────────────────────────────────────────────────
interface ActionResult {
  success: boolean;
  action: string;
  details: string;
}

async function executeAction(rule: AutomationRule, event: SystemEvent): Promise<ActionResult> {
  const action = rule.action;

  switch (action) {
    case 'create_task': {
      try {
        const res = await fetch('/api/data/employee-tasks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: `[אוטומציה] ${rule.name}`,
            description: `נוצר אוטומטית על ידי כלל: ${rule.name}\nאירוע: ${event.type}`,
            assignedEmployeeId: (event.payload.assigneeId as string) || '',
            clientId: (event.payload.clientId as string) || null,
            clientName: (event.payload.clientName as string) || '',
            status: 'new',
            priority: 'medium',
            dueDate: new Date(Date.now() + 3 * 86400000).toISOString().split('T')[0],
          }),
        });
        return { success: res.ok, action: 'create_task', details: `Task created for rule "${rule.name}"` };
      } catch {
        return { success: false, action: 'create_task', details: 'Failed to create task' };
      }
    }

    case 'assign_employee': {
      return { success: true, action: 'assign_employee', details: `Would assign employee for: ${event.type}` };
    }

    case 'send_email': {
      // Simulate email sending — log intent
      return { success: true, action: 'send_email', details: `Email simulated to ${rule.targetEmail}: ${rule.name}` };
    }

    case 'send_whatsapp': {
      return { success: true, action: 'send_whatsapp', details: `WhatsApp simulated to ${rule.targetWhatsApp}: ${rule.name}` };
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
        return { success: res.ok, action: 'create_notification', details: 'Notification created' };
      } catch {
        return { success: false, action: 'create_notification', details: 'Failed to create notification' };
      }
    }

    case 'push_to_approval_center': {
      try {
        const res = await fetch('/api/data/approvals', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: `[אוטומציה] ${rule.name}`,
            description: `דורש אישור: ${event.type}`,
            status: 'pending',
            clientId: (event.payload.clientId as string) || null,
            clientName: (event.payload.clientName as string) || '',
          }),
        });
        return { success: res.ok, action: 'push_to_approval_center', details: 'Pushed to approval center' };
      } catch {
        return { success: false, action: 'push_to_approval_center', details: 'Failed to push to approval' };
      }
    }

    default:
      return { success: true, action, details: `Action "${action}" noted (no handler)` };
  }
}

// ── Main execution pipeline ──────────────────────────────────────────────
export async function executeAutomation(event: SystemEvent): Promise<void> {
  // Fetch active rules
  let rules: AutomationRule[] = [];
  try {
    const res = await fetch('/api/data/automation-rules');
    if (res.ok) {
      const data = await res.json();
      rules = (data.data ?? data) as AutomationRule[];
    }
  } catch {
    return;
  }

  const activeRules = rules.filter(r => r.isActive);

  for (const rule of activeRules) {
    // Check if the rule's trigger matches this event
    const matchingEvents = TRIGGER_EVENT_MAP[rule.trigger] ?? [rule.trigger];
    if (!matchingEvents.includes(event.type)) continue;

    // Evaluate conditions
    if (!evaluateConditions(rule.conditions, event)) continue;

    // Execute the action
    const result = await executeAction(rule, event);

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
      action: 'automation_executed',
      entityType: event.entityType,
      entityId: event.entityId,
      details: {
        ruleId: rule.id,
        ruleName: rule.name,
        trigger: rule.trigger,
        actionType: rule.action,
        result,
        eventType: event.type,
      },
      source: 'automation',
    });
  }
}
