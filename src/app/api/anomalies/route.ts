/** GET /api/anomalies → { anomalies, clientsScanned } across all active clients.
 *  GET /api/anomalies?clientId=… → anomalies for a single client. */
import { NextRequest, NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

import { detectAllAnomalies, detectClientAnomalies } from '@/lib/anomaly/engine';

export async function GET(req: NextRequest) {
  try {
    const clientId = req.nextUrl.searchParams.get('clientId');
    const clientName = req.nextUrl.searchParams.get('clientName') || 'לקוח';
    if (clientId) {
      const anomalies = await detectClientAnomalies(clientId, clientName);
      return NextResponse.json({ success: true, anomalies, clientsScanned: 1 });
    }
    const res = await detectAllAnomalies();
    return NextResponse.json({ success: true, ...res });
  } catch {
    return NextResponse.json({ error: 'סריקת האנומליות נכשלה' }, { status: 500 });
  }
}
