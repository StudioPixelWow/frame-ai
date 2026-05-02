/**
 * POST /api/data/content-to-ads
 *
 * Takes source content and generates ad variations.
 * Optionally saves as draft ads to a campaign/adSet.
 *
 * Body: {
 *   source: ContentSource,
 *   campaignId?: string,  // if provided, saves drafts
 *   adSetId?: string,     // if provided, saves drafts
 *   save?: boolean,       // default false — preview only
 * }
 */

import { NextRequest, NextResponse } from 'next/server';
import { generateAdVariations, variationsToAds } from '@/lib/ai/content-to-ads';
import type { ContentSource } from '@/lib/ai/content-to-ads';
import { ads } from '@/lib/db';

export async function POST(req: NextRequest) {
  try {
    const role = req.headers.get('x-app-role') || req.headers.get('x-user-role') || 'viewer';
    if (role === 'client') {
      return NextResponse.json({ error: 'לקוחות לא יכולים ליצור מודעות' }, { status: 403 });
    }

    const body = await req.json();
    const { source, campaignId, adSetId, save } = body as {
      source: ContentSource;
      campaignId?: string;
      adSetId?: string;
      save?: boolean;
    };

    if (!source || !source.title || !source.description) {
      return NextResponse.json({ error: 'source with title and description is required' }, { status: 400 });
    }

    // Generate variations
    const result = generateAdVariations(source);

    // If save requested AND campaign/adSet provided → save as draft ads
    if (save && campaignId && adSetId) {
      const adRecords = variationsToAds(result.variations, campaignId, adSetId);
      const saved = [];

      for (const adData of adRecords) {
        try {
          const created = await ads.createAsync(adData as any);
          saved.push(created);
        } catch (e) {
          console.error('[content-to-ads] Failed to save ad:', e);
        }
      }

      return NextResponse.json({
        ...result,
        saved: saved.length,
        savedAds: saved,
        message: `נוצרו ${saved.length} מודעות כטיוטה`,
      });
    }

    // Preview only
    return NextResponse.json(result);
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
