/**
 * GET  /api/data/clients — Get all clients
 * POST /api/data/clients — Create a new client
 *
 * Storage: Supabase "clients" table.
 * The frontend uses camelCase field names; this route maps between
 * camelCase (API contract) and snake_case (DB columns).
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

/* ── helpers ─────────────────────────────────────────────────────────── */

function generateId(): string {
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 6);
  return `cli_${ts}_${rand}`;
}

type ClientRow = Record<string, unknown> & { id: string };

/**
 * Map a raw DB row → camelCase API object.
 * Reads social/marketing columns if they happen to be in the SELECT *
 * result — harmless when they're absent (defaults to '').
 */
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
    // Social — read-only from DB; NOT written to DB for now
    websiteUrl:          (r.website as string) ?? '',
    facebookPageUrl:     (r.facebook as string) ?? '',
    instagramProfileUrl: (r.instagram as string) ?? '',
    tiktokProfileUrl:    (r.tiktok as string) ?? '',
    linkedinUrl:         (r.linkedin as string) ?? '',
    youtubeUrl:          (r.youtube as string) ?? '',
    // Marketing — read-only from DB; NOT written to DB for now
    marketingGoals:      (r.marketing_goals as string) ?? '',
    keyMarketingMessages:(r.key_marketing_messages as string) ?? '',
    logoUrl:             (r.logo_url as string) ?? '',
    createdAt:           (r.created_at as string) ?? '',
    updatedAt:           (r.updated_at as string) ?? '',
  };
}

/* ── GET ──────────────────────────────────────────────────────────────── */

export async function GET(req: NextRequest) {
  const roleErr = requireRole(req, 'admin', 'employee');
  if (roleErr) return roleErr;

  try {
    const sb = getSupabase();
    const { data: rows, error } = await sb
      .from('clients')
      .select('*')
      .order('id');

    if (error) {
      console.error('[API] GET /api/data/clients error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (rows && rows.length > 0) {
      console.log(`[API] GET /api/data/clients DB columns: ${Object.keys(rows[0]).join(', ')}`);
    }

    const clients = (rows ?? []).map((r: Record<string, unknown>) => rowToClient(r as ClientRow));
    return NextResponse.json(clients);
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    console.error('[API] GET /api/data/clients error:', msg);
    return NextResponse.json({ error: `Failed to fetch clients: ${msg}` }, { status: 500 });
  }
}

/* ── POST ─────────────────────────────────────────────────────────────── */

export async function POST(req: NextRequest) {
  const roleErr = requireRole(req, 'admin');
  if (roleErr) return roleErr;

  try {
    const sb = getSupabase();
    const body = await req.json();
    const now = new Date().toISOString();
    const id = generateId();

    // Only safe, known-good columns — no social/marketing fields
    const insertRow: Record<string, unknown> = {
      id,
      name:                body.name ?? '',
      company:             body.company ?? '',
      contact_person:      body.contactPerson ?? '',
      email:               body.email ?? '',
      phone:               body.phone ?? '',
      notes:               body.notes ?? '',
      business_field:      body.businessField ?? '',
      client_type:         body.clientType ?? 'marketing',
      status:              body.status ?? 'active',
      retainer_amount:     body.retainerAmount ?? 0,
      retainer_day:        body.retainerDay ?? 1,
      color:               body.color ?? '#00B5FE',
      converted_from_lead: body.convertedFromLead ?? null,
      // logo_url excluded — not in schema cache
      created_at:          now,
      updated_at:          now,
    };

    if (body.assignedManagerId != null && body.assignedManagerId !== '') {
      insertRow.assigned_manager_id = body.assignedManagerId;
    }

    console.log('[API] POST /api/data/clients payload:', JSON.stringify(insertRow));

    const { data: inserted, error: insertErr } = await sb
      .from('clients')
      .insert(insertRow)
      .select('*')
      .single();

    if (insertErr) {
      console.error('[API] POST /api/data/clients FAILED:', insertErr);
      return NextResponse.json(
        { error: (insertErr as { message: string }).message ?? 'Insert failed' },
        { status: 400 },
      );
    }

    console.log(`[API] POST /api/data/clients ✅ id=${(inserted as ClientRow).id} keys=${Object.keys(inserted as object).join(',')}`);
    return NextResponse.json(rowToClient(inserted as ClientRow), { status: 201 });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    console.error('[API] POST /api/data/clients error:', msg);
    return NextResponse.json({ error: `Failed to create client: ${msg}` }, { status: 400 });
  }
}
