/**
 * GET /api/data/approvals/[id] - Get a single approval
 * PUT /api/data/approvals/[id] - Update an approval
 * DELETE /api/data/approvals/[id] - Delete an approval
 */

import { NextRequest, NextResponse } from 'next/server';
import { approvals } from '@/lib/db';
import { ensureSeeded } from '@/lib/db/seed';

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  ensureSeeded();
  try {
    const { id } = await context.params;
    const approval = approvals.getById(id);
    if (!approval) {
      return NextResponse.json(
        { error: 'Approval not found' },
        { status: 404 }
      );
    }
    return NextResponse.json(approval);
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch approval' },
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
    const updated = approvals.update(id, body);
    if (!updated) {
      return NextResponse.json(
        { error: 'Approval not found' },
        { status: 404 }
      );
    }
    return NextResponse.json(updated);
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to update approval' },
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
    const deleted = approvals.delete(id);
    if (!deleted) {
      return NextResponse.json(
        { error: 'Approval not found' },
        { status: 404 }
      );
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to delete approval' },
      { status: 500 }
    );
  }
}
