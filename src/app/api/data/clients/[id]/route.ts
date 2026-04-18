/**
 * GET    /api/data/clients/[id] - Get a single client
 * PUT    /api/data/clients/[id] - Update a client (partial)
 * DELETE /api/data/clients/[id] - Delete a client
 *
 * Storage: Supabase "clients" table (same source of truth as /api/data/clients).
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/db/store';
import { requireRole } from '@/lib/auth/api-guard';

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
    // Social & marketing fields — DB columns: website, facebook, instagram, tiktok, linkedin, youtube
    websiteUrl: (r.website as string) ?? '',
    facebookPageUrl: (r.facebook as string) ?? '',
    instagramProfileUrl: (r.instagram as string) ?? '',
    tiktokProfileUrl: (r.tiktok as string) ?? '',
    linkedinUrl: (r.linkedin as string) ?? '',
    youtubeUrl: (r.youtube as string) ?? '',
    marketingGoals: (r.marketing_goals as string) ?? '',
    keyMarketingMessages: (r.key_marketing_messages as string) ?? '',
    logoUrl: (r.logo_url as string) ?? '',
    createdAt: (r.created_at as string) ?? '',
    updatedAt: (r.updated_at as string) ?? '',
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
  // Social & marketing fields — DB columns: website, facebook, instagram, tiktok, linkedin, youtube
  setIfPresent('websiteUrl', 'website');
  setIfPresent('facebookPageUrl', 'facebook');
  setIfPresent('instagramProfileUrl', 'instagram');
  setIfPresent('tiktokProfileUrl', 'tiktok');
  setIfPresent('linkedinUrl', 'linkedin');
  setIfPresent('youtubeUrl', 'youtube');
  setIfPresent('marketingGoals', 'marketing_goals');
  setIfPresent('keyMarketingMessages', 'key_marketing_messages');
  setIfPresent('logoUrl', 'logo_url');
  out.updated_at = new Date().toISOString();
  return out;
}

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  // Only admin and employee can view client details
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
    const client = rowToClient(data as ClientRow);
    console.log(`[API] GET /api/data/clients/${id} loaded: marketing_goals="${(data as any).marketing_goals ?? '(null)'}" website="${(data as any).website ?? '(null)'}" facebook="${(data as any).facebook ?? '(null)'}" instagram="${(data as any).instagram ?? '(null)'}"`);
    return NextResponse.json(client);
  } catch (error) {
    console.error('[API] GET /api/data/clients/[id] error:', error);
    return NextResponse.json({ error: 'Failed to fetch client' }, { status: 500 });
  }
}

export async function PUT(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  // Only admin can update clients
  const putErr = requireRole(req, 'admin');
  if (putErr) return putErr;

  try {
    const { id } = await context.params;
    let body: Record<string, unknown> = {};
    try { body = (await req.json()) as Record<string, unknown>; } catch { /* noop */ }

    let updatePayload = toDbUpdate(body);
    console.log(`[API] PUT /api/data/clients/${id} fields=${Object.keys(updatePayload).join(',')}`, JSON.stringify(updatePayload));

    const sb = getSupabase();

    // Update with column-drop retry
    let updated: ClientRow | null = null;
    let lastError: { code?: string; message: string } | null = null;

    for (let attempt = 0; attempt < 8; attempt++) {
      const { data, error } = await sb
        .from('clients')
        .update(updatePayload)
        .eq('id', id)
        .select('*')
        .maybeSingle();
      if (!error) { updated = (data as ClientRow) ?? null; break; }
      lastError = error as any;
      const m = error.message.match(/Could not find the '([^']+)' column|column .*?['"]?([a-z_]+)['"]? (?:does not exist)/i);
      const badCol = m?.[1] || m?.[2];
      if (!badCol) break;
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
        { status: 400 }
      );
    }
    if (!updated) {
      return NextResponse.json({ error: 'Client not found', clientId: id }, { status: 404 });
    }
    const result = rowToClient(updated);
    console.log(`[API] PUT /api/data/clients/${id} ✅ saved. marketingGoals="${result.marketingGoals}" websiteUrl="${result.websiteUrl}"`);
    return NextResponse.json(result);
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    console.error('[API] PUT /api/data/clients/[id] fatal:', msg);
    return NextResponse.json({ error: `Failed to update client: ${msg}` }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  // Only admin can delete clients
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
