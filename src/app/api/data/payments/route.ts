/**
 * GET /api/data/payments - Get all payments
 * POST /api/data/payments - Create a new payment
 */

import { NextRequest, NextResponse } from 'next/server';
import { payments } from '@/lib/db';
import { ensureSeeded } from '@/lib/db/seed';
import { persistenceLog } from '@/lib/db/persistence-logger';

export async function GET() {
  ensureSeeded();
  const log = persistenceLog('payments', 'select', '/api/data/payments', 'payments.json');
  try {
    log.start();
    const data = payments.getAll();
    log.ok(data);
    return NextResponse.json(data);
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    log.fail(msg);
    return NextResponse.json({ error: 'Failed to fetch payments' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  ensureSeeded();
  const log = persistenceLog('payments', 'insert', '/api/data/payments', 'payments.json');
  try {
    const body = await req.json();
    log.start(body as Record<string, unknown>);
    const created = payments.create(body);
    log.ok(created);
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    log.fail(msg);
    return NextResponse.json({ error: 'Failed to create payment' }, { status: 400 });
  }
}
