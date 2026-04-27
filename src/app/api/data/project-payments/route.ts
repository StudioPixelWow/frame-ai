/**
 * GET  /api/data/project-payments           — list payments (filter via ?project_id= or ?client_id=)
 * POST /api/data/project-payments           — create a new payment
 *
 * Backed by Supabase table: public.business_project_payments
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/db/store';
import { insertTimelineEvent } from '@/lib/timeline';
import { requireRole } from '@/lib/auth/api-guard';

const TABLE = 'business_project_payments';

const TABLE_DDL = `
CREATE TABLE IF NOT EXISTS ${TABLE} (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_project_id  TEXT,
  client_id            TEXT,
  milestone_id         TEXT,
  title                TEXT,
  description          TEXT,
  amount               NUMERIC NOT NULL DEFAULT 0,
  payment_type         TEXT,
  is_due               BOOLEAN NOT NULL DEFAULT false,
  is_paid              BOOLEAN NOT NULL DEFAULT false,
  status               TEXT NOT NULL DEFAULT 'pending',
  due_date             DATE,
  paid_at              TIMESTAMPTZ,
  created_at           TIMESTAMPTZ DEFAULT now(),
  updated_at           TIMESTAMPTZ DEFAULT now()
);
`;

/** Every column that must exist — runs ADD COLUMN IF NOT EXISTS for each */
const COLUMN_ALTERS = [
  `ALTER TABLE ${TABLE} ADD COLUMN IF NOT EXISTS business_project_id TEXT`,
  `ALTER TABLE ${TABLE} ADD COLUMN IF NOT EXISTS client_id TEXT`,
  `ALTER TABLE ${TABLE} ADD COLUMN IF NOT EXISTS milestone_id TEXT`,
  `ALTER TABLE ${TABLE} ADD COLUMN IF NOT EXISTS title TEXT`,
  `ALTER TABLE ${TABLE} ADD COLUMN IF NOT EXISTS description TEXT`,
  `ALTER TABLE ${TABLE} ADD COLUMN IF NOT EXISTS amount NUMERIC NOT NULL DEFAULT 0`,
  `ALTER TABLE ${TABLE} ADD COLUMN IF NOT EXISTS payment_type TEXT`,
  `ALTER TABLE ${TABLE} ADD COLUMN IF NOT EXISTS is_due BOOLEAN NOT NULL DEFAULT false`,
  `ALTER TABLE ${TABLE} ADD COLUMN IF NOT EXISTS is_paid BOOLEAN NOT NULL DEFAULT false`,
  `ALTER TABLE ${TABLE} ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'pending'`,
  `ALTER TABLE ${TABLE} ADD COLUMN IF NOT EXISTS due_date DATE`,
  `ALTER TABLE ${TABLE} ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ`,
  `ALTER TABLE ${TABLE} ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now()`,
  `ALTER TABLE ${TABLE} ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now()`,
];

type Row = Record<string, unknown> & { id: string };

function rowToPayment(r: Row) {
  return {
    id: r.id,
    projectId: (r.business_project_id as string) ?? (r.project_id as string) ?? '',
    clientId: (r.client_id as string) ?? '',
    title: (r.title as string) ?? '',
    amount: Number(r.amount ?? 0),
    dueDate: (r.due_date as string) ?? '',
    status: (r.status as string) ?? 'pending',
    description: (r.description as string) ?? '',
    milestoneId: (r.milestone_id as string) ?? null,
    paymentType: (r.payment_type as string) ?? 'custom',
    isDue: r.is_due === true || r.is_due === 'true',
    isPaid: r.is_paid === true || r.is_paid === 'true',
    paidAt: (r.paid_at as string) ?? null,
    createdAt: (r.created_at as string) ?? '',
    updatedAt: (r.updated_at as string) ?? '',
  };
}

/* ── Auto-create table & ensure ALL columns ────────── */
let _tableReady = false;

async function ensureTable(sb: ReturnType<typeof getSupabase>) {
  if (_tableReady) return;

  console.log(`[project-payments] ensureTable: running migration for "${TABLE}"...`);

  // 1. Try CREATE TABLE IF NOT EXISTS via exec_sql RPC
  let rpcAvailable = false;
  try {
    const { error } = await sb.rpc('exec_sql', { query: TABLE_DDL });
    if (error) {
      console.warn(`[project-payments] CREATE TABLE via RPC failed: ${error.message}`);
    } else {
      rpcAvailable = true;
      console.log(`[project-payments] CREATE TABLE IF NOT EXISTS: OK`);
    }
  } catch (e) {
    console.warn('[project-payments] exec_sql RPC not available:', e);
  }

  // 2. Always run column alters — even if table already existed, columns may be missing
  if (rpcAvailable) {
    let colOk = 0;
    let colFail = 0;
    for (const alter of COLUMN_ALTERS) {
      try {
        const { error } = await sb.rpc('exec_sql', { query: alter });
        if (error) {
          console.warn(`[project-payments] ALTER failed: ${alter} — ${error.message}`);
          colFail++;
        } else {
          colOk++;
        }
      } catch {
        colFail++;
      }
    }
    console.log(`[project-payments] column alters: ${colOk} OK, ${colFail} failed`);
    _tableReady = true;
    return;
  }

  // 3. Fallback: probe table to check if it exists at all
  const { error: probe } = await sb.from(TABLE).select('id').limit(1);
  if (probe) {
    const code = (probe as any)?.code ?? '';
    if (code === '42P01' || probe.message?.includes('does not exist')) {
      console.error(
        `[project-payments] ❌ Table "${TABLE}" does not exist and exec_sql RPC is unavailable.\n` +
        `Run this SQL in Supabase Dashboard → SQL Editor:\n\n${TABLE_DDL}`
      );
      return; // cannot proceed
    }
    console.warn(`[project-payments] probe error: ${probe.message}`);
  } else {
    console.log(`[project-payments] table exists (probe OK)`);
  }
  _tableReady = true;
}

