import { NextRequest, NextResponse } from 'next/server';
import { seoPlans } from '@/lib/db';
import { generateSeoReport } from '@/lib/seo/report-engine';
import { generatePremiumReport } from '@/lib/seo/premium-report-engine';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { planId, language = "he", premium = false } = body;

    if (!planId) {
      return NextResponse.json({ error: 'planId is required' }, { status: 400 });
    }

    // Fetch the plan
    const plan = await seoPlans.getByIdAsync(planId);
    if (!plan) {
      return NextResponse.json({ error: 'Plan not found' }, { status: 404 });
    }

    // Generate the report — premium or standard
    const report = premium
      ? generatePremiumReport(plan, language)
      : generateSeoReport(plan, language);

    // Save report into the plan's reports array
    const existingReports = (plan as any).reports || [];
    const reportMeta = {
      id: report.id,
      name: premium
        ? `דוח PIXEL SEO/GEO פרימיום — ${(plan as any).clientName || "ללא שם"}`
        : `דוח PIXEL SEO/GEO — ${(plan as any).clientName || "ללא שם"}`,
      generatedAt: report.generatedAt,
      language,
      type: premium ? "premium" : "full",
      meta: report.meta,
    };

    await seoPlans.updateAsync(planId, {
      reports: [...existingReports, reportMeta],
      lastReport: report,
      updatedAt: new Date().toISOString(),
    });

    return NextResponse.json(report);
  } catch (error) {
    console.error('Report generation failed:', error);
    return NextResponse.json({ error: 'Failed to generate report' }, { status: 500 });
  }
}
