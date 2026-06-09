/** POST /api/google-ads/reports/:id/send → marks the report as sent; returns the
 *  short positive summary (for email / WhatsApp). */
import { NextRequest, NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';

import { ensureSeeded } from '@/lib/db/seed';
import { googleAdsReports, logGoogleAds } from '@/lib/google-ads/db';

export async function POST(_req: NextRequest, context: { params: Promise<{ id: string }> }) {
  ensureSeeded();
  const { id } = await context.params;
  const report = await googleAdsReports.getByIdAsync(id);
  if (!report) return NextResponse.json({ error: 'דוח לא נמצא' }, { status: 404 });
  try {
    await googleAdsReports.updateAsync(id, { status: 'sent', sentAt: new Date().toISOString() } as any);
    await logGoogleAds(report.clientId, 'success', `Report ${id} marked as sent.`, id);
  } catch { /* non-blocking */ }
  return NextResponse.json({ success: true, summary: report.summaryText, htmlUrl: report.htmlUrl });
}
