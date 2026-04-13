/**
 * GET /api/data/mailings/[id] - Get a single mailing
 * PUT /api/data/mailings/[id] - Update a mailing
 * DELETE /api/data/mailings/[id] - Delete a mailing
 */

import { NextRequest, NextResponse } from 'next/server';
import { mailings } from '@/lib/db';
import { ensureSeeded } from '@/lib/db/seed';

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  ensureSeeded();
  try {
    const mailing = mailings.getById(params.id);
    if (!mailing) {
      return NextResponse.json(
        { error: 'Mailing not found' },
        { status: 404 }
      );
    }
    return NextResponse.json(mailing);
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch mailing' },
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
    const updated = mailings.update(params.id, body);
    if (!updated) {
      return NextResponse.json(
        { error: 'Mailing not found' },
        { status: 404 }
      );
    }
    return NextResponse.json(updated);
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to update mailing' },
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
    const deleted = mailings.delete(params.id);
    if (!deleted) {
      return NextResponse.json(
        { error: 'Mailing not found' },
        { status: 404 }
      );
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to delete mailing' },
      { status: 500 }
    );
  }
}
