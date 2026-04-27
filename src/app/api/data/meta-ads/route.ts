/**
 * GET  /api/data/meta-ads?q=...        — search Meta Ads Library (real API)
 * GET  /api/data/meta-ads?status=true   — check connection status
 * POST /api/data/meta-ads              — search + optionally save results to DB
 *
 * REAL integration. NO fake data.
 * Requires META_ACCESS_TOKEN in .env.local
 */

import { NextRequest, NextResponse } from 'next/server';
import { checkConnection, searchAds, fetchMetaAdsReferences } from '@/lib/meta-ads/service';
import { adReferences } from '@/lib/db/collections';
import { requireRole } from '@/lib/auth/api-guard';

export async function GET(req: NextRequest) {
  const roleErr = requireRole(req, 'admin');
  if (roleErr) return roleErr;

  const { searchParams } = new URL(req.url);

  // Connection status check
  if (searchParams.has('status')) {
    const status = await checkConnection();
    return NextResponse.json(status);
  }

  // Search
  const query = searchParams.get('q') || searchParams.get('search_terms');
  if (!query) {
    return NextResponse.json(
      { error: 'Missing search query. Use ?q=search+terms' },
      { status: 400 }
    );
  }

  const limit = Math.min(parseInt(searchParams.get('limit') || '6'), 25);
  const result = await fetchMetaAdsReferences(query);

  if (result.status === 'no_token') {
    return NextResponse.json({
      error: 'חבר Meta Ads Library',
      needsToken: true,
      count: 0,
      results: [],
    }, { status: 503 });
  }

  if (result.status === 'error') {
    return NextResponse.json({
      error: result.message,
      count: 0,
      results: [],
    }, { status: 502 });
  }

  return NextResponse.json({
    count: result.references.length,
    query,
    source: 'meta_ads_library',
    results: result.references.slice(0, limit),
  });
}

export async function POST(req: NextRequest) {
  const roleErr = requireRole(req, 'admin');
  if (roleErr) return roleErr;

  try {
    const body = await req.json();
    const { searchTerms, saveToDb } = body;

    if (!searchTerms) {
      return NextResponse.json({ error: 'Missing searchTerms' }, { status: 400 });
    }

    const result = await fetchMetaAdsReferences(searchTerms);

    if (result.status === 'no_token') {
      return NextResponse.json({
        error: 'חבר Meta Ads Library',
        needsToken: true,
      }, { status: 503 });
    }

    if (result.status === 'error') {
      return NextResponse.json({
        error: result.message,
      }, { status: 502 });
    }

    // Save to DB if requested
    let savedCount = 0;
    if (saveToDb && result.references.length > 0) {
      for (const ref of result.references) {
        try {
          await adReferences.createAsync({
            imageUrl: ref.imageUrl,
            description: ref.description,
            source: 'meta_ads_library',
            sourceUrl: ref.sourceUrl,
            advertiserName: ref.advertiserName,
            style: ref.style,
            contentType: ref.contentType,
            platform: ref.platform,
            industry: ref.industry,
            tags: ref.tags,
            engagementScore: ref.engagementScore,
            isActive: ref.isActive,
          } as any);
          savedCount++;
        } catch (e) {
          console.warn('[meta-ads] Failed to save ref:', e);
        }
      }
      console.log(`[meta-ads] Saved ${savedCount}/${result.references.length} references to DB`);
    }

    return NextResponse.json({
      count: result.references.length,
      savedToDb: savedCount,
      source: 'meta_ads_library',
      results: result.references,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    console.error('[meta-ads] POST error:', msg);
    return NextResponse.json({
      error: 'לא ניתן לטעון נתונים מספריית המודעות',
    }, { status: 500 });
  }
}
