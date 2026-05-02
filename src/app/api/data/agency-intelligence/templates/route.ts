/**
 * Templates API
 * GET: Get templates (optional ?type=campaign|ad|content&industry=)
 * POST: Save template or seed defaults
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  getCampaignTemplates, saveCampaignTemplate,
  getAdTemplates, saveAdTemplate,
  getContentTemplates, saveContentTemplate,
  seedDefaultTemplates,
} from '@/lib/agency-intelligence/templates';

export async function GET(req: NextRequest) {
  try {
    const type = req.nextUrl.searchParams.get('type') || 'all';
    const industry = req.nextUrl.searchParams.get('industry') || undefined;

    if (type === 'campaign') return NextResponse.json(await getCampaignTemplates(industry));
    if (type === 'ad') return NextResponse.json(await getAdTemplates(industry));
    if (type === 'content') return NextResponse.json(await getContentTemplates(industry));

    // All
    const [campaigns, ads, content] = await Promise.all([
      getCampaignTemplates(industry),
      getAdTemplates(industry),
      getContentTemplates(industry),
    ]);
    return NextResponse.json({ campaigns, ads, content });
  } catch {
    return NextResponse.json({ error: 'Failed to load templates' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // Seed defaults
    if (body.action === 'seed') {
      const result = await seedDefaultTemplates();
      return NextResponse.json({ success: true, seeded: result });
    }

    // Save by type
    const type = body.type;
    if (!body.industry) {
      return NextResponse.json({ error: 'industry is required' }, { status: 400 });
    }

    let success = false;
    if (type === 'campaign') success = await saveCampaignTemplate(body);
    else if (type === 'ad') success = await saveAdTemplate(body);
    else if (type === 'content') success = await saveContentTemplate(body);
    else return NextResponse.json({ error: 'type must be campaign, ad, or content' }, { status: 400 });

    if (!success) return NextResponse.json({ error: 'Failed to save' }, { status: 500 });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
}
