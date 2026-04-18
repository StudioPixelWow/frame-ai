/**
 * GET  /api/data/clients — Get all clients
 * POST /api/data/clients — Create a new client
 *
 * Storage: Supabase "clients" table.
 * The frontend uses camelCase field names; this route maps between
 * camelCase (API contract) and snake_case (DB columns).
 *
 * DB social columns: website, facebook, instagram, tiktok, linkedin, youtube
 * DB marketing columns: marketing_goals, key_marketing_messages
 *
 * If PostgREST's schema cache is stale (columns exist in DB but PostgREST
 * doesn't know about them), we issue NOTIFY pgrst,'reload schema' and retry.
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

/** Map a raw DB row → camelCase API object. */
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
    // Social — DB columns are: website, facebook, instagram, tiktok, linkedin, youtube
    websiteUrl:          (r.website as string) ?? '',
    facebookPageUrl:     (r.facebook as string) ?? '',
    instagramProfileUrl: (r.instagram as string) ?? '',
    tiktokProfileUrl:    (r.tiktok as string) ?? '',
    linkedinUrl:         (r.linkedin as string) ?? '',
    youtubeUrl:          (r.youtube as string) ?? '',
    // Marketing
    marketingGoals:      (r.marketing_goals as string) ?? '',
    keyMarketingMessages:(r.key_marketing_messages as string) ?? '',
    logoUrl:             (r.logo_url as string) ?? '',
    createdAt:           (r.created_at as string) ?? '',
    updatedAt:           (r.updated_at as string) ?? '',
  };
}

/**
 * Refresh PostgREST schema cache.  Call this when we get a
 * "Could not find column … in the schema cache" error —
 * it means the column exists in Postgres but PostgREST hasn't
 * picked it up yet.
 */
let _cacheRefreshed = false;
async function refreshSchemaCache(sb: ReturnType<typeof getSupabase>): Promise<void> {
  if (_cacheRefreshed) return;           // only once per process
  _cacheRefreshed = true;
  try {
    await sb.rpc('exec_sql', { query: `NOTIFY pgrst, 'reload schema';` });
    console.log('[clients] ✅ PostgREST schema cache reload requested');
  } catch (e) {
    console.warn('[clients] ⚠️ could not reload schema cache:', e);
  }
}

/**
 * Insert a row into `clients`.
 * If PostgREST complains about a missing column in the schema cache:
 *   1) Refresh the schema cache (NOTIFY pgrst)
 *   2) Retry the exact same insert
 * If a column genuinely doesn't exist (not a cache issue), drop it and retry.
 */
async function safeInsert(
  sb: ReturnType<typeof getSupabase>,
  payload: Record<string, unknown>,
): Promise<{ row: ClientRow | null; error: { message: string; code?: string } | null }> {
  let current = { ...payload };
  let lastError: { message: string; code?: string } | null = null;
  let cacheReloaded = false;

  for (let attempt = 0; attempt < 25; attempt++) {
    const { data, error } = await sb
      .from('clients')
      .insert(current)
      .select('*')
      .single();

    if (!error) return { row: data as ClientRow, error: null };

    lastError = error as { message: string; code?: string };
    const msg = error.message;

    // Schema cache error — column exists in DB but PostgREST doesn't know it
    if (msg.includes('schema cache') && !cacheReloaded) {
      console.warn(`[clients] schema cache miss — refreshing (attempt ${attempt + 1}): ${msg}`);
      await refreshSchemaCache(sb);
      cacheReloaded = true;
      // Retry the same payload after cache refresh — don't drop the column
      continue;
    }

    // Actual missing column — drop it
    const m = msg.match(
      /Could not find the '([^']+)' column|column .*?['"]?([a-z_]+)['"]? (?:does not exist|of relation)/i,
    );
    const badCol = m?.[1] || m?.[2];
    if (!badCol) {
      console.error(`[clients] insert error (attempt ${attempt + 1}):`, msg);
      break;
    }
    if (badCol in current) {
      console.warn(`[clients] dropping column "${badCol}" (attempt ${attempt + 1})`);
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
      // Social — always include, even if empty string
      website:             body.websiteUrl ?? '',
      facebook:            body.facebookPageUrl ?? '',
      instagram:           body.instagramProfileUrl ?? '',
      tiktok:              body.tiktokProfileUrl ?? '',
      linkedin:            body.linkedinUrl ?? '',
      youtube:             body.youtubeUrl ?? '',
      // Marketing
      marketing_goals:         body.marketingGoals ?? '',
      key_marketing_messages:  body.keyMarketingMessages ?? '',
      logo_url:                body.logoUrl ?? '',
      created_at:              now,
      updated_at:              now,
    };

    if (body.assignedManagerId != null && body.assignedManagerId !== '') {
      insertRow.assigned_manager_id = body.assignedManagerId;
    }

    console.log('[API] POST /api/data/clients payload:', JSON.stringify(insertRow));

    const { row: inserted, error: insertErr } = await safeInsert(sb, insertRow);

    if (!inserted) {
      console.error('[API] POST /api/data/clients FAILED:', insertErr);
      return NextResponse.json(
        { error: insertErr?.message ?? 'Insert failed' },
        { status: 400 },
      );
    }

    console.log(`[API] POST /api/data/clients ✅ id=${inserted.id} keys=${Object.keys(inserted).join(',')}`);
    return NextResponse.json(rowToClient(inserted), { status: 201 });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    console.error('[API] POST /api/data/clients error:', msg);
    return NextResponse.json({ error: `Failed to create client: ${msg}` }, { status: 400 });
  }
}
