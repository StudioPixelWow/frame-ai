/**
 * GET  /api/data/clients — Get all clients
 * POST /api/data/clients — Create a new client
 *
 * Storage: Supabase "clients" table.
 * The frontend uses camelCase field names; this route maps between
 * camelCase (API contract) and snake_case (DB columns).
 *
 * Social / marketing columns may or may not exist in the production DB.
 * The code includes them in the insert payload, and the column-drop
 * retry loop strips any that PostgREST rejects.  No schema DDL is run.
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
 * Reads both possible column-name conventions so it works regardless
 * of which naming scheme the production table uses.
 */
function rowToClient(r: ClientRow) {
  return {
    id: r.id,
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
    // Social & marketing — read whichever column name exists
    websiteUrl:          (r.website as string) || (r.website_url as string) || '',
    facebookPageUrl:     (r.facebook as string) || (r.facebook_page_url as string) || '',
    instagramProfileUrl: (r.instagram as string) || (r.instagram_profile_url as string) || '',
    tiktokProfileUrl:    (r.tiktok as string) || (r.tiktok_profile_url as string) || '',
    linkedinUrl:         (r.linkedin as string) || (r.linkedin_url as string) || '',
    youtubeUrl:          (r.youtube as string) || (r.youtube_url as string) || '',
    marketingGoals:      (r.marketing_goals as string) ?? '',
    keyMarketingMessages:(r.key_marketing_messages as string) ?? '',
    logoUrl:             (r.logo_url as string) ?? '',
    createdAt:           (r.created_at as string) ?? '',
    updatedAt:           (r.updated_at as string) ?? '',
  };
}

/**
 * Column-drop retry: INSERT or UPDATE, and if PostgREST rejects an
 * unknown column, strip it from the payload and retry.
 * Returns the successful row or the last error.
 */
async function insertWithRetry(
  sb: ReturnType<typeof getSupabase>,
  payload: Record<string, unknown>,
): Promise<{ row: ClientRow | null; error: { message: string; code?: string } | null }> {
  let current = { ...payload };
  let lastError: { message: string; code?: string } | null = null;

  for (let attempt = 0; attempt < 25; attempt++) {
    const { data, error } = await sb
      .from('clients')
      .insert(current)
      .select('*')
      .single();

    if (!error) return { row: data as ClientRow, error: null };

    lastError = error as { message: string; code?: string };
    const m = error.message.match(
      /Could not find the '([^']+)' column|column .*?['"]?([a-z_]+)['"]? (?:does not exist|of relation)/i,
    );
    const badCol = m?.[1] || m?.[2];
    if (!badCol) {
      console.error(`[clients] insert non-column error (attempt ${attempt + 1}):`, error.message);
      break;
    }
    if (badCol in current) {
      console.warn(`[clients] insert: dropping unknown column "${badCol}" (attempt ${attempt + 1})`);
      const { [badCol]: _dropped, ...rest } = current;
      void _dropped;
      current = rest;
    } else {
      break;
    }
  }
  return { row: null, error: lastError };
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
      console.error('[API] GET /api/data/clients supabase error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Debug: log column names from first row
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

    // Core columns (guaranteed to exist)
    const insertRow: Record<string, unknown> = {
      id,
      name:              body.name ?? '',
      company:           body.company ?? '',
      contact_person:    body.contactPerson ?? '',
      email:             body.email ?? '',
      phone:             body.phone ?? '',
      notes:             body.notes ?? '',
      business_field:    body.businessField ?? '',
      client_type:       body.clientType ?? 'marketing',
      status:            body.status ?? 'active',
      retainer_amount:   body.retainerAmount ?? 0,
      retainer_day:      body.retainerDay ?? 1,
      color:             body.color ?? '#00B5FE',
      converted_from_lead: body.convertedFromLead ?? null,
      created_at:        now,
      updated_at:        now,
    };

    if (body.assignedManagerId != null && body.assignedManagerId !== '') {
      insertRow.assigned_manager_id = body.assignedManagerId;
    }

    // Social / marketing columns — may or may not exist in the DB.
    // We include ONE name per field; the column-drop retry strips anything
    // that PostgREST rejects.
    if (body.websiteUrl)          insertRow.website             = body.websiteUrl;
    if (body.facebookPageUrl)     insertRow.facebook            = body.facebookPageUrl;
    if (body.instagramProfileUrl) insertRow.instagram           = body.instagramProfileUrl;
    if (body.tiktokProfileUrl)    insertRow.tiktok              = body.tiktokProfileUrl;
    if (body.linkedinUrl)         insertRow.linkedin            = body.linkedinUrl;
    if (body.youtubeUrl)          insertRow.youtube             = body.youtubeUrl;
    if (body.marketingGoals)      insertRow.marketing_goals     = body.marketingGoals;
    if (body.keyMarketingMessages) insertRow.key_marketing_messages = body.keyMarketingMessages;
    if (body.logoUrl)             insertRow.logo_url            = body.logoUrl;

    console.log(`[API] POST /api/data/clients id=${id} payload:`, JSON.stringify(insertRow));

    const { row: inserted, error: insertErr } = await insertWithRetry(sb, insertRow);

    if (!inserted) {
      console.error('[API] POST /api/data/clients FAILED:', insertErr);
      return NextResponse.json(
        { error: insertErr?.message ?? 'Insert failed', code: (insertErr as Record<string, unknown>)?.code ?? null },
        { status: 400 },
      );
    }

    console.log(`[API] POST /api/data/clients ✅ created id=${inserted.id} returned_keys=${Object.keys(inserted).join(',')}`);
    return NextResponse.json(rowToClient(inserted), { status: 201 });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    console.error('[API] POST /api/data/clients error:', msg);
    return NextResponse.json({ error: `Failed to create client: ${msg}` }, { status: 400 });
  }
}
