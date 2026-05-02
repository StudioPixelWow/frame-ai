/**
 * GET /api/data/portal-comments - Get all portal comments
 * POST /api/data/portal-comments - Create a new portal comment
 */

import { NextRequest, NextResponse } from 'next/server';
import { portalComments } from '@/lib/db';
import { ensureSeeded } from '@/lib/db/seed';
import { scopeForClient } from '@/lib/auth/api-guard';

export async function GET(req: NextRequest) {
  ensureSeeded();
  try {
    const all = portalComments.getAll();
    const scoped = scopeForClient(req, all, (item: any) => item.clientId);
    return NextResponse.json(scoped);
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch portal comments' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  ensureSeeded();
  try {
    const body = await req.json();
    const created = portalComments.create(body);
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to create portal comment' },
      { status: 400 }
    );
  }
}
