/**
 * GET  /api/data/clients — Get all clients
 * POST /api/data/clients — Create a new client
 *
 * Storage: Supabase "clients" table with normal columns:
 *   id, name, company, contact_person, email, phone, notes,
 *   business_field, client_type, status, retainer_amount, retainer_day,
 *   color, converted_from_lead, created_at, updated_at
 *
 * The frontend uses camelCase field names; this route maps between
 * camelCase (API contract) and snake_case (DB columns).
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/db/store';
import { requireRole } from '@/lib/auth/api-guard';

/* ── ID generator ─────────────────────────────────────────────────────── */

function generateId(): string {
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 6);
  return `cli_${ts}_${rand}`;
}

/* ── Row → API object (snake_case → camelCase) ────────────────────────── */

type ClientRow = {
  id: string;
  name: string | null;
  company: string | null;
  contact_person: string | null;
  email: string | null;
  phone: string | null;
  notes: string | null;
  business_field: string | null;
  client_type: string | null;
  status: string | null;
  retainer_amount: number | null;
  retainer_day: number | null;
  color: string | null;
  converted_from_lead: string | null;
  assigned_manager_id: string | null;
  created_at: string | null;
  updated_at: string | null;
};

function rowToClient(r: ClientRow) {
  return {
    id: r.id,
    name: r.name ?? '',
    company: r.company ?? '',
    contactPerson: r.contact_person ?? '',
    email: r.email ?? '',
    phone: r.phone ?? '',
    notes: r.notes ?? '',
    businessField: r.business_field ?? '',
    clientType: r.client_type ?? 'marketing',
    status: r.status ?? 'active',
    retainerAmount: r.retainer_amount ?? 0,
    retainerDay: r.retainer_day ?? 1,
    color: r.color ?? '#00B5FE',
    convertedFromLead: r.converted_from_lead ?? null,
    assignedManagerId: r.assigned_manager_id ?? null,
    createdAt: r.created_at ?? '',
    updatedAt: r.updated_at ?? '',
  };
}

const COLUMNS =
  'id, name, company, contact_person, email, phone, notes, business_field, client_type, status, retainer_amount, retainer_day, color, converted_from_lead, assigned_manager_id, created_at, updated_at';

const COLUMNS_FALLBACK =
  'id, name, company, contact_person, email, phone, notes, business_field, client_type, status, retainer_amount, retainer_day, color, converted_from_lead, created_at, updated_at';

/* ── GET ──────────────────────────────────────────────────────────────── */

export async function GET(req: NextRequest) {
  // Only admin and employee can list clients
  const roleErr = requireRole(req, 'admin', 'employee');
  if (roleErr) return roleErr;

  try {
    const sb = getSupabase();

    // Try full column list; fall back if a column (e.g. assigned_manager_id)
    // hasn't been added to the DB yet.
    let { data: rows, error } = await sb
      .from('clients')
      .select(COLUMNS)
      .order('id');

    if (error && /column .* does not exist|Could not find the '([^']+)' column/i.test(error.message)) {
      console.warn(`[API] GET /api/data/clients falling back to minimal column set: ${error.message}`);
      const retry = await sb.from('clients').select(COLUMNS_FALLBACK).order('id');
      rows = retry.data as any;
      error = retry.error as any;
    }

    if (error) {
      console.error('[API] GET /api/data/clients supabase error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const clients = (rows ?? []).map((r) => rowToClient(r as ClientRow));
    return NextResponse.json(clients);
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    console.error('[API] GET /api/data/clients error:', msg);
    return NextResponse.json(
      { error: `Failed to fetch clients: ${msg}` },
      { status: 500 }
    );
  }
}

/* ── POST ─────────────────────────────────────────────────────────────── */

export async function POST(req: NextRequest) {
  // Only admin can create clients
  const roleErr = requireRole(req, 'admin');
  if (roleErr) return roleErr;

  try {
    const sb = getSupabase();
    const body = await req.json();

    const now = new Date().toISOString();
    const id = generateId();

    // Base row — only columns that are always required/present.
    const baseRow: Record<string, unknown> = {
      id,
      name: body.name ?? '',
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
      converted_from_lead: body.convertedFromLead ?? null,
      created_at: now,
      updated_at: now,
    };

    // Only include assigned_manager_id if the caller actually provided a value.
    // This way creation doesn't fail when the column doesn't exist yet, and
    // a newly assigned client can still be created atomically when it does.
    const insertRow: Record<string, unknown> = { ...baseRow };
    if (body.assignedManagerId != null && body.assignedManagerId !== '') {
      insertRow.assigned_manager_id = body.assignedManagerId;
    }

    // Auto-fallback helper: try full select, retry with minimal select if DB
    // doesn't know a requested column. Also strips unknown columns on retry.
    const COLUMNS_FALLBACK =
      'id, name, company, contact_person, email, phone, notes, business_field, client_type, status, retainer_amount, retainer_day, color, converted_from_lead, created_at, updated_at';

    async function doInsert(payload: Record<string, unknown>) {
      let { data, error } = await sb
        .from('clients')
        .insert(payload)
        .select(COLUMNS)
        .single();
      if (error && /Could not find the '([^']+)' column/i.test(error.message)) {
        const m = error.message.match(/Could not find the '([^']+)' column/i);
        const badCol = m?.[1];
        if (badCol && badCol in payload) {
          console.warn(`[API] POST /api/data/clients dropping unknown column "${badCol}" and retrying`);
          const { [badCol]: _dropped, ...rest } = payload;
          void _dropped;
          const retry = await sb
            .from('clients')
            .insert(rest)
            .select(COLUMNS_FALLBACK)
            .single();
          data = retry.data as any;
          error = retry.error as any;
        } else {
          // unknown column in select only — retry select with fallback
          const retry = await sb
            .from('clients')
            .insert(payload)
            .select(COLUMNS_FALLBACK)
            .single();
          data = retry.data as any;
          error = retry.error as any;
        }
      }
      return { data, error };
    }

    const { data: inserted, error } = await doInsert(insertRow);

    if (error) {
      console.error('[API] POST /api/data/clients supabase error:', error);
      return NextResponse.json(
        { error: error.message, code: (error as any).code ?? null },
        { status: 400 }
      );
    }

    return NextResponse.json(rowToClient(inserted as ClientRow), { status: 201 });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    console.error('[API] POST /api/data/clients error:', msg);
    return NextResponse.json(
      { error: `Failed to create client: ${msg}` },
      { status: 400 }
    );
  }
}
