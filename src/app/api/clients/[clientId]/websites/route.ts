/**
 * GET  /api/clients/[clientId]/websites — List websites for a client
 * POST /api/clients/[clientId]/websites — Create a new website for a client
 *
 * Storage: Supabase "app_seo_websites" table via seoWebsites SupabaseCrud.
 * Clients can only see their own websites; admin/employee see all.
 */

import { NextRequest, NextResponse } from 'next/server';
import { seoWebsites } from '@/lib/db';
import {
  getRequestRole,
  getRequestClientId,
  requireRole,
  requireClientAccess,
  scopeForClient,
} from '@/lib/auth/api-guard';
import {
  ok,
  created,
  err,
  notFound,
  validateRequired,
  validateUrl,
  logActivity,
  parseBody,
  generateId,
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

    const websites = await seoWebsites.queryAsync(
      (w) => w.clientId === clientId
    );

    // Apply scoping if client role
    const scoped = scopeForClient(req, websites, (w) => w.clientId);

    console.log(
      `[API] GET /api/clients/${clientId}/websites ✅ ${scoped.length} websites`
    );
    return ok(scoped);
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    console.error('[API] GET /api/clients/[clientId]/websites error:', msg);
    return err('Failed to fetch websites', 500);
  }
}

/* ── POST ─────────────────────────────────────────────────────────────── */

async function handlePOST(
  req: NextRequest,
  context: { params: Promise<{ clientId: string }> }
) {
  const postErr = requireRole(req, 'admin', 'employee');
  if (postErr) return postErr;

  try {
    const { clientId } = await context.params;

    const { body, error: parseErr } = await parseBody<{
      url: string;
      label: string;
      isPrimary?: boolean;
      status?: string;
    }>(req);

    if (parseErr) return parseErr;
    if (!body) return err('Invalid JSON body', 400);

    // Validate required fields
    const validation = validateRequired(body, ['url', 'label']);
    if (validation) return err(validation, 400);

    // Validate URL format
    if (!validateUrl(body.url)) {
      return err('Invalid URL format', 400);
    }

    const domain = extractDomain(body.url);
    const id = generateId('swb');
    const now = new Date().toISOString();

    const newWebsite = {
      id,
      clientId,
      url: body.url,
      domain,
      label: body.label,
      isPrimary: body.isPrimary ?? false,
      status: body.status ?? 'active',
      createdAt: now,
      updatedAt: now,
    };

    console.log(
      '[API] POST /api/clients/[clientId]/websites payload:',
      JSON.stringify(newWebsite)
    );

    const created_website = await seoWebsites.createAsync(newWebsite);

    logActivity(id, 'website_created', {
      clientId,
      url: body.url,
      domain,
      createdBy: getRequestRole(req),
    });

    console.log(
      `[API] POST /api/clients/${clientId}/websites ✅ id=${id}`
    );
    return created(created_website);
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    console.error(
      '[API] POST /api/clients/[clientId]/websites error:',
      msg
    );
    return err(`Failed to create website: ${msg}`, 500);
  }
}

/* ── Exported handlers ─────────────────────────────────────────────────── */

export const GET = withErrorBoundary(handleGET);
export const POST = withErrorBoundary(handlePOST);
