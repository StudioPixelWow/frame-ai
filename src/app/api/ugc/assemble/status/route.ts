/**
 * GET /api/ugc/assemble/status?id=…
 * Returns the Shotstack render status + friendly Hebrew stage + final URL when done.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getRequestRole } from '@/lib/auth/api-guard';
import { getRenderStatus, stageLabel } from '@/lib/ugc/video-assembly';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  if (getRequestRole(req) === 'client') return NextResponse.json({ error: 'אין הרשאה' }, { status: 403 });
  const id = req.nextUrl.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id נדרש' }, { status: 400 });
  const st = await getRenderStatus(id);
  return NextResponse.json({ ...st, stage: stageLabel(st.status) });
}
