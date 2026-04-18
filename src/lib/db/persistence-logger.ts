/**
 * PERSISTENCE LOGGER
 *
 * Reusable wrapper that instruments every write operation with:
 * - action name, module, route, target table
 * - payload summary
 * - DB response / error
 * - success / failure status
 * - duration
 *
 * Usage in API routes:
 *   import { persistenceLog } from '@/lib/db/persistence-logger';
 *   const log = persistenceLog('clients', 'insert', '/api/data/clients');
 *   log.start({ name: 'Acme', email: '...' });
 *   const { data, error } = await sb.from('clients').insert(row);
 *   if (error) { log.fail(error.message); return ... }
 *   log.ok(data);
 *
 * Usage in frontend (useData hook):
 *   import { clientPersistenceLog } from '@/lib/db/persistence-logger';
 *   clientPersistenceLog('update', '/api/data/clients/123', { status: res.status });
 */

export type PersistenceOp = 'insert' | 'update' | 'delete' | 'upsert' | 'select';

export interface PersistenceLogEntry {
  module: string;
  operation: PersistenceOp;
  route: string;
  table?: string;
  payloadKeys?: string[];
  payloadSize?: number;
  status: 'started' | 'ok' | 'fail';
  durationMs?: number;
  error?: string;
  resultId?: string;
  timestamp: string;
}

// In-memory ring buffer of recent persistence events (last 100)
const MAX_BUFFER = 100;
const _buffer: PersistenceLogEntry[] = [];

function addToBuffer(entry: PersistenceLogEntry) {
  _buffer.push(entry);
  if (_buffer.length > MAX_BUFFER) _buffer.shift();
}

/** Get recent persistence log entries (for QA debug panel) */
export function getRecentPersistenceLogs(): PersistenceLogEntry[] {
  return [..._buffer];
}

/** Clear the log buffer */
export function clearPersistenceLogs() {
  _buffer.length = 0;
}

/**
 * Server-side persistence logger for API routes.
 * Returns an object with start/ok/fail methods.
 */
export function persistenceLog(module: string, operation: PersistenceOp, route: string, table?: string) {
  const startTime = Date.now();
  const tag = `[Persist][${module}][${operation}]`;

  return {
    start(payload?: Record<string, unknown>) {
      const keys = payload ? Object.keys(payload) : [];
      const size = payload ? JSON.stringify(payload).length : 0;
      console.log(`${tag} START route=${route} table=${table || '?'} keys=[${keys.join(',')}] size=${size}b`);
      addToBuffer({
        module,
        operation,
        route,
        table,
        payloadKeys: keys,
        payloadSize: size,
        status: 'started',
        timestamp: new Date().toISOString(),
      });
    },

    ok(result?: unknown) {
      const dur = Date.now() - startTime;
      const id = result && typeof result === 'object' && 'id' in result
        ? String((result as Record<string, unknown>).id)
        : undefined;
      console.log(`${tag} OK (${dur}ms) route=${route}${id ? ` id=${id}` : ''}`);
      addToBuffer({
        module,
        operation,
        route,
        table,
        status: 'ok',
        durationMs: dur,
        resultId: id,
        timestamp: new Date().toISOString(),
      });
    },

    fail(error: string) {
      const dur = Date.now() - startTime;
      console.error(`${tag} FAIL (${dur}ms) route=${route} error=${error}`);
      addToBuffer({
        module,
        operation,
        route,
        table,
        status: 'fail',
        durationMs: dur,
        error,
        timestamp: new Date().toISOString(),
      });
    },
  };
}

/**
 * Client-side persistence log (for useData hook).
 * Lightweight — just logs to console with structured format.
 */
export function clientPersistenceLog(
  action: 'create' | 'update' | 'delete' | 'fetch',
  url: string,
  result: { status: number; ok: boolean; error?: string },
) {
  const icon = result.ok ? '✅' : '❌';
  const level = result.ok ? 'log' : 'error';
  console[level](
    `${icon} [Persist] ${action.toUpperCase()} ${url} → ${result.status}${result.error ? ` (${result.error})` : ''}`,
  );
}

/**
 * Verify a Supabase write actually persisted by checking the returned data.
 * Returns { verified, reason }.
 */
export function verifyPersistence(
  operation: PersistenceOp,
  sentPayload: Record<string, unknown>,
  returnedData: unknown,
): { verified: boolean; reason?: string } {
  if (!returnedData) {
    return { verified: false, reason: 'No data returned from DB' };
  }

  if (typeof returnedData !== 'object') {
    return { verified: false, reason: `Unexpected return type: ${typeof returnedData}` };
  }

  const returned = returnedData as Record<string, unknown>;

  // For insert/upsert: check that an id exists
  if ((operation === 'insert' || operation === 'upsert') && !returned.id) {
    return { verified: false, reason: 'Returned row has no id' };
  }

  // For update: check that updated_at changed (if present)
  if (operation === 'update' && sentPayload.updated_at && !returned.updated_at) {
    return { verified: false, reason: 'updated_at not reflected in response' };
  }

  return { verified: true };
}
