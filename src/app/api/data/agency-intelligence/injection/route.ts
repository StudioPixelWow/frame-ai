/**
 * Playbook Injection API
 * GET: Get injection data for a specific industry + target
 * ?industry=real_estate&target=campaign_builder|gantt|podcast|strategy
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  getPlaybookInjection,
  injectForCampaignBuilder,
  injectForGantt,
  injectForPodcast,
  injectForStrategy,
} from '@/lib/agency-intelligence/playbook-injection';

export async function GET(req: NextRequest) {
  try {
    const industry = req.nextUrl.searchParams.get('industry');
    if (!industry) {
      return NextResponse.json({ error: 'industry parameter required' }, { status: 400 });
    }

    const target = req.nextUrl.searchParams.get('target');

    switch (target) {
      case 'campaign_builder':
        return NextResponse.json(await injectForCampaignBuilder(industry));
      case 'gantt':
        return NextResponse.json(await injectForGantt(industry));
      case 'podcast':
        return NextResponse.json(await injectForPodcast(industry));
      case 'strategy':
        return NextResponse.json(await injectForStrategy(industry));
      default:
        return NextResponse.json(await getPlaybookInjection(industry));
    }
  } catch {
    return NextResponse.json({ error: 'Failed to get injection data' }, { status: 500 });
  }
}
