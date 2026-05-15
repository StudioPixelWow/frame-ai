/**
 * GET /api/data/ad-references/[id] - Get a single ad reference
 * PUT /api/data/ad-references/[id] - Update an ad reference
 * DELETE /api/data/ad-references/[id] - Delete an ad reference
 */

import { NextRequest, NextResponse } from 'next/server';
import { adReferences } from '@/lib/db/collections';

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const item = await adReferences.getByIdAsync(id);
    if (!item) {
      return NextResponse.json(
        { error: 'Ad reference not found' },
        { status: 404 }
      );
    }
    return NextResponse.json(item);
  } catch (err) {
    console.error('[ad-references GET/:id] error:', err);
    return NextResponse.json(
      { error: 'Failed to fetch ad reference' },
      { status: 500 }
    );
  }
}

export async function PUT(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const body = await req.json();
    const now = new Date().toISOString();
    const result = await adReferences.updateAsync(id, {
      ...body,
      updatedAt: now,
    });
    if (!result) {
      return NextResponse.json(
        { error: 'Ad reference not found' },
        { status: 404 }
      );
    }
    return NextResponse.json(result);
  } catch (err) {
    console.error('[ad-references PUT/:id] error:', err);
    return NextResponse.json(
      { error: 'Failed to update ad reference' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const success = await adReferences.deleteAsync(id);
    if (!success) {
      return NextResponse.json(
        { error: 'Ad reference not found' },
        { status: 404 }
      );
    }
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[ad-references DELETE/:id] error:', err);
    return NextResponse.json(
      { error: 'Failed to delete ad reference' },
      { status: 500 }
    );
  }
}
