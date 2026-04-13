/**
 * GET /api/data/activities - Get all activities
 * POST /api/data/activities - Create a new activity log entry
 */

import { NextRequest, NextResponse } from 'next/server';
import { activities } from '@/lib/db';
import { ensureSeeded } from '@/lib/db/seed';

export async function GET() {
  ensureSeeded();
  try {
    return NextResponse.json(activities.getAll());
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch activities' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  ensureSeeded();
  try {
    const body = await req.json();
    const created = activities.create(body);
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to create activity' },
      { status: 400 }
    );
  }
}
