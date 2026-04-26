/**
 * GET /api/data/approvals - Get all approvals
 * POST /api/data/approvals - Create a new approval
 */

import { NextRequest, NextResponse } from 'next/server';
import { approvals } from '@/lib/db';
import { ensureSeeded } from '@/lib/db/seed';
import { scopeForClient } from '@/lib/auth/api-guard';

export async function GET(req: NextRequest) {
  ensureSeeded();
  try {
    const all = await approvals.getAllAsync();
    const scoped = scopeForClient(req, all, (item: any) => item.clientId);
    return NextResponse.json(scoped);
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch approvals' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  ensureSeeded();
  try {
    const body = await req.json();
    const created = await approvals.createAsync(body);
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to create approval' },
      { status: 400 }
    );
  }
}
