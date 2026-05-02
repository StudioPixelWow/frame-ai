/**
 * GET  /api/data/project-notifications  — List all project notifications
 * POST /api/data/project-notifications  — Create a notification
 */

import { NextRequest, NextResponse } from 'next/server';
import { projectNotifications } from '@/lib/db';
import { ensureSeeded } from '@/lib/db/seed';

export async function GET() {
  ensureSeeded();
  try {
    return NextResponse.json(projectNotifications.getAll());
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch project notifications' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  ensureSeeded();
  try {
    const body = await req.json();
    const now = new Date().toISOString();
    if (!body.createdAt) body.createdAt = now;
    if (!body.updatedAt) body.updatedAt = now;
    if (body.isRead === undefined) body.isRead = false;
    const created = projectNotifications.create(body);
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to create project notification' },
      { status: 400 }
    );
  }
}
