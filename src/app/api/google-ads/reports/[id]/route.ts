/**
 * GET  /api/google-ads/reports/:id            → JSON report
 * GET  /api/google-ads/reports/:id?format=html → standalone HTML (print → PDF)
 *      (also marks the report as "viewed")
 */
import { NextRequest, NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';

import { ensureSeeded } from '@/lib/db/seed';
import { googleAdsReports, logGoogleAds } from '@/lib/google-ads/db';

export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  ensureSeeded();
  const { id } = await context.params;
  const report = await googleAdsReports.getByIdAsync(id);
  if (!report) return NextResponse.json({ error: 'דוח לא נמצא' }, { status: 404 });

  const format = req.nextUrl.searchParams.get('format');
  if (format === 'html') {
    // First view → flip status to "viewed".
    if (report.status !== 'viewed') {
      try {
        await googleAdsReports.updateAsync(id, { status: 'viewed', viewedAt: new Date().toISOString() } as any);
        await logGoogleAds(report.clientId, 'info', `Report ${id} viewed.`, id);
      } catch { /* non-blocking */ }
    }
    const html = report.jsonData?.html || '<!doctype html><meta charset="utf-8"><body dir="rtl" style="font-family:sans-serif;padding:40px">הדוח אינו זמין.</body>';
    return new NextResponse(html, { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
  }

  return NextResponse.json({ success: true, report });
}
