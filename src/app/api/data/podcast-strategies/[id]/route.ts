/**
 * GET    /api/data/podcast-strategies/:id — get single strategy with nested data
 * PUT    /api/data/podcast-strategies/:id — update strategy + replace nested data
 * DELETE /api/data/podcast-strategies/:id — delete strategy (cascades to questions + clips)
 *
 * Backed by real relational tables: podcast_strategies, podcast_questions, podcast_clips
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  ensurePodcastTables,
  getStrategyById,
  updateStrategy,
  deleteStrategy,
} from '@/lib/db/podcast-db';

export async function GET(_req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    console.log(`[podcast-strategies/${id}] GET`);

    await ensurePodcastTables();
    const item = await getStrategyById(id);
    if (!item) {
      console.warn(`[podcast-strategies/${id}] GET → not found`);
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    return NextResponse.json(item);
  } catch (error) {
    console.error('[podcast-strategies] GET by id error:', error);
    return NextResponse.json({ error: 'Failed to fetch' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const body = await req.json();
    console.log(`[podcast-strategies/${id}] PUT keys:`, Object.keys(body));

    await ensurePodcastTables();
    const updated = await updateStrategy(id, body);
    if (!updated) {
      console.warn(`[podcast-strategies/${id}] PUT → not found`);
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    console.log(`[podcast-strategies/${id}] PUT → success`);
    return NextResponse.json(updated);
  } catch (error) {
    console.error('[podcast-strategies] PUT error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update' },
      { status: 400 }
    );
  }
}

export async function DELETE(_req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    console.log(`[podcast-strategies/${id}] DELETE`);

    await ensurePodcastTables();
    const deleted = await deleteStrategy(id);
    if (!deleted) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[podcast-strategies] DELETE error:', error);
    return NextResponse.json({ error: 'Failed to delete' }, { status: 500 });
  }
}
