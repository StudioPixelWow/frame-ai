/** GET /api/google-ads/reports/:id/pdf → serves the print-ready HTML (browser → PDF). */
import { NextRequest, NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';

import { ensureSeeded } from '@/lib/db/seed';
import { googleAdsReports } from '@/lib/google-ads/db';

export async function GET(_req: NextRequest, context: { params: Promise<{ id: string }> }) {
  ensureSeeded();
  const { id } = await context.params;
  const report = await googleAdsReports.getByIdAsync(id);
  if (!report) return NextResponse.json({ error: 'דוח לא נמצא' }, { status: 404 });
  const html = report.jsonData?.html || '<!doctype html><meta charset="utf-8"><body dir="rtl">הדוח אינו זמין.</body>';
  // Auto-open the print dialog so the user can save as PDF directly.
  const withPrint = html.replace('</body>', '<script>window.addEventListener("load",()=>setTimeout(()=>window.print(),400))</script></body>');
  return new NextResponse(withPrint, { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
}
