/**
 * GET /api/data/automation-runs - Get all automation runs
 * POST /api/data/automation-runs - Create a new automation run
 */

import { NextRequest, NextResponse } from 'next/server';
import { automationRuns } from '@/lib/db';

export async function GET() {
  try {
    return NextResponse.json(automationRuns.getAll());
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch automation runs' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const created = automationRuns.create(body);
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to create automation run' },
      { status: 400 }
    );
  }
}
