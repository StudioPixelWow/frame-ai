/**
 * GET  /api/data/podcast-strategies  — list all strategies
 * POST /api/data/podcast-strategies  — create a new strategy
 *
 * Two-tier persistence: relational table → JSONB fallback.
 * ensurePodcastTables() ALWAYS returns true — saves never fail with 503.
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  ensurePodcastTables,
  getAllStrategies,
  createStrategy,
} from '@/lib/db/podcast-db';

export async function GET() {
  try {
    await ensurePodcastTables();
    const all = await getAllStrategies();
    console.log(`[podcast-strategies] GET → ${all.length} strategies found`);
    return NextResponse.json(all);
  } catch (error) {
    console.error('[podcast-strategies] GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch podcast strategies' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    await ensurePodcastTables();

    const body = await req.json();
    console.log('[podcast-strategies] POST body keys:', Object.keys(body));

    const created = await createStrategy(body);
    console.log('[podcast-strategies] POST created id:', (created as any).id);

    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    console.error('[podcast-strategies] POST error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create podcast strategy' },
      { status: 400 }
    );
  }
}
