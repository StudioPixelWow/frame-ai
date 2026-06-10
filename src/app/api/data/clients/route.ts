/**
 * GET  /api/data/clients — Get all clients
 * POST /api/data/clients — Create a new client
 *
 * Storage: Supabase "clients" table.
 * The frontend uses camelCase field names; this route maps between
 * camelCase (API contract) and snake_case (DB columns).
 *
 * All extra columns (website, facebook, instagram, tiktok, linkedin,
 * youtube, marketing_goals, key_marketing_messages, logo_url) are
 * included in reads AND writes.  Run GET /api/data/clients/schema
 * once after deploy to ensure columns + schema cache are up to date.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/db/store';
import { requireRole, getRequestRole, getRequestClientId, getRequestEmployeeId } from '@/lib/auth/api-guard';

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
    annualPaymentDate:  (r.annual_payment_date as string) ?? null,
    // Meta connection (so UIs can show connected status / account)
    metaAdAccountId:       (r.meta_ad_account_id as string) ?? '',
    metaConnectionStatus:  (r.meta_connection_status as string) ?? 'not_connected',
    metaLastSyncedAt:      (r.meta_last_synced_at as string) ?? null,
    // Facebook Page + Instagram publishing
    fbPageId:              (r.fb_page_id as string) ?? '',
    fbPageName:            (r.fb_page_name as string) ?? '',
    fbPagePicture:         (r.fb_page_picture as string) ?? '',
    igUserId:              (r.ig_user_id as string) ?? '',
    igUsername:            (r.ig_username as string) ?? '',
    // Extra fields — read + write
    websiteUrl:          (r.website as string) ?? '',
    facebookPageUrl:     (r.facebook as string) ?? '',
    instagramProfileUrl: (r.instagram as string) ?? '',
    tiktokProfileUrl:    (r.tiktok as string) ?? '',
    linkedinUrl:         (r.linkedin as string) ?? '',
    youtubeUrl:          (r.youtube as string) ?? '',
    marketingGoals:      (r.marketing_goals as string) ?? '',
    keyMarketingMessages:(r.key_marketing_messages as string) ?? '',
    logoUrl:             (r.logo_url as string) ?? '',
    createdAt:           (r.created_at as string) ?? '',
    updatedAt:           (r.updated_at as string) ?? '',
  };
}

/* ── GET ──────────────────────────────────────────────────────────────── */

export async function GET(req: NextRequest) {
  try {
    const role = getRequestRole(req);

    // Clients can fetch their own record; admin/employee can fetch all
    if (role !== 'client') {
      const roleErr = requireRole(req, 'admin', 'employee');
      if (roleErr) return roleErr;
    }

    const sb = getSupabase();
    console.log('[API] GET /api/data/clients — Supabase client OK, querying clients...');
    let query = sb.from('clients').select('*').order('id');

    // Client role: only return their own record
    if (role === 'client') {
      const clientId = getRequestClientId(req);
      if (!clientId) return NextResponse.json([]);
      query = query.eq('id', clientId);
    }

    // Employee role: only return clients assigned to this employee
    if (role === 'employee') {
      const employeeId = getRequestEmployeeId(req);
      if (employeeId) {
        query = query.eq('assigned_manager_id', employeeId);
      }
    }

    const { data: rows, error } = await query;

    if (error) {
      console.error('[API] GET /api/data/clients error:', error);
      // Return empty array on transient DB errors — polling will retry
      return NextResponse.json([]);
    }

    if (rows && rows.length > 0) {
      console.log(`[API] GET /api/data/clients DB columns: ${Object.keys(rows[0]).join(', ')}`);
    }

    const clients = (rows ?? []).map((r: Record<string, unknown>) => rowToClient(r as unknown as ClientRow));
    console.log(`[API] GET /api/data/clients ✅ returning ${clients.length} clients`);
    return NextResponse.json(clients);
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    console.error('[API] GET /api/data/clients error:', msg);
    // Return empty array on transient errors — polling will retry
    return NextResponse.json([]);
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
      name:                  body.name ?? '',
      company:               body.company ?? '',
      contact_person:        body.contactPerson ?? '',
      email:                 body.email ?? '',
      phone:                 body.phone ?? '',
      notes:                 body.notes ?? '',
      business_field:        body.businessField ?? '',
      client_type:           body.clientType ?? 'marketing',
      annual_payment_date:   body.annualPaymentDate || null,
      status:                body.status ?? 'active',
      retainer_amount:       body.retainerAmount ?? 0,
      retainer_day:          body.retainerDay ?? 1,
      color:                 body.color ?? '#00B5FE',
      converted_from_lead:   body.convertedFromLead ?? null,
      website:               body.websiteUrl ?? '',
      facebook:              body.facebookPageUrl ?? '',
      instagram:             body.instagramProfileUrl ?? '',
      tiktok:                body.tiktokProfileUrl ?? '',
      linkedin:              body.linkedinUrl ?? '',
      youtube:               body.youtubeUrl ?? '',
      marketing_goals:       body.marketingGoals ?? '',
      key_marketing_messages:body.keyMarketingMessages ?? '',
      logo_url:              body.logoUrl ?? '',
      created_at:            now,
      updated_at:            now,
    };

    if (body.assignedManagerId != null && body.assignedManagerId !== '') {
      insertRow.assigned_manager_id = body.assignedManagerId;
    }

    console.log('[API] POST /api/data/clients payload:', JSON.stringify(insertRow));

    let { data: inserted, error: insertErr } = await sb
      .from('clients')
      .insert(insertRow)
      .select('*')
      .single();

    // Resilience: if the insert failed on a column that's missing or the wrong
    // type in this DB (e.g. annual_payment_date is still DATE and we sent "MM-DD"),
    // drop the optional column and retry so client creation never blocks.
    if (insertErr) {
      const msg = String((insertErr as any)?.message || '');
      const optional = ['annual_payment_date', 'fb_page_id', 'ig_user_id'];
      const offending = optional.find((col) => msg.includes(col)) ||
        (/invalid input syntax for type date|column .* does not exist/i.test(msg) ? 'annual_payment_date' : null);
      if (offending) {
        console.warn(`[API] POST /api/data/clients retrying without "${offending}" (${msg})`);
        delete (insertRow as any)[offending];
        ({ data: inserted, error: insertErr } = await sb.from('clients').insert(insertRow).select('*').single());
      }
    }

    if (insertErr) {
      console.error('[API] POST /api/data/clients FAILED:', insertErr);
      return NextResponse.json(
        { error: (insertErr as { message: string }).message ?? 'Insert failed', detail: (insertErr as any)?.details ?? null },
        { status: 400 },
      );
    }

    const newClient = rowToClient(inserted as unknown as ClientRow);
    console.log(`[API] POST /api/data/clients ✅ id=${newClient.id} keys=${Object.keys(inserted as object).join(',')}`);

    // Auto-generate onboarding tasks for the new client (fire-and-forget)
    try {
      const baseUrl = req.nextUrl.origin;
      fetch(`${baseUrl}/api/onboarding/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId: newClient.id, clientName: newClient.name }),
      }).catch(err => console.warn('[API] Onboarding auto-trigger failed:', err));
    } catch { /* non-critical */ }

    return NextResponse.json(newClient, { status: 201 });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    console.error('[API] POST /api/data/clients error:', msg);
    return NextResponse.json({ error: `Failed to create client: ${msg}` }, { status: 400 });
  }
}
