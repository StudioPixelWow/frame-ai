/**
 * GET /api/data/payments - Get all payments
 * POST /api/data/payments - Create a new payment
 */

import { NextRequest, NextResponse } from 'next/server';
import { payments } from '@/lib/db';
import { ensureSeeded } from '@/lib/db/seed';
import { persistenceLog } from '@/lib/db/persistence-logger';
import { requireRole, getRequestRole } from '@/lib/auth/api-guard';

export async function GET(req: NextRequest) {
  // Payments are admin-only data. Non-admins get an empty list (no 403 console spam,
  // no data exposure) so pollers on shared pages don't flood errors.
  if (getRequestRole(req) !== 'admin') return NextResponse.json([]);

  ensureSeeded();
  const log = persistenceLog('payments', 'select', '/api/data/payments', 'payments.json');
  try {
    log.start();
    const data = await payments.getAllAsync();
    log.ok(data);
    return NextResponse.json(data);
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    log.fail(msg);
    // Return empty array on transient errors — polling will retry
    return NextResponse.json([]);
  }
}

export async function POST(req: NextRequest) {
  ensureSeeded();
  const log = persistenceLog('payments', 'insert', '/api/data/payments', 'payments.json');
  try {
    const body = await req.json();
    log.start(body as Record<string, unknown>);
    const created = await payments.createAsync(body);
    log.ok(created);
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    log.fail(msg);
    return NextResponse.json({ error: 'Failed to create payment' }, { status: 400 });
  }
}
