import { NextRequest, NextResponse } from 'next/server';
import { seoPlans } from '@/lib/db';
import {
  ok,
  err,
  notFound,
  logActivity,
  loadPlan,
  updatePlanSafe,
  withErrorBoundary,
  parseBody,
} from '@/lib/seo/api-helpers';
import { generateSeoReport } from '@/lib/seo/report-engine';

interface GenerateReportBody {
  language?: string;
}

export const POST = withErrorBoundary(async (request: NextRequest, context: { params: Promise<{ planId: string }> }) => {
  const { planId } = await context.params;

  const result = await loadPlan(planId, request);
  if (result.error) return result.error;
  const plan = result.plan;
  if (!plan) {
    return notFound('Plan not found');
  }

  const { body, error } = await parseBody(request);
  if (error) return error;
  const { language = 'he' } = body as GenerateReportBody;

  // Generate the SEO report
  const report = await generateSeoReport(plan, language);

  // Create report metadata and add to plan
  const reportMetadata = {
    id: report.id,
    name: report.name,
    language,
    generatedAt: new Date().toISOString(),
    summary: report.summary || '',
  };

  if (!plan.reports) {
    plan.reports = [];
  }
  plan.reports.push(reportMetadata);

  // Save the updated plan
  await updatePlanSafe(planId, plan);

  await logActivity(`Generated SEO report for plan ${planId}`, {
    planId,
    language,
    reportId: report.id,
  });

  return ok(report);
});
