/**
 * GET /api/data/ads - Get all ads (optionally filtered by adSetId or campaignId)
 * POST /api/data/ads - Create a new ad
 */

import { NextRequest, NextResponse } from 'next/server';
import { ads } from '@/lib/db';
import { ensureSeeded } from '@/lib/db/seed';
import { persistenceLog } from '@/lib/db/persistence-logger';

export async function GET(req: NextRequest) {
  ensureSeeded();
  const log = persistenceLog('ads', 'select', '/api/data/ads', 'ads');
  try {
    log.start();
    let data = await ads.getAllAsync();

    // Optional filters
    const adSetId = req.nextUrl.searchParams.get('adSetId');
    const campaignId = req.nextUrl.searchParams.get('campaignId');
    if (adSetId) {
      data = data.filter((a) => a.adSetId === adSetId);
    } else if (campaignId) {
      data = data.filter((a) => a.campaignId === campaignId);
    }

    log.ok(data);
    return NextResponse.json(data);
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    log.fail(msg);
    return NextResponse.json({ error: 'Failed to fetch ads' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  ensureSeeded();
  const log = persistenceLog('ads', 'insert', '/api/data/ads', 'ads');
  try {
    const body = await req.json();
    log.start(body as Record<string, unknown>);
    const created = await ads.createAsync(body);
    log.ok(created);
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    log.fail(msg);
    return NextResponse.json({ error: 'Failed to create ad' }, { status: 400 });
  }
}
