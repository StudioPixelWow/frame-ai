/**
 * GET  /api/ai/client-insights?clientId=X          — all insights for a client
 * GET  /api/ai/client-insights?clientId=X&section=Y — specific section
 * POST /api/ai/client-insights                      — save an insight result
 *
 * Central persistence layer for all AI insight sections.
 * Each record: { clientId, section, payload, status, generatedAt }
 */

import { NextRequest, NextResponse } from 'next/server';
import { clientInsights } from '@/lib/db/collections';
import type { ClientInsight, InsightSection } from '@/lib/db/schema';

const VALID_SECTIONS: InsightSection[] = [
  'client_brain',
  'brand_weakness',
  'customer_profile',
  'trend_engine',
  'competitor_insights',
  'creative_dna',
];

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const clientId = searchParams.get('clientId');
    const section = searchParams.get('section') as InsightSection | null;

    if (!clientId) {
      return NextResponse.json({ error: 'Missing clientId' }, { status: 400 });
    }

    console.log(`[client-insights] GET clientId=${clientId} section=${section || 'all'}`);

    let all: ClientInsight[];
    try {
      all = await clientInsights.getAllAsync();
    } catch (dbError) {
      const msg = dbError instanceof Error ? dbError.message : '';
      if (msg.includes('does not exist') || msg.includes('relation')) {
        console.warn('[client-insights] GET: Table not found. Run /api/data/migrate-collections.');
        return NextResponse.json({ insights: {} }, { status: 200 });
      }
      throw dbError;
    }

    const forClient = all.filter(i => i.clientId === clientId);

    if (section) {
      const found = forClient.find(i => i.section === section);
      if (!found) {
        return NextResponse.json({ error: 'Not found' }, { status: 404 });
      }
      return NextResponse.json({ success: true, data: found }, { status: 200 });
    }

    // Return all sections as a map: { brand_weakness: {...}, trend_engine: {...}, ... }
    const insightMap: Record<string, ClientInsight> = {};
    for (const item of forClient) {
      insightMap[item.section] = item;
    }

    return NextResponse.json({ success: true, insights: insightMap }, { status: 200 });
  } catch (error) {
    console.error('[client-insights] GET error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { clientId, section, payload } = body as {
      clientId: string;
      section: InsightSection;
      payload: unknown;
    };

    if (!clientId || !section) {
      return NextResponse.json({ error: 'Missing clientId or section' }, { status: 400 });
    }
    if (!VALID_SECTIONS.includes(section)) {
      return NextResponse.json({ error: `Invalid section: ${section}` }, { status: 400 });
    }

    console.log(`[client-insights] POST: Saving ${section} for clientId=${clientId}`);

    const now = new Date().toISOString();

    // Check for existing record for this client+section
    let existing: ClientInsight | null = null;
    try {
      const all = await clientInsights.getAllAsync();
      existing = all.find(i => i.clientId === clientId && i.section === section) || null;
    } catch {
      // Table might not exist yet — proceed with create
    }

    let saved: ClientInsight;
    if (existing) {
      const updated = await clientInsights.updateAsync(existing.id, {
        payload,
        status: 'ready' as const,
        error: undefined,
        generatedAt: now,
        updatedAt: now,
      });
      if (!updated) throw new Error('Failed to update insight');
      saved = updated;
      console.log(`[client-insights] POST: Updated existing ${section} (id=${existing.id})`);
    } else {
      saved = await clientInsights.createAsync({
        clientId,
        section,
        payload,
        status: 'ready' as const,
        generatedAt: now,
        createdAt: now,
        updatedAt: now,
      } as Omit<ClientInsight, 'id'> as ClientInsight);
      console.log(`[client-insights] POST: Created new ${section} (id=${saved.id})`);
    }

    return NextResponse.json({ success: true, data: saved }, { status: 200 });
  } catch (error) {
    console.error('[client-insights] POST error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
