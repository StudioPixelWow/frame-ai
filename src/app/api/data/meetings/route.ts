/**
 * GET /api/data/meetings - Get all meetings
 * POST /api/data/meetings - Create a new meeting
 */

import { NextRequest, NextResponse } from 'next/server';
import { meetings } from '@/lib/db';
import { ensureSeeded } from '@/lib/db/seed';

export async function GET() {
  ensureSeeded();
  try {
    return NextResponse.json(await meetings.getAllAsync());
  } catch (error) {
    // Return empty array on transient errors — polling will retry
    return NextResponse.json([]);
  }
}

export async function POST(req: NextRequest) {
  ensureSeeded();
  try {
    const body = await req.json();
    const created = await meetings.createAsync(body);
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to create meeting' },
      { status: 400 }
    );
  }
}
