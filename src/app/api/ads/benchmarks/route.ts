import { NextRequest, NextResponse } from 'next/server';
import {
  ISRAELI_BENCHMARKS,
  SEASONAL_MODIFIERS,
  ISRAELI_AD_REGULATIONS,
  compareToIsraeliBenchmarks,
  calculateRecommendedBudget,
  getSeasonalModifier,
} from '@/lib/ads/israeli-benchmarks';

export const dynamic = 'force-dynamic';

// GET /api/ads/benchmarks — Get Israeli benchmarks data
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;
    const industry = searchParams.get('industry');
    const platform = searchParams.get('platform') as 'meta' | 'google' | 'tiktok' | null;

    if (industry && platform) {
      // Return specific benchmark
      const benchmark = ISRAELI_BENCHMARKS.find(b => b.industry === industry);
      if (!benchmark) {
        return NextResponse.json({ error: 'תעשייה לא נמצאה' }, { status: 404 });
      }
      const metrics = benchmark.platforms[platform];
      if (!metrics) {
        return NextResponse.json({ error: 'פלטפורמה לא נתמכת' }, { status: 400 });
      }
      const seasonal = getSeasonalModifier();
      return NextResponse.json({
        industry: benchmark.industry,
        industryHebrew: benchmark.industryHebrew,
        platform,
        metrics,
        seasonal,
      });
    }

    // Return all benchmarks + seasonal + regulations
    return NextResponse.json({
      benchmarks: ISRAELI_BENCHMARKS,
      seasonalModifiers: SEASONAL_MODIFIERS,
      currentSeason: getSeasonalModifier(),
      regulations: ISRAELI_AD_REGULATIONS,
    });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to load benchmarks' }, { status: 500 });
  }
}

// POST /api/ads/benchmarks — Compare campaign against Israeli benchmarks
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { industry, platform, actual, targetLeadsPerMonth } = body;

    if (!industry || !platform) {
      return NextResponse.json({ error: 'Missing: industry, platform' }, { status: 400 });
    }

    const results: any = {};

    if (actual) {
      results.comparison = compareToIsraeliBenchmarks(industry, platform, actual);
    }

    if (targetLeadsPerMonth) {
      results.recommendedBudget = calculateRecommendedBudget(industry, platform, targetLeadsPerMonth);
    }

    results.seasonal = getSeasonalModifier();

    return NextResponse.json(results);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to compare benchmarks' }, { status: 500 });
  }
}
