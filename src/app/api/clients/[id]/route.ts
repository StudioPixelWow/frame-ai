/**
 * GET    /api/clients/[id] — Get a single client
 * PATCH  /api/clients/[id] — Update client fields
 *
 * Storage: Supabase "clients" table (direct query).
 * Clients can only access their own record; admin/employee can access any.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import {
  getRequestRole,
  getRequestClientId,
  requireRole,
  requireClientAccess,
} from '@/lib/auth/api-guard';
import {
  ok,
  err,
  notFound,
  forbidden,
  logActivity,
  parseBody,
  withErrorBoundary,
} from '@/lib/seo/api-helpers';

/* ── Supabase client setup ─────────────────────────────────────────── */

function getSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createClient(supabaseUrl, supabaseKey);
}

type ClientRow = Record<string, unknown> & { id: string };

function rowToClient(r: ClientRow) {
  return {
    id: r.id,
    name: (r.name as string) ?? '',
    company: (r.company as string) ?? '',
    contactPerson: (r.contact_person as string) ?? '',
    email: (r.email as string) ?? '',
    phone: (r.phone as string) ?? '',
    notes: (r.notes as string) ?? '',
    businessField: (r.business_field as string) ?? '',
    clientType: (r.client_type as string) ?? 'marketing',
    status: (r.status as string) ?? 'active',
    retainerAmount: Number(r.retainer_amount) || 0,
    retainerDay: Number(r.retainer_day) || 1,
    color: (r.color as string) ?? '#00B5FE',
    convertedFromLead: (r.converted_from_lead as string) ?? null,
    assignedManagerId: (r.assigned_manager_id as string) ?? null,
    createdAt: (r.created_at as string) ?? '',
    updatedAt: (r.updated_at as string) ?? '',
  };
}

/* ── GET ──────────────────────────────────────────────────────────────── */

async function handleGET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const sb = getSupabaseClient();
    const { data, error } = await sb
      .from('clients')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) {
      console.error('[API] GET /api/clients/[id] supabase error:', error);
      return err(error.message, 500);
    }

    if (!data) {
      return notFound('Client');
    }

    // Check client access
    const accessErr = requireClientAccess(req, id);
    if (accessErr) return accessErr;

    const client = rowToClient(data as ClientRow);
    console.log(`[API] GET /api/clients/${id} ✅`);
    return ok(client);
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    console.error('[API] GET /api/clients/[id] error:', msg);
    return err('Failed to fetch client', 500);
  }
}

/* ── PATCH ────────────────────────────────────────────────────────────── */

async function handlePATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const patchErr = requireRole(req, 'admin', 'employee');
  if (patchErr) return patchErr;

  try {
    const { id } = await context.params;
    const { body, error: parseErr } = await parseBody<Record<string, unknown>>(
      req
    );

    if (parseErr) return parseErr;
    if (!body) return err('Invalid JSON body', 400);

    const sb = getSupabaseClient();

    // Fetch existing client to verify access
    const { data: existing, error: fetchErr } = await sb
      .from('clients')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (fetchErr) {
      console.error('[API] PATCH /api/clients/[id] fetch error:', fetchErr);
      return err(fetchErr.message, 500);
    }

    if (!existing) {
      return notFound('Client');
    }

    // Build update payload (safe fields only)
    const updatePayload: Record<string, unknown> = {};
    const set = (bodyKey: string, dbKey: string) => {
      if (body[bodyKey] !== undefined) updatePayload[dbKey] = body[bodyKey];
    };

    set('name', 'name');
    set('company', 'company');
    set('contactPerson', 'contact_person');
    set('email', 'email');
    set('phone', 'phone');
    set('notes', 'notes');
    set('businessField', 'business_field');
    set('clientType', 'client_type');
    set('status', 'status');
    set('retainerAmount', 'retainer_amount');
    set('retainerDay', 'retainer_day');
    set('color', 'color');
    set('assignedManagerId', 'assigned_manager_id');

    updatePayload.updated_at = new Date().toISOString();

    console.log(
      `[API] PATCH /api/clients/${id} payload:`,
      JSON.stringify(updatePayload)
    );

    const { data: updated, error: updateErr } = await sb
      .from('clients')
      .update(updatePayload)
      .eq('id', id)
      .select('*')
      .maybeSingle();

    if (updateErr) {
      console.error('[API] PATCH /api/clients/[id] error:', updateErr);
      return err(
        (updateErr as { message: string }).message || 'Update failed',
        400
      );
    }

    if (!updated) {
      return notFound('Client');
    }

    logActivity(id, 'client_updated', {
      updatedBy: getRequestRole(req),
      fieldsChanged: Object.keys(body).length,
    });

    const result = rowToClient(updated as ClientRow);
    console.log(`[API] PATCH /api/clients/${id} ✅ saved`);
    return ok(result);
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    console.error('[API] PATCH /api/clients/[id] error:', msg);
    return err(`Failed to update client: ${msg}`, 500);
  }
}

/* ── Exported handlers ─────────────────────────────────────────────────── */

export const GET = withErrorBoundary(handleGET);
export const PATCH = withErrorBoundary(handlePATCH);
