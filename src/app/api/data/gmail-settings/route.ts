/**
 * GET /api/data/gmail-settings - Get all gmail settings
 * POST /api/data/gmail-settings - Create gmail settings
 */

import { NextRequest, NextResponse } from 'next/server';
import { gmailSettings } from '@/lib/db';
import { ensureSeeded } from '@/lib/db/seed';

export async function GET() {
  ensureSeeded();
  try {
    const all = await gmailSettings.getAllAsync();
    return NextResponse.json(all);
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch gmail settings' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  ensureSeeded();
  try {
    const body = await req.json();
    const created = await gmailSettings.createAsync(body);
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to create gmail settings' },
      { status: 400 }
    );
  }
}
