/**
 * GET /api/data/portal-users - Get all portal users
 * POST /api/data/portal-users - Create a new portal user
 */

import { NextRequest, NextResponse } from 'next/server';
import { portalUsers } from '@/lib/db';
import { ensureSeeded } from '@/lib/db/seed';

export async function GET() {
  ensureSeeded();
  try {
    return NextResponse.json(portalUsers.getAll());
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch portal users' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  ensureSeeded();
  try {
    const body = await req.json();
    const created = portalUsers.create(body);
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to create portal user' },
      { status: 400 }
    );
  }
}
