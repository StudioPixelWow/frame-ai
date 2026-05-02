/**
 * PixelManageAI — Event Emission Helpers
 *
 * Convenience functions to emit events from client-side pages
 * after successful mutations. Each helper encapsulates the correct
 * event type, entity type, and payload shape.
 *
 * Usage:
 *   import { emitLeadCreated } from '@/lib/events/emit-helpers';
 *   const lead = await create({ ... });
 *   emitLeadCreated(lead);
 */

import { emitEvent } from './event-bus';
import type { SystemEvent } from './types';

// ── Lead events ─────────────────────────────────────────────────────────

export function emitLeadCreated(lead: Record<string, unknown>): Promise<SystemEvent> {
  return emitEvent('lead_created', {
    leadId: lead.id,
    leadName: lead.fullName || lead.name || '',
    company: lead.company || '',
    source: lead.source || '',
    interestType: lead.interestType || '',
    campaignId: lead.campaignId || null,
    clientId: lead.clientId || null,
  }, 'lead', lead.id as string, 'system');
}

export function emitLeadStatusChanged(
  lead: Record<string, unknown>,
  oldStatus: string,
  newStatus: string,
): Promise<SystemEvent> {
  return emitEvent('lead_status_changed', {
    leadId: lead.id,
    leadName: lead.fullName || lead.name || '',
    oldStatus,
    newStatus,
    clientId: lead.clientId || null,
    assigneeId: lead.assigneeId || null,
  }, 'lead', lead.id as string, 'system');
}

export function emitLeadAssigned(
  lead: Record<string, unknown>,
  assigneeId: string,
  assigneeName: string,
): Promise<SystemEvent> {
  return emitEvent('lead_assigned', {
    leadId: lead.id,
    leadName: lead.fullName || lead.name || '',
    assigneeId,
    assigneeName,
    clientId: lead.clientId || null,
  }, 'lead', lead.id as string, 'system');
}

export function emitDealClosed(lead: Record<string, unknown>): Promise<SystemEvent> {
  return emitEvent('deal_closed', {
    leadId: lead.id,
    leadName: lead.fullName || lead.name || '',
    amount: lead.proposalAmount || lead.value || 0,
    clientId: lead.clientId || null,
  }, 'lead', lead.id as string, 'system');
}

export function emitDealLost(lead: Record<string, unknown>): Promise<SystemEvent> {
  return emitEvent('deal_lost', {
    leadId: lead.id,
    leadName: lead.fullName || lead.name || '',
    clientId: lead.clientId || null,
  }, 'lead', lead.id as string, 'system');
}

// ── Task events ─────────────────────────────────────────────────────────

export function emitTaskCreated(task: Record<string, unknown>): Promise<SystemEvent> {
  return emitEvent('task_created', {
    taskId: task.id,
    title: task.title || '',
    assignedEmployeeId: task.assignedEmployeeId || null,
    clientId: task.clientId || null,
    clientName: task.clientName || '',
    priority: task.priority || 'medium',
  }, 'task', task.id as string, 'system');
}

export function emitTaskCompleted(task: Record<string, unknown>): Promise<SystemEvent> {
  return emitEvent('task_completed', {
    taskId: task.id,
    title: task.title || '',
    clientId: task.clientId || null,
    clientName: task.clientName || '',
  }, 'task', task.id as string, 'system');
}

// ── Client events ───────────────────────────────────────────────────────

export function emitClientCreated(client: Record<string, unknown>): Promise<SystemEvent> {
  return emitEvent('client_created', {
    clientId: client.id,
    clientName: client.name || '',
    company: client.company || '',
    clientType: client.clientType || '',
  }, 'client', client.id as string, 'system');
}

// ── Payment events ──────────────────────────────────────────────────────

export function emitPaymentOverdue(payment: Record<string, unknown>): Promise<SystemEvent> {
  return emitEvent('payment_overdue', {
    paymentId: payment.id,
    clientId: payment.clientId || null,
    clientName: payment.clientName || '',
    amount: payment.amount || 0,
    dueDate: payment.dueDate || '',
  }, 'payment', payment.id as string, 'system');
}

// ── Manual trigger ──────────────────────────────────────────────────────

export function emitManualTrigger(
  entityType: SystemEvent['entityType'],
  entityId: string | null,
  payload: Record<string, unknown> = {},
): Promise<SystemEvent> {
  return emitEvent('manual_trigger', payload, entityType, entityId, 'user');
}
