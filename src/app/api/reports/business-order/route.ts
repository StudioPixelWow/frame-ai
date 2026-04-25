import { NextResponse } from 'next/server';
import { generateBusinessOrderReport } from '@/lib/reports/business-order-report';

export const dynamic = 'force-dynamic';

/**
 * GET /api/reports/business-order
 * Fetches all data from internal APIs, generates a PDF report, returns it.
 */
export async function GET(request: Request) {
  try {
    const origin = new URL(request.url).origin;

    // Fetch all data in parallel from internal APIs
    const [clientsRes, tasksRes, leadsRes, campaignsRes] = await Promise.all([
      fetch(`${origin}/api/data/clients`, { cache: 'no-store' }),
      fetch(`${origin}/api/data/tasks`, { cache: 'no-store' }),
      fetch(`${origin}/api/data/leads`, { cache: 'no-store' }),
      fetch(`${origin}/api/data/campaigns`, { cache: 'no-store' }),
    ]);

    const [clients, tasks, leads, campaigns] = await Promise.all([
      clientsRes.ok ? clientsRes.json() : [],
      tasksRes.ok ? tasksRes.json() : [],
      leadsRes.ok ? leadsRes.json() : [],
      campaignsRes.ok ? campaignsRes.json() : [],
    ]);

    // Generate PDF
    const pdfBytes = generateBusinessOrderReport({
      clients: Array.isArray(clients) ? clients : [],
      tasks: Array.isArray(tasks) ? tasks : [],
      leads: Array.isArray(leads) ? leads : [],
      campaigns: Array.isArray(campaigns) ? campaigns : [],
    });

    // Build filename with date
    const dateStr = new Date().toISOString().split('T')[0];
    const filename = `business-order-report-${dateStr}.pdf`;

    return new NextResponse(pdfBytes, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    console.error('[BusinessOrderReport] Error generating report:', error);
    return NextResponse.json(
      { error: 'Failed to generate report', details: String(error) },
      { status: 500 }
    );
  }
}
