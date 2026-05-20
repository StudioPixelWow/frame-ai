/**
 * GET /api/meta-business/adsets/[id]?accessToken=...
 *   → Fetch single ad set details from Meta
 *
 * PUT /api/meta-business/adsets/[id]
 *   → Update an ad set on Meta
 */

import { NextRequest, NextResponse } from 'next/server';

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
  'campaign_id',
].join(',');

/* ── GET: Fetch single ad set from Meta ── */

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const accessToken = req.nextUrl.searchParams.get('accessToken');

    if (!accessToken) {
      return NextResponse.json({ error: 'accessToken is required' }, { status: 400 });
    }

    const url = `${API_BASE}/${id}?fields=${ADSET_FIELDS}&access_token=${encodeURIComponent(accessToken)}`;

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

    const data = await res.json();
    return NextResponse.json(data);
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[meta-business/adsets/[id]] GET error:`, msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

/* ── PUT: Update ad set on Meta ── */

export async function PUT(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const body = await req.json();
    const {
      accessToken,
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
    } = body as {
      accessToken: string;
      name?: string;
      dailyBudget?: number;
      lifetimeBudget?: number;
      startTime?: string;
      endTime?: string;
      targeting?: Record<string, unknown>;
      optimizationGoal?: string;
      billingEvent?: string;
      bidStrategy?: string;
      status?: string;
    };

    if (!accessToken) {
      return NextResponse.json({ error: 'accessToken is required' }, { status: 400 });
    }

    // Meta uses POST method for updates
    const url = `${API_BASE}/${id}`;

    const metaBody: Record<string, unknown> = {
      access_token: accessToken,
    };

    if (name !== undefined) metaBody.name = name;
    if (status !== undefined) metaBody.status = status;
    if (dailyBudget !== undefined) metaBody.daily_budget = dailyBudget;
    if (lifetimeBudget !== undefined) metaBody.lifetime_budget = lifetimeBudget;
    if (startTime !== undefined) metaBody.start_time = startTime;
    if (endTime !== undefined) metaBody.end_time = endTime;
    if (optimizationGoal !== undefined) metaBody.optimization_goal = optimizationGoal;
    if (billingEvent !== undefined) metaBody.billing_event = billingEvent;
    if (bidStrategy !== undefined) metaBody.bid_strategy = bidStrategy;
    if (targeting !== undefined) {
      metaBody.targeting = typeof targeting === 'string' ? JSON.parse(targeting) : targeting;
    }

    console.log(`[meta-business/adsets/[id]] Updating ad set ${id} on Meta`);

    const res = await fetch(url, {
      method: 'POST', // Meta API uses POST for updates
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

    console.log(`[meta-business/adsets/[id]] Updated ad set ${id} on Meta`);

    return NextResponse.json({
      success: true,
      metaAdSetId: id,
      rawResponse: data,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[meta-business/adsets/[id]] PUT error:`, msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
