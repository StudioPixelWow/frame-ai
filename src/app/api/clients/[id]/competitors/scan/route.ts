/**
 * POST /api/clients/[id]/competitors/scan
 * Fetches each competitor's active ads, upserts into competitor_ads, marks NEW
 * (first time seen) and inactive (no longer returned). Returns a per-competitor
 * summary. Admin/employee only.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getRequestRole } from '@/lib/auth/api-guard';
import { scanCompetitorsForClient } from '@/lib/competitors/scan';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  if (getRequestRole(req) === 'client') return NextResponse.json({ error: 'אין הרשאה' }, { status: 403 });
  try {
    const { id: clientId } = await context.params;
    const summary = await scanCompetitorsForClient(clientId);
    return NextResponse.json({ success: true, summary });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'failed' }, { status: 500 });
  }
}
