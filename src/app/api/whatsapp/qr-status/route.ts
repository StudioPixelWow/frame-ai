/** GET /api/whatsapp/qr-status — QR-service connection state + QR image (admin/employee only). */
import { NextRequest, NextResponse } from 'next/server';
import { getRequestRole } from '@/lib/auth/api-guard';
import { whatsappConfigured, waStatus } from '@/lib/whatsapp/qr-service';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  if (getRequestRole(req) === 'client') return NextResponse.json({ error: 'אין הרשאה' }, { status: 403 });
  if (!whatsappConfigured()) return NextResponse.json({ configured: false, state: 'not_configured' });
  const r = await waStatus();
  // When the microservice doesn't respond (asleep, crashed, bad URL/secret),
  // report an explicit 'unreachable' state with the underlying reason so the UI
  // can show a clear message + retry instead of an endless "connecting…".
  if (!r.ok) {
    return NextResponse.json(
      { configured: true, state: 'unreachable', error: (r.data && (r.data as any).error) || `service_status_${r.status || 0}` },
      { status: 200 },
    );
  }
  return NextResponse.json({ configured: true, ...r.data }, { status: 200 });
}
