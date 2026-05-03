/**
 * PATCH /api/websites/[websiteId] — Update a website
 *
 * Storage: Supabase "app_seo_websites" table via seoWebsites SupabaseCrud.
 * Admin/employee only. Clients cannot update websites directly.
 */

import { NextRequest, NextResponse } from 'next/server';
import { seoWebsites } from '@/lib/db';
import {
  getRequestRole,
  requireRole,
} from '@/lib/auth/api-guard';
import {
  ok,
  err,
  notFound,
  validateUrl,
  logActivity,
  parseBody,
  withErrorBoundary,
} from '@/lib/seo/api-helpers';

/* ── Extract domain from URL ─────────────────────────────────────────── */

function extractDomain(urlString: string): string {
  try {
    const url = new URL(urlString);
    return url.hostname;
  } catch {
    return urlString.replace(/^https?:\/\//, '').split('/')[0];
  }
}

/* ── PATCH ────────────────────────────────────────────────────────────── */

async function handlePATCH(
  req: NextRequest,
  context: { params: Promise<{ websiteId: string }> }
) {
  const patchErr = requireRole(req, 'admin', 'employee');
  if (patchErr) return patchErr;

  try {
    const { websiteId } = await context.params;

    const { body, error: parseErr } = await parseBody<{
      url?: string;
      label?: string;
      status?: string;
      isPrimary?: boolean;
    }>(req);

    if (parseErr) return parseErr;
    if (!body) return err('Invalid JSON body', 400);

    // Fetch existing website
    const website = await seoWebsites.getByIdAsync(websiteId);
    if (!website) {
      return notFound('Website');
    }

    // Validate URL if provided
    if (body.url && !validateUrl(body.url)) {
      return err('Invalid URL format', 400);
    }

    // Build update payload
    const updatePayload: Record<string, unknown> = {};

    if (body.url) {
      updatePayload.url = body.url;
      updatePayload.domain = extractDomain(body.url);
    }

    if (body.label !== undefined) {
      updatePayload.label = body.label;
    }

    if (body.status !== undefined) {
      updatePayload.status = body.status;
    }

    if (body.isPrimary !== undefined) {
      updatePayload.isPrimary = body.isPrimary;
    }

    updatePayload.updatedAt = new Date().toISOString();

    console.log(
      `[API] PATCH /api/websites/${websiteId} payload:`,
      JSON.stringify(updatePayload)
    );

    const updated = await seoWebsites.updateAsync(websiteId, updatePayload);

    if (!updated) {
      return notFound('Website');
    }

    logActivity(websiteId, 'website_updated', {
      clientId: website.clientId,
      updatedBy: getRequestRole(req),
      fieldsChanged: Object.keys(body).length,
    });

    console.log(`[API] PATCH /api/websites/${websiteId} ✅ saved`);
    return ok(updated);
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    console.error('[API] PATCH /api/websites/[websiteId] error:', msg);
    return err(`Failed to update website: ${msg}`, 500);
  }
}

/* ── Exported handlers ─────────────────────────────────────────────────── */

export const PATCH = withErrorBoundary(handlePATCH);
