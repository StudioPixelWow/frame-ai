/**
 * GET /api/data/portal-comments/[id] - Get a single portal comment
 * PUT /api/data/portal-comments/[id] - Update a portal comment
 * DELETE /api/data/portal-comments/[id] - Delete a portal comment
 */

import { NextRequest, NextResponse } from 'next/server';
import { portalComments } from '@/lib/db';
import { ensureSeeded } from '@/lib/db/seed';

export async function GET(
  _req: NextRequest,
  { params }: { { params }: { params: { id: string } }<{ id: string }> }
) {
  ensureSeeded();
  try {
    const { id } = params;
    const comment = portalComments.getById(id);
    if (!comment) {
      return NextResponse.json({ error: 'Portal comment not found' }, { status: 404 });
    }
    return NextResponse.json(comment);
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch portal comment' },
      { status: 500 }
    );
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { { params }: { params: { id: string } }<{ id: string }> }
) {
  ensureSeeded();
  try {
    const { id } = params;
    const body = await req.json();
    const updated = portalComments.update(id, body);
    if (!updated) {
      return NextResponse.json({ error: 'Portal comment not found' }, { status: 404 });
    }
    return NextResponse.json(updated);
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to update portal comment' },
      { status: 400 }
    );
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { { params }: { params: { id: string } }<{ id: string }> }
) {
  ensureSeeded();
  try {
    const { id } = params;
    const deleted = portalComments.delete(id);
    if (!deleted) {
      return NextResponse.json({ error: 'Portal comment not found' }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to delete portal comment' },
      { status: 500 }
    );
  }
}
