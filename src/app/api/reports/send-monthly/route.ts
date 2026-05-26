/**
 * POST /api/reports/send-monthly
 *
 * Manual trigger to generate and send a monthly report for a specific client
 * or all active clients. Used from the dashboard/reports page UI.
 *
 * Body: { clientId?: string, sendEmail?: boolean }
 *   - clientId: specific client ID (optional — sends to all if omitted)
 *   - sendEmail: whether to actually send emails (default: true)
 */

import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { clientId, sendEmail: shouldSend = true } = body as {
      clientId?: string;
      sendEmail?: boolean;
    };

    // Build the cron URL with manual flag
    const baseUrl = req.nextUrl.origin;
    const params = new URLSearchParams({ manual: 'true' });
    if (clientId) params.set('clientId', clientId);

    const cronUrl = `${baseUrl}/api/cron/monthly-client-reports?${params.toString()}`;

    // Call the cron endpoint internally
    const response = await fetch(cronUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const result = await response.json();

    return NextResponse.json(result, { status: response.status });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
