/**
 * DELETE /api/data/retainer-payments/[id] - remove a monthly retainer payment mark
 */

import { NextRequest, NextResponse } from 'next/server';
import { retainerPayments } from '@/lib/db';
import { ensureSeeded } from '@/lib/db/seed';

export async function DELETE(_req: NextRequest, context: { params: Promise<{ id: string }> }) {
  ensureSeeded();
  try {
    const { id } = await context.params;
    const ok = await retainerPayments.deleteAsync(id);
    if (!ok) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[retainer-payments DELETE] error:', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'Failed to delete' }, { status: 500 });
  }
}
