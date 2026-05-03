/**
 * GET /api/clients/[clientId]/seo-geo-plans — List SEO plans for a client
 *
 * Storage: Supabase "app_seo_plans" table via seoPlans SupabaseCrud.
 * Clients can only see their own plans; admin/employee see all.
 */

import { NextRequest, NextResponse } from 'next/server';
import { seoPlans } from '@/lib/db';
import {
  getRequestRole,
  getRequestClientId,
  requireClientAccess,
  scopeForClient,
} from '@/lib/auth/api-guard';
import {
  ok,
  err,
  withErrorBoundary,
} from '@/lib/seo/api-helpers';

/* ── GET ──────────────────────────────────────────────────────────────── */

async function handleGET(
  req: NextRequest,
  context: { params: Promise<{ clientId: string }> }
) {
  try {
    const { clientId } = await context.params;

    // Check client access
    const accessErr = requireClientAccess(req, clientId);
    if (accessErr) return accessErr;

    const plans = await seoPlans.queryAsync(
      (p) => p.clientId === clientId
    );

    // Apply scoping if client role
    const scoped = scopeForClient(req, plans, (p) => p.clientId);

    console.log(
      `[API] GET /api/clients/${clientId}/seo-geo-plans ✅ ${scoped.length} plans`
    );
    return ok(scoped);
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    console.error(
      '[API] GET /api/clients/[clientId]/seo-geo-plans error:',
      msg
    );
    return err('Failed to fetch plans', 500);
  }
}

/* ── Exported handlers ─────────────────────────────────────────────────── */

export const GET = withErrorBoundary(handleGET);
