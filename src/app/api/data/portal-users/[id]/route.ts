/**
 * GET /api/data/portal-users/[id] - Get a single portal user
 * PUT /api/data/portal-users/[id] - Update a portal user
 * DELETE /api/data/portal-users/[id] - Delete a portal user
 */

import { NextRequest, NextResponse } from 'next/server';
import { portalUsers } from '@/lib/db';
import { ensureSeeded } from '@/lib/db/seed';

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  ensureSeeded();
  try {
    const { id } = await context.params;
    const portalUser = portalUsers.getById(id);
    if (!portalUser) {
      return NextResponse.json({ error: 'Portal user not found' }, { status: 404 });
    }
    return NextResponse.json(portalUser);
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch portal user' },
      { status: 500 }
    );
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
    const updated = portalUsers.update(id, body);
    if (!updated) {
      return NextResponse.json({ error: 'Portal user not found' }, { status: 404 });
    }
    return NextResponse.json(updated);
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to update portal user' },
      { status: 400 }
    );
  }
}

export async function DELETE(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  ensureSeeded();
  try {
    const { id } = await context.params;
    const deleted = portalUsers.delete(id);
    if (!deleted) {
      return NextResponse.json({ error: 'Portal user not found' }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to delete portal user' },
      { status: 500 }
    );
  }
}
