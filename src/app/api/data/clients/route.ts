/**
 * GET  /api/data/clients — Get all clients
 * POST /api/data/clients — Create a new client
 *
 * Storage: Supabase "clients" table (JSONB data column).
 *
 * ┌─────────────────────────────────────────────────────────┐
 * │  Table DDL (run once in Supabase SQL Editor):           │
 * │                                                         │
 * │  CREATE TABLE IF NOT EXISTS clients (                   │
 * │    id   TEXT PRIMARY KEY,                               │
 * │    data JSONB NOT NULL DEFAULT '{}'::jsonb              │
 * │  );                                                     │
 * │                                                         │
 * │  -- Optional: enable RLS but allow service-role full    │
 * │  ALTER TABLE clients ENABLE ROW LEVEL SECURITY;         │
 * │  CREATE POLICY "service_role_all" ON clients            │
 * │    FOR ALL USING (true) WITH CHECK (true);              │
 * └─────────────────────────────────────────────────────────┘
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabase, ensureTable } from '@/lib/db/store';

/* ── Table bootstrap DDL ──────────────────────────────────────────────── */

const CLIENTS_DDL = `
  CREATE TABLE IF NOT EXISTS clients (
    id   TEXT PRIMARY KEY,
    data JSONB NOT NULL DEFAULT '{}'::jsonb
  );
`;

/* ── ID generator ─────────────────────────────────────────────────────── */

function generateId(): string {
  // Matches the old JsonStore pattern: cli_<number>
  // Use timestamp + random to avoid collisions across serverless instances
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 6);
  return `cli_${ts}_${rand}`;
}

/* ── GET ──────────────────────────────────────────────────────────────── */

export async function GET() {
  try {
    const sb = getSupabase();
    await ensureTable('clients', CLIENTS_DDL);

    const { data: rows, error } = await sb
      .from('clients')
      .select('id, data')
      .order('id');

    if (error) {
      console.error('[API] GET /api/data/clients supabase error:', error);
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    // Flatten: each row → { id, ...data }
    // useData<T> on the frontend expects a direct JSON array.
    const clients = (rows ?? []).map((r) => ({ ...r.data, id: r.id }));

    return NextResponse.json(clients);
  } catch (error) {
    console.error('[API] GET /api/data/clients error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch clients' },
      { status: 500 }
    );
  }
}

/* ── POST ─────────────────────────────────────────────────────────────── */

export async function POST(req: NextRequest) {
  try {
    const sb = getSupabase();
    await ensureTable('clients', CLIENTS_DDL);

    const body = await req.json();

    // Build the full client record with defaults
    const now = new Date().toISOString();
    const id = generateId();

    const clientData = {
      id,
      name: body.name || '',
      company: body.company || '',
      contactPerson: body.contactPerson || '',
      email: body.email || '',
      phone: body.phone || '',
      logoUrl: body.logoUrl || '',
      color: body.color || '#00B5FE',
      clientType: body.clientType || 'marketing',
      businessField: body.businessField || '',
      marketingGoals: body.marketingGoals || '',
      keyMarketingMessages: body.keyMarketingMessages || '',
      assignedManagerId: body.assignedManagerId || null,
      websiteUrl: body.websiteUrl || '',
      facebookPageUrl: body.facebookPageUrl || '',
      instagramProfileUrl: body.instagramProfileUrl || '',
      tiktokProfileUrl: body.tiktokProfileUrl || '',
      retainerAmount: body.retainerAmount ?? 0,
      retainerDay: body.retainerDay ?? 1,
      paymentStatus: body.paymentStatus || 'none',
      nextPaymentDate: body.nextPaymentDate || null,
      status: body.status || 'active',
      notes: body.notes || '',
      convertedFromLead: body.convertedFromLead || null,
      createdAt: now,
      updatedAt: now,
      portalEnabled: body.portalEnabled ?? false,
      portalUserId: body.portalUserId || null,
      lastPortalLoginAt: null,
      facebookPageId: body.facebookPageId || '',
      facebookPageName: body.facebookPageName || '',
      instagramAccountId: body.instagramAccountId || '',
      instagramUsername: body.instagramUsername || '',
      tiktokAccountId: body.tiktokAccountId || '',
      tiktokUsername: body.tiktokUsername || '',
      monthlyGanttStatus: body.monthlyGanttStatus || 'none',
      annualGanttStatus: body.annualGanttStatus || 'none',
    };

    // Insert into Supabase. The "data" column stores the full object.
    const { error } = await sb
      .from('clients')
      .insert({ id, data: clientData });

    if (error) {
      console.error('[API] POST /api/data/clients supabase error:', error);
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      );
    }

    // useData.create() expects the full created object back.
    return NextResponse.json(clientData, { status: 201 });
  } catch (error) {
    console.error('[API] POST /api/data/clients error:', error);
    return NextResponse.json(
      { error: 'Failed to create client' },
      { status: 400 }
    );
  }
}
