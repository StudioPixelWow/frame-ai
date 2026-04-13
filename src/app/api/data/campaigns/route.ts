/**
 * GET /api/data/campaigns - Get all campaigns
 * POST /api/data/campaigns - Create a new campaign
 */

import { NextRequest, NextResponse } from 'next/server';
import { campaigns } from '@/lib/db';
import { ensureSeeded } from '@/lib/db/seed';

export async function GET() {
  ensureSeeded();
  try {
    return NextResponse.json(campaigns.getAll());
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch campaigns' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  ensureSeeded();
  try {
    const body = await req.json();
    const created = campaigns.create(body);
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to create campaign' },
      { status: 400 }
    );
  }
}
