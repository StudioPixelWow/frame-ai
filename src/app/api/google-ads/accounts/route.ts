/** GET /api/google-ads/accounts → connection state + whether live API is configured.
 *  Optional ?clientId= to get a single client's connection. */
import { NextRequest, NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';

import { ensureSeeded } from '@/lib/db/seed';
import { googleAdsConnections, getConnectionForClient } from '@/lib/google-ads/db';
import { googleAdsConfigured } from '@/lib/google-ads/provider';

export async function GET(req: NextRequest) {
  ensureSeeded();
  const clientId = req.nextUrl.searchParams.get('clientId');
  const configured = googleAdsConfigured();
  if (clientId) {
    const conn = await getConnectionForClient(clientId);
    return NextResponse.json({ success: true, configured, connection: conn });
  }
  const all = await googleAdsConnections.getAllAsync().catch(() => []);
  return NextResponse.json({ success: true, configured, connections: all });
}
