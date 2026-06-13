/** POST /api/whatsapp/qr-restart — force the QR service to drop its session and
 *  re-initialize, which triggers a fresh QR (admin/employee only). */
import { NextRequest, NextResponse } from 'next/server';
import { getRequestRole } from '@/lib/auth/api-guard';
import { whatsappConfigured, waLogout } from '@/lib/whatsapp/qr-service';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  if (getRequestRole(req) === 'client') return NextResponse.json({ error: 'אין הרשאה' }, { status: 403 });
  if (!whatsappConfigured()) return NextResponse.json({ configured: false, state: 'not_configured' });
  const r = await waLogout();
  if (!r.ok) return NextResponse.json({ ok: false, error: (r.data && (r.data as any).error) || `service_status_${r.status || 0}` }, { status: 200 });
  return NextResponse.json({ ok: true });
}
