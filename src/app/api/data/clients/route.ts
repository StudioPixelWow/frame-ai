/**
 * GET  /api/data/clients — Get all clients
 * POST /api/data/clients — Create a new client
 *
 * Storage: Supabase "clients" table.
 * The frontend uses camelCase field names; this route maps between
 * camelCase (API contract) and snake_case (DB columns).
 *
 * IMPORTANT: The code discovers the REAL column list at runtime via
 * information_schema so it never sends columns that don't exist in the DB.
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

/* ── Schema discovery (cached per process) ───────────────────────────── */

let _knownColumns: Set<string> | null = null;

/**
 * Discover which columns actually exist on `public.clients`.
 * Uses information_schema via exec_sql RPC.  Falls back to a SELECT *
 * probe if exec_sql isn't available, and ultimately returns null so the
 * caller can use the column-drop retry loop.
 */
async function discoverColumns(): Promise<Set<string> | null> {
  if (_knownColumns) return _knownColumns;
  try {
    const sb = getSupabase();

    // Approach 1: query information_schema via exec_sql
    const { data: rpcData, error: rpcErr } = await sb.rpc('exec_sql', {
      query: `SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'clients' ORDER BY ordinal_position;`,
    });

    if (!rpcErr && rpcData) {
      // rpcData may be a JSON string or an array depending on the exec_sql implementation
      let cols: string[] = [];
      if (typeof rpcData === 'string') {
        try {
          const parsed = JSON.parse(rpcData);
          if (Array.isArray(parsed)) {
            cols = parsed.map((row: Record<string, unknown>) =>
              (row.column_name as string) ?? ''
            ).filter(Boolean);
          }
        } catch { /* fall through */ }
      } else if (Array.isArray(rpcData)) {
        cols = rpcData.map((row: Record<string, unknown>) =>
          (row.column_name as string) ?? ''
        ).filter(Boolean);
      }

      if (cols.length > 0) {
        _knownColumns = new Set(cols);
        console.log(`[clients] ✅ schema discovered via exec_sql: ${cols.join(', ')}`);
        return _knownColumns;
      }
    }

    // Approach 2: SELECT * LIMIT 1 and read the keys off the returned row
    const { data: probeRows, error: probeErr } = await sb
      .from('clients')
      .select('*')
      .limit(1);
    if (!probeErr && probeRows && probeRows.length > 0) {
      const cols = Object.keys(probeRows[0]);
      _knownColumns = new Set(cols);
      console.log(`[clients] ✅ schema discovered via SELECT * probe: ${cols.join(', ')}`);
      return _knownColumns;
    }

    console.warn('[clients] ⚠️ could not discover schema — will use column-drop retry');
    return null;
  } catch (err) {
    console.warn('[clients] schema discovery error:', err);
    return null;
  }
}

/** Filter a payload to only contain keys that exist as DB columns. */
function filterToKnownColumns(
  payload: Record<string, unknown>,
  known: Set<string> | null,
): Record<string, unknown> {
  if (!known) return payload; // no schema info → send everything, rely on retry
  const filtered: Record<string, unknown> = {};
  const dropped: string[] = [];
  for (const [k, v] of Object.entries(payload)) {
    if (known.has(k)) {
      filtered[k] = v;
    } else {
      dropped.push(k);
    }
  }
  if (dropped.length > 0) {
    console.log(`[clients] filterToKnownColumns dropped: ${dropped.join(', ')}`);
  }
  return filtered;
}

/* ── Row → API object (DB columns → camelCase) ──────────────────────── */

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
    // Social & marketing — try BOTH possible column naming conventions
    // The DB may use short names (website, facebook) or long names (website_url, facebook_page_url)
    websiteUrl:            (r.website as string) || (r.website_url as string) || '',
    facebookPageUrl:       (r.facebook as string) || (r.facebook_page_url as string) || '',
    instagramProfileUrl:   (r.instagram as string) || (r.instagram_profile_url as string) || '',
    tiktokProfileUrl:      (r.tiktok as string) || (r.tiktok_profile_url as string) || '',
    linkedinUrl:           (r.linkedin as string) || (r.linkedin_url as string) || '',
    youtubeUrl:            (r.youtube as string) || (r.youtube_url as string) || '',
    marketingGoals:        (r.marketing_goals as string) ?? '',
    keyMarketingMessages:  (r.key_marketing_messages as string) ?? '',
    logoUrl:               (r.logo_url as string) ?? '',
    createdAt: (r.created_at as string) ?? '',
    updatedAt: (r.updated_at as string) ?? '',
  };
}

/* ── GET ──────────────────────────────────────────────────────────────── */

