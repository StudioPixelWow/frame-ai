/**
 * GET  /api/data/retainer-payments - list monthly retainer payment marks
 * POST /api/data/retainer-payments - create a payment mark for a client+month
 */

import { NextRequest, NextResponse } from 'next/server';
import { retainerPayments } from '@/lib/db';
import { ensureSeeded } from '@/lib/db/seed';

export async function GET() {
  ensureSeeded();
  try {
    const all = await retainerPayments.getAllAsync();
    return NextResponse.json(all);
  } catch (error) {
    console.error('[retainer-payments GET] error:', error instanceof Error ? error.message : error);
    return NextResponse.json([], { status: 200 });
  }
}

export async function POST(req: NextRequest) {
  ensureSeeded();
  try {
    const body = await req.json();
    const created = await retainerPayments.createAsync(body);
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    console.error('[retainer-payments POST] error:', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'Failed to create retainer payment' }, { status: 400 });
  }
}
