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
  { params }: { params: { id: string } }
) {
  ensureSeeded();
  try {
    const approval = approvals.getById(params.id);
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
  { params }: { params: { id: string } }
) {
  ensureSeeded();
  try {
    const body = await req.json();
    const updated = approvals.update(params.id, body);
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
  { params }: { params: { id: string } }
) {
  ensureSeeded();
  try {
    const deleted = approvals.delete(params.id);
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
