/** GET/POST /api/cron/google-ads/monthly — monthly Google Ads reports for all active connected clients. */
import { NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

import { ensureSeeded } from '@/lib/db/seed';
import { runGoogleAdsCron } from '@/lib/google-ads/report';

async function run() {
  ensureSeeded();
  try {
    const result = await runGoogleAdsCron('monthly');
    return NextResponse.json({ success: true, ...result });
  } catch (e) {
    console.error('[cron/google-ads/monthly] error:', e instanceof Error ? e.message : e);
    return NextResponse.json({ success: false, error: 'cron failed' }, { status: 200 });
  }
}
export const GET = run;
export const POST = run;
