/**
 * GET    /api/data/clients/[id] - Get a single client
 * PUT    /api/data/clients/[id] - Update a client (partial)
 * DELETE /api/data/clients/[id] - Delete a client
 *
 * Storage: Supabase "clients" table.
 *
 * NOTE: Social columns (website, facebook, instagram, tiktok, linkedin,
 * youtube) and marketing columns (marketing_goals, key_marketing_messages)
 * are temporarily EXCLUDED from write payloads because PostgREST's schema
 * cache does not recognise them yet.  They are still read from SELECT *
 * responses when present so existing data is not lost.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/db/store';
import { requireRole } from '@/lib/auth/api-guard';

type ClientRow = Record<string, unknown> & { id: string };

/* ── Row → API object ────────────────────────────────────────────────── */

function rowToClient(r: ClientRow) {
  return {
    id:                  r.id,
    name:               (r.name as string) ?? '',
    company:            (r.company as string) ?? '',
    contactPerson:      (r.contact_person as string) ?? '',
    email:              (r.email as string) ?? '',
    phone:              (r.phone as string) ?? '',
    notes:              (r.notes as string) ?? '',
    businessField:      (r.business_field as string) ?? '',
    clientType:         (r.client_type as string) ?? 'marketing',
    status:             (r.status as string) ?? 'active',
    retainerAmount:     Number(r.retainer_amount) || 0,
    retainerDay:        Number(r.retainer_day) || 1,
    color:              (r.color as string) ?? '#00B5FE',
    convertedFromLead:  (r.converted_from_lead as string) ?? null,
    assignedManagerId:  (r.assigned_manager_id as string) ?? null,
    // Social — read-only from DB; NOT written for now
    websiteUrl:          (r.website as string) ?? '',
    facebookPageUrl:     (r.facebook as string) ?? '',
    instagramProfileUrl: (r.instagram as string) ?? '',
    tiktokProfileUrl:    (r.tiktok as string) ?? '',
    linkedinUrl:         (r.linkedin as string) ?? '',
    youtubeUrl:          (r.youtube as string) ?? '',
    // Marketing — read-only from DB; NOT written for now
    marketingGoals:      (r.marketing_goals as string) ?? '',
    keyMarketingMessages:(r.key_marketing_messages as string) ?? '',
    logoUrl:             (r.logo_url as string) ?? '',
    createdAt:           (r.created_at as string) ?? '',
    updatedAt:           (r.updated_at as string) ?? '',
  };
}

/* ── camelCase body → snake_case DB payload (safe fields only) ──────── */

function toDbUpdate(body: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  const set = (bodyKey: string, dbKey: string) => {
    if (body[bodyKey] !== undefined) out[dbKey] = body[bodyKey];
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
  set('convertedFromLead', 'converted_from_lead');
  set('assignedManagerId', 'assigned_manager_id');
  set('logoUrl', 'logo_url');
  // Social & marketing fields intentionally omitted — schema cache issue

  out.updated_at = new Date().toISOString();
  return out;
}

/* ── GET ──────────────────────────────────────────────────────────────── */

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const getErr = requireRole(req, 'admin', 'employee');
  if (getErr) return getErr;

  try {
    const { id } = await context.params;
    const sb = getSupabase();
    const { data, error } = await sb
      .from('clients')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) {
      console.error('[API] GET /api/data/clients/[id] supabase error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    if (!data) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    }

    console.log(`[API] GET /api/data/clients/${id} DB keys: ${Object.keys(data).join(', ')}`);

    const client = rowToClient(data as ClientRow);
    return NextResponse.json(client);
  } catch (error) {
    console.error('[API] GET /api/data/clients/[id] error:', error);
    return NextResponse.json({ error: 'Failed to fetch client' }, { status: 500 });
  }
}

/* ── PUT ──────────────────────────────────────────────────────────────── */

export async function PUT(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const putErr = requireRole(req, 'admin');
  if (putErr) return putErr;

  try {
    const { id } = await context.params;
    let body: Record<string, unknown> = {};
    try { body = (await req.json()) as Record<string, unknown>; } catch { /* noop */ }

    const updatePayload = toDbUpdate(body);
    console.log(`[API] PUT /api/data/clients/${id} payload:`, JSON.stringify(updatePayload));

    const sb = getSupabase();
    const { data, error } = await sb
      .from('clients')
      .update(updatePayload)
      .eq('id', id)
      .select('*')
      .maybeSingle();

    if (error) {
      console.error('[API] PUT /api/data/clients/[id] supabase error:', error);
      return NextResponse.json(
        { error: (error as { message: string }).message, code: (error as { code?: string }).code ?? null },
        { status: 400 },
      );
    }
    if (!data) {
      return NextResponse.json({ error: 'Client not found', clientId: id }, { status: 404 });
    }

    const result = rowToClient(data as ClientRow);
    console.log(`[API] PUT /api/data/clients/${id} ✅ saved keys=${Object.keys(data as object).join(',')}`);
    return NextResponse.json(result);
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    console.error('[API] PUT /api/data/clients/[id] fatal:', msg);
    return NextResponse.json({ error: `Failed to update client: ${msg}` }, { status: 500 });
  }
}

/* ── DELETE ───────────────────────────────────────────────────────────── */

export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const delErr = requireRole(req, 'admin');
  if (delErr) return delErr;

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
