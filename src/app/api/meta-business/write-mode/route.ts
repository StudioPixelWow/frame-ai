/**
 * GET  /api/meta-business/write-mode  → { mode: 'recommend' | 'auto' }
 * POST /api/meta-business/write-mode  { mode } → set it
 *
 * 'recommend' (default): the auto-optimizer queues changes for approval, no Meta writes.
 * 'auto': the optimizer applies changes directly to Meta (use once writes are verified).
 */

import { NextRequest, NextResponse } from 'next/server';
import { getMetaWriteMode, setMetaWriteMode } from '@/lib/meta-ads/token';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json({ mode: await getMetaWriteMode() });
}

export async function POST(req: NextRequest) {
  try {
    const { mode } = await req.json();
    if (mode !== 'recommend' && mode !== 'auto') {
      return NextResponse.json({ error: 'mode must be recommend|auto' }, { status: 400 });
    }
    await setMetaWriteMode(mode);
    return NextResponse.json({ ok: true, mode });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'failed' }, { status: 500 });
  }
}
