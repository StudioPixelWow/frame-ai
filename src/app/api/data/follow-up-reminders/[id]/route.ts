/**
 * GET /api/data/follow-up-reminders/[id] - Get a single follow-up reminder
 * PUT /api/data/follow-up-reminders/[id] - Update a follow-up reminder
 * DELETE /api/data/follow-up-reminders/[id] - Delete a follow-up reminder
 */

import { NextRequest, NextResponse } from 'next/server';
import { followUpReminders } from '@/lib/db';
import { ensureSeeded } from '@/lib/db/seed';

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  ensureSeeded();
  try {
    const { id } = await context.params;
    const reminder = followUpReminders.getById(id);
    if (!reminder) {
      return NextResponse.json({ error: 'Follow-up reminder not found' }, { status: 404 });
    }
    return NextResponse.json(reminder);
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch follow-up reminder' },
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
    const updated = followUpReminders.update(id, body);
    if (!updated) {
      return NextResponse.json({ error: 'Follow-up reminder not found' }, { status: 404 });
    }
    return NextResponse.json(updated);
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to update follow-up reminder' },
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
    const deleted = followUpReminders.delete(id);
    if (!deleted) {
      return NextResponse.json({ error: 'Follow-up reminder not found' }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to delete follow-up reminder' },
      { status: 500 }
    );
  }
}
