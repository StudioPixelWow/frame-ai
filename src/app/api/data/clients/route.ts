/**
 * GET  /api/data/clients — Get all clients
 * POST /api/data/clients — Create a new client
 *
 * Storage: Supabase "clients" table.
 * The frontend uses camelCase field names; this route maps between
 * camelCase (API contract) and snake_case (DB columns).
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

/* ── Auto-add missing columns (runs once per process) ────────────────── */

const EXTRA_COLUMNS = [
  { name: 'assigned_manager_id', def: 'TEXT' },
  { name: 'website_url', def: 'TEXT' },
  { name: 'facebook_page_url', def: 'TEXT' },
  { name: 'instagram_profile_url', def: 'TEXT' },
  { name: 'tiktok_profile_url', def: 'TEXT' },
  { name: 'marketing_goals', def: 'TEXT' },
  { name: 'key_marketing_messages', def: 'TEXT' },
  { name: 'logo_url', def: 'TEXT' },
];

let _columnsEnsured = false;

async function ensureClientColumns() {
  if (_columnsEnsured) return;
  _columnsEnsured = true;
  try {
    const sb = getSupabase();
    // Quick probe — if marketing_goals exists, all extra columns likely exist
    const { error } = await sb.from('clients').select('marketing_goals').limit(1);
    if (!error) return;
    console.warn('[ensureClientColumns] missing columns detected — adding via exec_sql');
    for (const col of EXTRA_COLUMNS) {
      const ddl = `ALTER TABLE clients ADD COLUMN IF NOT EXISTS ${col.name} ${col.def};`;
      const { error: rpcErr } = await sb.rpc('exec_sql', { query: ddl });
      if (rpcErr && !rpcErr.message.includes('already exists')) {
        console.warn(`[ensureClientColumns] failed to add ${col.name}:`, rpcErr.message);
      }
    }
    // Verify
    const { error: verifyErr } = await sb.from('clients').select('marketing_goals').limit(1);
    if (verifyErr) {
      console.error('[ensureClientColumns] STILL cannot access marketing_goals. Run manually:\n' +
        EXTRA_COLUMNS.map(c => `  ALTER TABLE clients ADD COLUMN IF NOT EXISTS ${c.name} ${c.def};`).join('\n'));
      _columnsEnsured = false;
    } else {
      console.log('[ensureClientColumns] ✓ all columns verified');
    }
  } catch (err) {
    console.warn('[ensureClientColumns] error:', err);
    _columnsEnsured = false;
  }
}

/* ── Row → API object (snake_case → camelCase) ────────────────────────── */

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
    // Social & marketing fields
    websiteUrl: (r.website_url as string) ?? '',
    facebookPageUrl: (r.facebook_page_url as string) ?? '',
    instagramProfileUrl: (r.instagram_profile_url as string) ?? '',
    tiktokProfileUrl: (r.tiktok_profile_url as string) ?? '',
    marketingGoals: (r.marketing_goals as string) ?? '',
    keyMarketingMessages: (r.key_marketing_messages as string) ?? '',
    logoUrl: (r.logo_url as string) ?? '',
    createdAt: (r.created_at as string) ?? '',
    updatedAt: (r.updated_at as string) ?? '',
  };
}

/* ── GET ──────────────────────────────────────────────────────────────── */

export async function GET(req: NextRequest) {
  // Only admin and employee can list clients
  const roleErr = requireRole(req, 'admin', 'employee');
  if (roleErr) return roleErr;

  await ensureClientColumns();

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

    const clients = (rows ?? []).map((r) => rowToClient(r as ClientRow));
    return NextResponse.json(clients);
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    console.error('[API] GET /api/data/clients error:', msg);
    return NextResponse.json(
      { error: `Failed to fetch clients: ${msg}` },
      { status: 500 }
    );
  }
}

/* ── POST ─────────────────────────────────────────────────────────────── */

export async function POST(req: NextRequest) {
  // Only admin can create clients
  const roleErr = requireRole(req, 'admin');
  if (roleErr) return roleErr;

  await ensureClientColumns();

  try {
    const sb = getSupabase();
    const body = await req.json();

    const now = new Date().toISOString();
    const id = generateId();

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
      // Social & marketing fields
      website_url: body.websiteUrl ?? '',
      facebook_page_url: body.facebookPageUrl ?? '',
      instagram_profile_url: body.instagramProfileUrl ?? '',
      tiktok_profile_url: body.tiktokProfileUrl ?? '',
      marketing_goals: body.marketingGoals ?? '',
      key_marketing_messages: body.keyMarketingMessages ?? '',
      logo_url: body.logoUrl ?? '',
      created_at: now,
      updated_at: now,
    };
    if (body.assignedManagerId != null && body.assignedManagerId !== '') {
      insertRow.assigned_manager_id = body.assignedManagerId;
    }

    console.log(`[API] POST /api/data/clients payload keys=${Object.keys(insertRow).join(',')}`);

    // Insert with column-drop retry
    let currentRow = { ...insertRow };
    let inserted: ClientRow | null = null;
    let lastError: { message: string; code?: string } | null = null;

    for (let attempt = 0; attempt < 8; attempt++) {
      const { data, error } = await sb
        .from('clients')
        .insert(currentRow)
        .select('*')
        .single();
      if (!error) { inserted = data as ClientRow; break; }
      lastError = error as any;
      const m = error.message.match(/Could not find the '([^']+)' column|column .*?['"]?([a-z_]+)['"]? (?:does not exist)/i);
      const badCol = m?.[1] || m?.[2];
      if (!badCol) break;
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
        { status: 400 }
      );
    }

    console.log(`[API] POST /api/data/clients ✅ created id=${inserted.id}`);
    return NextResponse.json(rowToClient(inserted), { status: 201 });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    console.error('[API] POST /api/data/clients error:', msg);
    return NextResponse.json(
      { error: `Failed to create client: ${msg}` },
      { status: 400 }
    );
  }
}
