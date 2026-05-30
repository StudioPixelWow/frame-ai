/**
 * POST /api/meta-business/assign-campaign
 *   Assign (or unassign) a single campaign to a client.
 *   Body: { metaCampaignId, adAccountId?, campaignName?, clientId, clientName? }
 *   clientId falsy → unassign.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
);

async function getSystemToken(): Promise<string | null> {
  try {
    const { data } = await supabase.from('app_settings').select('value').eq('key', 'meta_business_token').maybeSingle();
    const v: any = data?.value;
    if (v) return typeof v === 'string' ? v : v.access_token || null;
    const { data: m } = await supabase.from('app_meta_business').select('config').maybeSingle();
    return (m?.config as any)?.access_token || null;
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { metaCampaignId, adAccountId, campaignName, clientId, clientName } = body as {
      metaCampaignId?: string; adAccountId?: string; campaignName?: string; clientId?: string; clientName?: string;
    };

    if (!metaCampaignId) {
      return NextResponse.json({ error: 'חסר מזהה קמפיין' }, { status: 400 });
    }

    // Unassign
    if (!clientId) {
      const { error } = await supabase.from('app_meta_campaign_assignments').delete().eq('meta_campaign_id', metaCampaignId);
      if (error) return NextResponse.json({ error: `שגיאה בביטול שיוך: ${error.message}` }, { status: 500 });
      return NextResponse.json({ success: true, action: 'unassigned', metaCampaignId });
    }

    const token = await getSystemToken();
    const { error } = await supabase
      .from('app_meta_campaign_assignments')
      .upsert(
        {
          meta_campaign_id: metaCampaignId,
          ad_account_id: adAccountId || null,
          campaign_name: campaignName || null,
          client_id: clientId,
          client_name: clientName || null,
          access_token: token,
          assigned_at: new Date().toISOString(),
        },
        { onConflict: 'meta_campaign_id' },
      );

    if (error) {
      // Most likely the table doesn't exist yet
      return NextResponse.json(
        { error: `שגיאה בשמירת שיוך הקמפיין: ${error.message} — ודא שטבלת app_meta_campaign_assignments קיימת` },
        { status: 500 },
      );
    }

    return NextResponse.json({ success: true, action: 'assigned', metaCampaignId, clientId });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'שגיאה לא צפויה';
    console.error('[meta-business/assign-campaign] error:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
