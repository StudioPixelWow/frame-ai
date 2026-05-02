/**
 * GET  /api/data/reports/[id] — Get single report
 * GET  /api/data/reports/[id]?format=html — Get report as HTML (for preview/PDF)
 */

import { NextRequest, NextResponse } from 'next/server';
import { reports } from '@/lib/db';
import { generateReportHtml } from '@/lib/reports/pdf-generator';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const report = await reports.getByIdAsync(id);
    if (!report) {
      return NextResponse.json({ error: 'Report not found' }, { status: 404 });
    }

    // Role check — clients can only see client_facing reports
    const role = req.headers.get('x-user-role') || 'admin';
    const headerClientId = req.headers.get('x-client-id');
    if (role === 'client') {
      if (report.mode !== 'client_facing' || (headerClientId && report.clientId !== headerClientId)) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
      }
    }

    const url = new URL(req.url);
    const format = url.searchParams.get('format');

    if (format === 'html') {
      const html = generateReportHtml(report);
      return new NextResponse(html, {
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
        },
      });
    }

    return NextResponse.json({ report });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
