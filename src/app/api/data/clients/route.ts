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

/* ── GET ──────────────────────────────────────────────────────────────── */

export async function GET() {
  try {
    const sb = getSupabase();

    const { data: rows, error } = await sb
      .from('clients')
      .select(COLUMNS)
      .order('id');

    if (error) {
      console.error('[API] GET /api/data/clients supabase error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const clients = (rows ?? []).map((r) => rowToClient(r as ClientRow));
    return NextResponse.json(clients);
  } catch (error) {
    console.error('[API] GET /api/data/clients error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch clients' },
      { status: 500 }
    );
  }
}

/* ── POST ─────────────────────────────────────────────────────────────── */

export async function POST(req: NextRequest) {
  try {
    const sb = getSupabase();
    const body = await req.json();

    const now = new Date().toISOString();
    const id = generateId();

    const insertRow = {
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
      assigned_manager_id: body.assignedManagerId ?? null,
      created_at: now,
      updated_at: now,
    };

    const { data: inserted, error } = await sb
      .from('clients')
      .insert(insertRow)
      .select(COLUMNS)
      .single();

    if (error) {
      console.error('[API] POST /api/data/clients supabase error:', error);
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json(rowToClient(inserted as ClientRow), { status: 201 });
  } catch (error) {
    console.error('[API] POST /api/data/clients error:', error);
    return NextResponse.json(
      { error: 'Failed to create client' },
      { status: 400 }
    );
  }
}
