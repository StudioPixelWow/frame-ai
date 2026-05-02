/**
 * PixelManageAI — Central Event Bus
 *
 * Emits events, stores them, and triggers matching automation rules.
 */

import type { SystemEvent, SystemEventType, EventHandler } from './types';
import { executeAutomation } from '../automation/engine';
import { logAudit } from '../audit/logger';

// In-memory handler registry
const handlers: EventHandler[] = [];

/** Register an event handler */
export function onEvent(type: SystemEventType, handler: (event: SystemEvent) => Promise<void>): void {
  handlers.push({ type, handler });
}

/** Emit a system event — stores it, runs handlers, triggers automations */
export async function emitEvent(
  type: SystemEventType,
  payload: Record<string, unknown>,
  entityType: SystemEvent['entityType'],
  entityId: string | null = null,
  source: SystemEvent['source'] = 'system',
): Promise<SystemEvent> {
  const event: SystemEvent = {
    id: crypto.randomUUID(),
    type,
    payload,
    entityType,
    entityId,
    source,
    processed: false,
    createdAt: new Date().toISOString(),
  };

  // Store event
  try {
    const res = await fetch('/api/data/system-events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(event),
    });
    if (!res.ok) console.error('[EventBus] Failed to store event:', res.status);
  } catch (e) {
    console.error('[EventBus] Event storage error:', e);
  }

  // Run registered handlers
  const matchingHandlers = handlers.filter(h => h.type === type);
  for (const h of matchingHandlers) {
    try {
      await h.handler(event);
    } catch (e) {
      console.error(`[EventBus] Handler error for ${type}:`, e);
    }
  }

  // Trigger automation engine
  try {
    await executeAutomation(event);
  } catch (e) {
    console.error('[EventBus] Automation execution error:', e);
  }

  // Audit log
  await logAudit({
    action: 'event_emitted',
    entityType,
    entityId,
    details: { eventType: type, payload },
    source,
  });

  return event;
}
