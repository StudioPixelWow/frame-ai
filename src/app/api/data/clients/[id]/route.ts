/**
 * GET    /api/data/clients/[id] - Get a single client
 * PUT    /api/data/clients/[id] - Update a client (partial)
 * DELETE /api/data/clients/[id] - Delete a client
 *
 * Storage: Supabase "clients" table (same source of truth as /api/data/clients).
 *
 * Required column (run once in Supabase SQL editor):
 *   ALTER TABLE clients ADD COLUMN IF NOT EXISTS assigned_manager_id TEXT;
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/db/store';

const COLUMNS =
  'id, name, company, contact_person, email, phone, notes, business_field, client_type, status, retainer_amount, retainer_day, color, converted_from_lead, assigned_manager_id, created_at, updated_at';

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

/** Map incoming camelCase partial update → snake_case DB columns. Only known fields are forwarded. */
function toDbUpdate(body: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  const setIfPresent = (bodyKey: string, dbKey: string) => {
    if (body[bodyKey] !== undefined) out[dbKey] = body[bodyKey];
  };
  setIfPresent('name', 'name');
  setIfPresent('company', 'company');
  setIfPresent('contactPerson', 'contact_person');
  setIfPresent('email', 'email');
  setIfPresent('phone', 'phone');
  setIfPresent('notes', 'notes');
  setIfPresent('businessField', 'business_field');
  setIfPresent('clientType', 'client_type');
  setIfPresent('status', 'status');
  setIfPresent('retainerAmount', 'retainer_amount');
  setIfPresent('retainerDay', 'retainer_day');
  setIfPresent('color', 'color');
  setIfPresent('convertedFromLead', 'converted_from_lead');
  setIfPresent('assignedManagerId', 'assigned_manager_id');
  out.updated_at = new Date().toISOString();
  return out;
}

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const sb = getSupabase();
    const { data, error } = await sb
      .from('clients')
      .select(COLUMNS)
      .eq('id', id)
      .maybeSingle();

    if (error) {
      console.error('[API] GET /api/data/clients/[id] supabase error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    if (!data) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    }
    return NextResponse.json(rowToClient(data as ClientRow));
  } catch (error) {
    console.error('[API] GET /api/data/clients/[id] error:', error);
    return NextResponse.json({ error: 'Failed to fetch client' }, { status: 500 });
  }
}

export async function PUT(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    let body: Record<string, unknown> = {};
    try { body = (await req.json()) as Record<string, unknown>; } catch { /* noop */ }

    const update = toDbUpdate(body);
    console.log(`[API] PUT /api/data/clients/${id} fields=${Object.keys(update).join(',')}`);

    const sb = getSupabase();
    const { data, error } = await sb
      .from('clients')
      .update(update)
      .eq('id', id)
      .select(COLUMNS)
      .maybeSingle();

    if (error) {
      console.error('[API] PUT /api/data/clients/[id] supabase error:', error);
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    if (!data) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    }
    return NextResponse.json(rowToClient(data as ClientRow));
  } catch (error) {
    console.error('[API] PUT /api/data/clients/[id] error:', error);
    return NextResponse.json({ error: 'Failed to update client' }, { status: 400 });
  }
}

export async function DELETE(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const sb = getSupabase();
    const { error } = await sb.from('clients').delete().eq('id', id);
    if (error) {
      console.error('[API] DELETE /api/data/clients/[id] supabase error:', error);
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[API] DELETE /api/data/clients/[id] error:', error);
    return NextResponse.json({ error: 'Failed to delete client' }, { status: 500 });
  }
}
