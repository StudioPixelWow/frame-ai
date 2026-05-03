import { NextRequest, NextResponse } from 'next/server';
import { seoPlans } from '@/lib/db';
import { generateSeoReport } from '@/lib/seo/report-engine';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { planId, language = "he" } = body;

    if (!planId) {
      return NextResponse.json({ error: 'planId is required' }, { status: 400 });
    }

    // Fetch the plan
    const plan = await seoPlans.getByIdAsync(planId);
    if (!plan) {
      return NextResponse.json({ error: 'Plan not found' }, { status: 404 });
    }

    // Generate the report
    const report = generateSeoReport(plan, language);

    // Save report into the plan's reports array
    const existingReports = (plan as any).reports || [];
    const reportMeta = {
      id: report.id,
      name: language === "he"
        ? `דוח SEO/GEO — ${plan.clientName || "ללא שם"}`
        : `SEO/GEO Report — ${plan.clientName || "Unnamed"}`,
      generatedAt: report.generatedAt,
      language,
      type: "full",
      meta: report.meta,
    };

    await seoPlans.updateAsync(planId, {
      reports: [...existingReports, reportMeta],
      updatedAt: new Date().toISOString(),
    });

    return NextResponse.json(report);
  } catch (error) {
    console.error('Report generation failed:', error);
    return NextResponse.json({ error: 'Failed to generate report' }, { status: 500 });
  }
}