export async function GET(req: NextRequest) {
  const roleErr = requireRole(req, 'admin', 'employee');
  if (roleErr) return roleErr;

  try {
    const sb = getSupabase();

    // Discover schema on first call (side-effect: caches column list)
    await discoverColumns();

    const { data: rows, error } = await sb
      .from('clients')
      .select('*')
      .order('id');

    if (error) {
      console.error('[API] GET /api/data/clients supabase error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Log actual DB column names from first row (debug)
    if (rows && rows.length > 0) {
      console.log(`[API] GET /api/data/clients first-row keys: ${Object.keys(rows[0]).join(', ')}`);
    }

    const clients = (rows ?? []).map((r) => rowToClient(r as ClientRow));
    return NextResponse.json(clients);
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    console.error('[API] GET /api/data/clients error:', msg);
    return NextResponse.json(
      { error: `Failed to fetch clients: ${msg}` },
      { status: 500 },
    );
  }
}

/* ── POST ─────────────────────────────────────────────────────────────── */

export async function POST(req: NextRequest) {
  const roleErr = requireRole(req, 'admin');
  if (roleErr) return roleErr;

  try {
    const sb = getSupabase();
    const body = await req.json();
    const known = await discoverColumns();

    const now = new Date().toISOString();
    const id = generateId();

    // Build the FULL desired payload — we'll strip unknown columns before insert
    const insertRow: Record<string, unknown> = {
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

    if (body.assignedManagerId != null && body.assignedManagerId !== '') {
      insertRow.assigned_manager_id = body.assignedManagerId;
    }

    // Social / marketing fields — try BOTH possible column names.
    // The schema filter will keep only whichever ones actually exist.
    // Short names:
    insertRow.website   = body.websiteUrl ?? '';
    insertRow.facebook  = body.facebookPageUrl ?? '';
    insertRow.instagram = body.instagramProfileUrl ?? '';
    insertRow.tiktok    = body.tiktokProfileUrl ?? '';
    insertRow.linkedin  = body.linkedinUrl ?? '';
    insertRow.youtube   = body.youtubeUrl ?? '';
    // Long names (alternative convention):
    insertRow.website_url           = body.websiteUrl ?? '';
    insertRow.facebook_page_url     = body.facebookPageUrl ?? '';
    insertRow.instagram_profile_url = body.instagramProfileUrl ?? '';
    insertRow.tiktok_profile_url    = body.tiktokProfileUrl ?? '';
    insertRow.linkedin_url          = body.linkedinUrl ?? '';
    insertRow.youtube_url           = body.youtubeUrl ?? '';
    // Common fields
    insertRow.marketing_goals         = body.marketingGoals ?? '';
    insertRow.key_marketing_messages  = body.keyMarketingMessages ?? '';
    insertRow.logo_url                = body.logoUrl ?? '';

    // Filter to only known DB columns
    let currentRow = filterToKnownColumns(insertRow, known);

    console.log(`[API] POST /api/data/clients payload keys=${Object.keys(currentRow).join(',')}`);
    console.log(`[API] POST /api/data/clients full payload:`, JSON.stringify(currentRow));

    // Insert with column-drop retry (safety net if schema discovery missed something)
    let inserted: ClientRow | null = null;
    let lastError: { message: string; code?: string } | null = null;

    for (let attempt = 0; attempt < 20; attempt++) {
      const { data, error } = await sb
        .from('clients')
        .insert(currentRow)
        .select('*')
        .single();
      if (!error) { inserted = data as ClientRow; break; }
      lastError = error as any;
      const m = error.message.match(
        /Could not find the '([^']+)' column|column .*?['"]?([a-z_]+)['"]? (?:does not exist)/i,
      );
      const badCol = m?.[1] || m?.[2];
      if (!badCol) {
        console.error(`[API] POST /api/data/clients non-column error (attempt ${attempt + 1}):`, error.message);
        break;
      }
      console.warn(`[API] POST /api/data/clients dropping column "${badCol}" (attempt ${attempt + 1})`);
      if (badCol in currentRow) {
        const { [badCol]: _d, ...rest } = currentRow;
        void _d;
        currentRow = rest;
      } else {
        break;
      }
    }

    if (!inserted) {
      console.error('[API] POST /api/data/clients supabase error:', lastError);
      return NextResponse.json(
        { error: lastError?.message ?? 'Insert failed', code: (lastError as any)?.code ?? null },
        { status: 400 },
      );
    }

    console.log(`[API] POST /api/data/clients ✅ created id=${inserted.id}, returned keys: ${Object.keys(inserted).join(', ')}`);
    return NextResponse.json(rowToClient(inserted), { status: 201 });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    console.error('[API] POST /api/data/clients error:', msg);
    return NextResponse.json(
      { error: `Failed to create client: ${msg}` },
      { status: 400 },
    );
  }
}
