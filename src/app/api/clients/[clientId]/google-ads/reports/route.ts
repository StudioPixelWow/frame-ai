/** GET /api/clients/:clientId/google-ads/reports → list reports for a client. */
import { NextRequest, NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';

import { ensureSeeded } from '@/lib/db/seed';
import { listReportsForClient, getConnectionForClient } from '@/lib/google-ads/db';
import { googleAdsConfigured } from '@/lib/google-ads/provider';

export async function GET(_req: NextRequest, context: { params: Promise<{ clientId: string }> }) {
  ensureSeeded();
  const { clientId } = await context.params;
  const [reports, conn] = await Promise.all([
    listReportsForClient(clientId),
    getConnectionForClient(clientId),
  ]);
  // Trim heavy html out of the list payload.
  const slim = reports.map((r) => ({ ...r, jsonData: { ...r.jsonData, html: undefined } }));
  return NextResponse.json({ success: true, reports: slim, connection: conn, configured: googleAdsConfigured() });
}
