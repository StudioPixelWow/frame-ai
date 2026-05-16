import { NextRequest, NextResponse } from 'next/server';
import { seoPlans } from '@/lib/db';
import {
  ok,
  err,
  notFound,
  logActivity,
  loadPlan,
  withErrorBoundary,
  parseBody,
} from '@/lib/seo/api-helpers';
import { generateSeoReport } from '@/lib/seo/report-engine';

interface ExportPdfBody {
  planId: string;
}

export const POST = withErrorBoundary(async (request: NextRequest, context: { params: Promise<{ reportId: string }> }) => {
  const { reportId } = await context.params;

  const { body, error } = await parseBody(request);
  if (error) return error;
  const { planId } = body as ExportPdfBody;

  if (!planId) {
    return err('planId is required', 400);
  }

  const result = await loadPlan(planId, request);
  if (result.error) return result.error;
  const plan = result.plan;
  if (!plan) {
    return notFound('Plan not found');
  }

  // Find the report in plan.reports
  const reportMetadata = plan.reports?.find((r: any) => r.id === reportId);
  if (!reportMetadata) {
    return notFound('Report not found');
  }

  // Re-generate the report data
  const report = await generateSeoReport(plan, reportMetadata.language || 'he');

  const exportUrl = `/seo-geo/${planId}/report?lang=${reportMetadata.language || 'he'}`;

  await logActivity(`Exported report ${reportId} as PDF`, {
    reportId,
    planId,
    language: reportMetadata.language,
  });

  return ok({
    reportId,
    planId,
    exportUrl,
    message: 'Use browser print to export PDF',
  });
});
