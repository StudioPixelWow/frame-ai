/**
 * GET /api/data/proposals - Get all proposals
 * POST /api/data/proposals - Create a new proposal
 * PUT /api/data/proposals - Update a proposal by id
 * DELETE /api/data/proposals?id=xxx - Delete a proposal by id
 */

import { NextRequest, NextResponse } from 'next/server';
import { proposals } from '@/lib/db/collections';
import type { Proposal } from '@/lib/db/schema';

export async function GET() {
  try {
    const items = await proposals.getAllAsync();
    return NextResponse.json(items);
  } catch (err) {
    console.error('[proposals] GET error:', err);
    return NextResponse.json([]);
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const now = new Date().toISOString();
    const created = await proposals.createAsync({
      ...body,
      publicToken: crypto.randomUUID(),
      status: 'draft',
      viewCount: 0,
      approval: null,
      approvedSnapshot: null,
      publishedAt: null,
      firstViewedAt: null,
      lastViewedAt: null,
      createdAt: now,
      updatedAt: now,
    } as any);

    return NextResponse.json(created, { status: 201 });
  } catch (err) {
    console.error('[proposals] POST error:', err);
    return NextResponse.json({ error: 'Failed to create proposal' }, { status: 400 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, ...rest } = body;
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

    // Cannot edit approved proposals
    const existing = await proposals.getByIdAsync(id);
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if ((existing as Proposal).status === 'approved') {
      return NextResponse.json({ error: 'Cannot edit approved proposal' }, { status: 403 });
    }

    const updated = await proposals.updateAsync(id, {
      ...rest,
      updatedAt: new Date().toISOString(),
    } as any);

    if (!updated) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json(updated);
  } catch (err) {
    console.error('[proposals] PUT error:', err);
    return NextResponse.json({ error: 'Failed to update proposal' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

    await proposals.deleteAsync(id);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[proposals] DELETE error:', err);
    return NextResponse.json({ error: 'Failed to delete proposal' }, { status: 500 });
  }
}
