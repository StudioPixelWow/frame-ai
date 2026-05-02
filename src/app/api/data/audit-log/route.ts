/**
 * GET /api/data/audit-log - Get all audit log entries
 * POST /api/data/audit-log - Create a new audit log entry
 */

import { NextRequest, NextResponse } from 'next/server';
import { auditLog } from '@/lib/db';
import { ensureSeeded } from '@/lib/db/seed';

export async function GET() {
  ensureSeeded();
  try {
    return NextResponse.json(await auditLog.getAllAsync());
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch audit log' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  ensureSeeded();
  try {
    const body = await req.json();
    const created = await auditLog.createAsync(body);
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to create audit log entry' },
      { status: 400 }
    );
  }
}
