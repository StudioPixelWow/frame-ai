/**
 * GET /api/data/ad-sets - Get all ad sets (optionally filtered by campaignId)
 * POST /api/data/ad-sets - Create a new ad set
 */

import { NextRequest, NextResponse } from 'next/server';
import { adSets } from '@/lib/db';
import { ensureSeeded } from '@/lib/db/seed';
import { persistenceLog } from '@/lib/db/persistence-logger';

export async function GET(req: NextRequest) {
  ensureSeeded();
  const log = persistenceLog('ad-sets', 'select', '/api/data/ad-sets', 'ad-sets');
  try {
    log.start();
    let data = await adSets.getAllAsync();

    // Optional filter by campaignId
    const campaignId = req.nextUrl.searchParams.get('campaignId');
    if (campaignId) {
      data = data.filter((s) => s.campaignId === campaignId);
    }

    log.ok(data);
    return NextResponse.json(data);
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    log.fail(msg);
    return NextResponse.json({ error: 'Failed to fetch ad sets' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  ensureSeeded();
  const log = persistenceLog('ad-sets', 'insert', '/api/data/ad-sets', 'ad-sets');
  try {
    const body = await req.json();
    log.start(body as Record<string, unknown>);
    const created = await adSets.createAsync(body);
    log.ok(created);
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    log.fail(msg);
    return NextResponse.json({ error: 'Failed to create ad set' }, { status: 400 });
  }
}
