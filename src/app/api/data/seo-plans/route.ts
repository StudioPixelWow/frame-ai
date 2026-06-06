import { NextRequest, NextResponse } from 'next/server';
import { seoPlans } from '@/lib/db';

function generateId(): string {
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 6);
  return `seo_${ts}_${rand}`;
}

export async function GET(req: NextRequest) {
  try {
    const clientId = req.nextUrl.searchParams.get('clientId');
    const status = req.nextUrl.searchParams.get('status'); // e.g. "active,plan_generated"

    // Build filters to avoid loading all 95+ plans (causes statement timeout)
    const filters: Array<{ column: string; op: 'eq' | 'in' | 'neq' | 'like' | 'is'; value: any }> = [];

    if (clientId) {
      filters.push({ column: 'data->>clientId', op: 'eq', value: clientId });
    }

    if (status) {
      const statuses = status.split(',').map(s => s.trim());
      filters.push({ column: 'data->>status', op: 'in', value: statuses });
    }

    // If no filters, exclude old "scanned" plans to reduce payload
    const data = filters.length > 0
      ? await seoPlans.queryFilteredAsync(filters)
      : await seoPlans.queryFilteredAsync([
          { column: 'data->>status', op: 'in', value: ['draft', 'scanning', 'scanned', 'visibility_done', 'plan_generated', 'active', 'completed'] },
        ]);

    // Fallback: derive scores from the latest daily snapshot when top-level
    // scores weren't persisted (older scans), so the dashboard shows real data.
    const AI_PLATFORMS = ['chatgpt', 'gemini', 'perplexity', 'claude', 'google_ai_overview'];
    const plans = (data as any[]).map((p) => {
      const snaps = Array.isArray(p.dailySnapshots) ? p.dailySnapshots : [];
      const last = snaps.length ? snaps[snaps.length - 1] : null;
      let visibilityScore = p.visibilityScore || 0;
      let geoScore = p.geoScore || 0;
      if (last?.aiVisibility) {
        if (!visibilityScore && last.aiVisibility.totalQueries > 0) {
          visibilityScore = Math.round((last.aiVisibility.totalFound / last.aiVisibility.totalQueries) * 100);
        }
        if (!geoScore) {
          const ai = AI_PLATFORMS.reduce((acc: any, pl: string) => {
            const b = last.aiVisibility.byPlatform?.[pl];
            if (b) { acc.found += b.found; acc.total += b.total; }
            return acc;
          }, { found: 0, total: 0 });
          if (ai.total > 0) geoScore = Math.round((ai.found / ai.total) * 100);
        }
      }
      return { ...p, visibilityScore, geoScore };
    });

    return NextResponse.json({
      success: true,
      plans,
      count: plans.length,
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
    console.log('[SEO-PLANS-POST] clientKeywords received:', JSON.stringify(body.clientKeywords)?.slice(0, 500));
    console.log('[SEO-PLANS-POST] clientKeywords type:', typeof body.clientKeywords, 'isArray:', Array.isArray(body.clientKeywords), 'count:', body.clientKeywords?.length ?? 'undefined');
    console.log('[SEO-PLANS-POST] body keys:', Object.keys(body).sort().join(', '));
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
