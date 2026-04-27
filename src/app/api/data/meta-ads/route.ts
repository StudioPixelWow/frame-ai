/**
 * GET  /api/data/meta-ads?q=...       — search Meta Ads Library
 * GET  /api/data/meta-ads?status=true  — check connection status
 * POST /api/data/meta-ads/sync        — sync results into app_ad_references
 *
 * Real integration with Meta (Facebook) Ads Library API.
 * Requires META_ACCESS_TOKEN in environment.
 */

import { NextRequest, NextResponse } from 'next/server';
import { checkConnection, searchAds, metaAdToReference } from '@/lib/meta-ads/service';
import { adReferences } from '@/lib/db/collections';
import { requireRole } from '@/lib/auth/api-guard';

export async function GET(req: NextRequest) {
  // Admin only
  const roleErr = requireRole(req, 'admin');
  if (roleErr) return roleErr;

  const { searchParams } = new URL(req.url);

  // Connection status check
  if (searchParams.has('status')) {
    const status = await checkConnection();
    return NextResponse.json(status);
  }

  // Search ads
  const query = searchParams.get('q') || searchParams.get('search_terms');
  if (!query) {
    return NextResponse.json(
      { error: 'Missing search query. Use ?q=search+terms' },
      { status: 400 }
    );
  }

  try {
    const countries = searchParams.get('countries')?.split(',') || ['IL'];
    const limit = Math.min(parseInt(searchParams.get('limit') || '25'), 100);
    const activeStatus = (searchParams.get('active') || 'ACTIVE') as 'ACTIVE' | 'INACTIVE' | 'ALL';

    const ads = await searchAds({
      searchTerms: query,
      adReachedCountries: countries,
      adActiveStatus: activeStatus,
      limit,
    });

    // Convert to our reference format
    const references = ads.map(metaAdToReference);

    return NextResponse.json({
      count: references.length,
      query,
      source: 'meta_ads_library',
      results: references,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    console.error('[meta-ads] Search error:', msg);

    // Specific error for missing token
    if (msg.includes('META_ACCESS_TOKEN')) {
      return NextResponse.json({
        error: msg,
        needsToken: true,
        setupInstructions: 'הגדר META_ACCESS_TOKEN ב-.env.local כדי לחבר את ספריית המודעות של Meta',
      }, { status: 503 });
    }

    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  // Admin only
  const roleErr = requireRole(req, 'admin');
  if (roleErr) return roleErr;

  try {
    const body = await req.json();
    const { searchTerms, countries, limit, saveToDb } = body;

    if (!searchTerms) {
      return NextResponse.json({ error: 'Missing searchTerms' }, { status: 400 });
    }

    const ads = await searchAds({
      searchTerms,
      adReachedCountries: countries || ['IL'],
      limit: limit || 25,
    });

    const references = ads.map(metaAdToReference);

    // Optionally save to app_ad_references DB
    let savedCount = 0;
    if (saveToDb && references.length > 0) {
      for (const ref of references) {
        try {
          await adReferences.createAsync(ref as any);
          savedCount++;
        } catch (e) {
          console.warn('[meta-ads] Failed to save ref:', e);
        }
      }
      console.log(`[meta-ads] Saved ${savedCount}/${references.length} references to DB`);
    }

    return NextResponse.json({
      count: references.length,
      savedToDb: savedCount,
      source: 'meta_ads_library',
      results: references,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    console.error('[meta-ads] POST error:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
