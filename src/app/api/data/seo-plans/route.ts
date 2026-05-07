import { NextRequest, NextResponse } from 'next/server';
import { seoPlans } from '@/lib/db';

function generateId(): string {
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 6);
  return `seo_${ts}_${rand}`;
}

export async function GET(req: NextRequest) {
  try {
    const data = await seoPlans.getAllAsync();
    // Optional: filter by clientId query param
    const clientId = req.nextUrl.searchParams.get('clientId');
    const filtered = clientId ? data.filter((p: any) => p.clientId === clientId) : data;

    return NextResponse.json({
      success: true,
      plans: filtered,
      count: filtered.length,
    });
  } catch (error) {
    console.warn('[API] GET /api/data/seo-plans failed, returning empty:', error instanceof Error ? error.message : error);
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch SEO plans',
      plans: [],
      count: 0,
    });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    console.log('[SEO-PLANS-POST] clientKeywords received:', JSON.stringify(body.clientKeywords)?.slice(0, 300));
    console.log('[SEO-PLANS-POST] clientKeywords count:', body.clientKeywords?.length ?? 'undefined');
    const now = new Date().toISOString();
    const plan = {
      // Defaults first — body values override them
      websiteScan: null,
      goals: [],
      visibilityQueries: [],
      visibilityResults: [],
      insights: [],
      weeks: [],
      overallScore: 0,
      technicalScore: 0,
      contentScore: 0,
      visibilityScore: 0,
      completedTasks: 0,
      totalTasks: 0,
      generatedAt: null,
      // Body overrides defaults
      ...body,
      // These always take precedence
      status: body.status || 'draft',
      createdAt: now,
      updatedAt: now,
    };
    const created = await seoPlans.createAsync(plan);
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
