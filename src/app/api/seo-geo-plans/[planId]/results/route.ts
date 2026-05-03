import { NextRequest, NextResponse } from 'next/server';
import { seoPlans } from '@/lib/db';
import {
  buildPlatformSummaries,
  buildPlatformResults,
  buildGlobalMetrics,
} from '@/lib/seo/visibility-engine';
import { VisibilityPlatformId } from '@/lib/schema';

export async function GET(
  req: NextRequest,
  { params }: { params: { planId: string } }
) {
  try {
    const { planId } = params;
    const { searchParams } = new URL(req.url);
    const platformParam = searchParams.get('platform') as VisibilityPlatformId | null;

    // Load the plan from seoPlans collection
    const plan = await seoPlans.findOne({ id: planId });

    if (!plan) {
      return NextResponse.json(
        { error: 'Plan not found' },
        { status: 404 }
      );
    }

    // Build platform summaries
    const summaries = buildPlatformSummaries(plan);

    // Build global metrics
    const metrics = buildGlobalMetrics(summaries);

    // If platform parameter is provided, fetch results for that platform
    let results: any[] | undefined;
    if (platformParam) {
      results = buildPlatformResults(plan, platformParam);
    }

    const response = {
      summaries,
      metrics,
      ...(results !== undefined && { results }),
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error fetching SEO/GEO results:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
