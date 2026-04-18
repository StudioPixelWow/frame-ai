/**
 * GET    /api/data/clients/[id] - Get a single client
 * PUT    /api/data/clients/[id] - Update a client (partial)
 * DELETE /api/data/clients/[id] - Delete a client
 *
 * Storage: Supabase "clients" table (same source of truth as /api/data/clients).
 *
 * IMPORTANT: Uses runtime schema discovery so it never sends columns
 * that don't exist in the actual DB.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/db/store';
import { requireRole } from '@/lib/auth/api-guard';

type ClientRow = Record<string, unknown> & { id: string };

/* ── Schema discovery (cached per process) ───────────────────────────── */

let _knownColumns: Set<string> | null = null;

async function discoverColumns(): Promise<Set<string> | null> {
  if (_knownColumns) return _knownColumns;
  try {
    const sb = getSupabase();
    const { data: rpcData, error: rpcErr } = await sb.rpc('exec_sql', {
      query: `SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'clients' ORDER BY ordinal_position;`,
    });
    if (!rpcErr && rpcData) {
      let cols: string[] = [];
      if (typeof rpcData === 'string') {
        try {
          const parsed = JSON.parse(rpcData);
          if (Array.isArray(parsed)) {
            cols = parsed.map((row: Record<string, unknown>) => (row.column_name as string) ?? '').filter(Boolean);
          }
        } catch { /* fall through */ }
      } else if (Array.isArray(rpcData)) {
        cols = rpcData.map((row: Record<string, unknown>) => (row.column_name as string) ?? '').filter(Boolean);
      }
      if (cols.length > 0) {
        _knownColumns = new Set(cols);
        console.log(`[clients/[id]] ✅ schema discovered: ${cols.join(', ')}`);
        return _knownColumns;
      }
    }
    // Fallback: probe with SELECT *
    const { data: probeRows, error: probeErr } = await sb.from('clients').select('*').limit(1);
    if (!probeErr && probeRows && probeRows.length > 0) {
      const cols = Object.keys(probeRows[0]);
      _knownColumns = new Set(cols);
      console.log(`[clients/[id]] ✅ schema via SELECT * probe: ${cols.join(', ')}`);
      return _knownColumns;
    }
    console.warn('[clients/[id]] ⚠️ could not discover schema');
    return null;
  } catch (err) {
    console.warn('[clients/[id]] schema discovery error:', err);
    return null;
  }
}

function filterToKnownColumns(
  payload: Record<string, unknown>,
  known: Set<string> | null,
): Record<string, unknown> {
  if (!known) return payload;
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
    console.log(`[clients/[id]] filterToKnownColumns dropped: ${dropped.join(', ')}`);
  }
  return filtered;
}

/* ── Row → API object ────────────────────────────────────────────────── */

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

/** Map incoming camelCase partial update → all possible DB column names.
 *  The caller will filter to only known columns before sending to Supabase. */
function toDbUpdate(body: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  const setIfPresent = (bodyKey: string, dbKey: string) => {
    if (body[bodyKey] !== undefined) out[dbKey] = body[bodyKey];
  };
  // Also set both possible column name conventions for social fields
  const setIfPresentDual = (bodyKey: string, shortKey: string, longKey: string) => {
    if (body[bodyKey] !== undefined) {
      out[shortKey] = body[bodyKey];
      out[longKey]  = body[bodyKey];
    }
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
  // Social & marketing — emit both naming conventions; schema filter removes wrong ones
  setIfPresentDual('websiteUrl',          'website',   'website_url');
  setIfPresentDual('facebookPageUrl',     'facebook',  'facebook_page_url');
  setIfPresentDual('instagramProfileUrl', 'instagram', 'instagram_profile_url');
  setIfPresentDual('tiktokProfileUrl',    'tiktok',    'tiktok_profile_url');
  setIfPresentDual('linkedinUrl',         'linkedin',  'linkedin_url');
  setIfPresentDual('youtubeUrl',          'youtube',   'youtube_url');
  setIfPresent('marketingGoals', 'marketing_goals');
  setIfPresent('keyMarketingMessages', 'key_marketing_messages');
  setIfPresent('logoUrl', 'logo_url');
  out.updated_at = new Date().toISOString();
  return out;
}

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const getErr = requireRole(req, 'admin', 'employee');
  if (getErr) return getErr;

  try {
    const { id } = await context.params;
    const sb = getSupabase();

    // Discover schema on first call
    await discoverColumns();

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

    // Debug: log actual keys returned from DB
    console.log(`[API] GET /api/data/clients/${id} DB keys: ${Object.keys(data).join(', ')}`);

    const client = rowToClient(data as ClientRow);
    console.log(`[API] GET /api/data/clients/${id} mapped: websiteUrl="${client.websiteUrl}" facebookPageUrl="${client.facebookPageUrl}" instagramProfileUrl="${client.instagramProfileUrl}" marketingGoals="${client.marketingGoals}"`);
    return NextResponse.json(client);
  } catch (error) {
    console.error('[API] GET /api/data/clients/[id] error:', error);
    return NextResponse.json({ error: 'Failed to fetch client' }, { status: 500 });
  }
}

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

    const known = await discoverColumns();
    const rawUpdate = toDbUpdate(body);
    let updatePayload = filterToKnownColumns(rawUpdate, known);

    console.log(`[API] PUT /api/data/clients/${id} raw fields=${Object.keys(rawUpdate).join(',')} filtered fields=${Object.keys(updatePayload).join(',')}`, JSON.stringify(updatePayload));

    const sb = getSupabase();

    // Update with column-drop retry (safety net)
    let updated: ClientRow | null = null;
    let lastError: { code?: string; message: string } | null = null;

    for (let attempt = 0; attempt < 20; attempt++) {
      const { data, error } = await sb
        .from('clients')
        .update(updatePayload)
        .eq('id', id)
        .select('*')
        .maybeSingle();
      if (!error) { updated = (data as ClientRow) ?? null; break; }
      lastError = error as any;
      const m = error.message.match(
        /Could not find the '([^']+)' column|column .*?['"]?([a-z_]+)['"]? (?:does not exist)/i,
      );
      const badCol = m?.[1] || m?.[2];
      if (!badCol) {
        console.error(`[API] PUT /api/data/clients/${id} non-column error (attempt ${attempt + 1}):`, error.message);
        break;
      }
      if (badCol in updatePayload) {
        console.warn(`[API] PUT /api/data/clients/${id} dropping column "${badCol}" (attempt ${attempt + 1})`);
        const { [badCol]: _d, ...rest } = updatePayload;
        void _d;
        updatePayload = rest;
      } else {
        break;
      }
    }

    if (lastError && !updated) {
      console.error('[API] PUT /api/data/clients/[id] supabase error:', lastError);
      return NextResponse.json(
        { error: lastError.message, code: lastError.code ?? null },
        { status: 400 },
      );
    }
    if (!updated) {
      return NextResponse.json({ error: 'Client not found', clientId: id }, { status: 404 });
    }
    const result = rowToClient(updated);
    console.log(`[API] PUT /api/data/clients/${id} ✅ saved. websiteUrl="${result.websiteUrl}" marketingGoals="${result.marketingGoals}"`);
    return NextResponse.json(result);
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    console.error('[API] PUT /api/data/clients/[id] fatal:', msg);
    return NextResponse.json({ error: `Failed to update client: ${msg}` }, { status: 500 });
  }
}

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
