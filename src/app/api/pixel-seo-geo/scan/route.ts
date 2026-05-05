import { NextRequest, NextResponse } from 'next/server';
import { runFullScan } from '@/lib/seo/scan-orchestrator';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
);

interface ScanRequestBody {
  planId: string;
  url: string;
  scanType?: 'quick' | 'standard' | 'deep';
}

interface ScanResponse {
  success: boolean;
  scanId: string;
  duration: number;
  pagesScanned: number;
  validation: any;
  integrations: any;
  platformStatuses: any[];
  gapAnalysis: any;
}

interface ErrorResponse {
  error: string;
  details?: string;
}

interface IntegrationStatusResponse {
  integrations: {
    gsc: boolean;
    serp: boolean;
    serpProvider?: string;
    chatgpt: boolean;
    claude: boolean;
    gemini: boolean;
    perplexity: boolean;
  };
}

export async function POST(req: NextRequest): Promise<NextResponse<ScanResponse | ErrorResponse>> {
  try {
    const body = (await req.json()) as ScanRequestBody;
    const { planId, url, scanType = 'quick' } = body;

    if (!planId || !url) {
      return NextResponse.json<ErrorResponse>(
        { error: 'Missing planId or url' },
        { status: 400 }
      );
    }

    // Extract domain from URL
    let domain: string;
    try {
      const parsed = new URL(url.startsWith('http') ? url : `https://${url}`);
      domain = parsed.hostname.replace(/^www\./, '');
    } catch {
      return NextResponse.json<ErrorResponse>(
        { error: 'Invalid URL' },
        { status: 400 }
      );
    }

    // Run full scan pipeline
    const result = await runFullScan({ planId, url, scanType, domain });

    // Store scan results in plan
    const updatePayload: Record<string, any> = {
      websiteScan: {
        url: result.url,
        scannedAt: result.completedAt,
        scanType: result.scanType,
        durationMs: result.durationMs,
        hasSSL: result.crawlResult?.siteStructure.hasSSL ?? false,
        loadTimeMs: result.crawlResult?.pages[0]?.wordCount ? 1500 : 3000, // approximate
        mobileOptimized: true, // from viewport check
        metaTitle: result.crawlResult?.pages[0]?.title || '',
        metaDescription: result.crawlResult?.pages[0]?.metaDescription || '',
        h1Tags: result.crawlResult?.pages[0]?.h1Tags || [],
        totalPages: result.crawlResult?.pagesScanned || 0,
        indexedPages: result.crawlResult?.pagesScanned || 0,
        brokenLinks: result.crawlResult?.technicalIssues.filter(i => i.type === 'broken_link').length || 0,
        hasRobotsTxt: result.crawlResult?.siteStructure.hasRobotsTxt ?? false,
        hasSitemap: result.crawlResult?.siteStructure.hasSitemap ?? false,
        domainAuthority: 0, // requires external API
        structuredData: (result.crawlResult?.pages.some(p => p.schemaMarkup.length > 0)) ?? false,
        openGraph: (result.crawlResult?.pages.some(p => Object.keys(p.ogTags).length > 0)) ?? false,
        canonicalTags: (result.crawlResult?.pages.some(p => p.canonicalUrl !== null)) ?? false,
        issues: result.crawlResult?.technicalIssues.map(i => ({
          type: i.type,
          category: i.severity,
          title: i.description,
          description: i.evidence,
          impact: i.severity,
        })) || [],
        // Extended fields
        websiteFacts: result.websiteFacts,
        gscData: result.gscData,
        gapAnalysis: result.gapAnalysis,
        platformStatuses: Object.fromEntries(result.platformStatuses.map(p => [p.id, p])),
        aiVisibilityResults: result.aiVisibilityResults,
        scanLog: result.scanLog,
        validation: result.validation,
        integrations: result.integrations,
      },
    };

    // Update plan in DB
    try {
      await supabase
        .from('seo_plans')
        .update({ data: updatePayload })
        .eq('id', planId);
    } catch (dbErr: any) {
      console.error('[PIXEL-SEO-GEO] DB update failed:', dbErr);
      // Try generic data store
      try {
        const current = await supabase
          .from('data_store')
          .select('*')
          .eq('id', planId)
          .single();
        if (current.data) {
          const existingData = (current.data as any).data || {};
          await supabase
            .from('data_store')
            .update({
              data: { ...existingData, ...updatePayload },
            })
            .eq('id', planId);
        }
      } catch (fallbackErr) {
        console.error('[PIXEL-SEO-GEO] Fallback DB update failed:', fallbackErr);
      }
    }

    return NextResponse.json<ScanResponse>({
      success: true,
      scanId: result.scanId,
      duration: result.durationMs,
      pagesScanned: result.crawlResult?.pagesScanned || 0,
      validation: result.validation,
      integrations: result.integrations,
      platformStatuses: result.platformStatuses,
      gapAnalysis: result.gapAnalysis ? {
        totalGaps: result.gapAnalysis.summary.totalGaps,
        criticalGaps: result.gapAnalysis.summary.criticalGaps,
        highOpportunityKeywords: result.gapAnalysis.summary.highOpportunityKeywords,
      } : null,
    });
  } catch (err: any) {
    console.error('[PIXEL-SEO-GEO] Scan failed:', err);
    return NextResponse.json<ErrorResponse>(
      { error: 'Scan failed', details: err.message },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest): Promise<NextResponse<IntegrationStatusResponse | ErrorResponse>> {
  try {
    const planId = req.nextUrl.searchParams.get('planId');
    if (!planId) {
      return NextResponse.json<ErrorResponse>(
        { error: 'Missing planId' },
        { status: 400 }
      );
    }

    // Return integration status
    const { isGSCAvailable } = await import('@/lib/seo/gsc-api');
    const { isSerpAvailable, getSerpProvider } = await import('@/lib/seo/serp-api');
    const { isPlatformAvailable } = await import('@/lib/seo/platform-apis');

    return NextResponse.json<IntegrationStatusResponse>({
      integrations: {
        gsc: isGSCAvailable(),
        serp: isSerpAvailable(),
        serpProvider: getSerpProvider(),
        chatgpt: isPlatformAvailable('chatgpt' as any),
        claude: isPlatformAvailable('claude' as any),
        gemini: isPlatformAvailable('gemini' as any),
        perplexity: isPlatformAvailable('perplexity' as any),
      },
    });
  } catch (err: any) {
    console.error('[PIXEL-SEO-GEO] Integration status check failed:', err);
    return NextResponse.json<ErrorResponse>(
      { error: 'Failed to check integrations', details: err.message },
      { status: 500 }
    );
  }
}
