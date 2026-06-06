/**
 * GET /api/cron/competitor-scan — daily scan of every client's competitors so
 * the "חקר מתחרים" tab stays continuously up to date.
 */

import { NextRequest, NextResponse } from 'next/server';
import { scanAllCompetitors } from '@/lib/competitors/scan';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function GET(req: NextRequest) {
  if (process.env.CRON_SECRET) {
    const auth = req.headers.get('authorization');
    const key = req.nextUrl.searchParams.get('key');
    if (auth !== `Bearer ${process.env.CRON_SECRET}` && key !== process.env.CRON_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }
  try {
    const result = await scanAllCompetitors(270_000);
    return NextResponse.json({ success: true, ...result });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'failed' }, { status: 500 });
  }
}
