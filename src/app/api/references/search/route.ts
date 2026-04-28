/**
 * POST /api/references/search — unified reference search
 *
 * Input:  { ideaTitle, clientIndustry?, keywords?, contentType?, platform? }
 * Output: { status, message, references[] }
 *
 * Priority:
 *   1. DB (app_ad_references) — previously synced data
 *   2. Live Meta Ads Library search
 *   3. Empty array with clear status message
 *
 * NO mock data. NO curated fallbacks.
 */

import { NextRequest, NextResponse } from 'next/server';
import { adReferences } from '@/lib/db/collections';
import { fetchMetaAdsReferences } from '@/lib/meta-ads/service';
import { requireRole } from '@/lib/auth/api-guard';

interface SearchBody {
  ideaTitle?: string;
  clientIndustry?: string;
  keywords?: string;
  contentType?: string;
  platform?: string;
  clientName?: string;
}

export async function POST(req: NextRequest) {
  const roleErr = requireRole(req, 'admin');
  if (roleErr) return roleErr;

  try {
    const body: SearchBody = await req.json();
    const { ideaTitle, clientIndustry, keywords, contentType, platform, clientName } = body;

    // Build search query from available fields
    const searchParts = [ideaTitle, clientName, clientIndustry, keywords].filter(Boolean);
    const searchQuery = searchParts.join(' ').trim();

    if (!searchQuery) {
      return NextResponse.json({
        status: 'empty',
        message: 'אין מונח חיפוש — הזן שם רעיון או תעשייה',
        references: [],
      });
    }

    console.log(`[references/search] Query: "${searchQuery}" (industry=${clientIndustry || '*'}, type=${contentType || '*'})`);

    // ── Step 1: Check DB for previously synced references ──
    try {
      const dbItems = await adReferences.getAllAsync();
      const queryLower = searchQuery.toLowerCase();

      const matched = (dbItems as any[])
        .filter((r: any) => {
          if (r.isActive === false) return false;
          if (!r.imageUrl && !r.sourceUrl) return false;

          // Filter by content type / platform if specified
          if (contentType && r.contentType !== contentType) return false;
          if (platform && r.platform !== platform && r.platform !== 'all') return false;

          // Match against search query
          const searchable = [
            r.description,
            r.advertiserName,
            r.industry,
            ...(r.tags || []),
          ].filter(Boolean).join(' ').toLowerCase();

          return searchable.includes(queryLower) ||
            queryLower.split(' ').some((word: string) => word.length > 2 && searchable.includes(word));
        })
        .slice(0, 6)
        .map((r: any) => ({
          id: r.id,
          imageUrl: r.imageUrl || '',
          description: r.description || '',
          source: r.source || 'database',
          sourceUrl: r.sourceUrl || '',
          advertiserName: r.advertiserName || '',
          style: r.style || 'minimal',
          contentType: r.contentType || '',
          platform: r.platform || '',
          industry: r.industry || '',
          tags: r.tags || [],
          engagementScore: r.engagementScore || 0,
          isActive: true,
        }));

      if (matched.length > 0) {
        console.log(`[references/search] Found ${matched.length} DB matches`);
        return NextResponse.json({
          status: 'ok',
          message: `${matched.length} רפרנסים נמצאו`,
          references: matched,
        });
      }
    } catch (dbErr) {
      console.warn('[references/search] DB search failed:', dbErr);
    }

    // ── Step 2: Live Meta Ads Library search ──
    const metaResult = await fetchMetaAdsReferences(searchQuery);

    if (metaResult.status === 'no_token') {
      return NextResponse.json({
        status: 'no_token',
        message: 'אין רפרנסים – חבר מקור נתונים',
        references: [],
      });
    }

    if (metaResult.status === 'error') {
      return NextResponse.json({
        status: 'error',
        message: 'לא ניתן לטעון נתונים מספריית המודעות',
        references: [],
      }, { status: 502 });
    }

    if (metaResult.references.length === 0) {
      return NextResponse.json({
        status: 'empty',
        message: 'לא נמצאו רפרנסים עבור חיפוש זה',
        references: [],
      });
    }

    return NextResponse.json({
      status: 'ok',
      message: `${metaResult.references.length} מודעות מ-Meta Ads Library`,
      references: metaResult.references.slice(0, 6),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    console.error('[references/search] Error:', msg);
    return NextResponse.json({
      status: 'error',
      message: 'שגיאה בחיפוש רפרנסים',
      references: [],
    }, { status: 500 });
  }
}
