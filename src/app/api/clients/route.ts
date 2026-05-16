/**
 * GET  /api/clients — List all clients
 * POST /api/clients — Create a new client
 *
 * Storage: Supabase "clients" table (direct query).
 * Clients can only see their own record; admin/employee see all (or filtered).
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import {
  getRequestRole,
  getRequestClientId,
  getRequestEmployeeId,
  scopeForClient,
  requireRole,
} from '@/lib/auth/api-guard';
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

async function handleGET(req: NextRequest) {
  const role = getRequestRole(req);

  try {
    const sb = getSupabaseClient();
    let query = sb.from('clients').select('*').order('id');

    // Client role: only return their own record
    if (role === 'client') {
      const clientId = getRequestClientId(req);
      if (!clientId) return ok([]);
      query = query.eq('id', clientId);
    }

    // Employee role: only return clients assigned to this employee
    if (role === 'employee') {
      const employeeId = getRequestEmployeeId(req);
      if (employeeId) {
        query = query.eq('assigned_manager_id', employeeId);
      }
    }

    const { data: rows, error } = await query;

    if (error) {
      console.error('[API] GET /api/clients error:', error);
      return ok([]); // Return empty array on transient DB errors
    }

    const clients = (rows ?? []).map((r: Record<string, unknown>) =>
      rowToClient(r as unknown as ClientRow)
    );
    console.log(
      `[API] GET /api/clients ✅ returning ${clients.length} clients`
    );
    return ok(clients);
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    console.error('[API] GET /api/clients error:', msg);
    return ok([]); // Return empty array on transient errors
  }
}

/* ── POST ─────────────────────────────────────────────────────────────── */

async function handlePOST(req: NextRequest) {
  const roleErr = requireRole(req, 'admin', 'employee');
  if (roleErr) return roleErr;

  try {
    const { body, error: parseErr } = await parseBody<{
      name: string;
      company?: string;
      contactPerson?: string;
      email?: string;
      phone?: string;
      notes?: string;
      businessField?: string;
      clientType?: string;
      status?: string;
      retainerAmount?: number;
      retainerDay?: number;
      color?: string;
      assignedManagerId?: string;
    }>(req);

    if (parseErr) return parseErr;
    if (!body) return err('Invalid JSON body', 400);

    // Validate required fields
    const validation = validateRequired(body, ['name']);
    if (validation) return err(validation, 400);

    const sb = getSupabaseClient();
    const now = new Date().toISOString();
    const id = generateId('cli');

    const insertRow: Record<string, unknown> = {
      id,
      name: body.name,
      company: body.company ?? '',
      contact_person: body.contactPerson ?? '',
      email: body.email ?? '',
      phone: body.phone ?? '',
      notes: body.notes ?? '',
      business_field: body.businessField ?? '',
      client_type: body.clientType ?? 'marketing',
      status: body.status ?? 'active',
      retainer_amount: body.retainerAmount ?? 0,
      retainer_day: body.retainerDay ?? 1,
      color: body.color ?? '#00B5FE',
      created_at: now,
      updated_at: now,
    };

    if (body.assignedManagerId) {
      insertRow.assigned_manager_id = body.assignedManagerId;
    }

    console.log(
      '[API] POST /api/clients payload:',
      JSON.stringify(insertRow)
    );

    const { data: inserted, error: insertErr } = await sb
      .from('clients')
      .insert(insertRow)
      .select('*')
      .single();

    if (insertErr) {
      console.error('[API] POST /api/clients FAILED:', insertErr);
      return err(
        (insertErr as { message: string }).message ?? 'Insert failed',
        400
      );
    }

    logActivity(id, 'client_created', {
      name: body.name,
      createdBy: getRequestRole(req),
    });

    const result = rowToClient(inserted as unknown as ClientRow);
    console.log(
      `[API] POST /api/clients ✅ id=${result.id}`
    );
    return created(result);
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    console.error('[API] POST /api/clients error:', msg);
    return err(`Failed to create client: ${msg}`, 500);
  }
}

/* ── Exported handlers ─────────────────────────────────────────────────── */

export const GET = withErrorBoundary(handleGET);
export const POST = withErrorBoundary(handlePOST);
