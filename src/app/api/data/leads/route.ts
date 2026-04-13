/**
 * GET /api/data/leads - Get all leads
 * POST /api/data/leads - Create a new lead
 */

import { NextRequest, NextResponse } from 'next/server';
import { leads } from '@/lib/db';
import { ensureSeeded } from '@/lib/db/seed';

export async function GET() {
  ensureSeeded();
  try {
    return NextResponse.json(leads.getAll());
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch leads' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  ensureSeeded();
  try {
    const body = await req.json();
    const created = leads.create(body);
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to create lead' },
      { status: 400 }
    );
  }
}
