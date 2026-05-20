/**
 * GET /api/meta-business/adsets?adAccountId=act_XXX&accessToken=...
 *   → Fetch all ad sets from a Meta ad account
 *
 * POST /api/meta-business/adsets
 *   → Create a new ad set on Meta + save locally
 */

import { NextRequest, NextResponse } from 'next/server';
import { adSets } from '@/lib/db';

export const dynamic = 'force-dynamic';

const API_BASE = 'https://graph.facebook.com/v19.0';

const ADSET_FIELDS = [
  'id',
  'name',
  'status',
  'daily_budget',
  'lifetime_budget',
  'start_time',
  'end_time',
  'targeting',
  'optimization_goal',
  'billing_event',
  'bid_strategy',
  'bid_amount',
  'promoted_object',
].join(',');

/* ── GET: Fetch ad sets from Meta ── */

export async function GET(req: NextRequest) {
  try {
    const adAccountId = req.nextUrl.searchParams.get('adAccountId');
    const accessToken = req.nextUrl.searchParams.get('accessToken');

    if (!adAccountId || !accessToken) {
      return NextResponse.json(
        { error: 'adAccountId and accessToken are required' },
        { status: 400 },
      );
    }

    const actId = adAccountId.startsWith('act_') ? adAccountId : `act_${adAccountId}`;
    const url = `${API_BASE}/${actId}/adsets?fields=${ADSET_FIELDS}&limit=100&access_token=${encodeURIComponent(accessToken)}`;

    const res = await fetch(url, {
      method: 'GET',
      signal: AbortSignal.timeout(30000),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      const fbError = (body as Record<string, unknown>)?.error as Record<string, unknown> | undefined;
      return NextResponse.json(
        { error: (fbError?.message as string) || `Meta API error: HTTP ${res.status}` },
        { status: res.status },
      );
    }

    const body = await res.json();
    let allData = body.data || [];

    // Handle pagination
    let nextUrl = body.paging?.next;
    let pageCount = 0;
    while (nextUrl && pageCount < 10) {
      pageCount++;
      const nextRes = await fetch(nextUrl, { signal: AbortSignal.timeout(30000) });
      if (!nextRes.ok) break;
      const nextBody = await nextRes.json();
      allData = [...allData, ...(nextBody.data || [])];
      nextUrl = nextBody.paging?.next;
    }

    return NextResponse.json({ data: allData, total: allData.length });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    console.error('[meta-business/adsets] GET error:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

/* ── POST: Create ad set on Meta ── */

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      adAccountId,
      accessToken,
      campaignId,
      name,
      dailyBudget,
      lifetimeBudget,
      startTime,
      endTime,
      targeting,
      optimizationGoal,
      billingEvent,
      bidStrategy,
      status,
      localCampaignId,
    } = body as {
      adAccountId: string;
      accessToken: string;
      campaignId: string;
      name: string;
      dailyBudget?: number;
      lifetimeBudget?: number;
      startTime?: string;
      endTime?: string;
      targeting: Record<string, unknown>;
      optimizationGoal?: string;
      billingEvent?: string;
      bidStrategy?: string;
      status?: string;
      localCampaignId?: string;
    };

    if (!adAccountId || !accessToken) {
      return NextResponse.json({ error: 'adAccountId and accessToken are required' }, { status: 400 });
    }
    if (!campaignId || !name) {
      return NextResponse.json({ error: 'campaignId and name are required' }, { status: 400 });
    }
    if (!targeting) {
      return NextResponse.json({ error: 'targeting is required' }, { status: 400 });
    }

    const actId = adAccountId.startsWith('act_') ? adAccountId : `act_${adAccountId}`;
    const url = `${API_BASE}/${actId}/adsets`;

    const metaBody: Record<string, unknown> = {
      campaign_id: campaignId,
      name,
      status: status || 'PAUSED',
      billing_event: billingEvent || 'IMPRESSIONS',
      optimization_goal: optimizationGoal || 'LINK_CLICKS',
      targeting: typeof targeting === 'string' ? JSON.parse(targeting) : targeting,
      access_token: accessToken,
    };

    if (dailyBudget) metaBody.daily_budget = dailyBudget;
    if (lifetimeBudget) metaBody.lifetime_budget = lifetimeBudget;
    if (startTime) metaBody.start_time = startTime;
    if (endTime) metaBody.end_time = endTime;
    if (bidStrategy) metaBody.bid_strategy = bidStrategy;

    console.log(`[meta-business/adsets] POST creating ad set "${name}" on Meta`);

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(metaBody),
      signal: AbortSignal.timeout(30000),
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      const fbError = (data as Record<string, unknown>)?.error as Record<string, unknown> | undefined;
      return NextResponse.json(
        {
          error: (fbError?.message as string) || `Meta API error: HTTP ${res.status}`,
          errorCode: fbError?.code,
          rawResponse: data,
        },
        { status: res.status },
      );
    }

    const metaAdSetId = (data as Record<string, unknown>)?.id as string;
    console.log(`[meta-business/adsets] Created ad set on Meta: ${metaAdSetId}`);

    // Save to local DB if localCampaignId provided
    let localRecord = null;
    if (localCampaignId) {
      try {
        const targetingObj = typeof targeting === 'string' ? JSON.parse(targeting) : targeting;
        localRecord = await adSets.createAsync({
          campaignId: localCampaignId,
          name,
          status: (status || 'PAUSED').toLowerCase() === 'active' ? 'active' : 'draft',
          ageMin: (targetingObj.age_min as number) || null,
          ageMax: (targetingObj.age_max as number) || null,
          genders: targetingObj.genders
            ? (targetingObj.genders as number[]).map((g: number) => g === 1 ? 'male' : g === 2 ? 'female' : 'all')
            : ['all'],
          geoLocations: targetingObj.geo_locations?.countries || [],
          interests: (targetingObj.interests || []).map((i: { name?: string; id?: string }) => i.name || i.id || ''),
          customAudiences: [],
          excludedAudiences: [],
          placements: [],
          dailyBudget: dailyBudget ? dailyBudget / 100 : null,
          lifetimeBudget: lifetimeBudget ? lifetimeBudget / 100 : null,
          startDate: startTime || null,
          endDate: endTime || null,
          bidStrategy: null,
          bidAmount: null,
          metaAdSetId,
          lastSyncedAt: new Date().toISOString(),
          notes: '',
        } as any);
      } catch (dbErr) {
        console.warn('[meta-business/adsets] Local DB save failed (non-critical):', dbErr);
      }
    }

    return NextResponse.json({
      success: true,
      metaAdSetId,
      localRecord,
    }, { status: 201 });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    console.error('[meta-business/adsets] POST error:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
