import { NextRequest, NextResponse } from 'next/server';
import { analyzeWhy } from '@/lib/seo/why-engine';
import { validateScanData } from '@/lib/seo/validation-gate';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
);

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { planId, pageUrl, keyword } = body;

    if (!planId || !pageUrl || !keyword) {
      return NextResponse.json({ error: 'Missing planId, pageUrl, or keyword' }, { status: 400 });
    }

    // Load plan
    const { data: plan } = await supabase.from('data_store').select('*').eq('id', planId).single();
    if (!plan) return NextResponse.json({ error: 'Plan not found' }, { status: 404 });

    const planData = plan.data || {};
    const scan = planData.websiteScan;

    if (!scan) {
      return NextResponse.json({
        error: 'no_scan',
        message: 'לא בוצעה סריקה — נדרשת סריקה לפני ניתוח',
      }, { status: 400 });
    }

    // Find the target page from scanned pages
    const scannedPages = scan.scannedPages || [];
    const targetPage = scannedPages.find((p: any) => p.url === pageUrl || p.url.includes(pageUrl));

    if (!targetPage) {
      return NextResponse.json({
        error: 'page_not_found',
        message: 'הדף המבוקש לא נמצא בנתוני הסריקה',
      }, { status: 404 });
    }

    // Find GSC data for this keyword
    const gscQueries = scan.gscData?.queries || [];
    const gscData = gscQueries.find((q: any) => q.query === keyword) || null;

    // Run why analysis
    const result = analyzeWhy({
      targetPage,
      targetKeyword: keyword,
      gscData,
      serpCompetitors: undefined, // would need SERP call
      competitorPages: undefined,
    });

    return NextResponse.json({ success: true, analysis: result });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
