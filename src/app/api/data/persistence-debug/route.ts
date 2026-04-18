/**
 * GET /api/data/persistence-debug — QA Debug endpoint
 *
 * Returns the full persistence map, recent log entries, and system stats.
 * Use this to verify which modules are on Supabase vs JsonStore,
 * which are critical risk, and what recent write operations occurred.
 */

import { NextResponse } from 'next/server';
import { PERSISTENCE_MAP, getPersistenceStats, getCriticalModules } from '@/lib/db/persistence-map';
import { getRecentPersistenceLogs } from '@/lib/db/persistence-logger';

export const dynamic = 'force-dynamic';

export async function GET() {
  const stats = getPersistenceStats();
  const critical = getCriticalModules();
  const recentLogs = getRecentPersistenceLogs();

  return NextResponse.json({
    _info: 'Persistence Debug Panel — QA use only',
    _timestamp: new Date().toISOString(),
    stats,
    criticalModules: critical.map(e => ({
      module: e.module,
      description: e.description,
      storage: e.storage,
      table: e.table,
      notes: e.notes,
    })),
    recentLogs: recentLogs.slice(-20),
    fullMap: PERSISTENCE_MAP,
  });
}
