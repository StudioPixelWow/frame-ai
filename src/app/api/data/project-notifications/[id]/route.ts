/**
 * GET    /api/data/project-notifications/[id] — Get single notification
 * PUT    /api/data/project-notifications/[id] — Update (e.g. mark as read)
 * DELETE /api/data/project-notifications/[id] — Delete notification
 */

import { NextRequest, NextResponse } from 'next/server';
import { projectNotifications } from '@/lib/db';
import { ensureSeeded } from '@/lib/db/seed';

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  ensureSeeded();
  try {
    const { id } = await context.params;
    const notification = projectNotifications.getById(id);
    if (!notification) {
      return NextResponse.json({ error: 'Notification not found' }, { status: 404 });
    }
    return NextResponse.json(notification);
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch notification' },
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
    body.updatedAt = new Date().toISOString();
    const updated = projectNotifications.update(id, body);
    if (!updated) {
      return NextResponse.json({ error: 'Notification not found' }, { status: 404 });
    }
    return NextResponse.json(updated);
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to update notification' },
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
    const deleted = projectNotifications.delete(id);
    if (!deleted) {
      return NextResponse.json({ error: 'Notification not found' }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to delete notification' },
      { status: 500 }
    );
  }
}
