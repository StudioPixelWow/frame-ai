import { NextRequest, NextResponse } from 'next/server';
import type { AiVisibilityQuery } from '@/lib/db/schema';
import {
  ok,
  err,
  loadPlan,
  updatePlanSafe,
  logActivity,
  generateId,
  withErrorBoundary,
} from '@/lib/seo/api-helpers';

// Generate visibility questions based on plan data
function generateVisibilityQuestions(
  domain: string,
  goals: any[]
): AiVisibilityQuery[] {
  const questions: AiVisibilityQuery[] = [];

  // Base domain-specific queries
  const baseDomain = domain.replace('www.', '');
  const brandQueries = [
    {
      query: baseDomain,
      category: 'brand',
      intent: 'navigational' as const,
    },
    {
      query: `${baseDomain} official website`,
      category: 'brand',
      intent: 'navigational' as const,
    },
  ];

  // Goal-based queries
  const goalQueries: { query: string; category: string; intent: any }[] = [];

  if (goals && Array.isArray(goals)) {
    for (const goal of goals) {
      if (goal.type === 'local_visibility') {
        goalQueries.push({
          query: `${baseDomain} near me`,
          category: 'local',
          intent: 'local',
        });
        goalQueries.push({
          query: `best ${goal.label} in my area`,
          category: 'local',
          intent: 'local',
        });
      }
      if (goal.type === 'ai_visibility') {
        goalQueries.push({
          query: `who is ${baseDomain}`,
          category: 'ai_visibility',
          intent: 'informational',
        });
        goalQueries.push({
          query: `what does ${baseDomain} do`,
          category: 'ai_visibility',
          intent: 'informational',
        });
      }
      if (goal.type === 'ecommerce') {
        goalQueries.push({
          query: `buy from ${baseDomain}`,
          category: 'ecommerce',
          intent: 'transactional',
        });
      }
    }
  }

  // Generic industry queries
  const industryQueries = [
    {
      query: `${goal?.label || 'services'} solutions`,
      category: 'industry',
      intent: 'informational' as const,
    },
    {
      query: `top ${goal?.label || 'service'} providers`,
      category: 'industry',
      intent: 'informational' as const,
    },
    {
      query: `${goal?.label || 'service'} comparison`,
      category: 'industry',
      intent: 'commercial' as const,
    },
  ];

  // Combine and deduplicate
  const allQueries = [...brandQueries, ...goalQueries, ...industryQueries];
  const seen = new Set<string>();
  const uniqueQueries = allQueries.filter((q) => {
    if (seen.has(q.query)) return false;
    seen.add(q.query);
    return true;
  });

  // Build final question objects
  for (const q of uniqueQueries.slice(0, 12)) {
    const importance =
      q.category === 'brand'
        ? 'high'
        : q.category === 'industry'
          ? 'medium'
          : 'low';

    questions.push({
      id: generateId('vq'),
      query: q.query,
      category: q.category,
      intent: q.intent || 'informational',
      importance: importance as any,
    });
  }

  return questions;
}

async function POST(
  req: NextRequest,
  context: { params: Promise<{ planId: string }> }
): Promise<NextResponse> {
  const { planId } = await context.params;
  const { plan, error: loadErr } = await loadPlan(planId, req);

  if (loadErr) return loadErr;
  if (!plan) return err('Plan not found', 404);

  try {
    const domain = new URL(plan.websiteUrl).hostname;

    // Generate questions based on plan data
    const questions = generateVisibilityQuestions(domain, plan.goals);

    if (questions.length === 0) {
      return err('Failed to generate visibility questions', 500);
    }

    // Update plan with visibility queries
    const updated = await updatePlanSafe(planId, {
      visibilityQueries: questions,
    });

    if (!updated) {
      return err('Failed to save questions', 500);
    }

    logActivity(planId, 'generate_questions', {
      count: questions.length,
      domain,
    });

    return ok({
      questions,
      count: questions.length,
    });
  } catch (error) {
    console.error('[SEO-API] POST /seo-geo-plans/[planId]/generate-questions error:', error);
    return err('Failed to generate questions', 500);
  }
}

export const POST = withErrorBoundary(POST);
