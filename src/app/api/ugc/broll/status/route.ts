/** GET /api/ugc/broll/status?id=…  → Replicate prediction status + clip URL when done. */

import { NextRequest, NextResponse } from 'next/server';
import { getRequestRole } from '@/lib/auth/api-guard';
import { getClip, clipStageLabel } from '@/lib/ugc/broll-video';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  if (getRequestRole(req) === 'client') return NextResponse.json({ error: 'אין הרשאה' }, { status: 403 });
  const id = req.nextUrl.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id נדרש' }, { status: 400 });
  const st = await getClip(id);
  return NextResponse.json({ ...st, stage: clipStageLabel(st.status) });
}
