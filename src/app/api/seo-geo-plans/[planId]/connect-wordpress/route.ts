import { NextRequest, NextResponse } from 'next/server';
import type { SeoPlan } from '@/lib/db/schema';
import {
  ok,
  err,
  loadPlan,
  updatePlanSafe,
  logActivity,
  parseBody,
  withErrorBoundary,
} from '@/lib/seo/api-helpers';
import { testConnection } from '@/lib/seo/wordpress-client';
import type { WPConnection } from '@/lib/seo/wordpress-client';

// ── Types ───────────────────────────────────────────────────────────────────

interface ConnectWordPressRequest {
  siteUrl: string;
  username: string;
  applicationPassword: string;
}

interface ConnectWordPressResponse {
  success: boolean;
  siteName?: string;
  yoastInstalled?: boolean;
  pagesCount?: number;
  error?: string;
}

// ── Main API handler ────────────────────────────────────────────────────────

async function _POST(
  req: NextRequest,
  context: { params: Promise<{ planId: string }> }
): Promise<NextResponse> {
  const { planId } = await context.params;
  const { plan, error: loadErr } = await loadPlan(planId, req);

  if (loadErr) return loadErr;
  if (!plan) return err('Plan not found', 404);

  const { body, error: parseErr } = await parseBody<ConnectWordPressRequest>(req);
  if (parseErr) return parseErr;

  if (!body) {
    return err('Request body is required', 400);
  }

  const { siteUrl, username, applicationPassword } = body;

  // Validate required fields
  if (!siteUrl || !username || !applicationPassword) {
    return err('Missing required fields: siteUrl, username, applicationPassword', 400);
  }

  try {
    // Test the connection with provided credentials
    const connection: WPConnection = {
      siteUrl,
      username,
      applicationPassword,
    };

    const testResult = await testConnection(connection);

    if (!testResult.success) {
      return err(testResult.error || 'Failed to connect to WordPress', 400);
    }

    // Connection successful - save to plan
    const connectedAt = new Date().toISOString();
    const wpConnectionData = {
      siteUrl,
      username,
      applicationPassword,
      connectedAt,
      siteName: testResult.siteName || 'WordPress Site',
      yoastInstalled: testResult.yoastInstalled || false,
      pagesCount: testResult.pagesCount || 0,
    };

    const updated = await updatePlanSafe(planId, {
      wpConnection: wpConnectionData as any,
    });

    if (!updated) {
      return err('Failed to save WordPress connection', 500);
    }

    // Log the activity
    logActivity(planId, 'connect_wordpress', {
      siteName: testResult.siteName,
      pagesCount: testResult.pagesCount,
      yoastInstalled: testResult.yoastInstalled,
    });

    const response: ConnectWordPressResponse = {
      success: true,
      siteName: testResult.siteName,
      yoastInstalled: testResult.yoastInstalled,
      pagesCount: testResult.pagesCount,
    };

    return ok(response);
  } catch (error) {
    console.error('[SEO-API] POST /seo-geo-plans/[planId]/connect-wordpress error:', error);
    return err('Failed to connect to WordPress', 500);
  }
}

export const POST = withErrorBoundary(_POST);
