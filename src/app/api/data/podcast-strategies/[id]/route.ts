import { NextRequest, NextResponse } from 'next/server';
import { podcastStrategies } from '@/lib/db';
import { ensureSeeded } from '@/lib/db/seed';

export async function GET(_req: NextRequest, context: { params: Promise<{ id: string }> }) {
  ensureSeeded();
  try {
    const { id } = await context.params;
    console.log(`[podcast-strategies/${id}] GET`);
    const item = await podcastStrategies.getByIdAsync(id);
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
  ensureSeeded();
  try {
    const { id } = await context.params;
    const body = await req.json();
    console.log(`[podcast-strategies/${id}] PUT keys:`, Object.keys(body));
    body.updatedAt = new Date().toISOString();
    const updated = await podcastStrategies.updateAsync(id, body);
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
  ensureSeeded();
  try {
    const { id } = await context.params;
    console.log(`[podcast-strategies/${id}] DELETE`);
    const deleted = await podcastStrategies.deleteAsync(id);
    if (!deleted) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[podcast-strategies] DELETE error:', error);
    return NextResponse.json({ error: 'Failed to delete' }, { status: 500 });
  }
}
