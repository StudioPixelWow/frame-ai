/**
 * GET /api/data/follow-up-reminders - Get all follow-up reminders
 * POST /api/data/follow-up-reminders - Create a new follow-up reminder
 */

import { NextRequest, NextResponse } from 'next/server';
import { followUpReminders } from '@/lib/db';
import { ensureSeeded } from '@/lib/db/seed';

export async function GET() {
  ensureSeeded();
  try {
    return NextResponse.json(await followUpReminders.getAllAsync());
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch follow-up reminders' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  ensureSeeded();
  try {
    const body = await req.json();
    const created = await followUpReminders.createAsync(body);
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to create follow-up reminder' },
      { status: 400 }
    );
  }
}
