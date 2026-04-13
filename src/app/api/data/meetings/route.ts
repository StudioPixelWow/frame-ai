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
    return NextResponse.json(meetings.getAll());
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch meetings' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  ensureSeeded();
  try {
    const body = await req.json();
    const created = meetings.create(body);
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to create meeting' },
      { status: 400 }
    );
  }
}
