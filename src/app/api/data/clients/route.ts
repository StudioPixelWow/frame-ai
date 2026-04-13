/**
 * GET /api/data/clients - Get all clients
 * POST /api/data/clients - Create a new client
 */

import { NextRequest, NextResponse } from 'next/server';
import { clients } from '@/lib/db';
import { ensureSeeded } from '@/lib/db/seed';

export async function GET() {
  ensureSeeded();
  try {
    return NextResponse.json(clients.getAll());
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch clients' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  ensureSeeded();
  try {
    const body = await req.json();
    const created = clients.create(body);
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to create client' },
      { status: 400 }
    );
  }
}
