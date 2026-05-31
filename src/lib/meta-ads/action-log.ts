/**
 * Meta optimization action log.
 *
 * Every optimization/management action attempted on a client's campaigns is
 * recorded here — what was tried, what Meta returned, and whether it truly
 * succeeded. Powers the activity report shown in the campaign dashboard and the
 * client card, so the agency can send clients a clean, verifiable history.
 *
 * Table: app_meta_action_log  (see add-meta-action-log.sql)
 *   id, client_id, created_at, action_kind, category, title,
 *   status ('success' | 'failed' | 'info'), meta_id, object_type, detail, error,
 *   actor
 */

import { getSupabase } from '@/lib/db/store';
import crypto from 'crypto';

export type ActionStatus = 'success' | 'failed' | 'info';

export interface MetaActionLogEntry {
  clientId?: string | null;
  actionKind: string;          // expand_audience / shift_budget / refresh_creative ...
  category?: string;           // audience / creative / budget / ab_test
  title: string;               // human label, e.g. "הרחבת קהל מנצח: ..."
  status: ActionStatus;
  metaId?: string | null;      // created/affected Meta object id
  objectType?: string | null;  // adset / ad / campaign / audience
  detail?: string | null;      // what changed, in plain Hebrew
  error?: string | null;       // Meta's reason when failed
  actor?: string | null;       // who triggered it (email/role) — optional
}

export interface MetaActionLogRow extends MetaActionLogEntry {
  id: string;
  createdAt: string;
}

/** Fire-and-forget insert — never throws, so logging can't break an action. */
export async function logMetaAction(entry: MetaActionLogEntry): Promise<void> {
  try {
    const sb = getSupabase();
    const row = {
      id: `mal_${crypto.randomBytes(8).toString('hex')}`,
      client_id: entry.clientId || null,
      created_at: new Date().toISOString(),
      action_kind: entry.actionKind,
      category: entry.category || null,
      title: entry.title,
      status: entry.status,
      meta_id: entry.metaId || null,
      object_type: entry.objectType || null,
      detail: entry.detail || null,
      error: entry.error || null,
      actor: entry.actor || null,
    };
    const { error } = await sb.from('app_meta_action_log').insert(row);
    if (error) console.warn('[action-log] insert failed:', error.message);
  } catch (e) {
    console.warn('[action-log] insert exception:', e instanceof Error ? e.message : e);
  }
}

function rowToEntry(r: any): MetaActionLogRow {
  return {
    id: r.id,
    createdAt: r.created_at,
    clientId: r.client_id,
    actionKind: r.action_kind,
    category: r.category,
    title: r.title,
    status: r.status,
    metaId: r.meta_id,
    objectType: r.object_type,
    detail: r.detail,
    error: r.error,
    actor: r.actor,
  };
}

/** Read recent log entries, newest first. Optionally filter by client. */
export async function getMetaActionLog(clientId?: string, limit = 100): Promise<MetaActionLogRow[]> {
  try {
    const sb = getSupabase();
    let q = sb.from('app_meta_action_log').select('*').order('created_at', { ascending: false }).limit(limit);
    if (clientId) q = q.eq('client_id', clientId);
    const { data, error } = await q;
    if (error) {
      console.warn('[action-log] read failed:', error.message);
      return [];
    }
    return (data || []).map(rowToEntry);
  } catch {
    return [];
  }
}
