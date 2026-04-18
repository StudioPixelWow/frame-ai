/**
 * POST /api/data/payments/[id]/mark-paid - Mark a payment as paid
 *
 * Sets the payment status to 'paid' and updates paidAt to current timestamp
 */

import { NextRequest, NextResponse } from 'next/server';
import { payments } from '@/lib/db';
import { ensureSeeded } from '@/lib/db/seed';

export async function POST(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  ensureSeeded();
  try {
    const { id } = await context.params;
    const payment = await payments.getByIdAsync(id);
    if (!payment) {
      return NextResponse.json(
        { error: 'Payment not found' },
        { status: 404 }
      );
    }

    const updated = await payments.updateAsync(payment.id, {
      status: 'paid',
      paidAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    return NextResponse.json(updated);
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to mark payment as paid' },
      { status: 500 }
    );
  }
}
