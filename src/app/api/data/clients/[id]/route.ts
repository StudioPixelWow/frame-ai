/**
 * GET    /api/data/clients/[id] - Get a single client
 * PUT    /api/data/clients/[id] - Update a client (partial)
 * DELETE /api/data/clients/[id] - Delete a client
 *
 * Storage: Supabase "clients" table.
 *
 * DB social columns: website, facebook, instagram, tiktok, linkedin, youtube
 * DB marketing columns: marketing_goals, key_marketing_messages
 *
 * If PostgREST's schema cache is stale we issue NOTIFY pgrst,'reload schema'
 * and retry.
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
    // Social — DB columns: website, facebook, instagram, tiktok, linkedin, youtube
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

/* ── camelCase body → snake_case DB payload ───────────────────────────── */

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
  // Social — DB columns: website, facebook, instagram, tiktok, linkedin, youtube
  set('websiteUrl', 'website');
  set('facebookPageUrl', 'facebook');
  set('instagramProfileUrl', 'instagram');
  set('tiktokProfileUrl', 'tiktok');
  set('linkedinUrl', 'linkedin');
  set('youtubeUrl', 'youtube');
  // Marketing
  set('marketingGoals', 'marketing_goals');
  set('keyMarketingMessages', 'key_marketing_messages');
  set('logoUrl', 'logo_url');

  out.updated_at = new Date().toISOString();
  return out;
}

/* ── Schema cache refresh ────────────────────────────────────────────── */

async function refreshSchemaCache(sb: ReturnType<typeof getSupabase>): Promise<boolean> {
  try {
    await sb.rpc('exec_sql', { query: `NOTIFY pgrst, 'reload schema';` });
    console.log('[clients/[id]] ✅ PostgREST schema cache reload requested');
    return true;
  } catch (e) {
    console.warn('[clients/[id]] ⚠️ could not reload schema cache:', e);
    return false;
  }
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
    console.log(`[API] GET /api/data/clients/${id} raw:`, JSON.stringify(data));

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

    let updatePayload = toDbUpdate(body);
    console.log(`[API] PUT /api/data/clients/${id} payload:`, JSON.stringify(updatePayload));

    const sb = getSupabase();
    let updated: ClientRow | null = null;
    let lastError: { code?: string; message: string } | null = null;
    const droppedColumns: string[] = [];
    let schemaCacheRetries = 0;
    const MAX_SCHEMA_RETRIES = 3;
    let refreshAttempted = false;

    for (let attempt = 0; attempt < 25; attempt++) {
      const { data, error } = await sb
        .from('clients')
        .update(updatePayload)
        .eq('id', id)
        .select('*')
        .maybeSingle();

      if (!error) { updated = (data as ClientRow) ?? null; break; }

      lastError = error as { code?: string; message: string };
      const msg = error.message;

      // Extract column name from error
      const m = msg.match(
        /Could not find the '([^']+)' column|column .*?['"]?([a-z_]+)['"]? (?:does not exist|of relation)/i,
      );
      const badCol = m?.[1] || m?.[2];

      // ── Schema cache stale ──
      if (msg.includes('schema cache')) {
        schemaCacheRetries++;
        if (!refreshAttempted) {
          console.warn(`[clients/[id]] schema cache miss — refreshing: ${msg}`);
          await refreshSchemaCache(sb);
          refreshAttempted = true;
        }
        if (schemaCacheRetries <= MAX_SCHEMA_RETRIES) {
          console.log(`[clients/[id]] schema cache retry ${schemaCacheRetries}/${MAX_SCHEMA_RETRIES}`);
          continue;
        }
        // Exhausted retries — drop the problematic column
        if (badCol && badCol in updatePayload) {
          console.warn(`[clients/[id]] schema cache persists for "${badCol}" — dropping`);
          const { [badCol]: _dropped, ...rest } = updatePayload;
          void _dropped;
          updatePayload = rest;
          droppedColumns.push(badCol);
          schemaCacheRetries = 0;
          continue;
        }
        break;
      }

      // ── Genuine missing column ──
      if (badCol && badCol in updatePayload) {
        console.warn(`[API] PUT /clients/${id} column "${badCol}" does not exist — dropping`);
        const { [badCol]: _dropped, ...rest } = updatePayload;
        void _dropped;
        updatePayload = rest;
        droppedColumns.push(badCol);
        continue;
      }

      console.error(`[API] PUT /clients/${id} error (attempt ${attempt + 1}):`, msg);
      break;
    }

    if (droppedColumns.length > 0) {
      console.warn(`[API] PUT /clients/${id} ⚠️ dropped columns: ${droppedColumns.join(', ')}`);
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
    console.log(`[API] PUT /api/data/clients/${id} ✅ saved keys=${Object.keys(updated).join(',')}`);
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
