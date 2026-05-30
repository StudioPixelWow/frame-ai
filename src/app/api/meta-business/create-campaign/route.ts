/**
 * POST /api/meta-business/create-campaign
 *   Create a new campaign on Meta (PAUSED by default for safety).
 *   Body: { clientId, name, objective, dailyBudget?, adAccountId? }
 *   Token + ad account resolved centrally / from the client.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/db/store';
import { resolveMetaToken } from '@/lib/meta-ads/token';
import { createMetaCampaign } from '@/lib/meta-ads/write-service';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { clientId, name, objective, dailyBudget, adAccountId, status } = body as {
      clientId?: string; name?: string; objective?: string; dailyBudget?: number; adAccountId?: string; status?: 'ACTIVE' | 'PAUSED';
    };

    if (!name || !objective) {
      return NextResponse.json({ error: 'חסר שם קמפיין או מטרה (objective)' }, { status: 400 });
    }

    const sb = getSupabase();
    let token: string | null = null;
    let acct = adAccountId || '';

    if (clientId) {
      const { data: client } = await sb.from('clients').select('*').eq('id', clientId).maybeSingle();
      const c = client as any;
      token = await resolveMetaToken(c?.meta_access_token || c?.metaAccessToken);
      if (!acct) acct = c?.meta_ad_account_id || c?.metaAdAccountId || '';
    } else {
      token = await resolveMetaToken(null);
    }

    if (!token) return NextResponse.json({ error: 'אין אסימון גישה' }, { status: 400 });
    if (!acct) return NextResponse.json({ error: 'לא נמצא חשבון מודעות ללקוח — שייך חשבון תחילה' }, { status: 400 });

    const result = await createMetaCampaign(
      { accessToken: token, adAccountId: acct },
      {
        name,
        objective,
        status: status || 'PAUSED', // safety: paused by default
        dailyBudget: dailyBudget ? Math.round(dailyBudget * 100) : undefined, // shekels → agorot
      },
    );

    if (!result.success) {
      return NextResponse.json({ error: result.error || 'יצירת הקמפיין נכשלה', result }, { status: 400 });
    }

    return NextResponse.json({ success: true, metaCampaignId: result.metaId, result });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'שגיאה לא צפויה';
    console.error('[meta-business/create-campaign] error:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
