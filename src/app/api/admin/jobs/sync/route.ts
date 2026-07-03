/**
 * Admin: Sync Job Registry
 *
 * POST /api/admin/jobs/sync
 *
 * Forces sync of job registry to DB (ensures all registered jobs exist).
 * Also creates tables if missing.
 * Auth: admin role only.
 */

import { NextRequest, NextResponse } from 'next/server';
import { ensureJobsTable, syncRegistryToDb } from '@/lib/automation/central-job-runner';

export const dynamic = 'force-dynamic';

function isAdmin(req: NextRequest): boolean {
  const role = req.headers.get('x-app-role');
  return role === 'admin';
}

export async function POST(req: NextRequest) {
  if (!isAdmin(req)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    await ensureJobsTable();
    await syncRegistryToDb();

    return NextResponse.json({
      success: true,
      message: 'Job registry synced to database',
      syncedAt: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('[ADMIN/JOBS] Sync error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
