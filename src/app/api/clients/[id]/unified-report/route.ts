/** GET /api/clients/[clientId]/unified-report?format=html|json
 *  → one premium report fusing PIXEL Score + GEO + Google Ads. */
import { NextRequest, NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

import { buildUnifiedReportHtml, buildUnifiedReportData } from '@/lib/reports/unified';

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id: clientId } = await ctx.params;
    if (!clientId) return NextResponse.json({ error: 'clientId נדרש' }, { status: 400 });
    const format = req.nextUrl.searchParams.get('format') || 'html';
    if (format === 'json') {
      const data = await buildUnifiedReportData(clientId);
      return NextResponse.json({ success: true, data });
    }
    const { html } = await buildUnifiedReportHtml(clientId);
    return new NextResponse(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
  } catch {
    return NextResponse.json({ error: 'יצירת הדוח המאוחד נכשלה' }, { status: 500 });
  }
}