/* ── GET ─────────────────────────────────────────────── */
export async function GET(req: NextRequest) {
  // Financial data — admin only
  const roleErr = requireRole(req, 'admin');
  if (roleErr) return roleErr;

  try {
    const sb = getSupabase();
    await ensureTable(sb);

    const url = new URL(req.url);
    const projectId = url.searchParams.get('project_id') || url.searchParams.get('projectId');
    const clientId = url.searchParams.get('client_id') || url.searchParams.get('clientId');

    let q = sb.from(TABLE).select('*').order('due_date', { ascending: true });
    if (projectId) q = q.eq('business_project_id', projectId);
    if (clientId) q = q.eq('client_id', clientId);

    let { data: rows, error } = await q;
    if (error) {
      const code = (error as any)?.code ?? '';
      if (code === '42P01' || error.message?.includes('does not exist')) {
        return NextResponse.json([]);
      }
      // Retry without client_id filter if schema-cache says column missing
      const schemaMatch = error.message.match(/Could not find the '([^']+)' column/i);
      if (schemaMatch && clientId) {
        console.warn(`[project-payments] GET retrying without column '${schemaMatch[1]}'`);
        let retryQ = sb.from(TABLE).select('*').order('due_date', { ascending: true });
        if (projectId) retryQ = retryQ.eq('business_project_id', projectId);
        const retry = await retryQ;
        if (!retry.error) {
          rows = retry.data;
          error = null;
        }
      }
      if (error) {
        console.error('[project-payments] GET error:', error.message);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
    }
    return NextResponse.json((rows ?? []).map((r) => rowToPayment(r as Row)));
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

/* ── POST ────────────────────────────────────────────── */
export async function POST(req: NextRequest) {
  try {
    const sb = getSupabase();
    await ensureTable(sb);

    const body = await req.json();
    const now = new Date().toISOString();
    // Do NOT send `id` — the DB column is uuid type and auto-generates.
    const insertRow: Record<string, unknown> = {
      business_project_id: body.projectId ?? body.business_project_id ?? '',
      client_id: body.clientId ?? body.client_id ?? '',
      title: body.title ?? '',
      amount: Number(body.amount ?? 0),
      due_date: body.dueDate || null,
      status: body.status ?? 'pending',
      description: body.description ?? '',
      milestone_id: body.milestoneId || null,
      payment_type: body.paymentType ?? body.payment_type ?? 'custom',
      is_due: body.isDue === true || body.is_due === true,
      is_paid: body.isPaid === true || body.is_paid === true,
      paid_at: body.paidAt || null,
      created_at: now,
      updated_at: now,
    };

    // Retry loop — auto-drop unknown columns
    let inserted: Row | null = null;
    let lastErr: { message: string } | null = null;
    for (let attempt = 0; attempt < 6; attempt++) {
      const { data, error } = await sb.from(TABLE).insert(insertRow).select('*').single();
      if (!error) { inserted = data as Row; break; }
      lastErr = error;

      const code = (error as any)?.code ?? '';
      if (code === '42P01') {
        console.error(`[project-payments] ❌ Table missing. Run:\n${TABLE_DDL}`);
        break;
      }
      const m = error.message.match(/column .*?['"]?([a-z_]+)['"]? (?:does not exist|of .* does not exist)|Could not find the '([^']+)' column/i);
      const bad = m?.[1] || m?.[2];
      if (bad && bad in insertRow) {
        console.warn(`[project-payments] dropping unknown col "${bad}"`);
        delete insertRow[bad];
      } else { break; }
    }

    if (!inserted) {
      console.error('[project-payments] insert error:', lastErr);
      return NextResponse.json({ error: lastErr?.message ?? 'Insert failed' }, { status: 500 });
    }

    console.log(`[project-payments] ✅ created id=${inserted.id} project=${body.projectId || body.business_project_id}`);

    // Fire-and-forget timeline event
    const projectId = (body.projectId || body.business_project_id) as string;
    if (projectId) {
      const title = (body.title as string) || 'תשלום';
      const amount = Number(body.amount ?? 0);
      insertTimelineEvent(
        projectId,
        'payment_created',
        `תשלום חדש נוסף: "${title}" — ₪${amount.toLocaleString('he-IL')}`,
      );
    }

    return NextResponse.json(rowToPayment(inserted), { status: 201 });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
