import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
);

/** The 6 platforms we track */
const PLATFORM_DEFS = [
  { id: 'google_seo', name: 'Google SEO', icon: '🔍', category: 'search' },
  { id: 'google_ai_overview', name: 'Google AI Overview', icon: '✨', category: 'ai' },
  { id: 'gemini', name: 'Gemini', icon: '💎', category: 'ai' },
  { id: 'chatgpt', name: 'ChatGPT', icon: '🤖', category: 'ai' },
  { id: 'claude', name: 'Claude', icon: '🧠', category: 'ai' },
  { id: 'perplexity', name: 'Perplexity', icon: '🔮', category: 'ai' },
] as const;

export async function GET(req: NextRequest) {
  const planId = req.nextUrl.searchParams.get('planId');
  if (!planId) return NextResponse.json({ error: 'Missing planId' }, { status: 400 });

  try {
    const { data: plan } = await supabase.from('data_store').select('*').eq('id', planId).single();
    if (!plan) return NextResponse.json({ error: 'Plan not found' }, { status: 404 });

    const planData = plan.data || {};
    const scan = planData.websiteScan;

    if (!scan) {
      return NextResponse.json({
        success: true,
        hasData: false,
        message: 'טרם בוצעה סריקה — הרץ סריקה כדי לראות תוצאות',
        platforms: PLATFORM_DEFS.map(p => ({
          ...p,
          status: 'no_data' as const,
          scanMode: 'unavailable' as const,
          queriesScanned: 0,
          mentionsFound: 0,
          visibility: 0,
          lastScanAt: null,
        })),
      });
    }

    const platformStatuses = scan.platformStatuses || {};
    const aiResults = scan.aiVisibilityResults || [];
    const gscData = scan.gscData || null;
    const integrations = scan.integrations || {};

    // Build platform results
    const platforms = PLATFORM_DEFS.map(pDef => {
      const status = platformStatuses[pDef.id];
      const platformResults = aiResults.filter((r: any) => r.platform === pDef.id);

      // Google SEO uses GSC data
      if (pDef.id === 'google_seo') {
        const queries = gscData?.queries || [];
        const topQueries = queries.slice(0, 50);
        return {
          ...pDef,
          status: gscData ? 'active' : (integrations.gsc ? 'no_data' : 'unavailable'),
          scanMode: gscData ? 'real' : 'unavailable',
          queriesScanned: queries.length,
          mentionsFound: queries.filter((q: any) => q.position <= 10).length,
          visibility: queries.length > 0 ? Math.round((queries.filter((q: any) => q.position <= 10).length / queries.length) * 100) : 0,
          lastScanAt: scan.scannedAt || null,
          details: {
            totalClicks: gscData?.totalClicks || 0,
            totalImpressions: gscData?.totalImpressions || 0,
            averageCtr: gscData?.averageCtr || 0,
            averagePosition: gscData?.averagePosition || 0,
            topQueries: topQueries.map((q: any) => ({
              keyword: q.query,
              position: q.position,
              clicks: q.clicks,
              impressions: q.impressions,
              ctr: q.ctr,
              url: null, // GSC page data would be needed
            })),
          },
        };
      }

      // AI Platforms
      const queriesScanned = status?.queriesScanned || platformResults.length;
      const mentionsFound = status?.mentionsFound || platformResults.filter((r: any) => r.found).length;
      const visibility = queriesScanned > 0 ? Math.round((mentionsFound / queriesScanned) * 100) : 0;

      return {
        ...pDef,
        status: status?.status === 'completed' ? 'active' : (status?.status || 'unavailable'),
        scanMode: status?.scanMode || 'unavailable',
        queriesScanned,
        mentionsFound,
        visibility,
        lastScanAt: scan.scannedAt || null,
        details: {
          results: platformResults.map((r: any) => ({
            question: r.query,
            mentioned: r.found,
            snippet: r.snippet || null,
            position: r.position || null,
            confidence: r.confidence || 0,
            source: r.scanMode || 'unavailable',
          })),
        },
      };
    });

    // Global metrics
    const totalQueries = platforms.reduce((sum, p) => sum + p.queriesScanned, 0);
    const totalMentions = platforms.reduce((sum, p) => sum + p.mentionsFound, 0);
    const overallVisibility = totalQueries > 0 ? Math.round((totalMentions / totalQueries) * 100) : 0;
    const activePlatforms = platforms.filter(p => p.status === 'active').length;

    return NextResponse.json({
      success: true,
      hasData: true,
      globalMetrics: {
        overallVisibility,
        totalQueries,
        totalMentions,
        activePlatforms,
        totalPlatforms: PLATFORM_DEFS.length,
        lastScanAt: scan.scannedAt,
        scanMode: scan.scanType || 'quick',
      },
      platforms,
      integrations,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
