/**
 * GET /api/data/campaigns - Get all campaigns
 * POST /api/data/campaigns - Create a new campaign
 */

import { NextRequest, NextResponse } from 'next/server';
import { campaigns } from '@/lib/db';
import { ensureSeeded } from '@/lib/db/seed';
import { persistenceLog } from '@/lib/db/persistence-logger';

export async function GET() {
  ensureSeeded();
  const log = persistenceLog('campaigns', 'select', '/api/data/campaigns', 'campaigns.json');
  try {
    log.start();
    const data = campaigns.getAll();
    log.ok(data);
    return NextResponse.json(data);
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    log.fail(msg);
    return NextResponse.json({ error: 'Failed to fetch campaigns' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  ensureSeeded();
  const log = persistenceLog('campaigns', 'insert', '/api/data/campaigns', 'campaigns.json');
  try {
    const body = await req.json();
    log.start(body as Record<string, unknown>);
    const created = campaigns.create(body);
    log.ok(created);
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    log.fail(msg);
    return NextResponse.json({ error: 'Failed to create campaign' }, { status: 400 });
  }
}
