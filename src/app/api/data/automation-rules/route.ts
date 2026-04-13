/**
 * GET /api/data/automation-rules - Get all automation rules
 * POST /api/data/automation-rules - Create a new automation rule
 */

import { NextRequest, NextResponse } from 'next/server';
import { automationRules } from '@/lib/db';
import { ensureSeeded } from '@/lib/db/seed';

export async function GET() {
  ensureSeeded();
  try {
    return NextResponse.json(automationRules.getAll());
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch automation rules' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  ensureSeeded();
  try {
    const body = await req.json();
    const created = automationRules.create(body);
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to create automation rule' },
      { status: 400 }
    );
  }
}
