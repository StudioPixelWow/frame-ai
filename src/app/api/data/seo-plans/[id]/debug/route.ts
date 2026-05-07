import { NextRequest, NextResponse } from 'next/server';
import { seoPlans } from '@/lib/db';

/**
 * DEBUG endpoint — returns raw clientKeywords from DB with zero transformation.
 * Access: GET /api/data/seo-plans/{id}/debug
 * Delete this file after debugging is complete.
 */
export async function GET(_req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const item = await seoPlans.getByIdAsync(id);
    if (!item) return NextResponse.json({ error: 'Plan not found', id }, { status: 404 });

    const raw = item as any;
    const allKeys = Object.keys(raw).sort();
    const keywordKeys = allKeys.filter(k => k.toLowerCase().includes('keyword'));

    return NextResponse.json({
      planId: id,
      clientName: raw.clientName,
      status: raw.status,
      createdAt: raw.createdAt,
      // Show ALL keyword-related keys
      keywordRelatedKeys: keywordKeys,
      // Raw clientKeywords — no sanitization, no nuke, no transformation
      clientKeywords: raw.clientKeywords,
      clientKeywordsType: typeof raw.clientKeywords,
      clientKeywordsIsArray: Array.isArray(raw.clientKeywords),
      clientKeywordsLength: raw.clientKeywords?.length ?? null,
      // First 3 items for inspection
      clientKeywordsSample: Array.isArray(raw.clientKeywords)
        ? raw.clientKeywords.slice(0, 3)
        : raw.clientKeywords,
      // Also check if keywords might be stored under a different key
      allTopLevelKeys: allKeys,
    });
  } catch (error) {
    return NextResponse.json({
      error: 'Failed',
      message: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}
