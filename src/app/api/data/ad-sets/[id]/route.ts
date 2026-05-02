/**
 * GET /api/data/ad-sets/[id] - Get a single ad set
 * PUT /api/data/ad-sets/[id] - Update an ad set
 * DELETE /api/data/ad-sets/[id] - Delete an ad set
 */

import { NextRequest, NextResponse } from 'next/server';
import { adSets } from '@/lib/db';
import { ensureSeeded } from '@/lib/db/seed';

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  ensureSeeded();
  try {
    const { id } = await context.params;
    const adSet = await adSets.getByIdAsync(id);
    if (!adSet) {
      return NextResponse.json({ error: 'Ad set not found' }, { status: 404 });
    }
    return NextResponse.json(adSet);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch ad set' }, { status: 500 });
  }
}

export async function PUT(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  ensureSeeded();
  try {
    const { id } = await context.params;
    const body = await req.json();
    const updated = await adSets.updateAsync(id, body);
    if (!updated) {
      return NextResponse.json({ error: 'Ad set not found' }, { status: 404 });
    }
    return NextResponse.json(updated);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to update ad set' }, { status: 400 });
  }
}

export async function DELETE(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  ensureSeeded();
  try {
    const { id } = await context.params;
    const deleted = await adSets.deleteAsync(id);
    if (!deleted) {
      return NextResponse.json({ error: 'Ad set not found' }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to delete ad set' }, { status: 500 });
  }
}
