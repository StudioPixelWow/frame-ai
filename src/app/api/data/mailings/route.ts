/**
 * GET /api/data/mailings - Get all mailings
 * POST /api/data/mailings - Create a new mailing
 */

import { NextRequest, NextResponse } from 'next/server';
import { mailings } from '@/lib/db';
import { ensureSeeded } from '@/lib/db/seed';

export async function GET() {
  ensureSeeded();
  try {
    return NextResponse.json(await mailings.getAllAsync());
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch mailings' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  ensureSeeded();
  try {
    const body = await req.json();
    const created = await mailings.createAsync(body);
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to create mailing' },
      { status: 400 }
    );
  }
}
