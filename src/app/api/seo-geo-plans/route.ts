import { NextRequest, NextResponse } from 'next/server';
import { seoPlans } from '@/lib/db';
import type { SeoPlan } from '@/lib/db/schema';
import {
  ok,
  created,
  err,
  validateRequired,
  logActivity,
  parseBody,
  generateId,
  withErrorBoundary,
} from '@/lib/seo/api-helpers';
import { getRequestClientId } from '@/lib/auth/api-guard';

async function POST(req: NextRequest): Promise<NextResponse> {
  const { body, error: parseErr } = await parseBody<Record<string, unknown>>(req);
  if (parseErr) return parseErr;

  const validationErr = validateRequired(body || {}, ['clientId', 'clientName', 'websiteUrl']);
  if (validationErr) return err(validationErr);

  const clientId = body?.clientId as string;
  const clientName = body?.clientName as string;
  const websiteUrl = body?.websiteUrl as string;

  const planId = generateId('seo');
  const now = new Date().toISOString();

  const newPlan: SeoPlan = {
    id: planId,
    clientId,
    clientName,
    websiteUrl,
    status: 'draft',
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
    createdAt: now,
    updatedAt: now,
    generatedAt: null,
    completedTasks: 0,
    totalTasks: 0,
    scannedPages: [],
    contentGaps: [],
    competitors: [],
    reports: [],
    activityLog: [],
  };

  try {
    await seoPlans.createAsync(newPlan);
    logActivity(planId, 'create', { clientId, clientName, websiteUrl });
    return created(newPlan);
  } catch (error) {
    console.error('[SEO-API] POST /seo-geo-plans error:', error);
    return err('Failed to create plan', 500);
  }
}

export const POST = withErrorBoundary(POST);
