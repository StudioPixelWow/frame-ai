/**
 * GET  /api/data/podcast-strategies  — list all strategies with nested questions + clips
 * POST /api/data/podcast-strategies  — create a new strategy with nested data
 *
 * Backed by real relational tables: podcast_strategies, podcast_questions, podcast_clips
 * Auto-creates tables on first use via exec_sql RPC.
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  ensurePodcastTables,
  getAllStrategies,
  createStrategy,
} from '@/lib/db/podcast-db';

export async function GET() {
  try {
    const tableReady = await ensurePodcastTables();
    if (!tableReady) {
      console.warn('[podcast-strategies] GET — tables not ready, returning empty array');
      return NextResponse.json([]);
    }
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
    const tableReady = await ensurePodcastTables();
    if (!tableReady) {
      console.error('[podcast-strategies] POST — tables not ready, cannot save');
      return NextResponse.json(
        { error: 'טבלת אסטרטגיות פודקאסט לא קיימת. אין אפשרות ליצור את הטבלה אוטומטית — יש ליצור אותה ידנית ב-Supabase SQL Editor.', tableNotReady: true },
        { status: 503 }
      );
    }

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
