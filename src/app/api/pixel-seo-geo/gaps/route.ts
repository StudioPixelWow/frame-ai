import { NextRequest, NextResponse } from 'next/server';
import { analyzeGaps } from '@/lib/seo/gap-analysis';
import { validateScanData } from '@/lib/seo/validation-gate';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
);

export async function GET(req: NextRequest) {
  const planId = req.nextUrl.searchParams.get('planId');
  if (!planId) return NextResponse.json({ error: 'Missing planId' }, { status: 400 });

  try {
    // Load plan data
    const { data: plan } = await supabase.from('data_store').select('*').eq('id', planId).single();
    if (!plan) return NextResponse.json({ error: 'Plan not found' }, { status: 404 });

    const planData = plan.data || {};
    const scan = planData.websiteScan;

    if (!scan) {
      return NextResponse.json({
        error: 'no_scan',
        message: 'לא בוצעה סריקה עדיין — יש להריץ סריקה ראשית לפני ניתוח פערים',
      }, { status: 400 });
    }

    // Validate we have enough data
    const validation = validateScanData({
      websiteFacts: scan.websiteFacts,
      pagesScanned: scan.totalPages || 0,
      scanDurationMs: scan.durationMs || 0,
      evidenceCount: scan.scanLog?.metrics?.evidenceCollected || 0,
    });

    if (!validation.canProceed) {
      return NextResponse.json({
        error: 'insufficient_data',
        message: validation.message,
        checks: validation.checks,
      }, { status: 400 });
    }

    // If gap analysis was already computed during scan, return it
    if (scan.gapAnalysis) {
      return NextResponse.json({ success: true, gapAnalysis: scan.gapAnalysis });
    }

    // Otherwise compute fresh
    const domain = planData.websiteUrl?.replace(/^https?:\/\//, '').replace(/\/$/, '') || '';
    const result = analyzeGaps({
      domain,
      gscQueries: scan.gscData?.queries || null,
      gscPages: scan.gscData?.pages || null,
      serpRankings: null, // would need to re-fetch
      crawlPages: scan.scannedPages || null,
      technicalIssues: scan.issues?.map((i: any) => ({
        type: i.type, severity: i.category, url: scan.url, description: i.title, evidence: i.description,
      })) || null,
    });

    return NextResponse.json({ success: true, gapAnalysis: result });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
