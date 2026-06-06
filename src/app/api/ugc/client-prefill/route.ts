/**
 * GET /api/ugc/client-prefill?clientId=…
 * Returns sensible UGC brief defaults derived from everything we know about the
 * client (profile + research + creative DNA), so the form auto-fills.
 */

import { NextRequest, NextResponse } from 'next/server';
import { buildClientKnowledge } from '@/lib/ugc/client-knowledge';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const clientId = req.nextUrl.searchParams.get('clientId');
  if (!clientId) return NextResponse.json({ error: 'clientId נדרש' }, { status: 400 });
  try {
    const k = await buildClientKnowledge(clientId);
    if (!k) return NextResponse.json({ error: 'לקוח לא נמצא' }, { status: 404 });
    return NextResponse.json({ prefill: k.prefill, hasKnowledge: !!k.text });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'failed' }, { status: 500 });
  }
}
