/** POST /api/google-ads/reports/generate  body: { clientId, type, from?, to? } */
import { NextRequest, NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

import { ensureSeeded } from '@/lib/db/seed';
import { generateGoogleAdsReport } from '@/lib/google-ads/report';
import type { GoogleAdsReportType } from '@/lib/google-ads/db';

export async function POST(req: NextRequest) {
  ensureSeeded();
  try {
    const body = await req.json();
    const clientId = String(body.clientId || '');
    const type = (['weekly', 'monthly', 'custom'].includes(body.type) ? body.type : 'weekly') as GoogleAdsReportType;
    if (!clientId) return NextResponse.json({ error: 'clientId נדרש' }, { status: 400 });
    const report = await generateGoogleAdsReport({ clientId, type, customFrom: body.from, customTo: body.to });
    return NextResponse.json({ success: true, report });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'שגיאה';
    console.error('[google-ads/generate] error:', msg);
    return NextResponse.json({ error: msg === 'client_not_found' ? 'לקוח לא נמצא' : 'הפקת הדוח נכשלה' }, { status: 400 });
  }
}
