/**
 * GET /api/meta-business/account-campaigns?adAccountId=act_123
 *   Lists the campaigns inside an ad account (live from Meta) together with
 *   their current per-campaign client assignment. Used by the campaign-assignment UI.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const API_BASE = 'https://graph.facebook.com/v19.0';

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

export async function GET(req: NextRequest) {
  try {
    const adAccountId = req.nextUrl.searchParams.get('adAccountId');
    if (!adAccountId) {
      return NextResponse.json({ error: 'חסר מזהה חשבון מודעות (adAccountId)' }, { status: 400 });
    }

    const token = req.nextUrl.searchParams.get('accessToken') || (await getSystemToken());
    if (!token) {
      return NextResponse.json({ error: 'אין אסימון גישה — חבר את Meta Business Manager' }, { status: 400 });
    }

    // Live campaign list from Meta
    const url = `${API_BASE}/${adAccountId}/campaigns?fields=id,name,status,objective,daily_budget,lifetime_budget&limit=200&access_token=${encodeURIComponent(token)}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(20000) });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const fbErr = (data as any)?.error;
      return NextResponse.json({ error: fbErr?.message || `Meta API error HTTP ${res.status}`, code: fbErr?.code }, { status: res.status });
    }

    const campaigns = (data.data || []) as any[];

    // Current assignments for these campaigns
    const ids = campaigns.map((c) => c.id);
    const assignMap: Record<string, { clientId: string; clientName: string }> = {};
    if (ids.length > 0) {
      const { data: assigns } = await supabase
        .from('app_meta_campaign_assignments')
        .select('meta_campaign_id, client_id, client_name')
        .in('meta_campaign_id', ids);
      for (const a of (assigns || []) as any[]) {
        assignMap[a.meta_campaign_id] = { clientId: a.client_id, clientName: a.client_name };
      }
    }

    return NextResponse.json({
      campaigns: campaigns.map((c) => ({
        metaCampaignId: c.id,
        name: c.name,
        status: c.status,
        objective: c.objective || '',
        assignedClientId: assignMap[c.id]?.clientId || null,
        assignedClientName: assignMap[c.id]?.clientName || null,
      })),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'שגיאה לא צפויה';
    console.error('[meta-business/account-campaigns] error:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
