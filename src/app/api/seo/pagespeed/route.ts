/**
 * GET /api/seo/pagespeed — Analyze URL performance with PageSpeed Insights
 * Query params: url (required), strategy (mobile|desktop), clientId (optional)
 */

import { NextRequest, NextResponse } from 'next/server';
import { analyzeUrl } from '@/lib/seo/pagespeed-service';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const url = searchParams.get('url');
    const strategy = (searchParams.get('strategy') || 'mobile') as 'mobile' | 'desktop';

    if (!url) {
      return NextResponse.json({ error: 'נדרש פרמטר url' }, { status: 400 });
    }

    // Validate URL
    try {
      new URL(url);
    } catch {
      return NextResponse.json({ error: 'כתובת URL לא תקינה' }, { status: 400 });
    }

    if (strategy !== 'mobile' && strategy !== 'desktop') {
      return NextResponse.json(
        { error: 'strategy חייב להיות mobile או desktop' },
        { status: 400 }
      );
    }

    const result = await analyzeUrl(url, strategy);

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('[PageSpeed API] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'שגיאה בניתוח הביצועים' },
      { status: 500 }
    );
  }
}
