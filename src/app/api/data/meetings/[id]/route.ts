/**
 * GET    /api/data/meetings/:id - Get meeting by ID
 * PUT    /api/data/meetings/:id - Update meeting
 * DELETE /api/data/meetings/:id - Delete meeting
 */

import { NextRequest, NextResponse } from 'next/server';
import { meetings } from '@/lib/db';
import { ensureSeeded } from '@/lib/db/seed';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  ensureSeeded();
  try {
    const { id } = await params;
    const meeting = meetings.getById(id);
    if (!meeting) return NextResponse.json({ error: 'Meeting not found' }, { status: 404 });
    return NextResponse.json(meeting);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch meeting' }, { status: 500 });
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  ensureSeeded();
  try {
    const { id } = await params;
    const body = await req.json();
    const updated = meetings.update(id, body);
    if (!updated) return NextResponse.json({ error: 'Meeting not found' }, { status: 404 });
    return NextResponse.json(updated);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to update meeting' }, { status: 400 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  ensureSeeded();
  try {
    const { id } = await params;
    const deleted = meetings.delete(id);
    if (!deleted) return NextResponse.json({ error: 'Meeting not found' }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to delete meeting' }, { status: 500 });
  }
}
