/**
 * PixelManageAI — Audit Logger
 *
 * Structured audit trail for all automated actions, AI decisions,
 * and system events.
 */

import type { AuditEntry } from './types';

export interface LogAuditParams {
  action: string;
  entityType: string;
  entityId: string | null;
  details: Record<string, unknown>;
  source: 'system' | 'user' | 'ai' | 'automation';
  userId?: string | null;
}

/** Log an audit entry — persists to API */
export async function logAudit(params: LogAuditParams): Promise<AuditEntry | null> {
  const entry: AuditEntry = {
    id: crypto.randomUUID(),
    action: params.action,
    entityType: params.entityType,
    entityId: params.entityId,
    details: params.details,
    source: params.source,
    userId: params.userId ?? null,
    createdAt: new Date().toISOString(),
  };

  try {
    const res = await fetch('/api/data/audit-log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(entry),
    });
    if (!res.ok) {
      console.error('[Audit] Failed to store audit entry:', res.status);
      return null;
    }
    return entry;
  } catch (e) {
    console.error('[Audit] Logger error:', e);
    return null;
  }
}

/** Query audit log entries */
export async function getAuditLog(filters?: {
  entityType?: string;
  entityId?: string;
  action?: string;
  source?: string;
  limit?: number;
}): Promise<AuditEntry[]> {
  try {
    const params = new URLSearchParams();
    if (filters?.entityType) params.set('entityType', filters.entityType);
    if (filters?.entityId) params.set('entityId', filters.entityId);
    if (filters?.action) params.set('action', filters.action);
    if (filters?.source) params.set('source', filters.source);
    if (filters?.limit) params.set('limit', String(filters.limit));

    const res = await fetch(`/api/data/audit-log?${params.toString()}`);
    if (!res.ok) return [];
    const data = await res.json();
    return (data.data ?? data) as AuditEntry[];
  } catch {
    return [];
  }
}
