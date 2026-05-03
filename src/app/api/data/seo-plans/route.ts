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
    return NextResponse.json(filtered);
  } catch (error) {
    console.warn('[API] GET /api/data/seo-plans failed, returning empty:', error instanceof Error ? error.message : error);
    return NextResponse.json([]);
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const now = new Date().toISOString();
    const plan = {
      ...body,
      id: generateId(),
      status: body.status || 'draft',
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
      createdAt: now,
      updatedAt: now,
      generatedAt: null,
    };
    const created = await seoPlans.createAsync(plan);
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
