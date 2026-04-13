/**
 * GET /api/data/payments - Get all payments
 * POST /api/data/payments - Create a new payment
 */

import { NextRequest, NextResponse } from 'next/server';
import { payments } from '@/lib/db';
import { ensureSeeded } from '@/lib/db/seed';

export async function GET() {
  ensureSeeded();
  try {
    return NextResponse.json(payments.getAll());
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch payments' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  ensureSeeded();
  try {
    const body = await req.json();
    const created = payments.create(body);
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to create payment' },
      { status: 400 }
    );
  }
}
