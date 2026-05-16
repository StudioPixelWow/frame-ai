import { NextRequest, NextResponse } from 'next/server';
import {
  analyzeAIVisibility,
  generateCitationStrategy,
  identifyAuthorityGaps,
  generateFullGEOStrategy,
  buildMentionStrategy,
  trackAIMentions,
  suggestDirectoryListings,
} from '@/lib/seo/geo-booster';

export const runtime = 'nodejs';
export const maxDuration = 60;

// ============================================================================
// GET — קבלת אסטרטגיית GEO / ניתוח נראות AI
// ============================================================================

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const action = searchParams.get('action'); // visibility | citations | gaps | mentions | directories
    const clientId = searchParams.get('clientId');
    const domain = searchParams.get('domain');

    if (!clientId) {
      return NextResponse.json({ error: 'חסר clientId' }, { status: 400 });
    }

    if (!domain) {
      return NextResponse.json({ error: 'חסר domain' }, { status: 400 });
    }

    switch (action) {
      case 'visibility': {
        const keywordsParam = searchParams.get('keywords');
        const keywords = keywordsParam ? keywordsParam.split(',') : [];
        if (!keywords.length) {
          return NextResponse.json({ error: 'חסרים keywords' }, { status: 400 });
        }
        const result = await analyzeAIVisibility(domain, keywords);
        if (result.error) {
          return NextResponse.json({ error: result.error }, { status: 500 });
        }
        return NextResponse.json({ report: result.report });
      }

      case 'citations': {
        const niche = searchParams.get('niche');
        if (!niche) {
          return NextResponse.json({ error: 'חסר niche' }, { status: 400 });
        }
        const result = await generateCitationStrategy(domain, niche);
        if (result.error) {
          return NextResponse.json({ error: result.error }, { status: 500 });
        }
        return NextResponse.json({ strategy: result.strategy });
      }

      case 'gaps': {
        const competitorsParam = searchParams.get('competitors');
        const competitors = competitorsParam ? competitorsParam.split(',') : [];
        if (!competitors.length) {
          return NextResponse.json({ error: 'חסרים competitors' }, { status: 400 });
        }
        const result = await identifyAuthorityGaps(domain, competitors);
        if (result.error) {
          return NextResponse.json({ error: result.error }, { status: 500 });
        }
        return NextResponse.json({ gaps: result.gaps });
      }

      case 'mentions': {
        const platformsParam = searchParams.get('platforms');
        const platforms = platformsParam ? platformsParam.split(',') : ['ChatGPT', 'Perplexity', 'Claude', 'Gemini', 'Google AI Overview'];
        const result = await trackAIMentions(domain, platforms);
        return NextResponse.json({ mentions: result.mentions, note: result.error });
      }

      case 'directories': {
        const niche = searchParams.get('niche');
        const location = searchParams.get('location') || 'ישראל';
        if (!niche) {
          return NextResponse.json({ error: 'חסר niche' }, { status: 400 });
        }
        const result = await suggestDirectoryListings(niche, location);
        if (result.error) {
          return NextResponse.json({ error: result.error }, { status: 500 });
        }
        return NextResponse.json({ directories: result.directories });
      }

      default:
        return NextResponse.json({
          error: 'action לא תקין. אפשרויות: visibility, citations, gaps, mentions, directories',
        }, { status: 400 });
    }
  } catch (error) {
    console.error('[GEO Boost API] GET error:', error);
    return NextResponse.json({ error: `שגיאה: ${(error as Error).message}` }, { status: 500 });
  }
}

// ============================================================================
// POST — יצירת/עדכון אסטרטגיית GEO מלאה
// ============================================================================

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { clientId, domain, niche, keywords, action } = body;

    if (!clientId) {
      return NextResponse.json({ error: 'חסר clientId' }, { status: 400 });
    }

    switch (action) {
      case 'generateStrategy': {
        if (!domain || !niche || !keywords?.length) {
          return NextResponse.json({ error: 'חסרים domain, niche, keywords' }, { status: 400 });
        }
        const result = await generateFullGEOStrategy(clientId, domain, niche, keywords);
        if (result.error || !result.strategy) {
          return NextResponse.json({ error: result.error || 'שגיאה ביצירת אסטרטגיה' }, { status: 500 });
        }
        return NextResponse.json({ strategy: result.strategy, message: 'אסטרטגיית GEO נוצרה בהצלחה' }, { status: 201 });
      }

      case 'mentionStrategy': {
        if (!domain || !niche) {
          return NextResponse.json({ error: 'חסרים domain ו-niche' }, { status: 400 });
        }
        const result = await buildMentionStrategy(domain, niche);
        if (result.error) {
          return NextResponse.json({ error: result.error }, { status: 500 });
        }
        return NextResponse.json({ strategies: result.strategies, message: 'אסטרטגיית אזכורים נוצרה' });
      }

      default:
        return NextResponse.json({
          error: 'action לא תקין. אפשרויות: generateStrategy, mentionStrategy',
        }, { status: 400 });
    }
  } catch (error) {
    console.error('[GEO Boost API] POST error:', error);
    return NextResponse.json({ error: `שגיאה: ${(error as Error).message}` }, { status: 500 });
  }
}
