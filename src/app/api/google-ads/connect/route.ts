/** POST /api/google-ads/connect  body: { clientId, customerId, refreshToken } */
import { NextRequest, NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';

import { ensureSeeded } from '@/lib/db/seed';
import { googleAdsConnections, getConnectionForClient, logGoogleAds } from '@/lib/google-ads/db';

export async function POST(req: NextRequest) {
  ensureSeeded();
  try {
    const body = await req.json();
    const clientId = String(body.clientId || '');
    if (!clientId) return NextResponse.json({ error: 'clientId נדרש' }, { status: 400 });
    const now = new Date().toISOString();
    const existing = await getConnectionForClient(clientId);
    const payload = {
      clientId,
      customerId: String(body.customerId || '').replace(/[^0-9]/g, ''),
      refreshToken: String(body.refreshToken || ''),
      status: 'connected' as const,
      updatedAt: now,
    };
    if (existing) {
      const updated = await googleAdsConnections.updateAsync(existing.id, payload as any);
      await logGoogleAds(clientId, 'info', 'Google Ads connection updated.');
      return NextResponse.json({ success: true, connection: updated });
    }
    const created = await googleAdsConnections.createAsync({ ...payload, createdAt: now } as any);
    await logGoogleAds(clientId, 'info', 'Google Ads connection created.');
    return NextResponse.json({ success: true, connection: created });
  } catch (e) {
    console.error('[google-ads/connect] error:', e instanceof Error ? e.message : e);
    return NextResponse.json({ error: 'שמירת החיבור נכשלה' }, { status: 400 });
  }
}
