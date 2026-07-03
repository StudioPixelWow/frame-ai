/**
 * GET/POST /api/settings/email-automations
 *
 * Global safety switch for email automations.
 * GET  → returns { enabled: boolean }
 * POST → sets { enabled: boolean }, clears cache
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/db/store';
import { clearEmailEnabledCache } from '@/lib/email/email-service';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const sb = getSupabase();
    const { data } = await sb
      .from('app_settings')
      .select('value')
      .eq('key', 'email_automations_enabled')
      .maybeSingle();

    const enabled = data?.value?.enabled === true;
    return NextResponse.json({ enabled });
  } catch (e: any) {
    console.error('[Settings/email-automations] GET error:', e);
    return NextResponse.json({ enabled: false, error: e.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const enabled = body.enabled === true;

    const sb = getSupabase();
    await sb.from('app_settings').upsert(
      {
        key: 'email_automations_enabled',
        value: { enabled, updatedAt: new Date().toISOString() },
      },
      { onConflict: 'key' }
    );

    // Clear server-side cache so sendEmail picks up the change immediately
    clearEmailEnabledCache();

    return NextResponse.json({ success: true, enabled });
  } catch (e: any) {
    console.error('[Settings/email-automations] POST error:', e);
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}
