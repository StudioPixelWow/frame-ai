/**
 * POST /api/data/reports — Generate a new report
 * GET  /api/data/reports — List reports
 *
 * Body (POST): { type, mode, clientId, clientName, campaignId?, campaignName?, periodStart, periodEnd }
 */

import { NextRequest, NextResponse } from 'next/server';
import { reports } from '@/lib/db';
import type { ReportType, ReportMode, Report } from '@/lib/db/schema';
import {
  generateCampaignReportData,
  generateClientMonthlyReportData,
  generateManagerReportData,
  REPORT_TYPE_META,
} from '@/lib/reports/report-engine';

export async function POST(req: NextRequest) {
  try {
    const role = req.headers.get('x-user-role') || 'admin';
    if (role === 'client') {
      // Clients can only view reports, not generate them
      return NextResponse.json({ error: 'לקוחות לא יכולים להפיק דוחות' }, { status: 403 });
    }

    const body = await req.json();
    const {
      type,
      mode,
      clientId,
      clientName,
      campaignId,
      campaignName,
      periodStart,
      periodEnd,
    } = body as {
      type: ReportType;
      mode: ReportMode;
      clientId: string;
      clientName: string;
      campaignId?: string;
      campaignName?: string;
      periodStart: string;
      periodEnd: string;
    };

    if (!type || !clientId || !periodStart || !periodEnd) {
      return NextResponse.json({ error: 'Missing required fields: type, clientId, periodStart, periodEnd' }, { status: 400 });
    }

    // Generate report data based on type
    let data;
    switch (type) {
      case 'campaign':
        if (!campaignId) {
          return NextResponse.json({ error: 'campaignId required for campaign report' }, { status: 400 });
        }
        data = await generateCampaignReportData(campaignId, periodStart, periodEnd, mode || 'client_facing');
        break;
      case 'client_monthly':
        data = await generateClientMonthlyReportData(clientId, periodStart, periodEnd, mode || 'client_facing');
        break;
      case 'internal_manager':
        data = await generateManagerReportData(clientId, periodStart, periodEnd);
        break;
      default:
        return NextResponse.json({ error: `Unknown report type: ${type}` }, { status: 400 });
    }

    const typeMeta = REPORT_TYPE_META[type] || { label: type };
    const title = campaignName
      ? `${typeMeta.label} — ${campaignName}`
      : `${typeMeta.label} — ${clientName}`;

    const report: Omit<Report, 'id'> = {
      type,
      mode: mode || (type === 'internal_manager' ? 'internal' : 'client_facing'),
      title,
      status: 'ready',
      clientId,
      clientName,
      campaignId: campaignId || null,
      campaignName: campaignName || null,
      periodStart,
      periodEnd,
      data,
      pdfUrl: null,
      generatedBy: role,
      sentTo: null,
      sentAt: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const created = await reports.createAsync(report as Report);

    return NextResponse.json({ report: created });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const clientId = url.searchParams.get('clientId');
    const type = url.searchParams.get('type');
    const limitStr = url.searchParams.get('limit');
    const limit = limitStr ? parseInt(limitStr, 10) : 50;

    let allReports = await reports.getAllAsync();

    // Role scoping
    const role = req.headers.get('x-user-role') || 'admin';
    const headerClientId = req.headers.get('x-client-id');
    if (role === 'client' && headerClientId) {
      allReports = allReports.filter(r => r.clientId === headerClientId && r.mode === 'client_facing');
    }

    if (clientId) allReports = allReports.filter(r => r.clientId === clientId);
    if (type) allReports = allReports.filter(r => r.type === type);

    // Sort newest first
    allReports.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return NextResponse.json({
      reports: allReports.slice(0, limit),
      total: allReports.length,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
