/** GET /api/whatsapp/qr-status — QR-service connection state + QR image (admin/employee only). */
import { NextRequest, NextResponse } from 'next/server';
import { getRequestRole } from '@/lib/auth/api-guard';
import { whatsappConfigured, waStatus } from '@/lib/whatsapp/qr-service';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  if (getRequestRole(req) === 'client') return NextResponse.json({ error: 'אין הרשאה' }, { status: 403 });
  if (!whatsappConfigured()) return NextResponse.json({ configured: false, state: 'not_configured' });
  const r = await waStatus();
  return NextResponse.json({ configured: true, ...r.data }, { status: r.ok ? 200 : 502 });
}
