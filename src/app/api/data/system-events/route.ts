/**
 * GET /api/data/system-events - Get all system events
 * POST /api/data/system-events - Create a new system event
 */

import { NextRequest, NextResponse } from 'next/server';
import { systemEvents } from '@/lib/db';
import { ensureSeeded } from '@/lib/db/seed';

export async function GET() {
  ensureSeeded();
  try {
    return NextResponse.json(await systemEvents.getAllAsync());
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch system events' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  ensureSeeded();
  try {
    const body = await req.json();
    const created = await systemEvents.createAsync(body);
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to create system event' },
      { status: 400 }
    );
  }
}
