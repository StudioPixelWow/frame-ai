/**
 * POST /api/meta-business/build-ad
 *   Create an Ad Set + Ad under an existing campaign (PAUSED by default).
 *   Body: { clientId, campaignMetaId, adSetName, dailyBudget?, ageMin?, ageMax?,
 *           countries?, optimizationGoal?, pageId, message?, headline?, linkUrl?,
 *           imageUrl?, callToAction? }
 *   Token + ad account resolved centrally / from the client.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/db/store';
import { resolveMetaToken } from '@/lib/meta-ads/token';
import { createMetaAdSet, createMetaAd } from '@/lib/meta-ads/write-service';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const b = await req.json().catch(() => ({}));
    const { clientId, campaignMetaId, adSetName, dailyBudget, ageMin, ageMax, countries, optimizationGoal,
            pageId, message, headline, linkUrl, imageUrl, callToAction, adName } = b as Record<string, any>;

    if (!campaignMetaId || !adSetName) {
      return NextResponse.json({ error: 'חסר מזהה קמפיין או שם Ad Set' }, { status: 400 });
    }
    if (!pageId) {
      return NextResponse.json({ error: 'חסר Page ID — נדרש כדי לפרסם מודעה' }, { status: 400 });
    }

    const sb = getSupabase();
    let token: string | null = null;
    let acct = '';
    if (clientId) {
      const { data: client } = await sb.from('clients').select('*').eq('id', clientId).maybeSingle();
      const c = client as any;
      token = await resolveMetaToken(c?.meta_access_token || c?.metaAccessToken);
      acct = c?.meta_ad_account_id || c?.metaAdAccountId || '';
    } else {
      token = await resolveMetaToken(null);
    }
    if (!token) return NextResponse.json({ error: 'אין אסימון גישה' }, { status: 400 });
    if (!acct) return NextResponse.json({ error: 'לא נמצא חשבון מודעות ללקוח' }, { status: 400 });

    const creds = { accessToken: token, adAccountId: acct };

    // 1) Ad Set
    const adSetRes = await createMetaAdSet(creds, {
      campaignId: campaignMetaId,
      name: adSetName,
      status: 'PAUSED',
      dailyBudget: dailyBudget ? Math.round(dailyBudget * 100) : undefined,
      billingEvent: 'IMPRESSIONS',
      optimizationGoal: optimizationGoal || 'LEAD_GENERATION',
      targeting: {
        age_min: ageMin || 18,
        age_max: ageMax || 65,
        geo_locations: { countries: Array.isArray(countries) && countries.length ? countries : ['IL'] },
      },
    });
    if (!adSetRes.success || !adSetRes.metaId) {
      return NextResponse.json({ error: `יצירת Ad Set נכשלה: ${adSetRes.error || ''}`, step: 'adset', result: adSetRes }, { status: 400 });
    }

    // 2) Ad
    const adRes = await createMetaAd(creds, {
      adSetId: adSetRes.metaId,
      name: adName || adSetName,
      status: 'PAUSED',
      creative: { pageId, message, headline, linkUrl, imageUrl, callToAction: callToAction || 'LEARN_MORE' },
    });
    if (!adRes.success) {
      return NextResponse.json({ error: `Ad Set נוצר אך יצירת המודעה נכשלה: ${adRes.error || ''}`, step: 'ad', adSetId: adSetRes.metaId, result: adRes }, { status: 400 });
    }

    return NextResponse.json({ success: true, adSetId: adSetRes.metaId, adId: adRes.metaId });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'שגיאה לא צפויה';
    console.error('[meta-business/build-ad] error:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
