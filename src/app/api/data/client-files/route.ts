/**
 * GET /api/data/client-files - Get all client files
 * POST /api/data/client-files - Create a new client file
 */

import { NextRequest, NextResponse } from 'next/server';
import { clientFiles } from '@/lib/db';
import { ensureSeeded } from '@/lib/db/seed';

export async function GET() {
  ensureSeeded();
  try {
    return NextResponse.json(clientFiles.getAll());
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch client files' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  ensureSeeded();
  try {
    const body = await req.json();
    const created = clientFiles.create(body);
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to create client file' },
      { status: 400 }
    );
  }
}
